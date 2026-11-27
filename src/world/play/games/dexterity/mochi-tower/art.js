// mochi tower's pictures: squishy daifuku in five flavours, a plate and a little cloud to hang from.
import { INK, line } from "../_kit/sprites.js";

export const FLAVOUR_FILLS = ["#ffd3e2", "#d4eabf", "#fff6ea", "#e4d4f8", "#ffe3a8"];
const DUST = ["#ffeef4", "#eef7e6", "#ffffff", "#f5effc", "#fff6dc"];

const EYES = {
  open: `<ellipse cx="48" cy="38" rx="3" ry="3.8" fill="${INK}"/><ellipse cx="72" cy="38" rx="3" ry="3.8" fill="${INK}"/>
         <circle cx="49.2" cy="36.6" r="1.2" fill="#fff"/><circle cx="73.2" cy="36.6" r="1.2" fill="#fff"/>`,
  happy: `<path d="M44 40q4-6 8 0M68 40q4-6 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
  oops: `<path d="M44 34l7 4-7 4M76 34l-7 4 7 4" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const MOUTHS = {
  open: `<path d="M56 44q2 2.4 4 0 2 2.4 4 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  happy: `<path d="M55 44q5 6 10 0z" fill="#f96cab" ${line(1.6)}/>`,
  oops: `<ellipse cx="60" cy="46" rx="2.6" ry="3" fill="#f96cab" ${line(1.4)}/>`,
};

function mochi(flavour, face) {
  return `<path d="M10 60c-7-3-8-10-6-17C8 23 31 9 60 9s52 14 56 34c2 7 1 14-6 17-14 5-33 6-50 6s-36-1-50-6z" fill="${FLAVOUR_FILLS[flavour]}" ${line(2.6)}/>
    <path d="M27 22q12-8 26-9" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".9"/>
    <circle cx="88" cy="20" r="1.6" fill="${DUST[flavour]}"/><circle cx="96" cy="27" r="1.2" fill="${DUST[flavour]}"/><circle cx="20" cy="40" r="1.3" fill="${DUST[flavour]}"/>
    <ellipse cx="40" cy="46" rx="5.5" ry="3" fill="#ffa4c9" opacity=".75"/><ellipse cx="80" cy="46" rx="5.5" ry="3" fill="#ffa4c9" opacity=".75"/>
    ${EYES[face]}${MOUTHS[face]}`;
}

export const SPRITES = {
  plate: [
    `<ellipse cx="110" cy="30" rx="104" ry="20" fill="#fbf6ff" ${line(2.6)}/>
     <ellipse cx="110" cy="25" rx="84" ry="13" fill="#efe4fa" stroke="#cdb5e3" stroke-width="2"/>
     <path d="M34 34q20 8 40 9M146 43q20-1 40-9" fill="none" stroke="#b589ff" stroke-width="2.2" stroke-linecap="round"/>
     <path d="M110 14h0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    220, 52,
  ],
  anchor: [
    `<path d="M18 34c-9 0-14-6-11-12 2-5 7-6 11-5 2-7 9-11 16-9 4-7 15-8 21-2 7-3 16 1 17 9 7 0 11 5 10 11-1 5-5 8-10 8z" fill="#fff" ${line(2.2)}/>
     <path d="M45 30c-5-6-12-7-12-2.5s7.5 4 12 2.5zM45 30c5-6 12-7 12-2.5s-7.5 4-12 2.5z" fill="#f9a3c6" ${line(1.6)}/>
     <circle cx="45" cy="30.5" r="2.8" fill="#ffd3e2" ${line(1.4)}/>`,
    90, 44,
  ],
  sparkle: [`<path d="M10 1l2.2 6.8L19 10l-6.8 2.2L10 19l-2.2-6.8L1 10l6.8-2.2z" fill="#fff6c9" stroke="#e9b949" stroke-width="1.1" stroke-linejoin="round"/>`, 20, 20],
  crumb: [`<circle cx="5" cy="5" r="3.6" fill="#fff" stroke="#e8d8f2" stroke-width="1.2"/>`, 10, 10],
  cloud: [
    `<path d="M22 46c-10 0-16-6-14-13 2-6 8-8 13-6 2-9 11-14 20-11 5-8 18-9 25-1 9-3 19 2 20 11 8 0 14 6 12 13-1 5-6 7-11 7Z" fill="#fff" opacity=".85" stroke="#e2d3ee" stroke-width="2" stroke-linejoin="round"/>`,
    120, 52,
  ],
};
for (let f = 0; f < FLAVOUR_FILLS.length; f++) {
  for (const face of ["open", "happy", "oops"]) SPRITES[`mochi${f}.${face}`] = [mochi(f, face), 120, 70];
}

export const SOUNDS = {
  plop: [1, 0, 300, 0, 0.03, 0.14, 0, 2, -14, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02],
  perfect: [0.9, 0, 660, 0.01, 0.07, 0.35, 1, 1.3, 0, 0, 330, 0.07, 0, 0, 0, 0, 0.08, 0.6],
  drop: [1, 0.05, 220, 0.01, 0.05, 0.3, 1, 1.6, -4, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.6],
  over: [0.8, 0, 392, 0.02, 0.18, 0.6, 1, 1, -1.2, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.7],
};

/** Three skies the tower climbs through: day, sunset, a starry night. */
export function paintSky(which) {
  return (ctx, width, height) => {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    const stops = which === 0 ? ["#efe3fb", "#f8eef8", "#fdf1f2"] : which === 1 ? ["#d9c2f2", "#f4c9dd", "#ffe0c8"] : ["#3d2c63", "#5a3f86", "#8a63a8"];
    sky.addColorStop(0, stops[0]);
    sky.addColorStop(0.6, stops[1]);
    sky.addColorStop(1, stops[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    if (which === 2) {
      let seed = 3;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rand() < 0.3 ? "#ffe9a8" : "#fff";
        ctx.globalAlpha = 0.5 + rand() * 0.5;
        ctx.beginPath();
        ctx.arc(rand() * width, rand() * height * 0.85, 0.8 + rand() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff6d6";
      ctx.beginPath();
      ctx.arc(width * 0.8, height * 0.22, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a3f86";
      ctx.beginPath();
      ctx.arc(width * 0.8 + 11, height * 0.22 - 7, 23, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = which === 0 ? "rgba(255, 241, 196, 0.7)" : "rgba(255, 214, 170, 0.8)";
      ctx.beginPath();
      ctx.arc(width * 0.22, height * (which === 0 ? 0.24 : 0.62), which === 0 ? 30 : 40, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

/** The table the plate sits on. */
export function paintTable(ctx, width) {
  ctx.fillStyle = "#e7cdb4";
  ctx.fillRect(0, 0, width, 200);
  ctx.fillStyle = "#d9b99c";
  ctx.fillRect(0, 0, width, 10);
  ctx.strokeStyle = "rgba(160, 120, 90, 0.25)";
  ctx.lineWidth = 2;
  for (let y = 26; y < 200; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.3, y - 4, width * 0.6, y + 5, width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(width, 1);
  ctx.stroke();
}
