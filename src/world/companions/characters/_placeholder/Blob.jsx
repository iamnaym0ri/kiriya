// A dev-only test character for the companion engine: a lilac blob with every shared pose, a
// sitting pose whose legs hang below the feet line (as the contract allows), and its own cloud.
import "./blob.css";

const EYES = {
  happy: <path d="M27 40q4-5 8 0m10 0q4-5 8 0" stroke="#4b3557" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
  sleepy: <path d="M27 41h8m10 0h8" stroke="#4b3557" strokeWidth="2.4" strokeLinecap="round" />,
  surprised: (
    <g fill="#4b3557">
      <circle cx="31" cy="40" r="3.6" />
      <circle cx="49" cy="40" r="3.6" />
    </g>
  ),
};

function Eyes({ expression }) {
  if (EYES[expression]) return EYES[expression];
  return (
    <g className="blob__eyes" fill="#4b3557">
      <ellipse cx="31" cy="40" rx="2.6" ry="3.4" />
      <ellipse cx="49" cy="40" rx="2.6" ry="3.4" />
    </g>
  );
}

export function BlobBody({ pose = "idle", expression, playing = true, talking = false, prop = null }) {
  const face = expression ?? (pose === "sleep" ? "sleepy" : pose === "react" || pose === "held" || pose === "fall" ? "surprised" : pose === "wave" ? "happy" : undefined);
  return (
    <svg className="blob" data-pose={pose} data-playing={playing ? "" : undefined} viewBox="0 0 80 96" aria-hidden="true">
      <ellipse className="blob__shadow" cx="40" cy="95" rx="24" ry="3.5" fill="#5d4a63" opacity=".16" />
      <g className="blob__legs" stroke="#8a6aa6" strokeWidth="5" strokeLinecap="round">
        <path className="blob__leg blob__leg--l" d="M32 82v12" />
        <path className="blob__leg blob__leg--r" d="M48 82v12" />
      </g>
      <g className="blob__body">
        <path d="M40 14c20 0 31 16 31 38 0 22-12 34-31 34S9 74 9 52c0-22 11-38 31-38Z" fill="#d9c2ec" stroke="#8a6aa6" strokeWidth="2" />
        <path d="M22 30c4-8 12-11 20-11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" />
        <Eyes expression={face} />
        <ellipse cx="24" cy="49" rx="4.5" ry="2.6" fill="#f2a7c3" opacity=".7" />
        <ellipse cx="56" cy="49" rx="4.5" ry="2.6" fill="#f2a7c3" opacity=".7" />
        <path className="blob__mouth" d={talking ? "M36 52q4 5 8 0q-4 2-8 0Z" : "M36 52q4 3 8 0"} stroke="#4b3557" strokeWidth="2" fill={talking ? "#7c4a6a" : "none"} strokeLinecap="round" />
        <path className="blob__arm blob__arm--l" d="M12 56q-7 4-8 11" stroke="#8a6aa6" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path className="blob__arm blob__arm--r" d="M68 56q7 4 8 11" stroke="#8a6aa6" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M40 14c-2-6 1-10 6-11" stroke="#8a6aa6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="47" cy="3" r="3" fill="#f2a7c3" stroke="#8a6aa6" strokeWidth="1.5" />
      </g>
      {prop === "star" && (
        <path className="blob__prop" d="M74 50l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#ffd970" stroke="#c99a2e" strokeWidth="1.4" strokeLinejoin="round" />
      )}
      {pose === "sleep" && (
        <text x="64" y="22" fill="#8a6aa6" fontSize="13" fontWeight="700" className="blob__z">
          z
        </text>
      )}
    </svg>
  );
}

/** Its own cloud: a dotted, rounder puff, to show that characters bring their own. */
export function BlobPlatform({ width = 80, state }) {
  return (
    <svg viewBox="0 0 100 30" width={width} height={(width * 30) / 100} aria-hidden="true" data-state={state} style={{ display: "block", overflow: "visible" }}>
      <path
        d="M10 22C2 22 2 12 11 12 13 4 27 2 33 9 38 1 56 0 60 8 66 2 82 3 85 11 95 10 99 21 90 22 70 26 30 26 10 22Z"
        fill="#fdf7ff"
        stroke="#b99bd0"
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <path d="M16 20.5C38 24 64 24 86 20.5" fill="none" stroke="#efe3f6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
BlobPlatform.surface = 7;

export function BlobThumb() {
  return (
    <div style={{ width: 56, height: 56 }}>
      <BlobBody pose="idle" playing={false} />
    </div>
  );
}
