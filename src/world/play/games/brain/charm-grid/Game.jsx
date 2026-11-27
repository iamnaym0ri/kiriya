import { useEffect, useMemo, useState } from "react";
import BrainGame from "../common/BrainGame.jsx";
import { feel } from "../common/feel.js";
import { clock, readStore, usePageVisible, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { BOX, TIERS, clashes, generate, isSolved, nextSingle, peers } from "./logic.js";
import { Charm, charmName } from "./Charms.jsx";
import "./charm-grid.css";

const GAME = "charm-grid";
const SAVE = "kiriya:brain:charm-grid";

const fresh = (tier) => {
  const p = generate(tier);
  return { ...p, entries: Array(p.n * p.n).fill(0), notes: Array(p.n * p.n).fill(0), seconds: 0, nudges: 0, solved: false };
};

function restore() {
  const saved = readStore(SAVE, null);
  const games = {};
  for (const tier of Object.keys(TIERS)) {
    const game = saved?.games?.[tier];
    games[tier] = game?.puzzle?.length === TIERS[tier].n ** 2 ? game : null;
  }
  const tier = TIERS[saved?.tier] ? saved.tier : "cosy";
  games[tier] ??= fresh(tier);
  return { tier, games, best: saved?.best ?? {} };
}

export default function CharmGrid({ onReward }) {
  const [state, setState] = useState(restore);
  const [selected, setSelected] = useState(null);
  const [noting, setNoting] = useState(false);
  const [history, setHistory] = useState([]);
  const [flash, setFlash] = useState(null); // { cell, kind: "wrong" | "nudge" }
  const visible = usePageVisible();
  const { tier, games, best } = state;
  const game = games[tier];
  const { n, puzzle, solution, entries, notes, solved } = game;
  const grid = useMemo(() => puzzle.map((v, i) => v || entries[i]), [puzzle, entries]);
  const clash = useMemo(() => clashes(grid, n), [grid, n]);
  const [br, bc] = BOX[n];

  useEffect(() => writeStore(SAVE, state), [state]);

  // The clock runs only while she's playing and the app is in front.
  useEffect(() => {
    if (solved || !visible) return undefined;
    const id = setInterval(() => {
      setState((s) => ({ ...s, games: { ...s.games, [s.tier]: { ...s.games[s.tier], seconds: s.games[s.tier].seconds + 1 } } }));
    }, 1000);
    return () => clearInterval(id);
  }, [solved, visible, tier]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [flash]);

  const update = (change) => {
    setHistory((h) => [...h.slice(-40), { tier, entries, notes }]);
    const next = { ...game, ...change };
    const won = !game.solved && isSolved(next.puzzle.map((v, i) => v || next.entries[i]), next.solution);
    if (won) {
      next.solved = true;
      feel("win");
      const previous = best[tier];
      setState((s) => ({ ...s, games: { ...s.games, [tier]: next }, best: { ...s.best, [tier]: previous ? Math.min(previous, next.seconds) : next.seconds } }));
      if (n === 6) rewardOnce(onReward, { sticker: "st-charm", game: GAME, reason: "first six-by-six charm grid" });
      if (tier === "tricky") rewardOnce(onReward, { sticker: "st-kitten", game: GAME, reason: "first tricky charm grid" });
      setSelected(null);
      return;
    }
    setState((s) => ({ ...s, games: { ...s.games, [tier]: next } }));
  };

  const place = (value) => {
    if (solved) return;
    if (selected === null || puzzle[selected]) {
      setFlash({ cell: null, kind: "pick" });
      return;
    }
    if (noting) {
      if (entries[selected]) return;
      feel("tap");
      update({ notes: notes.map((bits, i) => (i === selected ? bits ^ (1 << value) : bits)) });
      return;
    }
    const clearing = entries[selected] === value;
    const nextEntries = entries.map((v, i) => (i === selected ? (clearing ? 0 : value) : v));
    // Placing a charm tidies that charm out of the notes around it.
    const around = new Set(peers(n)[selected]);
    const nextNotes = notes.map((bits, i) => (i === selected ? 0 : !clearing && around.has(i) ? bits & ~(1 << value) : bits));
    feel(clearing ? "tap" : "place");
    update({ entries: nextEntries, notes: nextNotes });
  };

  const erase = () => {
    if (solved || selected === null || puzzle[selected] || (!entries[selected] && !notes[selected])) return;
    feel("tap");
    update({ entries: entries.map((v, i) => (i === selected ? 0 : v)), notes: notes.map((b, i) => (i === selected ? 0 : b)) });
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last || last.tier !== tier || solved) return;
    feel("tap");
    setHistory((h) => h.slice(0, -1));
    setState((s) => ({ ...s, games: { ...s.games, [tier]: { ...s.games[tier], entries: last.entries, notes: last.notes } } }));
  };

  // A nudge points at a charm that doesn't belong first; otherwise it fills one square that can be
  // worked out by looking.
  const nudge = () => {
    if (solved) return;
    const wrong = entries.findIndex((v, i) => v && v !== solution[i]);
    if (wrong !== -1) {
      setSelected(wrong);
      setFlash({ cell: wrong, kind: "wrong" });
      feel("oops");
      return;
    }
    const step = nextSingle(grid, n) ?? { cell: grid.findIndex((v) => !v), value: solution[grid.findIndex((v) => !v)] };
    if (step.cell < 0) return;
    setSelected(step.cell);
    setFlash({ cell: step.cell, kind: "nudge" });
    feel("good");
    update({ entries: entries.map((v, i) => (i === step.cell ? step.value : v)), notes: notes.map((b, i) => (i === step.cell ? 0 : b)), nudges: game.nudges + 1 });
  };

  const switchTier = (next) => {
    if (next === tier) return;
    feel("tap");
    setSelected(null);
    setNoting(false);
    setState((s) => ({ ...s, tier: next, games: { ...s.games, [next]: s.games[next] ?? fresh(next) } }));
  };

  const another = () => {
    feel("tap");
    setSelected(null);
    setHistory([]);
    setState((s) => ({ ...s, games: { ...s.games, [tier]: fresh(tier) } }));
  };

  const sel = selected;
  const selRow = sel === null ? -1 : Math.floor(sel / n);
  const selCol = sel === null ? -1 : sel % n;
  const selBox = sel === null ? -1 : Math.floor(selRow / br) * (n / bc) + Math.floor(selCol / bc);
  const selValue = sel === null ? 0 : grid[sel];
  const filled = grid.filter(Boolean).length;

  return (
    <BrainGame
      id={GAME}
      className="cg-game"
      status={
        <>
          <span className="cg-clock">{clock(game.seconds)}</span>
          <small>
            {filled}/{n * n} charms{game.nudges ? ` · ${game.nudges} ${game.nudges === 1 ? "nudge" : "nudges"}` : ""}
          </small>
        </>
      }
      howToTitle="charm grid"
      howTo={
        <ul>
          <li>
            fill every square so each <b>row</b>, each <b>column</b> and each <b>box</b> (the thicker lines) has every charm once.
          </li>
          <li>tap a square, then a charm. tap the same charm again to take it back.</li>
          <li>
            <b>notes</b> lets you pencil in little maybes. a <b>nudge</b> points out a charm that doesn’t fit, or fills one square for you.
          </li>
          <li>every puzzle has exactly one answer, and you can always find it by looking. no guessing needed ♡</li>
        </ul>
      }
    >
      <div className="cg" style={{ "--n": n, "--br": br, "--bc": bc }} data-solved={solved || undefined}>
        <div className="brain-choice cg-tiers" role="group" aria-label="puzzle size">
          {Object.entries(TIERS).map(([id, t]) => (
            <button key={id} type="button" aria-pressed={id === tier} onClick={() => switchTier(id)}>
              {t.label}
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
        <div className="cg-board-wrap">
          <div className="cg-board" role="grid" aria-label={`${n} by ${n} charm grid`}>
            {grid.map((v, i) => {
              const r = Math.floor(i / n);
              const c = i % n;
              const box = Math.floor(r / br) * (n / bc) + Math.floor(c / bc);
              const related = sel !== null && (r === selRow || c === selCol || box === selBox);
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  className="cg-cell"
                  style={{ "--i": i }}
                  data-given={puzzle[i] ? true : undefined}
                  data-selected={sel === i || undefined}
                  data-related={related || undefined}
                  data-same={selValue && v === selValue ? true : undefined}
                  data-clash={clash.has(i) || undefined}
                  data-flash={flash?.cell === i ? flash.kind : undefined}
                  data-last-col={c === n - 1 || undefined}
                  data-last-row={r === n - 1 || undefined}
                  data-box-right={(c + 1) % bc === 0 && c < n - 1 ? true : undefined}
                  data-box-bottom={(r + 1) % br === 0 && r < n - 1 ? true : undefined}
                  aria-label={`row ${r + 1}, column ${c + 1}: ${v ? charmName(v) : "empty"}${puzzle[i] ? ", given" : ""}${clash.has(i) ? ", repeats" : ""}`}
                  aria-selected={sel === i}
                  onClick={() => {
                    feel("tap");
                    setSelected(sel === i ? null : i);
                  }}
                >
                  {v ? (
                    <Charm value={v} />
                  ) : notes[i] ? (
                    <span className="cg-notes" aria-hidden="true">
                      {Array.from({ length: n }, (_, k) => (
                        <span key={k}>{notes[i] & (1 << (k + 1)) ? <Charm value={k + 1} /> : null}</span>
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        {solved ? (
          <div className="brain-done cg-done">
            <h3>all charmed ♡</h3>
            <p>
              solved in {clock(game.seconds)}
              {game.nudges ? ` with ${game.nudges} ${game.nudges === 1 ? "nudge" : "nudges"}` : ""} · best {clock(best[tier] ?? game.seconds)}
            </p>
            <div className="brain-done__actions">
              <button type="button" className="brain-btn" onClick={another}>
                another {TIERS[tier].label} one ✿
              </button>
            </div>
          </div>
        ) : (
          <div className="cg-controls">
            <div className="cg-palette" role="group" aria-label={noting ? "pencil a note" : "place a charm"} data-noting={noting || undefined}>
              {Array.from({ length: n }, (_, k) => (
                <button key={k} type="button" className="cg-charm-key" onClick={() => place(k + 1)} aria-label={`${noting ? "note" : "place"} ${charmName(k + 1)}`}>
                  <Charm value={k + 1} />
                </button>
              ))}
            </div>
            <div className="cg-actions">
              <button type="button" className="cg-action" aria-pressed={noting} onClick={() => setNoting((v) => !v)}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M15.5 4.5l4 4L9 19H5v-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M13 7l4 4" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                notes
              </button>
              <button type="button" className="cg-action" onClick={erase}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M4 15l8.5-8.5 6 6L12 19H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M9 9.5l6 6M12 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                clear
              </button>
              <button type="button" className="cg-action" onClick={undo} disabled={!history.length || history.at(-1).tier !== tier}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M8.5 7.5L4 12l4.5 4.5M4.5 12h9a5.5 5.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -3)" />
                </svg>
                undo
              </button>
              <button type="button" className="cg-action" onClick={nudge}>
                <span aria-hidden="true">✧</span> nudge
              </button>
            </div>
            <p className="cg-tip" role="status">
              {flash?.kind === "pick" ? "tap a square first ♡" : flash?.kind === "wrong" ? "this one doesn’t quite fit" : flash?.kind === "nudge" ? "that one could only be there ✧" : noting ? "notes: tap charms to pencil them in" : ""}
            </p>
          </div>
        )}
      </div>
    </BrainGame>
  );
}
