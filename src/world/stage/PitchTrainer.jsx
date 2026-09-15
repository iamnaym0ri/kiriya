import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { sparkleBurst } from "../../shared/effects.js";
import "./PitchTrainer.css";

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const noteName = (midi) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
// Miku's best range per Crypton: A3 (57) to E5 (76).
const LOW = 57;
const HIGH = 76;
const HOLD_MS = 1500;

function randomTarget(previous) {
  let next;
  do next = LOW + Math.floor(Math.random() * (HIGH - LOW - 4)) + 2;
  while (next === previous);
  return next;
}

export default function PitchTrainer() {
  const queryClient = useQueryClient();
  const best = useQuery({ queryKey: ["me", "kv", "stage:pitch-best"], queryFn: () => api("/me/kv/stage:pitch-best") });
  const saveBest = useMutation({
    mutationFn: (value) => api("/me/kv/stage:pitch-best", { method: "PUT", body: { value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "kv", "stage:pitch-best"] }),
  });

  const [state, setState] = useState("idle"); // idle | listening | denied
  const [reading, setReading] = useState(null); // { midi, cents }
  const [target, setTarget] = useState(() => randomTarget());
  const [score, setScore] = useState(0);
  const [hold, setHold] = useState(0);
  const stopRef = useRef(() => {});
  const holdStart = useRef(0);
  const targetRef = useRef(target);
  const cardRef = useRef(null);
  targetRef.current = target;

  useEffect(() => () => stopRef.current(), []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      detector.minVolumeDecibels = -38;
      const buffer = new Float32Array(analyser.fftSize);
      let raf = 0;
      let smoothed = null;

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        const [pitch, clarity] = detector.findPitch(buffer, context.sampleRate);
        if (clarity > 0.92 && pitch > 70 && pitch < 1400) {
          const exact = 69 + 12 * Math.log2(pitch / 440);
          smoothed = smoothed === null ? exact : smoothed * 0.7 + exact * 0.3;
          const midi = Math.round(smoothed);
          const cents = Math.round((smoothed - midi) * 100);
          setReading({ midi, cents, exact: smoothed });

          const off = Math.abs((smoothed - targetRef.current) * 100);
          if (off < 35) {
            holdStart.current ||= performance.now();
            const held = performance.now() - holdStart.current;
            setHold(Math.min(1, held / HOLD_MS));
            if (held >= HOLD_MS) {
              holdStart.current = 0;
              setHold(0);
              setScore((s) => s + 1);
              setTarget((t) => randomTarget(t));
              const rect = cardRef.current?.getBoundingClientRect();
              if (rect) sparkleBurst({ x: rect.left + rect.width / 2, y: rect.top + 80 }, { count: 14, reach: 80 });
            }
          } else {
            holdStart.current = 0;
            setHold(0);
          }
        } else {
          smoothed = null;
          holdStart.current = 0;
          setHold(0);
          setReading(null);
        }
        raf = requestAnimationFrame(tick);
      };

      stopRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        context.close().catch(() => {});
        setState("idle");
        setReading(null);
      };
      setState("listening");
      raf = requestAnimationFrame(tick);
    } catch {
      setState("denied");
    }
  }

  function stop() {
    stopRef.current();
    const previous = best.data?.value ?? 0;
    if (score > previous) saveBest.mutate(score);
  }

  const position = (midi) => `${((midi - (LOW - 2)) / (HIGH - LOW + 4)) * 100}%`;
  const inTune = reading && Math.abs(reading.cents) <= 12;

  return (
    <section className="pitch" ref={cardRef} aria-labelledby="pitch-title">
      <header className="pitch__head">
        <div>
          <h2 id="pitch-title" className="pitch__title">
            Pitch practice
          </h2>
          <p className="pitch__hint">Sing and hold the target note for a moment. The band is Miku's best range, A3 to E5.</p>
        </div>
        <div className="pitch__score" aria-live="polite">
          <span>{score}</span>
          <small>best {Math.max(best.data?.value ?? 0, score)}</small>
        </div>
      </header>

      <div className="pitch__meter" aria-hidden="true">
        <div className="pitch__band" style={{ bottom: position(LOW), height: `calc(${position(HIGH)} - ${position(LOW)})` }} />
        <div className="pitch__target" style={{ bottom: position(target) }}>
          <span>{noteName(target)}</span>
          <i style={{ transform: `scaleX(${hold})` }} />
        </div>
        {reading && <div className="pitch__dot" data-in-tune={inTune} style={{ bottom: position(reading.exact) }} />}
      </div>

      <div className="pitch__readout" aria-live="polite">
        {reading ? (
          <>
            <span className="pitch__note">{noteName(reading.midi)}</span>
            <span className="pitch__cents" data-in-tune={inTune}>
              {inTune ? "right on it" : reading.cents > 0 ? `${reading.cents} cents sharp` : `${-reading.cents} cents flat`}
            </span>
          </>
        ) : (
          <span className="pitch__cents">{state === "listening" ? "Listening… sing an “aah”" : "Target: " + noteName(target)}</span>
        )}
      </div>

      {state === "listening" ? (
        <button type="button" className="btn btn--night" onClick={stop}>
          Stop
        </button>
      ) : (
        <button type="button" className="btn btn--primary" onClick={start}>
          Start singing
        </button>
      )}
      {state === "denied" && <p className="pitch__error">The microphone is blocked. Allow it for kiriya in your phone's settings to use this.</p>}
    </section>
  );
}
