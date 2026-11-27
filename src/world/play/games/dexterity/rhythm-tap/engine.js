import { buzz } from "../_kit/feel.js";
import { createParticles } from "../_kit/particles.js";
import { audioContext, makeSounds, masterOut } from "../_kit/sound.js";
import { drawSprite, paintedCanvas, svgSprites, line } from "../_kit/sprites.js";
import { readNumber } from "../_kit/storage.js";
import { LANES, buildChart, grade } from "./chart.js";
import { createRun, finished, sweep, tap } from "./play.js";
import { songLength } from "./songs.js";

// The page around the canvas: Game.jsx hands over the cheering buddy's DOM node and the chosen song here, so the
// engine can make her cheer without React re-rendering every frame.
export const bridge = { buddy: null, bubble: null };

const TOP = 150; // the band with the song title and the buddy
const LANE_COLOURS = ["#5fd3c8", "#ff9cc7", "#b996f0"];
const LANE_DEEP = ["#2a9d96", "#e0609c", "#7e5bc4"];
const LABELS = { perfect: "perfect!", great: "great", good: "good", miss: "miss" };
const NUMBERS = Array.from({ length: 2000 }, (_, n) => String(n));
const LINES = {
  start: ["let's go ♪", "ready? ♪", "here we go!"],
  cheer: ["yay!", "so good ♪", "amazing!", "keep it up!", "sparkly!"],
  encourage: ["you got this!", "it's okay ♡", "next one!"],
  end: { sparkling: "you're a star ✧", lovely: "that was lovely ♡", nice: "nice job ♪", "warming up": "let's go again!" },
};

const note = (fill, deep) => `
  <circle cx="26" cy="26" r="22" fill="${fill}" ${line(2.4)}/>
  <circle cx="26" cy="26" r="15.5" fill="none" stroke="#fff" stroke-width="2.6" opacity=".75"/>
  <path d="M29 15v15.5a5 5 0 1 1-3-4.6V15l9 2.6v4.4z" fill="${deep}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M13 19q3-6 9-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>`;
const ring = (fill) => `<circle cx="30" cy="30" r="25" fill="${fill}" fill-opacity=".18" stroke="${fill}" stroke-width="4"/><circle cx="30" cy="30" r="25" fill="none" stroke="#2b1b35" stroke-width="1.6" opacity=".55"/>`;

const SPRITES = {
  note0: [note(LANE_COLOURS[0], LANE_DEEP[0]), 52, 52],
  note1: [note(LANE_COLOURS[1], LANE_DEEP[1]), 52, 52],
  note2: [note(LANE_COLOURS[2], LANE_DEEP[2]), 52, 52],
  ring0: [ring(LANE_DEEP[0]), 60, 60],
  ring1: [ring(LANE_DEEP[1]), 60, 60],
  ring2: [ring(LANE_DEEP[2]), 60, 60],
  sparkle: [`<path d="M8 .8l1.7 5.5L15.2 8l-5.5 1.7L8 15.2 6.3 9.7.8 8l5.5-1.7z" fill="#fff6c9" stroke="#e9b949" stroke-width="1" stroke-linejoin="round"/>`, 16, 16],
};

const SOUNDS = { tick: [0.35, 0, 1500, 0, 0.005, 0.03, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5] };

function paintStage(ctx, width, height) {
  const hitY = height - 150;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#efe4fb");
  bg.addColorStop(0.5, "#e6f4f3");
  bg.addColorStop(1, "#f6e8f6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const laneWidth = width / LANES;
  for (let lane = 0; lane < LANES; lane++) {
    ctx.fillStyle = lane % 2 ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(lane * laneWidth + 6, TOP, laneWidth - 12, hitY - TOP + 30);
  }
  // pads under the hit line
  for (let lane = 0; lane < LANES; lane++) {
    const x = lane * laneWidth + 8;
    const y = hitY + 40;
    const w = laneWidth - 16;
    const h = height - y - 14;
    ctx.fillStyle = LANE_COLOURS[lane];
    ctx.globalAlpha = 0.28;
    roundRect(ctx, x, y, w, h, 20);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = LANE_DEEP[lane];
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 20);
    ctx.stroke();
  }
  // the band at the top fades into the lanes
  const band = ctx.createLinearGradient(0, 0, 0, TOP + 24);
  band.addColorStop(0, "#e7d9f8");
  band.addColorStop(0.8, "#e7d9f8");
  band.addColorStop(1, "rgba(231, 217, 248, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, width, TOP + 24);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createEngine({ ctx, hud, end }) {
  let width = 414;
  let height = 700;
  let hitY = 550;
  let sprites = null;
  let stage = null;
  let song = null;
  let run = createRun([]);
  let calm = false;
  let lead = 1.6;
  let offset = 0;
  let source = null;
  let songStart = 0;
  let length = 60;
  let running = false;
  let ended = false;
  let lastActual = -1;
  let lastActualPerf = 0;
  let now = 0; // song time this frame
  let beatIndex = -1;
  let lastScore = -1;
  let lastCombo = -1;
  let poseUntil = 0;
  let cheered = 0;
  const press = new Float32Array(LANES);
  const rings = new Float32Array(LANES);
  const particles = createParticles(48);
  const sounds = makeSounds(SOUNDS);
  let title = "";

  const ready = svgSprites(SPRITES).then((loaded) => {
    sprites = loaded;
  });

  // ---------- the clock: the audio context's time, smoothed between its updates ----------
  function songTimeAt(perf) {
    const audio = audioContext();
    if (!audio || !running) return now;
    const actual = audio.currentTime;
    if (actual !== lastActual) {
      lastActual = actual;
      lastActualPerf = performance.now();
    }
    const ahead = Math.max(-0.1, Math.min(0.05, (perf - lastActualPerf) / 1000));
    return lastActual + ahead - songStart - offset;
  }

  function say(kind, text) {
    const node = bridge.buddy;
    if (node) {
      node.dataset.pose = kind;
      poseUntil = now + 1.4;
    }
    if (bridge.bubble && text) {
      bridge.bubble.textContent = text;
      bridge.bubble.dataset.show = "true";
    }
  }
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function updateHud() {
    if (run.score !== lastScore) hud("score", NUMBERS[(lastScore = run.score)] ?? String(run.score));
    const combo = run.combo >= 5 ? run.combo : 0;
    if (combo !== lastCombo) hud("combo", (lastCombo = combo) ? `${NUMBERS[combo] ?? combo} combo` : "");
  }

  function stopSong() {
    if (source) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
      source.disconnect();
      source = null;
    }
  }

  function finish() {
    ended = true;
    running = false;
    stopSong();
    const counts = { perfect: run.perfect, great: run.great, good: run.good, miss: run.miss };
    const { accuracy, word } = grade(counts);
    say("cheer", LINES.end[word]);
    end({ score: run.score, accuracy, word, fullCombo: run.miss === 0 && run.count > 0, maxCombo: run.maxCombo, counts, song: song?.id });
  }

  function judged(result, lane) {
    if (!result) return;
    press[lane] = 1;
    rings[lane] = 1;
    const x = (lane + 0.5) * (width / LANES);
    particles.label(x, hitY - 44, LABELS[result], 0.55);
    if (result === "perfect") particles.burst(x, hitY, sprites.sparkle, { count: 5, speed: 150, life: 0.45, gravity: 80 });
    sounds.play("tick", { volume: result === "perfect" ? 0.6 : 0.4 });
    buzz("light");
    if (run.combo > 0 && run.combo % 25 === 0 && run.combo !== cheered) {
      cheered = run.combo;
      say(run.combo >= 50 ? "wow" : "cheer", pick(LINES.cheer));
    }
  }

  return {
    ready,
    debug: () => ({ now, lead, hitY, length, offset, first: run.first, count: run.count, times: Array.from(run.times.slice(run.first, run.first + 12)), lanes: Array.from(run.lanes.slice(run.first, run.first + 12)), perfect: run.perfect, great: run.great, good: run.good, miss: run.miss, combo: run.combo, maxCombo: run.maxCombo, score: run.score }),
    resize(w, h) {
      width = w;
      height = h;
      hitY = h - 150;
      stage = paintedCanvas(w, h, paintStage);
    },
    reset(settings) {
      stopSong();
      song = settings.song ?? null;
      calm = !!settings.calm;
      const difficulty = calm ? "gentle" : settings.difficulty ?? "gentle";
      run = createRun(song ? buildChart(song, difficulty) : []);
      lead = (difficulty === "lively" ? 1.35 : 1.7) * (calm ? 1.2 : 1);
      length = song ? songLength(song) : 60;
      offset = readNumber("rhythm-tap:offset", 0) / 1000;
      title = song ? `♪ ${song.title}` : "";
      press.fill(0);
      rings.fill(0);
      particles.clear();
      beatIndex = -1;
      cheered = 0;
      ended = false;
      lastScore = lastCombo = -1;
      updateHud();
      if (bridge.buddy) {
        bridge.buddy.dataset.pose = "idle";
        bridge.buddy.dataset.calm = calm ? "true" : "false";
      }
      if (bridge.bubble) bridge.bubble.dataset.show = "false";
      now = -1;
      running = false;
      if (settings.preview || !song || !settings.buffer) return;
      const audio = audioContext();
      if (!audio) return;
      sounds.warm();
      source = audio.createBufferSource();
      source.buffer = settings.buffer;
      source.connect(masterOut());
      songStart = audio.currentTime + 0.8;
      source.start(songStart);
      lastActual = -1;
      running = true;
      now = songTimeAt(performance.now());
      say("cheer", pick(LINES.start));
    },
    update(dt, perf) {
      if (!running) return;
      now = Math.max(now, songTimeAt(perf ?? performance.now()));
      const missed = sweep(run, now);
      if (missed) {
        const lane = run.lastLane;
        particles.label((lane + 0.5) * (width / LANES), hitY - 44, LABELS.miss, 0.5);
        if (run.maxCombo >= 10 && Math.random() < 0.35) say("encourage", pick(LINES.encourage));
      }
      for (let lane = 0; lane < LANES; lane++) {
        press[lane] = Math.max(0, press[lane] - dt * 5);
        rings[lane] = Math.max(0, rings[lane] - dt * 4);
      }
      particles.update(dt);
      // the buddy bops on the beat (not in calm mode) and settles after a reaction
      const beat = Math.floor((now * (song?.bpm ?? 100)) / 60);
      if (beat !== beatIndex && now > 0) {
        beatIndex = beat;
        if (bridge.buddy && !calm) bridge.buddy.dataset.beat = beat % 2 ? "b" : "a";
      }
      if (poseUntil && now > poseUntil) {
        poseUntil = 0;
        if (bridge.buddy) bridge.buddy.dataset.pose = "idle";
        if (bridge.bubble) bridge.bubble.dataset.show = "false";
      }
      updateHud();
      if (!ended && now > length + 0.3 && finished(run)) finish();
    },
    render() {
      if (!stage) return;
      ctx.drawImage(stage, 0, 0, width, height);
      if (!sprites) return;
      const laneWidth = width / LANES;
      // song title and progress, top left (the buddy cheers on the right)
      if (title) {
        ctx.font = "700 22px Gaegu, cursive";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#5b3f73";
        ctx.fillText(title, 16, 82);
        const progress = Math.max(0, Math.min(1, now / length));
        ctx.fillStyle = "rgba(126, 91, 196, 0.18)";
        ctx.fillRect(16, 104, width - 140, 6);
        ctx.fillStyle = "#9a76d6";
        ctx.fillRect(16, 104, (width - 140) * progress, 6);
      }
      // receptors, pulsing gently on the beat
      const pulse = calm || now < 0 ? 0 : Math.max(0, 1 - ((now * (song?.bpm ?? 100)) / 60 - Math.floor((now * (song?.bpm ?? 100)) / 60)) * 3);
      for (let lane = 0; lane < LANES; lane++) {
        const x = (lane + 0.5) * laneWidth;
        const s = 1 + pulse * 0.06 + press[lane] * 0.08;
        drawSprite(ctx, sprites[RING[lane]], x, hitY, 0, s);
        if (press[lane] > 0) {
          ctx.fillStyle = LANE_COLOURS[lane];
          ctx.globalAlpha = press[lane] * 0.35;
          ctx.fillRect(lane * laneWidth + 8, hitY + 40, laneWidth - 16, height - hitY - 54);
          ctx.globalAlpha = 1;
        }
        if (rings[lane] > 0) {
          ctx.strokeStyle = LANE_DEEP[lane];
          ctx.lineWidth = 3;
          ctx.globalAlpha = rings[lane];
          ctx.beginPath();
          ctx.arc(x, hitY, 26 + (1 - rings[lane]) * 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      // falling notes
      const travel = hitY - (TOP - 30);
      for (let i = run.first; i < run.count; i++) {
        const dtNote = run.times[i] - now;
        if (dtNote > lead) break;
        if (run.marks[i]) continue;
        const y = hitY - (dtNote / lead) * travel;
        const lane = run.lanes[i];
        const fade = y < TOP ? Math.max(0, (y - (TOP - 30)) / 30) : 1;
        drawSprite(ctx, sprites[NOTE[lane]], (lane + 0.5) * laneWidth, y, 0, 1, 1, fade);
      }
      particles.draw(ctx, "700 22px Gaegu, cursive", "#6a43a8");
    },
    pointer(kind, x, y, id, timeStamp) {
      if (kind !== "down" || !running || y < TOP - 10) return;
      const lane = Math.max(0, Math.min(LANES - 1, Math.floor(x / (width / LANES))));
      const perf = Math.abs(performance.now() - timeStamp) < 1000 ? timeStamp : performance.now();
      press[lane] = 1;
      judged(tap(run, lane, songTimeAt(perf)), lane);
    },
    key(code, down) {
      const lane = code === "KeyJ" || code === "ArrowLeft" ? 0 : code === "KeyK" || code === "ArrowDown" ? 1 : code === "KeyL" || code === "ArrowRight" ? 2 : -1;
      if (lane < 0) return false;
      if (down && running) {
        press[lane] = 1;
        judged(tap(run, lane, songTimeAt(performance.now())), lane);
      }
      return true;
    },
    pause() {
      if (bridge.buddy) bridge.buddy.dataset.pose = "idle";
    },
    resume() {
      lastActual = -1;
    },
    destroy() {
      stopSong();
    },
  };
}

const NOTE = ["note0", "note1", "note2"];
const RING = ["ring0", "ring1", "ring2"];
