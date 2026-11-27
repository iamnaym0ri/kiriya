// Dev-only test character for the companion engine and its lab (never shown in the app: folders
// starting with "_" are skipped outside dev). It exercises every engine option a real character
// might use, so the five real characters can copy the shape.
import { BlobBody, BlobPlatform, BlobThumb } from "./Blob.jsx";

export default {
  id: "_placeholder",
  name: "Blob",
  credit: "test character",
  size: { width: 80, height: 96 },
  Body: BlobBody,
  poses: ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held"],
  Platform: BlobPlatform,
  movement: {
    walkSpeed: 46,
    jumpiness: 0.45,
    restlessness: 0.6,
    restPose: "idle",
    expressions: { tapped: "surprised", picked: "surprised", putDown: "happy" },
  },
  behaviours: [
    { id: "idle", weight: 3, pose: "idle", seconds: [4, 8], topic: "idle" },
    { id: "sit", weight: 3, pose: "sit", expression: "happy", seconds: [6, 12], topic: "idle" },
    { id: "bop", weight: 1, pose: "idle", roam: true, roamSpeed: 1.3, seconds: [2, 4] },
    { id: "nap", weight: 1, pose: "sleep", seconds: [6, 10], say: 0 },
  ],
  lines: {
    greet: ["hello hello!", { text: "oh, {name}! hi!", expression: "happy" }],
    greetMorning: ["good morning, {name}"],
    greetNight: [{ text: "you're up late…", expression: "sleepy" }],
    idle: ["la la la", "what a nice day", { text: "hmm…", expression: "sleepy" }, "this cloud is very comfy"],
    tapped: [{ text: "boop!", expression: "surprised" }, "hehe, that tickles", "yes?"],
    pester: ["okay okay, I'm awake!"],
    picked: [{ text: "whoa, up we go!", expression: "surprised" }, "wheee"],
    putDown: [{ text: "safe landing ✿", expression: "happy" }, "thank you"],
    sweet: ["you're doing great today"],
    birthday: ["happy birthday!!"],
    visit: ["knock knock!"],
    bye: ["see you soon!"],
  },
  visit: {
    with: {
      "_maomao-legacy": [
        ["hi Maomao! what are you making?", "Nothing you should eat. Probably."],
        [{ text: "can I help sort the herbs?", expression: "happy" }, "If you can tell them apart. Most people can't."],
      ],
    },
  },
  Thumb: BlobThumb,
};
