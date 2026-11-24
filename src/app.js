import { buildDeck, drawCard, W, H } from './cards.js';
import { siteDomain, REPO_URL } from './config.js';
import { initGame } from './game-ui.js';

const $ = sel => document.querySelector(sel);
const screens = ['home', 'loading', 'error', 'modes', 'wrapped', 'game-setup', 'game-review', 'game-play', 'game-end'];
const show = name => {
  screens.forEach(s => { $(`#screen-${s}`).hidden = s !== name; });
  scrollTo(0, 0);
};

// Create the worker up front so no request happens after you pick a file.
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

const state = {
  meta: null, years: [], stats: null, deck: [], index: 0, mode: null,
  blobs: new Map(), statsReq: 0,
};

// ---------------------------------------------------------------------------
// Network counter: proof that nothing is sent after you open your chat.
let armedAt = null;
let requestsSinceArmed = 0;
function renderNet() {
  const el = $('#net');
  const offline = navigator.onLine ? '' : ' · ✈️ offline';
  el.textContent = armedAt == null
    ? `🛡️ Watch this counter. It stays at 0 after you open your chat${offline}`
    : `🛡️ ${requestsSinceArmed} network request${requestsSinceArmed === 1 ? '' : 's'} since you opened your chat${offline}`;
  el.classList.toggle('bad', requestsSinceArmed > 0);
}
if ('PerformanceObserver' in window) {
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) if (armedAt != null && e.startTime >= armedAt) requestsSinceArmed++;
    renderNet();
  }).observe({ type: 'resource', buffered: true });
}
addEventListener('online', renderNet);
addEventListener('offline', renderNet);
const arm = () => { if (armedAt == null) { armedAt = performance.now(); renderNet(); } };
renderNet();

// ---------------------------------------------------------------------------
// Worker messages
worker.onmessage = ({ data }) => {
  if (data.type === 'progress') {
    $('#load-stage').textContent = data.stage;
    $('#load-bar').style.width = `${Math.round(data.fraction * 100)}%`;
  } else if (data.type === 'loaded') {
    state.meta = data.meta;
    state.years = data.years;
    setupControls(data);
    game.setYears(data.years);
    if (state.mode === 'wrapped') requestStats();
    else {
      $('#modes-info').textContent = `${data.count.toLocaleString('en')} messages from ${data.participants.length} people. Still only on this device.`;
      show('modes');
    }
  } else if (data.type === 'stats') {
    if (data.id !== state.statsReq) return;
    if (!data.stats) return showError({ message: 'No messages in this period.' });
    state.stats = data.stats;
    rebuildDeck(true);
    show('wrapped');
  } else if (data.type === 'game') {
    game.onGame(data.game);
  } else if (data.type === 'error') {
    showError(data);
  }
};

function startFile(file) {
  if (!file) return;
  arm();
  state.mode = null;
  state.stats = null;
  show('loading');
  worker.postMessage({ type: 'file', file });
}

function startSample() {
  arm();
  state.mode = null;
  state.stats = null;
  show('loading');
  worker.postMessage({ type: 'sample' });
}

function requestStats() {
  const v = $('#year').value;
  state.statsReq++;
  worker.postMessage({ type: 'stats', id: state.statsReq, year: v === 'all' ? null : Number(v) });
}

function setupControls({ years, meta }) {
  const sel = $('#year');
  sel.replaceChildren(...years.map(y => new Option(String(y), String(y))), new Option('All time', 'all'));
  // Default to this year if it has data (Wrapped season), else the latest year.
  sel.value = String(years[0] ?? 'all');
  $('#date-order').value = meta.dateOrder;
  $('#format-info').textContent = `${meta.platform === 'ios' ? 'iPhone' : 'Android'} export · ${meta.hour12 ? '12h' : '24h'} clock · dates read as ${meta.dateOrder.split('').join('/')}`;
}

function showError({ message, code, sample }) {
  $('#error-msg').textContent = message || 'Something went wrong.';
  const hasSample = !!sample;
  $('#error-sample-wrap').hidden = !hasSample;
  if (hasSample) {
    $('#error-sample').textContent = sample;
    $('#error-report').href = `${REPO_URL}/issues/new?labels=format`;
  }
  $('#error-hint').hidden = code !== 'NO_MESSAGES';
  show('error');
}

// ---------------------------------------------------------------------------
// Deck & viewer
function rebuildDeck(resetIndex) {
  state.deck = buildDeck(state.stats, {
    hideNames: $('#hide-names').checked,
    showWords: $('#show-words').checked,
    site: siteDomain(),
  });
  if (resetIndex) state.index = 0;
  state.index = Math.min(state.index, state.deck.length - 1);
  state.blobs.clear();
  const prog = $('#progress');
  prog.replaceChildren(...state.deck.map(() => document.createElement('span')));
  render();
  // Pre-render images in the background so "Share all" is instant (share
  // must be called while the tap is still fresh, especially on iOS).
  prerenderAll();
}

let prerenderToken = 0;
async function prerenderAll() {
  const token = ++prerenderToken;
  const off = document.createElement('canvas');
  for (let i = 0; i < state.deck.length; i++) {
    if (token !== prerenderToken) return;
    if (state.blobs.has(i)) continue;
    await new Promise(r => (window.requestIdleCallback || setTimeout)(r));
    drawCard(off, state.deck[i]);
    const blob = await new Promise(r => off.toBlob(r, 'image/png'));
    if (token === prerenderToken) state.blobs.set(i, blob);
  }
}

function render() {
  const card = state.deck[state.index];
  drawCard($('#card'), card);
  $('#card').setAttribute('aria-label', `Card ${state.index + 1} of ${state.deck.length}: ${card.title}`);
  [...$('#progress').children].forEach((el, i) => el.classList.toggle('on', i <= state.index));
  $('#prev').disabled = state.index === 0;
  $('#next').disabled = state.index === state.deck.length - 1;
}

function go(delta) {
  const n = Math.max(0, Math.min(state.deck.length - 1, state.index + delta));
  if (n !== state.index) { state.index = n; render(); }
}

// Tap left/right, swipe, or use arrow keys.
let downX = null;
$('#card').addEventListener('pointerdown', e => { downX = e.clientX; });
$('#card').addEventListener('pointerup', e => {
  if (downX == null) return;
  const dx = e.clientX - downX;
  downX = null;
  if (Math.abs(dx) > 40) return go(dx < 0 ? 1 : -1);
  const r = e.currentTarget.getBoundingClientRect();
  go(e.clientX - r.left < r.width * 0.33 ? -1 : 1);
});
addEventListener('keydown', e => {
  if ($('#screen-wrapped').hidden) return;
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
});
$('#prev').addEventListener('click', () => go(-1));
$('#next').addEventListener('click', () => go(1));

// ---------------------------------------------------------------------------
// Sharing
function blobFor(i) {
  if (state.blobs.has(i)) return Promise.resolve(state.blobs.get(i));
  const c = document.createElement('canvas');
  drawCard(c, state.deck[i]);
  return new Promise(r => c.toBlob(b => { state.blobs.set(i, b); r(b); }, 'image/png'));
}

const fileName = i => `chat-wrapped-${String(i + 1).padStart(2, '0')}-${state.deck[i].id}.png`;

async function share(indices, button) {
  const ready = indices.every(i => state.blobs.has(i));
  const blobs = await Promise.all(indices.map(blobFor));
  const files = blobs.map((b, k) => new File([b], fileName(indices[k]), { type: 'image/png' }));
  return shareFiles(files, ready, button, 'Our chat, Wrapped 👀');
}

/** Share images via the OS share sheet (straight into WhatsApp/Instagram), else download. */
async function shareFiles(files, ready, button, caption, forceDownload = false) {
  if (!forceDownload && navigator.canShare?.({ files })) {
    if (!ready) {
      // We had to render first, so the tap may have expired. Ask for one more tap.
      if (button) flash(button, 'Ready! Tap again');
      return;
    }
    try {
      await navigator.share({ files, text: `${caption} Get yours (100% private): https://${siteDomain()}` });
    } catch (e) {
      if (e.name !== 'AbortError') download(files);
    }
    return;
  }
  download(files);
}

function download(files) {
  files.forEach((f, k) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, k * 250));
}

function flash(btn, msg) {
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 2500);
}

$('#share-one').addEventListener('click', e => share([state.index], e.currentTarget));
$('#share-all').addEventListener('click', e => share(state.deck.map((_, i) => i), e.currentTarget));
$('#download-one').addEventListener('click', async () => download([new File([await blobFor(state.index)], fileName(state.index))]));

// ---------------------------------------------------------------------------
// Controls
$('#year').addEventListener('change', requestStats);
$('#hide-names').addEventListener('change', () => rebuildDeck(false));
$('#show-words').addEventListener('change', () => rebuildDeck(false));
$('#date-order').addEventListener('change', e => {
  show('loading');
  worker.postMessage({ type: 'reparse', dateOrder: e.target.value });
});

function startOver() {
  worker.postMessage({ type: 'clear' });
  Object.assign(state, { meta: null, years: [], stats: null, deck: [], index: 0, mode: null });
  game.reset();
  state.blobs.clear();
  prerenderToken++;
  $('#file').value = '';
  show('home');
}
document.querySelectorAll('.start-over').forEach(b => b.addEventListener('click', startOver));
document.addEventListener('click', e => {
  const back = e.target.closest('[data-back]');
  if (back) show(back.dataset.back);
});

// ---------------------------------------------------------------------------
// Modes
const game = initGame({ $, show, worker, shareFiles, siteDomain });
$('#mode-wrapped').addEventListener('click', () => {
  state.mode = 'wrapped';
  if (state.stats) return show('wrapped');
  show('loading');
  requestStats();
});
$('#mode-game').addEventListener('click', () => {
  state.mode = 'game';
  show('game-setup');
});
$('#error-back').addEventListener('click', startOver);
$('#error-copy').addEventListener('click', async e => {
  try { await navigator.clipboard.writeText($('#error-sample').textContent); flash(e.currentTarget, 'Copied ✓'); }
  catch { flash(e.currentTarget, 'Select & copy manually'); }
});

// ---------------------------------------------------------------------------
// File input & drag-and-drop
$('#file').addEventListener('change', e => startFile(e.target.files[0]));
$('#sample').addEventListener('click', startSample);
const drop = $('#drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => startFile(e.dataTransfer.files[0]));
// Prevent the browser from opening files dropped outside the zone.
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => e.preventDefault());

// ---------------------------------------------------------------------------
// Offline support + Android "Share to Chat Wrapped" from WhatsApp.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
(async () => {
  const params = new URLSearchParams(location.search);
  if (!params.has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);
  const cache = await caches.open('share-target');
  const res = await cache.match('shared-file');
  if (!res) return;
  const blob = await res.blob();
  await cache.delete('shared-file');
  startFile(blob);
})();

// Show the right export instructions first.
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) $('#howto-ios').open = true;
else if (/Android/.test(navigator.userAgent)) $('#howto-android').open = true;

// Expose for debugging in dev only.
if (location.hostname === 'localhost') window.__cw = { state, W, H };
