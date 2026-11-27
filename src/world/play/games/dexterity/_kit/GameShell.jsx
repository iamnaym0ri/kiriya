import { useCallback, useEffect, useRef, useState } from "react";
import { buzz, calmByDefault, rememberCalm } from "./feel.js";
import { pixelRatio } from "./sprites.js";
import { setSoundOn, soundIsOn, suspendAudio, resumeAudio, unlockAudio } from "./sound.js";
import { bestScore, readFlag, saveBest, writeFlag } from "./storage.js";
import "./shell.css";

// The frame every dexterity game shares (docs/refactor/RENOVATION.md, "Games"): it fills the play
// hub's sheet, owns the canvas, the one animation loop, the little cards (start, pause, the end of
// a round), best scores, rewards, sound and calm mode. A game supplies an engine:
//
//   createEngine({ canvas, ctx, calm, hud, end, sounds }) → {
//     ready?: Promise,             // sprites loading
//     resize(width, height),       // CSS px of the stage
//     reset(settings),             // a fresh round; settings = { calm, ...game options }
//     update(dt, now),             // seconds since the last frame (clamped)
//     render(),
//     pointer(kind, x, y, id, timeStamp),  // "down" | "move" | "up"
//     key?(code, down), pause?(), resume?(), destroy?()
//   }
//
// The engine calls `hud(name, text)` when a number changes and `end(result)` when the round is over.

const FRAME_SAMPLES = 240;

export default function GameShell({
  id,
  title,
  kicker,
  howTo,
  options = null,
  settings = null,
  hud = [],
  createEngine,
  rewardsFor = () => [],
  overTitle = (result) => `${result.score}`,
  overLine = () => "",
  bestLabel = (best) => `best ${best}`,
  soundNote = "sounds follow your silent switch",
  footer = null,
  onReward,
  onExit,
  beforeStart,
  canStart = true,
}) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const hudRefs = useRef({});
  const phaseRef = useRef("loading");
  const settingsRef = useRef(settings);
  const [phase, setPhaseState] = useState("loading");
  const [calm, setCalm] = useState(calmByDefault);
  const [sound, setSound] = useState(soundIsOn);
  const [best, setBest] = useState(() => bestScore(id));
  const [result, setResult] = useState(null);
  const calmRef = useRef(calm);
  calmRef.current = calm;
  settingsRef.current = settings;

  const setPhase = useCallback((next) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // ---------- the loop ----------
  const loop = useRef({ raf: 0, last: 0, frames: new Float32Array(FRAME_SAMPLES), count: 0, long: 0 });

  const frame = useCallback((now) => {
    const state = loop.current;
    const engine = engineRef.current;
    if (!engine || phaseRef.current !== "playing") {
      state.raf = 0;
      return;
    }
    const gap = state.last ? now - state.last : 16.7;
    state.last = now;
    state.frames[state.count % FRAME_SAMPLES] = gap;
    state.count += 1;
    if (gap > 25) state.long += 1;
    engine.update(Math.min(gap, 50) / 1000, now);
    engine.render();
    state.raf = requestAnimationFrame(frame);
  }, []);

  const startLoop = useCallback(() => {
    const state = loop.current;
    if (state.raf) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  }, [frame]);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(loop.current.raf);
    loop.current.raf = 0;
  }, []);

  // Frame times for the lab's checks (dev only): window.__dexFrames() → { frames, avg, p95, max, long }.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__dexFrames = (reset = false) => {
      const state = loop.current;
      const n = Math.min(state.count, FRAME_SAMPLES);
      const list = Array.from(state.frames.slice(0, n)).sort((a, b) => a - b);
      const out = {
        frames: state.count,
        avg: n ? list.reduce((a, b) => a + b, 0) / n : 0,
        p95: n ? list[Math.floor(n * 0.95)] : 0,
        max: n ? list[n - 1] : 0,
        long: state.long,
      };
      if (reset) {
        state.count = 0;
        state.long = 0;
      }
      return out;
    };
    return () => delete window.__dexFrames;
  }, []);

  // ---------- the engine ----------
  const hudSet = useCallback((name, text) => {
    const node = hudRefs.current[name];
    if (!node) return;
    if (node.dataset.kind === "hearts") {
      if (node.dataset.value !== text) node.dataset.value = text;
    } else if (node.textContent !== text) node.textContent = text;
  }, []);

  const finish = useCallback(
    (outcome) => {
      if (phaseRef.current !== "playing") return;
      stopLoop();
      const saved = saveBest(id, outcome.score);
      setBest(saved.best);
      const earned = [];
      for (const reward of rewardsFor(outcome)) {
        const key = `${id}:reward:${reward.reason}`;
        if (readFlag(key)) continue;
        writeFlag(key, true);
        earned.push(reward);
        onReward?.({ sticker: reward.sticker, game: id, reason: reward.reason });
      }
      setResult({ ...outcome, isNewBest: saved.isNew, earned });
      setPhase("over");
      buzz(saved.isNew || earned.length ? "success" : "medium");
    },
    [id, onReward, rewardsFor, setPhase, stopLoop],
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const size = useRef({ width: 0, height: 0, left: 0, top: 0 });
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    const engine = createEngine({
      canvas,
      ctx,
      calm: calmRef.current,
      hud: hudSet,
      end: (outcome) => finishRef.current(outcome),
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) window.__dex = { engine, phase: () => phaseRef.current };

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      size.current = { width, height, left: rect.left, top: rect.top };
      const scale = pixelRatio();
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      engine.resize(width, height);
      engine.render();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();

    let alive = true;
    Promise.resolve(engine.ready).then(() => {
      if (!alive) return;
      engine.reset({ calm: calmRef.current, ...settingsRef.current, preview: true });
      engine.render();
      setPhase("ready");
    });
    return () => {
      alive = false;
      observer.disconnect();
      stopLoop();
      engine.destroy?.();
      engineRef.current = null;
    };
  }, [createEngine, hudSet, setPhase, stopLoop]);

  // ---------- phases ----------
  const play = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    unlockAudio();
    beforeStart?.();
    const rect = stageRef.current.getBoundingClientRect();
    size.current.left = rect.left;
    size.current.top = rect.top;
    setResult(null);
    engine.reset({ calm: calmRef.current, ...settingsRef.current });
    engine.render();
    setPhase("playing");
    startLoop();
    buzz("light");
  }, [beforeStart, setPhase, startLoop]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    stopLoop();
    engineRef.current?.pause?.();
    suspendAudio();
    setPhase("paused");
  }, [setPhase, stopLoop]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    unlockAudio();
    resumeAudio();
    engineRef.current?.resume?.();
    setPhase("playing");
    startLoop();
  }, [setPhase, startLoop]);

  // Pause whenever she leaves: another app, the lock button, a call, the app switcher.
  useEffect(() => {
    const away = () => {
      if (document.hidden) pause();
    };
    const gone = () => pause();
    document.addEventListener("visibilitychange", away);
    window.addEventListener("pagehide", gone);
    window.addEventListener("blur", gone);
    return () => {
      document.removeEventListener("visibilitychange", away);
      window.removeEventListener("pagehide", gone);
      window.removeEventListener("blur", gone);
    };
  }, [pause]);

  // ---------- input ----------
  useEffect(() => {
    const stage = stageRef.current;
    const at = (event) => [event.clientX - size.current.left, event.clientY - size.current.top];
    const down = (event) => {
      if (phaseRef.current !== "playing" || event.target.closest("button")) return;
      event.preventDefault();
      stage.setPointerCapture?.(event.pointerId);
      // the sheet may have slid in since the last measure
      const rect = stage.getBoundingClientRect();
      size.current.left = rect.left;
      size.current.top = rect.top;
      const [x, y] = at(event);
      engineRef.current?.pointer("down", x, y, event.pointerId, event.timeStamp);
    };
    const move = (event) => {
      if (phaseRef.current !== "playing") return;
      const [x, y] = at(event);
      engineRef.current?.pointer("move", x, y, event.pointerId, event.timeStamp);
    };
    const up = (event) => {
      if (phaseRef.current !== "playing") return;
      const [x, y] = at(event);
      engineRef.current?.pointer("up", x, y, event.pointerId, event.timeStamp);
    };
    // No scrolling, rubber-banding, double-tap zoom or text magnifier while a finger is on the game.
    const still = (event) => {
      if (!event.target.closest(".dex__card")) event.preventDefault();
    };
    const keys = (event) => {
      if (event.repeat) return;
      if (phaseRef.current !== "playing" || !engineRef.current?.key) return;
      if (engineRef.current.key(event.code, event.type === "keydown")) event.preventDefault();
    };
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("touchmove", still, { passive: false });
    stage.addEventListener("gesturestart", still);
    window.addEventListener("keydown", keys);
    window.addEventListener("keyup", keys);
    return () => {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.removeEventListener("touchmove", still);
      stage.removeEventListener("gesturestart", still);
      window.removeEventListener("keydown", keys);
      window.removeEventListener("keyup", keys);
    };
  }, []);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundOn(next);
    if (next) unlockAudio();
  }

  function toggleCalm() {
    const next = !calm;
    setCalm(next);
    rememberCalm(next);
    const engine = engineRef.current;
    if (engine && phaseRef.current === "ready") {
      engine.reset({ calm: next, ...settingsRef.current, preview: true });
      engine.render();
    }
  }

  const playing = phase === "playing";
  return (
    <div className="dex" data-phase={phase} ref={stageRef}>
      <canvas ref={canvasRef} className="dex__canvas" aria-hidden="true" />

      <div className="dex__hud" data-visible={playing || phase === "paused"}>
        <div className="dex__chips" aria-live="off">
          {hud.map((item) => (
            <span key={item.name} className="dex__chip" data-kind={item.kind ?? "text"}>
              {item.label && <small>{item.label}</small>}
              {item.kind === "hearts" ? (
                <b ref={(node) => (hudRefs.current[item.name] = node)} data-kind="hearts" data-value={item.initial ?? "3"} aria-label="hearts left">
                  {Array.from({ length: item.max ?? 3 }, (_, i) => (
                    <svg key={i} viewBox="0 0 20 18" data-index={i} aria-hidden="true">
                      <path d="M10 16.6C3 11.6 1.4 7.4 2.8 4.6c1.4-2.9 5.3-3.2 7.2-.4 1.9-2.8 5.8-2.5 7.2.4 1.4 2.8-.2 7-7.2 12Z" />
                    </svg>
                  ))}
                </b>
              ) : (
                <b ref={(node) => (hudRefs.current[item.name] = node)}>{item.initial ?? ""}</b>
              )}
            </span>
          ))}
        </div>
        <div className="dex__tools">
          <button type="button" className="dex__tool" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? "sound on" : "sound off"}>
            <SoundIcon on={sound} />
          </button>
          <button type="button" className="dex__tool" onClick={pause} disabled={!playing} aria-label="pause">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.8" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.8" /></svg>
          </button>
        </div>
      </div>

      {phase === "loading" && <div className="dex__loading" role="status">setting things up…</div>}

      {phase === "ready" && (
        <div className="dex__veil">
          <section className="dex__card" aria-labelledby={`${id}-title`}>
            {kicker && <span className="dex__kicker">{kicker}</span>}
            <h2 id={`${id}-title`} className="dex__title">{title}</h2>
            <div className="dex__howto">{howTo}</div>
            {options}
            <label className="dex__switch">
              <input type="checkbox" checked={calm} onChange={toggleCalm} />
              <span className="dex__switch-track" aria-hidden="true" />
              <span>
                calm mode
                <small>slower, gentler, less wiggle</small>
              </span>
            </label>
            <button type="button" className="dex__play" onClick={play} disabled={!canStart}>
              play <span aria-hidden="true">♡</span>
            </button>
            <p className="dex__meta">
              {best > 0 ? bestLabel(best) : "no best yet, no pressure"}
              <span aria-hidden="true"> · </span>
              <button type="button" className="dex__link" onClick={toggleSound}>{sound ? "sound on" : "sound off"}</button>
            </p>
            {soundNote && <p className="dex__note">{soundNote}</p>}
            {footer}
          </section>
        </div>
      )}

      {phase === "paused" && (
        <div className="dex__veil">
          <section className="dex__card dex__card--small" aria-labelledby={`${id}-paused`}>
            <h2 id={`${id}-paused`} className="dex__title">paused</h2>
            <p className="dex__howto">take your time ♡</p>
            <button type="button" className="dex__play" onClick={resume}>keep going</button>
            <div className="dex__row">
              <button type="button" className="dex__quiet" onClick={play}>start over ↺</button>
              <button type="button" className="dex__quiet" onClick={onExit}>back to play</button>
            </div>
          </section>
        </div>
      )}

      {phase === "over" && result && (
        <div className="dex__veil">
          <section className="dex__card" aria-labelledby={`${id}-over`} role="status">
            <span className="dex__kicker">{result.isNewBest ? "a new best!" : "that's a round"}</span>
            <h2 id={`${id}-over`} className="dex__title">{overTitle(result)}</h2>
            {overLine(result) && <p className="dex__howto">{overLine(result)}</p>}
            {result.earned.length > 0 && (
              <ul className="dex__earned">
                {result.earned.map((reward) => (
                  <li key={reward.reason}>
                    {reward.Art && <reward.Art size={44} />}
                    <span>
                      a sticker for your collection
                      <small>{reward.reason}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="dex__meta">{bestLabel(best)}</p>
            <button type="button" className="dex__play" onClick={play}>again <span aria-hidden="true">↺</span></button>
            <button type="button" className="dex__quiet" onClick={onExit}>back to play</button>
          </section>
        </div>
      )}
    </div>
  );
}

function SoundIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      {on ? (
        <path d="M15.5 9q1.6 3 0 6M18 7q3 5 0 10" fill="none" strokeWidth="1.9" strokeLinecap="round" />
      ) : (
        <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" strokeWidth="1.9" strokeLinecap="round" />
      )}
    </svg>
  );
}
