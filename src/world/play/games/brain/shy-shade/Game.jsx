import { useEffect, useState } from "react";
import BrainGame, { ToolButton } from "../common/BrainGame.jsx";
import { feel } from "../common/feel.js";
import { readStore, usePageVisible, useReducedMotion, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { CUE_LEVELS, HEARTS, newRun, shadeTurn } from "./logic.js";
import "./shy-shade.css";

const GAME = "shy-shade";
const SAVE = "kiriya:brain:shy-shade";
const BEST = "kiriya:brain:shy-shade:best";

const CHEERS = ["there you are ♡", "found you!", "good eyes ✧", "a tiny difference, spotted", "hello, shy one", "sharp!"];
const HINT = { lighter: "one swatch is a touch lighter", darker: "one swatch is a touch darker", different: "one swatch is a whisper different" };

function Heart({ full }) {
  return (
    <svg viewBox="0 0 20 18" width="17" height="15" aria-hidden="true" className="ss-heart" data-full={full || undefined}>
      <path d="M10 16.5C3.5 12.3 1.5 9 1.5 6 1.5 3.4 3.4 1.5 5.8 1.5c1.7 0 3.2 1 4.2 2.5 1-1.5 2.5-2.5 4.2-2.5 2.4 0 4.3 1.9 4.3 4.5 0 3-2 6.3-8.5 10.5z" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function SquintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M2.5 12.5q9.5-9 19 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 13.5q7 5.5 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12.6" r="2.6" fill="currentColor" />
      <path d="M12 3.5v2M5.5 5.8l1.2 1.5M18.5 5.8l-1.2 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function restore() {
  const saved = readStore(SAVE, null);
  return saved?.round?.swatch && saved.phase !== "over" ? { ...saved, phase: saved.phase === "found" ? "found" : "play", event: null } : newRun();
}

export default function ShyShade({ onReward }) {
  const [run, setRun] = useState(restore);
  const [best, setBest] = useState(() => readStore(BEST, 0));
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const { round, level, hearts, phase } = run;

  useEffect(() => writeStore(SAVE, run), [run]);

  // After a find, the next grid arrives on its own (not while the app is in the background).
  useEffect(() => {
    if (phase !== "found" || !visible) return undefined;
    const timer = setTimeout(() => setRun((state) => shadeTurn(state, { type: "next" })), reduced ? 350 : 650);
    return () => clearTimeout(timer);
  }, [phase, visible, reduced]);

  const tap = (index) => {
    const next = shadeTurn(run, { type: "tap", index });
    if (next === run) return;
    setRun(next);
    if (next.event === "found") {
      feel("good");
      if (level > best) {
        setBest(level);
        writeStore(BEST, level);
      }
      if (level >= 15) rewardOnce(onReward, { sticker: "st-swatch", game: GAME, reason: "found the shy shade on level 15" });
      if (level >= 25) rewardOnce(onReward, { sticker: "st-brush", game: GAME, reason: "found the shy shade on level 25" });
    } else feel("oops");
  };

  const squint = () => {
    const next = shadeTurn(run, { type: "squint" });
    if (next !== run) {
      feel("tap");
      setRun(next);
    }
  };

  const again = () => {
    feel("tap");
    setRun(newRun());
  };

  const cells = round.size * round.size;
  const over = phase === "over";
  return (
    <BrainGame
      id={GAME}
      className="ss-game"
      status={
        <>
          level {level}
          <span className="ss-hearts" aria-label={`${hearts} of ${HEARTS} hearts left`}>
            {Array.from({ length: HEARTS }, (_, i) => (
              <Heart key={i} full={i < hearts} />
            ))}
          </span>
        </>
      }
      tools={
        <ToolButton label={`squint: grey out half the swatches (${run.squints} left)`} onClick={squint} className="ss-squint">
          <SquintIcon />
          {run.squints > 0 && <span className="ss-squint__count">{run.squints}</span>}
        </ToolButton>
      }
      howToTitle="shy shade"
      howTo={
        <ul>
          <li>
            one swatch is <b>a tiny bit different</b> from the rest. tap it.
          </li>
          <li>the first few are lighter or darker. after that, they get very, very shy.</li>
          <li>
            a wrong tap costs a <b>heart</b>. you have three.
          </li>
          <li>
            stuck? the <b>squint</b> button greys out half the swatches. you get one, and another every ten levels.
          </li>
        </ul>
      }
    >
      <div className="ss" data-phase={phase}>
        <p className="ss-hint" aria-live="polite">
          {phase === "found" ? CHEERS[level % CHEERS.length] : over ? "out of hearts" : level <= CUE_LEVELS ? HINT[round.kind] : HINT.different}
          {best > 0 && <small>best: {best} {best === 1 ? "level" : "levels"}</small>}
        </p>
        <div className="ss-grid-wrap">
          <div
            key={`${level}-${round.swatch}`}
            className="ss-grid"
            style={{ "--n": round.size }}
            role="grid"
            aria-label={`${cells} swatches, level ${level}`}
          >
            {Array.from({ length: cells }, (_, i) => {
              const shy = i === round.odd;
              const reveal = shy && (phase === "found" || over);
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  className="ss-swatch"
                  style={{ background: shy ? round.shy : round.swatch }}
                  data-missed={run.missed.includes(i) || undefined}
                  data-dimmed={run.dimmed.includes(i) || undefined}
                  data-found={reveal || undefined}
                  disabled={phase !== "play" || run.missed.includes(i) || run.dimmed.includes(i)}
                  aria-label={`swatch ${i + 1}${run.missed.includes(i) ? ", not this one" : ""}${reveal ? ", the shy shade" : ""}`}
                  onClick={() => tap(i)}
                />
              );
            })}
          </div>
        </div>
        {over && (
          <div className="brain-done ss-done">
            <h3>{level > 1 ? `${level - 1} ${level === 2 ? "level" : "levels"} cleared` : "the shy one won this time"}</h3>
            <p>{level - 1 === best && best > 0 ? "that’s your best yet ♡ " : best > 0 ? `your best is ${best}. ` : ""}the shy shade is the one with the heart.</p>
            <div className="brain-done__actions">
              <button type="button" className="brain-btn" onClick={again}>
                play again ↺
              </button>
            </div>
          </div>
        )}
      </div>
    </BrainGame>
  );
}
