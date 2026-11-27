import { buzz } from "../_kit/feel.js";
import { createParticles } from "../_kit/particles.js";
import { makeSounds, pentatonicRate } from "../_kit/sound.js";
import { drawSprite, paintedCanvas, svgSprites } from "../_kit/sprites.js";
import { SOUNDS, SPRITES, paintBlanket } from "./art.js";
import { CELLS, boop, createBoop, stepBoop } from "./logic.js";

const COLS = 3;
const ROWS = 3;
const TOP = 70; // below the HUD chips
const BOTTOM = 18;
const WORDS = ["boop!", "mrrp ♡", "nya~", "prrr", "boop ♡", "mew!"];
const SECONDS = Array.from({ length: 61 }, (_, s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const COMBOS = Array.from({ length: 100 }, (_, n) => (n >= 3 ? `×${n}` : ""));

// springy pop: overshoots a little, settles at 1
const pop = (t) => {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

export function createEngine({ ctx, hud, end }) {
  let width = 414;
  let height = 700;
  let sprites = null;
  let blanket = null;
  let state = createBoop({});
  let overIn = -1;
  let word = 0;
  let lastScore = -1;
  let lastSecond = -1;
  let lastCombo = -1;
  let clock = 0;
  const particles = createParticles(64);
  const sounds = makeSounds(SOUNDS);
  // per-box layout, recomputed on resize: centre x, rim y, scale, and the tap area
  const boxes = Array.from({ length: CELLS }, () => ({ x: 0, rim: 0, scale: 1, left: 0, top: 0, right: 0, bottom: 0, press: 0 }));

  let looks = null; // kind → { open, happy, wow, grumpy, paws }, so drawing never builds names
  const ready = svgSprites(SPRITES).then((loaded) => {
    sprites = loaded;
    looks = {};
    for (const kind of ["calico", "grey", "black", "chonk", "sleepy"]) {
      looks[kind] = {
        open: loaded[`${kind}.open`],
        happy: loaded[`${kind}.happy`] ?? loaded[`${kind}.open`],
        wow: loaded[`${kind}.wow`] ?? loaded[`${kind}.open`],
        grumpy: loaded[`${kind}.grumpy`] ?? loaded[`${kind}.open`],
        paws: loaded[`${kind}.paws`],
      };
    }
  });

  function layout() {
    const rowHeight = (height - TOP - BOTTOM) / ROWS;
    const colWidth = width / COLS;
    const scale = Math.min((colWidth - 10) / 132, (rowHeight - 12) / 150, 1.15);
    for (let i = 0; i < CELLS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const box = boxes[i];
      box.scale = scale;
      box.x = colWidth * (col + 0.5);
      const rowBottom = TOP + rowHeight * (row + 1);
      box.rim = rowBottom - 10 - 62 * scale;
      box.left = colWidth * col;
      box.right = box.left + colWidth;
      box.top = TOP + rowHeight * row;
      box.bottom = rowBottom;
    }
  }

  function updateHud() {
    if (state.score !== lastScore) hud("score", String((lastScore = state.score)));
    const second = Math.max(0, Math.ceil(state.length - state.time));
    if (second !== lastSecond) hud("time", SECONDS[Math.min(60, (lastSecond = second))]);
    const combo = Math.min(99, state.combo);
    if (combo !== lastCombo) hud("combo", COMBOS[(lastCombo = combo)]);
  }

  function react() {
    for (let i = 0; i < state.eventCount; i++) {
      const event = state.events[i];
      const box = boxes[event.cell];
      if (event.type === "boop") {
        particles.burst(box.x, box.rim - 64 * box.scale, sprites.heart, { count: 3, speed: 120, life: 0.75, gravity: -40, scale: 0.8, spread: 1.4 });
        particles.burst(box.x, box.rim - 50 * box.scale, sprites.sparkle, { count: 5, speed: 150, life: 0.5, gravity: 200 });
        particles.label(box.x, box.rim - 96 * box.scale, event.value > 1 ? `+${event.value}` : WORDS[word++ % WORDS.length]);
        sounds.play("boop", { rate: pentatonicRate(Math.min(10, state.combo - 1)), volume: 0.9 });
        buzz("light");
      } else if (event.type === "nudge") {
        particles.burst(box.x, box.rim - 50 * box.scale, sprites.puff, { count: 4, speed: 90, life: 0.4, gravity: 0 });
        particles.label(box.x, box.rim - 96 * box.scale, "one more!", 0.6);
        sounds.play("nudge");
        buzz("light");
      } else if (event.type === "woke") {
        particles.label(box.x, box.rim - 96 * box.scale, "mrr…? −1", 1);
        sounds.play("grumble");
        buzz("warning");
      } else if (event.type === "pop") {
        sounds.play("pop", { rate: 0.9 + (event.cell % 3) * 0.1 });
      } else if (event.type === "over") {
        sounds.play("over");
        overIn = 0.6;
      }
    }
  }

  function cellAt(x, y) {
    for (let i = 0; i < CELLS; i++) {
      const box = boxes[i];
      if (x >= box.left && x < box.right && y >= box.top && y < box.bottom) return i;
    }
    return -1;
  }

  return {
    ready,
    debug: () => ({ ...state, boxes }),
    resize(w, h) {
      width = w;
      height = h;
      layout();
      blanket = paintedCanvas(w, h, paintBlanket);
    },
    reset(settings) {
      state = createBoop({ calm: settings.calm });
      particles.clear();
      overIn = -1;
      word = 0;
      lastScore = lastSecond = lastCombo = -1;
      updateHud();
      if (settings.preview) {
        // a few faces peeking out behind the start card
        state.cells[1].mode = state.cells[3].mode = state.cells[8].mode = "up";
        state.cells[1].lift = state.cells[3].lift = state.cells[8].lift = 1;
        state.cells[3].kind = "black";
        state.cells[8].kind = "sleepy";
      } else sounds.warm();
    },
    update(dt) {
      clock += dt;
      if (overIn >= 0) {
        overIn -= dt;
        particles.update(dt);
        if (overIn < 0) end({ score: state.score, boops: state.boops, missed: state.missed, woke: state.woke, bestCombo: state.bestCombo });
        return;
      }
      stepBoop(state, dt);
      react();
      particles.update(dt);
      for (let i = 0; i < CELLS; i++) boxes[i].press = Math.max(0, boxes[i].press - dt * 6);
      updateHud();
    },
    render() {
      if (!blanket) return;
      ctx.drawImage(blanket, 0, 0, width, height);
      if (!sprites) return;
      for (let i = 0; i < CELLS; i++) drawBox(i);
      particles.draw(ctx, "700 24px Gaegu, cursive", "#c2457f");
    },
    pointer(kind, x, y) {
      if (kind !== "down") return;
      const index = cellAt(x, y);
      if (index < 0) return;
      boxes[index].press = 1;
      boop(state, index);
      react();
    },
    key(code, down) {
      // 1–9 on a keyboard, laid out like a phone keypad (for testing on a computer)
      const n = /^Digit([1-9])$/.exec(code)?.[1] ?? /^Numpad([1-9])$/.exec(code)?.[1];
      if (!n) return false;
      if (down) {
        boxes[Number(n) - 1].press = 1;
        boop(state, Number(n) - 1);
        react();
      }
      return true;
    },
  };

  function drawBox(i) {
    const box = boxes[i];
    const cell = state.cells[i];
    const s = box.scale * (1 - box.press * 0.04);
    const back = sprites.boxBack;
    const front = sprites.boxFront;
    // shadow, the inside of the box, the cat, then the front panel
    ctx.fillStyle = "rgba(110, 80, 130, 0.14)";
    ctx.beginPath();
    ctx.ellipse(box.x, box.rim + 64 * s, 62 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(back, box.x - (back.w * s) / 2, box.rim + 2 * s - back.h * s, back.w * s, back.h * s);
    if (cell.mode !== "empty" && cell.lift > 0) {
      const face = faceFor(cell);
      const lift = cell.mode === "rising" ? pop(cell.lift) : cell.lift;
      const centre = box.rim + (48 - 80 * lift) * s;
      const wobble = cell.wobble > 0 ? Math.sin(cell.wobble * 18) * cell.wobble * 0.12 : 0;
      const breathe = cell.kind === "sleepy" && cell.mode === "up" ? Math.sin(clock * 3) * 0.02 : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x - 70 * s, box.rim - 130 * s, 140 * s, 132 * s);
      ctx.clip();
      drawSprite(ctx, face, box.x, centre, wobble, s * (1 + breathe), s * (1 - breathe));
      ctx.restore();
    }
    ctx.drawImage(front, box.x - (front.w * s) / 2, box.rim - 6 * s, front.w * s, front.h * s);
    if (cell.mode !== "empty" && cell.mode !== "hiding" && cell.lift > 0.85) {
      drawSprite(ctx, looks[cell.kind].paws, box.x, box.rim + 2 * s, 0, s);
      if (cell.kind === "sleepy" && cell.mode === "up") {
        ctx.font = "700 20px Gaegu, cursive";
        ctx.fillStyle = "#9b7bc0";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const drift = (clock * 0.8) % 1;
        ctx.globalAlpha = 1 - drift;
        ctx.fillText("z", box.x + 40 * s + drift * 10, box.rim - 82 * s - drift * 18);
        ctx.globalAlpha = 1;
      }
    }
  }

  function faceFor(cell) {
    const look = looks[cell.kind];
    if (cell.mode === "booped") return look.happy;
    if (cell.mode === "grumpy") return look.grumpy;
    if (cell.kind === "chonk" && cell.left < 2) return look.wow;
    return look.open;
  }
}
