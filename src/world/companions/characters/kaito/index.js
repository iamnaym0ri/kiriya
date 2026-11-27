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
    walkSpeed: 34, // unhurried: long gliding strides on an icy cloud, scarf streaming behind
    restPose: "icecream", // when he stops, out comes the ice cream
    restSeconds: [3, 6],
    restlessness: 0.45,
    jumpiness: 0.25,
    wander: 0.45,
    platform: "trail",
    platformWidth: 104,
    platformFx: "own", // his cloud plops in scoop by scoop and melts away (Platform.jsx)
    platformForm: 500,
    platformFade: 620,
    squash: 0.5, // his jump, land and crouch poses squash already
    heldAt: 0.66, // picked up by the back of the coat collar
    sway: 0.9,
    talkiness: 0.5,
    expressions: { tapped: "surprised", picked: "sheepish", putDown: "happy", walk: "gentle", jump: "joyful" },
  },
  behaviours: [
    { id: "eat", weight: 3, pose: "icecream", expression: "lick", seconds: [7, 12], topic: "icecream" },
    { id: "hum", weight: 3, pose: "hum", expression: "happy", seconds: [6, 10], topic: "hum" },
    { id: "sit", weight: 3, pose: "sit", expression: "gentle", seconds: [8, 14], topic: "idle" },
    { id: "muse", weight: 2, pose: "idle", expression: "thinking", seconds: [5, 9], topic: "idle" },
    { id: "treat", weight: 2, pose: "treat", expression: "blissful", seconds: [8, 12], topic: "treat", stay: true },
    { id: "snuggle", weight: 2, pose: "snuggle", expression: "shy", seconds: [5, 8], topic: "snuggle" },
    { id: "offer", weight: 1, pose: "offer", expression: "fond", seconds: [5, 8], topic: "offer" },
    { id: "brainfreeze", weight: 1, pose: "brainfreeze", expression: "brainfreeze", seconds: [2.5, 3.5], topic: "brainfreeze", say: 0.8 },
    { id: "slip", weight: 1, pose: "slip", expression: "sheepish", seconds: [2, 3], topic: "slip", say: 0.8, quiet: false },
    { id: "wave", weight: 1, pose: "wave", expression: "happy", seconds: [2.5, 4], topic: "greet" },
    { id: "nap", weight: 3, pose: "sleep", expression: "sleepy", seconds: [12, 20], topic: "sleepy", say: 0.3, hours: [22, 6] },
    { id: "doze", weight: 1, pose: "sleep", expression: "sleepy", seconds: [8, 12], topic: "sleepy", say: 0.2, hours: [13, 16] },
  ],
  lines,
  visit,
  Thumb: KaitoThumb,
};
