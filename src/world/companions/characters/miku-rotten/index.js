import Body, { POSE_NAMES, SIZE } from "./Body.jsx";
import { EXPRESSIONS } from "./Face.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { lines, visit } from "./lines.js";

// Miku as the fangirl of SAWTOWNE's "Confessions of a Rotten Girl" (2025): grass-green twin tails
// with curled tips, crimson cross clips, big round glasses that spiral when she's flustered, a
// school uniform and a secret sketchbook. She ships everything (sweetly), confesses tiny sins,
// doodles on her cloud and sits on it swinging her legs. Contract: docs/refactor/RENOVATION.md,
// "Companions".
export default {
  id: "miku-rotten",
  name: "Miku",
  credit:
    "Miku as in “Confessions of a Rotten Girl” (SAWTOWNE, 2025), original fan art. Hatsune Miku © Crypton Future Media, INC. www.piapro.net, under the Piapro Character License (piapro.net/intl/en_character.html).",
  size: SIZE,
  Body,
  poses: POSE_NAMES,
  expressions: EXPRESSIONS,
  Platform,
  movement: {
    walkSpeed: 34, // small quick steps
    jumpiness: 0.35, // a little hop-happy when excited
    restPose: "sketch", // sits on her cloud, legs swinging, drawing
    sitPose: "sit",
  },
  behaviours: [
    { id: "sketch", weight: 5, pose: "sketch", expression: "focused", seconds: [9, 16], topic: "sketching" },
    { id: "swing", weight: 3, pose: "sit", expression: "happy", seconds: [7, 12], topic: "idle" },
    { id: "show", weight: 2, pose: "show", expression: "sparkle", seconds: [4, 7], topic: "shipping" },
    { id: "daydream", weight: 2, pose: "sit", expression: "dreamy", seconds: [6, 10], topic: "daydream" },
    { id: "confess", weight: 1.5, pose: "pray", expression: "pray", seconds: [4, 7], topic: "confess" },
    { id: "giggle", weight: 1.5, pose: "giggle", expression: "giggle", seconds: [3, 5], topic: "giggle" },
    { id: "peek", weight: 1.2, pose: "peek", expression: "shy", seconds: [4, 7], topic: "peeking" },
    { id: "theory", weight: 1, pose: "glint", expression: "smug", seconds: [3, 5], topic: "theory" },
    { id: "fluster", weight: 0.8, pose: "fluster", expression: "flustered", seconds: [3, 5], topic: "fluster" },
    { id: "cheer", weight: 0.8, pose: "cheer", expression: "sparkle", seconds: [3, 6], topic: "cheer" },
    { id: "resist", weight: 0.6, pose: "nope", expression: "flustered", seconds: [2, 4], topic: "resist" },
    { id: "nap", weight: 0.6, pose: "sleep", expression: "sleepy", seconds: [10, 18], topic: "sleepy" },
  ],
  lines,
  visit,
  Thumb,
};
