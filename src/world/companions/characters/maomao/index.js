import Body, { POSES } from "./Body.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { VialIcon } from "./props.jsx";
import { lines, visit } from "./lines.js";

// Maomao, from The Apothecary Diaries: the house chibi the other four are drawn to match.
// Research, references and what was checked: .lab/research.md in this agent's worktree (local
// only), docs/redesign/MAOMAO-CHARACTER-RESEARCH.md (voice and expressions).
export default {
  id: "maomao",
  name: "Maomao",
  credit:
    "Maomao from The Apothecary Diaries (© Natsu Hyuuga / Shufunotomo / Square Enix): original fan art drawn for this site",
  size: { width: 100, height: 118 },
  Body,
  poses: POSES,
  Platform,
  movement: {
    walkSpeed: 30, // small, unhurried steps under a long skirt
    restPose: "ponder", // she stands and thinks, hand at her chin
    restSeconds: [3, 6],
    restlessness: 0.4,
    jumpiness: 0.18, // she'd rather walk round than hop, and looks before she does
    wander: 0.4,
    platform: "trail",
    platformFx: "own", // Platform.css: puffs pop in, sprigs sprout, the lantern lowers
    platformForm: 320,
    platformFade: 480,
    jumpHeight: 30,
    anticipation: 230,
    landing: 340,
    squash: 0.6, // her crouch, jump and land poses squash a little themselves
    heldAt: 0.42, // the scruff, just behind her collar
    sway: 0.8,
    talkiness: 0.45,
    expressions: { tapped: "startled", picked: "unimpressed", putDown: "deadpan", walk: "deadpan", jump: "focused", stay: "pleased", wander: "curious" },
  },
  behaviours: [
    { id: "ponder", weight: 4, pose: "ponder", expression: "thinking", seconds: [7, 14], topic: "musing" },
    { id: "grind", weight: 3, pose: "grind", expression: "focused", seconds: [8, 14], topic: "working" },
    { id: "sniff", weight: 2, pose: "sniff", expression: "sniff", seconds: [5, 9], topic: "herb" },
    { id: "notes", weight: 2, pose: "notes", expression: "writing", seconds: [7, 12], topic: "notes" },
    { id: "inspect", weight: 2, pose: "inspect", expression: "curious", seconds: [6, 11], topic: "deduction" },
    { id: "poison", weight: 1, pose: "poison", expression: "poison", seconds: [5, 9], topic: "poison" },
    { id: "herb", weight: 1, pose: "herb", expression: "herb", seconds: [4, 7], topic: "herb", quiet: false },
    { id: "tea", weight: 2, pose: "tea", expression: "pleased", seconds: [7, 12], topic: "idle", stay: true },
    { id: "nap", weight: 1, pose: "sleep", expression: "sleepy", seconds: [8, 14], topic: "sleepy", say: 0.3 },
    { id: "night", weight: 6, pose: "sleep", expression: "sleepy", seconds: [20, 40], topic: "sleepy", say: 0.2, hours: [23, 6], stay: true },
    { id: "yawn", weight: 1, pose: "yawn", expression: "sleepy", seconds: [2, 3], say: 0 },
    { id: "sit", weight: 1, pose: "sit", expression: "fond", seconds: [8, 14], topic: "sunbeam" },
    // Round 2, all in place (what she does when told to stay, too): counting her coins and coming
    // up one short, a cat's stretch and a yawn, herbs shaken out to dry, and the look she gives
    // anything pointlessly pretty.
    {
      id: "coins",
      weight: 2,
      steps: [
        { pose: "coins", expression: "skeptical", seconds: [3, 4], topic: "coins" },
        { pose: "coins", expression: "focused", seconds: [2.5, 3.5] },
        { pose: "ponder", expression: "smug", seconds: [1.6, 2.2] },
      ],
    },
    {
      id: "stretch",
      weight: 1,
      steps: [
        { pose: "stretch", expression: "amused", seconds: [2.4, 3], topic: "stretch", bounce: { count: 1, height: 5, every: 0.5 } },
        { pose: "yawn", expression: "sleepy", seconds: [1.6, 2.2] },
      ],
    },
    { id: "bundle", weight: 2, pose: "bundle", expression: "pleased", seconds: [5, 8], topic: "drying" },
    {
      id: "slug",
      weight: 1,
      say: 0.6,
      steps: [
        { pose: "idle", expression: "ew", seconds: [1.3, 1.6], turn: true, topic: "slugLook" },
        { pose: "idle", expression: "deadpan", seconds: [0.7, 0.9], turn: true },
        { pose: "grind", expression: "focused", seconds: [4, 7] },
      ],
    },
  ],
  // The tap menu's own choice: a curious vial. She holds it to the light, sniffs it, then hugs it
  // like treasure (her most famous face).
  action: {
    id: "vial",
    label: "show her a vial",
    icon: VialIcon,
    pose: "appraise",
    prop: "vial",
    expression: "curious",
    topic: "action",
    steps: [
      { pose: "appraise", expression: "curious", seconds: [2, 2.4] },
      { pose: "sniff", expression: "sniff", seconds: [1.5, 1.8] },
      { pose: "poison", expression: "poison", seconds: [2.6, 3.2], topic: "actionAfter", bounce: { count: 2, height: 5, every: 0.42 } },
    ],
  },
  lines,
  visit,
  Thumb,
};
