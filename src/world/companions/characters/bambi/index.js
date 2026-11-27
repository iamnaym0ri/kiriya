import Body, { BAMBY_POSES } from "./Body.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { lines, visit } from "./lines.js";

// Bamby (PLAVE), fan art. The group's main dancer: he roams the most of the five and shows off
// the most — grooves when he stops, dances, spins, freezes in a finishing pose with his heart
// shades down, blooms flowers (his ability), revs an imaginary motorbike, counts the beat with sound
// effects. Scared of birds. Contract: docs/refactor/RENOVATION.md, "Companions".
export default {
  id: "bambi",
  name: "Bamby",
  credit: "Bamby (PLAVE) © VLAST — fan art",
  size: { width: 100, height: 118 },
  Body,
  poses: BAMBY_POSES,
  Platform,
  movement: {
    walkSpeed: 54, // the quickest of the five: he roams
    jumpiness: 0.55, // sporty; hops between levels often
    restPose: "groove", // when he stops he keeps bouncing on the beat
    roam: 0.85, // 0..1: how much of his free time he spends on the move
    walkCycleMs: 560, // one full stride of the walk pose (two bounces)
    runPose: "vroom", // when he has far to go, he sometimes rides his imaginary motorbike
    runSpeed: 110,
    landPose: "land",
    landThen: "freeze", // sticks the landing like the end of a routine, now and then
  },
  behaviours: [
    { id: "dance", weight: 6, pose: "dance", expression: "grin", seconds: [5, 9], topic: "dance" },
    { id: "groove", weight: 4, pose: "groove", expression: "happy", seconds: [4, 8], topic: "idle" },
    { id: "spin", weight: 3, pose: "spin", expression: "happy", seconds: [2, 3], topic: "dance" },
    { id: "freeze", weight: 3, pose: "freeze", expression: "cool", seconds: [2, 4], topic: "showoff" },
    { id: "bloom", weight: 3, pose: "bloom", expression: "sparkle", seconds: [3, 5], topic: "bloom" },
    { id: "count", weight: 3, pose: "count", expression: "focused", seconds: [5, 8], topic: "count" },
    { id: "cool", weight: 2, pose: "cool", expression: "cool", seconds: [3, 5], topic: "showoff" },
    { id: "vroom", weight: 2, pose: "vroom", expression: "grin", seconds: [2, 4], topic: "vroom", moves: true },
    { id: "stretch", weight: 2, pose: "stretch", expression: "happy", seconds: [4, 7], topic: "exercise" },
    { id: "snack", weight: 2, pose: "snack", expression: "munch", seconds: [5, 8], topic: "food" },
    { id: "heart", weight: 2, pose: "heart", expression: "happy", seconds: [3, 5], topic: "sweet" },
    { id: "wave", weight: 2, pose: "wave", expression: "happy", seconds: [2, 4], topic: "greet" },
    { id: "skygaze", weight: 1, pose: "skygaze", expression: "neutral", seconds: [5, 9], topic: "sky" },
    { id: "scared", weight: 1, pose: "scared", expression: "scared", seconds: [2, 3], topic: "birds" },
    { id: "sit", weight: 1, pose: "sit", expression: "neutral", seconds: [6, 10], topic: "idle" },
    { id: "sleep", weight: 1, pose: "sleep", expression: "sleepy", seconds: [8, 14], topic: "sleep", night: true },
  ],
  lines,
  visit,
  Thumb,
};
