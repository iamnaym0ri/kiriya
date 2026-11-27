import Body, { BAMBY_POSES } from "./Body.jsx";
import { BAMBY_EXPRESSIONS } from "./Face.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { HeartIcon } from "./props.jsx";
import { lines, visit } from "./lines.js";

// Bamby (PLAVE), fan art. His face and hair after his official look (big pink-violet deer eyes, dark
// brows, thick wavy bubblegum-pink hair with a fringe to the brows), his clothes after the PLBBUU
// era. The group's main dancer and co-choreographer, and what he does most is here: he dances
// whenever he stops, counts the steps with his own sounds (earbuds in, in his own world), swats
// himself when a step goes wrong and goes again, hops on the spot yelling "lassgo", blooms flowers
// and star candies round his face (his ability), turns his back to ponder the sky with a hand on his
// hip ("pondering Bamby"), does his Harley impression across the screen, trains, squats over a pill
// bug (bugs don't scare him; birds do), stares like a frozen peach and then yells out of nowhere.
// Tap him and he dances for her, ending on an "ending fairy" close-up with a finger heart. His cloud
// is a little flower stage. Contract: src/world/companions/README.md.
export default {
  id: "bambi",
  name: "Bamby",
  credit: "Bamby (PLAVE) © VLAST — fan art",
  size: { width: 100, height: 118 },
  Body,
  poses: BAMBY_POSES, // the shared ten, crouch, and his own (groove, dance, spin, freeze, bloom, count, vroom, stretch, snack, heart, skygaze, cry, scared, cool, fairy, sing, lassgo, swat, bug, lift)
  expressions: BAMBY_EXPRESSIONS,
  Platform,
  movement: {
    walkSpeed: 54, // the quickest walker of the five
    restPose: "groove", // when he stops, he keeps bouncing on the beat
    restSeconds: [1.5, 3.5],
    restlessness: 0.8, // he roams
    jumpiness: 0.5, // sporty: changes level often
    wander: 0.75,
    platform: "trail",
    platformWidth: 92,
    platformForm: 420, // matches his own forming/fading animations (bambi.css)
    platformFade: 600,
    platformFx: "own",
    jumpHeight: 44, // a dancer's jump: a little higher than the rest
    anticipation: 200,
    landing: 360,
    squash: 0.55, // his jump/land poses squash and stretch already
    heldAt: 0.9,
    sway: 1.2,
    talkiness: 0.5,
    expressions: { tapped: "surprised", picked: "surprised", putDown: "proud", walk: "grin", jump: "grin", stay: "flirty", wander: "grin" },
  },
  // The tap menu's own choice: a dance break just for her with his stage headset on, then the
  // "ending fairy" (the close-up at the end of a music-show stage): a wink and a finger heart.
  action: {
    id: "fairy",
    label: "dance for me",
    icon: HeartIcon,
    pose: "dance",
    prop: "headset",
    expression: "grin",
    seconds: [3.6, 4],
    topic: "action",
    steps: [
      { pose: "dance", prop: "headset", expression: "grin", seconds: [3.6, 4], topic: "action", bounce: { count: 2, height: 7, every: 0.5 } },
      { pose: "spin", prop: "headset", expression: "happy", seconds: [0.9, 0.9] },
      { pose: "fairy", prop: "headset", expression: "wink", seconds: [2.6, 3], topic: "fairy" },
    ],
  },
  // Without `roam` or `level`, he can do it in place while told to stay: dancing on the spot most of
  // all (it's what he does best), counting, lassgo hops, swatting himself, blooming, the pill bug…
  behaviours: [
    { id: "dance", weight: 4, pose: "dance", expression: "grin", seconds: [5, 9], topic: "dance", roam: true },
    { id: "dancehere", weight: 4, pose: "dance", expression: "grin", seconds: [4, 7], topic: "dance", bounce: { count: 2, height: 6, every: 0.5 } },
    {
      id: "routine",
      weight: 2,
      pose: "dance",
      steps: [
        { pose: "count", expression: "focused", seconds: [2, 2.5], topic: "count" },
        { pose: "dance", expression: "grin", seconds: [2.4, 3], bounce: 2 },
        { pose: "spin", expression: "happy", seconds: [0.9, 0.9] },
        { pose: "freeze", expression: "cool", seconds: [1.6, 2], topic: "showoff" },
      ],
    },
    // A step goes wrong: he swats himself and goes again (the members picked the habit up from him).
    {
      id: "oops",
      weight: 2.2,
      pose: "dance",
      say: 0.8,
      steps: [
        { pose: "dance", expression: "focused", seconds: [2, 2.6] },
        { pose: "swat", expression: "squeeze", seconds: [1.1, 1.3], topic: "oops" },
        { pose: "dance", expression: "focused", seconds: [2, 2.6] },
      ],
    },
    // "Lassgo!": his "let's go", hopping on the spot (naengmyeon was mentioned, probably).
    { id: "lassgo", weight: 1.8, pose: "lassgo", expression: "grin", seconds: [1.8, 2.6], topic: "lassgo", say: 0.85 },
    { id: "sing", weight: 1.4, pose: "sing", expression: "sing", seconds: [4, 7], topic: "sing" },
    { id: "fairy", weight: 1, pose: "fairy", expression: "wink", seconds: [2.5, 3.5], topic: "fairy" },
    { id: "groove", weight: 2.5, pose: "groove", expression: "happy", seconds: [4, 7], topic: "idle" },
    { id: "spin", weight: 2.5, pose: "spin", expression: "happy", seconds: [2, 3], topic: "dance", say: 0.3 },
    { id: "freeze", weight: 2.5, pose: "freeze", expression: "cool", seconds: [2.5, 4], topic: "showoff" },
    { id: "bloom", weight: 3, pose: "bloom", expression: "sparkle", seconds: [3, 4.5], topic: "bloom" },
    // Making up choreography: earbuds in, clapping the counts, in his own world.
    { id: "count", weight: 3, pose: "count", expression: "focused", seconds: [5, 8], topic: "count" },
    { id: "cool", weight: 1.5, pose: "cool", expression: "cool", seconds: [3, 5], topic: "showoff" },
    {
      id: "vroom",
      weight: 2,
      pose: "groove",
      expression: "grin",
      seconds: [2, 3],
      topic: "vroom",
      roam: true,
      roamPose: "vroom",
      roamSpeed: 2.3,
      say: 0.7,
    },
    { id: "lift", weight: 1.4, pose: "lift", expression: "focused", seconds: [4, 6], topic: "exercise" },
    { id: "stretch", weight: 1.4, pose: "stretch", expression: "happy", seconds: [4, 7], topic: "exercise" },
    { id: "snack", weight: 2, pose: "snack", expression: "munch", seconds: [5, 8], topic: "food" },
    { id: "bug", weight: 1.3, pose: "bug", expression: "curious", seconds: [5, 8], topic: "bug", say: 0.7 },
    // The frozen-peach stare… and then a yell out of nowhere.
    {
      id: "outburst",
      weight: 1.2,
      pose: "idle",
      say: 0.9,
      steps: [
        { pose: "idle", expression: "blank", seconds: [2, 3], topic: "deadpan" },
        { pose: "react", expression: "yell", seconds: [1.1, 1.3], topic: "outburst" },
        { pose: "idle", expression: "blank", seconds: [1.4, 2] },
      ],
    },
    { id: "puff", weight: 0.8, pose: "heart", expression: "puff", seconds: [2.5, 3.5], topic: "puff", say: 0.6 },
    { id: "heart", weight: 1.6, pose: "heart", expression: "happy", seconds: [3, 5], topic: "sweet" },
    { id: "wave", weight: 1, pose: "wave", expression: "happy", seconds: [2, 3], topic: "sweet", say: 0.3 },
    { id: "games", weight: 1, pose: "cool", expression: "proud", seconds: [3, 5], topic: "games" },
    { id: "skygaze", weight: 1, pose: "skygaze", expression: "neutral", seconds: [5, 9], topic: "sky", stay: true, level: "top" },
    // "Pondering Bamby": back turned, hand on his hip, gazing at the sky, wherever he is.
    { id: "ponder", weight: 1.2, pose: "skygaze", expression: "neutral", seconds: [4, 7], topic: "sky" },
    { id: "scared", weight: 1, pose: "scared", expression: "scared", seconds: [2, 3], topic: "birds", say: 0.8 },
    { id: "cry", weight: 0.4, pose: "cry", expression: "teary", seconds: [3, 4], topic: "cry", say: 0.8 },
    { id: "sit", weight: 1, pose: "sit", expression: "neutral", seconds: [6, 10], topic: "idle" },
    { id: "nap", weight: 2, pose: "sleep", expression: "sleepy", seconds: [10, 18], topic: "sleep", hours: [23, 6], stay: true },
  ],
  lines,
  visit,
  Thumb,
};
