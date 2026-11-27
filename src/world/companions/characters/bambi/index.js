import Body, { BAMBY_POSES } from "./Body.jsx";
import { BAMBY_EXPRESSIONS } from "./Face.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { HeartIcon } from "./props.jsx";
import { lines, visit } from "./lines.js";

// Bamby (PLAVE), fan art, after his PLBBUU look and his official chibi (beret with stars, cream
// star sweater, pastel beads, star jeans, bubblegum-pink hair). The group's dancer and
// choreographer: of the five he roams the most and shows off the most. He grooves on the beat
// whenever he stops, dances, spins, sticks a finishing pose with his heart shades down, blooms
// flowers round his face (his ability), sings, does his Harley impression across the screen,
// counts beats with silly sounds, and panics at pigeons. Tap him and he dances for her, ending on
// an "ending fairy" close-up with a finger heart. His cloud is a little flower stage. Contract:
// src/world/companions/README.md.
export default {
  id: "bambi",
  name: "Bamby",
  credit: "Bamby (PLAVE) © VLAST — fan art",
  size: { width: 100, height: 118 },
  Body,
  poses: BAMBY_POSES, // the shared ten, crouch, and his own (groove, dance, spin, freeze, bloom, count, vroom, stretch, snack, heart, skygaze, cry, scared, cool, fairy, sing)
  expressions: BAMBY_EXPRESSIONS,
  Platform,
  movement: {
    walkSpeed: 54, // the quickest walker of the five
    restPose: "groove", // when he stops, he keeps bouncing on the beat
    restSeconds: [1.5, 3.5],
    restlessness: 0.8, // he roams
    jumpiness: 0.5, // sporty: changes level often
    wander: 0.75,
    platform: "trail",
    platformWidth: 92,
    platformForm: 420, // matches his own forming/fading animations (bambi.css)
    platformFade: 600,
    platformFx: "own",
    jumpHeight: 44, // a dancer's jump: a little higher than the rest
    anticipation: 200,
    landing: 360,
    squash: 0.55, // his jump/land poses squash and stretch already
    heldAt: 0.9,
    sway: 1.2,
    talkiness: 0.5,
    expressions: { tapped: "surprised", picked: "surprised", putDown: "proud", walk: "grin", jump: "grin", stay: "flirty", wander: "grin" },
  },
  // The tap menu's own choice: a dance break just for her with his stage headset on, then the
  // "ending fairy" (the close-up at the end of a music-show stage): a wink and a finger heart.
  action: {
    id: "fairy",
    label: "dance for me",
    icon: HeartIcon,
    pose: "dance",
    prop: "headset",
    expression: "grin",
    seconds: [3.6, 4],
    topic: "action",
    steps: [
      { pose: "dance", prop: "headset", expression: "grin", seconds: [3.6, 4], topic: "action", bounce: { count: 2, height: 7, every: 0.5 } },
      { pose: "spin", prop: "headset", expression: "happy", seconds: [0.9, 0.9] },
      { pose: "fairy", prop: "headset", expression: "wink", seconds: [2.6, 3], topic: "fairy" },
    ],
  },
  // Without `roam` or `level`, he can do it in place while told to stay: dancing on the spot most of
  // all (it's what he does best), grooving, counting, blooming, singing, the ending fairy…
  behaviours: [
    { id: "dance", weight: 4, pose: "dance", expression: "grin", seconds: [5, 9], topic: "dance", roam: true },
    { id: "dancehere", weight: 4, pose: "dance", expression: "grin", seconds: [4, 7], topic: "dance", bounce: { count: 2, height: 6, every: 0.5 } },
    {
      id: "routine",
      weight: 2,
      pose: "dance",
      steps: [
        { pose: "count", expression: "focused", seconds: [2, 2.5], topic: "count" },
        { pose: "dance", expression: "grin", seconds: [2.4, 3], bounce: 2 },
        { pose: "spin", expression: "happy", seconds: [0.9, 0.9] },
        { pose: "freeze", expression: "cool", seconds: [1.6, 2], topic: "showoff" },
      ],
    },
    { id: "sing", weight: 1.6, pose: "sing", expression: "sing", seconds: [4, 7], topic: "sing" },
    { id: "fairy", weight: 1, pose: "fairy", expression: "wink", seconds: [2.5, 3.5], topic: "fairy" },
    { id: "groove", weight: 3, pose: "groove", expression: "happy", seconds: [4, 7], topic: "idle" },
    { id: "spin", weight: 3, pose: "spin", expression: "happy", seconds: [2, 3], topic: "dance", say: 0.3 },
    { id: "freeze", weight: 3, pose: "freeze", expression: "cool", seconds: [2.5, 4], topic: "showoff" },
    { id: "bloom", weight: 3, pose: "bloom", expression: "sparkle", seconds: [3, 4.5], topic: "bloom" },
    { id: "count", weight: 3, pose: "count", expression: "focused", seconds: [5, 8], topic: "count" },
    { id: "cool", weight: 2, pose: "cool", expression: "cool", seconds: [3, 5], topic: "showoff" },
    {
      id: "vroom",
      weight: 2,
      pose: "groove",
      expression: "grin",
      seconds: [2, 3],
      topic: "vroom",
      roam: true,
      roamPose: "vroom",
      roamSpeed: 2.3,
      say: 0.7,
    },
    { id: "stretch", weight: 2, pose: "stretch", expression: "happy", seconds: [4, 7], topic: "exercise" },
    { id: "snack", weight: 2, pose: "snack", expression: "munch", seconds: [5, 8], topic: "food" },
    { id: "heart", weight: 2, pose: "heart", expression: "happy", seconds: [3, 5], topic: "sweet" },
    { id: "wave", weight: 1, pose: "wave", expression: "happy", seconds: [2, 3], topic: "sweet", say: 0.3 },
    { id: "games", weight: 1, pose: "cool", expression: "proud", seconds: [3, 5], topic: "games" },
    { id: "skygaze", weight: 1, pose: "skygaze", expression: "neutral", seconds: [5, 9], topic: "sky", stay: true, level: "top" },
    // "Pondering Bamby": back turned, hand on his hip, gazing at the sky, wherever he is.
    { id: "ponder", weight: 0.8, pose: "skygaze", expression: "neutral", seconds: [4, 7], topic: "sky" },
    { id: "scared", weight: 1, pose: "scared", expression: "scared", seconds: [2, 3], topic: "birds", say: 0.8 },
    { id: "sit", weight: 1, pose: "sit", expression: "neutral", seconds: [6, 10], topic: "idle" },
    { id: "nap", weight: 2, pose: "sleep", expression: "sleepy", seconds: [10, 18], topic: "sleep", hours: [23, 6], stay: true },
  ],
  lines,
  visit,
  Thumb,
};
