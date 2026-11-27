// Soft, original little sounds made on the spot with Web Audio (no audio files). Off with one tap;
// the choice is shared by every pastime game.
import { load, save } from "./storage.js";

let ctx = null;
let muted = load("muted", false);
const listeners = new Set();

export const isMuted = () => muted;
export function setMuted(value) {
  muted = Boolean(value);
  save("muted", muted);
  listeners.forEach((fn) => fn(muted));
}
export function onMutedChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio() {
  if (muted || typeof window === "undefined") return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  try {
    ctx ??= new Context();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(a, { freq, to = freq, start = 0, length = 0.12, type = "sine", volume = 0.08 }) {
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t0 + length);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

// A gentle pentatonic, so any run of notes sounds sweet together.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

/** play("tap" | "pop" | "swap" | "nope" | "drop" | "chime" | "win", step?) */
export function play(name, step = 0) {
  const a = audio();
  if (!a) return;
  const note = SCALE[Math.max(0, Math.min(SCALE.length - 1, step))];
  switch (name) {
    case "tap":
      tone(a, { freq: 880, to: 660, length: 0.06, type: "triangle", volume: 0.05 });
      break;
    case "swap":
      tone(a, { freq: 520, to: 700, length: 0.09, type: "triangle", volume: 0.05 });
      break;
    case "pop":
      tone(a, { freq: note, to: note * 1.5, length: 0.11, volume: 0.07 });
      break;
    case "nope":
      tone(a, { freq: 300, to: 240, length: 0.14, type: "triangle", volume: 0.05 });
      break;
    case "drop":
      tone(a, { freq: 180, to: 120, length: 0.1, type: "triangle", volume: 0.07 });
      break;
    case "chime":
      tone(a, { freq: note, length: 0.25, volume: 0.06 });
      tone(a, { freq: note * 1.5, start: 0.08, length: 0.3, volume: 0.05 });
      break;
    case "win":
      [0, 2, 4, 7].forEach((offset, i) => tone(a, { freq: SCALE[Math.min(SCALE.length - 1, step + offset)], start: i * 0.1, length: 0.35, volume: 0.06 }));
      break;
    default:
      break;
  }
}
