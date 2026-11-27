import { buzz } from "../_kit/feel.js";
import { createParticles } from "../_kit/particles.js";
import { ease } from "../_kit/random.js";
import { makeSounds, pentatonicRate } from "../_kit/sound.js";
import { drawSprite, paintedCanvas, svgSprites } from "../_kit/sprites.js";
import { FLAVOUR_FILLS, SOUNDS, SPRITES, paintSky, paintTable } from "./art.js";
import { PLATE_GAP, cameraHeight, createTower, dropPiece, layoutTower, stepTower, swayOffset } from "./logic.js";

const HEARTS = ["0", "1", "2", "3"];
const COMBO_LABELS = ["perfect!", "perfect!", "perfect ×2!", "perfect ×3!", "perfect ×4!", "perfect ×5!", "so steady ♡"];
const TALL = Array.from({ length: 400 }, (_, n) => String(n));

export function createEngine({ ctx, hud, end }) {
  let width = 414;
  let height = 700;
  let sprites = null;
  let looks = null; // flavour → { open, happy, oops }
  let skies = null;
  let table = null;
  let state = createTower({});
  let cam = 0;
  let overIn = -1;
  let shake = 0;
  let lastScore = -1;
  let lastLives = -1;
  let lastCombo = -1;
  let clock = 0;
  const particles = createParticles(64);
  const sounds = makeSounds(SOUNDS);

  const ready = svgSprites(SPRITES).then((loaded) => {
    sprites = loaded;
    looks = FLAVOUR_FILLS.map((_, f) => ({ open: loaded[`mochi${f}.open`], happy: loaded[`mochi${f}.happy`], oops: loaded[`mochi${f}.oops`] }));
  });

  // screen y of a height above the plate
  const sy = (h) => height - PLATE_GAP - (h - cam);
  const cx = () => width / 2;

  function updateHud() {
    if (state.score !== lastScore) hud("score", TALL[(lastScore = state.score)] ?? String(state.score));
    if (state.lives !== lastLives) hud("lives", HEARTS[Math.max(0, (lastLives = state.lives))]);
    const combo = state.combo >= 2 ? Math.min(state.combo, 99) : 0;
    if (combo !== lastCombo) hud("combo", (lastCombo = combo) ? `✧${combo}` : "");
  }

  function react() {
    for (let i = 0; i < state.eventCount; i++) {
      const event = state.events[i];
      const x = cx() + event.x;
      const y = sy(event.y);
      if (event.type === "land" || event.type === "perfect") {
        particles.burst(x, y + 4, sprites.crumb, { count: 5, speed: 90, life: 0.45, gravity: 260, spread: 2.6 });
        sounds.play("plop", { rate: 0.9 + Math.min(state.floors, 30) * 0.012 });
        buzz("light");
        if (event.type === "perfect") {
          particles.burst(x, y - state.h / 2, sprites.sparkle, { count: 9, speed: 170, life: 0.7, gravity: 120 });
          particles.label(x, y - state.h - 16, COMBO_LABELS[Math.min(COMBO_LABELS.length - 1, event.value)]);
          sounds.play("perfect", { rate: pentatonicRate(Math.min(8, event.value - 1)) });
          buzz("medium");
        }
      } else if (event.type === "drop") {
        particles.label(x, Math.min(height - 140, y) - 30, event.value > 0 ? "oh no!" : "oh…", 0.9);
        sounds.play("drop");
        buzz("warning");
        if (!state.calm) shake = 0.3;
      } else if (event.type === "over") {
        sounds.play("over");
        overIn = 0.5;
      }
    }
  }

  function drawMochi(sprite, x, y, rot = 0, sx = 1, sy2 = 1) {
    drawSprite(ctx, sprite, x, y, rot, (state.w / 120) * sx, (state.w / 120) * sy2);
  }

  return {
    ready,
    debug: () => ({ ...state, xs: Array.from(state.xs.slice(0, state.floors)), topX: state.floors ? state.xs[state.floors - 1] + swayOffset(state, state.floors - 1) : 0 }),
    resize(w, h) {
      width = w;
      height = h;
      layoutTower(state, w, h);
      skies = [0, 1, 2].map((which) => paintedCanvas(w, h, paintSky(which)));
      table = paintedCanvas(w, 200, paintTable);
    },
    reset(settings) {
      state = createTower({ width, calm: settings.calm });
      layoutTower(state, width, height);
      cam = 0;
      overIn = -1;
      shake = 0;
      particles.clear();
      lastScore = lastLives = lastCombo = -1;
      updateHud();
      if (!settings.preview) sounds.warm();
    },
    update(dt) {
      clock += dt;
      if (overIn >= 0) {
        overIn -= dt;
        particles.update(dt);
        if (overIn < 0) end({ score: state.score, floors: state.floors, perfects: state.perfects, bestCombo: state.bestCombo });
        return;
      }
      stepTower(state, dt);
      react();
      cam += (cameraHeight(state) - cam) * ease(5, dt);
      particles.update(dt);
      shake = Math.max(0, shake - dt);
      updateHud();
    },
    render() {
      if (!skies) return;
      // the sky deepens as the tower climbs: day → sunset (14 floors) → night (28)
      const climb = Math.min(2, state.floors / 14);
      const base = Math.floor(climb);
      ctx.drawImage(skies[base], 0, 0, width, height);
      if (base < 2 && climb > base) {
        ctx.globalAlpha = climb - base;
        ctx.drawImage(skies[base + 1], 0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      if (!sprites) return;
      // drifting clouds, scrolling past at half the tower's speed
      for (let i = 0; i < 4; i++) {
        const span = height + 140;
        const y = ((i * 230 + cam * 0.5) % span) - 70;
        const x = ((i * 157 + clock * (6 + i * 2)) % (width + 160)) - 80;
        drawSprite(ctx, sprites.cloud, x, y, 0, 0.5 + (i % 2) * 0.25);
      }
      ctx.save();
      if (shake > 0) ctx.translate(Math.sin(shake * 60) * shake * 12, 0);
      const plateY = sy(0);
      if (plateY < height + 20) {
        ctx.drawImage(table, 0, plateY + 14, width, 200);
        drawSprite(ctx, sprites.plate, cx(), plateY + 10);
      }
      // the stack, newest floor squishing as it lands
      const { h } = state;
      const first = Math.max(0, Math.floor((cam - 40) / h) - 1);
      for (let k = first; k < state.floors; k++) {
        const y = sy((k + 0.5) * h);
        if (y < -h) break;
        const newest = k === state.floors - 1;
        const squish = newest ? state.squash : 0;
        const look = looks[state.flavours[k]];
        const face = newest && state.perfect[k] ? look.happy : look.open;
        drawMochi(face, cx() + state.xs[k] + swayOffset(state, k), y + squish * h * 0.12, 0, 1 + squish * 0.14, 1 - squish * 0.2);
      }
      // the hanging or falling piece, on its ribbon
      const piece = state.piece;
      const pieceLook = looks[piece.flavour];
      if (piece.mode === "hang") {
        const px = cx() + piece.x;
        const py = sy(piece.y + h / 2);
        const anchorY = sy(piece.y + h + state.rope * Math.cos(piece.angle));
        ctx.strokeStyle = "#b589ff";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx(), anchorY);
        ctx.lineTo(px + Math.sin(piece.angle) * (h / 2), py - Math.cos(piece.angle) * (h / 2));
        ctx.stroke();
        drawMochi(pieceLook.open, px, py, piece.angle * 0.6);
        drawSprite(ctx, sprites.anchor, cx(), anchorY - 12);
      } else if (piece.mode === "fall") {
        drawMochi(pieceLook.open, cx() + piece.x, sy(piece.y + h / 2), 0, 0.96, 1.05);
      }
      const t = state.tumble;
      if (t.active) drawMochi(looks[t.flavour].oops, cx() + t.x, sy(t.y + h / 2), t.rot);
      particles.draw(ctx, "700 24px Gaegu, cursive", "#8d4fc4");
      ctx.restore();
    },
    pointer(kind) {
      if (kind === "down") dropPiece(state);
    },
    key(code, down) {
      if (code !== "Space" && code !== "Enter") return false;
      if (down) dropPiece(state);
      return true;
    },
  };
}
