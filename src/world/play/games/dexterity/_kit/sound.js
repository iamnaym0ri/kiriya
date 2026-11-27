// One shared Web Audio context for the dexterity games. iPhones only let audio start inside a tap,
// so `unlockAudio()` runs from the "play" button. Little sounds are rendered once with ZzFX and
// replayed from buffers. Web Audio follows the iPhone's silent switch unless a game asks for
// "playback" (the rhythm game does, while a song plays, through the Audio Session API).
import { readFlag, writeFlag } from "./storage.js";
import { zzfxSamples, ZZFX_RATE } from "./zzfx.js";

let context = null;
let master = null;
let muted = !readFlag("sound", true);

export function audioContext() {
  if (context) return context;
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try {
    context = new Ctor({ latencyHint: "interactive" });
  } catch {
    context = new Ctor();
  }
  master = context.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(context.destination);
  return context;
}

export const masterOut = () => (audioContext(), master);

/** Call from a tap: wakes the context (iOS keeps it suspended until a gesture). */
export function unlockAudio() {
  const ctx = audioContext();
  if (!ctx) return null;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  // A silent blip inside the gesture is what finally convinces older iOS versions.
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  blip.connect(ctx.destination);
  blip.start(0);
  return ctx;
}

export function suspendAudio() {
  if (context && context.state === "running") return context.suspend().catch(() => {});
  return Promise.resolve();
}

export function resumeAudio() {
  if (context && context.state !== "running") return context.resume().catch(() => {});
  return Promise.resolve();
}

export const soundIsOn = () => !muted;
export function setSoundOn(on) {
  muted = !on;
  writeFlag("sound", on);
  if (master && context) master.gain.setTargetAtTime(on ? 1 : 0, context.currentTime, 0.02);
}

/** "playback" makes the music ignore the silent switch (and pauses her other music); "auto" undoes it. */
export const audioSessionSupported = () => typeof navigator !== "undefined" && "audioSession" in navigator;
export function setAudioSession(type) {
  if (!audioSessionSupported()) return false;
  try {
    navigator.audioSession.type = type;
    return true;
  } catch {
    return false;
  }
}

/**
 * A set of little sounds: `{ name: zzfxParams }`. Rendering happens on first use after unlock, so
 * opening a game costs nothing. `play(name, { volume, rate })` returns nothing and never throws.
 */
export function makeSounds(designs) {
  const buffers = new Map();
  function buffer(name) {
    const ctx = audioContext();
    if (!ctx || !designs[name]) return null;
    let found = buffers.get(name);
    if (!found) {
      try {
        const samples = zzfxSamples(designs[name], { sampleRate: ZZFX_RATE });
        found = ctx.createBuffer(1, samples.length || 1, ZZFX_RATE);
        found.getChannelData(0).set(samples);
      } catch {
        found = ctx.createBuffer(1, 1, ZZFX_RATE); // a sound that can't be made stays silent
      }
      buffers.set(name, found);
    }
    return found;
  }
  return {
    /** Render everything now (call after unlock, so the first catch doesn't stutter). */
    warm() {
      if (!context) return;
      for (const name of Object.keys(designs)) buffer(name);
    },
    play(name, { volume = 1, rate = 1, when = 0 } = {}) {
      if (muted || !context || context.state !== "running") return;
      const data = buffer(name);
      if (!data) return;
      const source = context.createBufferSource();
      source.buffer = data;
      source.playbackRate.value = rate;
      if (volume === 1) source.connect(master);
      else {
        const gain = context.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(master);
      }
      source.start(when || 0);
    },
  };
}

/** A pentatonic step: catch after catch climbs a little tune instead of repeating one blip. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const pentatonicRate = (step) => 2 ** (PENTATONIC[step % PENTATONIC.length] / 12);
