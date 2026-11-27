import { useEffect, useMemo, useRef, useState } from "react";
import BrainGame from "../common/BrainGame.jsx";
import MaomaoSays from "../common/MaomaoSays.jsx";
import { feel } from "../common/feel.js";
import { readStore, useShowWhen, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { bestTaps, isLit, neighbours, newCorridor, press, starsFor } from "./logic.js";
import "./lantern-puzzle.css";

// Lantern corridor (id lantern-puzzle): Maomao's palace corridor, one level after another. The grid
// grows from 3×3 to 5×5; each corridor has a "par" (the fewest taps that light it), and lighting it
// at par earns three stars. Progress, stars and the corridor in hand survive leaving the game.

const GAME = "lantern-puzzle";
const SAVE = "kiriya:brain:lantern-puzzle:v2";

const LINES = {
  welcome: ["Each switch changes its neighbours as well. Look before you tap.", "A new corridor. The cross around each lantern is what matters."],
  tap: ["That changed more than one light. Keep track of the neighbours.", "A change is an observation. You can undo it.", "Think about what a switch touches, not just the lantern beneath it.", "The corners touch fewer lights than the middle."],
  undo: ["Back one step. We haven't lost the record.", "A useful experiment. Now you know what that switch does."],
  nudge: ["I've marked one useful lantern. Tap it, then look again.", "That one is part of a shortest route from here."],
  over: ["Past par, but nothing is lost. Lanterns don't mind.", "More taps than needed. Undo, or start the corridor over."],
  lit: ["All lit. Now I can read the labels at the end of the corridor.", "There. A plan works better than switching at random."],
  perfect: ["Not one wasted tap. I'm impressed. Quietly.", "Exactly at par. That is the whole point of thinking first."],
};
const pick = (list, n) => list[n % list.length];

function fresh(level) {
  return { ...newCorridor(level), taps: 0, history: [], nudge: null, event: "welcome", talk: 0 };
}

function restore() {
  const saved = readStore(SAVE, null);
  const corridor = saved?.corridor;
  if (Number.isInteger(saved?.level) && corridor?.board?.length && corridor.board.length === corridor.size ** 2) return { stars: {}, ...saved };
  return { level: 1, stars: {}, corridor: fresh(1) };
}

function Lantern({ lit }) {
  return (
    <svg viewBox="0 0 64 76" aria-hidden="true" className="lc-lantern">
      <path d="M32 3v9M24 12h16M24 61h16m-8 0v10m-5-3v6m10-6v6" className="lc-lantern__frame" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M22 15q-16 8-13 28 2 12 13 15h20q11-3 13-15 3-20-13-28Z" className="lc-lantern__paper" strokeWidth="2.2" />
      <path d="M22 15q-16 8-13 28 2 12 13 15h20q11-3 13-15 3-20-13-28Z" className="lc-lantern__lit" />
      <path d="M24 16q-10 21 0 42m16-42q10 21 0 42M10 31h44M10 43h44" className="lc-lantern__ribs" strokeWidth="1.1" fill="none" />
      <path className="lc-lantern__spark" d="m32 27 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
      {!lit && <circle cx="32" cy="37" r="2.2" className="lc-lantern__wick" />}
    </svg>
  );
}

function Stars({ count, of = 3, label }) {
  return (
    <span className="lc-stars" role="img" aria-label={label ?? `${count} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" data-on={i < count || undefined}>
          <path d="M12 2.8l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.6 3.1 1.2-6.3L3 9.4l6.3-.8z" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

export default function LanternCorridor({ onReward }) {
  const [state, setState] = useState(restore);
  const [pop, setPop] = useState({ cells: [], key: 0 });
  const { level, stars, corridor } = state;
  const { size, board, par, taps } = corridor;
  const lit = isLit(board);
  const earned = lit ? starsFor(taps, par) : 0;
  const totalStars = Object.values(stars).reduce((sum, n) => sum + n, 0);
  const doneCard = useRef(null);
  useShowWhen(doneCard, lit);

  useEffect(() => writeStore(SAVE, state), [state]);

  const setCorridor = (change) => setState((s) => ({ ...s, corridor: { ...s.corridor, ...change(s.corridor) } }));

  const tap = (index) => {
    if (lit) return;
    const next = press(board, size, index);
    const done = isLit(next);
    const count = taps + 1;
    setPop({ cells: neighbours(size, index), key: pop.key + 1 });
    if (done) {
      const got = starsFor(count, par);
      feel("win");
      setState((s) => ({
        ...s,
        stars: { ...s.stars, [s.level]: Math.max(s.stars[s.level] ?? 0, got) },
        corridor: { ...s.corridor, board: next, taps: count, history: [...s.corridor.history, index], nudge: null, event: got === 3 ? "perfect" : "lit", talk: s.corridor.talk + 1 },
      }));
      if (level >= 3) rewardOnce(onReward, { sticker: "st-star", game: GAME, reason: "three corridors lit" });
      if (size === 5 && got === 3) rewardOnce(onReward, { sticker: "st-lantern", game: GAME, reason: "a five-by-five corridor at par" });
      return;
    }
    feel("place");
    setCorridor((c) => ({ board: next, taps: count, history: [...c.history, index], nudge: null, event: count > par ? "over" : "tap", talk: c.talk + 1 }));
  };

  const undo = () => {
    if (!corridor.history.length || lit) return;
    feel("tap");
    const last = corridor.history.at(-1);
    setPop({ cells: neighbours(size, last), key: pop.key + 1 });
    setCorridor((c) => ({ board: press(c.board, size, last), taps: Math.max(0, c.taps - 1), history: c.history.slice(0, -1), nudge: null, event: "undo", talk: c.talk + 1 }));
  };

  const restart = () => {
    feel("tap");
    setCorridor((c) => ({ board: c.start, taps: 0, history: [], nudge: null, event: "welcome", talk: c.talk + 1 }));
  };

  const nudge = () => {
    if (lit) return;
    const route = bestTaps(board, size);
    if (!route?.length) return;
    feel("good");
    setCorridor((c) => ({ nudge: route[0], event: "nudge", talk: c.talk + 1 }));
  };

  const next = () => {
    feel("tap");
    setState((s) => ({ ...s, level: s.level + 1, corridor: fresh(s.level + 1) }));
  };
  const again = () => {
    feel("tap");
    setCorridor((c) => ({ board: c.start, taps: 0, history: [], nudge: null, event: "welcome", talk: c.talk + 1 }));
  };

  const line = useMemo(() => pick(LINES[corridor.event] ?? LINES.welcome, corridor.talk + level), [corridor.event, corridor.talk, level]);
  const expression = lit ? (earned === 3 ? "sparkle" : "pleased") : corridor.event === "nudge" ? "curious" : corridor.event === "undo" ? "writing" : "thinking";
  const popSet = new Set(pop.cells);

  return (
    <BrainGame
      id={GAME}
      className="lc-game"
      status={
        <>
          corridor {level}
          <small>
            {size} × {size}
            {totalStars ? ` · ${totalStars} ★` : ""}
          </small>
        </>
      }
      howToTitle="lantern corridor"
      howTo={
        <ul>
          <li>
            light <b>every lantern</b> in the corridor.
          </li>
          <li>
            a tap switches that lantern <b>and its neighbours</b> above, below, left and right.
          </li>
          <li>
            every corridor can be lit in a certain number of taps, its <b>par</b>. light it at par for three stars ★★★
          </li>
          <li>stuck? undo, start over, or ask Maomao for a nudge. the corridors grow as you go.</li>
        </ul>
      }
    >
      <div className="lc" data-lit={lit || undefined} style={{ "--n": size }}>
        <MaomaoSays expression={expression} talk={corridor.talk}>
          {line}
        </MaomaoSays>
        <div className="lc-board-wrap">
          <div className="lc-board" role="grid" aria-label={`${size} by ${size} lanterns`}>
            {board.map((on, i) => (
              <button
                key={i}
                type="button"
                role="gridcell"
                className="lc-cell"
                data-lit={on || undefined}
                data-pop={popSet.has(i) ? (pop.key % 2 ? "a" : "b") : undefined}
                data-nudge={corridor.nudge === i || undefined}
                aria-pressed={on}
                aria-label={`lantern ${Math.floor(i / size) + 1}, ${(i % size) + 1}: ${on ? "lit" : "dark"}${corridor.nudge === i ? ", Maomao’s nudge" : ""}`}
                disabled={lit}
                onClick={() => tap(i)}
              >
                <Lantern lit={on} />
              </button>
            ))}
          </div>
        </div>
        {lit ? (
          <div className="brain-done lc-done" ref={doneCard}>
            <Stars count={earned} />
            <h3>{earned === 3 ? "lit at par ✧" : "corridor lit ♡"}</h3>
            <p>
              {taps} {taps === 1 ? "tap" : "taps"} · par {par}
              {earned < 3 ? " · try it again for three stars?" : ""}
            </p>
            <div className="brain-done__actions">
              <button type="button" className="brain-btn" onClick={next}>
                next corridor →
              </button>
              {earned < 3 && (
                <button type="button" className="brain-btn brain-btn--soft" onClick={again}>
                  again ↺
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="lc-foot">
            <p className="lc-count" aria-live="polite">
              <b>{taps}</b> {taps === 1 ? "tap" : "taps"} <span>· par {par}</span>
            </p>
            <div className="brain-actions">
              <button type="button" className="brain-action" onClick={undo} disabled={!corridor.history.length}>
                ↺ undo
              </button>
              <button type="button" className="brain-action" onClick={restart} disabled={!corridor.history.length}>
                start over
              </button>
              <button type="button" className="brain-action" onClick={nudge}>
                ✧ nudge
              </button>
            </div>
          </div>
        )}
      </div>
    </BrainGame>
  );
}
