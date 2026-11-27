// paper-crane flight's pictures: an origami crane, wisteria curtains, cloud pillars and a dusk sky.
import { INK, line } from "../_kit/sprites.js";

const crane = (wing) => `
  <path d="M8 22L22 31 20 34z" fill="#e3d4fb" ${line(1.8)}/>
  ${wing === "up" ? `<path d="M27 25L22 4 41 25z" fill="#d9c6fb" ${line(1.8)}/>` : `<path d="M27 31L24 46 40 32z" fill="#d9c6fb" ${line(1.8)}/>`}
  <path d="M14 30L33 22 47 30 33 37z" fill="#f2eaff" ${line(2)}/>
  <path d="M41 28L55 10 51 27z" fill="#f7f1ff" ${line(1.8)}/>
  <path d="M55 10L62 13.5 53.5 15z" fill="#f9a3c6" ${line(1.6)}/>
  ${wing === "up" ? `<path d="M30 25L31 6 44 25z" fill="#cfb4ff" ${line(2)}/><path d="M33 22l-1-11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` : `<path d="M30 31L33 47 45 31z" fill="#cfb4ff" ${line(2)}/><path d="M34 34l1.5 8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`}
  <path d="M18 29.5L33 25.5M33 25.5L44 30" stroke="#c8b2ec" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="51.6" cy="16.6" r="1.4" fill="${INK}"/>`;

export const SPRITES = {
  craneUp: [crane("up"), 64, 50],
  craneDown: [crane("down"), 64, 50],
  star: [
    `<circle cx="14" cy="14" r="13" fill="#fff1b8" opacity=".5"/>
     <path d="M14 3.5l3.2 7.3 7.9.9-5.9 5.4 1.6 7.8L14 21l-6.8 3.9 1.6-7.8-5.9-5.4 7.9-.9z" fill="#ffd166" ${line(1.8)}/>`,
    28, 28,
  ],
  sparkle: [`<path d="M8 .8l1.7 5.5L15.2 8l-5.5 1.7L8 15.2 6.3 9.7.8 8l5.5-1.7z" fill="#fff6c9" stroke="#e9b949" stroke-width="1" stroke-linejoin="round"/>`, 16, 16],
  feather: [`<path d="M3 13C5 6 10 2 15 2c-1 6-5 10-12 11z" fill="#e3d4fb" stroke="#9b7bc0" stroke-width="1.2" stroke-linejoin="round"/>`, 18, 16],
};

export const SOUNDS = {
  flap: [0.35, 0.05, 520, 0, 0.02, 0.07, 4, 1, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.5, 0, 0, 2400],
  gap: [0.7, 0, 784, 0, 0.03, 0.15, 0, 1.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02],
  star: [0.9, 0, 988, 0.01, 0.05, 0.3, 1, 1.3, 0, 0, 494, 0.06, 0, 0, 0, 0, 0.08, 0.6],
  bump: [1.1, 0.05, 170, 0, 0.04, 0.22, 1, 2, -5, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.6, 0.02],
  over: [0.8, 0, 392, 0.02, 0.18, 0.6, 1, 1, -1.2, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.7],
};

export function paintDusk(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#d8c6f4");
  sky.addColorStop(0.55, "#f2d5ea");
  sky.addColorStop(1, "#ffe6d2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 246, 214, 0.85)";
  ctx.beginPath();
  ctx.arc(width * 0.74, height * 0.3, 44, 0, Math.PI * 2);
  ctx.fill();
  let seed = 5;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.4 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * height * 0.4, 0.8 + rand() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A strip of far lilac hills, drawn twice side by side as it scrolls. */
export function paintHills(ctx, width, height) {
  ctx.fillStyle = "#dccbf0";
  ctx.strokeStyle = "#cbb6e6";
  ctx.lineWidth = 2;
  const ridge = () => {
    ctx.moveTo(0, height * 0.55);
    const bumps = 4;
    for (let i = 0; i < bumps; i++) {
      const x0 = (i * width) / bumps;
      const x1 = ((i + 1) * width) / bumps;
      ctx.quadraticCurveTo((x0 + x1) / 2, height * (i % 2 ? 0.05 : 0.25), x1, height * 0.55);
    }
  };
  ctx.beginPath();
  ridge();
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ridge(); // only the ridge gets a line, so the copies join without a seam
  ctx.stroke();
}

/** The meadow floor: one tile, repeated. */
export function paintMeadow(ctx, width, height) {
  ctx.fillStyle = "#cfe6c4";
  ctx.fillRect(0, 8, width, height - 8);
  ctx.fillStyle = "#bcdcae";
  ctx.beginPath();
  ctx.moveTo(0, 12);
  for (let x = 0; x <= width; x += 20) ctx.quadraticCurveTo(x + 10, 0, x + 20, 12);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  for (let x = 0; x <= width; x += 20) ctx.quadraticCurveTo(x + 10, 0, x + 20, 12);
  ctx.stroke();
  const flowers = [[30, 26, "#f7b6d2"], [92, 38, "#cfb4ff"], [150, 24, "#fff"], [205, 40, "#f7b6d2"]];
  for (const [x, y, colour] of flowers) {
    ctx.fillStyle = colour;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos((k * Math.PI * 2) / 5) * 3.6, y + Math.sin((k * Math.PI * 2) / 5) * 3.6, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A wisteria curtain hanging from the top; its bottom edge is the canvas's bottom. */
export function paintCurtain(ctx, width, height) {
  ctx.strokeStyle = "#8f7a64";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height - 30);
  ctx.stroke();
  const columns = [width * 0.2, width * 0.42, width * 0.62, width * 0.82];
  for (let c = 0; c < columns.length; c++) {
    const reach = height - (c % 2 ? 4 : 16);
    for (let y = reach; y > -10; y -= 9) {
      const fromTip = reach - y;
      const r = Math.min(9, 3.2 + fromTip * 0.09);
      ctx.fillStyle = (Math.floor(y / 9) + c) % 2 ? "#c7a8ef" : "#b18be3";
      ctx.beginPath();
      ctx.arc(columns[c] + Math.sin(y * 0.11 + c) * 2.5, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgba(43, 27, 53, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, -2, width - 2, height + 2);
}

/** A soft cloud pillar rising from the meadow; its top edge is the canvas's top. */
export function paintPillar(ctx, width, height) {
  ctx.fillStyle = "#fbf7ff";
  ctx.strokeStyle = "#cdb8e4";
  ctx.lineWidth = 2.2;
  ctx.fillRect(6, 18, width - 12, height);
  ctx.beginPath();
  ctx.moveTo(6, height);
  ctx.lineTo(6, 22);
  ctx.arc(20, 22, 14, Math.PI, Math.PI * 1.55);
  ctx.arc(width / 2, 16, 16, Math.PI * 1.15, Math.PI * 1.85);
  ctx.arc(width - 20, 22, 14, Math.PI * 1.45, 0);
  ctx.lineTo(width - 6, height);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(207, 180, 255, 0.35)";
  for (let y = 60; y < height; y += 46) {
    ctx.beginPath();
    ctx.arc(width * 0.35, y, 10, 0, Math.PI * 2);
    ctx.arc(width * 0.66, y + 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
