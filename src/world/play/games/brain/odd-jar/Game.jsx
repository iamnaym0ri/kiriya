import { useEffect, useMemo, useRef, useState } from "react";
import BrainGame from "../common/BrainGame.jsx";
import Hearts from "../common/Hearts.jsx";
import MaomaoSays from "../common/MaomaoSays.jsx";
import { feel } from "../common/feel.js";
import { readStore, usePageVisible, useReducedMotion, useShowWhen, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { DETAILS, HEARTS, clue, inspect, newRun, nextShelf } from "./logic.js";
import "./odd-jar.css";

// Odd jar: Maomao's shelf, one jar that differs in a single detail. An endless run of shelves with
// three hearts; the shelves fill up, the details get smaller, and from shelf ten the jars wobble
// (which means nothing). Her best shelf is kept; a run in progress survives leaving the game.

const GAME = "odd-jar";
const SAVE = "kiriya:brain:odd-jar";
const BEST = "kiriya:brain:odd-jar:best";

const LINES = {
  welcome: ["Someone has mixed up my jars. Let's see which detail they overlooked.", "One of these isn't like the others. Take your time."],
  next: ["A fuller shelf. Same rule: one detail out of place.", "More jars. Compare them in pairs if it helps.", "Look at one detail across every jar, then the next."],
  retry: ["That one agrees with its neighbours. Try a different theory.", "Compare the markings. A hunch needs something to support it.", "Not that one. A second look is cheaper than a wrong conclusion."],
  found: ["There. One detail the others don't share.", "Exactly. Small differences matter when you're sorting specimens.", "Good eyes. I'll relabel that one."],
  over: ["Out of guesses for this shelf. The odd one is the one I've circled.", "That's enough for one sitting. The circled jar was the culprit."],
  wobble: ["The jars are wobbling. Ignore that; it tells you nothing."],
};

const LIQUID = { lilac: ["#d9c4e8", "#b893d0"], pink: ["#f7c9d9", "#e59ab7"], mint: ["#cfeadb", "#93c9a9"], honey: ["#f9e2a8", "#e7bd5c"] };

/** One jar, drawn from its details (original SVG, after the website's jar). */
function Jar({ d }) {
  const [light, deep] = LIQUID[d.liquid];
  return (
    <svg viewBox="0 0 72 94" className="oj-jar" aria-hidden="true">
      <path d="M12 62h48v19q0 5-7 5H19q-7 0-7-5Z" fill={deep} />
      <path d="M23 17h26v15q13 7 13 19v29q0 8-9 8H19q-9 0-9-8V51q0-12 13-19Z" fill={light} fillOpacity="0.55" stroke="#9675af" strokeWidth="2.5" />
      <rect x="22" y="8" width="28" height="15" rx="3" fill="#d6b58b" stroke="#ad8a66" strokeWidth="2" />
      <path d="M27 13h18" stroke="#9b7359" strokeWidth="2" strokeLinecap="round" />
      {d.cork === 2 && <path d="M27 18h18" stroke="#9b7359" strokeWidth="2" strokeLinecap="round" />}
      {d.seal === "round" && <circle cx="36" cy="34" r="4.5" fill="#ba5f8f" stroke="#8c3f69" strokeWidth="1.2" />}
      {d.seal === "diamond" && <path d="m36 28.5 5.5 5.5-5.5 5.5-5.5-5.5Z" fill="#ba5f8f" stroke="#8c3f69" strokeWidth="1.2" />}
      {d.ribbon === "bow" && (
        <g fill="#f29cc2" stroke="#b9487c" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M23 25.5h26" fill="none" strokeWidth="3" stroke="#f29cc2" />
          <path d="M49 25.5q8-6 9 0t-9 0Z" />
          <path d="M49 25.5l5 8M49 25.5l1 9" fill="none" />
        </g>
      )}
      <rect x="20" y="42" width="32" height="30" rx="4" fill="#fff8ec" stroke="#e5d6c4" strokeWidth="1" />
      <g transform={d.flip ? "translate(72 0) scale(-1 1)" : undefined}>
        {d.label === "leaf" && <path d="M29 65Q28 50 43 50q0 14-14 15Zm0 1 12-13" fill="#9cba8d" stroke="#608567" strokeWidth="1.5" />}
        {d.label === "flower" && (
          <g fill="#e6a0c2" stroke="#b46d92" strokeWidth="1">
            <circle cx="36" cy="51.5" r="4.6" />
            <circle cx="31" cy="57" r="4.6" />
            <circle cx="41" cy="57" r="4.6" />
            <circle cx="36" cy="62.5" r="4.6" />
            <circle cx="36" cy="57" r="3" fill="#f1d27f" stroke="none" />
          </g>
        )}
        {d.label === "mushroom" && (
          <>
            <path d="M33 57l-1.5 9q4 2 9 0L39 57" fill="#f3e3c4" stroke="#a29076" strokeWidth="1.3" />
            <path d="M25 58c0-12 22-12 22 0q-11 3-22 0Z" fill="#b78bbd" stroke="#835b92" strokeWidth="1.5" />
            <circle cx="32" cy="53" r="1.8" fill="#fff5e9" />
            <circle cx="39.5" cy="51.5" r="1.8" fill="#fff5e9" />
          </>
        )}
        {d.label === "heart" && <path d="M36 66c-7-4.5-9-8-9-11 0-3 2.2-5 4.7-5 1.8 0 3.3 1 4.3 2.6 1-1.6 2.5-2.6 4.3-2.6 2.5 0 4.7 2 4.7 5 0 3-2 6.5-9 11Z" fill="#f29cc2" stroke="#b9487c" strokeWidth="1.4" />}
      </g>
      {Array.from({ length: d.dots }, (_, i) => (
        <circle key={i} cx={d.dots === 3 ? 27 + i * 9 : 31 + i * 10} cy="79" r="2.5" fill="#6d4a80" />
      ))}
      <path d="M17 43q0-5 5-7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function restore() {
  const saved = readStore(SAVE, null);
  if (saved?.shelf?.base && saved.shelf.phase !== "over" && Number.isInteger(saved.level)) {
    return { ...saved, shelf: { ...saved.shelf, phase: saved.shelf.phase === "found" ? "found" : "look" } };
  }
  return newRun();
}

export default function OddJar({ onReward }) {
  const [run, setRun] = useState(restore);
  const [best, setBest] = useState(() => readStore(BEST, 0));
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const doneCard = useRef(null);
  const { level, hearts, shelf } = run;
  const over = shelf.phase === "over";
  useShowWhen(doneCard, over);

  useEffect(() => writeStore(SAVE, run), [run]);

  // After a find, the next shelf arrives on its own (not while the app is in the background).
  useEffect(() => {
    if (shelf.phase !== "found" || !visible) return undefined;
    const timer = setTimeout(() => setRun((r) => nextShelf(r)), reduced ? 700 : 1150);
    return () => clearTimeout(timer);
  }, [shelf.phase, visible, reduced]);

  const tap = (index) => {
    const next = inspect(run, index);
    if (next === run) return;
    setRun(next);
    if (next.event === "found") {
      feel("good");
      if (level > best) {
        setBest(level);
        writeStore(BEST, level);
      }
      if (level >= 5) rewardOnce(onReward, { sticker: "st-kitten", game: GAME, reason: "every little mystery solved" });
      if (level >= 12) rewardOnce(onReward, { sticker: "st-bottle", game: GAME, reason: "twelve shelves sorted" });
    } else feel("oops");
  };

  const askClue = () => {
    const next = clue(run);
    if (next === run) return;
    feel("tap");
    setRun(next);
  };

  const again = () => {
    feel("tap");
    setRun((r) => ({ ...newRun(), talk: r.talk + 1 }));
  };

  const line = useMemo(() => {
    if (run.event === "hint") return DETAILS[shelf.kind].hint;
    if (run.event === "next" && level === 10) return LINES.wobble[0];
    const list = LINES[run.event] ?? LINES.welcome;
    return list[run.talk % list.length];
  }, [run.event, run.talk, shelf.kind, level]);
  const expression = shelf.phase === "found" ? "pleased" : over ? "deadpan" : run.event === "hint" ? "curious" : run.event === "retry" ? "thinking" : "curious";
  const cols = shelf.count === 4 ? 2 : shelf.count === 12 ? 4 : 3;
  const cleared = level - 1;

  return (
    <BrainGame
      id={GAME}
      className="oj-game"
      status={
        <>
          shelf {level}
          <Hearts left={hearts} of={HEARTS} />
        </>
      }
      howToTitle="odd jar"
      howTo={
        <ul>
          <li>
            every jar on the shelf is the same, except <b>one</b>. it differs in a single little detail. tap it.
          </li>
          <li>
            labels, colours, ribbons, seals, cork lines, wax dots… the details get <b>smaller</b> as the shelves fill up.
          </li>
          <li>
            a wrong jar costs a <b>heart</b>. you have three for the whole run.
          </li>
          <li>stuck? Maomao’s clue tells you which detail to look at.</li>
        </ul>
      }
    >
      <div className="oj" data-phase={shelf.phase}>
        <MaomaoSays expression={expression} talk={run.talk}>
          {line}
        </MaomaoSays>
        <div className="oj-shelf" role="grid" aria-label={`${shelf.count} jars`} style={{ "--cols": cols, "--rows": shelf.count / cols }} key={`${level}-${shelf.at}`}>
          {Array.from({ length: shelf.count }, (_, i) => {
            const odd = i === shelf.at;
            const reveal = odd && (shelf.phase === "found" || over);
            const missed = shelf.missed.includes(i);
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                className="oj-cell"
                style={{ "--wobble": `${shelf.wobble[i] ?? 0}deg`, "--i": i }}
                data-missed={missed || undefined}
                data-found={reveal || undefined}
                disabled={shelf.phase !== "look" || missed}
                aria-label={`jar ${i + 1}${missed ? ", not this one" : ""}${reveal ? ", the odd one" : ""}`}
                onClick={() => tap(i)}
              >
                <Jar d={odd ? shelf.odd : shelf.base} />
                {missed && <span className="oj-cell__mark" aria-hidden="true">✕</span>}
                {reveal && <span className="oj-cell__mark oj-cell__mark--found" aria-hidden="true">♡</span>}
              </button>
            );
          })}
        </div>
        {over ? (
          <div className="brain-done oj-done" ref={doneCard}>
            <h3>{cleared > 0 ? `${cleared} ${cleared === 1 ? "shelf" : "shelves"} sorted` : "the jars won this time"}</h3>
            <p>
              {cleared > 0 && cleared >= best ? "that’s your best yet ♡ " : best > 0 ? `your best is ${best}. ` : ""}
              the odd one is circled.
            </p>
            <div className="brain-done__actions">
              <button type="button" className="brain-btn" onClick={again}>
                a fresh shelf ↺
              </button>
            </div>
          </div>
        ) : (
          <div className="brain-actions oj-foot">
            <button type="button" className="brain-action" onClick={askClue} disabled={shelf.phase !== "look" || shelf.hint}>
              ✧ a little clue
            </button>
            {best > 0 && <span className="oj-best">best: shelf {best}</span>}
          </div>
        )}
      </div>
    </BrainGame>
  );
}
