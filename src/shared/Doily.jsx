import "./Doily.css";

// A lace doily frame: scalloped edge, a ring of eyelets, a dotted inner stitch.
function scallopPath(cx, cy, radius, bumps) {
  const point = (i) => {
    const a = (Math.PI * 2 * i) / bumps - Math.PI / 2;
    return `${(cx + radius * Math.cos(a)).toFixed(2)} ${(cy + radius * Math.sin(a)).toFixed(2)}`;
  };
  const bump = (radius * Math.sin(Math.PI / bumps) * 1.08).toFixed(2);
  let d = `M${point(0)}`;
  for (let i = 1; i <= bumps; i++) d += `A${bump} ${bump} 0 0 1 ${point(i)}`;
  return `${d}z`;
}

const EDGE = scallopPath(100, 100, 90, 24);
const EYELETS = Array.from({ length: 24 }, (_, i) => {
  const a = (Math.PI * 2 * (i + 0.5)) / 24 - Math.PI / 2;
  return [100 + 86 * Math.cos(a), 100 + 86 * Math.sin(a)];
});

export default function Doily({ children, size = 128, className = "" }) {
  return (
    <div className={`doily ${className}`} style={{ "--doily-size": `${size}px` }}>
      <svg className="doily__frame" viewBox="0 0 200 200" aria-hidden="true">
        <path d={EDGE} className="doily__edge" />
        {EYELETS.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="3" className="doily__eyelet" />
        ))}
        <circle cx="100" cy="100" r="74" className="doily__stitch" />
      </svg>
      <div className="doily__photo">{children}</div>
    </div>
  );
}
