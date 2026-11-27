import Body, { POSE_NAMES, SIZE } from "./Body.jsx";
import { EXPRESSIONS } from "./Face.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { PaddleIcon } from "./parts.jsx";
import { lines, visit } from "./lines.js";

// Miku as the fujoshi of SAWTOWNE's "Confessions of a Rotten Girl" (2025), matched to the song's
// concept art and reference sheet: muted forest-green twin tails darkening to the tips, dark-red
// cross hair ties, big round glasses that spiral when she's flustered, a white short-sleeved shirt
// with a crimson ribbon crossed in an X, a charcoal plaid skirt, crew socks, black loafers. From the
// MV: the wooden "SINNER" paddle with the word burnt in (a nod to the con-floor yaoi paddle) she
// carries behind her back, her black "Yaoi Note", the crazed spiral-eyed stare of its thumbnail, the
// magazine she buys (here hidden inside a hymnal), and the halo when she ascends. A girl at a
// Christian school whose teachers (KAITO teaches art, Gakupo P.E., Kiyoteru history) are all she can
// think about, confessing her BL habit as a sin, paddling herself for it and relapsing on the spot:
// she ships grown-up fictional men, writes fanfic on her cloud, judges seme and uke with a pointed
// finger, squeals at new chapters, gets nosebleeds, ascends. Contract: src/world/companions/README.md
// and docs/refactor/RENOVATION.md ("Round 2", "Character writing, round 3").
export default {
  id: "miku-rotten",
  name: "Miku",
  credit:
    "Miku as in “Confessions of a Rotten Girl” (SAWTOWNE, 2025), original fan art. Hatsune Miku © Crypton Future Media, INC. www.piapro.net, under the Piapro Character License (piapro.net/intl/en_character.html).",
  size: SIZE,
  Body,
  // The shared ten, crouch, and her own: sketch, pray, fluster, peek, cheer, nope, glint, giggle,
  // show, hug, paddle, smack, penance, phone, dance, ascend, magazine, point.
  poses: POSE_NAMES,
  expressions: EXPRESSIONS,
  Platform,
  // Engine options: src/world/companions/README.md, "Movement". She walks on a trail of sketchbook
  // clouds (drawn in ahead, rubbed out behind), hops between levels with a little wind-up, and when
  // she stops she sits on her cloud, legs swinging, and draws.
  movement: {
    walkSpeed: 34, // small quick steps
    restPose: "sketch",
    restSeconds: [3, 6],
    restlessness: 0.45,
    jumpiness: 0.35, // a bit hop-happy when excited
    wander: 0.45,
    platform: "trail",
    platformWidth: 96,
    platformForm: 440, // matches the pencil drawing the outline in
    platformFade: 580, // matches the eraser rubbing it out
    platformFx: "own",
    anticipation: 220,
    landing: 340,
    squash: 0.6, // her land and jump poses squash already
    heldAt: 0.36, // lifted by the back of her collar
    sway: 1.1,
    talkiness: 0.5,
    expressions: { tapped: "gasp", picked: "flustered", putDown: "happy", walk: "soft", jump: "gasp", stay: "smug", wander: "sparkle" },
  },
  // The tap menu's own choice (README, "the tap menu and stay"): she holds up her SINNER paddle,
  // paddles herself for her sins (penance, SMACK), then relapses on the spot. The paddle is the
  // chip's icon; "yaoi paddle" is what the con-floor prop it parodies was called.
  action: {
    id: "paddle",
    label: "yaoi paddle!",
    icon: PaddleIcon,
    pose: "paddle",
    prop: "paddle",
    expression: "smug",
    seconds: [6, 7],
    topic: "action",
    steps: [
      { pose: "paddle", prop: "paddle", expression: "smug", seconds: [1.6, 1.8], topic: "action" },
      { pose: "penance", prop: "paddle", expression: "wince", seconds: [2.6, 2.6], topic: "penance" },
      { pose: "giggle", prop: "paddle", expression: "guilty", seconds: [1.8, 2.2], topic: "smacked" },
    ],
  },
  // Everything without `roam` or `level` is something she can do in place while told to stay:
  // write fanfic, squeal at her phone, dance, brandish the paddle, hug her doujinshi, confess…
  behaviours: [
    { id: "fanfic", weight: 5, pose: "sketch", expression: "focused", seconds: [9, 16], topic: "fanfic" },
    { id: "swing", weight: 2.5, pose: "sit", expression: "happy", seconds: [7, 12], topic: "idle" },
    { id: "phone", weight: 2, pose: "phone", expression: "feral", seconds: [4, 7], topic: "phone", say: 0.7 },
    // A new chapter drops: she squeals at her phone, hopping, gets a nosebleed, then a victory dance.
    {
      id: "chapter",
      weight: 1.2,
      pose: "phone",
      say: 0.8,
      steps: [
        { pose: "phone", expression: "feral", seconds: [2.4, 3], topic: "phone", bounce: { count: 3, height: 6, every: 0.32 } },
        { pose: "fluster", expression: "nosebleed", seconds: [2, 2.6], topic: "nosebleed" },
        { pose: "dance", expression: "giggle", seconds: [2.4, 3], bounce: 2 },
      ],
    },
    // The chapter that finally delivers: nosebleed, and she ascends (halo, floating, at peace).
    {
      id: "ascend",
      weight: 0.9,
      pose: "ascend",
      say: 0.85,
      steps: [
        { pose: "phone", expression: "rotten", seconds: [2, 2.6], topic: "phone" },
        { pose: "fluster", expression: "nosebleed", seconds: [1.6, 2], topic: "nosebleed" },
        { pose: "ascend", expression: "bliss", seconds: [3, 3.6], topic: "ascend" },
      ],
    },
    // "Reading her hymnal" (the magazine she bought is inside it).
    {
      id: "magazine",
      weight: 1.3,
      pose: "magazine",
      say: 0.8,
      steps: [
        { pose: "magazine", expression: "rotten", seconds: [2.6, 3.4], topic: "magazine" },
        { pose: "magazine", expression: "nosebleed", seconds: [1.8, 2.4], topic: "hymnal", chance: 0.6 },
      ],
    },
    // The seme/uke debate, both sides argued by her, pointing one way then the other, then a verdict.
    {
      id: "debate",
      weight: 1.3,
      pose: "point",
      say: 0.9,
      steps: [
        { pose: "point", expression: "smug", seconds: [2, 2.6], topic: "seme" },
        { pose: "point", expression: "feral", seconds: [2, 2.6], topic: "uke", turn: true },
        { pose: "glint", expression: "smug", seconds: [1.8, 2.2], topic: "verdict" },
      ],
    },
    // The thumbnail stare: spiral eyes, sweating, thinking something unrepeatable.
    { id: "brainrot", weight: 1, pose: "idle", expression: "rotten", seconds: [3, 4.5], topic: "brainrot", say: 0.8 },
    { id: "show", weight: 2, pose: "show", expression: "sparkle", seconds: [4, 7], topic: "shipping" },
    { id: "dance", weight: 1.6, pose: "dance", expression: "giggle", seconds: [4, 6], topic: "dance" },
    { id: "paddle", weight: 1.4, pose: "paddle", expression: "smug", seconds: [3, 5], topic: "paddle" },
    // The paddle on a ship that won't kiss already: a slam on her cloud.
    { id: "enforce", weight: 0.9, pose: "smack", expression: "feral", seconds: [3, 4.5], topic: "smack", say: 0.7 },
    // Penance, then the relapse.
    {
      id: "penance",
      weight: 0.7,
      pose: "penance",
      say: 0.7,
      steps: [
        { pose: "pray", expression: "pray", seconds: [2.2, 2.8], topic: "confess" },
        { pose: "penance", expression: "wince", seconds: [2.6, 2.6], topic: "penance" },
        { pose: "giggle", expression: "guilty", seconds: [1.8, 2.4], topic: "smacked", chance: 0.7 },
      ],
    },
    { id: "doujin", weight: 1.2, pose: "hug", expression: "dreamy", seconds: [4, 7], topic: "doujin" },
    { id: "nosebleed", weight: 1, pose: "fluster", expression: "nosebleed", seconds: [3, 5], topic: "nosebleed", say: 0.8 },
    { id: "daydream", weight: 2, pose: "sit", expression: "dreamy", seconds: [6, 10], topic: "daydream", level: "top" },
    { id: "stroll", weight: 1, pose: "walk", expression: "soft", seconds: [4, 7], topic: "idle", roam: true },
    { id: "confess", weight: 1.5, pose: "pray", expression: "pray", seconds: [4, 7], topic: "confess" },
    { id: "giggle", weight: 1.5, pose: "giggle", expression: "giggle", seconds: [3, 5], topic: "giggle" },
    { id: "peek", weight: 1.2, pose: "peek", expression: "shy", seconds: [4, 7], topic: "peeking" },
    { id: "theory", weight: 1.2, pose: "glint", expression: "smug", seconds: [3, 5], topic: "theory" },
    { id: "fluster", weight: 0.8, pose: "fluster", expression: "flustered", seconds: [3, 5], topic: "fluster" },
    { id: "cheer", weight: 0.8, pose: "cheer", expression: "sparkle", seconds: [3, 6], topic: "cheer" },
    { id: "resist", weight: 0.6, pose: "nope", expression: "flustered", seconds: [2, 4], topic: "resist" },
    { id: "doze", weight: 0.4, pose: "sleep", expression: "sleepy", seconds: [8, 12], topic: "sleepy", stay: true },
    { id: "nap", weight: 4, pose: "sleep", expression: "sleepy", seconds: [14, 24], topic: "sleepy", stay: true, hours: [22, 7] },
  ],
  lines,
  visit,
  Thumb,
};
