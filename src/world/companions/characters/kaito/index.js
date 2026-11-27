import Body, { KaitoThumb, POSES } from "./Body.jsx";
import Platform from "./Platform.jsx";
import { lines, visit } from "./lines.js";

// KAITO (Crypton Future Media's VOCALOID), as a companion on her home screen. Contract:
// docs/refactor/RENOVATION.md "Companions". Research: .lab/research.md (not committed).
export default {
  id: "kaito",
  name: "KAITO",
  credit:
    "KAITO © Crypton Future Media, INC. www.piapro.net — original fan art under the Piapro Character License (piapro.jp/license/pcl/summary)",
  size: { width: 100, height: 118 },
  Body,
  poses: POSES,
  // His cloud is made of ice-cream scoops; his boots sink a little into the soft-serve.
  Platform,
  movement: {
    walkSpeed: 34, // unhurried
    jumpiness: 0.25,
    restPose: "icecream", // when he stops, out comes the ice cream
    // Extras for the engine, if it supports them (see src/world/companions/README.md):
    style: "glide", // long sliding strides on an icy cloud, scarf streaming behind
    strideMs: 760, // one full walk cycle in Body's CSS
    slipChance: 0.12, // after a walk or a landing, now and then he skids ("slip" pose, "slip" lines)
    oneShot: { land: 620, react: 560, slip: 1500, jump: 420 }, // ms the one-off poses take
  },
  behaviours: [
    { id: "eat", weight: 3, pose: "icecream", expression: "lick", seconds: [7, 12], topic: "icecream" },
    { id: "hum", weight: 3, pose: "hum", expression: "happy", seconds: [6, 10], topic: "hum" },
    { id: "sit", weight: 3, pose: "sit", expression: "gentle", seconds: [8, 14], topic: "idle" },
    { id: "muse", weight: 2, pose: "idle", expression: "thinking", seconds: [5, 9], topic: "idle" },
    { id: "treat", weight: 2, pose: "treat", expression: "blissful", seconds: [8, 12], topic: "treat" },
    { id: "snuggle", weight: 2, pose: "snuggle", expression: "shy", seconds: [5, 8], topic: "snuggle" },
    { id: "offer", weight: 1, pose: "offer", expression: "fond", seconds: [5, 8], topic: "offer" },
    { id: "brainfreeze", weight: 1, pose: "brainfreeze", expression: "brainfreeze", seconds: [2.5, 3.5], topic: "brainfreeze" },
    { id: "slip", weight: 1, pose: "slip", expression: "sheepish", seconds: [2, 3], topic: "slip" },
    { id: "wave", weight: 1, pose: "wave", expression: "happy", seconds: [2.5, 4], topic: "greet" },
    { id: "nap", weight: 1, pose: "sleep", expression: "sleepy", seconds: [10, 18], topic: "sleepy" },
  ],
  lines,
  visit,
  Thumb: KaitoThumb,
};
