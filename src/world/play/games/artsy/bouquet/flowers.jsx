import { deep, light, mix } from "./colour.js";

// Every flower, drawn for this game around its own centre (0, 0) in bouquet units (the bouquet is a
// 300 × 400 card). `base` is where its stem leaves the head, `box` the part a tray thumbnail shows,
// `role` how it likes to sit (bloom: the middle; little: around; green: behind, at the rim; extra:
// a pick tucked in), `colors` its colour choices. Original drawings, soft cel shading, plum ink.
export const INK = "#5b4569";
const ink = { stroke: INK, strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round" };
const thin = { stroke: INK, strokeWidth: 1, strokeLinejoin: "round", strokeLinecap: "round" };
const ring = (n, from = 0) => Array.from({ length: n }, (_, i) => from + (360 / n) * i);

/** A rounded petal from the centre out along -y. */
const roundPetal = (len, wid, from = 0) => `M0 ${-from}C${-wid} ${-from - len * 0.15} ${-wid * 1.12} ${-from - len} 0 ${-from - len}C${wid * 1.12} ${-from - len} ${wid} ${-from - len * 0.15} 0 ${-from}Z`;
/** A pointed petal (lily, leaves). */
const pointPetal = (len, wid, from = 0) => `M0 ${-from}C${-wid} ${-from - len * 0.3} ${-wid * 0.6} ${-from - len * 0.8} 0 ${-from - len}C${wid * 0.6} ${-from - len * 0.8} ${wid} ${-from - len * 0.3} 0 ${-from}Z`;
/** A petal with a little notch at its tip (cosmos, cherry blossom). */
const notchPetal = (len, wid) => `M0 0C${-wid} ${-len * 0.2} ${-wid * 1.15} ${-len * 0.92} ${-wid * 0.42} ${-len}Q0 ${-len * 0.86} ${wid * 0.42} ${-len}C${wid * 1.15} ${-len * 0.92} ${wid} ${-len * 0.2} 0 0Z`;
/** A ruffled circle (carnations, peony centres): `n` scallops between radius r and r - depth. */
function ruffle(r, n, depth, wobble = 0) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const mid = (Math.PI * 2 * (i - 0.5)) / n;
    const rr = r - (i % 3 === 0 ? wobble : 0);
    const p = [Math.cos(a) * rr, Math.sin(a) * rr];
    const q = [Math.cos(mid) * (r + depth * 0.35), Math.sin(mid) * (r + depth * 0.35)];
    d += i === 0 ? `M${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  }
  return `${d}Z`;
}
const Shine = ({ d, w = 2, o = 0.65 }) => <path d={d} fill="none" stroke="#fff" strokeOpacity={o} strokeWidth={w} strokeLinecap="round" />;

// ---------------------------------------------------------------- blooms
function Rose({ c }) {
  const d = deep(c, 0.32), m = mix(c, d, 0.45), l = light(c, 0.55);
  return (
    <g>
      {ring(6, 30).map((a) => <path key={a} d={roundPetal(25, 15)} transform={`rotate(${a})`} fill={c} {...ink} />)}
      {ring(6, 0).map((a) => <path key={`s${a}`} d={roundPetal(18, 6, 4)} transform={`rotate(${a})`} fill={m} opacity="0.45" />)}
      <circle r="16" fill={m} {...ink} />
      <path d="M-14 3C-15-9-3-17 8-12C15-8 15 2 9 8C4 12-4 12-8 8" fill={c} {...ink} />
      <path d="M-8 4C-10-4-2-10 5-7C10-4 10 3 5 6" fill={l} {...thin} />
      <path d="M-3 3C-4-1 0-4 3-2C5 0 4 3 1 4" fill="none" stroke={d} strokeWidth="1.4" strokeLinecap="round" />
      <Shine d="M-19-8C-15-17-6-21 2-21" />
    </g>
  );
}
function Peony({ c }) {
  const d = deep(c, 0.28), l = light(c, 0.5), m = mix(c, d, 0.35);
  return (
    <g>
      {ring(9, 10).map((a) => <path key={a} d={roundPetal(29, 12)} transform={`rotate(${a})`} fill={c} {...ink} />)}
      {ring(9, 30).map((a) => <path key={`s${a}`} d={roundPetal(20, 4, 6)} transform={`rotate(${a})`} fill={d} opacity="0.22" />)}
      <path d={ruffle(19, 14, 5, 1.5)} fill={l} {...ink} />
      <path d={ruffle(13, 11, 4)} fill={c} {...thin} />
      <path d={ruffle(8, 8, 3)} fill={m} {...thin} />
      <circle r="3.2" fill={light(c, 0.75)} />
      <Shine d="M-22-12C-17-21-8-25 0-25" w={2.2} />
    </g>
  );
}
function Ranunculus({ c }) {
  const d = deep(c, 0.3);
  const rings = [24, 20, 16, 12, 8.5, 5.5];
  return (
    <g>
      {rings.map((r, i) => (
        <g key={r}>
          <circle r={r} fill={i % 2 ? mix(c, "#ffffff", 0.18) : c} {...(i === 0 ? ink : thin)} />
          <path d={`M${-r * 0.8} ${r * 0.45}A${r} ${r} 0 0 0 ${r * 0.8} ${r * 0.45}`} fill="none" stroke={d} strokeOpacity="0.35" strokeWidth="1.6" />
        </g>
      ))}
      <circle r="2.6" fill="#8fbf7a" stroke={INK} strokeWidth="0.8" />
      <Shine d="M-18-10C-14-17-7-21 0-21" />
    </g>
  );
}
function Tulip({ c }) {
  const d = deep(c, 0.3), l = light(c, 0.45);
  return (
    <g>
      <path d="M2 18C10 8 20 4 26 6C20 12 12 18 4 22Z" fill="#8cc47e" {...ink} />
      <path d="M-15 10C-19-6-14-22 0-28C14-22 19-6 15 10C9 17-9 17-15 10Z" fill={c} {...ink} />
      <path d="M-15 10C-17-4-12-16-4-22C-6-8-4 4 0 15C-6 16-11 14-15 10Z" fill={d} opacity="0.3" />
      <path d="M-9 12C-12-2-8-16 0-24C8-16 12-2 9 12C4 16-4 16-9 12Z" fill={l} {...thin} />
      <path d="M0-22V13" stroke={d} strokeOpacity="0.4" strokeWidth="1.2" />
      <Shine d="M-11-4C-11-12-7-19-3-23" w={1.8} />
    </g>
  );
}
function Lily({ c }) {
  const d = deep(c, 0.32), l = light(c, 0.6);
  return (
    <g>
      {ring(6, 0).map((a, i) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d={pointPetal(i % 2 ? 26 : 29, 9)} fill={i % 2 ? mix(c, d, 0.18) : c} {...ink} />
          <path d={`M0-4V${i % 2 ? -22 : -25}`} stroke={l} strokeWidth="1.6" strokeLinecap="round" />
          {[-9, -14, -18].map((y) => <circle key={y} cx={(y % 2 ? 1.8 : -1.8)} cy={y} r="0.9" fill={d} />)}
        </g>
      ))}
      {ring(6, 30).map((a) => (
        <g key={`st${a}`} transform={`rotate(${a})`}>
          <path d="M0 0V-15" stroke="#9fbf6e" strokeWidth="1" />
          <ellipse cy="-16" rx="1.4" ry="2.6" fill="#c97a3a" />
        </g>
      ))}
      <circle r="3" fill="#cfe39c" stroke={INK} strokeWidth="0.8" />
    </g>
  );
}
function Hydrangea({ c }) {
  const spots = [[0, 0], [-10, -6], [10, -6], [0, -13], [-12, 6], [12, 6], [0, 12], [-19, -2], [19, -2], [-8, -18], [8, -18], [-16, 14], [16, 14], [-6, 20], [7, 20], [-20, -14], [20, -13]];
  const tones = [c, light(c, 0.3), mix(c, deep(c, 0.4), 0.3), light(c, 0.15)];
  return (
    <g>
      <circle r="25" fill={mix(c, deep(c, 0.5), 0.35)} {...ink} />
      {spots.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i * 23})`}>
          {[0, 90, 180, 270].map((a) => <path key={a} d={roundPetal(5.8, 3.6)} transform={`rotate(${a})`} fill={tones[i % tones.length]} {...thin} strokeWidth="0.8" />)}
          <circle r="1" fill={deep(c, 0.5)} />
        </g>
      ))}
      <Shine d="M-20-12C-15-20-6-24 2-24" />
    </g>
  );
}
function Carnation({ c }) {
  const d = deep(c, 0.3), l = light(c, 0.45);
  return (
    <g>
      <path d={ruffle(25, 22, 6, 2)} fill={c} {...ink} />
      <path d={ruffle(19, 18, 5, 1.5)} fill={l} {...thin} />
      <path d={ruffle(13, 14, 4)} fill={c} {...thin} />
      <path d={ruffle(7, 9, 3)} fill={mix(c, d, 0.4)} {...thin} />
      {ring(8, 12).map((a) => <path key={a} d="M0-8V-22" transform={`rotate(${a})`} stroke={d} strokeOpacity="0.3" strokeWidth="1" />)}
      <Shine d="M-19-10C-15-18-7-22 1-22" w={1.8} />
    </g>
  );
}
function Cosmos({ c }) {
  const d = deep(c, 0.3);
  return (
    <g>
      {ring(8, 0).map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d={notchPetal(25, 8.5)} fill={c} {...ink} />
          <path d="M0-4V-20M-3-6L-4-18M3-6L4-18" stroke={d} strokeOpacity="0.28" strokeWidth="0.9" />
        </g>
      ))}
      <circle r="6.5" fill="#f4c84e" {...ink} />
      {ring(10, 0).map((a) => <circle key={a} cx="0" cy="-4.2" r="1" transform={`rotate(${a})`} fill="#d99a2b" />)}
    </g>
  );
}
function Sunflower({ c }) {
  return (
    <g>
      {ring(14, 13).map((a) => <path key={`b${a}`} d={pointPetal(25, 6)} transform={`rotate(${a})`} fill={deep(c, 0.12)} {...thin} />)}
      {ring(14, 0).map((a) => <path key={a} d={pointPetal(23, 6)} transform={`rotate(${a})`} fill={c} {...ink} />)}
      <circle r="11" fill="#7a4a2e" {...ink} />
      <circle r="7" fill="#5a3322" />
      {ring(12, 0).map((a) => <circle key={`d${a}`} cy="-8.5" r="0.9" transform={`rotate(${a})`} fill="#c99052" />)}
    </g>
  );
}

// ---------------------------------------------------------------- little flowers
function Daisy({ c }) {
  return (
    <g>
      {ring(14, 0).map((a) => <path key={a} d={roundPetal(15, 3.4)} transform={`rotate(${a})`} fill={c} {...thin} />)}
      <circle r="5.5" fill="#f6cf55" {...ink} />
      <circle cx="-1.4" cy="-1.6" r="1.6" fill="#fff4c2" />
    </g>
  );
}
function ForgetMeNot({ c }) {
  const spots = [[0, -4, 1], [-11, 3, 0.9], [10, 4, 0.95], [-4, 12, 0.8], [7, -14, 0.75], [-9, -13, 0.7]];
  return (
    <g>
      {spots.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${i * 17})`}>
          {ring(5, 0).map((a) => <circle key={a} cy="-4.6" r="3.6" transform={`rotate(${a})`} fill={i % 2 ? light(c, 0.2) : c} {...thin} strokeWidth="0.9" />)}
          <circle r="2" fill="#fbe38a" stroke={INK} strokeWidth="0.6" />
        </g>
      ))}
    </g>
  );
}
function Lavender({ c }) {
  const buds = [];
  for (let i = 0; i < 11; i++) {
    const y = 14 - i * 5;
    const s = 1 - i * 0.05;
    buds.push([-3.4 * s, y, s, -24], [3.4 * s, y - 2, s, 24]);
  }
  return (
    <g>
      <path d="M0 24V-40" stroke="#7aa36a" strokeWidth="1.6" strokeLinecap="round" />
      {buds.map(([x, y, s, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={2.6 * s} ry={4.4 * s} transform={`rotate(${r} ${x} ${y})`} fill={i % 3 ? c : deep(c, 0.2)} {...thin} strokeWidth="0.8" />
      ))}
      <ellipse cx="0" cy="-42" rx="1.8" ry="3" fill={light(c, 0.25)} {...thin} strokeWidth="0.8" />
    </g>
  );
}
function BabysBreath({ c }) {
  const twigs = ["M0 22C0 8-2-6-10-20", "M0 10C4 0 10-8 16-18", "M-2 0C-8-6-16-8-22-14", "M2-4C2-14 4-24 2-34", "M6-6C12-6 18-2 22 2"];
  const dots = [[-10, -20], [-13, -24], [-7, -25], [16, -18], [19, -22], [13, -23], [-22, -14], [-25, -10], [-19, -18], [2, -34], [-2, -38], [6, -37], [22, 2], [25, -2], [20, -3], [-4, -28], [9, -28], [-16, -5], [12, -11], [0, -18]];
  return (
    <g>
      {twigs.map((d) => <path key={d} d={d} fill="none" stroke="#8fae7c" strokeWidth="1.1" strokeLinecap="round" />)}
      {dots.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i % 4 ? 2.6 : 3.2} fill={i % 3 ? c : light(c, 0.4)} stroke={INK} strokeWidth="0.6" />
          <circle cx={x - 0.6} cy={y - 0.6} r="0.8" fill="#fff" opacity="0.8" />
        </g>
      ))}
    </g>
  );
}
function SweetPea({ c }) {
  const d = deep(c, 0.3), l = light(c, 0.45);
  return (
    <g>
      <path d="M-2 18C-6 10-6 2-2-2" fill="none" stroke="#8cc47e" strokeWidth="1.4" />
      <path d="M0-2C-18-2-24-18-16-26C-10-30-2-26 0-18C2-26 10-30 16-26C24-18 18-2 0-2Z" fill={c} {...ink} />
      <path d="M-14-22C-10-24-6-20-4-14M14-22C10-24 6-20 4-14" fill="none" stroke={d} strokeOpacity="0.4" strokeWidth="1" />
      <path d="M0-2C-8-2-12 6-8 12C-4 16 4 16 8 12C12 6 8-2 0-2Z" fill={l} {...ink} />
      <path d="M-4 4C-2 8 2 8 4 4" fill="none" stroke={d} strokeOpacity="0.5" strokeWidth="1" />
      <path d="M6 10C12 14 16 22 14 28" fill="none" stroke="#8cc47e" strokeWidth="1" />
      <Shine d="M-17-18C-17-23-13-27-9-27" w={1.6} />
    </g>
  );
}
function CherryBlossom({ c }) {
  const flowers = [[-8, -16, 1], [10, -2, 0.9], [-4, 10, 0.75]];
  return (
    <g>
      <path d="M-14 24C-6 10 0 0 4-10C6-18 10-26 16-34M2-2C-4-8-10-14-14-26" fill="none" stroke="#7a5442" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="15" cy="-34" rx="3" ry="4" fill={light(c, 0.1)} {...thin} transform="rotate(30 15 -34)" />
      <ellipse cx="-14" cy="-28" rx="2.6" ry="3.6" fill={c} {...thin} transform="rotate(-20 -14 -28)" />
      {flowers.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${i * 30})`}>
          {ring(5, 0).map((a) => <path key={a} d={notchPetal(10, 5.4)} transform={`rotate(${a})`} fill={i === 1 ? light(c, 0.3) : c} {...thin} />)}
          <circle r="2.6" fill={deep(c, 0.35)} />
          {ring(6, 0).map((a) => <circle key={`s${a}`} cy="-4" r="0.7" transform={`rotate(${a})`} fill="#f0c25a" />)}
        </g>
      ))}
    </g>
  );
}
function LilacSprig({ c }) {
  const florets = [];
  for (let row = 0; row < 8; row++) {
    const n = Math.max(2, 5 - Math.floor(row / 2));
    for (let i = 0; i < n; i++) {
      const spread = 13 - row * 1.4;
      const x = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1) + (row % 2 ? 2 : -2);
      florets.push([x, 8 - row * 6, row]);
    }
  }
  const tones = [c, light(c, 0.3), deep(c, 0.12)];
  return (
    <g>
      <path d="M0 26V-40" stroke="#7aa36a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0 18C-10 14-16 16-20 22C-12 24-6 22 0 18Z" fill="#8cc47e" {...thin} />
      {florets.map(([x, y, row], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i * 31})`}>
          {[0, 90, 180, 270].map((a) => <path key={a} d={roundPetal(3.8, 2.4)} transform={`rotate(${a})`} fill={tones[(i + row) % 3]} stroke={INK} strokeWidth="0.6" />)}
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- greenery
function Eucalyptus({ c }) {
  const leaves = [[0, 16, 0], [-7, 6, -1], [7, -2, 1], [-7, -10, -1], [7, -18, 1], [-5, -27, -1], [4, -35, 1], [0, -42, 0]];
  return (
    <g>
      <path d="M0 26C-1 10 1-14 0-44" fill="none" stroke={deep(c, 0.4)} strokeWidth="1.4" strokeLinecap="round" />
      {leaves.map(([x, y, side], i) => {
        const r = 8 - i * 0.55;
        return (
          <g key={i}>
            <circle cx={x + side * 2} cy={y} r={r} fill={i % 2 ? c : light(c, 0.18)} {...thin} />
            <path d={`M${x + side * 2 - r * 0.5} ${y + r * 0.2}Q${x + side * 2} ${y - r * 0.3} ${x + side * 2 + r * 0.5} ${y + r * 0.1}`} fill="none" stroke={deep(c, 0.3)} strokeOpacity="0.5" strokeWidth="0.8" />
          </g>
        );
      })}
    </g>
  );
}
function Fern({ c }) {
  const pairs = Array.from({ length: 10 }, (_, i) => [-36 + i * 6.4, 10 - i * 0.7]);
  return (
    <g>
      <path d="M0 26C2 6 0-20-4-44" fill="none" stroke={deep(c, 0.35)} strokeWidth="1.4" strokeLinecap="round" />
      {pairs.map(([y, len], i) => {
        const x = -4 + (y + 44) * 0.06;
        return (
          <g key={i} transform={`translate(${x} ${-y - 18})`}>
            <path d={pointPetal(len, 2.6)} transform="rotate(-62)" fill={i % 2 ? c : light(c, 0.15)} {...thin} strokeWidth="0.8" />
            <path d={pointPetal(len, 2.6)} transform="rotate(62)" fill={i % 2 ? light(c, 0.15) : c} {...thin} strokeWidth="0.8" />
          </g>
        );
      })}
    </g>
  );
}
function Leaves({ c }) {
  return (
    <g>
      {[-26, 0, 24].map((a, i) => (
        <g key={a} transform={`rotate(${a} 0 20)`}>
          <path d="M0 22C-9 8-10-20 0-40C10-20 9 8 0 22Z" fill={i === 1 ? c : light(c, 0.12)} {...ink} />
          <path d="M0 18V-34M0 4L-5-2M0-8L5-14M0-18L-4-24" fill="none" stroke={deep(c, 0.35)} strokeOpacity="0.55" strokeWidth="0.9" />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- extras
function HeartPick({ c }) {
  return (
    <g>
      <path d="M0 26V0" stroke="#c9a46a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M0 4C-14-6-20-14-15-21C-11-26-4-24 0-18C4-24 11-26 15-21C20-14 14-6 0 4Z" fill={c} {...ink} />
      <path d="M-11-17C-9-21-5-21-3-18" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}
function PearlSpray({ c }) {
  const wires = [[-14, -30], [0, -40], [14, -28], [-22, -14], [22, -12], [-6, -22], [8, -18]];
  return (
    <g>
      {wires.map(([x, y]) => <path key={`${x}${y}`} d={`M0 22Q${x * 0.3} 0 ${x} ${y}`} fill="none" stroke="#c9b48a" strokeWidth="0.9" />)}
      {wires.map(([x, y], i) => (
        <g key={`p${x}${y}`}>
          <circle cx={x} cy={y} r={i % 2 ? 3.4 : 4.2} fill={c} stroke={INK} strokeWidth="0.8" />
          <circle cx={x - 1.2} cy={y - 1.3} r="1.2" fill="#fff" opacity="0.9" />
        </g>
      ))}
    </g>
  );
}
function Butterfly({ c }) {
  const d = deep(c, 0.3);
  return (
    <g>
      <path d="M0 28C2 14 0 4 0-2" fill="none" stroke="#9a8c7a" strokeWidth="0.9" />
      <g transform="rotate(-10)">
        <path d="M0-6C-6-22-24-26-24-12C-24-4-12 0 0-2Z" fill={c} {...ink} />
        <path d="M0-2C-10 0-18 8-14 14C-10 18-2 10 0 0Z" fill={light(c, 0.3)} {...ink} />
        <path d="M0-6C6-22 24-26 24-12C24-4 12 0 0-2Z" fill={c} {...ink} />
        <path d="M0-2C10 0 18 8 14 14C10 18 2 10 0 0Z" fill={light(c, 0.3)} {...ink} />
        <circle cx="-15" cy="-14" r="3" fill={d} opacity="0.5" />
        <circle cx="15" cy="-14" r="3" fill={d} opacity="0.5" />
        <path d="M0-10V8" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M0-10C-2-16-4-18-6-19M0-10C2-16 4-18 6-19" fill="none" stroke={INK} strokeWidth="0.9" strokeLinecap="round" />
      </g>
    </g>
  );
}
function StarPick({ c }) {
  return (
    <g>
      <path d="M0 26V2" stroke="#c9a46a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M0-24L5-12 18-11 8-3 11 10 0 3-11 10-8-3-18-11-5-12Z" fill={c} {...ink} />
      <path d="M-4-12L0-20" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

const BLOOM = { base: [0, 14], box: [-30, -30, 60, 60] };
const SPRIG = { base: [0, 24], box: [-26, -46, 52, 72] };
export const FLOWERS = [
  { id: "rose", name: "rose", many: "roses", role: "bloom", Draw: Rose, ...BLOOM, colors: ["#f59ab9", "#e8577f", "#fff1e6", "#c9b1ee", "#ffcf8a", "#b7334f"] },
  { id: "peony", name: "peony", many: "peonies", role: "bloom", Draw: Peony, ...BLOOM, colors: ["#ffc2d6", "#f6a9c7", "#fff4ee", "#e590b8", "#d9c4f5"] },
  { id: "ranunculus", name: "ranunculus", many: "ranunculus", role: "bloom", Draw: Ranunculus, ...BLOOM, colors: ["#ffb9a3", "#ffe1a6", "#f6a9c7", "#fff6f0", "#e98aa6"] },
  { id: "tulip", name: "tulip", many: "tulips", role: "bloom", Draw: Tulip, ...BLOOM, box: [-28, -32, 58, 58], colors: ["#f37a9b", "#ffd36b", "#c9a8f0", "#fff3f6", "#ff9e7a"] },
  { id: "lily", name: "lily", many: "lilies", role: "bloom", Draw: Lily, ...BLOOM, colors: ["#fff6f8", "#ffc8dc", "#ffd7a8", "#efe0ff"] },
  { id: "hydrangea", name: "hydrangea", many: "hydrangeas", role: "bloom", Draw: Hydrangea, ...BLOOM, colors: ["#b9c6f5", "#d9b8f0", "#f6c1d8", "#c8e9e0", "#f2f0fb"] },
  { id: "carnation", name: "carnation", many: "carnations", role: "bloom", Draw: Carnation, ...BLOOM, colors: ["#f7a1bd", "#ff6f86", "#fff0f4", "#e7c5ff", "#ffcfa3"] },
  { id: "cosmos", name: "cosmos", many: "cosmos", role: "bloom", Draw: Cosmos, ...BLOOM, colors: ["#f7b3d2", "#ffffff", "#e77fb0", "#c8a5ec"] },
  { id: "sunflower", name: "sunflower", many: "sunflowers", role: "bloom", Draw: Sunflower, ...BLOOM, colors: ["#ffd04d", "#ffb84a", "#fff0a8"] },
  { id: "daisy", name: "daisy", many: "daisies", role: "little", Draw: Daisy, base: [0, 6], box: [-20, -20, 40, 40], colors: ["#ffffff", "#ffd6e6", "#e6dcff", "#fff1b8"] },
  { id: "forget", name: "forget-me-nots", many: "forget-me-nots", role: "little", Draw: ForgetMeNot, base: [0, 14], box: [-20, -24, 40, 44], colors: ["#9cc0f2", "#f2b6d4", "#c8b4f2", "#ffffff"] },
  { id: "lavender", name: "lavender", many: "lavender", role: "little", Draw: Lavender, ...SPRIG, colors: ["#a98ad9", "#c7b0ef", "#8f73c9", "#f0b8d6"] },
  { id: "lilac", name: "lilac", many: "lilac", role: "little", Draw: LilacSprig, ...SPRIG, colors: ["#c9a8ec", "#e2cff7", "#f6f0ff", "#b38ad9"] },
  { id: "babys-breath", name: "baby’s breath", many: "baby’s breath", role: "little", Draw: BabysBreath, ...SPRIG, colors: ["#ffffff", "#ffe3ef", "#efe6ff"] },
  { id: "sweet-pea", name: "sweet pea", many: "sweet peas", role: "little", Draw: SweetPea, base: [0, 20], box: [-26, -32, 52, 62], colors: ["#f2a0c9", "#c8a8f2", "#fff0f6", "#ff9db0", "#b38ad9"] },
  { id: "cherry", name: "cherry blossom", many: "cherry blossoms", role: "little", Draw: CherryBlossom, base: [-12, 24], box: [-26, -40, 52, 66], colors: ["#ffc9da", "#fff0f5", "#f59ab9"] },
  { id: "eucalyptus", name: "eucalyptus", many: "eucalyptus", role: "green", quiet: true, Draw: Eucalyptus, ...SPRIG, colors: ["#a8c7b3", "#9fb9c4", "#bfd6a8"] },
  { id: "fern", name: "fern", many: "ferns", role: "green", quiet: true, Draw: Fern, ...SPRIG, colors: ["#8cc47e", "#6fae76", "#a9d18e"] },
  { id: "leaves", name: "leaves", many: "leaves", role: "green", quiet: true, Draw: Leaves, base: [0, 22], box: [-30, -44, 60, 70], colors: ["#86bd7c", "#a7cf96", "#6fa58a"] },
  { id: "heart-pick", name: "heart pick", many: "heart picks", role: "extra", quiet: true, Draw: HeartPick, base: [0, 26], box: [-22, -28, 44, 58], colors: ["#ff7fa6", "#c9a8f0", "#ffd6e6", "#e8577f"] },
  { id: "pearls", name: "pearl spray", many: "pearl sprays", role: "extra", quiet: true, Draw: PearlSpray, base: [0, 22], box: [-28, -44, 56, 70], colors: ["#fffaf2", "#ffe3ef", "#efe2ff"] },
  { id: "butterfly", name: "butterfly", many: "butterflies", role: "extra", quiet: true, Draw: Butterfly, base: [0, 28], box: [-26, -28, 52, 58], colors: ["#c9a8f0", "#f6a9c7", "#a9dcc8", "#ffd36b"] },
  { id: "star-pick", name: "star pick", many: "star picks", role: "extra", quiet: true, Draw: StarPick, base: [0, 26], box: [-20, -26, 40, 54], colors: ["#ffd86b", "#f6a9c7", "#c9b1ee"] },
];
export const flowerById = (id) => FLOWERS.find((flower) => flower.id === id) ?? null;
export const roleOf = (kind) => flowerById(kind)?.role ?? "bloom";
export const nameOf = (kind) => {
  const flower = flowerById(kind);
  return flower ? { one: flower.name, many: flower.many, quiet: Boolean(flower.quiet) } : null;
};
