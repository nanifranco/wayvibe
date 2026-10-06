import { LANGS, T, PREF_WORDS, ACCESS_WORDS, ROUTE_LANG } from "./i18n.js";
import { buddy, celebrate } from "./mascot.js";

// ---------- Services (all free, no key) ----------
// Map: OpenFreeMap · Search: Photon · Address: Nominatim · Walk/bike/car: Valhalla (FOSSGIS)
// Metro and bus: Transitous (real timetables), falling back to real OSM lines · Places: Overpass
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const PHOTON = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const VALHALLA = "https://valhalla1.openstreetmap.de/route";
// Backup router (OSRM by FOSSGIS) when Valhalla is down or overloaded
const OSRM = { walk: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/", bike: "https://routing.openstreetmap.de/routed-bike/route/v1/driving/", car: "https://routing.openstreetmap.de/routed-car/route/v1/driving/" };
const TRANSITOUS = ["https://api.transitous.org/api/v5/plan", "https://api.transitous.org/api/v1/plan"];
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const PHOTON_REVERSE = "https://photon.komoot.io/reverse";
const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
// If the vector tiles can't load, fall back to plain OpenStreetMap raster tiles so there is always a map
const STYLE_RASTER = { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf", sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] };

// ---------- Small persistent settings ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("wv-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("wv-" + k, JSON.stringify(v)); } catch {} },
};

// ---------- Language ----------
const browser = (navigator.language || "es").slice(0, 2);
let lang = LANGS[store.get("lang")] ? store.get("lang") : LANGS[browser] ? browser : "es";
const t = (k, vars = {}) => (T[lang][k] ?? T.en[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
  document.querySelectorAll("[data-i18n-label]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  document.querySelectorAll("[data-i18n-title]").forEach(el => el.title = t(el.dataset.i18nTitle));
  $("#langCode").textContent = lang.toUpperCase();
}
const langSel = $("#lang");
langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
langSel.value = lang;
langSel.onchange = () => {
  lang = langSel.value;
  store.set("lang", lang);
  applyI18n();
  setLabelLanguage();
  renderCats();
  if (me) reverse(me.lat, me.lon).then(showWhere); else renderWhere();
  if (view === "route" && R.mode !== "transit") { R.fast = {}; routeNow(); } // instructions come in the route language
  else rerenderSheet();
};
applyI18n();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

// ---------- Safety net: an unexpected error never leaves the app silent or stuck ----------
let lastOops = 0;
function oops(err) {
  if (!err || err.name === "AbortError" || /ResizeObserver|Script error/i.test(String(err.message || err))) return;
  console.error(err);
  if (Date.now() - lastOops < 15000) return;
  lastOops = Date.now();
  toast(t("oops"));
  try { if (R.busy) { R.busy = false; rerenderSheet(); } } catch {} // never leave a spinner running forever
}
addEventListener("error", e => oops(e.error || e));
addEventListener("unhandledrejection", e => oops(e.reason));

// ---------- Connection ----------
function renderOffline() { const b = $("#offline"); b.hidden = navigator.onLine; b.innerHTML = `${buddy("sleep")}<span>${t("offline")}</span>`; }
addEventListener("offline", renderOffline);
addEventListener("online", () => {
  renderOffline(); toast(t("backOnline"));
  if (!me) geo.trigger();
  // retry whatever failed while we were offline
  if (view === "route" && dest && me) { for (const m of Object.keys(R.fast)) if (R.fast[m]?.error && !R.fast[m].unreachable) delete R.fast[m]; if (R.transit && !R.transit.items.length) R.transit = null; routeNow(); }
  else if (view === "nearby" && NEAR.error) nearby(NEAR.cat);
});
addEventListener("load", renderOffline);

// ---------- Helpers ----------
function km(a, b) {
  const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const pt = c => ({ lat: c[1], lon: c[0] });
const fmtDur = s => {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} ${t("min")}` : `${Math.floor(m / 60)} ${t("h")}${m % 60 ? " " + (m % 60) + " " + t("min") : ""}`;
};
const fmtDist = k => k < 1 ? `${Math.max(10, Math.round(k * 100) * 10)} ${t("m")}` : `${k.toFixed(k < 10 ? 1 : 0)} ${t("km")}`;
const clock = d => d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
const etaClock = s => clock(new Date(Date.now() + s * 1000));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let toastTimer = 0;
function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 4500);
}
function decodePolyline(str, precision = 6) {
  const out = [], f = Math.pow(10, precision); let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lon += d;
    }
    out.push([lon / f, lat / f]);
  }
  return out;
}
function cumulative(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + km(pt(coords[i - 1]), pt(coords[i])));
  return cum;
}
function bearing(a, b) {
  const r = Math.PI / 180, y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
// Every network call goes through here: a timeout, one retry, and the next mirror if a server is down.
// A 4xx answer (other than 408/429) is a real "no" from the server, so it is not retried.
async function getJSON(urls, { init, timeout = 12000, retries = 1, signal } = {}) {
  let last = new Error("offline");
  for (const url of [].concat(urls)) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (!navigator.onLine) throw Object.assign(new Error("offline"), { offline: true });
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
      const relay = () => ctl.abort();
      signal?.addEventListener("abort", relay);
      try {
        const r = await fetch(url, { ...init, signal: ctl.signal });
        if (r.ok) return await r.json();
        last = Object.assign(new Error("http " + r.status), { status: r.status });
        if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) throw last;
        if (r.status === 429) await sleep(1200 * (attempt + 1));
      } catch (e) {
        if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) throw e;
        if (signal?.aborted) throw e;
        last = e;
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", relay); }
    }
  }
  throw last;
}
async function overpassQuery(q) {
  const j = await getJSON(OVERPASS, { init: { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, timeout: 25000, retries: 0 });
  return j.elements || [];
}

// ---------- Icons ----------
const S = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  walk: S(`<circle cx="13" cy="4" r="2"/><path d="M9 21l2.5-6.5L14 17v4M11.5 14.5L10 9l4-1 2 4 3 1M10 9l-3 3"/>`),
  bike: S(`<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17L9 9h6l3.5 8M9 9l3.5 8L15 9M8 6h3"/>`),
  car: S(`<path d="M5 17h14v-5l-2-5H7l-2 5v5ZM5 12h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>`),
  transit: S(`<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/>`),
  bus: S(`<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3"/><circle cx="8.5" cy="14.5" r=".8"/><circle cx="15.5" cy="14.5" r=".8"/>`),
  pin: S(`<path d="M12 21s-7-7.2-7-12a7 7 0 0 1 14 0c0 4.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>`),
  clock: S(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
  fastest: S(`<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z"/>`),
  scenic: S(`<path d="M3 8h3l2-3h8l2 3h3v11H3Z"/><circle cx="12" cy="13" r="3.5"/>`),
  shade: S(`<path d="M12 22v-6M7 16h10l-2.5-4H16l-4-6-4 6h1.5Z"/>`),
  food: S(`<path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8a2 2 0 0 1-2 2M17 22V2c-2 1.5-3 4-3 7s1 4 3 4"/>`),
  quiet: S(`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>`),
  cafe: S(`<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>`),
  pharmacy: S(`<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>`),
  park: S(`<path d="M12 22v-5M8 17h8a4 4 0 0 0 1-7.9A5 5 0 0 0 7.1 8 4.5 4.5 0 0 0 8 17Z"/>`),
  atm: S(`<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>`),
  wheel: S(`<circle cx="10" cy="4.5" r="1.8"/><path d="M10 7.5V13h5l2.5 5.5L20 17.5M10 10h5"/><path d="M7.2 11.2A5.5 5.5 0 1 0 15 17.8"/>`),
  check: S(`<path d="M5 12.5 10 17 19 7"/>`, `class="ck"`),
  phone: S(`<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>`),
  globe: S(`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>`),
  info: S(`<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>`),
  shield: S(`<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="m9 12 2 2 4-4"/>`),
  speaker: S(`<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>`),
  mute: S(`<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="m17 9 5 6M22 9l-5 6"/>`),
  go: S(`<path d="M3 11 21 3l-8 18-2-8Z"/>`),
  list: S(`<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>`),
  flag: S(`<path d="M5 22V4M5 4h11l-2 4 2 4H5"/>`),
  close: S(`<path d="M6 6l12 12M18 6 6 18"/>`),
  arrow: deg => S(`<path d="M12 20V5M6 11l6-6 6 6"/>`, `style="transform:rotate(${deg}deg)"`),
  round: S(`<path d="M12 21v-6M12 15a4 4 0 1 0-4-4M8 11l-2.5-1M8 11l1-2.5"/>`),
};
// Valhalla maneuver type → arrow pointing where you will actually turn (natural mapping)
function manIcon(type) {
  const angles = { 9: 45, 10: 90, 11: 135, 12: 180, 13: 180, 14: -135, 15: -90, 16: -45, 18: 45, 19: -45, 20: 45, 21: -45, 23: 30, 24: -30 };
  if ([4, 5, 6].includes(type)) return ICON.flag;
  if ([26, 27].includes(type)) return ICON.round;
  return ICON.arrow(angles[type] ?? 0);
}

// ---------- Route styles ("vibes") ----------
const VIBES = {
  fastest: ["#2563eb", "#4f46e5"],
  scenic: ["#9333ea", "#db2777"],
  shade: ["#059669", "#65a30d"],
  food: ["#ea580c", "#e11d48"],
  quiet: ["#0284c7", "#4f46e5"],
};
function setVibe(key) {
  const [a, b] = VIBES[key] || VIBES.fastest;
  document.documentElement.style.setProperty("--g1", a);
  document.documentElement.style.setProperty("--g2", b);
  if (map.getLayer("wv-mine")) map.setPaintProperty("wv-mine", "line-gradient", ["interpolate", ["linear"], ["line-progress"], 0, a, 1, b]);
  if (map.getLayer("wv-pois")) map.setPaintProperty("wv-pois", "circle-stroke-color", b);
}

// ---------- Map ----------
// The map library comes from a CDN; if that CDN is blocked or down, try a second one.
async function ensureMapLib() {
  if (window.maplibregl) return true;
  const base = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/";
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = base + "maplibre-gl.css"; document.head.appendChild(css);
  try { await new Promise((ok, no) => { const s = document.createElement("script"); s.src = base + "maplibre-gl.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); } catch {}
  return !!window.maplibregl;
}
function hasWebGL() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }
// When there is no way to draw a map, say why and how to fix it instead of showing a blank screen
function fatal(key) {
  document.body.insertAdjacentHTML("beforeend", `<div class="fatal" role="alert">${buddy("sad", "big")}<p>${t(key)}</p><button class="btn go" type="button" onclick="location.reload()">${t("retry")}</button></div>`);
}
if (!(await ensureMapLib())) { fatal("noMapLib"); throw new Error("map library unavailable"); }
if (!hasWebGL()) { fatal("noMap"); throw new Error("WebGL unavailable"); }
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const map = new maplibregl.Map({
  container: "map",
  style: darkMQ.matches ? STYLE_DARK : STYLE_LIGHT,
  center: [0, 25], zoom: 1.6,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true, timeout: 15000 }, trackUserLocation: true, showAccuracyCircle: true, showUserHeading: true });
map.addControl(geo, "bottom-right");
let rasterFallback = false;
darkMQ.addEventListener("change", () => { if (!rasterFallback) map.setStyle(darkMQ.matches ? STYLE_DARK : STYLE_LIGHT); });
function useRasterMap() { if (rasterFallback) return; rasterFallback = true; map.setStyle(STYLE_RASTER); }
map.on("error", e => { if (!map.isStyleLoaded() && /style|openfreemap/i.test(String(e?.error?.message || e?.error?.url || ""))) useRasterMap(); });
setTimeout(() => { if (!map.isStyleLoaded() && navigator.onLine) useRasterMap(); }, 10000);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function setLabelLanguage() {
  if (!map.isStyleLoaded()) return;
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol" || layer.id.startsWith("wv-") || !map.getLayoutProperty(layer.id, "text-field")) continue;
    map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]]);
  }
}
function ensureLayers() {
  const empty = { type: "FeatureCollection", features: [] };
  for (const id of ["wv-fast", "wv-pois", "wv-transit", "wv-near"]) if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
  if (!map.getSource("wv-mine")) map.addSource("wv-mine", { type: "geojson", data: empty, lineMetrics: true });
  const [a, b] = [cssVar("--g1") || VIBES.fastest[0], cssVar("--g2") || VIBES.fastest[1]];
  const casing = cssVar("--casing") || "#fff", fast = cssVar("--fast") || "#94a3b8";
  const round = { "line-cap": "round", "line-join": "round" };
  const add = l => { if (!map.getLayer(l.id)) map.addLayer(l); };
  add({ id: "wv-fast", type: "line", source: "wv-fast", layout: round, paint: { "line-color": fast, "line-width": 5, "line-opacity": .8, "line-dasharray": [.1, 1.8] } });
  add({ id: "wv-mine-casing", type: "line", source: "wv-mine", layout: round, paint: { "line-color": casing, "line-width": 11 } });
  add({ id: "wv-mine", type: "line", source: "wv-mine", layout: round, paint: { "line-width": 7, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, a, 1, b] } });
  add({ id: "wv-transit-walk", type: "line", source: "wv-transit", filter: ["==", ["get", "walk"], true], layout: round, paint: { "line-color": fast, "line-width": 5, "line-dasharray": [.1, 1.8] } });
  add({ id: "wv-transit-casing", type: "line", source: "wv-transit", filter: ["==", ["get", "walk"], false], layout: round, paint: { "line-color": casing, "line-width": 11 } });
  add({ id: "wv-transit-line", type: "line", source: "wv-transit", filter: ["==", ["get", "walk"], false], layout: round, paint: { "line-color": ["get", "color"], "line-width": 7 } });
  add({ id: "wv-pois", type: "circle", source: "wv-pois", paint: { "circle-radius": 5.5, "circle-color": "#ffffff", "circle-stroke-color": b, "circle-stroke-width": 3 } });
  add({ id: "wv-pois-label", type: "symbol", source: "wv-pois", minzoom: 15, layout: { "text-field": ["get", "name"], "text-size": 11.5, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true }, paint: { "text-color": cssVar("--ink") || "#0f1729", "text-halo-color": casing, "text-halo-width": 1.6 } });
  add({ id: "wv-near", type: "circle", source: "wv-near", paint: { "circle-radius": 8, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
  add({ id: "wv-near-label", type: "symbol", source: "wv-near", minzoom: 14.5, layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true }, paint: { "text-color": cssVar("--ink") || "#0f1729", "text-halo-color": casing, "text-halo-width": 1.6 } });
  drawRoutes(); drawNearby();
}
map.on("style.load", () => { setLabelLanguage(); ensureLayers(); });
map.on("load", () => geo.trigger());
map.on("click", "wv-near", e => { const i = e.features?.[0]?.properties?.i; if (i != null && NEAR.items[i]) choose(NEAR.items[i]); });
map.on("mouseenter", "wv-near", () => map.getCanvas().style.cursor = "pointer");
map.on("mouseleave", "wv-near", () => map.getCanvas().style.cursor = "");

// ---------- Where am I ----------
let me = null, lastReverse = null, locState = "locating", whereAddr = null;
const whereEl = $("#where");
geo.on("geolocate", e => {
  me = { lat: e.coords.latitude, lon: e.coords.longitude, heading: e.coords.heading };
  locState = "on";
  if (!lastReverse || km(lastReverse, me) > .15) {
    lastReverse = { ...me };
    reverse(me.lat, me.lon).then(showWhere);
  }
  maybeHint();
});
geo.on("error", () => { if (!me) { locState = "off"; renderWhere(); } });

const reverseCache = new Map();
async function reverse(lat, lon) {
  const key = `${lang}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
  if (reverseCache.has(key)) return reverseCache.get(key);
  const res = await reverseNominatim(lat, lon).catch(() => null) || await reversePhoton(lat, lon).catch(() => null);
  if (res) reverseCache.set(key, res);
  return res;
}
async function reversePhoton(lat, lon) {
  const j = await getJSON(`${PHOTON_REVERSE}?lat=${lat}&lon=${lon}`, { timeout: 8000 });
  const p = j.features?.[0]?.properties; if (!p) return null;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  return { title: street || p.name || p.district || p.city, sub: [p.district, p.city, p.country].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", "), name: p.name };
}
async function reverseNominatim(lat, lon) {
  {
    const j = await getJSON(`${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=${lang}`, { timeout: 8000 }), a = j.address || {};
    const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(" ");
    const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
    const city = a.city || a.town || a.village || a.municipality || a.county;
    return { title: street || j.name || area || city || j.display_name, sub: [area, city, a.country].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", "), name: j.name };
  }
}
function showWhere(addr) { if (addr) whereAddr = addr; renderWhere(); }
function renderWhere() {
  if (locState === "off") {
    whereEl.className = "where card off";
    whereEl.innerHTML = `<span class="pulse" aria-hidden="true"></span><div class="grow"><div class="where-v">${t("locOff")}</div></div><button class="btn" id="locBtn" type="button">${t("enableLoc")}</button>`;
    $("#locBtn").onclick = () => { locState = "locating"; whereEl.hidden = true; geo.trigger(); };
    whereEl.hidden = false; return;
  }
  if (!whereAddr) { whereEl.hidden = true; return; }
  whereEl.className = "where card";
  whereEl.innerHTML = `<span class="pulse" aria-hidden="true"></span><div class="grow"><div class="where-l">${t("youAreIn")}</div><div class="where-v">${esc([whereAddr.title, whereAddr.sub].filter(Boolean).join(" · "))}</div></div>`;
  whereEl.hidden = false;
}
// Long-press has no visible signifier on a map, so we teach it once.
function maybeHint() {
  if (store.get("hint", false) || dest || view) return;
  $("#hintBuddy").innerHTML = buddy("happy");
  $("#hintText").innerHTML = `<b>${t("hello")}</b> ${t("hintPress")}`;
  $("#hint").hidden = false;
}
$("#hintOk").onclick = () => { $("#hint").hidden = true; store.set("hint", true); };

// ---------- Nearby categories (real places from OpenStreetMap) ----------
const CATS = {
  food: { icon: "food", color: "#ea580c", q: 'nwr["amenity"~"^(restaurant|fast_food|food_court)$"]["name"]' },
  cafe: { icon: "cafe", color: "#92400e", q: 'nwr["amenity"="cafe"]["name"]' },
  metro: { icon: "transit", color: "#2563eb", q: 'nwr["railway"~"^(station|halt)$"]["name"];nwr["public_transport"="station"]["name"]' },
  pharmacy: { icon: "pharmacy", color: "#059669", q: 'nwr["amenity"="pharmacy"]' },
  park: { icon: "park", color: "#16a34a", q: 'nwr["leisure"~"^(park|garden)$"]["name"]' },
  atm: { icon: "atm", color: "#475569", q: 'nwr["amenity"="atm"];nwr["amenity"="bank"]["atm"="yes"]' },
};
const NEAR = { cat: null, items: [], busy: false, error: false };
function renderCats() {
  $("#cats").innerHTML = Object.entries(CATS).map(([k, c]) => `<button class="cat" type="button" data-c="${k}" aria-pressed="${NEAR.cat === k}" style="--c:${c.color}">${ICON[c.icon]}${t("cat_" + k)}</button>`).join("");
  document.querySelectorAll(".cat").forEach(b => b.onclick = () => nearby(b.dataset.c));
}
renderCats();
async function nearby(cat) {
  if (NAV.active) return;
  closeAll(false);
  $("#hint").hidden = true;
  NEAR.cat = cat; NEAR.items = []; NEAR.busy = true; NEAR.error = false;
  view = "nearby"; renderCats(); setSnap(1); rerenderSheet();
  const c = map.getZoom() > 12 ? { lat: map.getCenter().lat, lon: map.getCenter().lng } : null;
  const at = me && (!c || km(me, c) < 2) ? me : (c || me);
  if (!at) { NEAR.busy = false; locState = "off"; renderWhere(); rerenderSheet(); return; }
  try {
    const around = `(around:1200,${at.lat},${at.lon})`;
    const parts = CATS[cat].q.split(";").map(s => s + around + ";").join("");
    const els = await overpassQuery(`[out:json][timeout:20];(${parts});out center tags 80;`);
    if (NEAR.cat !== cat) return;
    const seen = new Set();
    NEAR.items = els.map(e => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags || {}, osm: e.type[0].toUpperCase() + e.id }))
      .filter(p => p.lat != null)
      .map(p => ({ ...p, name: p.tags[`name:${lang}`] || p.tags.name || p.tags.operator || p.tags.brand || t("cat_" + cat), sub: [p.tags["addr:street"], p.tags["addr:housenumber"]].filter(Boolean).join(" ") }))
      .filter(p => { const k = p.name + Math.round(p.lat * 2000) + Math.round(p.lon * 2000); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => km(at, a) - km(at, b)).slice(0, 25);
  } catch { NEAR.error = true; }
  NEAR.busy = false; rerenderSheet(); drawNearby();
  if (NEAR.items.length) {
    const b = NEAR.items.reduce((bb, p) => bb.extend([p.lon, p.lat]), new maplibregl.LngLatBounds([at.lon, at.lat], [at.lon, at.lat]));
    map.fitBounds(b, { padding: panelPadding(), maxZoom: 16.5, duration: 800 });
  }
}
function drawNearby() {
  if (!map.getSource("wv-near")) return;
  const color = NEAR.cat ? CATS[NEAR.cat].color : "#2563eb";
  map.getSource("wv-near").setData({ type: "FeatureCollection", features: view === "nearby" ? NEAR.items.map((p, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { i, name: p.name, color } })) : [] });
}

// ---------- Search ----------
const qEl = $("#q"), sugs = $("#sugs"), clearQ = $("#clearQ");
let searchCtl = null, sugItems = [], sugIdx = -1, debounce = 0, sugMode = "search";
function biasPoint() { return me || (map.getZoom() > 4 ? { lat: map.getCenter().lat, lon: map.getCenter().lng } : null); }
async function photon(q) {
  searchCtl?.abort(); searchCtl = new AbortController();
  const b = biasPoint();
  const params = new URLSearchParams({ q, limit: "7" });
  if (b) { params.set("lat", b.lat.toFixed(5)); params.set("lon", b.lon.toFixed(5)); }
  if (["en", "fr", "de"].includes(lang)) params.set("lang", lang);
  const j = await getJSON(`${PHOTON}?${params}`, { signal: searchCtl.signal, timeout: 8000, retries: 0 });
  return (j.features || []).map(f => {
    const p = f.properties, [lon, lat] = f.geometry.coordinates;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const name = p.name || street || p.city || p.country;
    const sub = [p.name ? street : "", p.district || p.locality, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v !== name).slice(0, 3).join(", ");
    return { name, sub, lat, lon, osm: p.osm_type && p.osm_id ? p.osm_type + p.osm_id : null };
  });
}
async function nominatimSearch(q) {
  const b = biasPoint();
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "7", "accept-language": lang });
  if (b) params.set("viewbox", [b.lon - .3, b.lat + .3, b.lon + .3, b.lat - .3].map(v => v.toFixed(4)).join(","));
  const j = await getJSON(`${NOMINATIM_SEARCH}?${params}`, { timeout: 10000 });
  return j.map(p => ({ name: p.name || p.display_name.split(",")[0], sub: p.display_name.split(",").slice(1, 4).join(",").trim(), lat: +p.lat, lon: +p.lon, osm: p.osm_type && p.osm_id ? p.osm_type[0].toUpperCase() + p.osm_id : null }));
}
async function search(q) {
  try { return await photon(q); }
  catch (e) { if (e.name === "AbortError") throw e; return nominatimSearch(q); }
}
function renderSugs() {
  const head = sugMode === "recent" ? `<div class="sugs-h">${t("recent")}</div>` : "";
  if (!sugItems.length) sugs.innerHTML = `<div class="sug-empty">${t("noResults")}</div>`;
  else sugs.innerHTML = head + sugItems.map((s, i) => `<button class="sug" type="button" role="option" aria-selected="${i === sugIdx}" data-i="${i}"><span class="ic">${sugMode === "recent" ? ICON.clock : ICON.pin}</span><span style="min-width:0"><span class="nm">${esc(s.name)}</span><span class="sub">${esc(s.sub)}</span></span><span class="d">${me ? fmtDist(km(me, s)) : ""}</span></button>`).join("");
  sugs.hidden = false; qEl.setAttribute("aria-expanded", "true");
  sugs.querySelectorAll(".sug").forEach(b => b.onclick = () => choose(sugItems[+b.dataset.i]));
}
function hideSugs() { sugs.hidden = true; qEl.setAttribute("aria-expanded", "false"); sugIdx = -1; }
function showRecents() {
  const rec = store.get("recent", []);
  if (!rec.length || qEl.value.trim()) return;
  sugMode = "recent"; sugItems = rec; sugIdx = -1; renderSugs();
}
qEl.addEventListener("focus", showRecents);
qEl.addEventListener("input", () => {
  const q = qEl.value.trim(); clearQ.hidden = !q;
  clearTimeout(debounce);
  if (!q) { hideSugs(); return showRecents(); }
  if (q.length < 2) return hideSugs();
  debounce = setTimeout(async () => {
    try { sugMode = "search"; sugItems = await photon(q); sugIdx = -1; renderSugs(); } catch (e) { if (e.name !== "AbortError") hideSugs(); } // typing never hits the backup (its usage policy forbids autocomplete)
  }, 250);
});
qEl.addEventListener("keydown", e => {
  if (sugs.hidden || !sugItems.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); sugIdx = (sugIdx + (e.key === "ArrowDown" ? 1 : sugItems.length - 1)) % sugItems.length; renderSugs();
  } else if (e.key === "Escape") hideSugs();
});
$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  if (sugIdx >= 0 && sugItems[sugIdx]) return choose(sugItems[sugIdx]);
  const q = qEl.value.trim(); if (!q) return;
  try { sugMode = "search"; sugItems = await search(q); } catch { sugItems = []; if (!navigator.onLine) toast(t("offline")); }
  if (sugItems[0]) choose(sugItems[0]); else renderSugs();
});
clearQ.onclick = () => { qEl.value = ""; clearQ.hidden = true; hideSugs(); closeAll(); qEl.focus(); };
document.addEventListener("click", e => { if (!e.target.closest(".searchwrap")) hideSugs(); });
function remember(p) {
  if (!p.name || p.name === t("pinned")) return;
  const rec = store.get("recent", []).filter(r => !(r.name === p.name && km(r, p) < .05));
  rec.unshift({ name: p.name, sub: p.sub || "", lat: p.lat, lon: p.lon, osm: p.osm || null });
  store.set("recent", rec.slice(0, 6));
}

// Long-press (touch) or right-click drops a pin
let pressTimer = 0, pressAt = null;
map.on("contextmenu", e => pickPoint(e.lngLat));
map.on("touchstart", e => {
  if (e.originalEvent.touches.length !== 1 || NAV.active) return;
  pressAt = e.point; const ll = e.lngLat;
  pressTimer = setTimeout(() => { navigator.vibrate?.(15); pickPoint(ll); }, 550);
});
map.on("touchmove", e => { if (pressAt && Math.hypot(e.point.x - pressAt.x, e.point.y - pressAt.y) > 8) clearTimeout(pressTimer); });
map.on("touchend", () => clearTimeout(pressTimer));
async function pickPoint(ll) {
  if (NAV.active) return;
  $("#hint").hidden = true; store.set("hint", true);
  const p = { lat: ll.lat, lon: ll.lng, name: t("pinned"), sub: "" };
  choose(p, false);
  const a = await reverse(p.lat, p.lon);
  if (a && dest === p) { p.name = a.name || a.title; p.sub = a.sub; qEl.value = p.name; rerenderSheet(); }
}

// ---------- Destination ----------
const sheet = $("#sheet"), sheetBody = $("#sheetBody");
let dest = null, destMarker = null, view = null; // view: "nearby" | "place" | "route"
const R = { mode: "walk", prefs: [], fast: {}, mine: null, pois: [], poiCount: {}, busy: false, note: "", seq: 0, steps: false, transit: null, itin: 0, askText: "", askMsg: null };
let access = store.get("access", false);

function pinEl() {
  const el = document.createElement("div");
  el.className = "dest-pin";
  el.innerHTML = `<svg viewBox="0 0 44 54"><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--g1)"/><stop offset="1" style="stop-color:var(--g2)"/></linearGradient></defs><path d="M22 52C22 52 40 33 40 20A18 18 0 0 0 4 20c0 13 18 32 18 32Z" fill="url(#pg)" stroke="#fff" stroke-width="3"/><circle cx="22" cy="20" r="7" fill="#fff"/></svg>`;
  return el;
}
function choose(p, fly = true) {
  hideSugs(); qEl.blur(); $("#hint").hidden = true;
  dest = p; view = "place";
  qEl.value = p.name; clearQ.hidden = false;
  resetRoute(); drawNearby();
  remember(p);
  destMarker?.remove();
  destMarker = new maplibregl.Marker({ element: pinEl(), anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map);
  if (fly) map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 15.5), offset: innerWidth < 700 ? [0, -innerHeight * .2] : [210, 0], speed: 1.6 });
  setSnap(1);
  rerenderSheet();
  if (!p.tags && p.osm) loadDetails(p);
}
async function loadDetails(p) {
  const type = { N: "node", W: "way", R: "relation" }[p.osm[0]];
  if (!type) return;
  try {
    const [e] = await overpassQuery(`[out:json][timeout:15];${type}(${p.osm.slice(1)});out tags;`);
    p.tags = e?.tags || {};
    if (dest === p && view === "place") rerenderSheet();
  } catch {}
}
function closeAll(clearNear = true) {
  if (NAV.active) stopNav();
  dest = null; view = null; destMarker?.remove(); destMarker = null;
  if (clearNear) { NEAR.cat = null; NEAR.items = []; renderCats(); }
  resetRoute(); drawNearby(); sheet.hidden = true; setVibe("fastest");
}
function resetRoute() { Object.assign(R, { fast: {}, mine: null, pois: [], poiCount: {}, note: "", busy: false, transit: null, itin: 0, steps: false, askMsg: null }); R.seq++; drawRoutes(); }

// ---------- Bottom sheet: drag the handle, or tap it, to show more or less ----------
const SNAPS = [.3, .52, .88];
let snap = 1, dragS = null, justDragged = false;
function setSnap(i) { snap = i; sheet.style.setProperty("--sheet-h", `${Math.round(SNAPS[i] * innerHeight)}px`); }
const grab = $("#grab");
grab.addEventListener("pointerdown", e => {
  dragS = { y: e.clientY, h: sheet.getBoundingClientRect().height, moved: false };
  grab.setPointerCapture(e.pointerId); sheet.classList.add("dragging");
});
grab.addEventListener("pointermove", e => {
  if (!dragS) return;
  const dy = e.clientY - dragS.y;
  if (Math.abs(dy) > 5) dragS.moved = true;
  if (dragS.moved) sheet.style.setProperty("--sheet-h", `${Math.max(120, Math.min(innerHeight - 90, dragS.h - dy))}px`);
});
grab.addEventListener("pointerup", () => {
  if (!dragS) return;
  sheet.classList.remove("dragging");
  if (dragS.moved) {
    const h = sheet.getBoundingClientRect().height / innerHeight;
    setSnap(SNAPS.reduce((best, s, i) => Math.abs(s - h) < Math.abs(SNAPS[best] - h) ? i : best, 0));
    justDragged = true;
  }
  dragS = null;
});
grab.addEventListener("click", () => { if (justDragged) { justDragged = false; return; } setSnap(snap === 2 ? 0 : snap + 1); });
addEventListener("resize", () => setSnap(snap));
setSnap(1);

function panelPadding() {
  if (innerWidth < 700) return { top: 90, bottom: (sheet.hidden ? 0 : sheet.getBoundingClientRect().height) + 24, left: 40, right: 60 };
  return { top: 70, bottom: 70, left: 470, right: 90 };
}

const COSTING = { walk: "pedestrian", bike: "bicycle", car: "auto" };
const PREFS = ["fastest", "scenic", "shade", "food", "quiet"];
const current = () => R.mine || R.fast[R.mode];
const usesAccess = () => access && (R.mode === "walk" || R.mode === "transit");

function factsHtml(tags) {
  if (!tags) return "";
  const rows = [];
  if (tags.opening_hours) rows.push(`<div class="fact">${ICON.clock}<span><b>${t("hours")}</b><br>${esc(tags.opening_hours.replace(/;\s*/g, "; "))}</span></div>`);
  const phone = tags.phone || tags["contact:phone"];
  if (phone) rows.push(`<a class="fact" href="tel:${esc(phone.split(";")[0].replace(/\s/g, ""))}">${ICON.phone}<span>${esc(phone.split(";")[0])}</span></a>`);
  const web = tags.website || tags["contact:website"];
  if (web && /^https?:\/\//.test(web)) { let host = web; try { host = new URL(web).hostname.replace(/^www\./, ""); } catch {} rows.push(`<a class="fact" href="${esc(web)}" target="_blank" rel="noopener">${ICON.globe}<span>${esc(host)}</span></a>`); }
  const wc = tags.wheelchair;
  if (wc === "yes" || wc === "designated") rows.push(`<div class="fact ok">${ICON.wheel}<span>${t("wc_yes")}</span></div>`);
  else if (wc === "limited") rows.push(`<div class="fact warn">${ICON.wheel}<span>${t("wc_limited")}</span></div>`);
  else if (wc === "no") rows.push(`<div class="fact bad">${ICON.wheel}<span>${t("wc_no")}</span></div>`);
  return rows.length ? `<div class="facts">${rows.join("")}</div>` : "";
}
function closeBtn() { return `<button class="btn icon" id="closeBtn" type="button" aria-label="${t("close")}" title="${t("close")}">${ICON.close}</button>`; }
function bindClose() { const b = $("#closeBtn"); if (b) b.onclick = () => { qEl.value = ""; clearQ.hidden = true; closeAll(); }; }
const headRow = inner => `<div class="hero-row" style="justify-content:space-between;flex-wrap:nowrap;align-items:flex-start"><div>${inner}</div>${closeBtn()}</div>`;

function rerenderSheet() {
  if (NAV.active) return;
  if (view === "nearby") return renderNearby();
  if (!dest) { sheet.hidden = true; return; }
  sheet.hidden = false;
  if (view === "place") return renderPlace();
  renderRoute();
}
function renderNearby() {
  sheet.hidden = false;
  const c = CATS[NEAR.cat];
  let body;
  if (NEAR.busy) body = `<p class="note">${t("searching")}</p><div class="skel"></div><div class="skel"></div><div class="skel"></div>`;
  else if (NEAR.error) body = `<div class="insight err">${buddy("sad")}<div>${t(navigator.onLine ? "serviceDown" : "offline")}<br><button class="btn" id="retryNear" type="button">${t("retry")}</button></div></div>`;
  else if (!NEAR.items.length) body = `<div class="insight">${buddy("think")}<div>${t("nearbyNone")}</div></div>`;
  else body = `<div class="places" role="list">${NEAR.items.map((p, i) => `<button class="sug" type="button" role="listitem" data-i="${i}"><span class="ic" style="color:${c.color}">${ICON[c.icon]}</span><span style="min-width:0"><span class="nm">${esc(p.name)}</span><span class="sub">${esc([p.sub, p.tags.wheelchair === "yes" ? "♿ " + t("wc_yes") : ""].filter(Boolean).join(" · "))}</span></span><span class="d">${me ? fmtDist(km(me, p)) : ""}</span></button>`).join("")}</div>`;
  sheetBody.innerHTML = headRow(`<h2 class="title">${esc(t("nearbyTitle", { cat: t("cat_" + NEAR.cat) }))}</h2>`) + body + `<p class="foot">${ICON.info}OpenStreetMap</p>`;
  sheetBody.querySelectorAll(".places .sug").forEach(b => b.onclick = () => choose(NEAR.items[+b.dataset.i]));
  const r = $("#retryNear"); if (r) r.onclick = () => nearby(NEAR.cat);
  bindClose();
}
function renderPlace() {
  sheetBody.innerHTML = headRow(`<h2 class="title">${esc(dest.name)}</h2>${dest.sub ? `<p class="sub2">${esc(dest.sub)}</p>` : ""}`) +
    `${me ? `<span class="kicker">${fmtDist(km(me, dest))} · ${t("from").toLowerCase()}</span>` : ""}
    <div class="actions"><button class="btn go" id="dirBtn" type="button">${ICON.go}${t("directions")}</button></div>
    ${factsHtml(dest.tags)}`;
  $("#dirBtn").onclick = startDirections;
  bindClose();
}
function renderRoute() {
  const modeBtn = m => {
    const v = m === "transit" ? R.transit?.items?.[0]?.duration : R.fast[m]?.time;
    const err = m === "transit" ? R.transit && !R.transit.items?.length : R.fast[m]?.error;
    const est = m === "transit" && R.transit?.items?.[0]?.estimated ? "≈ " : "";
    const no = m !== "transit" && R.fast[m]?.unreachable;
    return `<button class="mode${no ? " no" : ""}" type="button" data-m="${m}" aria-pressed="${R.mode === m}">${ICON[m]}<b>${v ? est + fmtDur(v) : no ? t("notPossible") : err ? "—" : "…"}</b><span>${t(m)}</span></button>`;
  };
  const head = headRow(`<span class="kicker">${t("from")}</span><h2 class="title">${esc(dest.name)}</h2>`);
  const modes = `<div><p class="q">${t("qMode")}</p><div class="modes" role="group" aria-label="${esc(t("qMode"))}">${["walk", "bike", "car", "transit"].map(modeBtn).join("")}</div></div>`;
  const accessSw = (R.mode === "walk" || R.mode === "transit") ? `<div><button class="access" id="accessSw" type="button" role="switch" aria-checked="${access}"><span class="aic">${ICON.wheel}</span><span><b>${t("qAccess")}</b><small>${t("accessDesc")}</small></span><span class="switch" aria-hidden="true"></span></button></div>` : "";

  let main = "";
  if (R.mode === "transit") main = transitBody();
  else {
    const c = current();
    let hero = "", body = "";
    if (R.busy) body = `<div class="loading"><div class="loading-row">${buddy("think")}<span class="note">${t("calculating")}</span></div><div class="bar"></div></div>`;
    else if (R.fast[R.mode]?.unreachable) body = `<div class="insight err">${buddy("sad")}<div><b>${t((R.fast[R.mode].reason === "far" ? "unreachableFar_" : "unreachable_") + R.mode)}</b></div></div>`;
    else if (R.fast[R.mode]?.error) body = `<div class="insight err">${buddy("sad")}<div>${t(R.fast[R.mode].offline ? "offline" : "serviceDown")}<br><button class="btn" id="retryRoute" type="button">${t("retry")}</button></div></div>`;
    else if (c?.time) {
      hero = `<div class="hero"><div class="hero-row"><span class="eta">${fmtDur(c.time)}</span>${usesAccess() ? `<span class="badge acc">${ICON.wheel}${t("accessOn")}</span>` : ""}</div><span class="eta-sub">${t("arriveAt", { t: etaClock(c.time) })} · ${fmtDist(c.length)}</span></div>`;
      const lines = [];
      if (R.mine) {
        const extra = Math.round((R.mine.time - R.fast[R.mode].time) / 60);
        lines.push(extra > 0 ? t("extra", { n: extra }) : t("same"));
        const parts = R.prefs.filter(p => R.poiCount[p] > 0).map(p => t("poi_" + p, { n: R.poiCount[p] }));
        if (parts.length) lines.push(`<b>${esc(t("passes", { list: parts.join(", ") }))}</b>`);
      }
      if (R.note) lines.push(esc(R.note));
      if (c.offRoad) lines.push(esc(t("farFromRoad")));
      if (c.backup) lines.push(esc(t("fallbackRoute")));
      if (lines.length) body = `<div class="insight"><span class="dot"></span><div>${lines.join("<br>")}</div></div>`;
      if (R.mine) body += `<div class="legend"><span><i style="background:linear-gradient(90deg,var(--g1),var(--g2))"></i>${t("yourRoute")}</span><span><i style="background:var(--fast)"></i>${t("fastestRoute")}</span></div>`;
    }
    const active = R.prefs.length ? R.prefs : ["fastest"];
    const prefs = `<div><p class="q">${t("howToGo")}</p>
      <div class="prefs" role="group" aria-label="${esc(t("howToGo"))}">${PREFS.map(p => `<button class="pref" type="button" data-p="${p}" aria-pressed="${active.includes(p)}" style="--c1:${VIBES[p][0]};--c2:${VIBES[p][1]}"><i>${ICON[p]}</i>${t(p)}${ICON.check}</button>`).join("")}</div>
      <form class="ask" id="askForm"><input id="ask" maxlength="60" placeholder="${esc(t("askPlaceholder"))}" aria-label="${esc(t("howToGo"))}" value="${esc(R.askText)}"><button type="submit">OK</button></form>
      ${R.askMsg ? `<p class="ask-msg ${R.askMsg.cls}" role="status">${buddy(R.askMsg.cls === "ok" ? "happy" : "think")}<span>${esc(R.askMsg.text)}</span></p>` : ""}</div>`;
    const steps = R.steps && c?.maneuvers ? `<ul class="steps">${c.maneuvers.map(m => `<li class="step"><span class="ic">${manIcon(m.type)}</span><span class="tx">${esc(m.instruction)}</span><span class="d">${m.length ? fmtDist(m.length) : ""}</span></li>`).join("")}</ul>` : "";
    const ready = c?.coords && !R.busy;
    const label = R.steps ? t("hideSteps") : t("steps");
    main = hero + (R.fast[R.mode]?.error ? "" : `<div class="actions"><button class="btn go" id="startBtn" type="button" ${ready ? "" : "disabled"}>${ICON.go}${t("start")}</button><button class="btn icon" id="stepsBtn" type="button" aria-pressed="${R.steps}" aria-label="${label}" title="${label}" ${ready ? "" : "disabled"}>${ICON.list}</button></div>`) + body + steps + (R.fast[R.mode]?.unreachable ? "" : prefs);
  }
  // order follows the questions you answer: how you travel, whether you need step-free, then the result and the kind of route
  sheetBody.innerHTML = head + modes + accessSw + main + `<p class="foot">${ICON.shield}${t("realRoutes")}</p>`;

  sheetBody.querySelectorAll(".mode").forEach(b => b.onclick = () => { if (R.mode !== b.dataset.m) { R.mode = b.dataset.m; R.steps = false; R.askMsg = null; routeNow(true); } });
  sheetBody.querySelectorAll(".itin").forEach(b => b.onclick = () => { R.itin = +b.dataset.i; drawRoutes(); rerenderSheet(); fitLine(R.transit.items[R.itin].coords); });
  sheetBody.querySelectorAll(".pref").forEach(b => b.onclick = () => { R.askText = ""; R.askMsg = null; R.prefs = b.dataset.p === "fastest" ? [] : [b.dataset.p]; routeNow(); });
  const sw = $("#accessSw");
  if (sw) sw.onclick = () => { access = !access; store.set("access", access); R.fast = {}; R.transit = null; routeNow(true); };
  const af = $("#askForm");
  if (af) af.addEventListener("submit", e => { e.preventDefault(); askRoute($("#ask").value); });
  const st = $("#startBtn"); if (st) st.onclick = startNav;
  const sb = $("#stepsBtn"); if (sb) sb.onclick = () => { R.steps = !R.steps; rerenderSheet(); if (R.steps) setSnap(2); };
  const rr = $("#retryRoute"); if (rr) rr.onclick = () => { delete R.fast[R.mode]; routeNow(true); };
  const rt = $("#retryTransit"); if (rt) rt.onclick = () => { R.transit = null; routeNow(true); };
  bindClose();
}

// The text box only understands route filters. Anything else gets a clear "here's what I can do".
function askRoute(txt) {
  R.askText = txt;
  const n = norm(txt);
  if (!n.trim()) return;
  const found = Object.entries(PREF_WORDS).filter(([, ws]) => ws.some(w => n.includes(norm(w)))).map(([k]) => k);
  const wantsAccess = ACCESS_WORDS.some(w => n.includes(norm(w)));
  if (!found.length && !wantsAccess) {
    R.askMsg = { cls: "warn", text: t("askNone", { list: [...PREFS.map(p => t(p)), t("accessLabel")].join(", ") }) };
    return rerenderSheet();
  }
  const prefs = found.filter(k => k !== "fastest");
  const names = [...(prefs.length ? prefs : found.includes("fastest") ? ["fastest"] : []).map(p => t(p)), ...(wantsAccess ? [t("accessLabel")] : [])];
  R.askMsg = { cls: "ok", text: t("askGot", { list: names.join(", ") }) };
  if (found.length) R.prefs = prefs;
  if (wantsAccess && !access) { access = true; store.set("access", true); R.fast = {}; R.transit = null; if (R.mode !== "transit") R.mode = "walk"; }
  routeNow();
}

function startDirections() {
  if (!me) { locState = "off"; renderWhere(); toast(t("noLocation")); geo.trigger(); return; }
  view = "route";
  routeNow(true);
}

// ---------- Walk / bike / car (Valhalla, real streets) ----------
let lastValhalla = 0;
// OSRM gives maneuvers but no text, so we write the instruction ourselves in the app language.
const OSRM_MOD = { left: 15, right: 10, "slight left": 16, "slight right": 9, "sharp left": 14, "sharp right": 11, straight: 8, uturn: 13 };
async function osrm(locs, mode) {
  const coordsStr = locs.map(l => `${l.lon.toFixed(6)},${l.lat.toFixed(6)}`).join(";");
  let j;
  try { j = await getJSON(`${OSRM[mode]}${coordsStr}?overview=full&geometries=polyline6&steps=true`, { timeout: 15000 }); }
  catch (e) { if (e.status === 400) e.unreachable = true; throw e; }
  if (j.code !== "Ok" || !j.routes?.length) throw Object.assign(new Error(j.code || "no route"), { unreachable: j.code === "NoRoute" });
  const rt = j.routes[0], coords = decodePolyline(rt.geometry, 6), maneuvers = [];
  let ferry = false, idx = 0;
  const near = loc => { let best = idx, bd = Infinity; for (let i = idx; i < coords.length; i++) { const d = Math.abs(coords[i][0] - loc[0]) + Math.abs(coords[i][1] - loc[1]); if (d < bd) { bd = d; best = i; } if (d < 1e-7) break; } return best; };
  rt.legs.forEach((leg, li) => leg.steps.forEach(s => {
    const m = s.maneuver;
    if (s.mode === "ferry") ferry = true;
    if (m.type === "arrive" && li < rt.legs.length - 1) return;
    if (m.type === "depart" && li > 0) return;
    idx = near(m.location);
    const name = s.name || s.ref || "";
    let type = OSRM_MOD[m.modifier] ?? 8, dir = t("o_" + String(m.modifier || "straight").replace(" ", "_"));
    if (m.type === "depart") { type = 1; dir = t("o_depart"); }
    else if (m.type === "arrive") { type = 4; dir = t("o_arrive"); }
    else if (/roundabout|rotary/.test(m.type)) { type = 26; dir = t("o_roundabout", { n: m.exit || 1 }); }
    else if (m.type === "continue" || m.type === "new name") { if (!m.modifier || m.modifier === "straight") { type = 8; dir = t("o_straight"); } }
    const text = name && m.type !== "arrive" ? t("o_onto", { dir, name }) : dir;
    maneuvers.push({ type, instruction: text + ".", say: text, alert: "", length: s.distance / 1000, time: s.duration, begin: idx });
  }));
  if (ferry) throw Object.assign(new Error("water"), { unreachable: true, reason: "water" });
  const end = pt(coords[coords.length - 1]), gap = km(end, locs[locs.length - 1]);
  if (gap > (mode === "car" ? .3 : .5)) throw Object.assign(new Error("far"), { unreachable: true, reason: "far" });
  return { time: rt.duration, length: rt.distance / 1000, coords, maneuvers, cum: cumulative(coords), ferry, offRoad: gap > .15 };
}
function costingOptions(mode, extra = {}) {
  // Step-free: Valhalla's wheelchair profile avoids steps; the step penalty makes stairs a last resort.
  // No mode "crosses the water": no ferries, so an island or the other shore is reported as unreachable.
  if (mode === "walk") return { use_ferry: 0, ...(access ? { type: "wheelchair", step_penalty: 43200 } : {}), ...extra };
  return { use_ferry: 0, ...extra };
}
const routeCache = new Map();
// Valhalla first; if it is down (not "no path", just down), the OSRM backup. Step-free needs Valhalla's wheelchair profile, so no backup there.
async function valhalla(locs, mode, extra = {}) {
  const key = JSON.stringify([locs.map(l => [l.lat.toFixed(5), l.lon.toFixed(5), l.type || ""]), mode, access, lang, extra]);
  if (routeCache.has(key)) return routeCache.get(key);
  let route;
  try { route = await valhallaOnce(locs, mode, extra); }
  catch (e) {
    if (e.unreachable || e.offline || (mode === "walk" && access)) throw e;
    route = await osrm(locs, mode);
    route.backup = true;
  }
  if (routeCache.size > 60) routeCache.delete(routeCache.keys().next().value);
  routeCache.set(key, route);
  return route;
}
async function valhallaOnce(locs, mode, extra) {
  const wait = 1100 - (Date.now() - lastValhalla); // public server: be gentle
  if (wait > 0) await sleep(wait);
  lastValhalla = Date.now();
  const costing = COSTING[mode];
  const body = { locations: locs, costing, costing_options: { [costing]: costingOptions(mode, extra) }, directions_options: { units: "kilometers", language: ROUTE_LANG[lang], directions_type: "instructions" } };
  let j;
  try { j = await getJSON(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`, { timeout: 15000 }); }
  catch (e) {
    // 4xx = Valhalla found no path (water in the way, no road, point too far from any street…)
    if (e.status >= 400 && e.status < 500) e.unreachable = true;
    throw e;
  }
  const coords = [], maneuvers = [];
  let ferry = false;
  for (const leg of j.trip.legs) {
    const c = decodePolyline(leg.shape, 6), offset = coords.length ? coords.length - 1 : 0;
    coords.push(...(coords.length ? c.slice(1) : c));
    for (const m of leg.maneuvers || []) {
      if (maneuvers.length && [4, 5, 6].includes(maneuvers[maneuvers.length - 1].type)) maneuvers.pop(); // drop mid-trip "arrive"
      if (m.type === 28 || m.type === 29 || m.travel_type === "ferry") ferry = true;
      maneuvers.push({ type: m.type, instruction: m.instruction, say: m.verbal_pre_transition_instruction || m.instruction, alert: m.verbal_transition_alert_instruction || "", length: m.length, time: m.time, begin: m.begin_shape_index + offset });
    }
  }
  const fail = reason => { const err = new Error(reason); err.unreachable = true; err.reason = reason; return err; };
  if (ferry) throw fail("water");
  // A route can only end on a way this mode can use. If that is far from the point you asked for
  // (on water, inside a park for a car, a pedestrian zone…), the trip isn't possible this way.
  const end = pt(coords[coords.length - 1]), want = locs[locs.length - 1], gap = km(end, want);
  if (gap > (mode === "car" ? .3 : .5)) throw fail("far");
  const offRoad = gap > .15;
  return { time: j.trip.summary.time, length: j.trip.summary.length, coords, maneuvers, cum: cumulative(coords), ferry, offRoad };
}

async function routeNow(fit = false) {
  const seq = ++R.seq, mode = R.mode;
  R.mine = null; R.pois = []; R.note = ""; R.poiCount = {};
  setVibe(R.prefs[0] || "fastest");
  if (mode === "transit") { setVibe("fastest"); return transitNow(seq, fit); }
  R.busy = true; rerenderSheet(); drawRoutes();
  const O = { lat: me.lat, lon: me.lon }, D = { lat: dest.lat, lon: dest.lon };
  try {
    if (!R.fast[mode]?.coords) R.fast[mode] = await valhalla([O, D], mode);
    if (seq !== R.seq) return;
    if (R.prefs.length) {
      const res = await personalized(O, D, mode, R.prefs, R.fast[mode]);
      if (seq !== R.seq) return;
      if (res) { R.mine = res.route; R.pois = res.pois; R.poiCount = res.count; }
      else R.note = t("nothingFound");
    }
  } catch (e) {
    if (seq !== R.seq) return;
    if (!R.fast[mode]?.coords) R.fast[mode] = { error: true, unreachable: !!e.unreachable, reason: e.reason, offline: !navigator.onLine };
    else R.note = t("routeError");
  }
  R.busy = false; rerenderSheet(); drawRoutes();
  const line = current()?.coords;
  if (line && (fit || R.mine)) fitLine(line);
  fillOtherModes(seq);
}
async function fillOtherModes(seq) {
  for (const m of ["walk", "bike", "car"]) {
    if (R.fast[m] || seq !== R.seq) continue;
    try { R.fast[m] = await valhalla([me, dest].map(p => ({ lat: p.lat, lon: p.lon })), m); }
    catch (e) { if (!e.unreachable && !navigator.onLine) continue; R.fast[m] = { error: true, unreachable: !!e.unreachable, reason: e.reason }; }
    if (seq === R.seq) rerenderSheet();
  }
  if (!R.transit && seq === R.seq) { await loadTransit(); if (seq === R.seq) rerenderSheet(); }
}
function fitLine(coords) {
  if (!coords?.length) return;
  const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(b, { padding: panelPadding(), maxZoom: 17, duration: 900 });
}
function drawRoutes() {
  if (!map.getSource("wv-mine")) return;
  const line = c => c ? { type: "Feature", geometry: { type: "LineString", coordinates: c }, properties: {} } : null;
  const fc = fs => ({ type: "FeatureCollection", features: fs.filter(Boolean) });
  const clear = ids => ids.forEach(id => map.getSource(id).setData(fc([])));
  if (!dest || view !== "route") return clear(["wv-fast", "wv-mine", "wv-pois", "wv-transit"]);
  if (R.mode === "transit") {
    clear(["wv-fast", "wv-mine", "wv-pois"]);
    const it = R.transit?.items?.[R.itin];
    map.getSource("wv-transit").setData(fc(it ? it.legs.map(l => ({ type: "Feature", geometry: { type: "LineString", coordinates: l.coords }, properties: { walk: l.walk, color: l.color || "#5b6475" } })) : []));
    return;
  }
  clear(["wv-transit"]);
  const f = R.fast[R.mode]?.coords;
  map.getSource("wv-mine").setData(fc([line(R.mine ? R.mine.coords : f)]));
  map.getSource("wv-fast").setData(fc([R.mine && !NAV.active ? line(f) : null]));
  map.getSource("wv-pois").setData(fc(R.pois.map(p => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { name: p.name || "" } }))));
}

// ---------- Metro and bus ----------
// 1) Transitous: real timetables where the city publishes them (GTFS).
// 2) Otherwise: real lines and stops from OpenStreetMap with an estimated time, clearly labelled as such.
async function loadTransit() {
  let items = [];
  try { items = await transitous(); } catch {}
  if (!items.length) { try { items = await osmTransit(); } catch {} }
  R.transit = { items };
}
async function transitous() {
  const params = new URLSearchParams({ fromPlace: `${me.lat},${me.lon}`, toPlace: `${dest.lat},${dest.lon}`, numItineraries: "5", detailedTransfers: "false", pedestrianProfile: access ? "WHEELCHAIR" : "FOOT", language: lang });
  let j = null;
  for (const url of TRANSITOUS) { try { j = await getJSON(`${url}?${params}`, { timeout: 15000 }); break; } catch {} }
  if (!j) return [];
  return (j.itineraries || []).map(it => {
    const legs = (it.legs || []).map(l => {
      const walk = ["WALK", "BIKE", "CAR", "FOOT"].includes(l.mode);
      const g = l.legGeometry;
      const coords = g?.points ? decodePolyline(g.points, g.precision ?? 6) : [[l.from.lon, l.from.lat], [l.to.lon, l.to.lat]];
      const start = new Date(l.startTime || l.scheduledStartTime), end = new Date(l.endTime || l.scheduledEndTime);
      return {
        walk, mode: l.mode, coords, color: l.routeColor ? "#" + l.routeColor.replace("#", "") : "#5b6475", textColor: l.routeTextColor ? "#" + l.routeTextColor.replace("#", "") : "#ffffff",
        name: l.routeShortName || l.displayName || l.routeLongName || l.mode, headsign: l.headsign || l.tripTo?.name || "",
        from: l.from?.name, to: l.to?.name, start, end, duration: l.duration ?? (end - start) / 1000, distance: (l.distance || 0) / 1000,
        stops: (l.intermediateStops || []).length + 1,
      };
    }).filter(l => !(l.walk && l.duration < 30));
    return { duration: it.duration, start: new Date(it.startTime), end: new Date(it.endTime), transfers: it.transfers ?? Math.max(0, legs.filter(l => !l.walk).length - 1), legs, coords: legs.flatMap(l => l.coords) };
  }).filter(it => it.legs.some(l => !l.walk)).sort((a, b) => a.end - b.end);
}
const ROUTE_KINDS = "subway|light_rail|monorail|train|tram|bus|trolleybus";
const KIND = { subway: { speed: 33, wait: 4 }, light_rail: { speed: 26, wait: 6 }, monorail: { speed: 30, wait: 5 }, train: { speed: 45, wait: 10 }, tram: { speed: 18, wait: 7 }, bus: { speed: 14, wait: 8 }, trolleybus: { speed: 14, wait: 8 } };
async function osmTransit() {
  const O = { lat: me.lat, lon: me.lon }, D = { lat: dest.lat, lon: dest.lon };
  if (km(O, D) < .8) return [];
  const rad = access ? 500 : 700;
  const sel = p => `node(around:${rad},${p.lat},${p.lon})[~"^(public_transport|highway|railway)$"~"^(platform|stop_position|bus_stop|station|halt|tram_stop)$"]`;
  const rel = `[type=route][route~"^(${ROUTE_KINDS})$"]`;
  const els = await overpassQuery(`[out:json][timeout:25];${sel(O)}->.a;${sel(D)}->.b;rel(bn.a)${rel}->.ra;rel(bn.b)${rel}->.rb;rel.ra.rb->.c;.c out body;node(r.c);out body;`);
  const nodes = new Map(), rels = [];
  for (const e of els) { if (e.type === "node") nodes.set(e.id, e); else if (e.type === "relation") rels.push(e); }
  const walkKmh = access ? 3.6 : 4.8, now = Date.now(), best = new Map();
  const nm = n => n.tags?.[`name:${lang}`] || n.tags?.name || "";
  for (const r of rels) {
    const seq = [];
    for (const m of r.members || []) {
      if (m.type !== "node" || !(m.role === "" || /stop|platform/.test(m.role))) continue;
      const n = nodes.get(m.ref); if (!n) continue;
      const last = seq[seq.length - 1];
      if (last && ((last.tags?.name && last.tags.name === n.tags?.name) || km(last, n) < .06)) continue; // stop + platform of the same stop
      seq.push(n);
    }
    if (seq.length < 2) continue;
    let i = 0, j = 0;
    seq.forEach((n, k) => { if (km(O, n) < km(O, seq[i])) i = k; if (km(D, n) < km(D, seq[j])) j = k; });
    if (i >= j) continue; // this relation runs the other way
    const a = seq[i], b = seq[j];
    if (km(O, a) > rad / 1000 * 1.1 || km(D, b) > rad / 1000 * 1.1) continue;
    const kind = KIND[r.tags.route] || KIND.bus;
    let ride = 0; for (let k = i + 1; k <= j; k++) ride += km(seq[k - 1], seq[k]);
    const w1 = km(O, a) * 1.3, w2 = km(b, D) * 1.3;
    const tW1 = w1 / walkKmh * 3600, tWait = kind.wait * 60, tRide = ride / kind.speed * 3600 + (j - i) * 20, tW2 = w2 / walkKmh * 3600;
    const total = tW1 + tWait + tRide + tW2;
    const name = r.tags.ref || r.tags.name || r.tags.route;
    const key = r.tags.route + ":" + name;
    if (best.has(key) && best.get(key).duration <= total) continue;
    const at = s => new Date(now + s * 1000);
    const mode = /bus/.test(r.tags.route) ? "BUS" : r.tags.route.toUpperCase();
    const colour = /^#?[0-9a-f]{6}$/i.test(r.tags.colour || "") ? "#" + r.tags.colour.replace("#", "") : (r.tags.colour || (mode === "BUS" ? "#5b6475" : "#2563eb"));
    const legs = [
      { walk: true, mode: "WALK", coords: [[O.lon, O.lat], [a.lon, a.lat]], to: nm(a), start: at(0), duration: tW1, distance: w1 },
      { walk: false, mode, coords: seq.slice(i, j + 1).map(n => [n.lon, n.lat]), color: colour, textColor: "#ffffff", name, headsign: r.tags.to || "", from: nm(a), to: nm(b), start: at(tW1 + tWait), duration: tRide, distance: ride, stops: j - i, wait: kind.wait, accFrom: a.tags?.wheelchair, accTo: b.tags?.wheelchair },
      { walk: true, mode: "WALK", coords: [[b.lon, b.lat], [D.lon, D.lat]], to: "", start: at(tW1 + tWait + tRide), duration: tW2, distance: w2 },
    ];
    best.set(key, { estimated: true, duration: total, start: at(0), end: at(total), transfers: 0, legs, coords: legs.flatMap(l => l.coords), accessScore: (a.tags?.wheelchair === "yes") + (b.tags?.wheelchair === "yes") });
  }
  return [...best.values()].sort((x, y) => (access ? y.accessScore - x.accessScore : 0) || x.duration - y.duration).slice(0, 4);
}
async function transitNow(seq, fit) {
  if (!R.transit) { R.busy = true; rerenderSheet(); await loadTransit(); if (seq !== R.seq) return; }
  R.busy = false; R.itin = 0; rerenderSheet(); drawRoutes();
  const it = R.transit.items[0];
  if (it && fit) fitLine(it.coords);
  fillOtherModes(seq);
}
function lineBadge(l) {
  return `<span class="line" style="background:${esc(l.color)};color:${esc(l.textColor)}">${["BUS", "COACH", "TROLLEYBUS"].includes(l.mode) ? ICON.bus : ICON.transit}${esc(l.name)}</span>`;
}
function stopAccess(v) {
  if (!access) return "";
  if (v === "yes") return `<span class="acc-yes">♿ ${t("stop_yes")}</span>`;
  if (v === "no") return `<span class="acc-no">${t("stop_no")}</span>`;
  return `<span>${t("stop_unknown")}</span>`;
}
function transitBody() {
  if (R.busy) return `<div class="loading"><div class="loading-row">${buddy("think")}<span class="note">${t("transitLoading")}</span></div><div class="bar"></div></div>`;
  const items = R.transit?.items || [];
  if (!items.length) return `<div class="insight err">${buddy("sad")}<div>${t("noTransit")}<br><button class="btn" id="retryTransit" type="button">${t("retry")}</button></div></div>`;
  const it = items[R.itin] || items[0], est = !!it.estimated, ap = est ? "≈ " : "";
  const tr = it.transfers === 0 ? t("direct") : it.transfers === 1 ? t("oneTransfer") : t("transfers", { n: it.transfers });
  const badges = (est ? `<span class="badge est">${ICON.info}${t("estShort")}</span>` : "") + (usesAccess() ? `<span class="badge acc">${ICON.wheel}${t("accessOn")}</span>` : "");
  const hero = `<div class="hero"><div class="hero-row"><span class="eta">${ap}${fmtDur(it.duration)}</span>${badges}</div><span class="eta-sub">${t("arriveAt", { t: ap + clock(it.end) })} · ${tr}</span></div>`;
  const note = est ? `<div class="insight"><span class="dot"></span><div>${t("estimated")}</div></div>` : "";
  const list = items.length > 1 ? `<div class="itins">${items.map((x, i) => `<button class="itin" type="button" data-i="${i}" aria-pressed="${i === R.itin}"><div class="itin-top"><b>${x.estimated ? "≈ " : ""}${fmtDur(x.duration)}</b><span>${x.estimated ? "" : `${clock(x.start)} – ${clock(x.end)}`}</span></div><div class="chain">${x.legs.map(l => l.walk ? `<span class="walkchip">${ICON.walk}${Math.max(1, Math.round(l.duration / 60))}</span>` : lineBadge(l)).join(`<span class="sep">›</span>`)}</div></button>`).join("")}</div>` : "";
  const legs = `<ul class="tlegs">${it.legs.map((l, i) => {
    const place = i === it.legs.length - 1 && l.walk ? t("destination") : l.to;
    const body = l.walk
      ? `<b>${esc(t("walkTo", { d: fmtDur(l.duration), p: place }))}</b><span>${fmtDist(l.distance)}</span>`
      : `<b>${lineBadge(l)} ${l.headsign ? esc(t("toward", { p: l.headsign })) : ""}</b><span>${esc(l.from)} · ${est ? esc(t("waitAbout", { n: l.wait })) : t("leaves", { t: clock(l.start) })} · ${t("stops", { n: l.stops })}</span>${est ? stopAccess(l.accFrom) : ""}<span>${esc(t("getOff", { p: l.to }))}</span>${est ? stopAccess(l.accTo) : ""}`;
    return `<li class="tleg ${l.walk ? "walk" : ""}" style="--c:${l.walk ? "var(--fast)" : esc(l.color)}"><span class="tm">${ap && i ? "≈" : ""}${clock(l.start)}</span><span class="rail"></span><div class="bd">${body}</div></li>`;
  }).join("")}</ul>`;
  return hero + note + list + legs;
}

// ---------- Turn-by-turn navigation ----------
const NAV = { active: false, route: null, idx: 0, along: 0, off: 0, rerouting: false, watch: null, follow: true, spoken: new Set(), lastFix: 0, acc: 0, lastReroute: 0, lock: null, gpsTimer: 0 };
// keep the screen on while navigating (re-acquired when you come back to the tab)
async function keepAwake() { try { if (NAV.active && "wakeLock" in navigator && !NAV.lock) { NAV.lock = await navigator.wakeLock.request("screen"); NAV.lock.addEventListener("release", () => NAV.lock = null); } } catch {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });
let voiceOn = store.get("voice", true);
const navtop = $("#navtop"), navbottom = $("#navbottom"), recenterBtn = $("#recenter");
function speak(text) {
  if (!voiceOn || !text || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ROUTE_LANG[lang];
    speechSynthesis.speak(u);
  } catch {}
}
function startNav() {
  const route = current();
  if (!route?.coords || !me) return;
  Object.assign(NAV, { active: true, route, idx: 0, along: 0, off: 0, rerouting: false, follow: true, spoken: new Set(["0p"]) });
  document.body.classList.add("navigating");
  navtop.hidden = false; navbottom.hidden = false;
  drawRoutes();
  // our own GPS watch while navigating, so the camera follows us with heading and tilt
  NAV.lastFix = Date.now();
  NAV.watch = navigator.geolocation.watchPosition(p => {
    me = { lat: p.coords.latitude, lon: p.coords.longitude, heading: p.coords.heading };
    NAV.lastFix = Date.now(); NAV.acc = p.coords.accuracy || 0;
    updateNav();
  }, () => renderNav(), { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  clearInterval(NAV.gpsTimer);
  NAV.gpsTimer = setInterval(() => { if (NAV.active) renderNav(); }, 5000); // shows "looking for GPS" when fixes stop coming
  keepAwake();
  speak(route.maneuvers[0]?.say);
  updateNav(true);
}
function stopNav() {
  NAV.active = false;
  if (NAV.watch != null) navigator.geolocation.clearWatch(NAV.watch);
  NAV.watch = null;
  clearInterval(NAV.gpsTimer);
  try { NAV.lock?.release(); } catch {}
  NAV.lock = null;
  try { speechSynthesis.cancel(); } catch {}
  document.body.classList.remove("navigating");
  navtop.hidden = true; navbottom.hidden = true; recenterBtn.hidden = true;
  drawRoutes();
  map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 });
  rerenderSheet();
  const line = current()?.coords; if (line) fitLine(line);
}
// If you pan the map while navigating we stop following you and offer a clear way back.
map.on("dragstart", e => { if (NAV.active && e.originalEvent) { NAV.follow = false; recenterBtn.hidden = false; } });
recenterBtn.onclick = () => { NAV.follow = true; recenterBtn.hidden = true; updateNav(true); };
async function reroute() {
  if (Date.now() - NAV.lastReroute < 12000) return; // don't hammer the server while the GPS settles
  NAV.lastReroute = Date.now();
  NAV.rerouting = true; renderNav();
  try {
    const r = await valhalla([{ lat: me.lat, lon: me.lon }, { lat: dest.lat, lon: dest.lon }], R.mode);
    if (!NAV.active) return;
    Object.assign(NAV, { route: r, idx: 0, along: 0, off: 0, spoken: new Set(["0p"]) });
    if (R.mine) R.mine = r; else R.fast[R.mode] = r;
    drawRoutes();
    speak(r.maneuvers[0]?.say);
  } catch {}
  NAV.rerouting = false; updateNav();
}
// Snap a point onto the route: segment index, distance along the route and distance off it (km)
function snapTo(p, coords, cum, from = 0) {
  const kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57;
  let best = { seg: from, along: cum[from] || 0, off: Infinity };
  for (let i = Math.max(0, from); i < coords.length - 1; i++) {
    const ax = (coords[i][0] - p.lon) * kx, ay = (coords[i][1] - p.lat) * ky;
    const bx = (coords[i + 1][0] - p.lon) * kx, by = (coords[i + 1][1] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const f = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    const off = Math.hypot(ax + dx * f, ay + dy * f);
    if (off < best.off) best = { seg: i, along: cum[i] + (cum[i + 1] - cum[i]) * f, off };
  }
  return best;
}
function pointAt(coords, cum, along) {
  const i = cum.findIndex(c => c >= along);
  if (i === -1) return pt(coords[coords.length - 1]);
  if (i === 0) return pt(coords[0]);
  const f = (along - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return { lon: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, lat: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f };
}
function updateNav(first = false) {
  if (!NAV.active || !me) return;
  const { coords, cum } = NAV.route;
  const s = snapTo(me, coords, cum, Math.max(0, NAV.idx - 5));
  NAV.idx = s.seg; NAV.along = s.along;
  // a fix with poor accuracy can't tell us we left the route
  const tol = Math.max(R.mode === "car" ? .06 : .04, (NAV.acc || 0) / 1000);
  NAV.off = s.off > tol ? NAV.off + 1 : 0;
  if (NAV.off >= 3 && !NAV.rerouting) return reroute();
  const total = cum[cum.length - 1];
  const here = pointAt(coords, cum, s.along), ahead = pointAt(coords, cum, Math.min(total, s.along + .04));
  const brg = me.heading != null && !isNaN(me.heading) && R.mode !== "walk" ? me.heading : bearing(here, ahead);
  if (NAV.follow) map.easeTo({ center: [me.lon, me.lat], bearing: brg, pitch: 55, zoom: R.mode === "car" ? 16.4 : 17.4, duration: first ? 1200 : 900, padding: { top: innerHeight * .3, bottom: 130, left: 0, right: 0 } });
  renderNav();
}
function renderNav() {
  const { route, idx } = NAV, { cum, maneuvers } = route;
  const total = cum[cum.length - 1] || route.length, along = NAV.along ?? 0, leftKm = Math.max(0, total - along);
  const leftS = route.time * (total ? leftKm / total : 0);
  const arrived = leftKm < .025;
  const nextI = maneuvers.findIndex(m => m.begin > idx);
  const k = nextI === -1 ? maneuvers.length - 1 : nextI;
  const next = arrived ? null : maneuvers[k];
  const after = nextI >= 0 ? maneuvers[nextI + 1] : null;
  const dist = next ? Math.max(0, cum[Math.min(next.begin, cum.length - 1)] - along) : 0;
  // feedback without looking: a heads-up first, then the instruction itself right before the turn
  const near = R.mode === "car" ? .15 : .035, early = R.mode === "car" ? .5 : .15;
  if (arrived && !NAV.spoken.has("end")) { NAV.spoken.add("end"); speak(t("arrived")); navigator.vibrate?.([80, 60, 80]); celebrate(); }
  else if (next && dist <= near && !NAV.spoken.has(k + "p")) { NAV.spoken.add(k + "p"); NAV.spoken.add(k + "a"); speak(next.say); navigator.vibrate?.(120); }
  else if (next && dist <= early && dist > near && !NAV.spoken.has(k + "a")) { NAV.spoken.add(k + "a"); speak(next.alert || next.say); }

  navtop.innerHTML = NAV.rerouting
    ? `<div class="navcard"><span class="arrow">${ICON.round}</span><div><div class="ins">${t("rerouting")}</div></div></div>`
    : arrived
      ? `<div class="navcard arrived">${buddy("party")}<div><div class="dist">${t("arrived")}</div><div class="ins">${esc(dest.name)}</div><div class="cheer">${t("cheer")}</div></div></div>`
      : `<div class="navcard"><span class="arrow">${manIcon(next?.type)}</span><div><div class="dist">${fmtDist(dist)}</div><div class="ins">${esc(next?.instruction || "")}</div></div></div>
         ${after ? `<div class="navnext">${t("then")} ${manIcon(after.type)} <span>${esc(after.instruction)}</span></div>` : ""}`;
  const gps = Date.now() - NAV.lastFix > 15000 ? `<div class="gps bad">${t("gpsLost")}</div>` : NAV.acc > 60 ? `<div class="gps">${t("gpsWeak")}</div>` : "";
  navbottom.innerHTML = `<div class="grow"><div class="big">${arrived ? "0 " + t("min") : fmtDur(leftS)}</div><div class="meta">${t("arriveAt", { t: etaClock(leftS) })} · ${fmtDist(leftKm)} ${t("remaining")}</div>${gps}</div>
    <button class="vbtn" id="voiceBtn" type="button" aria-pressed="${voiceOn}" aria-label="${t("voice")}" title="${t("voice")}">${voiceOn ? ICON.speaker : ICON.mute}</button>
    <button class="exit" id="exitNav" type="button">${t("exit")}</button>`;
  $("#exitNav").onclick = stopNav;
  $("#voiceBtn").onclick = () => { voiceOn = !voiceOn; store.set("voice", voiceOn); if (!voiceOn) { try { speechSynthesis.cancel(); } catch {} } renderNav(); };
}

// ---------- Personalized routes: real streets through real places ----------
const QUERIES = {
  scenic: b => `nwr["tourism"~"^(attraction|museum|viewpoint|artwork|gallery)$"](${b});nwr["historic"~"^(monument|memorial|castle|ruins|church|fort)$"](${b});`,
  shade: b => `nwr["leisure"~"^(park|garden)$"](${b});nwr["landuse"~"^(forest|grass|recreation_ground)$"](${b});nwr["natural"~"^(wood|tree_row)$"](${b});`,
  food: b => `nwr["amenity"~"^(restaurant|cafe|fast_food|ice_cream|food_court)$"](${b});`,
  quiet: b => `nwr["leisure"~"^(park|garden)$"](${b});way["highway"~"^(pedestrian|footway|living_street)$"]["name"](${b});`,
};
const NEAR_KM = { walk: .06, bike: .08, car: .15 }; // how close counts as "passing by"

async function poisAlong(prefs, bbox) {
  const b = bbox.map(v => v.toFixed(5)).join(",");
  const els = await overpassQuery(`[out:json][timeout:20];(${prefs.map(p => QUERIES[p](b)).join("")});out center 500;`);
  return els.map(e => {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon, tg = e.tags || {};
    const kind = prefs.find(p => matchesPref(p, tg)) || prefs[0];
    return { lat, lon, name: tg[`name:${lang}`] || tg.name || "", kind };
  }).filter(p => p.lat != null);
}
function matchesPref(p, tg) {
  if (p === "scenic") return !!(tg.tourism || tg.historic);
  if (p === "food") return !!tg.amenity;
  if (p === "shade") return !!(tg.leisure || tg.landuse || tg.natural);
  if (p === "quiet") return !!(tg.leisure || tg.highway);
  return false;
}
function nearLine(p, coords, limitKm) {
  for (let i = 0; i < coords.length; i++) if (km(p, pt(coords[i])) <= limitKm) return true;
  return false;
}
function densify(coords, stepKm) {
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i], n = Math.ceil(km(pt(a), pt(b)) / stepKm);
    for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  return out;
}
async function personalized(O, D, mode, prefs, fast) {
  const dOD = km(O, D);
  const padKm = Math.min(1.5, Math.max(.3, fast.length * .15));
  const lats = fast.coords.map(c => c[1]), lons = fast.coords.map(c => c[0]);
  const dLat = padKm / 111, dLon = padKm / (111 * Math.cos(O.lat * Math.PI / 180));
  const bbox = [Math.min(...lats) - dLat, Math.min(...lons) - dLon, Math.max(...lats) + dLat, Math.max(...lons) + dLon];
  const pois = await poisAlong(prefs, bbox);
  if (pois.length < 2) return null;

  // pick up to 2 waypoints sitting in clusters of matching places, without a big detour
  const cluster = { walk: .15, bike: .3, car: .6 }[mode];
  const maxDetour = Math.max(.25, dOD * (mode === "car" ? .3 : .45));
  const scored = pois.map(p => {
    const detour = km(O, p) + km(p, D) - dOD;
    const density = pois.reduce((n, q) => n + (km(p, q) <= cluster ? 1 : 0), 0);
    return { p, detour, score: density - detour / (maxDetour + .01) * 2 };
  }).filter(x => x.detour <= maxDetour).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const wps = [scored[0].p];
  for (const c of scored.slice(1, 60)) {
    if (wps.length >= 2) break;
    if (km(c.p, wps[0]) < cluster * 2.5) continue;
    const order = [wps[0], c.p].sort((a, b) => km(O, a) - km(O, b));
    const total = km(O, order[0]) + km(order[0], order[1]) + km(order[1], D) - dOD;
    if (total <= maxDetour * 1.2) { wps.splice(0, 1, ...order); break; }
  }
  wps.sort((a, b) => km(O, a) - km(O, b));

  const opts = prefs.includes("quiet") && mode === "bike" ? { use_roads: .1 } : prefs.includes("quiet") && mode === "car" ? { use_highways: 0 } : {};
  let route = await valhalla([O, ...wps.map(w => ({ lat: w.lat, lon: w.lon, type: "through" })), D], mode, opts);
  if (route.time > fast.time * 1.8 && wps.length > 1) route = await valhalla([O, { lat: wps[0].lat, lon: wps[0].lon, type: "through" }, D], mode, opts);

  const line = densify(route.coords, .03);
  const passed = pois.filter(p => nearLine(p, line, NEAR_KM[mode]));
  const count = {};
  for (const p of passed) count[p.kind] = (count[p.kind] || 0) + 1;
  return { route, pois: passed, count };
}
