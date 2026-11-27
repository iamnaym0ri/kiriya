import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { haptic } from "../../../../../lib/native.js";
import { celebrate } from "../../../../../shared/effects.js";
import PastimeShell, { PastimeSheet, prefersLessMotion, useSize, useTimers } from "../_shared/PastimeShell.jsx";
import { play } from "../_shared/sound.js";
import { load, rewardOnce, save } from "../_shared/storage.js";
import { SIZE, adjacent, findMove, flowersFor, gardenDone, harvest, newGarden, playSwap } from "./engine.js";
import { HERB_NAMES, HerbIcon, HerbSprite } from "./art.jsx";
import "./Game.css";

const GAME = "herb-match";
const CHEERS = ["lovely!", "so pretty ♡", "what a harvest!", "garden party!", "blooming!"];

function restore() {
  const saved = load(GAME);
  if (saved?.garden?.board?.cells?.length === SIZE.w * SIZE.h && saved.garden.plan?.goals) return saved;
  const fresh = { garden: newGarden(1), best: {} };
  save(GAME, fresh);
  return fresh;
}

function Flowers({ count, of = 3 }) {
  return (
    <span className="herb-flowers" aria-label={`${count} of ${of} flowers`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} aria-hidden="true" data-on={i < count}>✿</span>
      ))}
    </span>
  );
}

function Tile({ cell, idx, w, state, selected, hint, drop }) {
  const r = Math.floor(idx / w), c = idx % w;
  const special = cell.special;
  return (
    <div
      className="herb-tile"
      data-state={state}
      data-selected={selected || undefined}
      data-hint={hint || undefined}
      data-special={special || undefined}
      style={{ transform: `translate3d(calc(var(--cell) * ${c}), calc(var(--cell) * ${r}), 0)`, "--drop": drop ?? 0 }}
    >
      <svg className="herb-tile__art" viewBox="0 0 48 48" aria-hidden="true">
        {special === "can" && <use href="#herb-dew" />}
        <use href={special === "honey" ? "#herb-honey" : `#herb-${cell.kind}`} />
        {special === "row" && <use href="#herb-ribbon-row" />}
        {special === "col" && <use href="#herb-ribbon-col" />}
      </svg>
    </div>
  );
}

const HELP = (
  <>
    <p>Swap two herbs next to each other (slide one, or tap one and then its neighbour) to line up three or more of a kind.</p>
    <ul>
      <li>Gather the herbs each garden asks for, and untangle any vines: match on them or right beside them.</li>
      <li>Four in a row ties a <b>ribbon bundle</b>: match it to clear its whole line.</li>
      <li>An L or a T leaves a <b>dew drop</b>: it clears the herbs around it.</li>
      <li>Five in a row makes a <b>honey pot</b>: swap it with any herb to gather every one of those.</li>
    </ul>
    <p>There's no rush and no running out. Finish within the garden's par for three flowers.</p>
  </>
);

export default function HerbMatch({ onReward }) {
  const initial = useMemo(restore, []);
  const [garden, setGarden] = useState(initial.garden);
  const [best, setBest] = useState(initial.best ?? {});
  const [view, setView] = useState(() => ({ cells: initial.garden.board.cells, vines: initial.garden.board.vines, removed: [], made: new Set(), drops: {} }));
  const [live, setLive] = useState(() => ({ gathered: initial.garden.gathered, vinesLeft: initial.garden.vinesLeft }));
  const [selected, setSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [cheer, setCheer] = useState(null);
  const [finished, setFinished] = useState(null);
  const [bump, setBump] = useState({});
  const busy = useRef(false);
  const stage = useRef(null);
  const board = useRef(null);
  const drag = useRef(null);
  const timers = useTimers();
  const { width, height } = useSize(stage);
  const calm = prefersLessMotion();
  const T = calm ? { swap: 70, clear: 120, fall: 110, shuffle: 200 } : { swap: 170, clear: 250, fall: 270, shuffle: 480 };
  const { w, h } = SIZE;
  const cell = Math.max(36, Math.min(66, Math.floor(Math.min(width / w, height / h)) || 48));

  // Gentle nudge after a while without a move.
  const hintTimer = useRef(0);
  const armHint = useCallback(() => {
    timers.cancel(hintTimer.current);
    setHint(null);
    hintTimer.current = timers.later(() => !busy.current && setHint(findMove(garden.board, Math.random)), 9000);
  }, [garden.board, timers]);
  useEffect(() => {
    if (!finished) armHint();
  }, [armHint, finished]);

  const say = (text) => {
    setCheer({ text, key: Math.random() });
    timers.later(() => setCheer(null), 1150);
  };

  useEffect(() => {
    if (garden.moves === 0 && !finished) say(`garden ${garden.plan.n}${garden.plan.vines ? " · mind the vines" : ""}`);
  }, [garden.plan.n]); // eslint-disable-line react-hooks/exhaustive-deps

  async function attempt(a, b) {
    if (busy.current || finished) return;
    busy.current = true;
    setSelected(null);
    setHint(null);
    timers.cancel(hintTimer.current);
    const result = playSwap(garden.board, a, b);
    if (!result.valid) {
      if (result.steps.length) {
        setView((old) => ({ ...old, cells: result.steps[0].cells }));
        play("swap");
        await timers.wait(T.swap);
        setView((old) => ({ ...old, cells: garden.board.cells }));
        play("nope");
        await timers.wait(T.swap);
      }
      busy.current = false;
      armHint();
      return;
    }
    haptic("light");
    play("swap");
    let wave = 0;
    let gathered = { ...garden.gathered };
    const goalKinds = new Set(garden.plan.goals.map((goal) => goal.kind));
    for (const step of result.steps) {
      if (step.type === "swap") {
        setView((old) => ({ ...old, cells: step.cells, removed: [], drops: {} }));
        await timers.wait(T.swap);
      } else if (step.type === "clear") {
        const bumped = {};
        for (const removed of step.removed) {
          if (!removed.kind || !goalKinds.has(removed.kind) || removed.special === "honey") continue;
          const goal = garden.plan.goals.find((g) => g.kind === removed.kind);
          gathered = { ...gathered, [removed.kind]: Math.min(goal.count, gathered[removed.kind] + 1) };
          bumped[removed.kind] = Math.random();
        }
        setLive({ gathered, vinesLeft: step.vines.filter(Boolean).length });
        setBump((old) => ({ ...old, ...bumped }));
        setView({ cells: step.cells, vines: step.vines, removed: step.removed, made: new Set(step.made.map((m) => m.id)), drops: {} });
        play("pop", Math.min(8, wave * 2 + 1));
        if (wave > 0) haptic("light");
        if (step.made.length) play("chime", 5);
        wave++;
        await timers.wait(T.clear);
      } else if (step.type === "fall") {
        setView((old) => ({ ...old, cells: step.cells, removed: [], made: new Set(), drops: step.drops }));
        await timers.wait(T.fall);
      } else if (step.type === "shuffle") {
        say("a little reshuffle");
        setView((old) => ({ ...old, cells: step.cells, drops: {} }));
        await timers.wait(T.shuffle);
      }
    }
    if (result.cascades >= 2) say(CHEERS[Math.min(CHEERS.length - 1, result.cascades - 2)]);
    const next = harvest(garden, result);
    setLive({ gathered: next.gathered, vinesLeft: next.vinesLeft });
    setView((old) => ({ ...old, drops: {} }));
    if (gardenDone(next)) {
      const flowers = flowersFor(next);
      const nextBest = { ...best, [next.plan.n]: Math.max(best[next.plan.n] ?? 0, flowers) };
      setBest(nextBest);
      setGarden(next);
      save(GAME, { garden: newGarden(next.plan.n + 1), best: nextBest });
      play("win", 2);
      haptic("success");
      const rect = board.current?.getBoundingClientRect();
      if (rect) celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 3) / window.innerHeight }, 0.8);
      if (next.plan.n === 1) rewardOnce(onReward, { sticker: "st-sprig", game: GAME, reason: "first garden tended" });
      if (next.plan.n === 10) rewardOnce(onReward, { sticker: "st-herb-basket", game: GAME, reason: "ten gardens tended" });
      timers.later(() => setFinished({ n: next.plan.n, moves: next.moves, par: next.plan.par, flowers }), calm ? 200 : 700);
    } else {
      setGarden(next);
      save(GAME, { garden: next, best });
    }
    busy.current = false;
  }

  function startGarden(n) {
    const fresh = newGarden(n);
    setFinished(null);
    setGarden(fresh);
    setView({ cells: fresh.board.cells, vines: fresh.board.vines, removed: [], made: new Set(), drops: {} });
    setLive({ gathered: fresh.gathered, vinesLeft: fresh.vinesLeft });
    save(GAME, { garden: fresh, best });
  }

  // Touch: slide a herb toward a neighbour, or tap one and then the other.
  const cellAt = (event) => {
    const rect = board.current.getBoundingClientRect();
    const c = Math.floor((event.clientX - rect.left) / cell);
    const r = Math.floor((event.clientY - rect.top) / cell);
    return r >= 0 && r < h && c >= 0 && c < w ? r * w + c : null;
  };
  function onPointerDown(event) {
    if (busy.current || finished) return;
    const idx = cellAt(event);
    if (idx == null) return;
    board.current.setPointerCapture?.(event.pointerId);
    drag.current = { idx, x: event.clientX, y: event.clientY, moved: false };
    armHint();
  }
  function onPointerMove(event) {
    const d = drag.current;
    if (!d || d.moved) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.32) return;
    d.moved = true;
    const r = Math.floor(d.idx / w), c = d.idx % w;
    const target = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < w - 1 ? d.idx + 1 : null) : c > 0 ? d.idx - 1 : null) : dy > 0 ? (r < h - 1 ? d.idx + w : null) : r > 0 ? d.idx - w : null;
    if (target != null) attempt(d.idx, target);
  }
  function onPointerUp(event) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const idx = cellAt(event) ?? d.idx;
    if (selected != null && selected !== idx && adjacent(w, selected, idx)) attempt(selected, idx);
    else {
      setSelected(selected === idx ? null : idx);
      play("tap");
    }
  }

  const tiles = [];
  view.cells.forEach((each, idx) => {
    if (!each) return;
    tiles.push(
      <Tile key={each.id} cell={each} idx={idx} w={w}
        state={view.made.has(each.id) ? "grow" : view.drops[each.id] ? "new" : undefined}
        drop={view.drops[each.id]}
        selected={selected === idx}
        hint={hint && (hint.a === idx || hint.b === idx)} />,
    );
  });
  view.removed.forEach((each) => {
    if (view.made.has(each.id)) return;
    tiles.push(<Tile key={each.id} cell={each} idx={each.idx} w={w} state="pop" />);
  });

  const plan = garden.plan;
  return (
    <PastimeShell game={GAME} kicker={`garden ${plan.n} · gather & untangle`} help={HELP}>
      <div className="herb">
        <div className="herb-goals" role="status" aria-live="polite">
          {plan.goals.map((goal) => {
            const have = live.gathered[goal.kind] ?? 0;
            return (
              <div key={goal.kind} className="herb-goal" data-done={have >= goal.count} data-bump={bump[goal.kind] ? String(bump[goal.kind]).slice(2, 6) : undefined}>
                <HerbIcon kind={goal.kind} size={30} />
                <span className="herb-goal__count" key={bump[goal.kind]}>{have >= goal.count ? "✓" : `${have}/${goal.count}`}</span>
                <span className="herb-goal__bar"><i style={{ transform: `scaleX(${Math.min(1, have / goal.count)})` }} /></span>
                <span className="sr-only">{HERB_NAMES[goal.kind]}</span>
              </div>
            );
          })}
          {plan.vines > 0 && (
            <div className="herb-goal herb-goal--vines" data-done={live.vinesLeft === 0}>
              <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true"><use href="#herb-vine" /></svg>
              <span className="herb-goal__count">{live.vinesLeft === 0 ? "✓" : live.vinesLeft}</span>
              <span className="herb-goal__label">vines</span>
            </div>
          )}
          <div className="herb-goal herb-goal--moves">
            <span className="herb-goal__big">{garden.moves}</span>
            <span className="herb-goal__label">moves · par {plan.par}</span>
          </div>
        </div>
        <div className="herb-stage" ref={stage}>
          <div
            ref={board}
            className="herb-board"
            style={{ "--cell": `${cell}px`, width: cell * w, height: cell * h, "--t-swap": `${T.swap}ms`, "--t-fall": `${T.fall}ms`, "--t-clear": `${T.clear}ms` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (drag.current = null)}
            role="grid"
            aria-label={`Herb garden, ${w} by ${h}`}
          >
            <HerbSprite />
            <div className="herb-bed" aria-hidden="true" />
            {view.vines.map((vine, idx) =>
              vine ? (
                <svg key={`v${idx}`} className="herb-vine" viewBox="0 0 48 48" aria-hidden="true"
                  style={{ transform: `translate3d(calc(var(--cell) * ${idx % w}), calc(var(--cell) * ${Math.floor(idx / w)}), 0)` }}>
                  <use href="#herb-vine" />
                </svg>
              ) : null,
            )}
            {tiles}
            {cheer && <div key={cheer.key} className="pastime-cheer">{cheer.text}</div>}
          </div>
        </div>
        <div className="herb-foot">
          <button type="button" className="pastime-button pastime-button--small" onClick={() => !busy.current && startGarden(plan.n)}>
            replant ↺
          </button>
          <span className="herb-foot__best">{best[plan.n] ? <>best <Flowers count={best[plan.n]} /></> : "a cosy little patch"}</span>
          <button type="button" className="pastime-button pastime-button--small" onClick={() => !busy.current && setHint(findMove(garden.board, Math.random))}>
            a hint ✧
          </button>
        </div>
      </div>
      <PastimeSheet open={Boolean(finished)} title={finished ? `garden ${finished.n} tended ♡` : ""} closeLabel={null}>
        {finished && (
          <div className="herb-done">
            <Flowers count={finished.flowers} />
            <p>{finished.moves} moves{finished.moves <= finished.par ? `, within par (${finished.par}).` : `. par was ${finished.par}.`}</p>
            <p className="herb-done__line">{finished.flowers === 3 ? "every herb where it should be." : "the garden is happy. so is the gardener, i hope."}</p>
            <div className="herb-done__actions">
              <button type="button" className="pastime-button" onClick={() => startGarden(finished.n)}>again ↺</button>
              <button type="button" className="pastime-button pastime-button--primary" onClick={() => startGarden(finished.n + 1)}>next garden →</button>
            </div>
          </div>
        )}
      </PastimeSheet>
    </PastimeShell>
  );
}
