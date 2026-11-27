import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { haptic } from "../../../../../lib/native.js";
import MaomaoMascot from "../../../../mascot/MaomaoMascot.jsx";
import { burst } from "../_kit/confetti.js";
import { useCalm, useSavedState } from "../_kit/hooks.js";
import { Sheet } from "../_kit/Sheet.jsx";
import { MAX_DROPS, PAINTS, PASS, ROUNDS, closeness, mixDrops, newPalette, nextStep, starsFor, targetOf } from "./club.js";
import "../_kit/kit.css";
import "./club.css";

// Maomao's colour club in the app: she shows a colour from her sample book; tap the paint pots to
// drop paint into the bowl (it mixes like real pigment), then "compare" it with her sample. Three
// colours make a palette; the stars are for matching in few tries; her palette can go straight
// into the sketchbook. The website keeps the slider version (src/world/play/PaletteParty.jsx).

const FRESH = () => ({ palette: newPalette(), round: 0, drops: {}, checks: 0, results: [], best: 0 });

const LINES = {
  start: ["“measure, compare, adjust. like work at the mortar.”", "“one drop at a time. you can always add; taking away is harder.”", "“look at the sample, not at what you hoped it would be.”"],
  close: ["“close. the proportions are nearly there.”", "“nearly. one small change, then compare again.”"],
  far: ["“not yet. change one thing, then look again.”", "“hm. it’s a different colour. we have a record; use it.”"],
  matched: ["“that agrees with the sample. keep the record.”", "“a consistent mixture. good.”", "“there it is. observation saves a lot of guessing.”"],
};
const pick = (list, n) => list[n % list.length];

export default function ColourClub({ onReward }) {
  const navigate = useNavigate();
  const calm = useCalm();
  const [saved, setSaved] = useSavedState("colour-club", FRESH);
  const state = saved?.palette?.length === ROUNDS ? saved : FRESH();
  const set = (patch) => setSaved((old) => ({ ...(old?.palette?.length === ROUNDS ? old : FRESH()), ...(typeof patch === "function" ? patch(old) : patch) }));
  const [mixbox, setMixbox] = useState(null);
  const [said, setSaid] = useState(null); // what Maomao says after a compare: { score, kind, step }
  const [talk, setTalk] = useState(0);
  const [splash, setSplash] = useState(null);
  const [over, setOver] = useState(false);
  const confettiRef = useRef(null);
  const firstLine = useRef(Math.floor(Math.random() * 3)).current;

  // Real pigment mixing (Mixbox, CC BY-NC 4.0, also in the sketchbook's paint box).
  useEffect(() => {
    let live = true;
    import("mixbox")
      .then((module) => live && setMixbox(module.default ?? module))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const done = state.round >= ROUNDS;
  const round = state.palette[Math.min(state.round, ROUNDS - 1)];
  const target = useMemo(() => targetOf(round, mixbox), [round, mixbox]);
  const bowl = useMemo(() => mixDrops(state.drops, mixbox), [state.drops, mixbox]);
  const total = Object.values(state.drops).reduce((sum, n) => sum + n, 0);
  // Matched this round (also right after the app was closed and opened again on a matched colour).
  const matched = !done && state.results.length > state.round;
  const matchScore = said?.kind === "matched" ? said.score : 100;
  const stars = state.results.reduce((sum, each) => sum + each.stars, 0);

  useEffect(() => {
    if (done) setOver(true);
  }, [done]);

  function drop(paint) {
    if (matched || total >= MAX_DROPS) return;
    set((old) => ({ drops: { ...old.drops, [paint]: (old.drops?.[paint] ?? 0) + 1 } }));
    setSaid(null);
    setSplash({ paint, key: Date.now() });
    haptic("light");
  }
  function tipOut() {
    // The last paint added comes out (the most recent drop is the one she'll want back).
    const last = splash?.paint && state.drops[splash.paint] ? splash.paint : Object.keys(state.drops).find((paint) => state.drops[paint] > 0);
    if (!last || matched) return;
    set((old) => ({ drops: { ...old.drops, [last]: Math.max(0, (old.drops?.[last] ?? 0) - 1) } }));
    setSplash(null);
    setSaid(null);
    haptic("light");
  }
  function empty() {
    if (matched) return;
    set({ drops: {} });
    setSplash(null);
    setSaid(null);
    haptic("medium");
  }
  function compare() {
    if (!total || matched) return;
    const score = closeness(bowl, target);
    const checks = state.checks + 1;
    setTalk((n) => n + 1);
    if (score >= PASS) {
      const result = { id: round.id, name: round.name, hex: target, stars: starsFor(checks) };
      set((old) => ({ checks, results: [...(old.results ?? []), result] }));
      setSaid({ score, kind: "matched" });
      haptic("success");
      if (!calm) burst(confettiRef.current, { y: 0.35, power: 0.7 });
      return;
    }
    set({ checks });
    setSaid({ score, kind: score >= 80 ? "close" : "far", step: checks >= 2 ? nextStep(state.drops, round) : null });
    haptic("medium");
  }
  function next() {
    const last = state.round + 1 >= ROUNDS;
    set((old) => ({ round: old.round + 1, drops: {}, checks: 0, best: last ? Math.max(old.best ?? 0, (old.results ?? []).reduce((sum, each) => sum + each.stars, 0)) : old.best }));
    setSaid(null);
    setSplash(null);
    if (last) onReward?.({ sticker: "st-brush", reason: "a whole palette mixed" });
  }
  function again() {
    setSaved((old) => ({ ...FRESH(), best: old?.best ?? 0 }));
    setSaid(null);
    setSplash(null);
    setOver(false);
  }
  function toSketchbook() {
    const paints = state.results.map((each) => each.hex).join(",");
    navigate(`/world/play?sketchbook=1&paint=${encodeURIComponent(paints)}`, { replace: true });
  }

  const line = matched
    ? pick(LINES.matched, talk)
    : said
    ? said.kind === "matched"
      ? pick(LINES.matched, talk)
      : said.step
        ? `“${said.score >= 30 ? `${said.score}%. ` : ""}${said.step.more ? `a drop more ${PAINTS[said.step.paint].name}, i’d say` : `one less ${PAINTS[said.step.paint].name}, i’d say`}.”`
        : `“${said.score >= 30 ? `${said.score}%. ` : ""}${pick(said.kind === "close" ? LINES.close : LINES.far, talk).slice(1)}`
    : total
      ? `${total} ${total === 1 ? "drop" : "drops"} in the bowl. compare when it looks right.`
      : pick(LINES.start, firstLine);
  const face = matched ? "pleased" : said ? (said.step ? "writing" : "thinking") : total ? "curious" : "deadpan";

  return (
    <div className="artsy club">
      <div className="artsy-bar club-bar">
        <ol className="club-rounds" aria-label={`colour ${Math.min(state.round + 1, ROUNDS)} of ${ROUNDS}`}>
          {state.palette.map((each, i) => {
            const result = state.results[i];
            return (
              <li key={each.id} data-now={i === state.round || undefined} data-done={Boolean(result) || undefined} style={result ? { "--swatch": result.hex } : undefined}>
                {result ? <span aria-label={`${result.name}, ${result.stars} stars`}>{"★".repeat(result.stars)}</span> : <span aria-hidden="true">{i + 1}</span>}
              </li>
            );
          })}
        </ol>
        <div className="artsy-bar__grow" />
        <span className="club-best artsy-hand">{state.best ? `best ${state.best}/9 ★` : "no best yet"}</span>
      </div>

      <div className="club-stage">
        <div className="club-maomao">
          <MaomaoMascot size={92} expression={face} reactionKey={talk} />
          <p className="club-says artsy-hand" role="status" aria-live="polite">
            {line}
          </p>
        </div>
        <div className="club-pair">
          <figure className="club-blob">
            <span className="club-blob__paint club-blob__paint--sample" style={{ "--paint": target ?? "#eee" }} />
            <figcaption>
              <b className="artsy-hand">{round.name}</b>
              <small>{round.note}</small>
            </figcaption>
          </figure>
          <figure className="club-blob">
            <span className="club-blob__paint club-blob__paint--bowl" data-empty={!bowl || undefined} style={{ "--paint": bowl ?? "#fffdfb" }}>
              {splash && !calm && <i key={splash.key} className="club-drop" style={{ "--paint": PAINTS[splash.paint].hex }} />}
              {!bowl && <em className="artsy-hand">your bowl</em>}
            </span>
            <figcaption>
              <b className="artsy-hand">your mix</b>
              <small>{matched ? `${matchScore}% · a match ♡` : said ? (said.score >= 30 ? `${said.score}% so far` : "not that colour yet") : `${total}/${MAX_DROPS} drops`}</small>
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="artsy-tray club-tray">
        {matched ? (
          <div className="club-matched">
            <p className="artsy-hand">
              {round.name}, matched {"★".repeat(starsFor(state.checks))}
              <small>{state.checks === 1 ? "first try!" : `in ${state.checks} tries`}</small>
            </p>
            <button type="button" className="artsy-primary" onClick={next}>
              {state.round + 1 >= ROUNDS ? "see my palette ♡" : "next colour →"}
            </button>
          </div>
        ) : (
          <>
            <div className="club-pots" role="group" aria-label="paint pots: tap to add a drop">
              {round.pots.map((paint) => (
                <button key={paint} type="button" className="club-pot" style={{ "--paint": PAINTS[paint].hex }} aria-label={`a drop of ${PAINTS[paint].name}${state.drops[paint] ? `, ${state.drops[paint]} in the bowl` : ""}`} disabled={total >= MAX_DROPS} onClick={() => drop(paint)}>
                  <span className="club-pot__jar" aria-hidden="true" />
                  {state.drops[paint] > 0 && <span className="club-pot__count" aria-hidden="true">{state.drops[paint]}</span>}
                  <span className="club-pot__name">{PAINTS[paint].name}</span>
                </button>
              ))}
            </div>
            <div className="club-actions">
              <button type="button" className="artsy-chip artsy-chip--icon" aria-label="tip out a drop" disabled={!total} onClick={tipOut}>
                <UndoIcon />
              </button>
              <button type="button" className="artsy-chip" disabled={!total} onClick={empty}>
                empty the bowl
              </button>
              <div className="artsy-bar__grow" />
              <button type="button" className="artsy-chip artsy-chip--primary" disabled={!total} onClick={compare}>
                <SparkIcon />
                compare
              </button>
            </div>
          </>
        )}
      </div>

      <Sheet open={over} title="your palette ♡" onClose={() => setOver(false)}>
        <div className="club-done">
          <ul className="club-done__swatches">
            {state.results.map((each) => (
              <li key={each.id}>
                <span style={{ background: each.hex }} />
                <b className="artsy-hand">{each.name}</b>
                <small>{"★".repeat(each.stars)}</small>
              </li>
            ))}
          </ul>
          <p className="club-done__score artsy-hand">
            {stars} of 9 stars{stars >= (state.best ?? 0) && stars > 0 ? " · your best ♡" : ` · best ${state.best}`}
          </p>
          <p className="club-done__line">“three consistent mixtures. keep a record of the proportions.”</p>
          <div className="club-done__buttons">
            <button type="button" className="artsy-primary" onClick={toSketchbook}>
              paint with these ♡
            </button>
            <button type="button" className="artsy-secondary" onClick={again}>
              a new palette ↺
            </button>
          </div>
        </div>
      </Sheet>
      {done && !over && (
        <div className="club-after">
          <button type="button" className="artsy-primary" onClick={() => setOver(true)}>
            see my palette ♡
          </button>
          <button type="button" className="artsy-secondary" onClick={again}>
            a new palette ↺
          </button>
        </div>
      )}
      <canvas ref={confettiRef} className="club-confetti" aria-hidden="true" />
    </div>
  );
}

const UndoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" />
  </svg>
);
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Zm6 10 .9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9Z" fill="currentColor" />
  </svg>
);
