/**
 * The workbench around Maomao.
 *
 * When she is left alone she isn't just posing: she is grinding something, picking over a sprig,
 * watching a pot, writing up a note or arguing with herself about a label. Each activity brings its
 * own small set of props with their own motion, drawn on a layer behind her so she stands in the
 * middle of her own work.
 *
 * All original SVG, in the same palette as the mascot. Every animation is defined in
 * MaomaoCompanion.css so quiet mode and reduced motion can stop all of it in one place.
 */
const LEAF = "#8eb45e";
const LEAF_DARK = "#527653";
const WOOD = "#ba9c72";
const STONE = "#ece6d5";
const STONE_EDGE = "#8e9b8b";
const GLASS = "#b3a3c6";

function Sprig({ transform, className = "" }) {
  return (
    <g transform={transform} className={className}>
      <path
        d="M0 0q3-15 0-32"
        stroke={LEAF_DARK}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M1-9C-12-11-11-22-11-22-2-21 3-16 1-9ZM1-19C12-21 11-30 11-30 2-29-1-25 1-19ZM0-29C-6-32-3-41-3-41 3-38 4-33 0-29Z"
        fill={LEAF}
        stroke={LEAF_DARK}
        strokeWidth="1.2"
      />
    </g>
  );
}

/** Grinding: the pestle turns, and dust lifts out of the bowl in little puffs. */
function GrindScene() {
  return (
    <g className="scene scene--grind">
      <path d="M12 96h78v6H12Z" fill={WOOD} />
      <path d="M12 102h78v3H12Z" fill="#8d7454" />
      <path
        d="M30 60h42q-2 28-21 28T30 60Z"
        fill={STONE}
        stroke={STONE_EDGE}
        strokeWidth="2"
      />
      <ellipse
        cx="51"
        cy="60"
        rx="21"
        ry="6"
        fill="#bec9ab"
        stroke={STONE_EDGE}
        strokeWidth="1.6"
      />
      {/* What she is actually grinding, shifting under the pestle as it turns. */}
      <g className="scene__grist">
        <ellipse cx="48" cy="62" rx="9" ry="3" fill="#9aad74" />
        <circle cx="44" cy="61" r="1.6" fill="#7e9459" />
        <circle cx="53" cy="62" r="1.3" fill="#7e9459" />
      </g>
      <g className="scene__pestle">
        <path
          d="M54 58 66 30"
          stroke="#a98d6d"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="54" cy="59" r="5" fill="#cdbfa4" />
      </g>
      <g className="scene__dust" fill="#cdd6b4">
        <circle cx="44" cy="48" r="2.6" />
        <circle cx="57" cy="44" r="2" />
        <circle cx="50" cy="39" r="1.6" />
      </g>
    </g>
  );
}

/** Gathering: a basket filling up, with a leaf drifting down into it. */
function GatherScene() {
  return (
    <g className="scene scene--gather">
      <path
        d="M22 66h58l-7 32q-22 6-44 0Z"
        fill={WOOD}
        stroke="#8d7454"
        strokeWidth="1.8"
      />
      <path d="M26 74h50m-49 9h48m-46 9h44" stroke="#a8875f" strokeWidth="2" />
      <Sprig transform="translate(38 70) rotate(-16) scale(.8)" />
      <Sprig transform="translate(64 70) rotate(14) scale(.7)" />
      <Sprig
        transform="translate(51 68) rotate(-2) scale(.62)"
        className="scene__sprig-late"
      />
      <g className="scene__falling-leaf">
        <path
          d="M0 0C-9-3-8-12-8-12 0-11 3-6 0 0Z"
          fill={LEAF}
          stroke={LEAF_DARK}
          strokeWidth="1.2"
        />
      </g>
    </g>
  );
}

/** Brewing: a covered pot over a low flame, steam curling off it. */
function BrewScene() {
  return (
    <g className="scene scene--brew">
      {/* A squat clay brazier: feet, a coal bed that breathes, and the pot sitting down into it. */}
      <path d="M24 96h54l-4 7H28Z" fill="#7d6450" />
      <path
        d="M22 72h58l-4 24H26Z"
        fill="#9c7f63"
        stroke="#6f5943"
        strokeWidth="1.6"
      />
      <g className="scene__coals">
        <ellipse cx="51" cy="79" rx="20" ry="5" fill="#8d4b2c" />
        <ellipse cx="44" cy="78" rx="6" ry="3" fill="#e0763c" />
        <ellipse cx="58" cy="80" rx="5" ry="2.6" fill="#f2a054" />
      </g>
      <g className="scene__flame">
        <path
          d="M51 78q-9-9-4-18 2 5 5 3 0-8 6-12-3 12 5 15 4 6-1 12Z"
          fill="#e0a05c"
          opacity=".85"
        />
        <path
          d="M51 78q-5-6-2-12 2 4 4 1 1-5 4-7-2 8 3 11 2 4-1 7Z"
          fill="#f4d08a"
        />
      </g>
      <path
        d="M26 56h50l-5 20q-20 6-40 0Z"
        fill="#8a7f96"
        stroke="#5f566f"
        strokeWidth="2"
      />
      <ellipse
        cx="51"
        cy="56"
        rx="25"
        ry="6"
        fill="#a79bb4"
        stroke="#5f566f"
        strokeWidth="1.6"
      />
      <ellipse
        className="scene__brewsurface"
        cx="51"
        cy="56"
        rx="19"
        ry="4"
        fill="#6f6482"
      />
      {/* A ladle left standing in it, stirred every so often. */}
      <g className="scene__ladle">
        <path
          d="M62 54 78 32"
          stroke="#a98d6d"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <ellipse cx="61" cy="55" rx="6" ry="3" fill="#cdbfa4" />
      </g>
      <g
        className="scene__steam"
        fill="none"
        stroke="#cfd8e4"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M40 48q-7-7 0-14t0-13" />
        <path d="M54 44q-7-7 0-14t0-11" />
        <path d="M66 50q-6-6 0-12t0-9" />
      </g>
    </g>
  );
}

/** Notes: an open book, a line of ink appearing as she writes it. */
function NotesScene() {
  return (
    <g className="scene scene--notes">
      <path d="M16 96h74v5H16Z" fill={WOOD} />
      <path
        d="M18 62q18-6 33 2 15-8 33-2v32q-18-5-33 2-15-7-33-2Z"
        fill="#f8ebce"
        stroke="#a38d79"
        strokeWidth="2"
      />
      <path d="M51 64v32" stroke="#c2a992" strokeWidth="1.6" />
      <path
        d="M25 71h18m-18 7h18m-18 7h14"
        stroke="#b19aa0"
        strokeWidth="1.6"
      />
      <g className="scene__ink" stroke="#7d6a90" strokeWidth="1.6" fill="none">
        <path d="M59 71h18" />
        <path d="M59 78h18" />
        <path d="M59 85h13" />
      </g>
    </g>
  );
}

/** Sorting: three jars, one lifted out of the row and set back down. */
function SortScene() {
  return (
    <g className="scene scene--sort">
      <path d="M12 96h80v5H12Z" fill={WOOD} />
      {[20, 46, 72].map((x, i) => (
        <g
          key={x}
          className={i === 1 ? "scene__jar scene__jar--lift" : "scene__jar"}
        >
          <rect
            x={x}
            y="60"
            width="20"
            height="36"
            rx="4"
            fill={GLASS}
            stroke="#706988"
            strokeWidth="1.8"
          />
          <rect x={x + 1} y="56" width="18" height="7" rx="2" fill={WOOD} />
          <rect x={x + 3} y="76" width="14" height="14" rx="2" fill="#fff3d3" />
          <path
            d={`M${x + 6} 80h8m-8 4h6`}
            stroke="#8b748d"
            strokeWidth="1.4"
          />
        </g>
      ))}
    </g>
  );
}

/** Inspecting: a single sprig held up to the light, with a slow glint across it. */
function InspectScene() {
  return (
    <g className="scene scene--inspect">
      <Sprig
        transform="translate(50 84) scale(1.35)"
        className="scene__specimen"
      />
      <g className="scene__glint" fill="#fff6c9">
        <path d="m74 44 2.5 6.5L83 53l-6.5 2.5L74 62l-2.5-6.5L65 53l6.5-2.5Z" />
      </g>
    </g>
  );
}

/** Resting: a stool and a cup she has put down and half forgotten. */
function RestScene() {
  return (
    <g className="scene scene--rest">
      <path d="M26 74h48v7H26Z" fill={WOOD} />
      <path
        d="M32 81l-4 20m38-20 4 20"
        stroke="#8d7454"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M40 58h24l-3 14q-9 3-18 0Z"
        fill="#fff3ea"
        stroke="#c3a9b4"
        strokeWidth="1.8"
      />
      <g
        className="scene__steam scene__steam--slow"
        fill="none"
        stroke="#dcd2e2"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M46 54q-5-5 0-10t0-7" />
        <path d="M58 54q-5-5 0-10t0-7" />
      </g>
    </g>
  );
}

/** Conjecture: the thought marks she turns over when she is arguing with herself. */
function ConjectureScene() {
  return (
    <g className="scene scene--conjecture" fill="none" strokeLinecap="round">
      <g
        className="scene__mark scene__mark--a"
        stroke="#9c7fae"
        strokeWidth="3"
      >
        <path d="M30 60q0-11 9-11 11 1 6 11l-7 8v4" />
        <path d="M38 80v1.5" />
      </g>
      <g
        className="scene__mark scene__mark--b"
        stroke="#b49a6a"
        strokeWidth="3"
      >
        <path d="M74 44v14" />
        <path d="M74 64v1.5" />
      </g>
      <g
        className="scene__mark scene__mark--c"
        stroke="#8fae90"
        strokeWidth="2.6"
      >
        <path d="M14 42q6-7 12 0" />
      </g>
    </g>
  );
}

const SCENES = {
  grind: GrindScene,
  gather: GatherScene,
  brew: BrewScene,
  notes: NotesScene,
  sort: SortScene,
  inspect: InspectScene,
  rest: RestScene,
  conjecture: ConjectureScene,
};

export default function CompanionScene({ activity }) {
  const Scene = SCENES[activity];
  if (!Scene) return null;
  return (
    <svg
      className="companion__scene"
      viewBox="0 0 102 104"
      aria-hidden="true"
      focusable="false"
    >
      <Scene />
    </svg>
  );
}
