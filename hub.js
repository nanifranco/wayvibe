// Wayvibe hub: the student guide (before you come / in Korea), useful places nearby and help.
// It works on its own, so the guide still opens if the map can't load (no WebGL, blocked CDN).
// The map lives in app.js; we talk to it only through window events:
//   wv-tab {tab}           tells the map it is now visible
//   wv-show-place {place}  open a place on the map
//   wv-setlang {lang}      language picked here; wv-lang {lang} comes back when picked on the map
import { LANGS } from "./i18n.js";
import { buddy, celebrate } from "./mascot.js";
import { VERSION } from "./splash.js";

const store = {
  get(k, d) { try { const v = localStorage.getItem("wv-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("wv-" + k, JSON.stringify(v)); } catch {} },
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- Language ----------
const browser = (navigator.language || "es").slice(0, 2);
let lang = LANGS[store.get("lang")] ? store.get("lang") : LANGS[browser] ? browser : "es";
const G = {}; // loaded guides by language
async function loadGuide(l) {
  if (G[l]) return G[l];
  try { G[l] = (await import(`./guide/${l}.js`)).default; } catch { if (l !== "en") return loadGuide("en"); throw new Error("guide unavailable"); }
  return G[l];
}
let g = await loadGuide(lang);
if (lang !== "en") loadGuide("en").catch(() => {}); // fallback for any missing string
const t = (k, vars = {}) => String(g.ui[k] ?? G.en?.ui[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");

async function setLang(l, fromMap = false) {
  if (!LANGS[l]) return;
  lang = l; store.set("lang", l);
  g = await loadGuide(l);
  document.documentElement.lang = l;
  $("#hubLang").value = l; $("#hubLangCode").textContent = l.toUpperCase();
  if (!fromMap) dispatchEvent(new CustomEvent("wv-setlang", { detail: l }));
  render();
}
addEventListener("wv-lang", e => setLang(e.detail, true));

// ---------- Icons ----------
const S = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  guide: S(`<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7M9 12h5"/>`),
  places: S(`<path d="M12 21s-7-7.2-7-12a7 7 0 0 1 14 0c0 4.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>`),
  map: S(`<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"/>`),
  help: S(`<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.6M12 17.5v.01"/>`),
  check: S(`<path d="M5 12.5 10 17 19 7"/>`),
  link: S(`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`),
  plane: S(`<path d="M2.5 13.5 21 6l-2.2 3.2-9 4.4L8 19l-2-1 1-4.2Z"/>`),
  home: S(`<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/>`),
  phone: S(`<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>`),
  locate: S(`<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`),
  search: S(`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  heart: S(`<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>`),
  heartOn: S(`<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="currentColor"/>`),
  clock: S(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
  speaker: S(`<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>`),
  bulb: S(`<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>`),
  user: S(`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`),
  conv: S(`<path d="M4 9 5.5 4h13L20 9M4 9h16v11H4ZM9 20v-6h6v6M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/>`),
  mart: S(`<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>`),
  daiso: S(`<path d="M3 8 12 3l9 5v8l-9 5-9-5ZM3 8l9 5 9-5M12 13v8"/>`),
  food: S(`<path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8a2 2 0 0 1-2 2M17 22V2c-2 1.5-3 4-3 7s1 4 3 4"/>`),
  cafe: S(`<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>`),
  pharmacy: S(`<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>`),
  clinic: S(`<path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z"/><path d="M12 10v5M9.5 12.5h5"/>`),
  bank: S(`<path d="M3 9 12 4l9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>`),
  laundry: S(`<rect x="4" y="2.5" width="16" height="19" rx="3"/><circle cx="12" cy="13" r="4.5"/><path d="M7.5 6h.01M10.5 6h.01"/>`),
  sights: S(`<path d="M3 8h3l2-3h8l2 3h3v11H3Z"/><circle cx="12" cy="13" r="3.5"/>`),
  trash: S(`<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>`),
  card: S(`<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>`),
  bus: S(`<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3"/>`),
};
const LIFE_ICONS = ["trash", "clinic", "bus", "card"];

// ---------- The steps (content lives in guide/<lang>.js) ----------
const L = {
  study: "https://www.studyinkorea.go.kr", visa: "https://www.visa.go.kr", mofa: "https://overseas.mofa.go.kr",
  hikorea: "https://www.hikorea.go.kr", nhis: "https://www.nhis.or.kr/english/",
};
const PHASES = {
  before: [["admission", ["study"]], ["visa", ["visa", "mofa"]], ["papers", ["study"]], ["housing"], ["insurance", ["nhis"]], ["money"], ["packing"], ["apps"], ["trip"]],
  arrive: [["entry"], ["phone"], ["tmoney"], ["school"], ["arc", ["hikorea"]], ["bank"], ["nhis", ["nhis"]], ["address", ["hikorea"]], ["work", ["hikorea"]], ["extend", ["hikorea"]]],
};
const linkLabel = { study: "l_study", visa: "l_visa", mofa: "l_mofa", hikorea: "l_hikorea", nhis: "l_nhis" };

let profile = store.get("profile", {}) || {};
let done = store.get("done", {}) || {};
let tab = ["guide", "places", "map", "help"].includes(store.get("tab")) ? store.get("tab") : "guide";
let phase = store.get("phase") || (profile.where === "here" ? "arrive" : "before");
let open = null; // the step whose details are shown; by default the next one to do

const hub = $("#hub"), main = $("#hubMain"), tabbar = $("#tabbar");

function render() {
  tabbar.innerHTML = ["guide", "places", "map", "help"].map(k => `<button type="button" class="tab" data-tab="${k}" aria-current="${tab === k ? "page" : "false"}">${I[k]}<span>${t("tab_" + k)}</span></button>`).join("");
  tabbar.querySelectorAll(".tab").forEach(b => b.onclick = () => go(b.dataset.tab));
  document.body.classList.toggle("tab-map", tab === "map");
  hub.hidden = tab === "map";
  if (tab === "guide") renderGuide();
  else if (tab === "places") renderPlaces();
  else if (tab === "help") renderHelp();
}
function go(k) {
  if (k === tab) { if (k !== "map") main.scrollTo({ top: 0, behavior: "smooth" }); return; }
  tab = k; store.set("tab", k);
  render();
  if (k !== "map") main.scrollTop = 0;
  dispatchEvent(new CustomEvent("wv-tab", { detail: k }));
}

// ---------- Guide ----------
const studyName = () => profile.study === "d2" ? t("studyD2") : profile.study === "d4" ? t("studyD4") : t("studyUnsure");
function renderGuide() {
  const asking = !profile.where ? "where" : !profile.study ? "study" : null;
  let html = `<section class="hero-card">
      <div class="hero-buddy">${buddy(asking ? "wave" : "happy", "big")}</div>
      <div><h1 class="h1">${t("hello")}</h1><p class="lead">${t("helloSub")}</p></div>
    </section>`;
  if (asking === "where") {
    html += `<section class="g-ask" aria-labelledby="qWhere"><h2 class="h2" id="qWhere">${t("qWhere")}</h2>
      <div class="choices"><button class="choice" type="button" data-where="before">${I.plane}<b>${t("whereBefore")}</b></button>
      <button class="choice" type="button" data-where="here">${I.home}<b>${t("whereHere")}</b></button></div></section>`;
  } else if (asking === "study") {
    html += `<section class="g-ask" aria-labelledby="qStudy"><h2 class="h2" id="qStudy">${t("qStudy")}</h2>
      <div class="choices three"><button class="choice" type="button" data-study="d2"><b>${t("studyD2")}</b><small>${t("studyD2Sub")}</small></button>
      <button class="choice" type="button" data-study="d4"><b>${t("studyD4")}</b><small>${t("studyD4Sub")}</small></button>
      <button class="choice" type="button" data-study="unsure"><b>${t("studyUnsure")}</b></button></div></section>`;
  } else {
    html += `<div class="profile">${I.user}<span>${esc(t("profile", { where: profile.where === "here" ? t("whereHere") : t("whereBefore"), study: studyName() }))}</span><button class="g-link" type="button" id="changeProfile">${t("change")}</button></div>`;
  }
  if (!asking) html += renderPhase();
  main.innerHTML = html;
  main.querySelectorAll("[data-where]").forEach(b => b.onclick = () => {
    profile.where = b.dataset.where; store.set("profile", profile);
    phase = profile.where === "here" ? "arrive" : "before"; store.set("phase", phase); open = null; renderGuide();
  });
  main.querySelectorAll("[data-study]").forEach(b => b.onclick = () => { profile.study = b.dataset.study; store.set("profile", profile); renderGuide(); });
  $("#changeProfile")?.addEventListener("click", () => { profile = {}; store.set("profile", profile); renderGuide(); });
  main.querySelectorAll("[data-phase]").forEach(b => b.onclick = () => { phase = b.dataset.phase; store.set("phase", phase); open = null; renderGuide(); });
  main.querySelectorAll(".step-head").forEach(b => b.onclick = () => {
    open = open === b.dataset.id ? "" : b.dataset.id; renderGuide();
    const el = main.querySelector(`.step-head[data-id="${b.dataset.id}"]`);
    if (el && el.getBoundingClientRect().top < main.getBoundingClientRect().top) el.scrollIntoView({ block: "start" });
  });
  main.querySelectorAll("[data-done]").forEach(b => b.onclick = () => toggleDone(b.dataset.done));
}
function count(p) { const ids = PHASES[p].map(s => s[0]); return { n: ids.filter(id => done[id]).length, m: ids.length }; }
function renderPhase() {
  const steps = PHASES[phase], c = count(phase);
  const nextId = steps.find(([id]) => !done[id])?.[0];
  const shown = open === null ? nextId : open;
  const segs = ["before", "arrive"].map(p => { const k = count(p); return `<button class="seg" type="button" role="tab" data-phase="${p}" aria-selected="${phase === p}">${p === "before" ? I.plane : I.home}<span>${t("phase_" + p)}</span><small>${k.n}/${k.m}</small></button>`; }).join("");
  const list = steps.map(([id, links = []], i) => {
    const s = g.steps[id] || G.en?.steps[id]; if (!s) return "";
    const isDone = !!done[id], isOpen = shown === id;
    const notes = profile.study === "d2" ? [s.d2] : profile.study === "d4" ? [s.d4] : [s.d2, s.d4];
    const forYou = notes.filter(Boolean);
    return `<li class="g-step${isDone ? " done" : ""}${id === nextId ? " next" : ""}">
      <button class="step-head" type="button" data-id="${id}" aria-expanded="${isOpen}">
        <span class="num" aria-hidden="true">${isDone ? I.check : i + 1}</span>
        <span class="step-tx"><b>${esc(s.t)}</b>${id === nextId && !isOpen ? `<small class="nextlbl">${t("next")}</small>` : ""}</span>
        <svg class="g-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      ${isOpen ? `<div class="step-body">
        <p>${esc(s.s)}</p>
        ${forYou.length ? `<div class="g-note"><b>${t("forYou")}</b>${forYou.map(n => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
        ${s.need?.length ? `<h3 class="h3">${t("need")}</h3><ul class="need">${s.need.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        ${s.tip ? `<div class="tipbox">${I.bulb}<p><b>${t("tip")}:</b> ${esc(s.tip)}</p></div>` : ""}
        ${links.length ? `<div class="links">${links.map(k => `<a class="olink" href="${L[k]}" target="_blank" rel="noopener">${I.link}<span><small>${t("official")}</small>${esc(t(linkLabel[k]))}</span></a>`).join("")}</div>` : ""}
        <button class="btn ${isDone ? "" : "go"} wide" type="button" data-done="${id}" aria-pressed="${isDone}">${isDone ? `${I.check}${t("isDone")} · ${t("undo")}` : `${I.check}${t("markDone")}`}</button>
      </div>` : ""}
    </li>`;
  }).join("");
  const pct = Math.round(c.n / c.m * 100);
  return `<div class="segs" role="tablist">${segs}</div>
    <div class="progress"><div class="g-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${c.m}" aria-valuenow="${c.n}" aria-label="${esc(t("progress", c))}"><i style="width:${pct}%"></i></div><span>${t("progress", c)}</span></div>
    ${c.n === c.m ? `<div class="alldone">${buddy("happy")}<p>${t("allDone")}</p></div>` : ""}
    <ol class="g-steps">${list}</ol>
    <p class="disclaimer">${t("disclaimer")}</p>`;
}
function toggleDone(id) {
  done[id] = !done[id]; if (!done[id]) delete done[id];
  store.set("done", done);
  if (done[id]) { navigator.vibrate?.(15); open = null; }
  const c = count(phase);
  if (done[id] && c.n === c.m) celebrate();
  renderGuide();
  if (done[id]) main.querySelector(".g-step.next")?.scrollIntoView({ block: "start", behavior: "smooth" }); // carry on with the next one
}

// ---------- Places: real places from OpenStreetMap around you or a chosen area ----------
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const PCATS = {
  conv: { color: "#0ea5e9", r: 800, q: 'nwr["shop"="convenience"]' },
  mart: { color: "#16a34a", r: 1500, q: 'nwr["shop"="supermarket"]' },
  daiso: { color: "#e11d48", r: 3000, q: 'nwr["name"~"다이소|Daiso",i]["shop"]' },
  food: { color: "#ea580c", r: 800, q: 'nwr["amenity"~"^(restaurant|fast_food|food_court)$"]["name"]' },
  cafe: { color: "#92400e", r: 800, q: 'nwr["amenity"="cafe"]["name"]' },
  pharmacy: { color: "#059669", r: 1500, q: 'nwr["amenity"="pharmacy"]' },
  clinic: { color: "#dc2626", r: 1500, q: 'nwr["amenity"~"^(clinic|doctors|hospital)$"]["name"]' },
  bank: { color: "#475569", r: 1500, q: 'nwr["amenity"="bank"]["name"]' },
  phone: { color: "#7c3aed", r: 1500, q: 'nwr["shop"="mobile_phone"]' },
  laundry: { color: "#0891b2", r: 1500, q: 'nwr["shop"~"^(laundry|dry_cleaning)$"]' },
  sights: { color: "#6d5dfc", r: 6000, q: 'nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"]["wikidata"];nwr["historic"]["wikidata"]["name"]' },
};
const inKorea = p => p && p.lat > 33 && p.lat < 38.7 && p.lon > 124.5 && p.lon < 132;
function km(a, b) {
  const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const fmtDist = k => k < 1 ? `${Math.max(10, Math.round(k * 100) * 10)} m` : `${k.toFixed(k < 10 ? 1 : 0)} km`;
async function getJSON(urls, { body, timeout = 15000 } = {}) {
  let last;
  for (const u of [].concat(urls)) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(u, body ? { method: "POST", body, signal: ctl.signal } : { signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { last = e; } finally { clearTimeout(timer); }
  }
  throw last;
}
const P = { area: store.get("area", null), useMe: store.get("areaMe", !store.get("area", null)), me: null, loc: "idle", cat: store.get("pcat", "conv"), items: [], busy: false, error: false, key: "", sugs: null };
function locate() {
  if (!("geolocation" in navigator)) { P.loc = "denied"; return renderPlaces(); }
  P.loc = "locating"; renderPlaces();
  navigator.geolocation.getCurrentPosition(p => {
    P.me = { lat: p.coords.latitude, lon: p.coords.longitude };
    P.loc = inKorea(P.me) ? "on" : "outside";
    renderPlaces(); fetchPlaces();
  }, () => { P.loc = "denied"; renderPlaces(); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
}
const base = () => P.useMe ? (P.loc === "on" ? P.me : null) : P.area;
function renderPlaces() {
  const at = base();
  const cats = Object.entries(PCATS).map(([k, c]) => `<button class="pcat" type="button" data-pc="${k}" aria-pressed="${P.cat === k}" style="--c:${c.color}">${I[k]}<span>${t("pc_" + k)}</span></button>`).join("");
  let status = "";
  if (P.useMe && P.loc === "locating") status = `<div class="pstate">${buddy("think")}<p>${t("locating")}</p></div>`;
  else if (P.useMe && P.loc === "denied") status = `<div class="pstate">${buddy("sad")}<p>${t("locDenied")}</p></div>`;
  else if (P.useMe && P.loc === "outside") status = `<div class="pstate">${buddy("think")}<p>${t("outsideKorea")}</p></div>`;
  else if (!at) status = `<div class="pstate">${buddy("happy")}<p>${t(P.useMe ? "noArea" : "areaHint")}</p></div>`;
  else if (P.busy) status = `<div class="pstate">${buddy("think")}<p>${t("loading")}</p></div>`;
  else if (P.error) status = `<div class="pstate">${buddy("sad")}<p>${t("error")}</p><button class="btn" type="button" id="pRetry">${t("retry")}</button></div>`;
  else if (!P.items.length && P.key) status = `<div class="pstate">${buddy("think")}<p>${t("none")}</p></div>`;
  const saved = savedList();
  const list = at && !P.busy && !P.error ? P.items.map((p, i) => {
    const on = saved.some(s => km(s, p) < .03);
    return `<li class="place">
      <div class="place-tx"><b>${esc(p.name)}</b>${p.ko && p.ko !== p.name ? `<span class="ko" lang="ko">${esc(p.ko)}</span>` : ""}
        <span class="g-meta">${esc(t("away", { d: fmtDist(km(at, p)) }))}${p.hours ? ` · ${I.clock}<span>${esc(p.hours)}</span>` : ""}</span></div>
      <div class="place-act"><button class="btn small" type="button" data-show="${i}">${I.map}${t("showMap")}</button>
      <button class="btn small save" type="button" data-save="${i}" aria-pressed="${on}" aria-label="${esc((on ? t("saved") : t("save")) + ": " + p.name)}">${on ? I.heartOn : I.heart}</button></div>
    </li>`;
  }).join("") : "";
  main.innerHTML = `<h1 class="h1 pad">${t("placesTitle")}</h1><p class="lead pad">${t("placesSub")}</p>
    <div class="near"><span class="near-l">${t("near")}</span>
      <div class="segs small" role="radiogroup">
        <button class="seg" type="button" role="radio" id="nearMe" aria-checked="${P.useMe}">${I.locate}<span>${t("nearMe")}</span></button>
        <button class="seg" type="button" role="radio" id="nearPick" aria-checked="${!P.useMe}">${I.search}<span>${P.area && !P.useMe ? esc(P.area.name) : t("nearPick")}</span></button>
      </div>
      ${!P.useMe ? `<div class="areabox"><input id="areaQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(t("areaPlaceholder"))}" aria-label="${esc(t("areaPlaceholder"))}" value="">
        ${P.sugs ? `<div class="areasugs" role="listbox">${P.sugs.length ? P.sugs.map((s, i) => `<button type="button" role="option" data-a="${i}"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></button>`).join("") : `<p>${t("searchNone")}</p>`}</div>` : ""}</div>` : ""}
    </div>
    <div class="pcats">${cats}</div>
    <p class="pdesc" style="--c:${PCATS[P.cat].color}">${I[P.cat]}<span>${t("pd_" + P.cat)}</span></p>
    ${status}<ul class="g-places">${list}</ul>`;
  main.querySelectorAll("[data-pc]").forEach(b => b.onclick = () => { P.cat = b.dataset.pc; store.set("pcat", P.cat); fetchPlaces(); });
  $("#nearMe").onclick = () => { P.useMe = true; store.set("areaMe", true); P.sugs = null; if (P.loc !== "on") locate(); else fetchPlaces(); };
  $("#nearPick").onclick = () => { P.useMe = false; store.set("areaMe", false); renderPlaces(); $("#areaQ")?.focus(); if (P.area) fetchPlaces(); };
  $("#pRetry")?.addEventListener("click", () => { P.key = ""; fetchPlaces(); });
  const aq = $("#areaQ");
  if (aq) {
    aq.value = P.areaText || "";
    aq.oninput = () => { P.areaText = aq.value; clearTimeout(P.deb); P.deb = setTimeout(() => searchArea(aq.value), 350); };
    aq.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); searchArea(aq.value, true); } };
  }
  main.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const s = P.sugs[+b.dataset.a];
    P.area = { name: s.name, lat: s.lat, lon: s.lon }; store.set("area", P.area); P.sugs = null; P.areaText = ""; fetchPlaces();
  });
  main.querySelectorAll("[data-show]").forEach(b => b.onclick = () => showOnMap(P.items[+b.dataset.show]));
  main.querySelectorAll("[data-save]").forEach(b => b.onclick = () => { toggleSave(P.items[+b.dataset.save]); renderPlaces(); });
}
async function searchArea(q, now = false) {
  q = q.trim();
  if (q.length < 2) { P.sugs = null; return renderPlaces(); }
  const keep = () => { const a = $("#areaQ"); if (a) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); } };
  try {
    const pl = ["en", "fr", "de"].includes(lang) ? lang : "default";
    const j = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=${pl}&bbox=124.5,33,132,38.7`, { timeout: 8000 });
    let res = (j.features || []).map(f => { const p = f.properties, [lon, lat] = f.geometry.coordinates; return { name: p.name || p.street || p.city, sub: [p.district, p.city, p.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", "), lat, lon }; }).filter(s => s.name && inKorea(s));
    if (!res.length) {
      const n = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&limit=6&accept-language=${lang}&q=${encodeURIComponent(q)}`, { timeout: 8000 }).catch(() => []);
      res = n.map(r => ({ name: r.name || r.display_name.split(",")[0], sub: r.display_name.split(",").slice(1, 3).join(",").trim(), lat: +r.lat, lon: +r.lon })).filter(inKorea);
    }
    if ($("#areaQ")?.value.trim() !== q && !now) return; // typed on meanwhile
    P.sugs = res;
  } catch { P.sugs = []; }
  renderPlaces(); keep();
}
async function fetchPlaces() {
  const at = base();
  if (!at) return renderPlaces();
  const cat = P.cat, key = `${cat}|${at.lat.toFixed(4)}|${at.lon.toFixed(4)}|${lang}`;
  if (key === P.key && !P.error) return renderPlaces();
  P.key = key; P.busy = true; P.error = false; P.items = []; renderPlaces();
  try {
    const run = async r => {
      const around = `(around:${r},${at.lat},${at.lon})`;
      const parts = PCATS[cat].q.split(";").map(s => s + around + ";").join("");
      const j = await getJSON(OVERPASS, { body: "data=" + encodeURIComponent(`[out:json][timeout:20];(${parts});out center tags 120;`), timeout: 22000 });
      return j.elements || [];
    };
    let els = await run(PCATS[cat].r);
    if (els.length < 3) els = await run(PCATS[cat].r * 2.5); // few results: look a bit further
    if (P.key !== key) return;
    const seen = new Set();
    P.items = els.map(e => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags || {}, osm: e.type[0].toUpperCase() + e.id }))
      .filter(p => p.lat != null)
      .map(p => ({ ...p, name: p.tags[`name:${lang}`] || (lang !== "ko" && p.tags["name:en"]) || p.tags.name || p.tags.brand || t("pc_" + cat), ko: p.tags["name:ko"] || p.tags.name, hours: p.tags.opening_hours === "24/7" ? "24 h" : p.tags.opening_hours, sub: p.tags["addr:street"] || "" }))
      .filter(p => { const k = p.name + Math.round(p.lat * 2000) + Math.round(p.lon * 2000); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => km(at, a) - km(at, b)).slice(0, 30);
  } catch { if (P.key === key) P.error = true; }
  if (P.key !== key) return;
  P.busy = false;
  if (tab === "places") renderPlaces();
}
function savedList() { const s = store.get("saved", []); return Array.isArray(s) ? s.filter(p => p && isFinite(p.lat) && isFinite(p.lon)) : []; }
function toggleSave(p) {
  let list = savedList();
  if (list.some(s => km(s, p) < .03)) list = list.filter(s => km(s, p) >= .03);
  else { list.unshift({ name: p.name, sub: p.sub || "", lat: p.lat, lon: p.lon, osm: p.osm || null, at: Date.now() }); navigator.vibrate?.(20); }
  store.set("saved", list.slice(0, 300));
}
function showOnMap(p) {
  if (!p) return;
  go("map");
  dispatchEvent(new CustomEvent("wv-show-place", { detail: { name: p.name, sub: p.ko !== p.name ? p.ko : p.sub, lat: p.lat, lon: p.lon, tags: p.tags, osm: p.osm } }));
}

// ---------- Help ----------
function renderHelp() {
  const nums = [["112", "n112"], ["119", "n119"], ["1345", "n1345"], ["1330", "n1330"]];
  const sayKo = txt => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = "ko-KR"; u.rate = .85; speechSynthesis.speak(u); } catch {} };
  main.innerHTML = `<h1 class="h1 pad">${t("helpTitle")}</h1>
    <h2 class="h2 pad">${t("emergency")}</h2>
    <div class="nums">${nums.map(([n, k]) => `<a class="num-card${n.length === 3 ? " sos" : ""}" href="tel:${n}" aria-label="${esc(t("call", { n }) + ": " + t(k))}"><b>${n}</b><span>${t(k)}</span>${I.phone}</a>`).join("")}</div>
    <h2 class="h2 pad">${t("lifeTitle")}</h2>
    <div class="life">${(g.life || []).map((x, i) => `<div class="life-card">${I[LIFE_ICONS[i]] || I.bulb}<div><b>${esc(x.t)}</b><p>${esc(x.s)}</p></div></div>`).join("")}</div>
    ${lang !== "ko" ? `<h2 class="h2 pad">${t("phrasesTitle")}</h2>
    <div class="phrases">${(g.phrases || []).map((p, i) => `<button class="phrase" type="button" data-ph="${i}" aria-label="${esc(p.m + " — " + t("tapToHear"))}"><span><b lang="ko">${esc(p.ko)}</b><small>${esc(p.ro)}</small></span><span class="pm">${esc(p.m)}</span>${I.speaker}</button>`).join("")}</div>` : ""}
    <h2 class="h2 pad">${t("linksTitle")}</h2>
    <div class="links">${["hikorea", "study", "visa", "mofa", "nhis"].map(k => `<a class="olink" href="${L[k]}" target="_blank" rel="noopener">${I.link}<span>${esc(t(linkLabel[k]))}</span></a>`).join("")}</div>
    <p class="disclaimer">${t("disclaimer")}</p>
    <p class="ver">Wayvibe · ${t("version")} ${VERSION} · © OpenStreetMap</p>`;
  main.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => sayKo(g.phrases[+b.dataset.ph].ko));
}

// ---------- Header ----------
const sel = $("#hubLang");
sel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
sel.value = lang; $("#hubLangCode").textContent = lang.toUpperCase();
sel.onchange = () => setLang(sel.value);
$("#hubBrand").onclick = () => go("guide");

// a trip in progress (opened less than 3 h ago) goes straight back to the map
const trip = store.get("trip");
if (trip?.dest && Date.now() - trip.at < 3 * 3600e3) tab = "map";
render();
dispatchEvent(new CustomEvent("wv-tab", { detail: tab }));
window.wvHub = { get tab() { return tab; }, go };
// entering the places tab fetches what's needed
addEventListener("wv-tab", e => {
  if (e.detail !== "places") return;
  if (P.useMe && P.loc === "idle") locate(); else if (base()) fetchPlaces();
});
if (tab === "places") dispatchEvent(new CustomEvent("wv-tab", { detail: "places" }));
