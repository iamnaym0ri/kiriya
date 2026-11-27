// How one pose flows into the next (README.md, "Transitions"). Pure data: no DOM, so the tests can
// load it. The engine cross-fades every change of pose, expression or prop (ghost.js draws it); this
// says how long each blend takes and how the body settles its weight as it happens.
//
// Timing suits the move: a reaction or a jump changes in a blink, a step of a routine in a beat, and
// coming to rest (or sitting down) is the softest. Quiet mode and reduced motion get a short plain
// fade and no squash: simpler, never a snap.

/** Blend lengths in ms. */
export const BLEND_MS = {
  quick: 90, // react, crouch, take-off, the top of a jump, landing, being picked up
  walk: 120, // setting off
  stop: 160, // coming to a stop
  step: 150, // a behaviour or a step of a routine starting
  settle: 200, // easing into its rest pose, sitting down, lying down
  face: 150, // a new expression or prop on the same pose
  quiet: 130, // quiet mode / reduced motion: everything, as a plain short fade
};

/** Poses that happen at the speed of a reflex. */
const QUICK = new Set(["react", "crouch", "jump", "fall", "land", "held"]);
/** Poses that lower the body onto the cloud (the weight drops as it changes). */
export const SEATED = new Set(["sit", "sleep"]);

/**
 * How long the change from pose `from` to pose `to` blends, in ms.
 * `restPose` is the character's; `walkPose` its travelling pose; `lively` false in quiet mode.
 */
export function blendMs(from, to, { restPose = "idle", walkPose = "walk", lively = true } = {}) {
  if (!lively) return BLEND_MS.quiet;
  if (from === to) return BLEND_MS.face;
  if (QUICK.has(to)) return BLEND_MS.quick;
  if (to === walkPose) return BLEND_MS.walk;
  if (from === walkPose) return BLEND_MS.stop;
  if (to === restPose || to === "idle" || SEATED.has(to) || from === "land") return BLEND_MS.settle;
  return BLEND_MS.step;
}

/**
 * The little shift of weight that goes with a change of pose, as a push on the engine's squash
 * spring (a velocity, so it eases in rather than jumping): `[x, y]` in scale per second, or null.
 * Sitting or lying down sinks a little; getting up stretches; anything else in place is a breath.
 */
export function settleKick(from, to, { restPose = "idle", walkPose = "walk", squash = 1 } = {}) {
  if (from === to || !squash) return null;
  // Travelling, jumping and landing have their own squash and stretch.
  if (QUICK.has(to) || QUICK.has(from) || to === walkPose || from === walkPose) return null;
  const k = Math.min(1.2, squash);
  if (SEATED.has(to) && !SEATED.has(from)) return [0.9 * k, -1.2 * k]; // sits: settles down and out
  if (SEATED.has(from) && !SEATED.has(to)) return [-0.6 * k, 0.9 * k]; // gets up: a small stretch
  if (to === restPose) return [0.35 * k, -0.45 * k]; // breathes out into its rest pose
  return [0.45 * k, -0.6 * k];
}
