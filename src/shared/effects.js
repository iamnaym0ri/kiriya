import confetti from "canvas-confetti";

const GLYPHS = ["✦", "♡", "✧", "⋆", "♡", "✞"];
const TONES = [
  "var(--purple-500)",
  "var(--pink-400)",
  "var(--purple-300)",
  "var(--pink-600)",
  "var(--white)",
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);

export const prefersLessMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.littleMotion === "off");

// Where a burst should come from: the tap itself, or the middle of the element for keyboard presses.
export function originOf(event) {
  if (event && event.clientX) return { x: event.clientX, y: event.clientY };
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function sparkleBurst({ x, y }, { count = 12, reach = 70 } = {}) {
  if (prefersLessMotion()) return;
  const layer = document.createElement("div");
  layer.className = "burst";
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + between(-0.3, 0.3);
    const distance = between(reach * 0.5, reach);
    const s = document.createElement("span");
    s.textContent = pick(GLYPHS);
    s.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    s.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    s.style.setProperty("--rot", `${between(-120, 120)}deg`);
    s.style.setProperty("--size", `${between(13, 22)}px`);
    s.style.setProperty("--tone", pick(TONES));
    layer.append(s);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 900);
}

let textShapes;
function shapes() {
  textShapes ??= [
    confetti.shapeFromText({ text: "♡", scalar: 2, color: "#e52f8c" }),
    confetti.shapeFromText({ text: "♡", scalar: 2, color: "#995cf7" }),
    confetti.shapeFromText({ text: "✦", scalar: 2, color: "#b589ff" }),
    confetti.shapeFromText({ text: "✞", scalar: 2, color: "#19083a" }),
    confetti.shapeFromText({ text: "🎀", scalar: 2 }),
  ];
  return textShapes;
}

export function celebrate(origin = { x: 0.5, y: 0.5 }, power = 1) {
  if (prefersLessMotion()) return;
  const shared = { origin, disableForReducedMotion: true, zIndex: 2000 };
  confetti({
    ...shared,
    particleCount: Math.round(30 * power),
    spread: 100,
    startVelocity: 34,
    gravity: 0.8,
    ticks: 260,
    scalar: 2,
    shapes: shapes(),
    flat: false,
  });
  confetti({
    ...shared,
    particleCount: Math.round(70 * power),
    spread: 130,
    startVelocity: 40,
    scalar: 0.85,
    colors: ["#7e39df", "#b589ff", "#e52f8c", "#ffa4c9", "#ffffff", "#19083a"],
  });
}
