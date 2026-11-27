import { buzz } from "../_kit/feel.js";
import { createParticles } from "../_kit/particles.js";
import { makeSounds, pentatonicRate } from "../_kit/sound.js";
import { drawSprite, paintedCanvas, svgSprites } from "../_kit/sprites.js";
import { SOUNDS, SPRITES, paintCurtain, paintDusk, paintHills, paintMeadow, paintPillar } from "./art.js";
import { OBSTACLE_WIDTH, createFlight, flap, resizeFlight, stepFlight } from "./logic.js";

const HEARTS = ["0", "1", "2", "3"];
const NUMBERS = Array.from({ length: 1000 }, (_, n) => String(n));
const VISUAL_WIDTH = OBSTACLE_WIDTH + 10;
const MEADOW_TILE = 240;

export function createEngine({ ctx, hud, end }) {
  let width = 414;
  let height = 700;
  let sprites = null;
  let sky = null;
  let hills = null;
  let meadow = null;
  let curtain = null;
  let pillar = null;
  let state = createFlight({});
  let overIn = -1;
  let shake = 0;
  let lastScore = -1;
  let lastLives = -1;
  let notes = 0;
  const particles = createParticles(64);
  const sounds = makeSounds(SOUNDS);

  const ready = svgSprites(SPRITES).then((loaded) => {
    sprites = loaded;
  });

  function updateHud() {
    if (state.score !== lastScore) hud("score", NUMBERS[(lastScore = state.score)] ?? String(state.score));
    if (state.lives !== lastLives) hud("lives", HEARTS[Math.max(0, (lastLives = state.lives))]);
  }

  function react() {
    for (let i = 0; i < state.eventCount; i++) {
      const event = state.events[i];
      if (event.type === "flap") {
        sounds.play("flap", { rate: 0.9 + Math.random() * 0.2 });
        buzz("light");
        particles.burst(event.x - 18, event.y + 6, sprites.feather, { count: 1, speed: 60, life: 0.6, gravity: 140, angle: Math.PI * 0.8, spread: 0.8, scale: 0.8 });
      } else if (event.type === "gap") {
        sounds.play("gap", { rate: pentatonicRate(notes++ % 8), volume: 0.7 });
      } else if (event.type === "star") {
        sounds.play("star");
        buzz("medium");
        particles.burst(event.x, event.y, sprites.sparkle, { count: 8, speed: 150, life: 0.6, gravity: 100 });
        particles.label(event.x, event.y - 26, "+1 ✧");
      } else if (event.type === "bump") {
        sounds.play("bump");
        buzz("warning");
        notes = 0;
        if (!state.calm) shake = 0.3;
        particles.burst(event.x, event.y, sprites.feather, { count: 5, speed: 120, life: 0.8, gravity: 160 });
        if (event.value > 0) particles.label(event.x + 10, event.y - 34, "oof! careful ♡", 0.9);
      } else if (event.type === "over") {
        sounds.play("over");
        overIn = 0.8;
      }
    }
  }

  return {
    ready,
    debug: () => state,
    resize(w, h) {
      width = w;
      height = h;
      resizeFlight(state, w, h);
      sky = paintedCanvas(w, h, paintDusk);
      hills = paintedCanvas(w, 150, paintHills);
      meadow = paintedCanvas(MEADOW_TILE, 70, paintMeadow);
      curtain = paintedCanvas(VISUAL_WIDTH, h, paintCurtain);
      pillar = paintedCanvas(VISUAL_WIDTH, h, paintPillar);
    },
    reset(settings) {
      state = createFlight({ width, height, calm: settings.calm });
      resizeFlight(state, width, height);
      overIn = -1;
      shake = 0;
      notes = 0;
      particles.clear();
      lastScore = lastLives = -1;
      updateHud();
      if (!settings.preview) sounds.warm();
    },
    update(dt) {
      if (overIn >= 0) {
        overIn -= dt;
        particles.update(dt);
        if (overIn < 0) end({ score: state.score, gaps: state.gaps, stars: state.stars, bumps: state.bumps, bestClean: state.bestClean });
        return;
      }
      stepFlight(state, dt);
      react();
      particles.update(dt);
      shake = Math.max(0, shake - dt);
      updateHud();
    },
    render() {
      if (!sky) return;
      ctx.drawImage(sky, 0, 0, width, height);
      const ground = state.ground;
      // far hills drift slowly; the meadow moves with the flight
      const hillShift = (state.scroll * 0.22) % width;
      ctx.drawImage(hills, -hillShift, ground - 120, width, 150);
      ctx.drawImage(hills, width - hillShift - 1, ground - 120, width + 1, 150);
      if (!sprites) return;
      ctx.save();
      if (shake > 0) ctx.translate(0, Math.sin(shake * 60) * shake * 10);
      for (let i = 0; i < state.obstacles.length; i++) {
        const o = state.obstacles[i];
        if (!o.active) continue;
        const left = o.x - VISUAL_WIDTH / 2;
        const top = o.gapY - o.gapH / 2;
        const bottom = o.gapY + o.gapH / 2;
        ctx.drawImage(curtain, left, top - height, VISUAL_WIDTH, height);
        ctx.drawImage(pillar, left, bottom, VISUAL_WIDTH, height);
        if (o.star) drawSprite(ctx, sprites.star, o.x, o.starY + Math.sin(state.time * 3 + i) * 4, Math.sin(state.time * 2 + i) * 0.2);
      }
      const meadowShift = state.scroll % MEADOW_TILE;
      for (let x = -meadowShift; x < width; x += MEADOW_TILE) ctx.drawImage(meadow, x, ground - 8, MEADOW_TILE + 1, 70);
      const crane = state.crane;
      const blink = state.hurt > 0 && Math.floor(state.hurt * 10) % 2 === 0;
      drawSprite(ctx, crane.flap > 0.4 ? sprites.craneDown : sprites.craneUp, crane.x, crane.y, crane.rot * 0.6, 1, 1, blink ? 0.4 : 1);
      particles.draw(ctx, "700 22px Gaegu, cursive", "#8d4fc4");
      if (!state.started) {
        ctx.font = "700 26px Gaegu, cursive";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#7e5a96";
        ctx.fillText("tap to flap ♡", width / 2, state.height * 0.62);
      }
      ctx.restore();
    },
    pointer(kind) {
      if (kind === "down") {
        flap(state);
        react();
      }
    },
    key(code, down) {
      if (code !== "Space" && code !== "ArrowUp") return false;
      if (down) {
        flap(state);
        react();
      }
      return true;
    },
  };
}
