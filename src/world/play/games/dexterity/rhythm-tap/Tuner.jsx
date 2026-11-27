import { useEffect, useRef, useState } from "react";
import { audioContext, masterOut, unlockAudio } from "../_kit/sound.js";
import { readNumber, writeNumber } from "../_kit/storage.js";
import { renderClicks } from "./synth.js";

// Tunes the timing to her phone and ears: a click plays every 0.6 s, she taps along, and the
// median lateness of her taps (headphones and speakers add delay) becomes the game's offset.
const BEAT = 0.6;
const CLICKS = 14;
const SKIP = 2; // the first taps are finding the beat
const NEEDED = 8;

export const offsetMs = () => readNumber("rhythm-tap:offset", 0);

export default function Tuner({ onDone }) {
  const [offset, setOffset] = useState(offsetMs);
  const [phase, setPhase] = useState("idle"); // idle | listening | done
  const [taps, setTaps] = useState(0);
  const pulse = useRef(null);
  const run = useRef({ start: 0, errors: [], raf: 0, source: null });

  useEffect(() => () => stop(), []);

  function stop() {
    cancelAnimationFrame(run.current.raf);
    try {
      run.current.source?.stop();
    } catch {
      // already done
    }
    run.current.source = null;
  }

  async function begin() {
    const ctx = unlockAudio();
    if (!ctx) return;
    stop();
    setTaps(0);
    run.current.errors = [];
    setPhase("listening");
    const buffer = await renderClicks(CLICKS, BEAT);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterOut());
    run.current.start = ctx.currentTime + 0.4;
    source.start(run.current.start);
    run.current.source = source;
    const tick = () => {
      const t = ctx.currentTime - run.current.start;
      const node = pulse.current;
      if (node) {
        const into = t < 0 ? 1 : (t % BEAT) / BEAT;
        node.style.opacity = String(Math.max(0, 1 - into * 3));
        node.style.scale = String(1 + into * 0.12);
      }
      if (t < CLICKS * BEAT + 0.5) run.current.raf = requestAnimationFrame(tick);
      else finish();
    };
    run.current.raf = requestAnimationFrame(tick);
  }

  function hit(event) {
    if (phase !== "listening") return;
    const ctx = audioContext();
    const lag = Math.max(0, (performance.now() - event.timeStamp) / 1000);
    const t = ctx.currentTime - lag - run.current.start;
    const k = Math.round(t / BEAT);
    if (k < SKIP || k >= CLICKS) return;
    run.current.errors.push(t - k * BEAT);
    setTaps(run.current.errors.length);
    if (run.current.errors.length >= NEEDED + 2) finish();
  }

  function finish() {
    stop();
    const errors = [...run.current.errors].sort((a, b) => a - b);
    if (errors.length >= NEEDED) {
      const median = errors[Math.floor(errors.length / 2)];
      const ms = Math.max(-80, Math.min(320, Math.round(median * 1000)));
      writeNumber("rhythm-tap:offset", ms);
      setOffset(ms);
      setPhase("done");
    } else setPhase("idle");
  }

  function nudge(by) {
    const ms = Math.max(-80, Math.min(320, offset + by));
    writeNumber("rhythm-tap:offset", ms);
    setOffset(ms);
  }

  return (
    <div className="tuner">
      <p className="dex__howto">
        {phase === "listening"
          ? "tap the circle on every click ♪"
          : phase === "done"
            ? offset > 15
              ? `your taps land about ${offset} ms after the click, so the notes will wait for you ♡`
              : offset < -15
                ? `you tap a little early (${-offset} ms), so the notes will come a touch sooner ♡`
                : "your timing is right on the click ♡"
            : "headphones and speakers can make the music a little late. tap along to some clicks and the game will match your timing."}
      </p>
      <button type="button" className="tuner__pad" onPointerDown={hit} onClick={phase === "listening" ? undefined : begin}>
        <span className="tuner__pulse" ref={pulse} />
        {phase === "listening" ? "tap!" : phase === "done" ? "again" : "start"}
      </button>
      <div className="tuner__dots" aria-label={`${Math.min(taps, NEEDED)} of ${NEEDED} taps`}>
        {Array.from({ length: NEEDED }, (_, i) => (
          <span key={i} data-on={i < taps} />
        ))}
      </div>
      <div className="tuner__nudge">
        <button type="button" onClick={() => nudge(-10)} aria-label="notes 10 ms sooner">−</button>
        <span>timing {offset > 0 ? `+${offset}` : offset} ms</span>
        <button type="button" onClick={() => nudge(10)} aria-label="notes 10 ms later">+</button>
      </div>
      <button type="button" className="dex__quiet" onClick={onDone}>done ♡</button>
    </div>
  );
}
