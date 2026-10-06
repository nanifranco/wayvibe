// Opening greeting: Vibi drops onto the map like a pin, pings its location and waves hello.
// It never blocks the app: it leaves when the map is ready (at least ~2 s so it reads), on tap, or after 4.5 s at most.
import { buddy } from "./mascot.js";
import { T, LANGS } from "./i18n.js";
export const VERSION = "2026.10.06-7"; // shown on the greeting so you can tell which version you have

const el = document.getElementById("splash");
if (el) {
  let lang = "es";
  try { const saved = JSON.parse(localStorage.getItem("wv-lang")); lang = LANGS[saved] ? saved : LANGS[(navigator.language || "es").slice(0, 2)] ? (navigator.language || "es").slice(0, 2) : "es"; } catch {}
  const tr = k => T[lang]?.[k] ?? T.es[k];
  const h = new Date().getHours();
  const hello = tr(h >= 5 && h < 12 ? "gm" : h >= 12 && h < 19 ? "ga" : "gn");
  el.innerHTML = `<div class="splash-route" aria-hidden="true"></div>
    <div class="splash-in">
      <div class="splash-buddy"><span class="splash-ping" aria-hidden="true"></span>${buddy("wave", "big")}</div>
      <h1>${hello}</h1>
      <p>${tr("splashSub")}</p>
      <small>${tr("tapToSkip")}</small>
      <span class="splash-ver">v${VERSION}</span>
    </div>`;
  el.setAttribute("role", "status");
  el.removeAttribute("aria-hidden");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let minDone = false, ready = false, gone = false;
  const close = () => {
    if (gone) return; gone = true;
    el.classList.add("out");
    setTimeout(() => el.remove(), 450);
  };
  const maybe = () => { if (minDone && ready) close(); };
  setTimeout(() => { minDone = true; maybe(); }, calm ? 1200 : 2300);
  addEventListener("wv-ready", () => { ready = true; maybe(); }, { once: true });
  setTimeout(close, 4500);
  el.addEventListener("click", close);
  addEventListener("keydown", e => { if (e.key === "Escape" || e.key === "Enter") close(); }, { once: true });
}
