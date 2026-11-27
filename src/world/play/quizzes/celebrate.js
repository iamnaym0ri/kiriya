import { celebrate, prefersLessMotion, sparkleBurst } from "../../../shared/effects.js";
import { haptic } from "../../../lib/native.js";

// The little celebration when an answer is revealed: confetti and sparkles for a right guess or
// being in sync, a soft puff of hearts otherwise. Reduce Motion: only the haptic.

const centre = (element) => {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

export function revealCelebration(result, element, { power = 1 } = {}) {
  const happy = result === "right" || result === "match";
  haptic(happy ? "success" : "light");
  if (prefersLessMotion()) return;
  const point = centre(element);
  if (happy) {
    celebrate({ x: point.x / window.innerWidth, y: Math.max(0.2, point.y / window.innerHeight - 0.05) }, power);
    sparkleBurst(point, { count: 14, reach: 90 });
  } else {
    sparkleBurst(point, { count: 7, reach: 50 });
  }
}

/** How long the "checking…" pause lasts before the reveal (none with Reduce Motion). */
export const DRUMROLL_MS = () => (prefersLessMotion() ? 0 : 750);
