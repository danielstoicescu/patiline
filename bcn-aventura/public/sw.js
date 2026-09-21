// Service worker: aplicația se deschide și fără semnal (roaming / metrou).
const VERSION = '202609211916';
const CACHE = `bcn-aventura-${VERSION}`;
const ASSETS = [
  '/', '/index.html', '/app.js', '/data.js', '/styles.css', '/firebase-config.js', '/manifest.webmanifest',
  '/icon.svg', '/icon-192.png', '/icon-512.png',
  '/vendor/fontawesome/css/all.min.css', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css',
  '/vendor/fontawesome/webfonts/fa-solid-900.woff2', '/vendor/fontawesome/webfonts/fa-brands-400.woff2', '/vendor/fontawesome/webfonts/fa-regular-400.woff2',
];
const CACHE_CROSS = [/^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, /^https:\/\/images\.unsplash\.com\//, /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\//];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith('/__/')) return; // Firebase reserved URLs: mereu din rețea
  const cross = CACHE_CROSS.some((re) => re.test(req.url));
  if (!sameOrigin && !cross) return; // Firestore, Open-Meteo, QR etc.: direct

  if (req.mode === 'navigate') {
    // pagina: rețea întâi, cache dacă nu e semnal
    e.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('/index.html', res.clone())); return res; }).catch(() => caches.match('/index.html')));
    return;
  }
  // restul: cache întâi, actualizare în fundal
  e.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
    return cached || network;
  }));
});
