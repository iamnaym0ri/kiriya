import { prefersLessMotion } from "../../../../../shared/effects.js";

// A little burst of lilac confetti inside the game's own canvas (the hub's sheet sits above the
// page, so the site-wide confetti layer would land behind it). canvas-confetti, ISC licence.
const fires = new WeakMap();
export async function burst(canvas, { x = 0.5, y = 0.6, power = 1 } = {}) {
  if (!canvas || prefersLessMotion()) return;
  const { default: confetti } = await import("canvas-confetti");
  if (!fires.has(canvas)) fires.set(canvas, confetti.create(canvas, { resize: true, useWorker: false }));
  const fire = fires.get(canvas);
  fire({
    origin: { x, y },
    particleCount: Math.round(70 * power),
    spread: 110,
    startVelocity: 34,
    gravity: 0.9,
    scalar: 0.9,
    ticks: 220,
    colors: ["#9a6cc8", "#c9b1ee", "#f6a9c7", "#e58bb7", "#fff4e3", "#a9dcc8"],
    disableForReducedMotion: true,
  });
}
