import { useEffect, useMemo, useRef, useState } from "react";
import BrainGame, { ToolButton } from "../common/BrainGame.jsx";
import { feel } from "../common/feel.js";
import { clock, readStore, useBoxSize, usePageVisible, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { solveByLines } from "./lineSolver.js";
import { PUZZLES, hintsFor } from "./puzzles.js";
import "./picture-stitch.css";

const GAME = "picture-stitch";
const SAVE = "kiriya:brain:picture-stitch";
const byId = Object.fromEntries(PUZZLES.map((p) => [p.id, p]));
const blank = (p) => ({ marks: Array(p.w * p.h).fill(0), seconds: 0, nudges: 0, solved: false });
const sameHints = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function restore() {
  const saved = readStore(SAVE, null);
  const progress = {};
  for (const p of PUZZLES) {
    const entry = saved?.progress?.[p.id];
    if (entry?.marks?.length === p.w * p.h) progress[p.id] = entry;
  }
  const current = byId[saved?.current] ? saved.current : (PUZZLES.find((p) => !progress[p.id]?.solved) ?? PUZZLES[0]).id;
  return { current, progress };
}

const lineOf = (marks, p, kind, k) =>
  kind === "row" ? marks.slice(k * p.w, k * p.w + p.w) : Array.from({ length: p.h }, (_, r) => marks[r * p.w + k]);
const isDone = (marks, p) =>
  p.rows.every((hints, r) => sameHints(hintsFor(lineOf(marks, p, "row", r)), hints)) &&
  p.cols.every((hints, c) => sameHints(hintsFor(lineOf(marks, p, "col", c)), hints));

function Mini({ puzzle, marks, solved }) {
  return (
    <span className="ps-mini" style={{ "--w": puzzle.w }} aria-hidden="true">
      {puzzle.solution.map((v, i) => (
        <i key={i} style={solved ? { background: puzzle.colours[i] ?? "transparent" } : marks?.[i] === 1 ? { background: "#8a5fa6" } : undefined} />
      ))}
    </span>
  );
}

function Gallery({ progress, current, onPick, onClose }) {
  const groups = [5, 8, 10].map((size) => PUZZLES.filter((p) => p.w === size));
  const count = PUZZLES.filter((p) => progress[p.id]?.solved).length;
  return (
    <div className="brain-howto ps-gallery" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="brain-howto__card" role="dialog" aria-modal="true" aria-label="pictures">
        <h2>
          pictures <small>{count} of {PUZZLES.length} stitched</small>
        </h2>
        {groups.map((group) => (
          <section key={group[0].w} className="ps-gallery__group">
            <h3>
              {group[0].w} × {group[0].h}
            </h3>
            <div className="ps-gallery__grid">
              {group.map((p) => {
                const entry = progress[p.id];
                return (
                  <button key={p.id} type="button" className="ps-gallery__tile" data-current={p.id === current || undefined} onClick={() => onPick(p.id)} aria-label={entry?.solved ? p.name : `a ${p.w} by ${p.h} picture${entry?.marks?.some((m) => m) ? ", started" : ""}`}>
                    {entry?.solved || entry?.marks?.some((m) => m === 1) ? <Mini puzzle={p} marks={entry.marks} solved={entry.solved} /> : <span className="ps-gallery__q">?</span>}
                    <small>{entry?.solved ? p.name.replace(/^an? /, "") : entry?.marks?.some((m) => m) ? "started" : "new"}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <button type="button" className="brain-btn brain-btn--soft" onClick={onClose}>
          back to stitching
        </button>
      </div>
    </div>
  );
}

export default function PictureStitch({ onReward }) {
  const [state, setState] = useState(restore);
  const [mode, setMode] = useState("stitch");
  const [history, setHistory] = useState([]);
  const [gallery, setGallery] = useState(false);
  const [flash, setFlash] = useState(null);
  const [cursor, setCursor] = useState(0);
  const area = useRef(null);
  const cellsRef = useRef(null);
  const drag = useRef(null);
  const visible = usePageVisible();
  const size = useBoxSize(area);
  const puzzle = byId[state.current];
  const entry = state.progress[puzzle.id] ?? blank(puzzle);
  const { marks, solved } = entry;

  useEffect(() => writeStore(SAVE, state), [state]);

  const save = (change) => setState((s) => ({ ...s, progress: { ...s.progress, [s.current]: { ...(s.progress[s.current] ?? blank(byId[s.current])), ...change } } }));

  // The clock starts with her first stitch and runs only while she's looking at the puzzle.
  const started = marks.some(Boolean);
  useEffect(() => {
    if (solved || !visible || gallery || !started) return undefined;
    const id = setInterval(
      () =>
        setState((s) => {
          const e = s.progress[s.current];
          return !e || e.solved ? s : { ...s, progress: { ...s.progress, [s.current]: { ...e, seconds: e.seconds + 1 } } };
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [solved, visible, gallery, started, state.current]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [flash]);

  // Sizing: the clues take what they need, the cells share the rest, measured from the sheet.
  const rowClueChars = Math.max(...puzzle.rows.map((h) => h.length));
  const colClueChars = Math.max(...puzzle.cols.map((h) => h.length));
  const cell = useMemo(() => {
    if (!size.width) return 32;
    const across = (size.width - 24 - (rowClueChars * 13 + 10)) / puzzle.w;
    const down = (size.height - 18 - (colClueChars * 15 + 8)) / puzzle.h;
    return Math.max(22, Math.min(58, Math.floor(Math.min(across, down))));
  }, [size, rowClueChars, colClueChars, puzzle]);

  const rowDone = puzzle.rows.map((hints, r) => sameHints(hintsFor(lineOf(marks, puzzle, "row", r)), hints));
  const colDone = puzzle.cols.map((hints, c) => sameHints(hintsFor(lineOf(marks, puzzle, "col", c)), hints));

  function finishIfDone(next) {
    if (!isDone(next, puzzle)) return;
    save({ marks: next, solved: true });
    feel("win");
    rewardOnce(onReward, { sticker: "st-stitch-heart", game: GAME, reason: "first picture stitched" });
    const allSolved = PUZZLES.every((p) => p.id === puzzle.id || state.progress[p.id]?.solved);
    if (allSolved) rewardOnce(onReward, { sticker: "st-bow", game: GAME, reason: "every picture stitched" });
  }

  const cellAt = (event) => {
    const node = cellsRef.current;
    const rect = node.getBoundingClientRect();
    const c = Math.floor((event.clientX - rect.left - node.clientLeft) / cell);
    const r = Math.floor((event.clientY - rect.top - node.clientTop) / cell);
    return c < 0 || r < 0 || c >= puzzle.w || r >= puzzle.h ? null : { r, c };
  };
  const allowed = (value, action, origin) => (action === 0 ? value === origin : value === 0);

  function paint(from, to, base, action, origin) {
    const next = base.slice();
    const [r0, c0, r1, c1] = [from.r, from.c, to.r, to.c];
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++)
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
        const i = r * puzzle.w + c;
        if (allowed(base[i], action, origin)) next[i] = action;
      }
    return next;
  }

  const onPointerDown = (event) => {
    if (solved || event.button > 0) return;
    const at = cellAt(event);
    if (!at) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const i = at.r * puzzle.w + at.c;
    const origin = marks[i];
    const action = mode === "stitch" ? (origin === 1 ? 0 : origin === -1 ? -2 : 1) : origin === -1 ? 0 : origin === 1 ? -2 : -1;
    if (action === -2) return; // a cross can't be stitched over (and the other way round): clear it first
    const next = paint(at, at, marks, action, origin);
    drag.current = { start: at, base: marks, action, origin, axis: null, last: i, latest: next };
    setCursor(i);
    feel(action === 0 ? "tap" : "place");
    save({ marks: next });
  };
  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d) return;
    const at = cellAt(event);
    if (!at) return;
    // A drag sticks to the row or the column it set off along.
    d.axis ??= at.r !== d.start.r || at.c !== d.start.c ? (Math.abs(at.r - d.start.r) > Math.abs(at.c - d.start.c) ? "col" : "row") : null;
    const target = d.axis === "row" ? { r: d.start.r, c: at.c } : d.axis === "col" ? { r: at.r, c: d.start.c } : at;
    const i = target.r * puzzle.w + target.c;
    if (i === d.last) return;
    d.last = i;
    setCursor(i);
    feel("tap");
    d.latest = paint(d.start, target, d.base, d.action, d.origin);
    save({ marks: d.latest });
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setHistory((h) => [...h.slice(-40), { id: puzzle.id, marks: d.base }]);
    finishIfDone(d.latest);
  };

  const onKeyDown = (event) => {
    if (solved) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.w, ArrowDown: puzzle.w };
    if (moves[event.key] !== undefined) {
      event.preventDefault();
      setCursor((c) => Math.min(puzzle.w * puzzle.h - 1, Math.max(0, c + moves[event.key])));
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const value = marks[cursor];
      const target = mode === "stitch" ? (value === 1 ? 0 : 1) : value === -1 ? 0 : -1;
      const next = marks.map((v, i) => (i === cursor ? target : v));
      setHistory((h) => [...h.slice(-40), { id: puzzle.id, marks }]);
      save({ marks: next });
      finishIfDone(next);
    }
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last || last.id !== puzzle.id || solved) return;
    feel("tap");
    setHistory((h) => h.slice(0, -1));
    save({ marks: last.marks });
  };

  // A nudge first points at a stitch that doesn't belong; otherwise it works out one cell from the
  // clues and what she has right, and fills it in.
  const nudge = () => {
    if (solved) return;
    const wrong = marks.findIndex((v, i) => (v === 1 && !puzzle.solution[i]) || (v === -1 && puzzle.solution[i]));
    if (wrong !== -1) {
      setFlash({ cell: wrong, kind: "wrong" });
      feel("oops");
      return;
    }
    const { grid } = solveByLines(puzzle.rows, puzzle.cols, marks);
    let i = grid.findIndex((v, k) => v === 1 && marks[k] !== 1);
    if (i === -1) i = puzzle.solution.findIndex((v, k) => v === 1 && marks[k] !== 1);
    if (i === -1) return;
    const next = marks.map((v, k) => (k === i ? 1 : v));
    setFlash({ cell: i, kind: "nudge" });
    feel("good");
    setHistory((h) => [...h.slice(-40), { id: puzzle.id, marks }]);
    save({ marks: next, nudges: entry.nudges + 1 });
    finishIfDone(next);
  };

  const open = (id) => {
    feel("tap");
    setGallery(false);
    setHistory([]);
    setState((s) => ({ ...s, current: id }));
  };
  const nextPicture = PUZZLES.find((p, k) => k > PUZZLES.indexOf(puzzle) && !state.progress[p.id]?.solved) ?? PUZZLES.find((p) => !state.progress[p.id]?.solved);

  const rowClueW = rowClueChars * 13 + 10;
  const colClueH = colClueChars * 15 + 8;
  return (
    <BrainGame
      id={GAME}
      className="ps-game"
      status={
        <>
          {puzzle.w} × {puzzle.h}
          <small>
            {clock(entry.seconds)}
            {entry.nudges ? ` · ${entry.nudges} ${entry.nudges === 1 ? "nudge" : "nudges"}` : ""}
          </small>
        </>
      }
      tools={
        <ToolButton label="all the pictures" onClick={() => setGallery(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {[3, 10, 17].flatMap((y) => [3, 10, 17].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="5" height="5" rx="1.4" fill="currentColor" opacity={x === 10 && y === 10 ? 0.45 : 1} />))}
          </svg>
        </ToolButton>
      }
      howToTitle="picture stitch"
      howTo={
        <ul>
          <li>
            the numbers say how many stitches sit <b>together</b> in that row or column, in order, with at least one gap between groups.
          </li>
          <li>
            <b>stitch</b> the squares you’re sure of. switch to <b>cross</b> to mark squares that stay empty.
          </li>
          <li>drag along a row or column to do several at once. a number fades when its line is right.</li>
          <li>finish every line and a little picture appears ♡ every one can be worked out without guessing.</li>
        </ul>
      }
    >
      <div className="ps" data-solved={solved || undefined}>
        <div className="ps-area" ref={area}>
          <div
            className="ps-board"
            style={{ "--cell": `${cell}px`, gridTemplateColumns: `${rowClueW}px ${cell * puzzle.w + 4}px`, gridTemplateRows: `${colClueH}px ${cell * puzzle.h + 4}px` }}
          >
            <div className="ps-corner" aria-hidden="true">
              <Mini puzzle={puzzle} marks={marks} solved={solved} />
            </div>
            <div className="ps-col-clues" style={{ gridTemplateColumns: `repeat(${puzzle.w}, ${cell}px)` }} aria-hidden="true">
              {puzzle.cols.map((hints, c) => (
                <span key={c} data-done={colDone[c] || undefined} data-five={(c + 1) % 5 === 0 && c < puzzle.w - 1 ? true : undefined}>
                  {(hints.length ? hints : [0]).map((h, k) => (
                    <b key={k}>{h}</b>
                  ))}
                </span>
              ))}
            </div>
            <div className="ps-row-clues" style={{ gridTemplateRows: `repeat(${puzzle.h}, ${cell}px)` }} aria-hidden="true">
              {puzzle.rows.map((hints, r) => (
                <span key={r} data-done={rowDone[r] || undefined}>
                  {(hints.length ? hints : [0]).map((h, k) => (
                    <b key={k}>{h}</b>
                  ))}
                </span>
              ))}
            </div>
            <div
              ref={cellsRef}
              className="ps-cells"
              role="grid"
              tabIndex={0}
              aria-label={`${puzzle.w} by ${puzzle.h} picture. ${mode} mode. arrow keys move, space marks.`}
              style={{ gridTemplateColumns: `repeat(${puzzle.w}, ${cell}px)` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            >
              {marks.map((v, i) => {
                const r = Math.floor(i / puzzle.w);
                const c = i % puzzle.w;
                return (
                  <span
                    key={i}
                    role="gridcell"
                    className="ps-cell"
                    data-mark={v === 1 ? "stitch" : v === -1 ? "cross" : undefined}
                    data-cursor={cursor === i || undefined}
                    data-flash={flash?.cell === i ? flash.kind : undefined}
                    data-five-right={(c + 1) % 5 === 0 && c < puzzle.w - 1 ? true : undefined}
                    data-five-bottom={(r + 1) % 5 === 0 && r < puzzle.h - 1 ? true : undefined}
                    style={solved && puzzle.colours[i] ? { "--thread": puzzle.colours[i], "--d": `${(r + c) * 35}ms` } : undefined}
                    aria-label={`row ${r + 1}, column ${c + 1}: ${v === 1 ? "stitched" : v === -1 ? "crossed out" : "empty"}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {solved ? (
          <div className="brain-done ps-done">
            <h3>{puzzle.name} ♡</h3>
            <p>
              stitched in {clock(entry.seconds)}
              {entry.nudges ? ` with ${entry.nudges} ${entry.nudges === 1 ? "nudge" : "nudges"}` : ""}
            </p>
            <div className="brain-done__actions">
              {nextPicture && (
                <button type="button" className="brain-btn" onClick={() => open(nextPicture.id)}>
                  next picture →
                </button>
              )}
              <button type="button" className="brain-btn brain-btn--soft" onClick={() => setGallery(true)}>
                all pictures
              </button>
            </div>
          </div>
        ) : (
          <div className="ps-controls">
            <div className="brain-choice ps-modes" role="group" aria-label="what a tap does">
              <button type="button" aria-pressed={mode === "stitch"} onClick={() => setMode("stitch")}>
                <span className="ps-mode-icon ps-mode-icon--stitch" aria-hidden="true" /> stitch
              </button>
              <button type="button" aria-pressed={mode === "cross"} onClick={() => setMode("cross")}>
                <span className="ps-mode-icon ps-mode-icon--cross" aria-hidden="true">
                  ✕
                </span>{" "}
                cross
              </button>
            </div>
            <div className="ps-actions">
              <button type="button" className="ps-action" onClick={undo} disabled={!history.length || history.at(-1).id !== puzzle.id}>
                ↺ undo
              </button>
              <button type="button" className="ps-action" onClick={nudge}>
                ✧ nudge
              </button>
              <p className="ps-tip" role="status">
                {flash?.kind === "wrong" ? "that square isn’t part of it" : flash?.kind === "nudge" ? "the clues say this one ✧" : ""}
              </p>
            </div>
          </div>
        )}
        {gallery && <Gallery progress={state.progress} current={puzzle.id} onPick={open} onClose={() => setGallery(false)} />}
      </div>
    </BrainGame>
  );
}
