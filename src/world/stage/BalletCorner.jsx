import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import InterestIcon from "../../shared/icons/InterestIcon.jsx";
import "./BalletCorner.css";

const BARRE = [
  { name: "Pliés", seconds: 90 },
  { name: "Tendus", seconds: 90 },
  { name: "Dégagés", seconds: 60 },
  { name: "Ronds de jambe", seconds: 90 },
  { name: "Fondus", seconds: 60 },
  { name: "Frappés", seconds: 60 },
  { name: "Adagio", seconds: 120 },
  { name: "Grands battements", seconds: 60 },
  { name: "Stretch", seconds: 180 },
];

let audioContext;
function chime(frequency = 880, duration = 0.18) {
  try {
    audioContext ??= new AudioContext();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + duration + 0.02);
  } catch {
    // Audio isn't essential here.
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function BarreTimer() {
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(BARRE[0].seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  // When an exercise runs out, chime and move to the next one (or finish).
  useEffect(() => {
    if (!running || left > 0) return;
    if (index + 1 < BARRE.length) {
      chime();
      setIndex(index + 1);
      setLeft(BARRE[index + 1].seconds);
    } else {
      chime(660, 0.5);
      setRunning(false);
    }
  }, [left, running, index]);

  const current = BARRE[index];
  const progress = 1 - left / current.seconds;
  const finished = !running && index === BARRE.length - 1 && left === 0;

  return (
    <div className="barre">
      <div className="barre__ring" style={{ "--p": progress }} aria-hidden="true">
        <span>{fmt(left)}</span>
      </div>
      <div className="barre__info">
        <p className="barre__now">{finished ? "Barre done ✦" : current.name}</p>
        <p className="barre__next">{index + 1 < BARRE.length ? `Next: ${BARRE[index + 1].name}` : "Last one"}</p>
        <div className="barre__controls">
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => {
              if (finished) {
                setIndex(0);
                setLeft(BARRE[0].seconds);
              }
              setRunning((r) => !r);
            }}
          >
            {running ? "Pause" : finished ? "Again" : index === 0 && left === BARRE[0].seconds ? "Start barre" : "Resume"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              if (index + 1 < BARRE.length) {
                setIndex(index + 1);
                setLeft(BARRE[index + 1].seconds);
              }
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function BalanceChallenge() {
  const queryClient = useQueryClient();
  const best = useQuery({ queryKey: ["me", "kv", "ballet:balance-best"], queryFn: () => api("/me/kv/ballet:balance-best") });
  const save = useMutation({
    mutationFn: (value) => api("/me/kv/ballet:balance-best", { method: "PUT", body: { value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "kv", "ballet:balance-best"] }),
  });
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      setElapsed((performance.now() - startedAt) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [startedAt]);

  const record = best.data?.value ?? 0;

  function toggle() {
    if (startedAt) {
      const final = (performance.now() - startedAt) / 1000;
      setStartedAt(null);
      setElapsed(final);
      if (final > record) {
        chime(988, 0.3);
        save.mutate(Math.round(final * 10) / 10);
      }
    } else {
      setElapsed(0);
      setStartedAt(performance.now());
    }
  }

  return (
    <div className="balance">
      <p className="balance__line">Rise to relevé in passé, tap start, and tap again when you come down.</p>
      <button type="button" className="balance__button" data-running={Boolean(startedAt)} onClick={toggle}>
        <span className="balance__time">{elapsed.toFixed(1)}s</span>
        <span className="balance__label">{startedAt ? "Tap when you come down" : "Start balancing"}</span>
      </button>
      <p className="balance__best">Personal best: {record ? `${record}s` : "not yet"}</p>
    </div>
  );
}

export default function BalletCorner({ card }) {
  return (
    <section className="ballet" aria-labelledby="ballet-title">
      <header className="ballet__head">
        <span className="ballet__icon">
          <InterestIcon name="ballet" size={24} />
        </span>
        <div>
          <h2 id="ballet-title" className="ballet__title">
            Ballet corner
          </h2>
          {card && (
            <p className="ballet__term">
              <strong>{card.title}</strong>
              {card.extra?.say ? ` (${card.extra.say})` : ""}: {card.body}
            </p>
          )}
        </div>
      </header>
      <BarreTimer />
      <BalanceChallenge />
    </section>
  );
}
