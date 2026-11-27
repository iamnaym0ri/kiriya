// The capsules tumbling in the machine's glass dome: a tiny position-based (Verlet) solver for a
// dozen balls inside a circle. Written for this game: a full engine (matter-js) would be ~80 KB for
// what fits in a page of code. Pure, so it is tested in scripts/test-games-luck.mjs.
import { mulberry32 } from "../_kit/random.js";

export const DOME_COLOURS = ["lilac", "pink", "mint", "butter", "lilac", "pink", "mint", "butter", "berry", "gold"];
const GRAVITY = 1400; // px/s² in dome units
const DAMPING = 0.975;
const ITERATIONS = 4;

/**
 * A dome of `count` capsules, radius `ballRadius`, inside a circle of radius `radius` centred on
 * (0, 0). The balls start in a loose heap at the bottom so the first frame already looks settled.
 */
export function createDome({ radius = 104, ballRadius = 20, count = 15, seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const balls = [];
  for (let i = 0; i < count; i++) {
    const ring = Math.floor(i / 5);
    const slot = i % 5;
    const x = (slot - 2) * ballRadius * 1.9 + (rng() - 0.5) * 6;
    const y = radius - ballRadius - ring * ballRadius * 1.7 - 8;
    balls.push({ id: i, x, y, px: x, py: y, r: ballRadius, angle: rng() * 360, colour: DOME_COLOURS[i % DOME_COLOURS.length] });
  }
  const dome = { radius, balls, nextId: count, rng, calm: 0 };
  for (let i = 0; i < 90; i++) stepDome(dome, 1 / 60);
  for (const ball of dome.balls) {
    ball.px = ball.x;
    ball.py = ball.y;
  }
  dome.calm = 0;
  return dome;
}

function constrain(dome) {
  const { balls, radius } = dome;
  for (let n = 0; n < ITERATIONS; n++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.001;
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
      const d = Math.hypot(a.x, a.y);
      const max = radius - a.r;
      if (d > max) {
        a.x = (a.x / d) * max;
        a.y = (a.y / d) * max;
      }
    }
  }
}

/** Advances the dome by `dt` seconds. Returns how much moved, so the caller can rest when it's calm. */
export function stepDome(dome, dt) {
  let motion = 0;
  for (const ball of dome.balls) {
    const vx = (ball.x - ball.px) * DAMPING;
    const vy = (ball.y - ball.py) * DAMPING;
    ball.px = ball.x;
    ball.py = ball.y;
    ball.x += vx;
    ball.y += vy + GRAVITY * dt * dt;
  }
  constrain(dome);
  for (const ball of dome.balls) {
    const dx = ball.x - ball.px;
    const dy = ball.y - ball.py;
    motion += Math.abs(dx) + Math.abs(dy);
    ball.angle = (ball.angle + (dx / ball.r) * 57.3) % 360;
  }
  dome.calm = motion < 0.05 * dome.balls.length ? dome.calm + 1 : 0;
  return motion;
}

/** The crank turning: the heap is swept around and lifted a little, like a real machine's paddle. */
export function stirDome(dome, strength = 1) {
  const { rng } = dome;
  for (const ball of dome.balls) {
    const d = Math.hypot(ball.x, ball.y) || 1;
    const tx = -ball.y / d;
    const ty = ball.x / d;
    // The paddle sweeps the heap sideways and bumps the bottom of it up; the top barely moves.
    const low = Math.max(0, ball.y / dome.radius);
    const kick = strength * (0.8 + rng() * 1.2) * (0.4 + low);
    ball.px -= tx * kick;
    ball.py -= ty * kick - strength * low * (2 + rng() * 2.5);
  }
  dome.calm = 0;
}

/** Takes out the capsule nearest the exit at the bottom of the dome; returns it. */
export function takeCapsule(dome) {
  if (!dome.balls.length) return null;
  let best = 0;
  for (let i = 1; i < dome.balls.length; i++) {
    if (dome.balls[i].y > dome.balls[best].y) best = i;
  }
  const [ball] = dome.balls.splice(best, 1);
  dome.calm = 0;
  return ball;
}

/** Drops a fresh capsule in from the top, so the dome stays full. */
export function addCapsule(dome, colour) {
  const r = dome.balls[0]?.r ?? 20;
  const x = (dome.rng() - 0.5) * 30;
  const y = -dome.radius + r + 4;
  const ball = { id: dome.nextId++, x, y, px: x, py: y - 2, r, angle: dome.rng() * 360, colour: colour ?? DOME_COLOURS[dome.nextId % DOME_COLOURS.length] };
  dome.balls.push(ball);
  dome.calm = 0;
  return ball;
}
