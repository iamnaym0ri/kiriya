import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { availableCompanions, loadCompanion } from "./registry.js";

// Dev-only character lab: /world/companion-lab?c=<id> (docs/refactor/RENOVATION.md). Shows every
// pose and the platform, and lets a character walk a pretend level. The stage agent replaces this
// with the real engine's lab; until then it is enough to build a character to the contract.
export default function CompanionLab() {
  const [params, setParams] = useSearchParams();
  const ids = availableCompanions();
  const id = params.get("c") ?? ids[0];
  const [character, setCharacter] = useState(null);
  const [pose, setPose] = useState("idle");
  const [walking, setWalking] = useState(false);
  const [x, setX] = useState(40);
  useEffect(() => {
    let live = true;
    setCharacter(null);
    if (id) loadCompanion(id).then((loaded) => live && setCharacter(loaded));
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    if (!walking || !character) return undefined;
    let frame;
    let last = performance.now();
    let direction = 1;
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setX((value) => {
        let next = value + direction * (character.movement?.walkSpeed ?? 38) * dt;
        if (next > window.innerWidth - 80 || next < 20) direction *= -1;
        return Math.min(Math.max(next, 20), window.innerWidth - 80);
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [walking, character]);
  if (!import.meta.env.DEV) return null;
  const Body = character?.Body;
  const Platform = character?.Platform;
  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <label>
        character{" "}
        <select value={id ?? ""} onChange={(event) => setParams({ c: event.target.value })}>
          {ids.map((each) => <option key={each}>{each}</option>)}
        </select>
      </label>
      {!character && <p>{id ? "loading…" : "no character folders yet"}</p>}
      {character && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {(character.poses ?? []).map((each) => (
              <button key={each} type="button" onClick={() => setPose(each)} aria-pressed={pose === each} style={{ display: "grid", justifyItems: "center", padding: 8, borderRadius: 12, border: "1px solid var(--purple-200)", background: pose === each ? "var(--purple-100)" : "white" }}>
                <Body pose={each} expression={undefined} facing={1} playing />
                <small>{each}</small>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setWalking(!walking)}>{walking ? "stop" : "walk the level"}</button>
          <div style={{ position: "relative", height: 220, borderBottom: "1px dashed var(--purple-200)" }}>
            <div style={{ position: "absolute", left: x, bottom: 0, transform: "translateX(-50%)" }}>
              <div style={{ position: "relative" }}>
                <Body pose={walking ? "walk" : pose} facing={1} playing />
                {Platform && <div style={{ position: "absolute", left: "50%", bottom: -12, transform: "translateX(-50%)" }}><Platform width={character.size?.width ?? 96} state="steady" /></div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
