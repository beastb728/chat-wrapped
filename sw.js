// Service worker: caches the app so it works offline, and receives files
// shared to the installed app from WhatsApp on Android (Web Share Target).
// It never sends your chat anywhere: the shared file goes into a local cache
// and is read (then deleted) by the page.
const VERSION = 'cw-v2';
const ASSETS = [
  './', 'index.html', 'privacy.html', 'styles.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  'src/app.js', 'src/worker.js', 'src/parser.js', 'src/load.js', 'src/zip.js',
  'src/stats.js', 'src/stopwords.js', 'src/cards.js', 'src/sample.js', 'src/config.js',
  'src/game.js', 'src/game-ui.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'share-target').map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const file = form.get('file');
      if (file) {
        const cache = await caches.open('share-target');
        await cache.put('shared-file', new Response(file));
      }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;
  // Network first so deploys show up immediately; cache fallback for offline.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) || new Response('Offline', { status: 503 });
    }
  })());
});
