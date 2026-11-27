import { useId } from "react";
import BambyBody from "./Body.jsx";

// His portrait for her settings picker: head and shoulders on a soft pink disc, his starry beret,
// a wink. Static (no animation), so a row of portraits costs nothing.
export default function BambyThumb({ size = 64 }) {
  const bg = `bamby-thumb-${useId().replace(/[:«»]/g, "")}`;
  return (
    <svg viewBox="26 14 148 148" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <radialGradient id={bg} cx=".5" cy=".42" r=".6">
          <stop stopColor="#fff2f8" />
          <stop offset="1" stopColor="#f6d3ea" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="88" r="74" fill={`url(#${bg})`} />
      <BambyBody pose="idle" expression="wink" playing={false} x={0} y={0} width={200} height={236} />
    </svg>
  );
}
