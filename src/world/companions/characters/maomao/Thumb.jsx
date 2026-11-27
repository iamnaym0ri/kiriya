import { useId } from "react";
import {
  MaomaoBackHair,
  MaomaoBraids,
  MaomaoBun,
  MaomaoDefs,
  MaomaoHead,
} from "../../../mascot/MaomaoMascot.jsx";
import { COLLAR, INNER, ROBE, ROBE_DARK } from "./palette.js";
import { Sprig } from "./props.jsx";

/** Her portrait for the picker in settings: head and shoulders on a soft sage circle. */
export default function Thumb({ size = 64, expression = "pleased" }) {
  const uid = `mmt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="22 6 156 156" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <MaomaoDefs id={uid} />
      <clipPath id={`${uid}-round`}>
        <circle cx="100" cy="84" r="78" />
      </clipPath>
      <circle cx="100" cy="84" r="78" fill="#e4eee0" />
      <g clipPath={`url(#${uid}-round)`}>
        <Sprig transform="translate(44 168) rotate(-30) scale(1.1)" />
        <MaomaoBackHair id={uid} />
        <path d="M82 143h36l22 22 4 30H56l4-30Z" fill={ROBE} stroke={ROBE_DARK} strokeWidth="1.4" />
        <path d="m84 146 16 17 16-17-6-6H90Z" fill={INNER} />
        <path d="m85 146 15 17m17-17-24 41" stroke={COLLAR} strokeWidth="6" fill="none" />
        <MaomaoBun id={uid} />
        <MaomaoHead id={uid} expression={expression} moving={false} />
        <MaomaoBraids />
      </g>
      <circle cx="100" cy="84" r="77" fill="none" stroke="#b9cdb3" strokeWidth="2" />
    </svg>
  );
}
