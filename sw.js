// Service worker minimo: mette in cache i file dell'app così si apre subito.
// Dopo ogni modifica ai file, alzare il numero qui sotto.
const CACHE = 'prog-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'claude.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // cancella solo le cache vecchie di QUESTA app (Cerca e Guarda ha le sue, con un altro nome)
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith('prog-') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Prima la rete, poi la cache se offline. Le chiamate a YouTube, MusicBrainz e Claude non vengono toccate.
self.addEventListener('fetch', (e) => {
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
