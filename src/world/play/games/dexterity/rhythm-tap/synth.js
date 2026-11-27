// A tiny chiptune band (pulse lead, triangle bass, thin pulse arpeggio, noise drums) that writes a
// whole song into one sample buffer ahead of time. Playing one prepared buffer keeps the music
// exactly on the audio clock the notes are judged against, with nothing to schedule while playing.
// Samples are computed directly (a few million additions, tens of milliseconds): an
// OfflineAudioContext with thousands of oscillator nodes took far longer in WebKit.
import { arrange, barSeconds, chord, melodyNotes } from "./songs.js";

export const RATE = 22050; // chiptune doesn't need more, and it keeps the buffer small (mono)

const hz = (note) => 440 * 2 ** ((note - 69) / 12);

function addTone(out, { start, length, freq, wave = "pulse", duty = 0.25, volume, attack = 0.004, release = 0.03, slideTo = 0 }) {
  const first = Math.floor(start * RATE);
  const count = Math.min(Math.floor(length * RATE), out.length - first);
  const a = Math.max(1, attack * RATE);
  const r = Math.max(1, release * RATE);
  const decayEnd = a + 0.05 * RATE;
  const slide = slideTo ? (slideTo / freq) ** (1 / Math.max(1, count)) : 1;
  let f = freq;
  let phase = 0;
  for (let i = 0; i < count; i++) {
    phase += f / RATE;
    if (phase >= 1) phase -= Math.floor(phase);
    f *= slide;
    const v = wave === "pulse" ? (phase < duty ? 1 : -1) : wave === "triangle" ? 4 * Math.abs(phase - 0.5) - 1 : Math.sin(phase * 6.283185307179586);
    const env = i < a ? i / a : i > count - r ? (count - i) / r : i < decayEnd ? 1 - (0.2 * (i - a)) / (decayEnd - a) : 0.8;
    out[first + i] += v * env * volume;
  }
}

let seed = 1;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x3fffffff - 1;
};

function addNoise(out, { start, length, volume, hold = 1, bright = false, decay = 5 }) {
  const first = Math.floor(start * RATE);
  const count = Math.min(Math.floor(length * RATE), out.length - first);
  let held = 0;
  let previous = 0;
  for (let i = 0; i < count; i++) {
    if (i % hold === 0) held = noise();
    // "bright" takes the difference of neighbours: a cheap high-pass for hats
    const v = bright ? held - previous : held;
    previous = held;
    out[first + i] += v * Math.exp((-decay * i) / count) * volume;
  }
}

/** The song as mono samples at RATE (pure: also runs in the tests). */
export function renderSamples(song) {
  seed = 7;
  const bars = arrange(song);
  const bar = barSeconds(song);
  const out = new Float32Array(Math.ceil((bars.length * bar + 1.2) * RATE));
  const sixteenth = bar / 16;
  const eighth = bar / 8;
  const leadDuty = song.lead ?? 0.25;

  for (const note of melodyNotes(song)) {
    addTone(out, { start: note.time, length: Math.max(0.08, note.length - 0.02), freq: hz(note.midi), duty: leadDuty, volume: 0.15 });
  }

  bars.forEach((b, i) => {
    const t0 = i * bar;
    const { root, minor } = chord(b.chord);
    const outro = b.section === "outro";
    const bassRoot = 36 + root + (root > 7 ? -12 : 0) + 12;
    if (outro) addTone(out, { start: t0, length: bar * 0.9, freq: hz(bassRoot), wave: "triangle", volume: 0.3, release: 0.5 });
    else {
      for (let k = 0; k < 8; k++) {
        const symbol = song.bass[k];
        if (symbol === ".") continue;
        addTone(out, { start: t0 + k * eighth, length: eighth * 0.85, freq: hz(symbol === "5" ? bassRoot + 7 : bassRoot), wave: "triangle", volume: 0.3 });
      }
    }
    const triad = [0, minor ? 3 : 4, 7, 12].map((step) => 72 + root + step - (root > 5 ? 12 : 0));
    if (outro) for (let k = 0; k < 3; k++) addTone(out, { start: t0, length: bar * 0.95, freq: hz(triad[k]), duty: 0.125, volume: 0.045, release: 0.6 });
    if (b.arp) {
      for (let k = 0; k < 16; k++) addTone(out, { start: t0 + k * sixteenth, length: sixteenth * 0.7, freq: hz(triad[k % 4]), duty: 0.125, volume: 0.04 });
    }
    if (outro) {
      addTone(out, { start: t0, length: 0.18, freq: 140, slideTo: 40, wave: "sine", volume: 0.75, attack: 0.002 });
      addNoise(out, { start: t0, length: 0.9, volume: 0.06, bright: true, decay: 4 });
      return;
    }
    for (let k = 0; k < 16; k++) {
      const t = t0 + k * sixteenth;
      if (song.drums.kick[k] === "x") addTone(out, { start: t, length: 0.14, freq: 150, slideTo: 42, wave: "sine", volume: 0.75, attack: 0.002, release: 0.04 });
      if (song.drums.snare[k] === "x") {
        addNoise(out, { start: t, length: 0.13, volume: 0.2, hold: 2, decay: 6 });
        addTone(out, { start: t, length: 0.06, freq: 190, slideTo: 120, wave: "triangle", volume: 0.18, attack: 0.001 });
      }
      if (song.drums.hat[k] === "x") addNoise(out, { start: t, length: 0.035, volume: 0.07, bright: true, decay: 6 });
    }
    if (i === 0 || bars[i - 1].section !== b.section) addNoise(out, { start: t0, length: 0.9, volume: 0.05, bright: true, decay: 4 });
  });

  // soften the square edges (one-pole low-pass, ~5 kHz) and keep the peak comfortable
  const alpha = 0.6;
  let low = 0;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    low += alpha * (out[i] - low);
    out[i] = low;
    const m = Math.abs(low);
    if (m > peak) peak = m;
  }
  if (peak > 0.92) for (let i = 0; i < out.length; i++) out[i] *= 0.92 / peak;
  return out;
}

function toBuffer(samples) {
  if (typeof AudioBuffer === "function") {
    try {
      const buffer = new AudioBuffer({ length: samples.length, sampleRate: RATE, numberOfChannels: 1 });
      buffer.copyToChannel(samples, 0);
      return buffer;
    } catch {
      // older engines: fall through to a context
    }
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctor();
  const buffer = ctx.createBuffer(1, samples.length, RATE);
  buffer.getChannelData(0).set(samples);
  ctx.close?.();
  return buffer;
}

let cached = { id: "", promise: null };

/** Resolves to the song's AudioBuffer; the latest song stays cached. */
export function renderSong(song) {
  if (cached.id === song.id && cached.promise) return cached.promise;
  const promise = new Promise((resolve, reject) => {
    // let "tuning up…" paint first
    setTimeout(() => {
      try {
        resolve(toBuffer(renderSamples(song)));
      } catch (error) {
        reject(error);
      }
    }, 30);
  });
  cached = { id: song.id, promise };
  promise.catch(() => {
    if (cached.promise === promise) cached = { id: "", promise: null };
  });
  return promise;
}

/** A click track for tuning the timing: `count` clicks, `beat` seconds apart, starting at 0. */
export function renderClicks(count = 16, beat = 0.6) {
  const out = new Float32Array(Math.ceil((count * beat + 0.5) * RATE));
  for (let i = 0; i < count; i++) addTone(out, { start: i * beat, length: 0.05, freq: i % 4 === 0 ? 1320 : 990, duty: 0.5, volume: 0.25, attack: 0.001, release: 0.03 });
  return Promise.resolve(toBuffer(out));
}
