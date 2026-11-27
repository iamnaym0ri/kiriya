// A tiny chiptune band (pulse lead, triangle bass, pulse arpeggio, noise drums) that renders a
// whole song ahead of time with an OfflineAudioContext. Playing one prepared buffer keeps the music
// exactly on the audio clock the notes are judged against, with nothing to schedule while playing.
import { arrange, barSeconds, chord, melodyNotes } from "./songs.js";

const RATE = 22050; // chiptune doesn't need more, and it keeps the buffer small (mono, ~1.4 MB/min)
const cache = new Map();

const hz = (note) => 440 * 2 ** ((note - 69) / 12);

function pulseWave(ctx, duty) {
  const size = 64;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let n = 1; n < size; n++) imag[n] = 0;
  for (let n = 1; n < size; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function tone(ctx, out, { type, wave, freq, start, length, volume, attack = 0.004, release = 0.04, slideTo }) {
  const osc = ctx.createOscillator();
  if (wave) osc.setPeriodicWave(wave);
  else osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.setValueAtTime(volume * 0.8, start + Math.max(attack, length - release));
  gain.gain.linearRampToValueAtTime(0, start + length);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + length + 0.01);
}

function noiseHit(ctx, out, noise, { start, length, volume, filter, frequency }) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = filter;
  band.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + length);
  source.connect(band).connect(gain).connect(out);
  source.start(start, Math.random() * 0.3);
  source.stop(start + length + 0.01);
}

/** Renders `song` once (cached) and resolves to its AudioBuffer. */
export function renderSong(song) {
  if (cache.has(song.id)) return cache.get(song.id);
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) return Promise.reject(new Error("no offline audio"));
  const bars = arrange(song);
  const bar = barSeconds(song);
  const length = bars.length * bar + 1.2;
  const ctx = new Offline(1, Math.ceil(length * RATE), RATE);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  // a soft low-pass keeps the square waves from sounding harsh on a phone speaker
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 6200;
  out.connect(soften).connect(ctx.destination);

  const lead = pulseWave(ctx, song.lead ?? 0.25);
  const thin = pulseWave(ctx, 0.125);
  const noise = ctx.createBuffer(1, RATE, RATE);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const sixteenth = bar / 16;
  const eighth = bar / 8;

  // melody
  for (const note of melodyNotes(song)) {
    tone(ctx, out, { wave: lead, freq: hz(note.midi), start: note.time, length: Math.max(0.08, note.length - 0.02), volume: 0.15 });
  }

  bars.forEach((b, i) => {
    const t0 = i * bar;
    const { root, minor } = chord(b.chord);
    const outro = b.section === "outro";
    // bass: 8th-note pattern of root (R) and fifth (5), in the second octave
    const bassRoot = 36 + root + (root > 7 ? -12 : 0) + 12;
    if (outro) tone(ctx, out, { type: "triangle", freq: hz(bassRoot), start: t0, length: bar * 0.9, volume: 0.32, release: 0.5 });
    else {
      for (let k = 0; k < 8; k++) {
        const symbol = song.bass[k];
        if (symbol === ".") continue;
        const pitch = symbol === "5" ? bassRoot + 7 : bassRoot;
        tone(ctx, out, { type: "triangle", freq: hz(pitch), start: t0 + k * eighth, length: eighth * 0.85, volume: 0.32 });
      }
    }
    // a soft chord pad on the outro, an arpeggio in the busier sections
    const triad = [0, minor ? 3 : 4, 7, 12].map((step) => 72 + root + step - (root > 5 ? 12 : 0));
    if (outro) triad.slice(0, 3).forEach((p) => tone(ctx, out, { wave: thin, freq: hz(p), start: t0, length: bar * 0.95, volume: 0.05, release: 0.6 }));
    if (b.arp) {
      for (let k = 0; k < 16; k++) tone(ctx, out, { wave: thin, freq: hz(triad[k % 4]), start: t0 + k * sixteenth, length: sixteenth * 0.7, volume: 0.045 });
    }
    // drums
    if (outro) {
      tone(ctx, out, { type: "sine", freq: 140, slideTo: 40, start: t0, length: 0.18, volume: 0.8 });
      noiseHit(ctx, out, noise, { start: t0, length: 0.8, volume: 0.12, filter: "highpass", frequency: 5000 });
      return;
    }
    for (let k = 0; k < 16; k++) {
      const t = t0 + k * sixteenth;
      if (song.drums.kick[k] === "x") tone(ctx, out, { type: "sine", freq: 150, slideTo: 42, start: t, length: 0.14, volume: 0.8, attack: 0.002 });
      if (song.drums.snare[k] === "x") noiseHit(ctx, out, noise, { start: t, length: 0.13, volume: 0.28, filter: "bandpass", frequency: 1800 });
      if (song.drums.hat[k] === "x") noiseHit(ctx, out, noise, { start: t, length: 0.035, volume: 0.09, filter: "highpass", frequency: 7000 });
    }
    // a little crash at the start of each section
    if (i === 0 || bars[i - 1].section !== b.section) noiseHit(ctx, out, noise, { start: t0, length: 0.9, volume: 0.1, filter: "highpass", frequency: 4000 });
  });

  const promise = new Promise((resolve, reject) => {
    ctx.oncomplete = (event) => resolve(event.renderedBuffer);
    const started = ctx.startRendering();
    if (started && typeof started.then === "function") started.then(resolve, reject);
  }).catch((error) => {
    cache.delete(song.id);
    throw error;
  });
  // keep only the latest song in memory
  cache.clear();
  cache.set(song.id, promise);
  return promise;
}

/** A click track for tuning the timing: `count` clicks, `beat` seconds apart, starting at 0. */
export function renderClicks(count = 16, beat = 0.6) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Offline(1, Math.ceil((count * beat + 0.5) * RATE), RATE);
  for (let i = 0; i < count; i++) {
    tone(ctx, ctx.destination, { type: "square", freq: i % 4 === 0 ? 1320 : 990, start: i * beat, length: 0.05, volume: 0.25, attack: 0.001, release: 0.03 });
  }
  return new Promise((resolve, reject) => {
    ctx.oncomplete = (event) => resolve(event.renderedBuffer);
    const started = ctx.startRendering();
    if (started && typeof started.then === "function") started.then(resolve, reject);
  });
}
