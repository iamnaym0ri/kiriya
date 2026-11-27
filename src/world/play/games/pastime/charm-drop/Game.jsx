import { useEffect, useMemo, useRef, useState } from "react";
import { haptic } from "../../../../../lib/native.js";
import { celebrate } from "../../../../../shared/effects.js";
import PastimeShell, { PastimeSheet, PausedCard, prefersLessMotion, usePause, useSize } from "../_shared/PastimeShell.jsx";
import { play } from "../_shared/sound.js";
import { load, rewardOnce, save } from "../_shared/storage.js";
import { COLS, ROWS, cellsOf, drop, ghostOf, hardDrop, hold, isGame, level, move, newGame, resting, rotate, stepFor } from "./engine.js";
import { CharmCell, drawCell, makeSprites } from "./art.jsx";
import "./Game.css";

const GAME = "charm-drop";
const LOCK_DELAY = 0.5;
const CHEERS = { 2: "a pair ♡", 3: "lovely!", 4: "a whole string!" };

function restore() {
  const saved = load(GAME);
  return { game: saved && isGame(saved.game) && !saved.game.over ? saved.game : null, best: saved?.best ?? 0 };
}

const HELP = (
  <>
    <p>Charms fall into the jar. Fill a whole row and it strings itself up and floats away.</p>
    <ul>
      <li>Tap the jar to turn a charm; slide your finger left or right to move it; drag down to hurry it; flick down to drop it straight in.</li>
      <li>The buttons underneath do the same, if you'd rather.</li>
      <li>Tap <b>keep</b> to set a charm aside for later.</li>
      <li>It stays slow and gentle; it only speeds up a little every ten rows. Leave the app and it waits for you.</li>
    </ul>
  </>
);

export default function CharmDrop({ onReward }) {
  const initial = useMemo(restore, []);
  const game = useRef(initial.game ?? newGame());
  const [hud, setHud] = useState(() => ({ ...game.current }));
  const [best, setBest] = useState(initial.best);
  const [cheer, setCheer] = useState(null);
  const [userPaused, setUserPaused] = useState(Boolean(initial.game));
  const { paused: away, resume } = usePause();
  const paused = away || userPaused;
  const stage = useRef(null);
  const canvas = useRef(null);
  const sprites = useRef(null);
  const loop = useRef({ dt: 0, lock: 0, resets: 0, flashes: [] });
  const { width, height } = useSize(stage);
  const cell = Math.max(14, Math.floor(Math.min(width / COLS, height / ROWS)) || 24);
  const calm = prefersLessMotion();
  const over = hud.over;

  const sync = () => setHud({ ...game.current });

  function afterLock({ state, cleared }) {
    game.current = state;
    loop.current.lock = 0;
    loop.current.resets = 0;
    if (cleared.length) {
      const now = performance.now();
      loop.current.flashes = cleared.map((row) => ({ row, at: now }));
      play("chime", 2 + cleared.length * 2);
      haptic(cleared.length >= 3 ? "medium" : "light");
      if (CHEERS[cleared.length]) {
        setCheer({ text: CHEERS[cleared.length], key: now });
        setTimeout(() => setCheer(null), 1150);
      }
      if (cleared.length === 4) {
        const rect = canvas.current?.getBoundingClientRect();
        if (rect) celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height * 0.7) / window.innerHeight }, 0.6);
        rewardOnce(onReward, { sticker: "st-star", game: GAME, reason: "a whole string of four" });
      }
      if (state.lines >= 20) rewardOnce(onReward, { sticker: "st-charm-bracelet", game: GAME, reason: "twenty rows in one jar" });
    } else play("drop");
    if (state.over) {
      play("win", 0);
      haptic("warning");
      const nextBest = Math.max(best, state.score);
      setBest(nextBest);
      save(GAME, { game: null, best: nextBest });
    } else save(GAME, { game: state, best });
    sync();
  }

  // Player actions. A move or turn on the floor gives the charm a moment longer before it settles.
  function act(kind) {
    if (paused || game.current.over) return;
    const before = game.current;
    let after = before;
    if (kind === "left") after = move(before, -1);
    else if (kind === "right") after = move(before, 1);
    else if (kind === "rotate") after = rotate(before, 1);
    else if (kind === "soft") {
      const result = drop(before, { soft: true });
      if (result.locked) return afterLock(result);
      after = result.state;
      loop.current.dt = 0;
    } else if (kind === "hard") {
      haptic("light");
      return afterLock(hardDrop(before));
    } else if (kind === "hold") {
      after = hold(before);
      if (after !== before) play("swap");
    }
    if (after === before) return;
    if ((kind === "left" || kind === "right" || kind === "rotate") && resting(after) && loop.current.resets < 15) {
      loop.current.lock = 0;
      loop.current.resets++;
    }
    if (kind === "rotate") play("tap");
    game.current = after;
    sync();
  }
  const actRef = useRef(act);
  actRef.current = act;

  // Draw and fall, every frame.
  useEffect(() => {
    const node = canvas.current;
    if (!node || !cell) return undefined;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    node.width = COLS * cell * dpr;
    node.height = ROWS * cell * dpr;
    const ctx = node.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sprites.current = makeSprites(cell, dpr);
    let frame = 0;
    let last = performance.now();
    const draw = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const g = game.current;
      if (!pausedRef.current && !g.over) {
        const L = loop.current;
        if (resting(g)) {
          L.lock += dt;
          if (L.lock >= LOCK_DELAY) afterLockRef.current(drop(g));
        } else {
          L.lock = 0;
          L.dt += dt;
          if (L.dt >= stepFor(g)) {
            L.dt = 0;
            game.current = drop(g).state;
          }
        }
      }
      paint(ctx, game.current, cell, sprites.current, loop.current.flashes, now, calm);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [cell, calm]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused || Boolean(hud.over);
  const afterLockRef = useRef(afterLock);
  afterLockRef.current = afterLock;

  // Keep her place when she leaves.
  useEffect(() => {
    if (away && !game.current.over) save(GAME, { game: game.current, best });
  }, [away]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard, for a computer.
  useEffect(() => {
    const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotate", ArrowDown: "soft", " ": "hard", c: "hold", C: "hold" };
    const onKey = (event) => {
      if (event.key === "p" || event.key === "Escape") return setUserPaused((p) => !p);
      if (!keys[event.key]) return;
      event.preventDefault();
      actRef.current(keys[event.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Touch on the jar: tap turns, sideways slides, down hurries, a flick drops, a flick up keeps.
  const touch = useRef(null);
  function onPointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    touch.current = { x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY, t0: performance.now(), moved: false, dropped: 0 };
  }
  function onPointerMove(event) {
    const t = touch.current;
    if (!t) return;
    const dx = event.clientX - t.x;
    const dy = event.clientY - t.y;
    const step = cell * 0.9;
    if (Math.abs(dx) >= step) {
      const n = Math.trunc(dx / step);
      for (let i = 0; i < Math.abs(n); i++) actRef.current(n > 0 ? "right" : "left");
      t.x += n * step;
      t.moved = true;
    }
    if (dy >= step && Math.abs(event.clientX - t.x0) < cell * 1.5) {
      const n = Math.trunc(dy / step);
      for (let i = 0; i < n; i++) actRef.current("soft");
      t.y += n * step;
      t.dropped += n;
      t.moved = true;
    }
  }
  function onPointerUp(event) {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const ms = performance.now() - t.t0;
    const dy = event.clientY - t.y0;
    const dx = event.clientX - t.x0;
    if (ms < 260 && dy > cell * 2.2 && Math.abs(dx) < dy * 0.6) return actRef.current("hard");
    if (ms < 300 && dy < -cell * 2 && Math.abs(dx) < -dy * 0.6) return actRef.current("hold");
    if (!t.moved && Math.hypot(dx, dy) < 10) actRef.current("rotate");
  }

  // Buttons repeat while held, like a real handheld.
  const repeat = useRef(0);
  const press = (kind) => (event) => {
    event.preventDefault();
    actRef.current(kind);
    if (kind !== "left" && kind !== "right" && kind !== "soft") return;
    clearTimeout(repeat.current);
    const again = () => {
      actRef.current(kind);
      repeat.current = setTimeout(again, kind === "soft" ? 45 : 70);
    };
    repeat.current = setTimeout(again, 180);
  };
  const release = () => clearTimeout(repeat.current);
  useEffect(() => () => clearTimeout(repeat.current), []);

  function again() {
    game.current = newGame();
    loop.current = { dt: 0, lock: 0, resets: 0, flashes: [] };
    setUserPaused(false);
    sync();
    save(GAME, { game: game.current, best });
  }

  const g = hud;
  const pauseButton = (
    <button type="button" className="pastime__icon" onClick={() => setUserPaused(true)} aria-label="Pause" disabled={over}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
    </button>
  );

  return (
    <PastimeShell game={GAME} kicker="charm drop · a slow little stack" help={HELP} actions={pauseButton}>
      <div className="drop">
        <div className="drop-main">
          <div className="drop-stage" ref={stage}>
            <div className="drop-jar" style={{ width: cell * COLS, height: cell * ROWS }}>
              <canvas ref={canvas} style={{ width: cell * COLS, height: cell * ROWS }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (touch.current = null)}
                role="img" aria-label={`The charm jar. ${g.lines} rows cleared, ${g.score} points.`} />
              {cheer && <div key={cheer.key} className="pastime-cheer">{cheer.text}</div>}
            </div>
          </div>
          <aside className="drop-side">
            <div className="drop-box">
              <span className="pastime-stat__label">next</span>
              {g.queue.slice(0, 3).map((type, i) => <CharmCell key={i} type={type} size={i === 0 ? 15 : 11} />)}
            </div>
            <button type="button" className="drop-box drop-keep" onClick={() => act("hold")} disabled={!g.canHold || over} aria-label={g.hold ? `Keep: swap for the saved ${g.hold}` : "Keep this charm for later"}>
              <span className="pastime-stat__label">keep</span>
              {g.hold ? <CharmCell type={g.hold} size={13} /> : <span className="drop-keep__empty">tap</span>}
            </button>
            <div className="drop-box drop-numbers">
              <span className="pastime-stat__label">score</span><b>{g.score}</b>
              <span className="pastime-stat__label">rows</span><b>{g.lines}</b>
              <span className="pastime-stat__label">pace</span><b>{level(g)}</b>
            </div>
          </aside>
        </div>
        <div className="drop-controls">
          <button type="button" className="pastime-button" onPointerDown={press("left")} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} aria-label="Move left">◀</button>
          <button type="button" className="pastime-button" onPointerDown={press("rotate")} aria-label="Turn">⟳</button>
          <button type="button" className="pastime-button" onPointerDown={press("right")} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} aria-label="Move right">▶</button>
          <button type="button" className="pastime-button" onPointerDown={press("soft")} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} aria-label="Down a little">▼</button>
          <button type="button" className="pastime-button pastime-button--primary" onPointerDown={press("hard")} aria-label="Drop it in">⤓</button>
        </div>
      </div>
      {paused && !over && (
        <PausedCard line={userPaused && !away && initial.game && g.pieces === initial.game.pieces ? "your jar is just as you left it." : "the charms are waiting, mid-air."}
          onResume={() => {
            resume();
            setUserPaused(false);
            loop.current.dt = 0;
          }} />
      )}
      <PastimeSheet open={over} title="the jar is full" closeLabel={null}>
        <p>{g.lines} row{g.lines === 1 ? "" : "s"} strung, {g.score} points{g.score >= best && g.score > 0 ? ", your best jar yet ♡" : `. best: ${best}.`}</p>
        <button type="button" className="pastime-button pastime-button--primary drop-again" onClick={again}>a fresh jar ↺</button>
      </PastimeSheet>
    </PastimeShell>
  );
}

function paint(ctx, g, cell, sprites, flashes, now, calm) {
  const w = COLS * cell, h = ROWS * cell;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f6eefa";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e7d8ef";
  for (let y = 1; y < ROWS; y++) for (let x = 1; x < COLS; x++) ctx.fillRect(x * cell - 1, y * cell - 1, 2, 2);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g.grid[y][x]) drawCell(ctx, sprites, g.grid[y][x], x * cell, y * cell, cell);
  if (!g.over && g.current) {
    const ghost = ghostOf(g);
    ctx.globalAlpha = 0.28;
    for (const [x, y] of cellsOf(ghost)) if (y >= 0) drawCell(ctx, sprites, ghost.type, x * cell, y * cell, cell);
    ctx.globalAlpha = 1;
    for (const [x, y] of cellsOf(g.current)) if (y >= 0) drawCell(ctx, sprites, g.current.type, x * cell, y * cell, cell);
  }
  // Rows that just strung themselves up: a soft white sweep.
  const life = calm ? 120 : 380;
  for (const flash of flashes) {
    const t = (now - flash.at) / life;
    if (t >= 1) continue;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * (1 - t)})`;
    ctx.fillRect(0, flash.row * cell - (calm ? 0 : t * cell * 0.5), w, cell);
  }
}
