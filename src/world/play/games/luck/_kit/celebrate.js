// Little celebrations: a burst of lilac confetti (canvas-confetti, ISC) drawn on the game's own
// canvas, so it stays inside the sheet. Nothing at all with reduced motion.
const COLOURS = ["#b589ff", "#f96cab", "#ffd166", "#cfb4ff", "#ffffff", "#9fd8c9"];
let shapes = null;

export async function celebrate(canvas, { x = 0.5, y = 0.45, count = 70, spread = 80, big = false } = {}) {
  if (!canvas || document.documentElement.dataset.littleMotion === "off") return;
  const { default: confetti } = await import("canvas-confetti");
  canvas.__confetti ??= confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
  shapes ??= [
    "circle",
    confetti.shapeFromPath({ path: "M12 21C5 15 1 11.5 1 7.2 1 4 3.4 1.6 6.5 1.6c2.2 0 4 1.2 5.5 3 1.5-1.8 3.3-3 5.5-3C20.6 1.6 23 4 23 7.2 23 11.5 19 15 12 21z" }),
    confetti.shapeFromPath({ path: "M12 0l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" }),
  ];
  const fire = (extra) => canvas.__confetti({
    particleCount: count, spread, startVelocity: big ? 38 : 28, gravity: 0.9, ticks: 160, scalar: 0.9,
    colors: COLOURS, shapes, origin: { x, y }, ...extra,
  });
  fire();
  if (big) setTimeout(() => fire({ particleCount: Math.round(count / 2), angle: 60, origin: { x: 0, y: 0.7 } }), 160);
  if (big) setTimeout(() => fire({ particleCount: Math.round(count / 2), angle: 120, origin: { x: 1, y: 0.7 } }), 260);
}
