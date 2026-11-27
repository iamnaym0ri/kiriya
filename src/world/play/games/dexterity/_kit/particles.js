import { drawSprite } from "./sprites.js";

// A fixed pool of little sparkles, hearts and floating "+1"s. Nothing is allocated while playing.
export function createParticles(size = 64) {
  const items = Array.from({ length: size }, () => ({
    life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, rot: 0, spin: 0, scale: 1, grow: 0, sprite: null, text: "",
  }));
  let cursor = 0;
  const next = () => {
    const item = items[cursor];
    cursor = (cursor + 1) % size;
    return item;
  };
  return {
    burst(x, y, sprite, { count = 6, speed = 120, life = 0.7, gravity = 160, scale = 1, spread = Math.PI * 2, angle = -Math.PI / 2 } = {}, random = Math.random) {
      for (let i = 0; i < count; i++) {
        const p = next();
        const a = angle + (random() - 0.5) * spread;
        const v = speed * (0.55 + random() * 0.6);
        p.life = p.max = life * (0.75 + random() * 0.5);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.gravity = gravity;
        p.rot = random() * 6.28;
        p.spin = (random() - 0.5) * 6;
        p.scale = scale * (0.7 + random() * 0.5);
        p.grow = 0;
        p.sprite = sprite;
        p.text = "";
      }
    },
    /** A floating label ("+1", "perfect!") that drifts up and fades. */
    label(x, y, text, life = 0.8) {
      const p = next();
      p.life = p.max = life;
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = -46;
      p.gravity = 0;
      p.rot = 0;
      p.spin = 0;
      p.scale = 1;
      p.grow = 0;
      p.sprite = null;
      p.text = text;
    },
    clear() {
      for (let i = 0; i < size; i++) items[i].life = 0;
    },
    update(dt) {
      for (let i = 0; i < size; i++) {
        const p = items[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
    },
    /** `font`/`colour` style the labels. */
    draw(ctx, font = "700 22px Gaegu, cursive", colour = "#7e39df") {
      let styled = false;
      for (let i = 0; i < size; i++) {
        const p = items[i];
        if (p.life <= 0) continue;
        const t = p.life / p.max;
        if (p.sprite) {
          drawSprite(ctx, p.sprite, p.x, p.y, p.rot, p.scale * (0.6 + 0.4 * t), p.scale * (0.6 + 0.4 * t), Math.min(1, t * 1.6));
        } else if (p.text) {
          if (!styled) {
            ctx.font = font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#fff9fd";
            ctx.fillStyle = colour;
            styled = true;
          }
          ctx.globalAlpha = Math.min(1, t * 1.8);
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillText(p.text, p.x, p.y);
          ctx.globalAlpha = 1;
        }
      }
    },
  };
}
