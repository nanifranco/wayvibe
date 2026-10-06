import { LANGS, T, PREF_WORDS, ROUTE_LANG } from "./i18n.js";

// ---------- Services (all free, no key) ----------
// Map: OpenFreeMap · Search: Photon · Address: Nominatim · Walk/bike/car: Valhalla (FOSSGIS)
// Metro and bus: Transitous · Places along a route: Overpass
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const PHOTON = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const TRANSITOUS = "https://api.transitous.org/api/v1/plan";
const OVERPASS = "https://overpass-api.de/api/interpreter";

// ---------- Language ----------
const stored = (() => { try { return localStorage.getItem("wv-lang"); } catch { return null; } })();
const browser = (navigator.language || "es").slice(0, 2);
let lang = LANGS[stored] ? stored : LANGS[browser] ? browser : "es";
const t = (k, vars = {}) => (T[lang][k] ?? T.en[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
  document.querySelectorAll("[data-i18n-label]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  $("#langCode").textContent = lang.toUpperCase();
}
const langSel = $("#lang");
langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
langSel.value = lang;
langSel.onchange = () => {
  lang = langSel.value;
  try { localStorage.setItem("wv-lang", lang); } catch {}
  applyI18n();
  setLabelLanguage();
  if (me) reverse(me.lat, me.lon).then(showWhere);
  rerenderSheet();
};
applyI18n();

// ---------- Helpers ----------
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
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
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let toastTimer = 0;
function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 5000);
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

// ---------- Icons ----------
const S = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  walk: S(`<circle cx="13" cy="4" r="2"/><path d="M9 21l2.5-6.5L14 17v4M11.5 14.5L10 9l4-1 2 4 3 1M10 9l-3 3"/>`),
  bike: S(`<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17L9 9h6l3.5 8M9 9l3.5 8L15 9M8 6h3"/>`),
  car: S(`<path d="M5 17h14v-5l-2-5H7l-2 5v5ZM5 12h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>`),
  transit: S(`<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/>`),
  bus: S(`<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3"/><circle cx="8.5" cy="14.5" r=".8"/><circle cx="15.5" cy="14.5" r=".8"/>`),
  pin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>`,
  fastest: S(`<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z"/>`),
  scenic: S(`<path d="M3 8h3l2-3h8l2 3h3v11H3Z"/><circle cx="12" cy="13" r="3.5"/>`),
  shade: S(`<path d="M12 22v-6M7 16h10l-2.5-4H16l-4-6-4 6h1.5Z"/>`),
  food: S(`<path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8a2 2 0 0 1-2 2M17 22V2c-2 1.5-3 4-3 7s1 4 3 4"/>`),
  quiet: S(`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>`),
  go: S(`<path d="M5 12h14M13 6l6 6-6 6"/>`),
  list: S(`<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>`),
  flag: S(`<path d="M5 22V4M5 4h11l-2 4 2 4H5"/>`),
  arrow: deg => S(`<path d="M12 20V5M6 11l6-6 6 6"/>`, `style="transform:rotate(${deg}deg)"`),
  round: S(`<path d="M12 21v-6M12 15a4 4 0 1 0-4-4M8 11l-2.5-1M8 11l1-2.5"/>`),
};
// Valhalla maneuver type → icon
function manIcon(type) {
  const angles = { 9: 45, 10: 90, 11: 135, 12: 180, 13: 180, 14: -135, 15: -90, 16: -45, 18: 45, 19: -45, 20: 45, 21: -45, 23: 30, 24: -30 };
  if ([4, 5, 6].includes(type)) return ICON.flag;
  if ([26, 27].includes(type)) return ICON.round;
  return ICON.arrow(angles[type] ?? 0);
}

// ---------- Vibes ----------
const VIBES = {
  fastest: ["#2f6bff", "#8b5cf6"],
  scenic: ["#a855f7", "#ec4899"],
  shade: ["#10b981", "#65a30d"],
  food: ["#f97316", "#f43f5e"],
  quiet: ["#0ea5e9", "#6366f1"],
};
function setVibe(key) {
  const [a, b] = VIBES[key] || VIBES.fastest;
  document.documentElement.style.setProperty("--g1", a);
  document.documentElement.style.setProperty("--g2", b);
  if (map.getLayer("wv-mine")) map.setPaintProperty("wv-mine", "line-gradient", ["interpolate", ["linear"], ["line-progress"], 0, a, 1, b]);
  if (map.getLayer("wv-mine-glow")) map.setPaintProperty("wv-mine-glow", "line-color", a);
  if (map.getLayer("wv-pois")) map.setPaintProperty("wv-pois", "circle-stroke-color", b);
}

// ---------- Map ----------
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const map = new maplibregl.Map({
  container: "map",
  style: darkMQ.matches ? STYLE_DARK : STYLE_LIGHT,
  center: [0, 25], zoom: 1.6,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true, showUserHeading: true });
map.addControl(geo, "bottom-right");
darkMQ.addEventListener("change", () => map.setStyle(darkMQ.matches ? STYLE_DARK : STYLE_LIGHT));

function setLabelLanguage() {
  if (!map.isStyleLoaded()) return;
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol" || layer.id.startsWith("wv-") || !map.getLayoutProperty(layer.id, "text-field")) continue;
    map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]]);
  }
}
function ensureLayers() {
  const empty = { type: "FeatureCollection", features: [] };
  if (!map.getSource("wv-fast")) map.addSource("wv-fast", { type: "geojson", data: empty });
  if (!map.getSource("wv-mine")) map.addSource("wv-mine", { type: "geojson", data: empty, lineMetrics: true });
  if (!map.getSource("wv-pois")) map.addSource("wv-pois", { type: "geojson", data: empty });
  if (!map.getSource("wv-transit")) map.addSource("wv-transit", { type: "geojson", data: empty });
  const [a, b] = [cssVar("--g1") || VIBES.fastest[0], cssVar("--g2") || VIBES.fastest[1]];
  const round = { "line-cap": "round", "line-join": "round" };
  const add = l => { if (!map.getLayer(l.id)) map.addLayer(l); };
  add({ id: "wv-fast", type: "line", source: "wv-fast", layout: round, paint: { "line-color": cssVar("--fast") || "#8a8899", "line-width": 5, "line-opacity": .75, "line-dasharray": [.1, 1.8] } });
  add({ id: "wv-mine-glow", type: "line", source: "wv-mine", layout: round, paint: { "line-color": a, "line-width": 22, "line-opacity": .18, "line-blur": 8 } });
  add({ id: "wv-mine-casing", type: "line", source: "wv-mine", layout: round, paint: { "line-color": cssVar("--casing") || "#fff", "line-width": 11 } });
  add({ id: "wv-mine", type: "line", source: "wv-mine", layout: round, paint: { "line-width": 7, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, a, 1, b] } });
  add({ id: "wv-transit-walk", type: "line", source: "wv-transit", filter: ["==", ["get", "walk"], true], layout: round, paint: { "line-color": cssVar("--fast") || "#8a8899", "line-width": 5, "line-dasharray": [.1, 1.8] } });
  add({ id: "wv-transit-casing", type: "line", source: "wv-transit", filter: ["==", ["get", "walk"], false], layout: round, paint: { "line-color": cssVar("--casing") || "#fff", "line-width": 11 } });
  add({ id: "wv-transit-line", type: "line", source: "wv-transit", filter: ["==", ["get", "walk"], false], layout: round, paint: { "line-color": ["get", "color"], "line-width": 7 } });
  add({ id: "wv-pois", type: "circle", source: "wv-pois", paint: { "circle-radius": 5.5, "circle-color": "#ffffff", "circle-stroke-color": b, "circle-stroke-width": 3 } });
  add({ id: "wv-pois-label", type: "symbol", source: "wv-pois", minzoom: 15, layout: { "text-field": ["get", "name"], "text-size": 11.5, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true }, paint: { "text-color": cssVar("--ink") || "#14121f", "text-halo-color": cssVar("--casing") || "#fff", "text-halo-width": 1.6 } });
  drawRoutes();
}
map.on("style.load", () => { setLabelLanguage(); ensureLayers(); });
map.on("load", () => geo.trigger());

// ---------- Where am I ----------
let me = null, lastReverse = null;
geo.on("geolocate", e => {
  me = { lat: e.coords.latitude, lon: e.coords.longitude, heading: e.coords.heading };
  if (!lastReverse || km(lastReverse, me) > .15) {
    lastReverse = { ...me };
    reverse(me.lat, me.lon).then(showWhere);
  }
});
geo.on("error", () => { if (!me) toast(t("noLocation")); });

async function reverse(lat, lon) {
  try {
    const r = await fetch(`${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=${lang}`);
    if (!r.ok) return null;
    const j = await r.json(), a = j.address || {};
    const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(" ");
    const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
    const city = a.city || a.town || a.village || a.municipality || a.county;
    return { title: street || j.name || area || city || j.display_name, sub: [area, city, a.country].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", "), name: j.name };
  } catch { return null; }
}
function showWhere(addr) {
  if (!addr) return;
  $("#whereText").textContent = [addr.title, addr.sub].filter(Boolean).join(" · ");
  $("#where").hidden = false;
}

// ---------- Search ----------
const qEl = $("#q"), sugs = $("#sugs"), clearQ = $("#clearQ");
let searchCtl = null, sugItems = [], sugIdx = -1, debounce = 0;
function biasPoint() { return me || (map.getZoom() > 4 ? { lat: map.getCenter().lat, lon: map.getCenter().lng } : null); }
async function photon(q) {
  searchCtl?.abort(); searchCtl = new AbortController();
  const b = biasPoint();
  const params = new URLSearchParams({ q, limit: "7" });
  if (b) { params.set("lat", b.lat.toFixed(5)); params.set("lon", b.lon.toFixed(5)); }
  if (["en", "fr", "de"].includes(lang)) params.set("lang", lang);
  const r = await fetch(`${PHOTON}?${params}`, { signal: searchCtl.signal });
  const j = await r.json();
  return (j.features || []).map(f => {
    const p = f.properties, [lon, lat] = f.geometry.coordinates;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const name = p.name || street || p.city || p.country;
    const sub = [p.name ? street : "", p.district || p.locality, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v !== name).slice(0, 3).join(", ");
    return { name, sub, lat, lon };
  });
}
function renderSugs() {
  if (!sugItems.length) sugs.innerHTML = `<div class="sug-empty">${t("noResults")}</div>`;
  else sugs.innerHTML = sugItems.map((s, i) => `<button class="sug" type="button" role="option" aria-selected="${i === sugIdx}" data-i="${i}"><span class="ic">${ICON.pin}</span><span style="min-width:0"><span class="nm">${esc(s.name)}</span><span class="sub">${esc(s.sub)}</span></span><span class="d">${me ? fmtDist(km(me, s)) : ""}</span></button>`).join("");
  sugs.hidden = false; qEl.setAttribute("aria-expanded", "true");
  sugs.querySelectorAll(".sug").forEach(b => b.onclick = () => choose(sugItems[+b.dataset.i]));
}
function hideSugs() { sugs.hidden = true; qEl.setAttribute("aria-expanded", "false"); sugIdx = -1; }
qEl.addEventListener("input", () => {
  const q = qEl.value.trim(); clearQ.hidden = !q;
  clearTimeout(debounce);
  if (q.length < 2) return hideSugs();
  debounce = setTimeout(async () => {
    try { sugItems = await photon(q); sugIdx = -1; renderSugs(); } catch (e) { if (e.name !== "AbortError") hideSugs(); }
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
  try { sugItems = await photon(q); } catch { sugItems = []; }
  if (sugItems[0]) choose(sugItems[0]); else renderSugs();
});
clearQ.onclick = () => { qEl.value = ""; clearQ.hidden = true; hideSugs(); closeAll(); qEl.focus(); };
document.addEventListener("click", e => { if (!e.target.closest(".searchwrap")) hideSugs(); });

// Long-press (touch) or right-click drops a pin
let pressTimer = 0, pressAt = null;
map.on("contextmenu", e => pickPoint(e.lngLat));
map.on("touchstart", e => {
  if (e.originalEvent.touches.length !== 1 || NAV.active) return;
  pressAt = e.point; const ll = e.lngLat;
  pressTimer = setTimeout(() => pickPoint(ll), 550);
});
map.on("touchmove", e => { if (pressAt && Math.hypot(e.point.x - pressAt.x, e.point.y - pressAt.y) > 8) clearTimeout(pressTimer); });
map.on("touchend", () => clearTimeout(pressTimer));
async function pickPoint(ll) {
  if (NAV.active) return;
  const p = { lat: ll.lat, lon: ll.lng, name: t("pinned"), sub: "" };
  choose(p, false);
  const a = await reverse(p.lat, p.lon);
  if (a && dest === p) { p.name = a.name || a.title; p.sub = a.sub; qEl.value = p.name; rerenderSheet(); }
}

// ---------- Destination ----------
const sheet = $("#sheet");
let dest = null, destMarker = null, view = null; // view: "place" | "route"
const R = { mode: "walk", prefs: [], fast: {}, mine: null, pois: [], poiCount: {}, busy: false, note: "", seq: 0, steps: false, transit: null, itin: 0, askText: "" };

function pinEl() {
  const el = document.createElement("div");
  el.className = "dest-pin";
  el.innerHTML = `<svg viewBox="0 0 44 54"><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--g1)"/><stop offset="1" style="stop-color:var(--g2)"/></linearGradient></defs><path d="M22 52C22 52 40 33 40 20A18 18 0 0 0 4 20c0 13 18 32 18 32Z" fill="url(#pg)" stroke="#fff" stroke-width="3"/><circle cx="22" cy="20" r="7" fill="#fff"/></svg>`;
  return el;
}
function choose(p, fly = true) {
  hideSugs(); qEl.blur();
  dest = p; view = "place";
  qEl.value = p.name; clearQ.hidden = false;
  resetRoute();
  destMarker?.remove();
  destMarker = new maplibregl.Marker({ element: pinEl(), anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map);
  if (fly) map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 15), offset: innerWidth < 700 ? [0, -innerHeight * .18] : [210, 0], speed: 1.6 });
  rerenderSheet();
}
function closeAll() {
  if (NAV.active) stopNav();
  dest = null; view = null; destMarker?.remove(); destMarker = null;
  resetRoute(); sheet.hidden = true; setVibe("fastest");
}
function resetRoute() { Object.assign(R, { fast: {}, mine: null, pois: [], poiCount: {}, note: "", busy: false, transit: null, itin: 0, steps: false }); R.seq++; drawRoutes(); }
function panelPadding() {
  return innerWidth < 700 ? { top: 90, bottom: innerHeight * .56 + 24, left: 40, right: 70 } : { top: 70, bottom: 70, left: 450, right: 90 };
}

const COSTING = { walk: "pedestrian", bike: "bicycle", car: "auto" };
const PREFS = ["fastest", "scenic", "shade", "food", "quiet"];
const current = () => R.mine || R.fast[R.mode];

function rerenderSheet() {
  if (!dest || NAV.active) return;
  sheet.hidden = false;
  if (view === "place") {
    sheet.innerHTML = `<div class="hero"><h2 class="title">${esc(dest.name)}</h2>${dest.sub ? `<p class="sub2">${esc(dest.sub)}</p>` : ""}</div>
      ${me ? `<p class="note">${fmtDist(km(me, dest))} · ${t("from").toLowerCase()}</p>` : ""}
      <div class="actions"><button class="btn go" id="dirBtn">${ICON.go}${t("directions")}</button><button class="btn" id="closeBtn">${t("close")}</button></div>`;
    $("#dirBtn").onclick = startDirections;
    $("#closeBtn").onclick = () => { qEl.value = ""; clearQ.hidden = true; closeAll(); };
    return;
  }
  const modeBtn = m => {
    const v = m === "transit" ? R.transit?.items?.[0]?.duration : R.fast[m]?.time;
    const err = m === "transit" ? R.transit?.error || R.transit?.items?.length === 0 : R.fast[m]?.error;
    return `<button class="mode" data-m="${m}" aria-pressed="${R.mode === m}">${ICON[m]}<b>${v ? fmtDur(v) : err ? "—" : "…"}</b><span>${t(m)}</span></button>`;
  };
  const modes = `<div class="modes">${["walk", "bike", "car", "transit"].map(modeBtn).join("")}</div>`;
  const head = `<div class="hero"><span class="eyebrow">${t("from")}</span><h2 class="title">${esc(dest.name)}</h2></div>`;

  if (R.mode === "transit") {
    sheet.innerHTML = head + modes + transitBody() + `<div class="actions"><button class="btn" id="closeBtn" style="flex:1">${t("close")}</button></div>`;
    sheet.querySelectorAll(".itin").forEach(b => b.onclick = () => { R.itin = +b.dataset.i; drawRoutes(); rerenderSheet(); fitLine(R.transit.items[R.itin].coords); });
  } else {
    const active = R.prefs.length ? R.prefs : ["fastest"];
    const c = current();
    let hero = "", body = "";
    if (R.busy) body = `<div class="loading"><span class="note">${t("calculating")}</span><div class="bar"></div></div>`;
    else if (R.fast[R.mode]?.error) body = `<div class="insight">${t("routeError")}</div>`;
    else if (c?.time) {
      hero = `<div class="hero"><span class="eta gtext">${fmtDur(c.time)}</span><span class="eta-sub">${t("arriveAt", { t: etaClock(c.time) })} · ${fmtDist(c.length)}</span></div>`;
      const lines = [];
      if (R.mine) {
        const extra = Math.round((R.mine.time - R.fast[R.mode].time) / 60);
        lines.push(extra > 0 ? t("extra", { n: extra }) : t("same"));
        const parts = R.prefs.filter(p => R.poiCount[p] > 0).map(p => t("poi_" + p, { n: R.poiCount[p] }));
        if (parts.length) lines.push(`<b>${esc(t("passes", { list: parts.join(", ") }))}</b>`);
      }
      if (R.note) lines.push(esc(R.note));
      if (lines.length) body = `<div class="insight"><span class="dot grad"></span><div>${lines.join("<br>")}</div></div>`;
      if (R.mine) body += `<div class="legend"><span><i class="grad"></i>${t("yourRoute")}</span><span><i style="background:var(--fast)"></i>${t("fastestRoute")}</span></div>`;
    }
    const steps = R.steps && c?.maneuvers ? `<ul class="steps">${c.maneuvers.map(m => `<li class="step"><span class="ic">${manIcon(m.type)}</span><span class="tx">${esc(m.instruction)}</span><span class="d">${m.length ? fmtDist(m.length) : ""}</span></li>`).join("")}</ul>` : "";
    sheet.innerHTML = head.replace("</div>", "</div>") + (hero || "") + modes +
      `<span class="eyebrow">${t("howToGo")}</span>
      <div class="prefs">${PREFS.map(p => `<button class="pref" data-p="${p}" aria-pressed="${active.includes(p)}" style="--c1:${VIBES[p][0]};--c2:${VIBES[p][1]}"><i>${ICON[p]}</i>${t(p)}</button>`).join("")}</div>
      <form class="ask" id="askForm"><input id="ask" placeholder="${esc(t("askPlaceholder"))}" aria-label="${esc(t("howToGo"))}" value="${esc(R.askText)}"><button class="grad" type="submit" aria-label="OK">→</button></form>
      ${body}
      <div class="actions"><button class="btn go" id="startBtn" ${c?.coords && !R.busy ? "" : "disabled"}>${ICON.go}${t("start")}</button><button class="btn" id="stepsBtn" aria-pressed="${R.steps}">${ICON.list}<span>${R.steps ? t("hideSteps") : t("steps")}</span></button><button class="btn" id="closeBtn" aria-label="${t("close")}">×</button></div>
      ${steps}`;
    sheet.querySelectorAll(".pref").forEach(b => b.onclick = () => { R.askText = ""; R.prefs = b.dataset.p === "fastest" ? [] : [b.dataset.p]; routeNow(); });
    $("#askForm").addEventListener("submit", e => {
      e.preventDefault();
      const txt = $("#ask").value; R.askText = txt;
      const n = txt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const found = Object.entries(PREF_WORDS).filter(([, ws]) => ws.some(w => n.includes(w.normalize("NFD").replace(/[̀-ͯ]/g, "")))).map(([k]) => k);
      R.prefs = found.filter(k => k !== "fastest");
      routeNow();
    });
    $("#startBtn").onclick = startNav;
    $("#stepsBtn").onclick = () => { R.steps = !R.steps; rerenderSheet(); };
  }
  sheet.querySelectorAll(".mode").forEach(b => b.onclick = () => { if (R.mode !== b.dataset.m) { R.mode = b.dataset.m; R.steps = false; routeNow(true); } });
  $("#closeBtn").onclick = () => { qEl.value = ""; clearQ.hidden = true; closeAll(); };
}

function startDirections() {
  if (!me) { toast(t("noLocation")); geo.trigger(); return; }
  view = "route";
  routeNow(true);
}

// ---------- Walk / bike / car (Valhalla) ----------
let lastValhalla = 0;
async function valhalla(locs, costing, costingOptions = {}) {
  const wait = 1100 - (Date.now() - lastValhalla); // public server: be gentle
  if (wait > 0) await sleep(wait);
  lastValhalla = Date.now();
  const body = { locations: locs, costing, costing_options: { [costing]: costingOptions }, directions_options: { units: "kilometers", language: ROUTE_LANG[lang], directions_type: "instructions" } };
  const r = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`);
  if (!r.ok) throw new Error("route " + r.status);
  const j = await r.json();
  const coords = [], maneuvers = [];
  for (const leg of j.trip.legs) {
    const c = decodePolyline(leg.shape, 6), offset = coords.length ? coords.length - 1 : 0;
    coords.push(...(coords.length ? c.slice(1) : c));
    for (const m of leg.maneuvers || []) {
      if (maneuvers.length && [4, 5, 6].includes(maneuvers[maneuvers.length - 1].type)) maneuvers.pop(); // drop mid-trip "arrive"
      maneuvers.push({ type: m.type, instruction: m.instruction, length: m.length, time: m.time, begin: m.begin_shape_index + offset });
    }
  }
  return { time: j.trip.summary.time, length: j.trip.summary.length, coords, maneuvers, cum: cumulative(coords) };
}

async function routeNow(fit = false) {
  const seq = ++R.seq, mode = R.mode;
  R.mine = null; R.pois = []; R.note = ""; R.poiCount = {};
  setVibe(R.prefs[0] || "fastest");
  if (mode === "transit") { setVibe("fastest"); return transitNow(seq, fit); }
  R.busy = true; rerenderSheet(); drawRoutes();
  const O = { lat: me.lat, lon: me.lon }, D = { lat: dest.lat, lon: dest.lon };
  try {
    if (!R.fast[mode]?.coords) R.fast[mode] = await valhalla([O, D], COSTING[mode]);
    if (seq !== R.seq) return;
    if (R.prefs.length) {
      const res = await personalized(O, D, mode, R.prefs, R.fast[mode]);
      if (seq !== R.seq) return;
      if (res) { R.mine = res.route; R.pois = res.pois; R.poiCount = res.count; }
      else R.note = t("nothingFound");
    }
  } catch {
    if (seq !== R.seq) return;
    if (!R.fast[mode]?.coords) R.fast[mode] = { error: true };
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
    try { R.fast[m] = await valhalla([me, dest].map(p => ({ lat: p.lat, lon: p.lon })), COSTING[m]); }
    catch { R.fast[m] = { error: true }; }
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
    map.getSource("wv-transit").setData(fc(it ? it.legs.map(l => ({ type: "Feature", geometry: { type: "LineString", coordinates: l.coords }, properties: { walk: l.walk, color: l.color } })) : []));
    return;
  }
  clear(["wv-transit"]);
  const f = R.fast[R.mode]?.coords;
  map.getSource("wv-mine").setData(fc([line(R.mine ? R.mine.coords : f)]));
  map.getSource("wv-fast").setData(fc([R.mine ? line(f) : null]));
  map.getSource("wv-pois").setData(fc(R.pois.map(p => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { name: p.name || "" } }))));
}

// ---------- Metro and bus (Transitous) ----------
async function loadTransit() {
  try {
    const params = new URLSearchParams({ fromPlace: `${me.lat},${me.lon}`, toPlace: `${dest.lat},${dest.lon}`, numItineraries: "4" });
    const r = await fetch(`${TRANSITOUS}?${params}`);
    if (!r.ok) throw new Error("transit " + r.status);
    const j = await r.json();
    const items = (j.itineraries || []).map(it => {
      const legs = (it.legs || []).map(l => {
        const walk = ["WALK", "BIKE", "CAR"].includes(l.mode);
        const g = l.legGeometry;
        const coords = g?.points ? decodePolyline(g.points, g.precision ?? 7) : [[l.from.lon, l.from.lat], [l.to.lon, l.to.lat]];
        const color = l.routeColor ? "#" + l.routeColor.replace("#", "") : "#5b5b6b";
        return {
          walk, mode: l.mode, coords, color, textColor: l.routeTextColor ? "#" + l.routeTextColor.replace("#", "") : "#ffffff",
          name: l.routeShortName || l.routeLongName || l.mode, headsign: l.headsign || "",
          from: l.from?.name, to: l.to?.name, start: new Date(l.startTime || l.scheduledStartTime), end: new Date(l.endTime || l.scheduledEndTime),
          duration: l.duration ?? (new Date(l.endTime) - new Date(l.startTime)) / 1000, distance: (l.distance || 0) / 1000,
          stops: (l.intermediateStops || []).length + 1,
        };
      }).filter(l => !(l.walk && l.duration < 30));
      return { duration: it.duration, start: new Date(it.startTime), end: new Date(it.endTime), transfers: it.transfers ?? Math.max(0, legs.filter(l => !l.walk).length - 1), legs, coords: legs.flatMap(l => l.coords) };
    }).filter(it => it.legs.some(l => !l.walk)).sort((a, b) => a.end - b.end);
    R.transit = { items };
  } catch { R.transit = { error: true, items: [] }; }
}
async function transitNow(seq, fit) {
  if (!R.transit) { R.busy = true; rerenderSheet(); await loadTransit(); if (seq !== R.seq) return; }
  R.busy = false; R.itin = 0; rerenderSheet(); drawRoutes();
  const it = R.transit.items[0];
  if (it && fit) fitLine(it.coords);
  fillOtherModes(seq);
}
function lineBadge(l) {
  return `<span class="line" style="background:${esc(l.color)};color:${esc(l.textColor)}">${["BUS", "COACH"].includes(l.mode) ? ICON.bus : ICON.transit}${esc(l.name)}</span>`;
}
function transitBody() {
  if (R.busy) return `<div class="loading"><span class="note">${t("transitLoading")}</span><div class="bar"></div></div>`;
  const items = R.transit?.items || [];
  if (!items.length) return `<div class="insight">${t("noTransit")}</div>`;
  const it = items[R.itin] || items[0];
  const tr = it.transfers === 0 ? t("direct") : it.transfers === 1 ? t("oneTransfer") : t("transfers", { n: it.transfers });
  const hero = `<div class="hero"><span class="eta gtext">${fmtDur(it.duration)}</span><span class="eta-sub">${t("arriveAt", { t: clock(it.end) })} · ${tr}</span></div>`;
  const list = items.length > 1 ? `<div class="itins">${items.map((x, i) => `<button class="itin" data-i="${i}" aria-pressed="${i === R.itin}"><div class="itin-top"><b>${fmtDur(x.duration)}</b><span>${clock(x.start)} – ${clock(x.end)}</span></div><div class="chain">${x.legs.map(l => l.walk ? `<span class="walkchip">${ICON.walk}${Math.round(l.duration / 60)}</span>` : lineBadge(l)).join(`<span class="sep">›</span>`)}</div></button>`).join("")}</div>` : "";
  const legs = `<ul class="tlegs">${it.legs.map((l, i) => {
    const place = i === it.legs.length - 1 && l.walk ? t("destination") : l.to;
    const body = l.walk
      ? `<b>${esc(t("walkTo", { d: fmtDur(l.duration), p: place }))}</b><span>${fmtDist(l.distance)}</span>`
      : `<b>${lineBadge(l)} ${esc(t("board", { line: "" }).trim())}${l.headsign ? " · " + esc(t("toward", { p: l.headsign })) : ""}</b><span>${esc(l.from)} · ${t("leaves", { t: clock(l.start) })} · ${t("stops", { n: l.stops })}</span><span>${esc(t("getOff", { p: l.to }))}</span>`;
    return `<li class="tleg ${l.walk ? "walk" : ""}" style="--c:${l.walk ? "var(--fast)" : esc(l.color)}"><span class="tm">${clock(l.start)}</span><span class="rail"></span><div class="bd">${body}</div></li>`;
  }).join("")}</ul>`;
  return hero + list + legs;
}

// ---------- Turn-by-turn navigation ----------
const NAV = { active: false, route: null, idx: 0, off: 0, rerouting: false, watch: null };
const navtop = $("#navtop"), navbottom = $("#navbottom");
function startNav() {
  const route = current();
  if (!route?.coords || !me) return;
  Object.assign(NAV, { active: true, route, idx: 0, along: 0, off: 0, rerouting: false });
  document.body.classList.add("navigating");
  navtop.hidden = false; navbottom.hidden = false;
  // own GPS watch while navigating, so the camera follows us with heading and tilt
  NAV.watch = navigator.geolocation.watchPosition(p => {
    me = { lat: p.coords.latitude, lon: p.coords.longitude, heading: p.coords.heading };
    updateNav();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 1000 });
  updateNav(true);
}
function stopNav() {
  NAV.active = false;
  if (NAV.watch != null) navigator.geolocation.clearWatch(NAV.watch);
  NAV.watch = null;
  document.body.classList.remove("navigating");
  navtop.hidden = true; navbottom.hidden = true;
  map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 });
  rerenderSheet();
  const line = current()?.coords; if (line) fitLine(line);
}
async function reroute() {
  NAV.rerouting = true; renderNav();
  try {
    const r = await valhalla([{ lat: me.lat, lon: me.lon }, { lat: dest.lat, lon: dest.lon }], COSTING[R.mode]);
    if (!NAV.active) return;
    Object.assign(NAV, { route: r, idx: 0, along: 0, off: 0 });
    if (R.mine) R.mine = r; else R.fast[R.mode] = r;
    drawRoutes();
  } catch {}
  NAV.rerouting = false; updateNav();
}
// Snap a point onto the route: segment index, distance along the route and distance off it (km)
function snap(p, coords, cum, from = 0) {
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
  let i = cum.findIndex(c => c >= along);
  if (i <= 0) return pt(coords[Math.max(0, i)]);
  const f = (along - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return { lon: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, lat: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f };
}
function updateNav(first = false) {
  if (!NAV.active || !me) return;
  const { coords, cum } = NAV.route;
  const s = snap(me, coords, cum, Math.max(0, NAV.idx - 5));
  NAV.idx = s.seg; NAV.along = s.along;
  NAV.off = s.off > (R.mode === "car" ? .06 : .04) ? NAV.off + 1 : 0;
  if (NAV.off >= 3 && !NAV.rerouting) return reroute();
  const total = cum[cum.length - 1];
  const ahead = pointAt(coords, cum, Math.min(total, s.along + .04));
  const here = pointAt(coords, cum, s.along);
  const brg = me.heading != null && !isNaN(me.heading) && R.mode !== "walk" ? me.heading : bearing(here, ahead);
  map.easeTo({ center: [me.lon, me.lat], bearing: brg, pitch: 55, zoom: R.mode === "car" ? 16.4 : 17.4, duration: first ? 1200 : 900, padding: { top: innerHeight * .28, bottom: 120, left: 0, right: 0 } });
  renderNav();
}
function renderNav() {
  const { route, idx } = NAV, { cum, maneuvers } = route;
  const total = cum[cum.length - 1] || route.length, along = NAV.along ?? 0, leftKm = Math.max(0, total - along);
  const leftS = route.time * (total ? leftKm / total : 0);
  const arrived = leftKm < .025;
  const nextI = maneuvers.findIndex(m => m.begin > idx);
  const next = arrived ? null : maneuvers[nextI === -1 ? maneuvers.length - 1 : nextI];
  const after = nextI >= 0 ? maneuvers[nextI + 1] : null;
  const dist = next ? Math.max(0, cum[Math.min(next.begin, cum.length - 1)] - along) : 0;
  navtop.innerHTML = NAV.rerouting
    ? `<div class="navcard"><span class="arrow">${ICON.round}</span><div><div class="ins">${t("rerouting")}</div></div></div>`
    : arrived
      ? `<div class="navcard"><span class="arrow">${ICON.flag}</span><div><div class="dist">${t("arrived")}</div><div class="ins">${esc(dest.name)}</div></div></div>`
      : `<div class="navcard"><span class="arrow">${manIcon(next?.type)}</span><div><div class="dist">${fmtDist(dist)}</div><div class="ins">${esc(next?.instruction || "")}</div></div></div>
         ${after ? `<div class="navnext">${t("then")} ${manIcon(after.type)} <span>${esc(after.instruction)}</span></div>` : ""}`;
  navbottom.innerHTML = `<div class="grow"><div class="big">${arrived ? "0 " + t("min") : fmtDur(leftS)}</div><div class="meta">${t("arriveAt", { t: etaClock(leftS) })} · ${fmtDist(leftKm)} ${t("remaining")}</div></div><button class="exit" id="exitNav">${t("exit")}</button>`;
  $("#exitNav").onclick = stopNav;
}

// ---------- Personalized routes ----------
const QUERIES = {
  scenic: b => `nwr["tourism"~"^(attraction|museum|viewpoint|artwork|gallery)$"](${b});nwr["historic"~"^(monument|memorial|castle|ruins|church|fort)$"](${b});`,
  shade: b => `nwr["leisure"~"^(park|garden)$"](${b});nwr["landuse"~"^(forest|grass|recreation_ground)$"](${b});nwr["natural"~"^(wood|tree_row)$"](${b});`,
  food: b => `nwr["amenity"~"^(restaurant|cafe|fast_food|ice_cream|food_court)$"](${b});`,
  quiet: b => `nwr["leisure"~"^(park|garden)$"](${b});way["highway"~"^(pedestrian|footway|living_street)$"]["name"](${b});`,
};
const NEAR = { walk: .06, bike: .08, car: .15 }; // km: how close counts as "passing by"

async function overpass(prefs, bbox) {
  const b = bbox.map(v => v.toFixed(5)).join(",");
  const q = `[out:json][timeout:20];(${prefs.map(p => QUERIES[p](b)).join("")});out center 500;`;
  const r = await fetch(OVERPASS, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  if (!r.ok) throw new Error("overpass " + r.status);
  const j = await r.json();
  return j.elements.map(e => {
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
  const pois = await overpass(prefs, bbox);
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
  let route = await valhalla([O, ...wps.map(w => ({ lat: w.lat, lon: w.lon, type: "through" })), D], COSTING[mode], opts);
  if (route.time > fast.time * 1.8 && wps.length > 1) route = await valhalla([O, { lat: wps[0].lat, lon: wps[0].lon, type: "through" }, D], COSTING[mode], opts);

  const line = densify(route.coords, .03);
  const passed = pois.filter(p => nearLine(p, line, NEAR[mode]));
  const count = {};
  for (const p of passed) count[p.kind] = (count[p.kind] || 0) + 1;
  return { route, pois: passed, count };
}
