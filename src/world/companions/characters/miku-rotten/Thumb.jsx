import { useId } from "react";
import { Figure } from "./Body.jsx";
import "./miku-rotten.css";

// Her portrait for the settings picker: the same drawing as the body, framed on head and bow, with
// a soft lilac disc behind. Still (no clocks), so a row of thumbs costs nothing.
export default function Thumb({ size = 64, expression = "happy", className }) {
  const id = useId();
  return (
    <svg
      className={`mr mr-thumb${className ? ` ${className}` : ""}`}
      viewBox="30 14 160 160"
      width={size}
      height={size}
      data-pose="idle"
      data-motion="off"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`${id}-disc`}>
          <circle cx="110" cy="94" r="80" />
        </clipPath>
        <radialGradient id={`${id}-bg`} cx=".5" cy=".42" r=".6">
          <stop stopColor="#fbf8ff" />
          <stop offset="1" stopColor="#e6dcf8" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="94" r="80" fill={`url(#${id}-bg)`} />
      <g clipPath={`url(#${id}-disc)`}>
        <Figure pose="idle" expression={expression} moving={false} />
      </g>
    </svg>
  );
}
