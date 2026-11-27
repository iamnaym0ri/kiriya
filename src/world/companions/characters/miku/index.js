import Body, { MIKU_POSES } from "./Body.jsx";
import { MIKU_EXPRESSIONS } from "./Face.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { lines, visit } from "./lines.js";

// Hatsune Miku in her classic look: one of the five companions on her home screen
// (docs/refactor/RENOVATION.md, "Companions"). Original hand-drawn fan art and original dialogue;
// research notes and references stay in the agent's lab, never in the app.
//
// Her way of moving: a light, bouncy walk that hops between levels more readily than the others,
// and when she stops she sits on the edge of her cloud and swings her legs, humming. Her cloud is a
// slim mint-white ledge with a teal melody line that pops in puff by puff and drifts off as notes.
export default {
  id: "miku",
  name: "Hatsune Miku",
  credit:
    "Hatsune Miku © Crypton Future Media, INC. www.piapro.net — fan art under the Piapro Character License",
  creditLink: "https://piapro.jp/license/pcl/summary",
  size: { width: 110, height: 120 },
  Body,
  poses: MIKU_POSES, // idle walk jump fall land sit wave react sleep held + sing swish leek point dance
  expressions: MIKU_EXPRESSIONS,
  Platform,
  movement: {
    walkSpeed: 44,
    jumpiness: 0.45,
    restPose: "sit",
    // A sitting Miku's legs hang below the feet line, over the cloud's front edge.
    seatedPoses: ["sit", "sleep"],
  },
  behaviours: [
    { id: "swing", weight: 5, pose: "sit", expression: "happy", seconds: [8, 16], topic: "idle" },
    { id: "hum", weight: 4, pose: "sit", expression: "hum", seconds: [6, 12], topic: "humming" },
    { id: "sing", weight: 3, pose: "sing", expression: "sing", seconds: [4, 8], topic: "singing" },
    { id: "dance", weight: 2, pose: "dance", expression: "joy", seconds: [3, 6], topic: "dance" },
    { id: "swish", weight: 2, pose: "swish", expression: "wink", seconds: [1.5, 3], topic: "swish" },
    { id: "daydream", weight: 2, pose: "sit", expression: "thinking", seconds: [6, 10], topic: "musing" },
    { id: "leek", weight: 1.5, pose: "leek", expression: "joy", seconds: [2.5, 4], topic: "leek" },
    { id: "star", weight: 1.5, pose: "point", expression: "proud", seconds: [2, 3.5], topic: "star" },
    { id: "wave", weight: 1, pose: "wave", expression: "joy", seconds: [2, 3], topic: "hello" },
    { id: "nap", weight: 1, pose: "sleep", expression: "asleep", seconds: [10, 20], topic: "sleepy", hours: [22, 7] },
  ],
  lines,
  visit,
  // Days of her own, "MM-DD" → a topic in `lines` (an engine that knows about days can use them).
  days: { "08-31": "mikuBirthday", "03-09": "mikuDay" },
  // Seasonal topics by month (1-12), likewise optional for the engine.
  seasons: { winter: [12, 1, 2], spring: [3, 4] },
  Thumb,
};
