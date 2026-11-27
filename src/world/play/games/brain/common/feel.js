// Sound and touch for the brain-power shelf. The sounds are tiny original tones made on the spot
// with Web Audio (no recordings); they're soft, optional, and off with one tap. On iPhone the ringer
// switch silences them too. Haptics go through the app's own helper (nothing happens on the web).
import { useSyncExternalStore } from "react";
import { haptic } from "../../../../../lib/native.js";
import { readStore, writeStore } from "./hooks.js";

const SOUND_KEY = "kiriya:brain:sound";
const listeners = new Set();
export const soundOn = () => readStore(SOUND_KEY, true) !== false;
export function setSoundOn(on) {
  writeStore(SOUND_KEY, on);
  listeners.forEach((listener) => listener());
}
export const useSoundOn = () =>
  useSyncExternalStore((listener) => (listeners.add(listener), () => listeners.delete(listener)), soundOn, () => true);

let context = null;
function audio() {
  if (!context) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    try {
      context = new Context();
    } catch {
      return null;
    }
  }
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
}

function tone(ctx, frequency, at, length, { type = "sine", volume = 0.05 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

// A little music-box palette: notes from one pentatonic scale so every sound agrees with the others.
const SOUNDS = {
  tap: (ctx, t) => tone(ctx, 784, t, 0.07, { type: "triangle", volume: 0.035 }),
  place: (ctx, t) => {
    tone(ctx, 587.33, t, 0.13, { type: "triangle", volume: 0.05 });
    tone(ctx, 880, t + 0.035, 0.1, { volume: 0.025 });
  },
  good: (ctx, t) => [659.25, 987.77].forEach((f, i) => tone(ctx, f, t + i * 0.075, 0.18, { type: "triangle", volume: 0.05 })),
  oops: (ctx, t) => {
    tone(ctx, 293.66, t, 0.16, { volume: 0.06 });
    tone(ctx, 246.94, t + 0.09, 0.22, { volume: 0.05 });
  },
  win: (ctx, t) => [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((f, i) => tone(ctx, f, t + i * 0.085, 0.42, { type: "triangle", volume: 0.045 })),
};
const HAPTICS = { tap: "light", place: "light", good: "medium", oops: "warning", win: "success" };

/** A tap's worth of feedback: a soft tone (if sound is on) and a haptic (in the app). */
export function feel(kind) {
  haptic(HAPTICS[kind] ?? "light");
  if (!soundOn()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    SOUNDS[kind]?.(ctx, ctx.currentTime + 0.005);
  } catch {
    // Audio is a nicety; never let it break a move.
  }
}
