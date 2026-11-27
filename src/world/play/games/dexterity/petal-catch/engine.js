import { buzz } from "../_kit/feel.js";
import { createParticles } from "../_kit/particles.js";
import { makeSounds, pentatonicRate } from "../_kit/sound.js";
import { drawSprite, paintedCanvas, svgSprites } from "../_kit/sprites.js";
import { SOUNDS, SPRITES, paintMeadow } from "./art.js";
import { LIVES, aimBasket, createPetals, resizePetals, stepPetals } from "./logic.js";

const HEARTS = ["0", "1", "2", "3"];
const LABELS = { 1: "+1", 2: "+2", 5: "+5" };
// where caught petals settle in the basket: [x, y, rotation] from its centre
const PILE = [[-24, -20, 0.4], [6, -22, -0.6], [28, -19, 1.2], [-8, -26, 2.1], [18, -28, 0.2], [-30, -26, -1], [0, -32, 0.9], [-16, -33, 1.7], [30, -27, -0.3]];

export function createEngine({ ctx, hud, end }) {
  let width = 414;
  let height = 760;
  let sprites = null;
  let meadow = null;
  let state = createPetals({ width, height });
  let preview = true;
  let shake = 0;
  let flash = 0;
  let keyDir = 0;
  let lastScore = -1;
  let lastLives = -1;
  let lastStreak = -1;
  let overIn = -1;
  let music = 0;
  const particles = createParticles(72);
  const sounds = makeSounds(SOUNDS);
  const clouds = [
    { x: 40, y: 120, speed: 7, scale: 0.9 },
    { x: 260, y: 220, speed: 4.5, scale: 0.7 },
    { x: 160, y: 330, speed: 3, scale: 0.55 },
  ];

  const ready = svgSprites(SPRITES).then((loaded) => {
    sprites = loaded;
  });

  function updateHud() {
    if (state.score !== lastScore) hud("score", String((lastScore = state.score)));
    if (state.lives !== lastLives) hud("lives", HEARTS[Math.max(0, (lastLives = state.lives))]);
    const streak = state.streak >= 5 ? state.streak : 0;
    if (streak !== lastStreak) hud("streak", (lastStreak = streak) ? `×${streak}` : "");
  }

  function react() {
    for (let i = 0; i < state.eventCount; i++) {
      const event = state.events[i];
      if (event.type === "catch") {
        const sprite = event.kind === "star" ? sprites.sparkle : event.kind === "heart" ? sprites.mini : sprites.sparkle;
        particles.burst(event.x, event.y - 6, sprite, { count: event.kind === "star" ? 10 : 5, speed: event.kind === "star" ? 170 : 110, life: 0.6, gravity: 220 });
        particles.label(event.x, event.y - 30, event.kind === "heart" ? "♡" : LABELS[event.value] ?? "+1");
        if (event.kind === "star") sounds.play("star");
        else if (event.kind === "heart") sounds.play("heart");
        else sounds.play("pop", { rate: pentatonicRate(music++), volume: 0.8 });
        buzz(event.kind === "star" ? "medium" : "light");
      } else if (event.type === "hurt") {
        sounds.play("thorn");
        buzz("warning");
        flash = 1;
        if (!state.calm) shake = 0.35;
        particles.burst(event.x, event.y, sprites.mini, { count: 4, speed: 90, life: 0.5, gravity: 300 });
      } else if (event.type === "miss") {
        music = 0;
        if (event.value >= 10) particles.label(state.basket.x, state.basket.y - 52, "oops ♡", 0.9);
      } else if (event.type === "flurry") {
        sounds.play("flurry");
        particles.label(width / 2, 92, "a little flurry!", 1.3);
      } else if (event.type === "over") {
        sounds.play("over");
        overIn = 0.7;
      }
    }
  }

  return {
    ready,
    debug: () => state,
    resize(w, h) {
      width = w;
      height = h;
      resizePetals(state, w, h);
      meadow = paintedCanvas(w, h, paintMeadow);
    },
    reset(settings) {
      state = createPetals({ width, height, calm: settings.calm });
      resizePetals(state, width, height);
      state.basket.x = state.basket.target = width / 2;
      preview = !!settings.preview;
      particles.clear();
      shake = flash = 0;
      overIn = -1;
      music = 0;
      lastScore = lastLives = lastStreak = -1;
      updateHud();
      if (!preview) sounds.warm();
    },
    update(dt) {
      if (keyDir) aimBasket(state, state.basket.target + keyDir * 520 * dt);
      if (overIn >= 0) {
        overIn -= dt;
        particles.update(dt);
        if (overIn < 0) end({ score: state.score, caught: state.caught, bestStreak: state.bestStreak, time: state.time });
        return;
      }
      stepPetals(state, dt);
      react();
      particles.update(dt);
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        cloud.x += cloud.speed * dt * (state.calm ? 0.6 : 1);
        if (cloud.x > width + 80) cloud.x = -80;
      }
      shake = Math.max(0, shake - dt);
      flash = Math.max(0, flash - dt * 2.5);
      updateHud();
    },
    render() {
      if (!meadow) return;
      ctx.save();
      if (shake > 0) ctx.translate(Math.sin(shake * 70) * shake * 14, 0);
      ctx.drawImage(meadow, 0, 0, width, height);
      if (!sprites) {
        ctx.restore();
        return;
      }
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        drawSprite(ctx, sprites.cloud, cloud.x, cloud.y, 0, cloud.scale);
      }
      // a soft shadow under the basket, then the falling things, then the basket in front
      const { basket } = state;
      ctx.fillStyle = "rgba(120, 90, 140, 0.16)";
      ctx.beginPath();
      ctx.ellipse(basket.x, basket.y + 38, 46, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < state.items.length; i++) {
        const item = state.items[i];
        if (!item.active) continue;
        drawSprite(ctx, sprites[item.kind], item.x, item.y, item.kind === "star" ? item.rot * 0.3 : item.rot);
      }
      const squash = basket.squash;
      const blink = state.hurt > 0 && Math.floor(state.hurt * 12) % 2 === 0;
      ctx.save();
      ctx.translate(basket.x, basket.y + 4);
      ctx.rotate(basket.lean);
      ctx.scale(1 + squash * 0.08, 1 - squash * 0.1);
      if (blink) ctx.globalAlpha = 0.45;
      // the petals she has caught so far, peeking over the rim
      const pile = Math.min(PILE.length, Math.floor(state.caught / 4));
      for (let i = 0; i < pile; i++) {
        const spot = PILE[i];
        drawSprite(ctx, i % 2 ? sprites.sakura : sprites.lilac, spot[0], spot[1], spot[2], 0.9);
      }
      ctx.drawImage(sprites.basket, -sprites.basket.w / 2, -sprites.basket.h / 2, sprites.basket.w, sprites.basket.h);
      ctx.restore();
      if (preview) drawHint();
      particles.draw(ctx, "700 23px Gaegu, cursive", "#8d4fc4");
      ctx.restore();
      if (flash > 0) {
        ctx.fillStyle = "rgba(229, 98, 157, 0.18)";
        ctx.globalAlpha = flash;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }
    },
    pointer(kind, x) {
      if (kind === "down" || kind === "move") aimBasket(state, x);
    },
    key(code, down) {
      if (code === "ArrowLeft") keyDir = down ? -1 : keyDir === -1 ? 0 : keyDir;
      else if (code === "ArrowRight") keyDir = down ? 1 : keyDir === 1 ? 0 : keyDir;
      else return false;
      return true;
    },
  };

  function drawHint() {
    ctx.strokeStyle = "rgba(126, 102, 137, 0.35)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, height - 24);
    ctx.lineTo(width - 30, height - 24);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export { LIVES };
