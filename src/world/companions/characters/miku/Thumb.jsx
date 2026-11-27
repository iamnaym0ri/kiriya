import { useId } from "react";
import MikuBody from "./Body.jsx";

// A small round portrait for her settings picker: head and shoulders, twin tails framing it, on a
// soft mint backdrop with two notes. The body is the same drawing as on the home screen, held still.
export default function MikuThumb({ size = 56, expression = "happy" }) {
  const raw = useId();
  const uid = `hmt${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="20 20 180 180" role="img" aria-label="Hatsune Miku">
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx="110" cy="110" r="90" />
        </clipPath>
        <radialGradient id={`${uid}-bg`} cx=".5" cy=".38" r=".7">
          <stop stopColor="#f4fffd" />
          <stop offset=".7" stopColor="#d4f3ef" />
          <stop offset="1" stopColor="#bfe6e9" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <circle cx="110" cy="110" r="90" fill={`url(#${uid}-bg)`} />
        <g fill="#2dbebe" opacity=".35">
          <path d="M44 74a4 3 0 1 0 .1 0ZM47.4 72.8V60q4 2 5.8 6" />
          <path d="M170 150a3.4 2.6 0 1 0 .1 0Zm3 -1v-11" />
        </g>
        <svg x="0" y="6" width="220" height="240" viewBox="0 0 220 240" overflow="visible">
          <MikuBody pose="idle" expression={expression} playing={false} scale={2} />
        </svg>
      </g>
      <circle cx="110" cy="110" r="89" fill="none" stroke="#9fd9d6" strokeWidth="2" />
    </svg>
  );
}
