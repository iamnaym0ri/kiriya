import Body, { POSES } from "./Body.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
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
    jumpiness: 0.18, // she would rather walk round than hop, and looks before she does
    restPose: "ponder",
  },
  behaviours: [
    { id: "ponder", weight: 4, pose: "ponder", expression: "thinking", seconds: [7, 14], topic: "musing" },
    { id: "grind", weight: 3, pose: "grind", expression: "focused", seconds: [8, 14], topic: "working" },
    { id: "sniff", weight: 2, pose: "sniff", expression: "sniff", seconds: [5, 9], topic: "herb" },
    { id: "notes", weight: 2, pose: "notes", expression: "writing", seconds: [7, 12], topic: "notes" },
    { id: "inspect", weight: 2, pose: "inspect", expression: "curious", seconds: [6, 11], topic: "deduction" },
    { id: "poison", weight: 1, pose: "poison", expression: "poison", seconds: [5, 9], topic: "poison" },
    { id: "herb", weight: 1, pose: "herb", expression: "herb", seconds: [4, 7], topic: "herb" },
    { id: "tea", weight: 2, pose: "tea", expression: "pleased", seconds: [7, 12], topic: "idle" },
    { id: "doze", weight: 1, pose: "sleep", expression: "sleepy", seconds: [8, 14], topic: "sleepy" },
    { id: "yawn", weight: 1, pose: "yawn", expression: "sleepy", seconds: [2, 3] },
  ],
  lines,
  visit,
  Thumb,
};
