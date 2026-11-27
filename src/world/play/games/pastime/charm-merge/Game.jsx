import { useEffect, useMemo, useRef, useState } from "react";
import { haptic } from "../../../../../lib/native.js";
import { celebrate } from "../../../../../shared/effects.js";
import PastimeShell, { PastimeSheet, prefersLessMotion, useSize, useTimers } from "../_shared/PastimeShell.jsx";
import { play } from "../_shared/sound.js";
import { load, rewardOnce, save } from "../_shared/storage.js";
import { CROWN, LADDER, SIZE, isGame, move, newGame } from "./engine.js";
import { CharmArt, TILE_TONES } from "./art.jsx";
import "./Game.css";

const GAME = "charm-merge";
const TAKE_BACKS = 3;
const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

function restore() {
  const saved = load(GAME);
  if (saved && isGame(saved.game)) return saved;
  const fresh = { game: newGame(), undo: null, takeBacks: TAKE_BACKS, best: saved?.best ?? 0, bestTier: saved?.bestTier ?? 1 };
  save(GAME, fresh);
  return fresh;
}

const tilesOf = (game, flags = {}) => game.cells.flatMap((cell, idx) => (cell ? [{ ...cell, idx, state: flags[cell.id] }] : []));

const HELP = (
  <>
    <p>Swipe up, down, left or right: every charm slides as far as it can.</p>
    <ul>
      <li>Two matching charms that bump together become the next charm up the ladder.</li>
      <li>bead → heart → star → bell → ribbon → moon → blossom → gem → <b>crown</b>.</li>
      <li>Three take-backs ↶ per board, for a swipe that goes the wrong way.</li>
    </ul>
    <p>Keep the big charms together in a corner. The board waits for you.</p>
  </>
);

export default function CharmMerge({ onReward }) {
  const initial = useMemo(restore, []);
  const [game, setGame] = useState(initial.game);
  const [undo, setUndo] = useState(initial.undo);
  const [takeBacks, setTakeBacks] = useState(initial.takeBacks ?? TAKE_BACKS);
  const [best, setBest] = useState(initial.best ?? 0);
  const [bestTier, setBestTier] = useState(initial.bestTier ?? 1);
  const [view, setView] = useState(() => ({ tiles: tilesOf(initial.game), ghosts: [] }));
  const [sheet, setSheet] = useState(initial.game.over ? "over" : null);
  const stage = useRef(null);
  const swipe = useRef(null);
  const timers = useTimers();
  const { width, height } = useSize(stage);
  const calm = prefersLessMotion();
  const slideMs = calm ? 40 : 120;
  const boardPx = Math.max(240, Math.min(440, Math.floor(Math.min(width, height)) || 320));
  const gap = Math.round(boardPx * 0.028);
  const cell = (boardPx - gap * (SIZE + 1)) / SIZE;

  const persist = (next) => save(GAME, { game: next.game, undo: next.undo, takeBacks: next.takeBacks, best: next.best, bestTier: next.bestTier });

  function go(direction) {
    if (sheet) return;
    const result = move(game, direction);
    if (!result.moved) {
      play("nope");
      return;
    }
    const next = result.state;
    const flags = {};
    result.merges.forEach((merge) => (flags[merge.id] = "merged"));
    if (next.spawned) flags[next.spawned] = "new";
    const mergedAway = new Set(result.merges.flatMap((merge) => merge.from));
    const ghosts = view.tiles.filter((tile) => mergedAway.has(tile.id)).map((tile) => ({ ...tile, idx: result.slides[tile.id], state: "ghost" }));
    setView({ tiles: tilesOf(next, flags), ghosts });
    timers.later(() => setView((old) => (old.ghosts === ghosts ? { ...old, ghosts: [] } : old)), slideMs + 30);

    const biggest = Math.max(0, ...result.merges.map((merge) => merge.tier));
    if (biggest) {
      play("pop", biggest);
      haptic(biggest >= 6 ? "medium" : "light");
    } else play("tap");

    const nextBest = Math.max(best, next.score);
    const nextBestTier = Math.max(bestTier, next.top);
    setGame(next);
    setUndo(game);
    setBest(nextBest);
    setBestTier(nextBestTier);
    persist({ game: next, undo: game, takeBacks, best: nextBest, bestTier: nextBestTier });

    if (next.crowned && !game.crowned) {
      play("win", 3);
      haptic("success");
      const rect = stage.current?.getBoundingClientRect();
      if (rect) celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 3) / window.innerHeight }, 1);
      rewardOnce(onReward, { sticker: "st-crown", game: GAME, reason: "first crown" });
      timers.later(() => setSheet("crown"), calm ? 100 : 600);
    } else if (next.over) {
      timers.later(() => setSheet("over"), calm ? 100 : 500);
    }
  }

  function takeBack() {
    if (!undo || takeBacks <= 0) return;
    const left = takeBacks - 1;
    setGame(undo);
    setView({ tiles: tilesOf(undo), ghosts: [] });
    setUndo(null);
    setTakeBacks(left);
    setSheet(null);
    play("swap");
    persist({ game: undo, undo: null, takeBacks: left, best, bestTier });
  }

  function fresh() {
    const next = newGame();
    setGame(next);
    setUndo(null);
    setTakeBacks(TAKE_BACKS);
    setView({ tiles: tilesOf(next, Object.fromEntries(next.cells.filter(Boolean).map((cell) => [cell.id, "new"]))), ghosts: [] });
    setSheet(null);
    persist({ game: next, undo: null, takeBacks: TAKE_BACKS, best, bestTier });
  }

  // Arrow keys on a keyboard.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKey = (event) => {
      if (!KEYS[event.key] || event.target.closest?.("input, textarea")) return;
      event.preventDefault();
      goRef.current(KEYS[event.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Swipes: decided as soon as the finger has travelled far enough, so it feels immediate.
  function onPointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    swipe.current = { x: event.clientX, y: event.clientY, done: false };
  }
  function onPointerMove(event) {
    const s = swipe.current;
    if (!s || s.done) return;
    const dx = event.clientX - s.x, dy = event.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    s.done = true;
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  const pos = (idx) => `translate3d(${gap + (idx % SIZE) * (cell + gap)}px, ${gap + Math.floor(idx / SIZE) * (cell + gap)}px, 0)`;
  const renderTile = (tile) => {
    const [fill, edge] = TILE_TONES[tile.tier];
    return (
      <div key={tile.id} className="charm-tile" data-state={tile.state} data-tier={tile.tier}
        style={{ transform: pos(tile.idx), width: cell, height: cell, "--fill": fill, "--edge": edge }}>
        <div className="charm-tile__face">
          <CharmArt tier={tile.tier} size={Math.round(cell * 0.72)} />
        </div>
      </div>
    );
  };

  return (
    <PastimeShell game={GAME} kicker="charm ladder · climb to a crown" help={HELP}>
      <div className="charm" style={{ "--slide": `${slideMs}ms` }}>
        <div className="pastime-stats">
          <div className="pastime-stat"><span className="pastime-stat__label">score</span><span className="pastime-stat__value">{game.score}</span></div>
          <div className="pastime-stat"><span className="pastime-stat__label">best</span><span className="pastime-stat__value">{best}</span></div>
          <button type="button" className="pastime-button charm-takeback" onClick={takeBack} disabled={!undo || takeBacks <= 0}
            aria-label={`Take back the last move, ${takeBacks} left`}>
            <span aria-hidden="true">↶</span> <span className="charm-takeback__count" aria-hidden="true">{takeBacks}</span>
          </button>
        </div>
        <div className="charm-stage" ref={stage}>
          <div className="charm-board" style={{ width: boardPx, height: boardPx, "--gap": `${gap}px` }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (swipe.current = null)} onPointerCancel={() => (swipe.current = null)}
            role="application" aria-label="Charm board. Swipe or use the arrow keys to slide the charms.">
            {Array.from({ length: SIZE * SIZE }, (_, idx) => (
              <div key={`s${idx}`} className="charm-slot" style={{ transform: pos(idx), width: cell, height: cell }} aria-hidden="true" />
            ))}
            {view.ghosts.map(renderTile)}
            {view.tiles.map(renderTile)}
          </div>
        </div>
        <div className="charm-ladder" aria-label={`Your ladder: up to the ${LADDER[game.top].name}`}>
          {LADDER.slice(1, CROWN + 1).map((rung, i) => {
            const tier = i + 1;
            return (
              <span key={rung.name} className="charm-rung" data-reached={tier <= game.top} data-goal={tier === CROWN} title={rung.name}>
                <CharmArt tier={tier} size={tier === CROWN ? 34 : 26} dim={tier > Math.max(game.top, bestTier)} />
              </span>
            );
          })}
        </div>
        <div className="charm-foot">
          <span className="charm-foot__top">highest: <b>{LADDER[game.top].name}</b></span>
          <button type="button" className="pastime-button pastime-button--small" onClick={() => setSheet("restart")}>new board ↺</button>
        </div>
      </div>
      <PastimeSheet open={sheet === "crown"} title="a crown! ♡" onClose={() => setSheet(null)} closeLabel="keep climbing ✧">
        <div className="charm-sheet-art"><CharmArt tier={CROWN} size={88} /></div>
        <p>Every charm on the ladder, all the way to the top. There are fancier crowns past this one, if you want to keep going.</p>
      </PastimeSheet>
      <PastimeSheet open={sheet === "over"} title="the board is full" closeLabel={null}>
        <div className="charm-sheet-art"><CharmArt tier={game.top} size={72} /></div>
        <p>You reached the <b>{LADDER[game.top].name}</b> with {game.score} points{game.score >= best && game.score > 0 ? ", your best yet ♡" : "."}</p>
        <div className="charm-sheet-actions">
          {undo && takeBacks > 0 && <button type="button" className="pastime-button" onClick={takeBack}>take back ↶</button>}
          <button type="button" className="pastime-button pastime-button--primary" onClick={fresh}>new board ↺</button>
        </div>
      </PastimeSheet>
      <PastimeSheet open={sheet === "restart"} title="start a new board?" onClose={() => setSheet(null)} closeLabel="keep this one">
        <p>This board goes away and a fresh one starts with two little charms.</p>
        <button type="button" className="pastime-button pastime-button--primary charm-sheet-wide" onClick={fresh}>new board ↺</button>
      </PastimeSheet>
    </PastimeShell>
  );
}
