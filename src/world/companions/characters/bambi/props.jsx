// Bamby's props, in the body's 200 × 236 drawing (feet at 100,230; shoulders 73/127,163).
// `headset`: the stage headset mic he dances with (drawn on the head, so it nods with it).
// `mic`: a handheld mic, held up to sing. `heart`: a finger heart that pops a big pink heart.
// Each one-off arm here replaces his rigged right arm for the poses that need a bent elbow the
// rig can't make cleanly (the rig is two straight segments with CSS rotations).

const JACKET = "#fdfbff";
const JACKET_LINE = "#8f84a8";
const PINK = "#ef7fb4";
const PINK_LINE = "#d2417f";
const SKIN = "#ffe7d8";
const SKIN_LINE = "#e3b19c";
const MIC = "#3a3148";

/** A sleeve from the shoulder through the elbow to the wrist, then the hand. */
function BentArm({ d, hand, cuff, children, className }) {
  return (
    <g className={className}>
      <path d={d} fill="none" stroke={JACKET_LINE} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={JACKET} strokeWidth="12.2" strokeLinecap="round" strokeLinejoin="round" />
      {cuff && <path d={cuff} stroke={PINK} strokeWidth="11.6" strokeLinecap="butt" />}
      <g className="bamby__phand">
        <circle cx={hand[0]} cy={hand[1]} r="7" fill={SKIN} stroke={SKIN_LINE} strokeWidth="1.1" />
        {children}
      </g>
    </g>
  );
}

/** The headset: an earpiece over his right ear and a thin boom round to the corner of his mouth. */
export function Headset() {
  return (
    <g className="bamby__headset">
      <path d="M152 104q4 0 5 6v8q-1 6-5 6" fill="none" stroke={MIC} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="153" cy="114" rx="4.2" ry="7" fill={MIC} />
      <ellipse cx="153.6" cy="111.5" rx="1.4" ry="2.6" fill="#fff" opacity=".35" />
      <path d="M152 120q-2 17-26 19" fill="none" stroke={MIC} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="124" cy="139" rx="3.6" ry="2.8" fill={MIC} />
      <ellipse cx="123" cy="138.2" rx="1.2" ry=".9" fill="#fff" opacity=".45" />
    </g>
  );
}

/** Singing: his right hand brings a handheld mic up beside his mouth. */
export function MicArm() {
  return (
    <BentArm className="bamby__mic-arm" d="M127 163L143 182L123 166" hand={[120, 160]} cuff="M126.6 168.2l-4 -3.2">
      <g transform="rotate(-38 120 160)">
        <rect x="116.6" y="142" width="7" height="22" rx="3" fill={MIC} />
        <rect x="116.6" y="154" width="7" height="3.4" fill={PINK} />
        <circle cx="120.1" cy="140" r="7.2" fill="#d9d2e6" stroke="#8d82a3" strokeWidth="1.2" />
        <path d="M114.5 137.5h11.2M114 141h12.2M115.4 144.4h9.4M117 134.6h6.4" stroke="#a79dbb" strokeWidth="1" />
        <path d="M116 136q2-3 5-3.4" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".9" />
      </g>
      <circle cx="120" cy="160" r="7" fill={SKIN} stroke={SKIN_LINE} strokeWidth="1.1" />
      <path d="M115 157.5q5 -2 10 0" stroke={SKIN_LINE} strokeWidth="1" fill="none" strokeLinecap="round" />
    </BentArm>
  );
}

/** The ending fairy: right hand up by his cheek, thumb and finger crossed in a heart. */
export function HeartArm() {
  return (
    <BentArm className="bamby__heart-arm" d="M127 163L148 176L146 152" hand={[146, 146]} cuff="M146.3 158.5l-.2 -4.4">
      {/* Finger and thumb crossing over the top of the hand. */}
      <path d="M142.5 141.5l5.2-6.6m-.6 6.6-3.6-6" stroke={SKIN_LINE} strokeWidth="4.4" strokeLinecap="round" />
      <path d="M142.5 141.5l5.2-6.6m-.6 6.6-3.6-6" stroke={SKIN} strokeWidth="2.6" strokeLinecap="round" />
      <g className="bamby__finger-heart">
        <path
          d="M156 132c-9-5.6-10-12-5.4-13 2.3-.5 4.2 1 5.4 3 1.2-2 3.1-3.5 5.4-3 4.6 1 3.6 7.4-5.4 13Z"
          fill="#ff7fb6"
          stroke={PINK_LINE}
          strokeWidth="1.2"
        />
        <path d="M151.5 121.5q-1.8 1-2 3" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    </BentArm>
  );
}

/** Little hearts that rise off the finger heart. */
export function HeartBurst() {
  const heart = "M0 5C-7 .5-7.6-4.6-4-5.3-2-5.7-.6-4.5 0-3c.6-1.5 2-2.7 4-2.3C7.6-4.6 7 .5 0 5Z";
  return (
    <g className="bamby__heart-burst">
      {[
        [168, 104, 1.1, "#ff9cc6"],
        [178, 128, 0.8, "#ffc0dc"],
        [160, 86, 0.7, "#ff7fb6"],
      ].map(([x, y, s, fill], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path className={`bamby__burst bamby__burst--${i + 1}`} d={heart} fill={fill} stroke={PINK_LINE} strokeWidth="1" />
        </g>
      ))}
    </g>
  );
}

/** Music notes floating off while he sings. */
export function Notes() {
  return (
    <g className="bamby__sing-notes" fill="#b28bd8" stroke="#b28bd8">
      <g className="bamby__sing-note bamby__sing-note--1">
        <path d="M58 66v-13l8-2.6v13" strokeWidth="1.8" fill="none" />
        <circle cx="55.6" cy="66" r="2.8" stroke="none" />
        <circle cx="63.6" cy="63.4" r="2.8" stroke="none" />
      </g>
      <g className="bamby__sing-note bamby__sing-note--2">
        <path d="M40 92v-12" strokeWidth="1.8" fill="none" />
        <path d="M40 80q5 1 6 6" strokeWidth="1.8" fill="none" />
        <circle cx="37.6" cy="92" r="2.8" stroke="none" />
      </g>
    </g>
  );
}

/** A tiny pink heart for the tap-menu chip. */
export function HeartIcon({ size = 18 }) {
  return (
    <svg viewBox="-10 -10 20 20" width={size} height={size} aria-hidden="true">
      <path d="M0 7.5C-11 0-11.5-9-5.6-9.6-2.6-9.9-.8-7.6 0-5.2.8-7.6 2.6-9.9 5.6-9.6 11.5-9 11 0 0 7.5Z" fill="#ff7fb6" stroke="#d2417f" strokeWidth="1.4" />
    </svg>
  );
}
