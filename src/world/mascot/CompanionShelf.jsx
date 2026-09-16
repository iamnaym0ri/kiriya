/**
 * Her corner of the nav bar. When she is up on the shelf, this hangs around her: drying herb
 * bundles on their strings, a couple of stoppered jars and the lip of the shelf she is sitting on.
 * It travels with her along the bar, so it reads as her patch rather than decoration bolted to the
 * page, and it is drawn downward from the bar's edge so it never covers a nav link.
 */
const HAIR_STRING = "#a68f6e";
const LEAF = "#8eb45e";
const LEAF_DARK = "#527653";

function Bundle({ x, length, delay }) {
  return (
    <g
      className="shelf__bundle"
      style={{ animationDelay: `${delay}ms` }}
      transform={`translate(${x} 0)`}
    >
      <path d={`M0 0v${length}`} stroke={HAIR_STRING} strokeWidth="1.4" />
      <g transform={`translate(0 ${length})`}>
        <path
          d="M0 0c-9 3-11 12-11 12 9 1 13-5 11-12Z"
          fill={LEAF}
          stroke={LEAF_DARK}
          strokeWidth="1.1"
        />
        <path
          d="M0 0c9 3 11 12 11 12-9 1-13-5-11-12Z"
          fill={LEAF}
          stroke={LEAF_DARK}
          strokeWidth="1.1"
        />
        <path
          d="M0 2c-3 6-1 14-1 14 5-3 5-10 1-14Z"
          fill="#a3c46f"
          stroke={LEAF_DARK}
          strokeWidth="1"
        />
        <path
          d="M-5 0h10"
          stroke="#c08a63"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

export default function CompanionShelf() {
  return (
    <svg
      className="companion__shelf"
      viewBox="0 0 240 96"
      aria-hidden="true"
      focusable="false"
    >
      {/* Bundles hanging from the top of the bar, well inside it so nothing clips off-screen. */}
      <Bundle x={30} length={18} delay={0} />
      <Bundle x={50} length={27} delay={420} />
      <Bundle x={198} length={22} delay={820} />
      <Bundle x={214} length={15} delay={1240} />
      {/* Two small jars, pushed to the ends so they sit either side of her. */}
      <g className="shelf__jar" transform="translate(74 58)">
        <rect
          x="-8"
          y="10"
          width="16"
          height="21"
          rx="3"
          fill="#b3a3c6"
          stroke="#706988"
          strokeWidth="1.4"
        />
        <rect x="-7" y="7" width="14" height="6" rx="2" fill="#ba9c72" />
        <rect x="-5" y="19" width="10" height="9" rx="1.5" fill="#fff3d3" />
      </g>
      <g className="shelf__jar" transform="translate(174 62)">
        <rect
          x="-7"
          y="10"
          width="14"
          height="18"
          rx="3"
          fill="#9fb8ae"
          stroke="#5f7a70"
          strokeWidth="1.4"
        />
        <rect x="-6" y="7" width="12" height="6" rx="2" fill="#ba9c72" />
      </g>
    </svg>
  );
}
