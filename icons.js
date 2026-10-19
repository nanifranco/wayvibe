// Small status icons for messages (thinking, nothing found, offline, done…) and the arrival confetti.
// statusIcon(kind) returns inline SVG. Kinds: happy, wave, think, sad, party, sleep.
const PATHS = {
  happy: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>`,
  wave: `<path d="M12 21s-7-7.2-7-12a7 7 0 0 1 14 0c0 4.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>`,
  think: `<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>`,
  sad: `<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>`,
  party: `<path d="M5 12.5 10 17 19 7"/>`,
  sleep: `<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18"/>`,
};
export function statusIcon(kind = "happy", cls = "") {
  return `<span class="sticon s-${kind} ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${PATHS[kind] || PATHS.happy}</svg></span>`;
}

// Confetti burst on arrival
export function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti"; box.setAttribute("aria-hidden", "true");
  const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#ec4899", "#06b6d4"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--dx:${(Math.random() - .5) * 160}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .35}s;animation-duration:${1.8 + Math.random() * 1.2}s;${i % 3 ? "" : "border-radius:50%;"}`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}
