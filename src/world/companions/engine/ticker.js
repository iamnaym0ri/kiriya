// The one requestAnimationFrame loop for every character on the stage. It stops entirely while
// paused (home hidden, app in the background, nobody on stage), and keeps a short record of frame
// times for the lab's readout.

export function createTicker(step) {
  let raf = 0;
  let last = 0;
  let running = false;
  const blocks = new Set();
  // Ring buffers of the last 180 frames: the gap between frames, and our own work per frame.
  const gaps = new Float32Array(180);
  const costs = new Float32Array(180);
  let n = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const gap = last ? now - last : 16.7;
    last = now;
    // A long gap (a stall, or the first frame after a pause) must not teleport anyone.
    const dt = Math.min(gap, 50) / 1000;
    const t0 = performance.now();
    step(dt, now);
    const i = n++ % gaps.length;
    gaps[i] = gap;
    costs[i] = performance.now() - t0;
  };

  const sync = () => {
    const should = blocks.size === 0;
    if (should && !running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  return {
    /** Pause for a named reason ("hidden", "inactive", "empty", "lab"); resumes when none remain. */
    block(reason, on = true) {
      if (on) blocks.add(reason);
      else blocks.delete(reason);
      sync();
    },
    get running() {
      return running;
    },
    get reasons() {
      return [...blocks];
    },
    /** Frame stats over the last ~3 s: { fps, avg, p95, max, long, cost } in ms. */
    stats() {
      const count = Math.min(n, gaps.length);
      if (!count) return null;
      const list = Array.from(gaps.subarray(0, count)).sort((a, b) => a - b);
      const sum = list.reduce((a, b) => a + b, 0);
      const costList = Array.from(costs.subarray(0, count)).sort((a, b) => a - b);
      return {
        avg: sum / count,
        fps: 1000 / (sum / count),
        p95: list[Math.floor(count * 0.95)],
        max: list[count - 1],
        long: list.filter((g) => g > 34).length,
        cost: costList.reduce((a, b) => a + b, 0) / count,
        costMax: costList[count - 1],
        frames: count,
      };
    },
    resetStats() {
      n = 0;
    },
    stop() {
      blocks.add("stopped");
      sync();
    },
  };
}
