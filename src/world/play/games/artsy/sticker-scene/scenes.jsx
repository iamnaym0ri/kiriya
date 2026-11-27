// Scene backgrounds for sticker scenes, drawn for this game (400 × 500, literal colours only, so a
// scene can be copied straight onto the picture she sends).
const INK = "#5b4569";
const line = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round", strokeLinecap: "round" };

function Cloud({ x, y, s = 1, fill = "#fffafd" }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-46 10c-14 0-18-20-2-22 0-16 22-22 30-10 6-14 32-14 36 4 16-2 22 18 8 26Z"
      fill={fill}
      {...line}
    />
  );
}

function Sky() {
  return (
    <>
      <defs>
        <linearGradient id="ss-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdb6f2" />
          <stop offset="0.7" stopColor="#f3dff3" />
          <stop offset="1" stopColor="#ffe9f1" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#ss-sky)" />
      {[["#f7a8c8", 150], ["#ffd6a0", 134], ["#fff3b8", 118], ["#b5e3d3", 102], ["#c9b1ee", 86]].map(([colour, r]) => (
        <path key={r} d={`M${200 - r * 1.6} 420a${r * 1.6} ${r * 1.6} 0 0 1 ${r * 3.2} 0`} fill="none" stroke={colour} strokeWidth="16" />
      ))}
      <circle cx="320" cy="90" r="34" fill="#fff3b8" {...line} />
      <Cloud x={90} y={110} s={1.3} />
      <Cloud x={300} y={230} s={1} />
      <Cloud x={120} y={330} s={0.9} />
      <path d="M0 440q100-40 200-10t200-8V500H0Z" fill="#e7d4f6" {...line} />
      <path d="M0 470q120-24 240 0t160-6V500H0Z" fill="#d8c1ef" {...line} />
    </>
  );
}

function Room() {
  return (
    <>
      <rect width="400" height="500" fill="#f3e6f8" />
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 7 }, (_, col) => <circle key={`${row}-${col}`} cx={30 + col * 58 + (row % 2) * 29} cy={24 + row * 44} r="4" fill="#e3cdee" />),
      )}
      <rect x="226" y="54" width="128" height="150" rx="8" fill="#cfe6f5" {...line} />
      <path d="M290 54v150M226 130h128" {...line} fill="none" />
      <path d="M216 46c24 40 20 120-2 170h30c10-60 8-120-14-170Z" fill="#f6a9c7" {...line} />
      <path d="M364 46c-24 40-20 120 2 170h-30c-10-60-8-120 14-170Z" fill="#f6a9c7" {...line} />
      <rect x="200" y="38" width="180" height="12" rx="6" fill="#b79be0" {...line} />
      <rect x="30" y="150" width="140" height="12" rx="4" fill="#d9a88f" {...line} />
      <rect x="44" y="108" width="22" height="42" rx="4" fill="#c9b1ee" {...line} />
      <rect x="70" y="118" width="18" height="32" rx="4" fill="#a9dcc8" {...line} />
      <circle cx="122" cy="134" r="16" fill="#ffd1e3" {...line} />
      <rect x="0" y="340" width="400" height="160" fill="#e8cdd9" {...line} />
      <ellipse cx="200" cy="420" rx="170" ry="50" fill="#c9b1ee" {...line} />
      <ellipse cx="200" cy="420" rx="120" ry="32" fill="#e3d4ff" {...line} />
    </>
  );
}

function Garden() {
  return (
    <>
      <rect width="400" height="500" fill="#e9f3f5" />
      <path d="M0 40q100 50 200 30t200 10" fill="none" {...line} />
      {[60, 140, 220, 300, 370].map((x, i) => (
        <g key={x} transform={`translate(${x} ${58 + Math.sin(i) * 10})`}>
          <path d="M0 0v10" {...line} />
          <ellipse cx="0" cy="26" rx="14" ry="17" fill={["#f6a9c7", "#fff3b8", "#c9b1ee"][i % 3]} {...line} />
          <path d="M-8 12h16M-8 40h16" {...line} />
        </g>
      ))}
      <path d="M0 300q90-50 200-20t200-30V500H0Z" fill="#b8dcb0" {...line} />
      <path d="M0 380q120-40 250-10t150-10V500H0Z" fill="#9ccc98" {...line} />
      {[[50, 410], [130, 440], [300, 420], [360, 470], [210, 470], [80, 480]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-8" rx="5" ry="8" transform={`rotate(${a})`} fill={i % 2 ? "#fffafd" : "#ffd1e3"} stroke={INK} strokeWidth="1.6" />
          ))}
          <circle r="4" fill="#ffcf6b" stroke={INK} strokeWidth="1.6" />
        </g>
      ))}
    </>
  );
}

function Stage() {
  return (
    <>
      <rect width="400" height="500" fill="#2e1d52" />
      <path d="M120 0 40 380h320L280 0Z" fill="#fff3c9" opacity="0.18" />
      {[[50, 60], [350, 90], [90, 180], [320, 200], [200, 40]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 9}l3 6 6 3-6 3-3 6-3-6-6-3 6-3Z`} fill="#fff0b8" />
      ))}
      <path d="M0 0h90c-10 120-20 240-40 360H0Z" fill="#9f78c9" {...line} />
      <path d="M400 0h-90c10 120 20 240 40 360h50Z" fill="#9f78c9" {...line} />
      <path d="M0 0h400v36c-30 14-50 14-66 0-16 14-50 14-66 0-16 14-50 14-66 0-16 14-50 14-66 0-16 14-50 14-66 0-16 14-50 14-70 0Z" fill="#d9799f" {...line} />
      <path d="M0 360h400v140H0Z" fill="#e7c7a6" {...line} />
      <path d="M0 400h400M0 446h400" stroke={INK} strokeWidth="1.6" />
      <ellipse cx="200" cy="420" rx="150" ry="36" fill="#fff1c9" opacity="0.8" />
    </>
  );
}

function Seaside() {
  return (
    <>
      <rect width="400" height="300" fill="#d8e9fb" />
      <circle cx="200" cy="250" r="70" fill="#ffd6a0" {...line} />
      <Cloud x={80} y={90} s={1.1} />
      <Cloud x={320} y={140} s={0.8} />
      <path d="M0 250h400v120H0Z" fill="#9fcde8" {...line} />
      <path d="M20 280q20-8 40 0M120 300q20-8 40 0M250 286q20-8 40 0M330 318q20-8 40 0M60 330q20-8 40 0" stroke="#fffafd" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M0 360q100-24 200 0t200 0V500H0Z" fill="#f6e2c4" {...line} />
      <path d="M300 470c-20-30 10-60 40-40 30-20 50 10 30 40Z" fill="#f6a9c7" {...line} />
      <path d="M80 440l10-20 10 20-22-12h24Z" fill="#fff3b8" {...line} />
    </>
  );
}

function Paper() {
  return (
    <>
      <rect width="400" height="500" fill="#fffaf6" />
      {Array.from({ length: 20 }, (_, row) =>
        Array.from({ length: 16 }, (_, col) => <circle key={`${row}-${col}`} cx={14 + col * 25} cy={14 + row * 25} r="1.6" fill="#e2d2ea" />),
      )}
    </>
  );
}

export const SCENES = [
  { id: "sky", name: "lilac sky", Art: Sky },
  { id: "room", name: "cosy room", Art: Room },
  { id: "garden", name: "lantern garden", Art: Garden },
  { id: "stage", name: "little stage", Art: Stage },
  { id: "seaside", name: "seaside", Art: Seaside },
  { id: "paper", name: "dotty paper", Art: Paper },
];
export const sceneById = (id) => SCENES.find((scene) => scene.id === id) ?? SCENES[0];

export function SceneArt({ id, className, svgRef }) {
  const { Art, name } = sceneById(id);
  return (
    <svg ref={svgRef} className={className} viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label={name}>
      <Art />
    </svg>
  );
}
