// Wayvibe service worker: the app opens without signal, and map tiles you already saw stay available.
// Route/search APIs are never cached here; the app handles those itself.
const APP = "wv-app-v1", TILES = "wv-tiles-v1", MAX_TILES = 1500;
const SHELL = ["./", "index.html", "style.css", "app.js", "i18n.js", "icon.svg", "manifest.webmanifest",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js", "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"];

self.addEventListener("install", e => { e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim() {
  const c = await caches.open(TILES), ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // style and tilejson point at dated tile sets, so they must stay fresh (network first)
  const freshMap = url.hostname === "tiles.openfreemap.org" && (/^\/styles\//.test(url.pathname) || /^\/[a-z]+$/.test(url.pathname));
  const isTile = (url.hostname === "tiles.openfreemap.org" && !freshMap) || url.hostname === "tile.openstreetmap.org" || url.hostname.endsWith("fonts.gstatic.com");
  const isShell = freshMap || url.origin === location.origin || url.hostname === "unpkg.com" || url.hostname === "fonts.googleapis.com";
  if (isTile) {
    // cache first: tiles rarely change and make the map usable offline
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); if (Math.random() < .05) trim(); }
      return res;
    }));
  } else if (isShell) {
    // network first so updates arrive at once; cache when there is no signal
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
  }
});
