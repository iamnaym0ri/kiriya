import Body, { MIKU_POSES } from "./Body.jsx";
import Platform from "./Platform.jsx";
import Thumb from "./Thumb.jsx";
import { lines, visit } from "./lines.js";

// Hatsune Miku, classic look: one of the five companions on her home screen
// (docs/refactor/RENOVATION.md, "Companions"). Original fan art and dialogue.
export default {
  id: "miku",
  name: "Hatsune Miku",
  credit:
    "Hatsune Miku © Crypton Future Media, INC. www.piapro.net — fan art under the Piapro Character License (piapro.jp/license/pcl/summary)",
  creditLink: "https://piapro.jp/license/pcl/summary",
  size: { width: 110, height: 120 },
  Body,
  poses: MIKU_POSES,
  Platform,
  movement: {
    walkSpeed: 44,
    jumpiness: 0.45,
    restPose: "sit",
  },
  behaviours: [],
  lines,
  visit,
  Thumb,
};
