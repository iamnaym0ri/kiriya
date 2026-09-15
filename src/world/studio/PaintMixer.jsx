import { useEffect, useMemo, useState } from "react";
import "./PaintMixer.css";

const toHex = (rgb) => `#${rgb.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// Real pigment-style mixing with Mixbox: blue + yellow makes green, like actual paint, not grey.
// Mixbox © 2022 Secret Weapons, CC BY-NC 4.0.
export default function PaintMixer({ palette, onUse }) {
  const [mixbox, setMixbox] = useState(null);
  const [a, setA] = useState(palette[0]);
  const [b, setB] = useState(palette[3]);
  const [t, setT] = useState(0.5);

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    import("mixbox")
      .then((m) => setMixbox(m.default ?? m))
      .catch(() => setLoadError(true));
  }, []);

  const mixed = useMemo(() => (mixbox ? toHex(mixbox.lerp(a, b, t)) : null), [mixbox, a, b, t]);
  const steps = useMemo(() => (mixbox ? [0, 0.2, 0.4, 0.6, 0.8, 1].map((x) => toHex(mixbox.lerp(a, b, x))) : []), [mixbox, a, b]);

  return (
    <section className="mixer" aria-labelledby="mixer-title">
      <h2 id="mixer-title" className="mixer__title">
        Paint mixing
      </h2>
      <p className="mixer__hint">Pick two paints and slide to mix them like real pigment.</p>
      <div className="mixer__wells">
        {[
          [a, setA, "First paint"],
          [b, setB, "Second paint"],
        ].map(([value, set, label]) => (
          <fieldset key={label} className="mixer__well">
            <legend className="mixer__legend">
              <span className="mixer__legend-dot" style={{ background: value }} aria-hidden="true" />
              {label}
            </legend>
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className="mixer__swatch"
                style={{ background: swatch }}
                aria-label={`${label}: ${swatch}`}
                aria-pressed={value === swatch}
                onClick={() => set(swatch)}
              />
            ))}
          </fieldset>
        ))}
      </div>
      <div className="mixer__result">
        <div className="mixer__ramp" aria-hidden="true">
          {steps.map((step, i) => (
            <span key={i} style={{ background: step }} />
          ))}
        </div>
        <input type="range" min="0" max="1" step="0.01" value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Mix amount" />
        <div className="mixer__use">
          <span className="mixer__blob" style={{ background: mixed ?? "transparent" }} aria-hidden="true" />
          <code>{mixed ?? (loadError ? "the mixer didn't load, reopen the studio" : "mixing…")}</code>
          <button type="button" className="btn btn--primary btn--small" disabled={!mixed} onClick={() => onUse(mixed)}>
            Paint with this
          </button>
        </div>
      </div>
      <p className="mixer__credit">
        Mixing by{" "}
        <a href="https://github.com/scrtwpns/mixbox" target="_blank" rel="noreferrer">
          Mixbox
        </a>{" "}
        (CC BY-NC 4.0).
      </p>
    </section>
  );
}
