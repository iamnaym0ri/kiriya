// Judging taps against a chart (tested in scripts/test-games-dexterity.mjs). Everything is in
// typed arrays made once per song, so a tap or a frame allocates nothing.
import { LANES, POINTS, WINDOWS, judge } from "./chart.js";

const RESULT = ["", "perfect", "great", "good", "miss"];
const CODE = { perfect: 1, great: 2, good: 3 };

export function createRun(chart) {
  const n = chart.length;
  const run = {
    count: n,
    times: new Float64Array(n),
    lanes: new Uint8Array(n),
    marks: new Uint8Array(n), // 0 waiting, 1 perfect, 2 great, 3 good, 4 miss
    errors: new Float32Array(n),
    first: 0, // earliest note that may still be waiting
    perfect: 0, great: 0, good: 0, miss: 0, combo: 0, maxCombo: 0, score: 0,
    lastResult: "", lastLane: 0, lastError: 0,
  };
  chart.forEach((note, i) => {
    run.times[i] = note.t;
    run.lanes[i] = note.lane;
  });
  return run;
}

/** A tap in `lane` at song time `t`. Returns "perfect" | "great" | "good" | "" (nothing near). */
export function tap(run, lane, t) {
  if (lane < 0 || lane >= LANES) return "";
  let best = -1;
  let bestError = Infinity;
  for (let i = run.first; i < run.count; i++) {
    const time = run.times[i];
    if (time - t > WINDOWS.good) break;
    if (run.marks[i] || run.lanes[i] !== lane) continue;
    const error = t - time;
    if (Math.abs(error) < Math.abs(bestError)) {
      best = i;
      bestError = error;
    }
  }
  if (best < 0) return "";
  const result = judge(bestError);
  if (!result) return "";
  run.marks[best] = CODE[result];
  run.errors[best] = bestError;
  run[result] += 1;
  run.combo += 1;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  run.score += POINTS[result] + Math.min(run.combo, 50) * 2;
  run.lastResult = result;
  run.lastLane = lane;
  run.lastError = bestError;
  return result;
}

/** Marks every note that slipped past (more than the widest window ago) as missed. Returns how many. */
export function sweep(run, t) {
  let missed = 0;
  while (run.first < run.count && (run.marks[run.first] || run.times[run.first] < t - WINDOWS.good)) {
    if (!run.marks[run.first]) {
      run.marks[run.first] = 4;
      run.miss += 1;
      run.combo = 0;
      run.lastResult = "miss";
      run.lastLane = run.lanes[run.first];
      missed += 1;
    }
    run.first += 1;
  }
  return missed;
}

export const resultName = (mark) => RESULT[mark];
export const finished = (run) => run.first >= run.count;
