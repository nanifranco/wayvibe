// Vibi, the Wayvibe buddy: a chubby little map pin with a sprout on its head, standing on a folded paper map.
// The dashed route on the map under it changes with its mood (ends in a flag, or breaks with an X when sad).
// buddy(mood) returns inline SVG. Moods: happy, wave, think, sad, party, sleep.
let uid = 0;

// Kawaii proportions: a chubby round pin, big glossy eyes set low, rosy cheeks, a tiny mouth and a little sprout on top.
const INK = "#2e1d63";
const EYES = {
  open: (dx = 0, dy = 0) => `
    <g class="v-eyes">
      <ellipse cx="${36 + dx}" cy="${56 + dy}" rx="8" ry="9.5" fill="${INK}"/><ellipse cx="${64 + dx}" cy="${56 + dy}" rx="8" ry="9.5" fill="${INK}"/>
      <circle cx="${33.5 + dx}" cy="${52.5 + dy}" r="3.2" fill="#fff"/><circle cx="${61.5 + dx}" cy="${52.5 + dy}" r="3.2" fill="#fff"/>
      <circle cx="${38.5 + dx}" cy="${59.5 + dy}" r="1.5" fill="#fff" opacity=".9"/><circle cx="${66.5 + dx}" cy="${59.5 + dy}" r="1.5" fill="#fff" opacity=".9"/>
    </g>`,
  closed: `<path d="M28 57q8 6 16 0M56 57q8 6 16 0" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`,
  joy: `<path d="M28 59q8-10 16 0M56 59q8-10 16 0" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/>`,
};

const MOUTH = {
  happy: `<path d="M44.5 67q2.75 3.2 5.5 0q2.75 3.2 5.5 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  think: `<ellipse cx="53" cy="69" rx="2.6" ry="2.3" fill="${INK}"/>`,
  sad: `<path d="M45 71q5-4.5 10 0" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`,
  party: `<path d="M43 66h14q0 9-7 9t-7-9z" fill="${INK}"/><path d="M46.5 72.5q3.5-3 7 0q-1.5 2.5-3.5 2.5t-3.5-2.5z" fill="#fb7185"/>`,
  sleep: `<ellipse cx="50" cy="69" rx="2.4" ry="1.8" fill="${INK}"/>`,
};

export function buddy(mood = "happy", cls = "") {
  const id = "vg" + (++uid);
  const eyes = mood === "party" ? EYES.joy : mood === "sleep" ? EYES.closed : EYES.open(mood === "think" ? 2 : 0, mood === "think" ? -3 : mood === "sad" ? 1 : 0);
  const brows = mood === "sad" ? `<path d="M29 43l10-4M71 43l-10-4" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` : "";
  const arm = d => `<path d="${d}" fill="none" stroke="url(#${id})" stroke-width="8" stroke-linecap="round"/>`;
  const arms = mood === "wave"
    ? arm("M10 64q-5 5-3 11") + `<g class="v-wave">${arm("M89 60q8-7 9-18")}</g>`
    : mood === "think"
    ? arm("M10 64q-5 5-3 11M89 62q4 2 4 4")
    : mood === "party"
    ? arm("M12 58Q4 44 8 34M88 58Q96 44 92 34")
    : arm("M10 64q-5 5-3 11M90 64q5 5 3 11");
  const extra = {
    think: `<g class="v-dots" fill="#a5b4fc"><circle cx="90" cy="18" r="3"/><circle cx="98" cy="9" r="4"/><circle cx="108" cy="0" r="5"/></g>`,
    sleep: `<g class="v-z" fill="#a5b4fc" font-family="Fredoka,sans-serif" font-weight="600"><text x="88" y="24" font-size="14">z</text><text x="100" y="12" font-size="18">Z</text></g>`,
    party: `<g class="v-confetti"><rect x="-2" y="16" width="6" height="6" rx="1" fill="#fbbf24" transform="rotate(20 1 19)"/><circle cx="104" cy="20" r="3.5" fill="#4ade80"/><rect x="100" y="42" width="6" height="6" rx="1" fill="#f472b6" transform="rotate(-25 103 45)"/><circle cx="-4" cy="44" r="3" fill="#60a5fa"/><path d="M76 -2l3 6-3 6-3-6z" fill="#fbbf24"/></g>`,
    sad: `<path class="v-tear" d="M73 64q3 5 0 8q-3-3 0-8z" fill="#7dd3fc"/>`,
  }[mood] || "";
  const routeEnd = mood === "sad"
    ? `<path d="M88 106l6 6M94 106l-6 6" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round"/>`
    : `<path d="M91 113v-11" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M91 102l8 2.5-8 2.5z" fill="${mood === "party" ? "#22c55e" : "#f59e0b"}"/>`;
  const tool = mood === "think" // a magnifying glass, reading the map
    ? `<g class="v-lens"><path d="M98 72l7 7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="93" cy="66" r="8" fill="#e0f2fe" fill-opacity=".7" stroke="${INK}" stroke-width="3"/></g>`
    : "";
  return `<svg class="vibi v-${mood} ${cls}" viewBox="-10 -14 130 148" role="img" aria-label="Vibi">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#7cc4fa"/><stop offset=".55" stop-color="#8b9cf8"/><stop offset="1" stop-color="#b48cf6"/></linearGradient>
      <radialGradient id="${id}s" cx=".35" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="v-map">
      <path d="M2 104l32-5 2 25-36 4z" fill="#dbeafe"/><path d="M34 99l32 5 2 25-32-5z" fill="#bbf7d0"/><path d="M66 104l34-5 2 25-34 5z" fill="#dbeafe"/>
      <path d="M34 99l2 25M66 104l2 25" stroke="#0f172a" stroke-opacity=".12" stroke-width="2"/>
      <path d="M2 104l32-5 32 5 34-5 2 25-34 5-32-5-36 4z" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8 122c10-10 20 2 30-6s14-4 12-6M52 112c10 4 18-6 28-2s8 3 9 3" fill="none" stroke="#f59e0b" stroke-width="2.6" stroke-dasharray="4 3" stroke-linecap="round"/>
      ${routeEnd}
      <ellipse cx="50" cy="110" rx="10" ry="2.8" fill="#0f172a" opacity=".16"/>
    </g>
    <g class="v-body">
      ${arms}
      <g class="v-sprout"><path d="M50 12q-1-8 3-12" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round"/><path d="M53 1q9-7 15-2q-6 8-15 2z" fill="#4ade80"/><path d="M52 3q-8-6-13-1q5 6 13 1z" fill="#86efac"/></g>
      <path d="M50 11C78 11 94 29 94 52c0 18-12 31-25 41l-19 15-19-15C18 83 6 70 6 52 6 29 22 11 50 11z" fill="url(#${id})"/>
      <path d="M50 11C78 11 94 29 94 52c0 18-12 31-25 41l-19 15-19-15C18 83 6 70 6 52 6 29 22 11 50 11z" fill="url(#${id}s)"/>
      <ellipse cx="34" cy="24" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 34 24)"/>
      <ellipse cx="23" cy="68" rx="7.5" ry="4.8" fill="#f9a8d4" opacity=".85"/><ellipse cx="77" cy="68" rx="7.5" ry="4.8" fill="#f9a8d4" opacity=".85"/>
      ${brows}${eyes}${MOUTH[mood] || MOUTH.happy}
      <path d="M42.5 82c1.8 4.5 3 6 3.8 6 1.2 0 2.1-3.8 3.7-3.8s2.5 3.8 3.7 3.8c.8 0 2-1.5 3.8-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
      ${tool}
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
