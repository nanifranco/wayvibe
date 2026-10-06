// Opening greeting: Vibi drops onto the map like a pin, pings its location and waves hello.
// It never blocks the app: it leaves when the map is ready (at least ~2 s so it reads), on tap, or after 4.5 s at most.
import { buddy } from "./mascot.js";
export const VERSION = "2026.10.06-8"; // tap the W logo to see it

const el = document.getElementById("splash");
if (el) {
  // only Vibi and the name: nothing to read, just a hello
  el.innerHTML = `<div class="splash-route" aria-hidden="true"></div>
    <div class="splash-in">
      <div class="splash-buddy"><span class="splash-ping" aria-hidden="true"></span>${buddy("wave", "big")}</div>
      <h1 class="splash-name">Wayvibe</h1>
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
