import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { useInView } from "motion/react";
import { usePlayful } from "../../shared/play/PlayfulContext.js";
import MaomaoFace from "./MaomaoFace.jsx";
export { MAOMAO_EXPRESSIONS } from "./MaomaoFace.jsx";
import "./MaomaoMascot.css";

// Original SVG fan art; costume, expression and pose references are documented in
// docs/redesign/MAOMAO-CHARACTER-RESEARCH.md. Cat features are brief comic reactions.
const HAIR = "#214844",
  HAIR_LIGHT = "#3c776b",
  SKIN = "#fde0c4";
const ROBE = "#7daf80",
  ROBE_DARK = "#52826a",
  SKIRT = "#793d59";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const readReducedMotion = () => matchMedia(reducedMotionQuery).matches;
function subscribeReducedMotion(listener) {
  const query = matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function Herb({ transform }) {
  return (
    <g transform={transform}>
      <g className="mascot__sprig">
        <path
          d="M0 0q3-17 0-36"
          stroke="#527653"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M1-10C-14-12-13-25-13-25-3-24 3-18 1-10ZM1-22C14-24 13-35 13-35 3-34-1-29 1-22ZM0-33C-7-37-4-47-4-47 3-44 5-38 0-33Z"
          fill="#8eb45e"
          stroke="#527653"
          strokeWidth="1.4"
        />
        <path d="m0-13-9-9m11-3 7-7" stroke="#c1d18a" fill="none" />
      </g>
    </g>
  );
}
export function Mortar() {
  return (
    <g className="mascot__mortar">
      <path
        d="M83 182h43q-2 22-21 22-19 0-22-22Z"
        fill="#ece6d5"
        stroke="#8e9b8b"
        strokeWidth="1.8"
      />
      <ellipse
        cx="105"
        cy="182"
        rx="21"
        ry="5"
        fill="#bec9ab"
        stroke="#8e9b8b"
        strokeWidth="1.5"
      />
      <path
        className="mascot__pestle"
        d="m109 183 16-26q3-5 7-2 3 2 0 7l-17 23Z"
        fill="#ece6d5"
        stroke="#8e9b8b"
        strokeWidth="1.5"
      />
      <path d="M100 199h12" stroke="#b9bdab" strokeWidth="2" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Her drawing, in parts. MaomaoMascot (the website) stacks them as it always has; the app's
// companion (src/world/companions/characters/maomao/) reuses the same head, hair and face on an
// articulated body, so there is one Maomao. Gradient ids come from the caller's useId().
// ---------------------------------------------------------------------------------------------

/** The gradients every part below refers to. */
export function MaomaoDefs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-hair`} x1="0" y1="0" x2=".35" y2="1">
        <stop stopColor="#315e55" />
        <stop offset=".55" stopColor={HAIR} />
        <stop offset="1" stopColor="#1b3d3b" />
      </linearGradient>
      <radialGradient id={`${id}-skin`} cx=".45" cy=".38" r=".7">
        <stop offset=".4" stopColor="#fee5cd" />
        <stop offset="1" stopColor="#f0c8a9" />
      </radialGradient>
      {/* A cool rim down the right edge and a warm sheen across the hair: the two cheapest
          things that stop a flat vector fill from reading as clip art. */}
      <linearGradient id={`${id}-rim`} x1="1" y1="0" x2="0" y2="0">
        <stop stopColor="#bfe6e0" stopOpacity=".55" />
        <stop offset=".22" stopColor="#bfe6e0" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2=".2" y2="1">
        <stop offset=".1" stopColor="#7fd7c4" stopOpacity="0" />
        <stop offset=".42" stopColor="#8fe0cd" stopOpacity=".38" />
        <stop offset=".7" stopColor="#7fd7c4" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2=".3" y2="1">
        <stop stopColor="#ffffff" stopOpacity=".22" />
        <stop offset=".6" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#2f4a3c" stopOpacity=".2" />
      </linearGradient>
      <radialGradient id={`${id}-ground`} cx=".5" cy=".5" r=".5">
        <stop stopColor="#5d4a63" stopOpacity=".3" />
        <stop offset="1" stopColor="#5d4a63" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * The hair behind her head (drawn before the body). It is all pinned up into the bun, so the back
 * of it stops at her jaw and her neck and collar show: only the side locks and the thin braids
 * come lower.
 */
export function MaomaoBackHair({ id }) {
  return (
    <>
      <ellipse cx="100" cy="96" rx="62" ry="58" fill={`url(#${id}-hair)`} />
      <path d="M45 102q-4 30 9 46l5-38m96-8q4 30-9 46l-5-38" fill={HAIR} />
    </>
  );
}

/**
 * The bun and its blue ribbon (drawn after the body, before the head). A small, neat bun tucked
 * into the crown a little to her left, the bow's two loops standing up like ears (official
 * standing model and the Nendoroid), not lying flat like a propeller.
 */
export function MaomaoBun({ id }) {
  return (
    <>
      <circle cx="104" cy="40" r="17" fill={`url(#${id}-hair)`} />
      <path
        d="M92 36q10-11 23-3M114 27q8 7 5 16"
        fill="none"
        stroke={HAIR_LIGHT}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <g className="mascot__ribbon" style={{ transformOrigin: "104px 31px" }}>
        <path
          d="M104 31C99 21 95 9 89 10c-6 1-5 14 15 21ZM104 31c5-10 9-22 15-21 6 1 5 14-15 21Z"
          fill="#84aaea"
          stroke="#5d79bd"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M101 27q-4-7-8-12m14 12q4-7 8-12"
          stroke="#6688cc"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M100 33l-5 9m13-9 5 8" stroke="#6f93dc" strokeWidth="2.6" strokeLinecap="round" />
        <ellipse
          cx="104"
          cy="31"
          rx="4"
          ry="3.6"
          fill="#9dbcf0"
          stroke="#5d79bd"
          strokeWidth="1.2"
        />
      </g>
    </>
  );
}

/*
 * The bandage on her LEFT forearm (the viewer's right while she faces us): it hides the scars from
 * testing poisons and herbs on herself. Shown in every pose: as wraps at the wrist below the sleeve,
 * and as a bandaged forearm where the sleeve slides back (a raised arm).
 */
const WRAP_EDGE = "#cfc6b8";
const WRAP = "#f7f3ea";
const pt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/**
 * Two wraps across the wrist: parallel to the cuff line a→b, centred a share `k` of the way from the
 * cuff's middle toward the hand, the second one a little nearer the hand.
 */
export function MaomaoWrap({ a, b, hand, k = 0.45, half = 4.8 }) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dx = (b[0] - a[0]) / len;
  const dy = (b[1] - a[1]) / len;
  const reach = Math.hypot(hand[0] - mx, hand[1] - my) || 1;
  const tx = (hand[0] - mx) / reach;
  const ty = (hand[1] - my) / reach;
  const cx = mx + (hand[0] - mx) * k;
  const cy = my + (hand[1] - my) * k;
  const band = (ox, oy, h) => `M${pt(cx + ox - dx * h, cy + oy - dy * h)}L${pt(cx + ox + dx * h, cy + oy + dy * h)}`;
  const d = band(0, 0, half) + band(tx * 2.9, ty * 2.9, half * 0.86);
  return (
    <g className="mascot__wrap" strokeLinecap="round" fill="none">
      <path d={d} stroke={WRAP_EDGE} strokeWidth="4.4" />
      <path d={d} stroke={WRAP} strokeWidth="2.9" />
    </g>
  );
}

/** A bare forearm wrapped in bandage from `from` (by the wrist) to `to` (toward the elbow). */
export function MaomaoBandage({ from, to, width = 8.4 }) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const dx = (x1 - x0) / len;
  const dy = (y1 - y0) / len;
  const h = width / 2;
  const turns = [0.18, 0.45, 0.72]
    .map((t) => {
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      return `M${pt(cx + dy * h - dx * 1.3, cy - dx * h - dy * 1.3)}L${pt(cx - dy * h + dx * 1.3, cy + dx * h + dy * 1.3)}`;
    })
    .join("");
  return (
    <g className="mascot__wrap" fill="none">
      <path d={`M${pt(x0, y0)}L${pt(x1, y1)}`} stroke={WRAP_EDGE} strokeWidth={width + 1.3} />
      <path d={`M${pt(x0, y0)}L${pt(x1, y1)}`} stroke={WRAP} strokeWidth={width} />
      <path d={turns} stroke="#d9d0c2" strokeWidth=".9" strokeLinecap="round" />
    </g>
  );
}

/** The comic cat ears from her annoyed and delighted reactions. */
export function MaomaoCatEars() {
  return (
    <g className="mascot__cat-ears">
      <path
        d="M41 62 37 32q20 2 30 14m66 0q10-12 30-14l-4 30"
        fill={HAIR}
        stroke="#1b3738"
        strokeWidth="2"
      />
      <path d="m44 43 2 13 12-9m98-4-2 13-12-9" fill="#6e8181" />
    </g>
  );
}

/** Face, fringe, side locks and the face rig. */
export function MaomaoHead({ id, expression, moving }) {
  return (
    <g className="mascot__head">
      <ellipse cx="46" cy="111" rx="7" ry="10" fill="#efc2a3" />
      <ellipse cx="154" cy="111" rx="7" ry="10" fill="#efc2a3" />
      <path
        d="M45 92q0-42 55-43 55 1 55 43v24q-4 39-55 40-51-1-55-40Z"
        fill={`url(#${id}-skin)`}
      />
      {/* The freckles she paints on so nobody looks twice: a light dusting on her upper cheeks,
          just under each eye. Kept small, warm and see-through, and clear of the middle of her
          face (above the mouth, around the nose), so they never read as a moustache. */}
      <g fill="#c48a6e" opacity=".55">
        {[
          [70.5, 128.4, 0.95],
          [76, 130, 0.85],
          [81.5, 128.6, 0.9],
          [74, 133, 0.7],
          [129.5, 128.4, 0.95],
          [124, 130, 0.85],
          [118.5, 128.6, 0.9],
          [126, 133, 0.7],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <MaomaoFace expression={expression} moving={moving} />
      <path
        d="M44 103C37 68 60 44 97 45c39-2 66 21 59 59l-10-9q-2-10-2-22l-4 24q-6 2-13-1l-3-27-1 26q-6 2-14 1l-7-31-1 32q-6 2-13-1l-3-29-3 27q-6 3-13 3l-1-22q-2 15-8 24Z"
        fill={`url(#${id}-hair)`}
      />
      <path
        d="M66 60q17-10 33-9m8 2q18 2 31 17M76 68l-3 18m16-24 2 25m20-24 6 22"
        stroke={HAIR_LIGHT}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M46 94q-5 35 12 48l1-45m95-3q5 35-12 48l-1-45" fill={HAIR} />
      {/* Sheen across the fringe and a rim down the shaded side. */}
      <path
        d="M44 103C37 68 60 44 97 45c39-2 66 21 59 59l-10-9q-2-10-2-22l-4 24q-6 2-13-1l-3-27-1 26q-6 2-14 1l-7-31-1 32q-6 2-13-1l-3-29-3 27q-6 3-13 3l-1-22q-2 15-8 24Z"
        fill={`url(#${id}-sheen)`}
      />
      <path
        d="M45 92q0-42 55-43 55 1 55 43v24q-4 39-55 40-51-1-55-40Z"
        fill={`url(#${id}-rim)`}
      />
    </g>
  );
}

/** The two side braids with their beads. */
export function MaomaoBraids() {
  return (
    <g className="mascot__braids">
      {[58, 142].map((x) => (
        <g
          key={x}
          className={`mascot__braid mascot__braid--${x === 58 ? "left" : "right"}`}
          style={{ transformOrigin: `${x}px 140px` }}
        >
          <path
            d={`M${x} 140q-5 9 0 17t-1 17`}
            stroke={HAIR}
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`m${x - 3} 147 5 5m-5 3 5 5m-5 3 4 4`}
            stroke={HAIR_LIGHT}
            strokeWidth="2"
          />
          <circle cx={x} cy="141" r="4.2" fill="#f47c97" stroke="#8b3347" strokeWidth=".8" />
          <circle cx={x} cy="167" r="3.6" fill="#5fc6c6" stroke="#2f8888" strokeWidth=".7" />
          <circle cx={x - 1.2} cy="165.8" r="1.1" fill="#bff4f4" />
          <path d={`m${x - 3} 171-1 12q6 5 8-1l-2-11Z`} fill={HAIR} />
        </g>
      ))}
    </g>
  );
}

export default function MaomaoMascot({
  expression = "deadpan",
  size = 132,
  onPoke,
  reactionKey = 0,
  // How the body is carrying itself: standing, mid-stride, sitting on a ledge, hanging from the
  // scruff while she is carried, or picking herself up after being put down.
  pose = "stand",
}) {
  const Tag = onPoke ? "button" : "div";
  const ref = useRef(null);
  const id = useId();
  const { moving } = usePlayful();
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => true,
  );
  const inView = useInView(ref, { margin: "40px" });
  const animate = moving && inView && !reduced;
  useEffect(() => {
    if (!animate) return;
    // Replay only short pose accents. The face and its breathing/blink clocks stay mounted.
    const accents = [
      ...ref.current.querySelectorAll(
        ".mascot__float, .mascot__head, .mascot__braid, .mascot__gesture, .mascot__tail, .mascot__delight-glints, .mascot__question, .mascot__surprise, .mascot__sweat, .mascot__scent, .mascot__writing-hand, .mascot__ink",
      ),
    ].filter((node) => {
      const css = getComputedStyle(node);
      return (
        css.animationName !== "none" &&
        !css.animationIterationCount.includes("infinite")
      );
    });
    // Restart through CSS so quiet/offscreen styles can still cancel every accent.
    accents.forEach((node) => {
      node.style.animationName = "none";
    });
    if (accents.length) ref.current.getBoundingClientRect();
    accents.forEach((node) => node.style.removeProperty("animation-name"));
  }, [expression, reactionKey, animate]);
  const thrilled = expression === "herb";
  const fascinated = expression === "poison";
  const annoyed = expression === "ew";
  const pondering =
    expression === "thinking" ||
    expression === "curious" ||
    expression === "conspiratorial";
  const writing = expression === "writing";
  const sniffing = expression === "sniff";
  const cat = thrilled || annoyed;
  return (
    <Tag
      ref={ref}
      className="mascot"
      data-expression={expression}
      data-pose={pose}
      data-mascot-motion={animate ? "on" : "off"}
      style={{ width: size }}
      onClick={onPoke}
      {...(onPoke
        ? { type: "button", "aria-label": "Poke the apothecary" }
        : { "aria-hidden": true })}
    >
      <svg viewBox="0 0 200 236" className="mascot__svg" aria-hidden="true">
        <MaomaoDefs id={id} />
        {/* Grounding shadow, outside the float group so she casts onto the page while she bobs. */}
        <ellipse
          className="mascot__ground"
          cx="100"
          cy="231"
          rx="46"
          ry="7"
          fill={`url(#${id}-ground)`}
        />
        <g className="mascot__breath">
          <g className="mascot__float">
            {cat && (
              <path
                className="mascot__tail"
                d="M141 205q45 4 43-32"
                fill="none"
                stroke={HAIR}
                strokeWidth="9"
                strokeLinecap="round"
              />
            )}
            <MaomaoBackHair id={id} />
            <ellipse
              className="mascot__shoe mascot__shoe--left"
              cx="85"
              cy="229"
              rx="11"
              ry="4"
              fill="#335851"
            />
            <ellipse
              className="mascot__shoe mascot__shoe--right"
              cx="116"
              cy="229"
              rx="11"
              ry="4"
              fill="#335851"
            />
            <path
              d="M67 183h66l13 42q-22 8-46 2-26 5-46-2Z"
              fill={SKIRT}
              stroke="#603649"
              strokeWidth="1.2"
            />
            <path
              d="m77 190-10 34m23-33-3 35m21-35 4 35m13-36 10 33"
              stroke="#9c5b74"
              strokeWidth="2.2"
              fill="none"
            />
            <path
              d="M82 143h36l22 22-8 29q-30 9-64 0l-8-29Z"
              fill={ROBE}
              stroke={ROBE_DARK}
              strokeWidth="1.4"
            />
            <path
              d="M82 143h36l22 22-8 29q-30 9-64 0l-8-29Z"
              fill={`url(#${id}-cloth)`}
            />
            <path d="m84 146 16 17 16-17-6-6H90Z" fill="#fff6df" />
            <path
              d="m85 146 15 17m17-17-24 41"
              stroke="#c2d8be"
              strokeWidth="6"
              fill="none"
            />
            <path
              d="m118 147-25 42-1 6m-7-47 12 12"
              stroke={ROBE_DARK}
              strokeWidth="2"
              fill="none"
            />
            <path
              d="m93 187-7-4-5 4 9 2-5 9m7-10 8 7"
              fill="none"
              stroke={ROBE_DARK}
              strokeWidth="2"
            />
            <g
              className="mascot__arms-rest mascot__arm-swing"
              opacity={
                thrilled || fascinated || pondering || writing || sniffing
                  ? 0
                  : 1
              }
            >
              <path
                d="M66 160q-13 9-18 30l20 8 11-31m55-7q13 9 18 30l-20 8-11-31"
                fill={ROBE}
                stroke={ROBE_DARK}
                strokeWidth="1.4"
              />
              <path
                d="m50 187 19 7m62 0 19-7"
                stroke="#c5d491"
                strokeWidth="6"
              />
              <ellipse cx="62" cy="195" rx="8" ry="6" fill={SKIN} />
              <ellipse cx="132" cy="192" rx="9" ry="6" fill={SKIN} />
              <MaomaoWrap a={[150, 187]} b={[131, 194]} hand={[132, 192]} k={0.2} />
            </g>
            <MaomaoBun id={id} />
            {cat && <MaomaoCatEars />}
            <MaomaoHead id={id} expression={expression} moving={animate} />
            <MaomaoBraids />
            {thrilled ? (
              <g className="mascot__eager-hands mascot__gesture">
                <path
                  d="M68 169q-21 17-23-22l14-6 23 24m50 4q21 17 23-22l-14-6-23 24"
                  fill={ROBE}
                  stroke={ROBE_DARK}
                  strokeWidth="1.5"
                />
                <path
                  d="m45 146 16-7m78 0 16 7"
                  stroke="#c5d491"
                  strokeWidth="5"
                />
                <path
                  d="M48 145q-5-10-1-15l5 5-1-14q5-5 7 4l3 9 4-7q7-1 4 6l-7 11m90 1q5-10 1-15l-5 5 1-14q-5-5-7 4l-3 9-4-7q-7-1-4 6l7 11"
                  fill={SKIN}
                  stroke="#ddb49e"
                  strokeWidth="1"
                />
                <MaomaoWrap a={[139, 139]} b={[155, 146]} hand={[144, 134]} k={0.4} />
                <Herb transform="translate(39 194) rotate(-22) scale(.7)" />
              </g>
            ) : fascinated ? (
              <g className="mascot__treasure mascot__gesture">
                <path
                  d="M92 157h16v9q9 4 9 13v17H83v-17q0-9 9-13Z"
                  fill="#b3a3c6"
                  stroke="#706988"
                  strokeWidth="2"
                />
                <rect
                  x="90"
                  y="153"
                  width="20"
                  height="8"
                  rx="2"
                  fill="#ba9c72"
                />
                <rect
                  x="90"
                  y="174"
                  width="20"
                  height="15"
                  rx="2"
                  fill="#fff3d3"
                />
                <path d="M96 178h8m-8 4h6" stroke="#8b748d" strokeWidth="1.5" />
                <path
                  d="M67 169q-3 27 25 21m41-21q3 27-25 21"
                  fill="none"
                  stroke={ROBE}
                  strokeWidth="16"
                />
                <ellipse cx="89" cy="187" rx="8" ry="6" fill={SKIN} />
                <ellipse cx="111" cy="187" rx="8" ry="6" fill={SKIN} />
                <MaomaoWrap a={[120, 182]} b={[122, 192]} hand={[111, 187]} k={0.1} />
              </g>
            ) : writing ? (
              <g className="mascot__notebook mascot__gesture">
                <path
                  d="M67 169q-5 21 18 22m48-22q10 12-2 21"
                  fill="none"
                  stroke={ROBE}
                  strokeWidth="16"
                />
                <path
                  d="M74 160q15-4 27 2 14-6 29-2v38q-15-3-29 2-12-5-27-2Z"
                  fill="#f8ebce"
                  stroke="#a38d79"
                  strokeWidth="1.7"
                />
                <path d="M101 162v37" stroke="#c2a992" strokeWidth="1.4" />
                <path
                  d="M80 170h14m-14 7h14m-14 7h11"
                  stroke="#b19aa0"
                  strokeWidth="1.4"
                />
                <path
                  className="mascot__ink"
                  d="M107 171h15m-15 7h15m-15 7h11"
                  stroke="#887397"
                  strokeWidth="1.4"
                  fill="none"
                />
                <ellipse cx="78" cy="189" rx="7" ry="6" fill={SKIN} />
                <g className="mascot__writing-hand">
                  <path
                    d="m116 183 15-25"
                    stroke="#796e73"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path d="m116 183-2 6 5-4" fill="#544656" />
                  <ellipse cx="129" cy="174" rx="8" ry="6" fill={SKIN} />
                  <MaomaoWrap a={[132, 182]} b={[140, 174]} hand={[129, 174]} k={0.3} />
                </g>
              </g>
            ) : sniffing ? (
              <g className="mascot__sniff-hand mascot__gesture">
                <path
                  d="M68 165q-18 27 10 27m55-27q17 13 1 27l-23-12"
                  fill="none"
                  stroke={ROBE}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path d="m115 179 12-3" stroke="#c5d491" strokeWidth="6" />
                <Herb transform="translate(113 177) rotate(-14) scale(.76)" />
                <ellipse cx="114" cy="177" rx="7" ry="6" fill={SKIN} />
                <MaomaoWrap a={[120, 172]} b={[122, 182]} hand={[114, 177]} k={0.15} />
                <Mortar />
                <ellipse cx="77" cy="190" rx="7" ry="5" fill={SKIN} />
                <path
                  className="mascot__scent"
                  d="M119 135q-8-5-3-10m7 15q-6-4-4-8"
                  fill="none"
                  stroke="#91a784"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <g>
                <Mortar />
                {pondering ? (
                  <g className="mascot__ponder-hand mascot__gesture">
                    <path
                      d="M134 160q15 10 15 29l-15 8-12-10"
                      fill={ROBE}
                      stroke={ROBE_DARK}
                      strokeWidth="1.4"
                    />
                    <path d="m131 193 16-7" stroke="#c5d491" strokeWidth="5" />
                    <ellipse cx="130" cy="191" rx="8" ry="6" fill={SKIN} />
                    <MaomaoWrap a={[147, 186]} b={[131, 193]} hand={[130, 191]} k={0.25} />
                    <path
                      d="M69 169q17 20 30-11l-11-8"
                      fill={ROBE}
                      stroke={ROBE_DARK}
                      strokeWidth="1.5"
                    />
                    <path d="m87 157 12 3" stroke="#c5d491" strokeWidth="5" />
                    <path
                      d="M90 154q-5-7 0-13l7-3 3-10q5-2 4 4l-2 12q6 7-3 12Z"
                      fill={SKIN}
                      stroke="#d7b19a"
                      strokeWidth="1.2"
                    />
                  </g>
                ) : (
                  <Herb transform="translate(64 193) rotate(-24) scale(.68)" />
                )}
              </g>
            )}
            {expression === "party" && (
              <g className="mascot__hat">
                <path
                  d="m116 40 27-34 10 44Z"
                  fill="#d991b6"
                  stroke="#a76c96"
                  strokeWidth="1.2"
                />
                <path
                  d="m129 24 14 6m-21 3 24 8"
                  stroke="#fff1ee"
                  strokeWidth="3"
                />
                <circle cx="143" cy="6" r="5" fill="#a58ccb" />
              </g>
            )}
            {annoyed && (
              <path
                className="mascot__sweat"
                d="M168 107q9 13 0 15-9-2 0-15Z"
                fill="#a1bfd3"
              />
            )}
            {expression === "curious" && (
              <g
                className="mascot__question"
                fill="none"
                stroke="#9c7fae"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M166 83q0-10 8-10 10 1 5 10l-6 7v4" />
                <path d="M173 101v1" />
              </g>
            )}
            {(expression === "startled" || expression === "alarmed") && (
              <g
                className="mascot__surprise"
                stroke="#b4a05e"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="m167 64 7-10m-3 22 12-2m-19 13 9 5" />
              </g>
            )}
            {(thrilled || fascinated || expression === "sparkle") && (
              <g
                className="mascot__delight-glints"
                fill={fascinated ? "#aa89bc" : "#c6b054"}
              >
                <path d="m23 89 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
                <path d="m177 67 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
              </g>
            )}
            {expression === "sleepy" && (
              <text
                x="160"
                y="67"
                className="mascot__zzz"
                fill="#9778ab"
                fontSize="20"
              >
                z
              </text>
            )}
          </g>
        </g>
      </svg>
    </Tag>
  );
}
