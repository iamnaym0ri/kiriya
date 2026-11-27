// Turns a song's melody into taps (tested in scripts/test-games-dexterity.mjs). Higher notes fall in
// the lanes further right, so the chart follows the tune's shape. "gentle" keeps the notes on the
// beat and spaces them out; "lively" keeps every melody note and adds a two-lane tap at the start
// of each phrase. A short count-in in the second intro bar gets her fingers ready.
import { arrange, barSeconds, melodyNotes } from "./songs.js";

export const LANES = 3;
export const WINDOWS = { perfect: 0.055, great: 0.1, good: 0.15 }; // seconds either side
export const POINTS = { perfect: 300, great: 200, good: 100 };

export function buildChart(song, difficulty = "gentle") {
  const lively = difficulty === "lively";
  const beat = 60 / song.bpm;
  const melody = melodyNotes(song);
  // split the tune's pitches into thirds by how often they're played, so every lane gets used
  const sorted = melody.map((note) => note.midi).sort((a, b) => a - b);
  const lowCut = sorted[Math.floor(sorted.length / 3)];
  const highCut = sorted[Math.floor((sorted.length * 2) / 3)];
  const laneOf = (pitch) => (pitch < lowCut ? 0 : pitch < highCut ? 1 : 2);
  const minGap = lively ? Math.max(0.19, beat / 2 - 0.01) : Math.max(0.42, beat - 0.01);

  const chart = [];
  // count-in: the second intro bar's beats (every beat when lively, beats 1 and 3 when gentle)
  const introBars = song.intro.length;
  if (introBars >= 2) {
    const start = barSeconds(song) * (introBars - 1);
    for (let i = 0; i < 4; i += lively ? 1 : 2) chart.push({ t: start + i * beat, lane: 1 });
  }
  let last = -Infinity;
  let phrase = -1;
  for (const note of melody) {
    const onBeat = note.step % 2 === 0;
    if (!lively && !onBeat) continue;
    if (note.time - last < minGap) continue;
    const lane = laneOf(note.midi);
    chart.push({ t: note.time, lane });
    // a two-lane tap at the start of each four-bar phrase (lively only)
    const bar = note.bar - introBars;
    const startsPhrase = lively && bar >= 0 && bar % 4 === 0 && note.step % 8 === 0 && Math.floor(bar / 4) !== phrase;
    if (startsPhrase) {
      phrase = Math.floor(bar / 4);
      chart.push({ t: note.time, lane: lane === 1 ? 0 : lane === 0 ? 2 : 0 });
    }
    last = note.time;
  }
  chart.sort((a, b) => a.t - b.t || a.lane - b.lane);
  return chart;
}

/** The judgement for a tap `error` seconds away from its note, or null when it's too far. */
export function judge(error) {
  const e = Math.abs(error);
  if (e <= WINDOWS.perfect) return "perfect";
  if (e <= WINDOWS.great) return "great";
  if (e <= WINDOWS.good) return "good";
  return null;
}

/** Accuracy (0–100) from judgement counts, and a kind word for it. */
export function grade({ perfect = 0, great = 0, good = 0, miss = 0 }) {
  const total = perfect + great + good + miss;
  const accuracy = total ? Math.round(((perfect * 3 + great * 2 + good) / (total * 3)) * 100) : 0;
  const word = accuracy >= 95 ? "sparkling" : accuracy >= 85 ? "lovely" : accuracy >= 70 ? "nice" : "warming up";
  return { accuracy, word };
}

export function rewardsFor({ accuracy, fullCombo, cleared = [] }) {
  const earned = [];
  if (accuracy >= 85) earned.push({ sticker: "st-leek", reason: "a lovely run, start to finish" });
  if (fullCombo) earned.push({ sticker: "st-penlight", reason: "a full combo" });
  if (cleared.length >= 3) earned.push({ sticker: "st-mirror", reason: "all three songs cleared" });
  return earned;
}

export const songBars = (song) => arrange(song).length;
