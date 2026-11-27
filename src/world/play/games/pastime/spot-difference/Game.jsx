import { useEffect, useMemo, useRef, useState } from "react";
import { haptic } from "../../../../../lib/native.js";
import { celebrate } from "../../../../../shared/effects.js";
import PastimeShell, { PastimeSheet, PausedCard, usePause, useSize, useTimers } from "../_shared/PastimeShell.jsx";
import { play } from "../_shared/sound.js";
import { load, rewardOnce, save } from "../_shared/storage.js";
import { DIFFERENCES, HEIGHT, WIDTH, buildRound, hitTest, sceneSvg, svgUrl } from "./scenes.js";
import "./Game.css";

const GAME = "spot-difference";
const FOUND_LINES = ["there it is!", "sharp eyes ♡", "got it!", "ooh, nice", "found one!"];

function restore() {
  const saved = load(GAME);
  if (saved && Number.isInteger(saved.round) && Array.isArray(saved.found)) return saved;
  return { round: 0, found: [], seconds: 0, hints: 0, completed: 0 };
}

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// A loose, hand-drawn ring around a find.
function Ring({ diff }) {
  const r = diff.r + 7;
  const d = `M${diff.x - r} ${diff.y + 2}c0-${r * 0.75} ${r * 0.45}-${r * 1.05} ${r}-${r * 1.02}s${r * 1.05} ${r * 0.45} ${r * 1.02} ${r * 1.04}-${r * 0.5} ${r * 0.98}-${r * 1.04} ${r * 0.96}-${r * 0.98}-${r * 0.5}-${r * 0.92}-${r * 1.1}`;
  return <path className="spot-ring" d={d} pathLength="100" />;
}

function Picture({ round, side, found, misses, hintId, onTap, label }) {
  const url = useMemo(() => svgUrl(sceneSvg(round, side)), [round, side]);
  // A tap, not the end of a slide across the picture.
  const down = useRef(null);
  const onPointerUp = (event) => {
    const start = down.current;
    down.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14) return;
    onTap(event, side);
  };
  return (
    <div className="spot-pic" onPointerDown={(event) => (down.current = { x: event.clientX, y: event.clientY })} onPointerUp={onPointerUp}
      onPointerCancel={() => (down.current = null)} role="img" aria-label={label}>
      <img src={url} alt="" draggable="false" />
      <svg className="spot-marks" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        {round.diffs.filter((diff) => found.includes(diff.id)).map((diff) => <Ring key={diff.id} diff={diff} />)}
        {hintId && (() => {
          const diff = round.diffs.find((each) => each.id === hintId);
          return diff ? <circle className="spot-hint" cx={diff.x} cy={diff.y} r={diff.r + 22} /> : null;
        })()}
        {misses.filter((miss) => miss.side === side).map((miss) => (
          <g key={miss.key} className="spot-miss" transform={`translate(${miss.x} ${miss.y})`}>
            <path d="M-6 -6l12 12M6 -6l-12 12" />
          </g>
        ))}
      </svg>
    </div>
  );
}

const HELP = (
  <>
    <p>The two pictures look the same, but {DIFFERENCES} little things are different. Tap a difference on either picture.</p>
    <ul>
      <li>Colours, sizes, things turned the other way, things that went missing, a different look.</li>
      <li>Stuck? <b>a hint</b> makes one of them glow. No limits, no rush.</li>
      <li>Every picture is new: the rooms rearrange themselves each round.</li>
    </ul>
  </>
);

export default function SpotDifference({ onReward }) {
  const initial = useMemo(restore, []);
  const [state, setState] = useState(initial);
  const [misses, setMisses] = useState([]);
  const [hintId, setHintId] = useState(null);
  const [cheer, setCheer] = useState(null);
  const [shake, setShake] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const round = useMemo(() => buildRound(state.round), [state.round]);
  const done = state.found.length >= round.diffs.length;
  const { paused, resume } = usePause();
  const stage = useRef(null);
  const timers = useTimers();
  const { width, height } = useSize(stage);
  const gap = 10;
  const picWidth = Math.floor(Math.min(width, ((height - gap) / 2) * (WIDTH / HEIGHT))) || 320;

  useEffect(() => save(GAME, state), [state]);
  useEffect(() => {
    if (!done) return setShowDone(false);
    const id = setTimeout(() => setShowDone(true), 900);
    return () => clearTimeout(id);
  }, [done]);

  // A gentle clock, stopped while she's away or the picture is done.
  useEffect(() => {
    if (paused || helpOpen || done) return undefined;
    const id = setInterval(() => setState((old) => ({ ...old, seconds: old.seconds + 1 })), 1000);
    return () => clearInterval(id);
  }, [paused, helpOpen, done]);

  function onTap(event, side) {
    if (done || paused) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const hit = hitTest(round, state.found, x, y);
    if (hit) {
      const found = [...state.found, hit];
      setState((old) => ({ ...old, found }));
      if (hintId === hit) setHintId(null);
      play("chime", found.length + 2);
      haptic("light");
      setCheer({ text: FOUND_LINES[(found.length + state.round) % FOUND_LINES.length], key: Math.random() });
      timers.later(() => setCheer(null), 1100);
      if (found.length === round.diffs.length) finish();
    } else {
      const miss = { x, y, side, key: Math.random() };
      setMisses((old) => [...old.slice(-3), miss]);
      timers.later(() => setMisses((old) => old.filter((m) => m !== miss)), 700);
      setShake({ side, key: miss.key });
      play("nope");
    }
  }

  function finish() {
    const completed = (state.completed ?? 0) + 1;
    setState((old) => ({ ...old, completed }));
    play("win", 4);
    haptic("success");
    const rect = stage.current?.getBoundingClientRect();
    if (rect) celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }, 0.8);
    rewardOnce(onReward, { sticker: "st-mirror", game: GAME, reason: "first picture spotted" });
    if (completed >= 10) rewardOnce(onReward, { sticker: "st-magnifier", game: GAME, reason: "ten pictures spotted" });
  }

  function hint() {
    const left = round.diffs.filter((diff) => !state.found.includes(diff.id));
    if (!left.length) return;
    const pick = left[Math.floor(Math.random() * left.length)];
    setHintId(pick.id);
    setState((old) => ({ ...old, hints: old.hints + 1 }));
    play("tap");
    timers.later(() => setHintId((id) => (id === pick.id ? null : id)), 2600);
  }

  function next() {
    setMisses([]);
    setHintId(null);
    setState((old) => ({ round: old.round + 1, found: [], seconds: 0, hints: 0, completed: old.completed }));
  }

  return (
    <PastimeShell game={GAME} kicker={`picture ${state.round + 1} · ${round.title}`} help={HELP} onHelp={setHelpOpen}>
      <div className="spot">
        <div className="pastime-stats">
          <div className="pastime-stat spot-found">
            <span className="pastime-stat__label">found</span>
            <span className="spot-dots" aria-label={`${state.found.length} of ${round.diffs.length} found`}>
              {round.diffs.map((diff, i) => <span key={diff.id} data-on={i < state.found.length} aria-hidden="true">{i < state.found.length ? "♥" : "♡"}</span>)}
            </span>
          </div>
          <div className="pastime-stat spot-time">
            <span className="pastime-stat__label">time</span>
            <span className="pastime-stat__value">{clock(state.seconds)}</span>
          </div>
          <button type="button" className="pastime-button spot-hint-button" onClick={hint} disabled={done} aria-label="a hint">hint ✧</button>
        </div>
        <div className="spot-stage" ref={stage}>
          <div className="spot-pics" style={{ width: picWidth, gap }}>
            {["top", "bottom"].map((side) => (
              <div key={side} className="spot-frame" data-shake={shake?.side === side ? String(shake.key).slice(2, 7) : undefined}
                style={{ width: picWidth, height: Math.round((picWidth * HEIGHT) / WIDTH) }}>
                <Picture round={round} side={side} found={state.found} misses={misses} hintId={hintId} onTap={onTap}
                  label={`${side === "top" ? "First" : "Second"} picture of ${round.title}`} />
              </div>
            ))}
            {cheer && <div key={cheer.key} className="pastime-cheer">{cheer.text}</div>}
          </div>
        </div>
      </div>
      {paused && !done && <PausedCard onResume={resume} line="the pictures will wait for you." />}
      <PastimeSheet open={showDone} title="all five ♡" closeLabel={null}>
        <p>You spotted every difference in {clock(state.seconds)}{state.hints ? `, with ${state.hints} hint${state.hints > 1 ? "s" : ""}` : ", with no hints at all"}.</p>
        <p className="spot-done__count">{state.completed} picture{state.completed === 1 ? "" : "s"} looked at twice so far.</p>
        <button type="button" className="pastime-button pastime-button--primary spot-next" onClick={next}>next picture →</button>
      </PastimeSheet>
    </PastimeShell>
  );
}
