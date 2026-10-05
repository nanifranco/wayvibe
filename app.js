import { LANGS, T, PREF_WORDS } from "./i18n.js";

// ---------- Services (all free, no key) ----------
// Map tiles: OpenFreeMap · Search: Photon · Addresses: Nominatim · Routes: Valhalla (FOSSGIS) · Places along routes: Overpass
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const PHOTON = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const VALHALLA = "https://valhalla1.openstreetmap.de/route";
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
}
const langSel = $("#lang");
langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
langSel.value = lang;
const syncCode = () => { $("#langCode").textContent = lang.toUpperCase(); };
syncCode();
langSel.onchange = () => {
  lang = langSel.value;
  try { localStorage.setItem("wv-lang", lang); } catch {}
  applyI18n(); syncCode();
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
const fmtDur = s => {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} ${t("min")}` : `${Math.floor(m / 60)} ${t("h")} ${m % 60 ? (m % 60) + " " + t("min") : ""}`.trim();
};
const fmtDist = k => k < 1 ? `${Math.round(k * 1000 / 10) * 10} ${t("m")}` : `${k.toFixed(k < 10 ? 1 : 0)} ${t("km")}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let toastTimer = 0;
function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 5000);
}
function decode6(str) {
  const out = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lon += d;
    }
    out.push([lon / 1e6, lat / 1e6]);
  }
  return out;
}

// ---------- Map ----------
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const map = new maplibregl.Map({
  container: "map",
  style: darkMQ.matches ? STYLE_DARK : STYLE_LIGHT,
  center: [0, 25],
  zoom: 1.6,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true });
map.addControl(geo, "bottom-right");
darkMQ.addEventListener("change", () => map.setStyle(darkMQ.matches ? STYLE_DARK : STYLE_LIGHT));

function setLabelLanguage() {
  if (!map.isStyleLoaded()) return;
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol" || !map.getLayoutProperty(layer.id, "text-field")) continue;
    if (layer.id.startsWith("wv-")) continue;
    map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]]);
  }
}
function ensureLayers() {
  const empty = { type: "FeatureCollection", features: [] };
  for (const id of ["wv-fast", "wv-mine", "wv-pois"]) if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e0477c";
  const fast = getComputedStyle(document.documentElement).getPropertyValue("--fast").trim() || "#7b8794";
  if (!map.getLayer("wv-fast")) map.addLayer({ id: "wv-fast", type: "line", source: "wv-fast", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": fast, "line-width": 5, "line-opacity": .7, "line-dasharray": [1.2, 1.4] } });
  if (!map.getLayer("wv-mine-casing")) map.addLayer({ id: "wv-mine-casing", type: "line", source: "wv-mine", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": getComputedStyle(document.documentElement).getPropertyValue("--casing").trim() || "#ffffff", "line-width": 10 } });
  if (!map.getLayer("wv-mine")) map.addLayer({ id: "wv-mine", type: "line", source: "wv-mine", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": accent, "line-width": 6 } });
  if (!map.getLayer("wv-pois")) map.addLayer({ id: "wv-pois", type: "circle", source: "wv-pois", paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": accent, "circle-stroke-width": 2.5 } });
  if (!map.getLayer("wv-pois-label")) map.addLayer({ id: "wv-pois-label", type: "symbol", source: "wv-pois", minzoom: 15, layout: { "text-field": ["get", "name"], "text-size": 11.5, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": accent, "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
  drawRoutes();
}
map.on("style.load", () => { setLabelLanguage(); ensureLayers(); });
map.on("load", () => geo.trigger());

// ---------- Where am I ----------
let me = null, lastReverse = null;
geo.on("geolocate", e => {
  me = { lat: e.coords.latitude, lon: e.coords.longitude };
  if (!lastReverse || km(lastReverse, me) > .15) {
    lastReverse = { ...me };
    reverse(me.lat, me.lon).then(showWhere);
  }
});
geo.on("error", () => toast(t("noLocation")));

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
    return { name, sub, lat, lon, kind: p.osm_value };
  });
}
const pinIcon = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>`;
function renderSugs() {
  if (!sugItems.length) { sugs.innerHTML = `<div class="sug-empty">${t("noResults")}</div>`; }
  else sugs.innerHTML = sugItems.map((s, i) => `<button class="sug" type="button" role="option" aria-selected="${i === sugIdx}" data-i="${i}"><span class="ic">${pinIcon}</span><span style="min-width:0"><span class="nm">${esc(s.name)}</span><span class="sub">${esc(s.sub)}${me ? " · " + fmtDist(km(me, s)) : ""}</span></span></button>`).join("");
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

// Long-press / right-click on the map drops a pin
let pressTimer = 0, pressAt = null;
map.on("contextmenu", e => pickPoint(e.lngLat));
map.on("touchstart", e => {
  if (e.originalEvent.touches.length !== 1) return;
  pressAt = e.point; const ll = e.lngLat;
  pressTimer = setTimeout(() => pickPoint(ll), 550);
});
map.on("touchmove", e => { if (pressAt && Math.hypot(e.point.x - pressAt.x, e.point.y - pressAt.y) > 8) clearTimeout(pressTimer); });
map.on("touchend", () => clearTimeout(pressTimer));
map.on("movestart", e => { if (e.originalEvent) clearTimeout(pressTimer); });
async function pickPoint(ll) {
  const p = { lat: ll.lat, lon: ll.lng, name: t("pinned"), sub: "" };
  choose(p, false);
  const a = await reverse(p.lat, p.lon);
  if (a && dest === p) { p.name = a.name || a.title; p.sub = a.sub; rerenderSheet(); }
}

// ---------- Destination & sheet ----------
const sheet = $("#sheet");
let dest = null, destMarker = null, view = null; // view: "place" | "route"
const R = { mode: "walk", prefs: [], fast: {}, mine: null, pois: [], busy: false, note: "", seq: 0 };

function choose(p, fly = true) {
  hideSugs(); qEl.blur();
  dest = p; view = "place";
  qEl.value = p.name; clearQ.hidden = false;
  resetRoute();
  destMarker?.remove();
  destMarker = new maplibregl.Marker({ color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e0477c" }).setLngLat([p.lon, p.lat]).addTo(map);
  if (fly) map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 15), offset: innerWidth < 700 ? [0, -innerHeight * .2] : [200, 0], speed: 1.6 });
  rerenderSheet();
}
function closeAll() {
  dest = null; view = null; destMarker?.remove(); destMarker = null;
  resetRoute(); drawRoutes(); sheet.hidden = true;
}
function resetRoute() { R.fast = {}; R.mine = null; R.pois = []; R.note = ""; R.seq++; R.busy = false; drawRoutes(); }
function panelPadding() {
  const small = innerWidth < 700;
  return small ? { top: 80, bottom: innerHeight * .5 + 20, left: 40, right: 70 } : { top: 60, bottom: 60, left: 440, right: 80 };
}

const ICON = {
  walk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="M9 21l2.5-6.5L14 17v4M11.5 14.5L10 9l4-1 2 4 3 1M10 9l-3 3"/></svg>`,
  bike: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17L9 9h6l3.5 8M9 9l3.5 8L15 9M8 6h3"/></svg>`,
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5l-2-5H7l-2 5v5ZM5 12h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/></svg>`,
  transit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9.5" cy="14" r=".6"/><circle cx="14.5" cy="14" r=".6"/></svg>`,
};
const COSTING = { walk: "pedestrian", bike: "bicycle", car: "auto" };
const GMODE = { walk: "walking", bike: "bicycling", car: "driving", transit: "transit" };
const PREFS = ["fastest", "scenic", "shade", "food", "quiet"];

function gmaps() {
  const o = me ? `&origin=${me.lat},${me.lon}` : "";
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${dest.lat},${dest.lon}&travelmode=${GMODE[R.mode]}`;
}
function rerenderSheet() {
  if (!dest) return;
  sheet.hidden = false;
  if (view === "place") {
    sheet.innerHTML = `<h2>${esc(dest.name)}</h2>${dest.sub ? `<p class="sub2">${esc(dest.sub)}${me ? " · " + fmtDist(km(me, dest)) : ""}</p>` : ""}
      <div class="actions"><button class="btn primary" id="dirBtn">${t("directions")}</button><button class="btn" id="closeBtn">${t("close")}</button></div>`;
    $("#dirBtn").onclick = startDirections;
    $("#closeBtn").onclick = () => { qEl.value = ""; clearQ.hidden = true; closeAll(); };
    return;
  }
  const modeBtn = m => {
    const f = R.fast[m];
    const val = m === "transit" ? "↗" : f?.time ? fmtDur(f.time) : f?.error ? "—" : "…";
    return `<button class="mode" data-m="${m}" aria-pressed="${R.mode === m}">${ICON[m]}<b>${val}</b><span>${t(m)}</span></button>`;
  };
  const active = R.prefs.length ? R.prefs : ["fastest"];
  let body = "";
  if (R.mode === "transit") {
    body = `<p class="note" style="font-size:13.5px">${t("transitInfo")}</p>`;
  } else if (R.busy) {
    body = `<div class="result"><span class="meta">${t("calculating")}</span><div class="bar"></div></div>`;
  } else if (R.fast[R.mode]?.error) {
    body = `<div class="result"><span class="meta">${t("routeError")}</span></div>`;
  } else {
    const f = R.fast[R.mode], m = R.mine;
    const main = m || f;
    if (main?.time) {
      const extra = m ? Math.round((m.time - f.time) / 60) : 0;
      const parts = R.prefs.filter(p => R.poiCount?.[p] > 0).map(p => t("poi_" + p, { n: R.poiCount[p] }));
      const counts = parts.length ? t("passes", { list: parts.join(", ") }) : "";
      body = `<div class="result"><span class="big">${fmtDur(main.time)}</span><span class="meta">${fmtDist(main.length)}${m ? " · " + (extra > 0 ? t("extra", { n: extra }) : t("same")) : ""}</span>
        ${counts ? `<span class="hl">${esc(counts)}</span>` : ""}${R.note ? `<span class="meta">${esc(R.note)}</span>` : ""}</div>
        ${m ? `<div class="legend"><span><i style="background:var(--accent)"></i>${t("yourRoute")}</span><span><i style="background:var(--fast)"></i>${t("fastestRoute")}</span></div>` : ""}`;
    }
  }
  sheet.innerHTML = `<div><h2>${esc(dest.name)}</h2><p class="note" style="margin-top:4px">${t("from")}</p></div>
    <div class="modes">${["walk", "bike", "car", "transit"].map(modeBtn).join("")}</div>
    ${R.mode !== "transit" ? `<div class="lbl">${t("howToGo")}</div>
    <div class="prefs">${PREFS.map(p => `<button class="pref" data-p="${p}" aria-pressed="${active.includes(p)}">${t(p)}</button>`).join("")}</div>
    <form class="ask" id="askForm"><input id="ask" placeholder="${esc(t("askPlaceholder"))}" aria-label="${esc(t("howToGo"))}" value="${esc(R.askText || "")}"><button class="btn" type="submit">→</button></form>` : ""}
    ${body}
    <div class="actions"><a class="btn primary" href="${gmaps()}" target="_blank" rel="noopener">${t("openGoogle")}</a><button class="btn" id="closeBtn">${t("close")}</button></div>`;
  sheet.querySelectorAll(".mode").forEach(b => b.onclick = () => { R.mode = b.dataset.m; R.mine = null; R.pois = []; R.note = ""; routeNow(); });
  sheet.querySelectorAll(".pref").forEach(b => b.onclick = () => { R.askText = ""; R.prefs = b.dataset.p === "fastest" ? [] : [b.dataset.p]; routeNow(); });
  $("#askForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const txt = $("#ask").value; R.askText = txt;
    const n = txt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const found = Object.entries(PREF_WORDS).filter(([, ws]) => ws.some(w => n.includes(w.normalize("NFD").replace(/[̀-ͯ]/g, "")))).map(([k]) => k);
    R.prefs = found.includes("fastest") && found.length === 1 ? [] : found.filter(k => k !== "fastest");
    routeNow();
  });
  $("#closeBtn").onclick = () => { qEl.value = ""; clearQ.hidden = true; closeAll(); };
}

function startDirections() {
  if (!me) { toast(t("noLocation")); geo.trigger(); return; }
  view = "route";
  routeNow(true);
}

// ---------- Routing ----------
let lastValhalla = 0;
async function valhalla(locs, costing, costingOptions = {}) {
  const wait = 1100 - (Date.now() - lastValhalla); // public server: be gentle
  if (wait > 0) await sleep(wait);
  lastValhalla = Date.now();
  const body = { locations: locs, costing, costing_options: { [costing]: costingOptions }, directions_type: "none", units: "kilometers" };
  const r = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`);
  if (!r.ok) throw new Error("route " + r.status);
  const j = await r.json();
  const coords = j.trip.legs.flatMap((l, i) => { const c = decode6(l.shape); return i ? c.slice(1) : c; });
  return { time: j.trip.summary.time, length: j.trip.summary.length, coords };
}
async function routeNow(fit = false) {
  const seq = ++R.seq, mode = R.mode;
  R.mine = null; R.pois = []; R.note = ""; R.poiCount = {};
  if (mode === "transit") { R.busy = false; rerenderSheet(); drawRoutes(); fillOtherModes(seq); return; }
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
  } catch (e) {
    if (seq !== R.seq) return;
    if (!R.fast[mode]?.coords) R.fast[mode] = { error: true };
    else R.note = t("routeError");
  }
  R.busy = false; rerenderSheet(); drawRoutes();
  const line = (R.mine || R.fast[mode])?.coords;
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
}
function fitLine(coords) {
  const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(b, { padding: panelPadding(), maxZoom: 17, duration: 900 });
}
function drawRoutes() {
  if (!map.getSource("wv-mine")) return;
  const line = c => c ? { type: "Feature", geometry: { type: "LineString", coordinates: c }, properties: {} } : null;
  const fc = fs => ({ type: "FeatureCollection", features: fs.filter(Boolean) });
  const f = R.fast[R.mode]?.coords;
  if (!dest || view !== "route" || R.mode === "transit") {
    ["wv-fast", "wv-mine", "wv-pois"].forEach(id => map.getSource(id).setData(fc([])));
    return;
  }
  map.getSource("wv-mine").setData(fc([line(R.mine ? R.mine.coords : f)]));
  map.getSource("wv-fast").setData(fc([R.mine ? line(f) : null]));
  map.getSource("wv-pois").setData(fc(R.pois.map(p => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { name: p.name || "" } }))));
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
  for (let i = 0; i < coords.length; i++) if (km(p, { lat: coords[i][1], lon: coords[i][0] }) <= limitKm) return true;
  return false;
}
function densify(coords, stepKm) {
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i], d = km({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] }), n = Math.ceil(d / stepKm);
    for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  return out;
}
async function personalized(O, D, mode, prefs, fast) {
  const dOD = km(O, D);
  // search box: the fastest route's bounds, padded
  const padKm = Math.min(1.5, Math.max(.3, fast.length * .15));
  const lats = fast.coords.map(c => c[1]), lons = fast.coords.map(c => c[0]);
  const dLat = padKm / 111, dLon = padKm / (111 * Math.cos(O.lat * Math.PI / 180));
  const bbox = [Math.min(...lats) - dLat, Math.min(...lons) - dLon, Math.max(...lats) + dLat, Math.max(...lons) + dLon];
  const pois = await overpass(prefs, bbox);
  if (pois.length < 2) return null;

  // pick up to 2 waypoints that sit in clusters of matching places, without a big detour
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
