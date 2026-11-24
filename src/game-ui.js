// UI for "Who Said It?". Pass-and-play on one device; everything stays local.
import { drawCard, buildGameCard } from './cards.js';
import { summarize } from './game.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = ts => { const d = new Date(ts); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

export function initGame({ $, show, worker, shareFiles, siteDomain }) {
  const g = { players: [], rounds: [], reserve: [], i: 0, log: [], answered: false, summary: null, blob: null };

  const el = (tag, { dataset, ...props } = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    if (dataset) Object.assign(n.dataset, dataset);
    n.append(...kids);
    return n;
  };

  // --- Setup ---------------------------------------------------------------
  function renderPlayers() {
    $('#players').replaceChildren(...g.players.map((p, idx) =>
      el('li', {}, p, ' ', el('button', { type: 'button', className: 'chip-x', textContent: '✕', ariaLabel: `Remove ${p}`, onclick: () => { g.players.splice(idx, 1); renderPlayers(); } }))));
    $('#players-hint').textContent = g.players.length
      ? `${g.players.length} player${g.players.length > 1 ? 's' : ''}. Take turns, highest score wins.`
      : 'No players? Play as one team and shout your answers.';
  }

  $('#player-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#player-name').value.trim();
    if (name && !g.players.includes(name) && g.players.length < 12) g.players.push(name);
    $('#player-name').value = '';
    renderPlayers();
  });

  $('#game-deal').addEventListener('click', () => {
    $('#game-msg').hidden = true;
    const y = $('#game-year').value;
    worker.postMessage({
      type: 'game',
      rounds: Number($('#game-rounds').value),
      year: y === 'all' ? null : Number(y),
      spicy: $('#game-spicy').checked,
    });
  });

  function onGame(game) {
    if (!game.rounds.length) {
      $('#game-msg').textContent = game.people.length < 2
        ? 'This game needs at least 2 people with 10+ messages in the chosen period.'
        : 'Not enough guessable messages in this period. Try "All time" or allow spicy messages.';
      $('#game-msg').hidden = false;
      return;
    }
    g.rounds = game.rounds;
    g.reserve = game.reserve;
    $('#review-list').hidden = true;
    $('#game-review-toggle').textContent = 'Show messages';
    renderReview();
    show('game-review');
  }

  // --- Host check --------------------------------------------------------------
  function renderReview() {
    $('#review-list').replaceChildren(...g.rounds.map((r, idx) => {
      const label = r.type === 'quote' ? r.text : `Emoji round: who sends ${r.emoji} the most?`;
      const swap = el('button', { type: 'button', className: 'btn ghost small-btn', textContent: 'Swap' });
      swap.disabled = r.type !== 'quote' || !g.reserve.length;
      swap.onclick = () => { g.rounds[idx] = g.reserve.shift(); renderReview(); };
      return el('li', {}, el('span', { dir: 'auto', textContent: label }), swap);
    }));
  }
  $('#game-review-toggle').addEventListener('click', () => {
    const list = $('#review-list');
    list.hidden = !list.hidden;
    $('#game-review-toggle').textContent = list.hidden ? 'Show messages' : 'Hide messages';
  });
  $('#game-start').addEventListener('click', () => {
    g.i = 0;
    g.log = [];
    show('game-play');
    renderRound();
  });

  // --- Play ----------------------------------------------------------------
  const currentPlayer = () => (g.players.length ? g.players[g.i % g.players.length] : null);

  function scoreText() {
    if (!g.players.length) return `Score ${g.log.filter(x => x.correct).length}`;
    return g.players.map(p => `${p} ${g.log.filter(x => x.player === p && x.correct).length}`).join(' · ');
  }

  function renderRound() {
    const r = g.rounds[g.i];
    g.answered = false;
    $('#g-round').textContent = `Round ${g.i + 1}/${g.rounds.length}`;
    $('#g-score').textContent = scoreText();
    const p = currentPlayer();
    $('#g-turn').textContent = p ? `${p}'s turn` : 'Everyone guess';
    const q = $('#g-question');
    if (r.type === 'quote') {
      q.className = 'question';
      q.replaceChildren(el('p', { className: 'q-label', textContent: 'Who said this?' }), el('blockquote', { className: 'bubble', dir: 'auto', textContent: r.text }));
    } else {
      q.className = 'question emoji-q';
      q.replaceChildren(el('p', { className: 'q-label', textContent: 'Bonus round: who sends this emoji the most?' }), el('div', { className: 'big-emoji', textContent: r.emoji }));
    }
    $('#g-options').replaceChildren(...r.options.map((name, k) =>
      el('button', { type: 'button', className: 'opt', textContent: name, onclick: () => pick(name), dataset: { key: String(k + 1) } })));
    $('#g-reveal').textContent = '';
    $('#g-next').hidden = true;
  }

  function pick(name) {
    if (g.answered) return;
    g.answered = true;
    const r = g.rounds[g.i];
    const correct = name === r.answer;
    g.log.push({ type: r.type, answer: r.answer, guess: name, correct, player: currentPlayer() });
    for (const b of $('#g-options').children) {
      b.disabled = true;
      if (b.textContent === r.answer) b.classList.add('right');
      else if (b.textContent === name) b.classList.add('wrong');
    }
    const verdict = correct ? 'Correct' : `Nope, it was ${r.answer}`;
    $('#g-reveal').textContent = r.type === 'quote'
      ? `${verdict} · sent ${fmtDate(r.ts)}`
      : `${verdict} · ${r.counts.map(([n, c]) => `${n} ${c}`).join(' · ')}`;
    $('#g-score').textContent = scoreText();
    $('#g-next').textContent = g.i === g.rounds.length - 1 ? 'See results' : 'Next';
    $('#g-next').hidden = false;
    $('#g-next').focus();
  }

  $('#g-next').addEventListener('click', () => {
    g.i++;
    if (g.i >= g.rounds.length) end();
    else renderRound();
  });
  $('#g-quit').addEventListener('click', () => (g.log.length ? end() : show('game-setup')));
  addEventListener('keydown', e => {
    if ($('#screen-game-play').hidden) return;
    const b = [...$('#g-options').children].find(x => x.dataset.key === e.key);
    if (b && !g.answered) b.click();
    else if (e.key === 'Enter' && g.answered && document.activeElement !== $('#g-next')) $('#g-next').click();
  });

  // --- Results ---------------------------------------------------------------
  function end() {
    g.summary = summarize(g.log, g.players);
    const board = $('#g-board');
    board.hidden = !g.summary.scores.length;
    board.replaceChildren(...g.summary.scores.map((s, k) =>
      el('li', {}, el('span', { textContent: `${k + 1}. ${s.name}` }), el('b', { textContent: `${s.score}/${s.played}` }))));
    show('game-end');
    renderCard();
  }

  async function renderCard() {
    const card = buildGameCard(g.summary, { hideNames: $('#game-hide').checked, site: siteDomain() });
    drawCard($('#game-card'), card);
    g.blob = null;
    g.blob = await new Promise(r => $('#game-card').toBlob(r, 'image/png'));
  }
  $('#game-hide').addEventListener('change', renderCard);

  const resultFile = () => new File([g.blob], 'who-said-it-result.png', { type: 'image/png' });
  $('#game-share').addEventListener('click', e => g.blob && shareFiles([resultFile()], true, e.currentTarget, 'We played Who Said It? with our group chat 🕵️'));
  $('#game-download').addEventListener('click', () => g.blob && shareFiles([resultFile()], true, null, null, true));
  $('#game-again').addEventListener('click', () => show('game-setup'));

  return {
    onGame,
    setYears(years) {
      $('#game-year').replaceChildren(new Option('All time', 'all'), ...years.map(y => new Option(String(y), String(y))));
      $('#game-year').value = 'all';
      $('#game-msg').hidden = true;
    },
    reset() {
      Object.assign(g, { rounds: [], reserve: [], i: 0, log: [], summary: null, blob: null });
    },
  };
}
