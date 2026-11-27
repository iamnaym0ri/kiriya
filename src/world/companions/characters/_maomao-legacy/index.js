// Dev-only: today's Maomao (src/world/mascot/MaomaoMascot.jsx and her dialogue) run through the new
// engine, so the engine has a real character to be judged with before the five arrive. The maomao
// character agent's folder (characters/maomao/) replaces this; in production it is only a last
// resort if no real character can be loaded.
import { MAOMAO_REMARKS } from "../../../../shared/play/maomaoDialogue.js";
import { LegacyBody, LegacyThumb } from "./LegacyBody.jsx";

const R = MAOMAO_REMARKS;

export default {
  id: "_maomao-legacy",
  name: "Maomao",
  credit: "Maomao from The Apothecary Diaries (© Natsu Hyuuga / Shufunotomo / Square Enix), fan art",
  size: { width: 96, height: 113 },
  Body: LegacyBody,
  poses: ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held", "crouch", "ponder"],
  movement: {
    walkSpeed: 40,
    jumpiness: 0.3,
    restlessness: 0.45,
    restPose: "ponder",
    restSeconds: [2, 4],
    heldAt: 0.86,
    // Her old rig already crouches and squashes in its own poses; the engine adds only a little.
    squash: 0.45,
    expressions: { tapped: "startled", picked: "alarmed", putDown: "deadpan", walk: "deadpan" },
  },
  behaviours: [
    { id: "ponder", weight: 3, pose: "ponder", expression: "thinking", seconds: [7, 12], topic: "deduction" },
    { id: "notes", weight: 2, pose: "idle", expression: "writing", seconds: [7, 12], topic: "notes" },
    { id: "sniff", weight: 2, pose: "idle", expression: "sniff", seconds: [6, 10], topic: "herb" },
    { id: "specimen", weight: 1, pose: "idle", expression: "poison", seconds: [6, 10], topic: "poison" },
    { id: "sit", weight: 2, pose: "sit", expression: "pleased", seconds: [8, 14], topic: "idle" },
    { id: "peer", weight: 1, pose: "idle", expression: "skeptical", seconds: [5, 9], topic: "musing" },
    { id: "doze", weight: 1, pose: "sleep", expression: "sleepy", seconds: [8, 12], say: 0.2, topic: "idle" },
  ],
  lines: {
    greet: R.kiriya,
    greetMorning: R.hour,
    greetNight: R.hour,
    idle: [...R.idle, ...R.musing],
    tapped: [...R.poke, ...R.tap],
    pester: R.pester,
    picked: R.carried,
    putDown: R.landed,
    birthday: R.birthday,
    sweet: R.kiriya,
    deduction: R.deduction,
    notes: R.notes,
    herb: R.herb,
    poison: R.poison,
    musing: R.musing,
    visit: [
      { text: "Oh. Company. Mind the mortar.", expression: "deadpan" },
      { text: "You walked all this way? Sit, then. Don't touch the jars.", expression: "pleased" },
    ],
    bye: [{ text: "Come back when you have an interesting rash.", expression: "deadpan" }],
  },
  visit: {
    with: {
      _placeholder: [[{ text: "You're very round. Are you eating properly?", expression: "skeptical" }, "I eat clouds!"]],
    },
  },
  Thumb: LegacyThumb,
};
