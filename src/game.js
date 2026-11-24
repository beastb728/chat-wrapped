// "Who Said It?" round builder. Pure, runs in the worker.
// Picks real messages that are fun to guess and safe to show to a room.

const URLISH = /https?:\/\/|www\.|\S+@\S+\.\S+/i;
const NUMBERISH = /\d[\d\s\-().]{5,}\d|\d{4,}/; // phone numbers, codes, amounts, addresses
const PICTO = /\p{Extended_Pictographic}/u;
const SPICY = /(?<!\p{L})(?:fuck\p{L}*|shit\p{L}*|bitch\p{L}*|dick\p{L}*|cock|pussy|cunt|tits?|boobs?|sex\p{L}*|nudes?|porn\p{L}*|horny|nsfw|slut|whore|puta\p{L}*|mierda|joder|coño|verga|caralho|porra|buceta|foda\p{L}*|merda|scheiße|fick\p{L}*|putain|merde|cazzo|chutiya|madarchod|bhenchod|behenchod|gaand|lund|randi|kontol|anjing|bangsat)(?!\p{L})/iu;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Is this message fun and safe to put on screen? */
export function isPlayable(m, { minWords = 5, spicy = false, names = [] } = {}) {
  if (m.type !== 'text' || !m.author) return false;
  const t = m.text.trim();
  if (t.length > 240 || t.includes('\n')) return false;
  const words = t.split(/\s+/).filter(w => /\p{L}/u.test(w));
  if (words.length < minWords) return false;
  if (URLISH.test(t) || NUMBERISH.test(t)) return false;
  if (!spicy && SPICY.test(t)) return false;
  // Too easy if the sender's own name is in it ("Maya here!").
  const own = m.author.split(/\s+/)[0].toLowerCase();
  if (own.length >= 3 && t.toLowerCase().includes(own)) return false;
  return true;
}

function optionsFor(answer, people, r, max = 4) {
  if (people.length <= max) return shuffle([...people], r);
  const others = shuffle(people.filter(p => p !== answer), r).slice(0, max - 1);
  return shuffle([answer, ...others], r);
}

/**
 * @param messages      parseChat().messages
 * @param opts.rounds   number of rounds
 * @param opts.year     restrict to a calendar year (null = all)
 * @param opts.spicy    allow profanity/NSFW-ish messages
 * @param opts.seed     for reproducible decks
 * @returns {{rounds: Array, reserve: Array, eligible: number, people: string[]}}
 */
export function buildGame(messages, { rounds = 15, year = null, spicy = false, minWords = 5, seed = Date.now() } = {}) {
  const r = rng(seed);
  const inYear = messages.filter(m => m.type !== 'system' && (year == null || new Date(m.ts).getUTCFullYear() === year));

  const counts = new Map();
  for (const m of inYear) if (m.author) counts.set(m.author, (counts.get(m.author) || 0) + 1);
  // Only people with enough messages to be guessable.
  const people = [...counts.entries()].filter(([, c]) => c >= 10).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  if (people.length < 2) return { rounds: [], reserve: [], eligible: 0, people };

  const seen = new Set();
  const byAuthor = new Map(people.map(p => [p, []]));
  // Shuffle first so a repeated line keeps a random occurrence, not the earliest.
  const candidates = shuffle(inYear.filter(m => byAuthor.has(m.author) && isPlayable(m, { minWords, spicy })), r);
  for (const m of candidates) {
    // Treat messages that differ only by emoji/punctuation as duplicates.
    const key = m.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    byAuthor.get(m.author).push(m);
  }
  for (const list of byAuthor.values()) shuffle(list, r);

  // Round-robin across people so the quiet ones show up too.
  const quotes = [];
  const queues = shuffle([...byAuthor.entries()].filter(([, l]) => l.length), r);
  while (queues.some(([, l]) => l.length)) {
    for (const [, l] of queues) if (l.length) quotes.push(l.pop());
  }
  const eligible = quotes.length;
  const toRound = m => ({ type: 'quote', text: m.text.trim(), answer: m.author, ts: m.ts, options: optionsFor(m.author, people, r) });

  const emojiRounds = buildEmojiRounds(inYear, people, r);
  const out = [];
  let qi = 0, ei = 0;
  for (let i = 0; i < rounds; i++) {
    const emojiTurn = (i + 1) % 5 === 0 && ei < emojiRounds.length;
    if (emojiTurn) out.push(emojiRounds[ei++]);
    else if (qi < quotes.length) out.push(toRound(quotes[qi++]));
    else if (ei < emojiRounds.length) out.push(emojiRounds[ei++]);
  }
  shuffleQuotesKeepingEmojiSlots(out, r);
  return { rounds: out, reserve: quotes.slice(qi, qi + 60).map(toRound), eligible, people };
}

function shuffleQuotesKeepingEmojiSlots(rounds, r) {
  const idx = rounds.map((x, i) => (x.type === 'quote' ? i : -1)).filter(i => i >= 0);
  const vals = shuffle(idx.map(i => rounds[i]), r);
  idx.forEach((i, k) => { rounds[i] = vals[k]; });
}

/** "Who sends 😂 the most?" Only emojis with a clear winner. */
function buildEmojiRounds(messages, people, r) {
  const per = new Map(); // emoji -> Map(person -> count)
  const display = new Map();
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  for (const m of messages) {
    if (m.type !== 'text' || !PICTO.test(m.text) || !people.includes(m.author)) continue;
    const parts = seg ? [...seg.segment(m.text)].map(s => s.segment) : [...m.text];
    for (const g of parts) {
      if (!PICTO.test(g)) continue;
      const e = g.replace(/\uFE0F/g, '');
      if (!display.has(e)) display.set(e, g);
      if (!per.has(e)) per.set(e, new Map());
      const c = per.get(e);
      c.set(m.author, (c.get(m.author) || 0) + 1);
    }
  }
  const rounds = [];
  for (const [emoji, c] of per) {
    const ranked = [...c.entries()].sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((s, [, n]) => s + n, 0);
    if (total < 15 || (ranked[1] && ranked[0][1] < ranked[1][1] * 1.3)) continue;
    rounds.push({
      type: 'emoji',
      emoji: display.get(emoji),
      answer: ranked[0][0],
      counts: ranked.slice(0, 4),
      total,
      options: optionsFor(ranked[0][0], people, r),
    });
  }
  return shuffle(rounds, r).slice(0, 6);
}

/** Summarise a finished game. Contains no message text, so it's safe for share cards. */
export function summarize(log, players) {
  const correct = log.filter(x => x.correct).length;
  const byAuthor = new Map();
  for (const x of log) {
    if (x.type !== 'quote') continue;
    const a = byAuthor.get(x.answer) || { right: 0, total: 0 };
    a.total++;
    if (x.correct) a.right++;
    byAuthor.set(x.answer, a);
  }
  const rated = [...byAuthor.entries()].filter(([, v]) => v.total >= 2).map(([n, v]) => ({ name: n, rate: v.right / v.total, ...v }));
  rated.sort((a, b) => b.rate - a.rate || b.total - a.total);
  const scores = players.map(p => ({ name: p, score: log.filter(x => x.player === p && x.correct).length, played: log.filter(x => x.player === p).length }));
  scores.sort((a, b) => b.score - a.score);
  return {
    correct,
    total: log.length,
    scores,
    easiest: rated[0] && rated[0].rate > (rated[rated.length - 1]?.rate ?? 0) ? rated[0] : null,
    hardest: rated.length > 1 ? rated[rated.length - 1] : null,
  };
}
