// Offline app shell (cache-first). Bump VERSION when files change.
const VERSION = 'skynex-v4', FILES = ['./', 'index.html', 'css/app.css', 'js/core.js', 'js/app.js', 'vendor/three.min.js', 'vendor/GLTFLoader.js', 'vendor/geotiff.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
