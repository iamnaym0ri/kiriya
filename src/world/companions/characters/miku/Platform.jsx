import { useId } from "react";
import "./miku.css";

// Miku's cloud: a soft mint-white cloud with a teal melody line running through it and two little
// notes that ride along. It pops in puff by puff from the middle ("forming"), bobs while she uses it
// ("steady"), and drifts apart into notes as it goes ("fading"). Drawn in CSS px at the width the
// engine asks for; the top centre of the box sits at her feet, and she sinks SURFACE px into it.

const HEIGHT = 28;
const SURFACE = 6;

function layout(width) {
  const count = Math.max(3, Math.round(width / 17));
  const inset = 9;
  const span = Math.max(1, width - inset * 2);
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const middle = 1 - Math.abs(t - 0.5) * 2; // 1 at the centre, 0 at the ends
    return {
      x: inset + span * t,
      y: 12 - middle * 2.5 + (i % 2 ? 1.6 : 0),
      r: 7.5 + middle * 3.2 + (i % 2 ? 0 : 1),
      // forming pops from the middle out; fading leaves from the ends in
      order: Math.abs(t - 0.5),
    };
  });
}

export default function MikuPlatform({ width = 110, state = "steady" }) {
  const raw = useId();
  const uid = `hmc${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const w = Math.max(40, width);
  const puffs = layout(w);
  const base = { x: 3, y: 10, w: w - 6, h: 15, r: 8 };
  // a gentle wave across the front: the melody line
  const steps = Math.max(2, Math.round((w - 24) / 14));
  let wave = `M12 18.5`;
  for (let i = 0; i < steps; i += 1) {
    const x0 = 12 + ((w - 24) * i) / steps;
    const x1 = 12 + ((w - 24) * (i + 1)) / steps;
    wave += ` Q${(x0 + x1) / 2} ${i % 2 ? 21.5 : 15.5} ${x1} 18.5`;
  }
  return (
    <svg
      className="hmiku-cloud"
      data-state={state}
      width={w}
      height={HEIGHT}
      viewBox={`0 0 ${w} ${HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset=".25" stopColor="#ffffff" />
          <stop offset=".75" stopColor="#e6f8f6" />
          <stop offset="1" stopColor="#c9ece9" />
        </linearGradient>
      </defs>
      <ellipse className="hmiku-cloud__shade" cx={w / 2} cy={HEIGHT - 2} rx={w * 0.42} ry="2.2" fill="#6c5f93" opacity=".12" />
      <g className="hmiku-cloud__body">
        {/* outline underlay, then the fills on top, so the puffs merge into one soft silhouette */}
        <g fill="#a9dcdc" stroke="#a9dcdc" strokeWidth="2.4">
          <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={base.r} className="hmiku-cloud__base" />
          {puffs.map((p, i) => (
            <circle key={i} className="hmiku-cloud__puff" cx={p.x} cy={p.y} r={p.r} style={puffStyle(p)} />
          ))}
        </g>
        <g fill={`url(#${uid}-fill)`}>
          <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={base.r} className="hmiku-cloud__base" />
          {puffs.map((p, i) => (
            <circle key={i} className="hmiku-cloud__puff" cx={p.x} cy={p.y} r={p.r} style={puffStyle(p)} />
          ))}
        </g>
        {/* soft highlights on the tops of the bigger puffs */}
        <g fill="#ffffff" opacity=".9">
          {puffs
            .filter((_, i) => i % 2 === 0)
            .map((p, i) => (
              <ellipse key={i} className="hmiku-cloud__puff" cx={p.x - p.r * 0.25} cy={p.y - p.r * 0.45} rx={p.r * 0.45} ry={p.r * 0.22} style={puffStyle(p)} />
            ))}
        </g>
        <path className="hmiku-cloud__wave" d={wave} fill="none" stroke="#2dbebe" strokeWidth="1.5" strokeLinecap="round" opacity=".65" pathLength="1" />
        <path className="hmiku-cloud__wave hmiku-cloud__wave--2" d={wave} transform="translate(0 2.6)" fill="none" stroke="#e8489b" strokeWidth=".9" strokeLinecap="round" opacity=".35" pathLength="1" />
      </g>
      <g className="hmiku-cloud__notes">
        <g transform={`translate(${Math.min(10, w * 0.1)} 9)`}>
          <g className="hmiku-cloud__note hmiku-cloud__note--1">
            <ellipse rx="2.4" ry="1.8" transform="rotate(-20)" fill="#2dbebe" />
            <path d="M2-.8v-7.4q2.4 1 3.4 3.6" fill="none" stroke="#2dbebe" strokeWidth="1.1" strokeLinecap="round" />
          </g>
        </g>
        <g transform={`translate(${w - Math.min(14, w * 0.14)} 8)`}>
          <g className="hmiku-cloud__note hmiku-cloud__note--2">
            <ellipse rx="2.2" ry="1.7" transform="rotate(-20)" fill="#e8489b" />
            <path d="M1.9-.8v-6.8" fill="none" stroke="#e8489b" strokeWidth="1.1" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function puffStyle(p) {
  return {
    transformOrigin: `${p.x}px ${p.y + p.r}px`,
    "--hmc-delay": `${Math.round(p.order * 260)}ms`,
    "--hmc-out": `${Math.round((0.5 - p.order) * 300)}ms`,
  };
}

MikuPlatform.surface = SURFACE;
MikuPlatform.height = HEIGHT;
// How long the forming and fading animations take, for an engine that wants to wait for them.
MikuPlatform.timing = { forming: 520, fading: 760 };
