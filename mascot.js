// Vibi, the Wayvibe buddy: a round map pin with the brand wave on its belly.
// buddy(mood) returns inline SVG. Moods: happy, think, sad, party, sleep.
let uid = 0;

const EYES = {
  open: (dx = 0, dy = 0) => `
    <g class="v-eyes">
      <ellipse cx="37" cy="44" rx="9.5" ry="11" fill="#fff"/><ellipse cx="63" cy="44" rx="9.5" ry="11" fill="#fff"/>
      <circle cx="${38 + dx}" cy="${46 + dy}" r="5.6" fill="#1e1b4b"/><circle cx="${62 + dx}" cy="${46 + dy}" r="5.6" fill="#1e1b4b"/>
      <circle cx="${40 + dx}" cy="${43.5 + dy}" r="2" fill="#fff"/><circle cx="${64 + dx}" cy="${43.5 + dy}" r="2" fill="#fff"/>
    </g>`,
  closed: `<path d="M29 46q8 6 16 0M55 46q8 6 16 0" fill="none" stroke="#1e1b4b" stroke-width="3.2" stroke-linecap="round"/>`,
  joy: `<path d="M29 48q8-10 16 0M55 48q8-10 16 0" fill="none" stroke="#1e1b4b" stroke-width="3.6" stroke-linecap="round"/>`,
};

const MOUTH = {
  happy: `<path d="M42 62q8 8 16 0" fill="none" stroke="#1e1b4b" stroke-width="3.2" stroke-linecap="round"/>`,
  think: `<ellipse cx="55" cy="65" rx="3.4" ry="3" fill="#1e1b4b"/>`,
  sad: `<path d="M43 67q7-6 14 0" fill="none" stroke="#1e1b4b" stroke-width="3.2" stroke-linecap="round"/>`,
  party: `<path d="M40 60q10 0 20 0q0 12-10 12t-10-12z" fill="#1e1b4b"/><path d="M45 68q5-4 10 0q-2 4-5 4t-5-4z" fill="#fb7185"/>`,
  sleep: `<ellipse cx="50" cy="65" rx="3" ry="2.2" fill="#1e1b4b"/>`,
};

export function buddy(mood = "happy", cls = "") {
  const id = "vg" + (++uid);
  const eyes = mood === "party" ? EYES.joy : mood === "sleep" ? EYES.closed : EYES.open(mood === "think" ? 2 : 0, mood === "think" ? -3 : mood === "sad" ? 1.5 : 0);
  const brows = mood === "sad" ? `<path d="M30 34l11-5M70 34l-11-5" stroke="#1e1b4b" stroke-width="3" stroke-linecap="round"/>` : "";
  const arms = mood === "party"
    ? `<path d="M12 50Q4 36 8 26M88 50Q96 36 92 26" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round"/>`
    : `<path d="M11 56q-5 6-2 13M89 56q5 6 2 13" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round"/>`;
  const extra = {
    think: `<g class="v-dots" fill="#94a3b8"><circle cx="96" cy="20" r="3"/><circle cx="104" cy="11" r="4"/><circle cx="114" cy="2" r="5"/></g>`,
    sleep: `<g class="v-z" fill="#94a3b8" font-family="Plus Jakarta Sans,sans-serif" font-weight="800"><text x="88" y="22" font-size="14">z</text><text x="100" y="10" font-size="18">Z</text></g>`,
    party: `<g class="v-confetti"><rect x="-2" y="12" width="6" height="6" rx="1" fill="#f59e0b" transform="rotate(20 1 15)"/><circle cx="104" cy="16" r="3.5" fill="#22c55e"/><rect x="100" y="38" width="6" height="6" rx="1" fill="#ec4899" transform="rotate(-25 103 41)"/><circle cx="-4" cy="40" r="3" fill="#3b82f6"/><path d="M50 -6l3 6-3 6-3-6z" fill="#f59e0b"/></g>`,
    sad: `<path class="v-tear" d="M72 56q3 5 0 8q-3-3 0-8z" fill="#7dd3fc"/>`,
  }[mood] || "";
  return `<svg class="vibi v-${mood} ${cls}" viewBox="-10 -10 130 124" role="img" aria-label="Vibi">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
    <ellipse cx="50" cy="106" rx="24" ry="4.5" fill="#0f172a" opacity=".13"/>
    <g class="v-body">
      <ellipse cx="38" cy="99" rx="8" ry="5" fill="#5b21b6"/><ellipse cx="62" cy="99" rx="8" ry="5" fill="#5b21b6"/>
      ${arms}
      <path d="M50 4C76 4 92 23 92 47c0 25-19 42-42 51C27 89 8 72 8 47 8 23 24 4 50 4z" fill="url(#${id})"/>
      <path d="M30 16q20-12 40 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="25" cy="58" rx="6" ry="4" fill="#fda4af" opacity=".75"/><ellipse cx="75" cy="58" rx="6" ry="4" fill="#fda4af" opacity=".75"/>
      ${brows}${eyes}${MOUTH[mood] || MOUTH.happy}
      <path d="M37 79c2.4 6 4 8 5 8 1.6 0 2.8-5 5-5s3.4 5 5 5c1 0 2.6-2 5-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    </g>
    ${extra}
  </svg>`;
}

// Tapping Vibi makes it hop: a small, friendly response that signals it is alive, never required to use the app
document.addEventListener("click", e => {
  const v = e.target.closest?.(".vibi");
  if (!v) return;
  v.classList.remove("hop"); void v.getBoundingClientRect(); v.classList.add("hop");
  navigator.vibrate?.(15);
});

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
