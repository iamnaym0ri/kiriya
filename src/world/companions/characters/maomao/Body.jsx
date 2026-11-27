import { useId } from "react";
import {
  MaomaoBackHair,
  MaomaoBandage,
  MaomaoBraids,
  MaomaoBun,
  MaomaoCatEars,
  MaomaoDefs,
  MaomaoHead,
  MaomaoWrap,
} from "../../../mascot/MaomaoMascot.jsx";
import {
  CUFF,
  HAIR,
  INNER,
  ROBE,
  ROBE_DARK,
  SHOE,
  SKIN,
  SKIN_EDGE,
  SKIRT,
  SKIRT_EDGE,
  SKIRT_FOLD,
  COLLAR,
  COLLAR_EDGE,
} from "./palette.js";
import {
  Coin,
  HeldMortar,
  HerbBundle,
  Mushroom,
  Notebook,
  Pouch,
  SmallVial,
  Sprig,
  Teacup,
  Vial,
} from "./props.jsx";
import "./Body.css";

/*
 * Maomao on the companion engine (docs/refactor/RENOVATION.md, "Companions").
 *
 * The same head, hair and face as the website's MaomaoMascot (imported, not copied, so there is
 * one Maomao), on a body whose parts can be posed: the upper body rides on the skirt and shoes, the
 * head tilts from the neck, and each pose has its own arms and props. Every motion is a CSS
 * transform on an SVG group (Body.css): cheap on an iPhone 11, and all of it stops when `playing`
 * is false or the phone asks for reduced motion.
 *
 * Drawn facing the viewer (turned a touch to her right when walking) in a 200 x 236 box that fills
 * the engine's body box, feet on the bottom edge. The engine mirrors the whole body to face left;
 * marks such as "?" and "z" flip themselves back so they still read.
 *
 * Her left forearm (the viewer's right) is bandaged in every pose (MaomaoWrap at the wrist,
 * MaomaoBandage where the sleeve slides back): it hides the scars from testing poisons on herself.
 */

/** Her face for each pose when the engine doesn't ask for one. */
export const POSE_FACE = {
  idle: "deadpan",
  walk: "deadpan",
  jump: "focused",
  fall: "startled",
  land: "deadpan",
  sit: "pleased",
  wave: "fond",
  react: "startled",
  sleep: "sleepy",
  held: "unimpressed",
  ponder: "thinking",
  grind: "focused",
  sniff: "sniff",
  notes: "writing",
  poison: "poison",
  herb: "herb",
  inspect: "curious",
  tea: "pleased",
  yawn: "sleepy",
  crouch: "focused",
  // Round 2: the vial held up to the light (the tap menu's action), counting her coins, a cat's
  // stretch, and a bundle of herbs shaken out to dry.
  appraise: "curious",
  coins: "skeptical",
  stretch: "amused",
  bundle: "pleased",
};
export const POSES = Object.keys(POSE_FACE);

const robe = { fill: ROBE, stroke: ROBE_DARK, strokeWidth: 1.4 };
const cuff = { stroke: CUFF, strokeWidth: 6, fill: "none", strokeLinecap: "round" };
const hand = { fill: SKIN, stroke: SKIN_EDGE, strokeWidth: 0.9 };

/* ---------------------------------------------------------------------------------------------
 * Lower body: shoes and skirt, per pose. Feet stand on y = 233.
 * ------------------------------------------------------------------------------------------- */

function Shoes({ pose }) {
  if (pose === "sit" || pose === "sleep")
    return (
      <g className="mm-feet mm-feet--dangle">
        <g className="mm-shoe mm-shoe--l">
          <path d="M85 250v10" stroke="#f4ece1" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="85" cy="264" rx="7.5" ry="5.5" fill={SHOE} />
          <path d="M80 262q4-3 9 0" stroke="#5d8a80" strokeWidth="1.3" fill="none" />
        </g>
        <g className="mm-shoe mm-shoe--r">
          <path d="M115 250v10" stroke="#f4ece1" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="115" cy="264" rx="7.5" ry="5.5" fill={SHOE} />
          <path d="M111 262q4-3 9 0" stroke="#5d8a80" strokeWidth="1.3" fill="none" />
        </g>
      </g>
    );
  if (pose === "held")
    return (
      <g className="mm-feet mm-feet--hang">
        <g className="mm-shoe mm-shoe--l">
          <ellipse cx="88" cy="233" rx="6" ry="8" fill={SHOE} transform="rotate(10 88 233)" />
        </g>
        <g className="mm-shoe mm-shoe--r">
          <ellipse cx="112" cy="233" rx="6" ry="8" fill={SHOE} transform="rotate(-10 112 233)" />
        </g>
      </g>
    );
  if (pose === "inspect")
    return (
      <g className="mm-feet">
        <ellipse cx="78" cy="230" rx="11" ry="4.5" fill={SHOE} />
        <ellipse cx="122" cy="230" rx="11" ry="4.5" fill={SHOE} />
      </g>
    );
  const ankles = pose === "fall" || pose === "jump";
  return (
    <g className="mm-feet">
      <g className="mm-shoe mm-shoe--l">
        {ankles && <path d="M86 214v12" stroke="#f4ece1" strokeWidth="6" strokeLinecap="round" />}
        <ellipse cx="85" cy="229" rx="11" ry="4.2" fill={SHOE} />
        <path d="M78 227q6-3 13 0" stroke="#5d8a80" strokeWidth="1.3" fill="none" />
      </g>
      <g className="mm-shoe mm-shoe--r">
        {ankles && <path d="M114 214v12" stroke="#f4ece1" strokeWidth="6" strokeLinecap="round" />}
        <ellipse cx="115" cy="229" rx="11" ry="4.2" fill={SHOE} />
        <path d="M109 227q6-3 13 0" stroke="#5d8a80" strokeWidth="1.3" fill="none" />
      </g>
    </g>
  );
}

const SKIRTS = {
  // Ankle length, flaring a little, with a few soft folds.
  stand: {
    d: "M67 183h66l13 42q-22 8-46 2-26 5-46-2Z",
    folds: "m77 190-10 34m23-33-3 35m21-35 4 35m13-36 10 33",
  },
  // Walking: lifted a touch at the hem so her steps show beneath it.
  walk: {
    d: "M67 183h66l12 39q-21 7-45 2-24 5-45-2Z",
    folds: "m77 190-9 31m22-31-3 33m21-33 4 33m13-34 9 31",
  },
  // Pushing off: the hem trails and narrows.
  jump: {
    d: "M69 183h62l7 38q-19 7-38 2-19 5-38-2Z",
    folds: "m80 190-6 30m20-30-2 32m18-32 3 32m13-31 6 29",
  },
  // Dropping: the hem lifts into a bell and the ankles show.
  fall: {
    d: "M67 183h66l20 28q-8 8-26 6-14 6-27 1-13 5-27-1-18 2-26-6Z",
    folds: "m78 189-14 26m26-26-6 30m20-30 6 30m14-30 14 26",
  },
  // Hanging from the scruff: straight down, a little longer.
  held: {
    d: "M70 183h60l6 45q-18 6-36 2-18 4-36-2Z",
    folds: "m80 190-4 36m18-36-1 38m14-38 2 38m12-38 5 36",
  },
};

function Skirt({ pose }) {
  if (pose === "sit" || pose === "sleep")
    return (
      <g className="mm-skirt mm-skirt--seated">
        {/* Below the knees: the skirt falls over her shins, behind the knees. */}
        <path
          d="M68 238q32 8 64 0l5 16q-37 8-74 0Z"
          fill="#6c344f"
          stroke={SKIRT_EDGE}
          strokeWidth="1.2"
        />
        <path d="m78 244-2 10m14-8-1 10m22-10 1 10m13-12 2 10" stroke={SKIRT_FOLD} strokeWidth="1.8" fill="none" />
        {/* The lap, thighs toward us, ending in two round knees. */}
        <path
          d="M63 212h74l5 18q0 12-12 14-12 2-20-2-6 4-10 4t-10-4q-8 4-20 2-12-2-12-14Z"
          fill={SKIRT}
          stroke={SKIRT_EDGE}
          strokeWidth="1.2"
        />
        <path d="M66 226q34 6 68 0" stroke="#94546f" strokeWidth="5" fill="none" opacity=".55" strokeLinecap="round" />
        <path d="M100 232v10" stroke={SKIRT_EDGE} strokeWidth="1.2" />
      </g>
    );
  if (pose === "inspect") return null; // drawn in front of her as the knee mound
  const shape = SKIRTS[pose] ?? SKIRTS.stand;
  return (
    <g className="mm-skirt">
      <path d={shape.d} fill={SKIRT} stroke={SKIRT_EDGE} strokeWidth="1.2" />
      <path d={shape.folds} stroke={SKIRT_FOLD} strokeWidth="2.2" fill="none" />
    </g>
  );
}

/** Squatting: knees up under the skirt, which pools on the cloud around her feet. */
function KneeMound() {
  return (
    <g className="mm-knees">
      <path d="M54 233q-3-14 9-22h74q12 8 9 22Z" fill="#6c344f" stroke={SKIRT_EDGE} strokeWidth="1.2" />
      <path d="m64 230 4-12m66 12-4-12" stroke={SKIRT_FOLD} strokeWidth="1.8" fill="none" />
      <ellipse cx="83" cy="208" rx="18" ry="14" fill={SKIRT} stroke={SKIRT_EDGE} strokeWidth="1.2" />
      <ellipse cx="117" cy="208" rx="18" ry="14" fill={SKIRT} stroke={SKIRT_EDGE} strokeWidth="1.2" />
      <path d="M71 200q12-6 24 0m10 0q12-6 24 0" stroke="#94546f" strokeWidth="4" fill="none" opacity=".55" strokeLinecap="round" />
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Upper body.
 * ------------------------------------------------------------------------------------------- */

function Torso({ id }) {
  return (
    <g className="mm-torso">
      <path d="M82 143h36l22 22-8 29q-30 9-64 0l-8-29Z" {...robe} />
      <path d="M82 143h36l22 22-8 29q-30 9-64 0l-8-29Z" fill={`url(#${id}-cloth)`} />
      {/* White under-collar, the two-tone mint band crossing left over right, and the side tie. */}
      <path d="m84 146 16 17 16-17-6-6H90Z" fill={INNER} />
      <path d="m85 146 15 17m17-17-24 41" stroke={COLLAR_EDGE} strokeWidth="7.4" fill="none" />
      <path d="m85 146 15 17m17-17-24 41" stroke={COLLAR} strokeWidth="4.6" fill="none" />
      <path d="m118 147-25 42-1 6m-7-47 12 12" stroke={ROBE_DARK} strokeWidth="2" fill="none" />
      <path d="m93 187-7-4-5 4 9 2-5 9m7-10 8 7" fill="none" stroke={ROBE_DARK} strokeWidth="2" />
    </g>
  );
}

/** Hanging at her sides; each swings from the shoulder while she walks. */
function RestArms({ spread = 0 }) {
  return (
    <g className="mm-arms mm-arms--rest">
      <g className="mm-arm mm-arm--l" transform={spread ? `rotate(${spread} 72 158)` : undefined}>
        <path d="M66 158q-14 10-18 32l20 8 11-31Z" {...robe} />
        <path d="m51 188 17 6" {...cuff} />
        <ellipse cx="60" cy="196" rx="7.5" ry="6" {...hand} />
      </g>
      <g className="mm-arm mm-arm--r" transform={spread ? `rotate(${-spread} 128 158)` : undefined}>
        <path d="M134 158q14 10 18 32l-20 8-11-31Z" {...robe} />
        <path d="m149 188-17 6" {...cuff} />
        <ellipse cx="140" cy="196" rx="7.5" ry="6" {...hand} />
        <MaomaoWrap a={[149, 188]} b={[132, 194]} hand={[140, 196]} k={0.5} />
      </g>
    </g>
  );
}

/** Hands tucked together in front of her waist, as in her official standing portrait. */
function ClaspedArms({ children, wrap = { a: [110, 178], b: [110, 196], hand: [104, 188], k: 0.45 } }) {
  return (
    <g className="mm-arms mm-arms--clasped">
      <path d="M70 152c-12 6-18 20-16 33 2 9 12 14 24 13l13-1 1-22c-10 1-18-5-22-23Z" {...robe} />
      <path d="M130 152c12 6 18 20 16 33-2 9-12 14-24 13l-13-1-1-22c10 1 18-5 22-23Z" {...robe} />
      <path d="M90 178v18M110 178v18" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
      <path d="M66 166q2 14 10 22m58-22q-2 14-10 22" stroke={ROBE_DARK} strokeWidth="1.2" fill="none" opacity=".6" />
      {children ?? (
        <g className="mm-hands">
          <ellipse cx="96" cy="186" rx="7" ry="6.5" {...hand} />
          <ellipse cx="104" cy="188" rx="7" ry="6" {...hand} />
          <path d="M101 184q3 2 2 6" stroke={SKIN_EDGE} strokeWidth="1" fill="none" />
        </g>
      )}
      <MaomaoWrap {...wrap} />
    </g>
  );
}

/** One hand at her chin, the other arm folded across to hold the elbow. */
function PonderArms() {
  return (
    <g className="mm-arms mm-arms--ponder">
      {/* The supporting arm, across her middle. */}
      <path d="M131 154c10 8 14 22 8 32-8 10-40 10-60 6l-1-14c16 3 34 3 42-4 4-5 2-12-1-18Z" {...robe} />
      <path d="M80 179l-1 13" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="73" cy="186" rx="6.5" ry="5.5" {...hand} />
      <MaomaoWrap a={[80, 179]} b={[79, 192]} hand={[73, 186]} k={0.4} half={4.4} />
      {/* The thinking arm: elbow resting on that wrist, forearm up to the chin. */}
      <g className="mm-ponder-hand">
        <path d="M69 152c-10 8-12 22-6 32 4 6 12 6 16 0l14-22c-4-4-10-6-14-2-4 3-8 0-10-8Z" {...robe} />
        <path d="m81 164 11 7" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
        <path d="M88 160q-3-7 2-11l5-2 2-6q4-2 4 3l-1 6q5 5-2 10Z" {...hand} />
      </g>
    </g>
  );
}

/** A small wave: the far arm out of the way, the near hand up by her face. */
function WaveArms() {
  return (
    <g className="mm-arms mm-arms--wave">
      <g className="mm-arm mm-arm--l">
        <path d="M66 158q-14 10-18 32l20 8 11-31Z" {...robe} />
        <path d="m51 188 17 6" {...cuff} />
        <ellipse cx="60" cy="196" rx="7.5" ry="6" {...hand} />
      </g>
      {/* The sleeve slides down to the elbow when the arm goes up. */}
      <path d="M126 152c10-2 22 4 30 14l8 12c-8 6-18 4-24-2l-12-12c-4-4-4-8-2-12Z" {...robe} />
      <g className="mm-wave-hand">
        <path d="M158 170l8-30" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
        <path d="M158 170l8-30" stroke={SKIN_EDGE} strokeWidth="8" strokeLinecap="round" opacity=".25" />
        <MaomaoBandage from={[165.4, 142.4]} to={[160.6, 160.4]} />
        <path d="M159 136q-2-10 3-12l1 6 2-9q4-2 4 3l1-5q4-1 4 4l1 4q4-2 4 3l-2 10q-4 7-11 6-5-1-7-10Z" {...hand} />
      </g>
      <path d="M150 168q8 6 14 4" stroke={CUFF} strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Arms flung up and out: dropping off a ledge, or a fright. */
function FlungArms() {
  return (
    <g className="mm-arms mm-arms--flung">
      <g className="mm-arm mm-arm--l">
        <path d="M70 154c-10-4-22-8-32-16l-6 8c4 10 10 22 20 26 8-2 14-8 18-12Z" {...robe} />
        <path d="m33 141 8 9" {...cuff} />
        <ellipse cx="32" cy="139" rx="6.5" ry="6" {...hand} />
      </g>
      <g className="mm-arm mm-arm--r">
        <path d="M130 154c10-4 22-8 32-16l6 8c-4 10-10 22-20 26-8-2-14-8-18-12Z" {...robe} />
        <path d="m167 141-8 9" {...cuff} />
        <ellipse cx="168" cy="139" rx="6.5" ry="6" {...hand} />
        <MaomaoWrap a={[159, 150]} b={[167, 141]} hand={[168, 139]} k={0.15} half={4.2} />
      </g>
    </g>
  );
}

/** Both arms thrown up: the push-off of a hop. Sleeves fall back toward her shoulders. */
function RaisedArms() {
  return (
    <g className="mm-arms mm-arms--raised">
      <g className="mm-arm mm-arm--l">
        <path d="M72 156c-10-8-20-24-26-40l-9 4c2 16 10 32 21 44 6 2 12-2 14-8Z" {...robe} />
        <path d="m38 120 8-4" {...cuff} />
        <ellipse cx="41" cy="111" rx="6.5" ry="6.5" {...hand} />
      </g>
      <g className="mm-arm mm-arm--r">
        <path d="M128 156c10-8 20-24 26-40l9 4c-2 16-10 32-21 44-6 2-12-2-14-8Z" {...robe} />
        <path d="m162 120-8-4" {...cuff} />
        <ellipse cx="159" cy="111" rx="6.5" ry="6.5" {...hand} />
        <MaomaoWrap a={[162, 120]} b={[154, 116]} hand={[159, 111]} k={0.4} half={4.4} />
      </g>
    </g>
  );
}

/** A flinch: both hands snap up in front of her collar. */
function StartleArms() {
  return (
    <g className="mm-arms mm-arms--startle">
      <path d="M68 154c-10 6-14 18-10 28 4 6 12 6 18 0l6-18c-4-2-10-6-14-10Z" {...robe} />
      <path d="M132 154c10 6 14 18 10 28-4 6-12 6-18 0l-6-18c4-2 10-6 14-10Z" {...robe} />
      <path d="m80 168 4-9m36 9-4-9" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
      <path d="M80 158q-2-10 3-12l1 5 2-7q4-1 4 3v-4q4-1 4 3l1 6q1 6-6 9-7 1-9-3Z" {...hand} />
      <path d="M120 158q2-10-3-12l-1 5-2-7q-4-1-4 3v-4q-4-1-4 3l-1 6q-1 6 6 9 7 1 9-3Z" {...hand} />
      <MaomaoWrap a={[111.5, 161.5]} b={[121.5, 159.5]} hand={[115.5, 152]} k={0.08} half={4.6} />
    </g>
  );
}

/** Picked up by the scruff like a kitten: paws tucked up, everything else slack. */
function PawArms() {
  return (
    <g className="mm-arms mm-arms--paws">
      <path d="M68 154c-8 8-10 20-4 28 6 4 14 0 18-6l2-16c-6 0-12-2-16-6Z" {...robe} />
      <path d="M132 154c8 8 10 20 4 28-6 4-14 0-18-6l-2-16c6 0 12-2 16-6Z" {...robe} />
      <path d="M82 166l2 10M118 166l-2 10" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
      <g className="mm-paws">
        <path d="M84 168q2-8 8-6t4 8q-2 6-7 6-6-2-5-8Z" {...hand} />
        <path d="M116 168q-2-8-8-6t-4 8q2 6 7 6 6-2 5-8Z" {...hand} />
        <MaomaoWrap a={[118, 166]} b={[116, 176]} hand={[110, 169]} k={0.35} half={4.2} />
        <path d="M89 170v3m3-4v3m19-2v3m-3-4v3" stroke={SKIN_EDGE} strokeWidth=".9" />
      </g>
    </g>
  );
}

/** A yawn, politely hidden behind one hand. */
function YawnArms() {
  return (
    <g className="mm-arms mm-arms--yawn">
      <g className="mm-arm mm-arm--l">
        <path d="M66 158q-14 10-18 32l20 8 11-31Z" {...robe} />
        <path d="m51 188 17 6" {...cuff} />
        <ellipse cx="60" cy="196" rx="7.5" ry="6" {...hand} />
      </g>
      <g className="mm-yawn-hand">
        <path d="M128 153c12 6 18 22 12 32-6 5-14 2-18-4l-14-28c4-6 12-6 20 0Z" {...robe} />
        <path d="m106 151 11-5" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
        <path d="M95 139q0-8 8-8 8 1 8 8t-8 7q-8 0-8-7Z" {...hand} />
        <path d="M99 133q4-2 8 0" stroke={SKIN_EDGE} strokeWidth=".9" fill="none" />
        <MaomaoWrap a={[106, 151]} b={[117, 146]} hand={[103, 138.5]} k={0.3} half={4.4} />
      </g>
    </g>
  );
}

/** Holding a vial up to the light, turning it, her other hand at her side. */
function AppraiseArms() {
  return (
    <g className="mm-arms mm-arms--appraise">
      <g className="mm-arm mm-arm--l">
        <path d="M66 158q-14 10-18 32l20 8 11-31Z" {...robe} />
        <path d="m51 188 17 6" {...cuff} />
        <ellipse cx="60" cy="196" rx="7.5" ry="6" {...hand} />
      </g>
      <path d="M126 152c10-2 22 4 30 14l8 12c-8 6-18 4-24-2l-12-12c-4-4-4-8-2-12Z" {...robe} />
      <g className="mm-appraise-hand">
        <path d="M158 170l5-30" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
        <path d="M158 170l5-30" stroke={SKIN_EDGE} strokeWidth="8" strokeLinecap="round" opacity=".22" />
        <MaomaoBandage from={[162.6, 142.4]} to={[159.6, 160.6]} />
        <g data-cs-pop="">
          <SmallVial transform="translate(164 132) rotate(6)" />
        </g>
        <path d="M157 134q1-6 7-6t7 6q-1 5-7 5t-7-5Z" {...hand} />
        <path d="M159 131q5-2 9 0" stroke={SKIN_EDGE} strokeWidth=".9" fill="none" />
        <path className="mm-vial-glint" d="M182 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff6c9" stroke="#d8c36a" strokeWidth=".8" />
      </g>
      <path d="M150 168q8 6 14 4" stroke={CUFF} strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Counting her coins: the pouch in one hand, coins in the other palm, one being flipped. */
function CoinArms() {
  return (
    <g className="mm-arms mm-arms--coins">
      <path d="M70 152c-12 6-18 20-16 33 2 9 12 14 24 13l10-2-2-16c-10 0-14-6-16-28Z" {...robe} />
      <g data-cs-pop="">
        <Pouch transform="translate(84 201)" />
      </g>
      <ellipse cx="80" cy="194" rx="6.5" ry="5.5" {...hand} />
      <path d="M130 152c14 6 20 24 12 34-4 4-10 4-16 0l-8-10c6-2 10-10 12-24Z" {...robe} />
      <path d="m120 178 9 9" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
      <g className="mm-coin-hand">
        <path d="M104 184q4-6 13-5t12 6q-2 6-12 6t-13-7Z" {...hand} />
        <MaomaoWrap a={[120, 178]} b={[129, 187]} hand={[116, 184]} k={0.3} half={4.4} />
        <Coin cx={112} cy={181} r={3.4} />
        <Coin cx={119} cy={180.5} r={3.4} />
      </g>
      <g className="mm-coin-flip">
        <Coin cx={116} cy={164} r={3.8} />
      </g>
    </g>
  );
}

/** Drying herbs: a bundle held out by its knot and given a shake, the other hand at her side. */
function BundleArms() {
  return (
    <g className="mm-arms mm-arms--bundle">
      <g className="mm-arm mm-arm--l">
        <path d="M66 158q-14 10-18 32l20 8 11-31Z" {...robe} />
        <path d="m51 188 17 6" {...cuff} />
        <ellipse cx="60" cy="196" rx="7.5" ry="6" {...hand} />
      </g>
      <path d="M128 154c12 0 22 6 28 14l4 8c-6 5-14 4-20 0l-10-10c-4-4-5-8-2-12Z" {...robe} />
      <path d="M157 170l4-17" stroke={SKIN} strokeWidth="7.5" strokeLinecap="round" />
      <MaomaoBandage from={[160.4, 156]} to={[157.8, 167]} width={7.8} />
      <g className="mm-bundle-hand">
        <g data-cs-pop="">
          <HerbBundle transform="translate(161 152)" />
        </g>
        <ellipse cx="161" cy="152" rx="6.5" ry="6" {...hand} />
      </g>
      <path d="M150 170q7 5 12 3" stroke={CUFF} strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Her own poses carry their tools. */
function PropArms({ pose, prop }) {
  switch (pose) {
    case "grind":
      return (
        <g className="mm-arms mm-arms--grind">
          <path d="M70 152c-12 6-18 20-16 33 2 9 12 14 24 13l10-2-2-16c-10 0-14-6-16-28Z" {...robe} />
          <g data-cs-pop="">
            <HeldMortar />
          </g>
          <path d="M130 152c14 6 20 24 12 34-4 4-10 4-16 0l-8-10c6-2 10-10 12-24Z" {...robe} />
          <path d="m120 178 9 9" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
          <g className="mm-pestle">
            <path d="M104 180l14-24" stroke="#d9d0bd" strokeWidth="5" strokeLinecap="round" />
            <path d="M104 180l14-24" stroke="#8e9b8b" strokeWidth="5" strokeLinecap="round" opacity=".25" />
            <ellipse cx="117" cy="170" rx="6.5" ry="5.5" {...hand} />
            <MaomaoWrap a={[120, 178]} b={[129, 187]} hand={[117, 170]} k={0.4} half={4.4} />
          </g>
          <ellipse cx="82" cy="196" rx="6.5" ry="5.5" {...hand} />
        </g>
      );
    case "sniff":
      return (
        <g className="mm-arms mm-arms--sniff">
          <path d="M70 152c-12 6-18 20-16 33 2 9 12 14 24 13l13-1 1-22c-10 1-18-5-22-23Z" {...robe} />
          <path d="M90 178v18" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="96" cy="188" rx="7" ry="6" {...hand} />
          <path d="M130 152c12 8 14 22 6 30l-14 4-6-12c6-2 12-8 14-22Z" {...robe} />
          <path d="m116 176 6 10" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
          <g className="mm-sniff-hand">
            {prop === "vial" ? <SmallVial transform="translate(113 170) rotate(-18) scale(.78)" /> : <Sprig transform="translate(112 170) rotate(-24) scale(.62)" />}
            <ellipse cx="112" cy="171" rx="6.5" ry="6" {...hand} />
            <MaomaoWrap a={[116, 176]} b={[122, 186]} hand={[112, 171]} k={0.35} half={4.4} />
          </g>
        </g>
      );
    case "notes":
      return (
        <g className="mm-arms mm-arms--notes">
          <path d="M67 169q-5 21 18 22m48-22q10 12-2 21" fill="none" stroke={ROBE} strokeWidth="16" />
          <g data-cs-pop="">
            <Notebook />
          </g>
          <ellipse cx="78" cy="189" rx="7" ry="6" {...hand} />
          <g className="mm-writing-hand">
            <path d="m116 183 15-25" stroke="#796e73" strokeWidth="3.5" strokeLinecap="round" />
            <path d="m116 183-2 6 5-4" fill="#544656" />
            <ellipse cx="129" cy="174" rx="8" ry="6" {...hand} />
            <MaomaoWrap a={[132, 182]} b={[140, 174]} hand={[129, 174]} k={0.3} half={4.4} />
          </g>
        </g>
      );
    case "poison":
      return (
        <g className="mm-arms mm-arms--poison">
          <Vial />
          <path d="M67 169q-3 27 25 21m41-21q3 27-25 21" fill="none" stroke={ROBE} strokeWidth="16" />
          <path d="M67 169q-3 27 25 21m41-21q3 27-25 21" fill="none" stroke={ROBE_DARK} strokeWidth="1" opacity=".4" />
          <ellipse cx="89" cy="187" rx="8" ry="6" {...hand} />
          <ellipse cx="111" cy="187" rx="8" ry="6" {...hand} />
          <MaomaoWrap a={[120, 182]} b={[122, 192]} hand={[111, 187]} k={0.1} />
        </g>
      );
    case "herb":
      return (
        <g className="mm-arms mm-arms--herb">
          <path d="M68 169q-21 17-23-22l14-6 23 24m50 4q21 17 23-22l-14-6-23 24" {...robe} />
          <path d="m45 146 16-7m78 0 16 7" stroke={CUFF} strokeWidth="5" />
          <path d="M48 145q-5-10-1-15l5 5-1-14q5-5 7 4l3 9 4-7q7-1 4 6l-7 11m90 1q5-10 1-15l-5 5 1-14q-5-5-7 4l-3 9-4-7q-7-1-4 6l7 11" {...hand} />
          <MaomaoWrap a={[139, 139]} b={[155, 146]} hand={[144, 134]} k={0.4} />
          <Sprig transform="translate(150 150) rotate(18) scale(.62)" />
        </g>
      );
    case "inspect":
      return (
        <g className="mm-arms mm-arms--inspect">
          {/* One forearm folded over her knees… */}
          <path d="M66 190c-8 6-9 16-3 20 8 4 22 2 34-2l-1-12c-10 2-20 2-30-6Z" {...robe} />
          <path d="M95 197l1 10" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="101" cy="203" rx="6.5" ry="5.5" {...hand} />
          {/* …the other reaching out to prod the mushroom. */}
          <g className="mm-poke-hand">
            <path d="M133 190c8 4 14 12 16 20l-11 6c-4-6-8-10-12-12Z" {...robe} />
            <path d="m139 213 10-5" stroke={CUFF} strokeWidth="5" strokeLinecap="round" />
            <path d="M147 213q5 2 8 6" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
            <ellipse cx="148" cy="214" rx="5.5" ry="5" {...hand} />
            <path d="M153 217l5 4" stroke={SKIN_EDGE} strokeWidth="3.2" strokeLinecap="round" />
            <path d="M153 217l5 4" stroke={SKIN} strokeWidth="2" strokeLinecap="round" />
            <MaomaoWrap a={[139, 213]} b={[149, 208]} hand={[148, 214]} k={0.35} half={4} />
          </g>
          <Mushroom />
        </g>
      );
    case "tea":
      return (
        <ClaspedArms wrap={{ a: [112.6, 177], b: [112.6, 191], hand: [109, 184], k: 0 }}>
          <g className="mm-cup">
            <g data-cs-pop="">
              <Teacup />
            </g>
            <ellipse cx="91" cy="184" rx="6.5" ry="6" {...hand} />
            <ellipse cx="109" cy="184" rx="6.5" ry="6" {...hand} />
          </g>
        </ClaspedArms>
      );
    default:
      return null;
  }
}

/** Arms drawn behind the braids (resting) or in front of everything (holding things up). */
function armsFor(pose, prop) {
  switch (pose) {
    case "appraise":
      return { front: <AppraiseArms /> };
    case "coins":
      return { front: <CoinArms /> };
    case "stretch":
      return { front: <RaisedArms /> };
    case "bundle":
      return { front: <BundleArms /> };
    case "walk":
      return { back: <RestArms /> };
    case "jump":
      return { front: <RaisedArms /> };
    case "land":
      return { back: <RestArms spread={14} /> };
    case "crouch":
      return { back: <RestArms spread={22} /> };
    case "fall":
      return { front: <FlungArms /> };
    case "react":
      return { front: <StartleArms /> };
    case "wave":
      return { front: <WaveArms /> };
    case "held":
      return { front: <PawArms /> };
    case "ponder":
      return { front: <PonderArms /> };
    case "yawn":
      return { front: <YawnArms /> };
    case "inspect":
      return { free: <PropArms pose="inspect" /> };
    case "idle":
    case "sit":
    case "sleep":
      return { back: <ClaspedArms /> };
    default:
      return { front: <PropArms pose={pose} prop={prop} /> };
  }
}

/* ---------------------------------------------------------------------------------------------
 * Marks that float beside her. They never mirror, so a "?" stays a "?" whichever way she faces.
 * ------------------------------------------------------------------------------------------- */

function Marks({ pose, face, facing }) {
  // The engine mirrors the whole body to face left; text-like marks flip back so they still read.
  const at = (x, y) => `translate(${x} ${y})${facing < 0 ? " scale(-1 1)" : ""}`;
  const marks = [];
  if (face === "curious" || pose === "inspect")
    marks.push(
      <g key="q" transform={at(172, 78)}>
        <g className="mm-mark mm-mark--question" fill="none" stroke="#9c7fae" strokeWidth="2.6" strokeLinecap="round">
          <path d="M-6 0q0-9 7-9 9 1 4 9l-5 6v4" />
          <path d="M0 16v.5" />
        </g>
      </g>,
    );
  if (face === "startled" || face === "alarmed" || pose === "react")
    marks.push(
      <g key="s" transform="translate(168 62)">
        <g className="mm-mark mm-mark--surprise" stroke="#b4a05e" strokeWidth="3" strokeLinecap="round">
          <path d="m0 0 7-10m-3 22 12-2m-19 13 9 5" />
        </g>
      </g>,
    );
  if (face === "ew") marks.push(<path key="w" className="mm-mark mm-mark--sweat" d="M168 104q9 13 0 15-9-2 0-15Z" fill="#a1bfd3" />);
  if (face === "herb" || face === "poison" || face === "sparkle" || face === "delighted")
    marks.push(
      <g key="g" className="mm-mark mm-mark--glints" fill={face === "poison" ? "#aa89bc" : "#c6b054"}>
        <path d="M24 86l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
        <path d="M176 62l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
        <path d="M186 116l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" />
      </g>,
    );
  if (pose === "sleep" || (face === "sleepy" && pose !== "yawn"))
    marks.push(
      <g key="z" transform={at(160, pose === "sleep" ? 92 : 64)}>
        <g className="mm-mark mm-mark--z" fill="none" stroke="#9778ab" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path className="mm-z mm-z--1" d="M0 0h8l-8 9h8" />
          <path className="mm-z mm-z--2" d="M12-14h6l-6 7h6" />
          <path className="mm-z mm-z--3" d="M22-26h5l-5 5h5" />
        </g>
      </g>,
    );
  if (pose === "ponder")
    marks.push(
      <g key="t" className="mm-mark mm-mark--thought" fill="#a596b8" transform="translate(150 36)">
        <circle className="mm-dot mm-dot--1" cx="0" cy="12" r="2.4" />
        <circle className="mm-dot mm-dot--2" cx="8" cy="5" r="3" />
        <circle className="mm-dot mm-dot--3" cx="18" cy="-2" r="3.6" />
      </g>,
    );
  return marks.length ? <g className="mm-marks">{marks}</g> : null;
}

function PartyHat() {
  return (
    <g className="mm-hat">
      <path d="m116 40 27-34 10 44Z" fill="#d991b6" stroke="#a76c96" strokeWidth="1.2" />
      <path d="m129 24 14 6m-21 3 24 8" stroke="#fff1ee" strokeWidth="3" />
      <circle cx="143" cy="6" r="5" fill="#a58ccb" />
    </g>
  );
}

/** Faces whose mouth is already open: no extra talking mouth over them. */
const OPEN_MOUTH = new Set(["herb", "startled", "alarmed", "ew", "sparkle", "sleepy", "delighted", "party"]);

export default function Body({ pose = "idle", expression, facing = 1, playing = true, talking = false, prop = null }) {
  const uid = `mm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const shape = POSE_FACE[pose] ? pose : "idle";
  const face = expression ?? POSE_FACE[shape];
  // The comic cat ears (and tail): carried by the scruff, the bug look, and pure joy over an herb,
  // a poison, or a good stretch.
  const cat = shape === "held" || shape === "stretch" || face === "ew" || face === "herb" || face === "poison";
  const arms = armsFor(shape, prop);
  return (
    <svg
      className="mm"
      data-pose={shape}
      data-face={face}
      data-playing={playing ? "on" : "off"}
      data-talking={talking ? "on" : undefined}
      viewBox="0 -3 200 236"
      aria-hidden="true"
      focusable="false"
    >
      <MaomaoDefs id={uid} />
      <g className="mm-whole">
        <g className="mm-breath">
          {cat && (
            <path className="mm-tail" d={shape === "held" ? "M118 214q30 14 26 40" : "M141 205q45 4 43-32"} fill="none" stroke={HAIR} strokeWidth="9" strokeLinecap="round" />
          )}
          <g className="mm-lower">
            <Shoes pose={shape} />
            <Skirt pose={shape} />
          </g>
          <g className="mm-up">
            <g className="mm-head">
              <MaomaoBackHair id={uid} />
            </g>
            <Torso id={uid} />
            {arms.back}
          </g>
          {shape === "inspect" && <KneeMound />}
          <g className="mm-up">
            <g className="mm-head">
              <MaomaoBun id={uid} />
              {cat && <MaomaoCatEars />}
              <MaomaoHead id={uid} expression={face} moving={playing} />
              {talking && !OPEN_MOUTH.has(face) && <ellipse className="mm-talk" cx="100" cy="134.8" rx="3.6" ry="2.8" fill="#a86076" />}
              {face === "party" && <PartyHat />}
            </g>
            <g className="mm-braids">
              <MaomaoBraids />
            </g>
            {arms.front}
          </g>
          {arms.free}
        </g>
      </g>
      <Marks pose={shape} face={face} facing={facing} />
    </svg>
  );
}
