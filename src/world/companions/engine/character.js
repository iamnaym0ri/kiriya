// Fills in everything a character file may leave out, so the engine can rely on one shape
// (src/world/companions/README.md documents every field). Pure data: no React, no DOM.
import DefaultPlatform from "./DefaultPlatform.jsx";

/** The poses every character draws (docs/refactor/RENOVATION.md, "Companions"). */
export const SHARED_POSES = ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held"];

/** What the engine shows when a character has no drawing for a pose, nearest first. */
const POSE_FALLBACK = {
  held: ["fall", "jump", "react"],
  fall: ["jump"],
  crouch: ["land"],
  land: [],
  wave: ["react"],
  react: [],
  sleep: ["sit"],
  sit: [],
  walk: [],
  jump: [],
};

export const MOVEMENT_DEFAULTS = {
  walkSpeed: 38, // px per second at scale 1
  walkPose: "walk", // the pose while it travels along a level
  jumpiness: 0.3, // 0..1: when it moves, how often it changes level instead of walking
  restlessness: 0.5, // 0..1: how often it moves somewhere before its next behaviour
  wander: 0.5, // 0..1: the longest walk, as a share of the screen's width
  restPose: "idle", // the pose it settles into between things
  restSeconds: [2, 5], // how long it settles before choosing what to do next
  platform: "trail", // "trail": clouds form ahead and fade behind; "ride": one cloud carries it
  hop: null, // change level by jumping (default: true for "trail", false for "ride", which floats)
  floatSeconds: 1.3, // "ride" without hop: how long floating to another level takes
  bob: null, // px of gentle up-and-down while riding (default: 2 for "ride", 0 for "trail")
  platformWidth: null, // px at scale 1 (default: the body's width)
  platformForm: 260, // ms a new cloud stays "forming" before it is "steady"
  platformFade: 520, // ms a cloud stays "fading" before it is removed
  platformFx: "engine", // "engine": the engine puffs clouds in and out; "own": the Platform does it
  jumpHeight: 34, // px the arc rises above the higher of the two levels, at scale 1
  maxJumpX: 150, // px: the widest a single jump goes sideways, at scale 1
  gravity: 2400, // px/s², at scale 1
  anticipation: 190, // ms crouching before a jump
  landing: 300, // ms in the "land" pose after touching down
  squash: 1, // 0..1.5: how much the engine squashes and stretches the body on jumps and landings
  flip: true, // mirror the body to face where it walks (art drawn facing right, or front-on)
  turnMs: 200, // how long turning around takes
  heldAt: 0.9, // where it is held when picked up, as a share of its height from the feet (the scruff)
  sway: 1, // 0..2: how much it swings while carried
  talkiness: 0.45, // 0..1: chance it says something as it starts a behaviour
  expressions: {}, // expressions for engine moments: { tapped, picked, putDown, walk, jump, visit }
};

const BEHAVIOUR_DEFAULTS = {
  weight: 1,
  seconds: [5, 10],
  roam: false,
  stay: false,
  quiet: true,
};

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

/** A line is a string or { text, expression, pose }: always hand back the object. */
export function normaliseLine(line) {
  if (line == null) return null;
  if (typeof line === "string") return line.trim() ? { text: line } : null;
  if (typeof line === "object" && typeof line.text === "string" && line.text.trim()) return line;
  return null;
}

function normaliseLines(lines = {}) {
  const out = {};
  for (const [topic, list] of Object.entries(lines ?? {})) {
    const clean = asArray(list).map(normaliseLine).filter(Boolean);
    if (clean.length) out[topic] = clean;
  }
  return out;
}

function normaliseVisit(visit = {}) {
  const withMap = {};
  for (const [other, talks] of Object.entries(visit?.with ?? {})) {
    // A single pair may be written without the outer list: ["hi", "hello"].
    const list = Array.isArray(talks) && talks.length && !Array.isArray(talks[0]) ? [talks] : asArray(talks);
    const clean = list
      .map((talk) => asArray(talk).map(normaliseLine).filter(Boolean))
      .filter((talk) => talk.length);
    if (clean.length) withMap[other] = clean;
  }
  const any = asArray(visit?.any)
    .map((talk) => asArray(talk).map(normaliseLine).filter(Boolean))
    .filter((talk) => talk.length);
  return { with: withMap, any };
}

/** Takes a character module's default export and returns it with every engine field filled. */
export function normaliseCharacter(raw) {
  if (!raw || !raw.Body) return null;
  const size = {
    width: Number(raw.size?.width) || 96,
    height: Number(raw.size?.height) || 128,
  };
  const movement = { ...MOVEMENT_DEFAULTS, ...(raw.movement ?? {}) };
  movement.expressions = { ...(raw.movement?.expressions ?? {}) };
  if (movement.hop == null) movement.hop = movement.platform !== "ride";
  if (movement.bob == null) movement.bob = movement.platform === "ride" ? 2 : 0;
  if (!movement.platformWidth) movement.platformWidth = size.width;
  const poses = new Set([...(raw.poses ?? SHARED_POSES), "idle"]);

  const resolvePose = (wanted) => {
    if (!wanted) return poses.has(movement.restPose) ? movement.restPose : "idle";
    if (poses.has(wanted)) return wanted;
    for (const next of POSE_FALLBACK[wanted] ?? []) if (poses.has(next)) return next;
    return poses.has(movement.restPose) ? movement.restPose : "idle";
  };

  const behaviours = asArray(raw.behaviours)
    .filter((b) => b && (b.id || b.pose))
    .map((b, index) => {
      const merged = { ...BEHAVIOUR_DEFAULTS, ...b };
      merged.id = b.id ?? `${b.pose}-${index}`;
      merged.pose = b.pose ?? movement.restPose;
      merged.seconds = Array.isArray(b.seconds) ? b.seconds : [Number(b.seconds) || 6, Number(b.seconds) || 6];
      merged.say = b.say ?? movement.talkiness;
      return merged;
    });
  if (!behaviours.length) {
    behaviours.push({ ...BEHAVIOUR_DEFAULTS, id: "rest", pose: movement.restPose, seconds: [6, 12], topic: "idle", say: movement.talkiness });
  }

  return {
    ...raw,
    name: raw.name ?? raw.id,
    size,
    poses: [...poses],
    movement,
    behaviours,
    lines: normaliseLines(raw.lines),
    visit: normaliseVisit(raw.visit),
    Platform: raw.Platform ?? DefaultPlatform,
    platformSurface: Number(raw.Platform?.surface) || 0,
    resolvePose,
  };
}
