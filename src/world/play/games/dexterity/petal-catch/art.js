// petal catch's pictures, drawn for this game in the site's sticker style.
import { line } from "../_kit/sprites.js";

const lilacPetal = (angle) =>
  `<path transform="rotate(${angle} 16 16)" d="M16 14.5C11 11 10.5 4.5 16 3.2c5.5 1.3 5 7.8 0 11.3Z" fill="#cfb4ff" ${line(1.7)}/>`;

export const SPRITES = {
  lilac: [
    `${[0, 90, 180, 270].map(lilacPetal).join("")}
     <path d="M13.5 6.5q2.5-1.5 4.5 0M25.5 13.5q1.5 2.5 0 4.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
     <circle cx="16" cy="16" r="2.7" fill="#ffe08a" ${line(1.3)}/>`,
    32, 32,
  ],
  sakura: [
    `<path d="M15 28C6.5 23 3.5 14.5 6.8 7.6 8.8 3.6 12 3 14 5.4l1 1.6 1-1.6c2-2.4 5.2-1.8 7.2 2.2 3.3 6.9.3 15.4-8.2 20.4Z" fill="#ffcce0" ${line(1.8)}/>
     <path d="M15 24v-9M15 15l-3-4M15 15l3-4" fill="none" stroke="#f96cab" stroke-width="1.5" stroke-linecap="round"/>
     <path d="M9 10q1-3 3-3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
    30, 30,
  ],
  star: [
    `<circle cx="18" cy="18" r="16" fill="#fff1b8" opacity=".55"/>
     <path d="M18 4.5l4.1 9.4 10.2 1.1-7.6 6.9 2.1 10L18 26.8l-8.8 5.1 2.1-10-7.6-6.9 10.2-1.1z" fill="#ffd166" ${line(2)}/>
     <path d="M13 15.5l3-.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
    36, 36,
  ],
  heart: [
    `<path d="M15 26.5C4.5 19 2.2 12.6 4.2 8.3c2.2-4.5 8-5 10.8-.6 2.8-4.4 8.6-3.9 10.8.6 2 4.3-.3 10.7-10.8 18.2Z" fill="#f96cab" ${line(2)}/>
     <path d="M8 10.5q1-2.5 3.5-2.5" fill="none" stroke="#ffd1e4" stroke-width="2.2" stroke-linecap="round"/>`,
    30, 30,
  ],
  thorn: [
    `<circle cx="22" cy="22" r="20" fill="#6b2f5a" opacity=".1"/>
     <path d="M8 36C15 28 25 17 36 8" fill="none" stroke="#2b1b35" stroke-width="9" stroke-linecap="round"/>
     <path d="M8 36C15 28 25 17 36 8" fill="none" stroke="#7a4467" stroke-width="5" stroke-linecap="round"/>
     <path d="M12 30q4-5 8-9" fill="none" stroke="#a86c90" stroke-width="1.8" stroke-linecap="round"/>
     <path d="M13.5 29L4.5 24.5l11.5.6zM16.5 30.5l5.6 9.2-9-4.6zM20 22l.2-11.2 4.2 8.6zM24.4 22.4l11 2.4-9.6 2zM29 14l-2.6-10 6.4 7.2zM31 15.5l9.6 3.4-10 .4z" fill="#4a2540" ${line(1.6)}/>
     <path d="M34 9.5c5.4-.6 8.4 2.6 7.6 7.4-4.8.4-8-2.6-7.6-7.4Z" fill="#9fd08f" ${line(1.6)}/>`,
    44, 44,
  ],
  basket: [
    `<path d="M10 27h84l-8.5 33c-1 4-4.2 6.4-8.4 6.4H26.9c-4.2 0-7.4-2.4-8.4-6.4Z" fill="#efcf9f" ${line(2.4)}/>
     <path d="M14.5 39.5h75M17.6 51.5h68.8" stroke="#c99a68" stroke-width="2" stroke-linecap="round"/>
     <path d="M30 29l3.5 36M44 29l1.6 37M60 29l-1.6 37M74 29l-3.5 36" stroke="#d7ad7b" stroke-width="1.8" stroke-linecap="round"/>
     <rect x="5" y="20" width="94" height="11" rx="5.5" fill="#f7dfba" ${line(2.4)}/>
     <path d="M12 24h20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
     <path d="M52 41c-6-7-15-8-15-2.5s9.5 5 15 2.5zM52 41c6-7 15-8 15-2.5s-9.5 5-15 2.5z" fill="#b589ff" ${line(2)}/>
     <path d="M50 43l-4.5 11 4-1.5 1.5 3.5 1-12.5zM54 43l4.5 11-4-1.5-1.5 3.5-1-12.5z" fill="#995cf7" ${line(1.6)}/>
     <circle cx="52" cy="41.5" r="3.6" fill="#e3d4ff" ${line(1.8)}/>`,
    104, 70,
  ],
  sparkle: [
    `<path d="M8 0.8l1.7 5.5L15.2 8l-5.5 1.7L8 15.2 6.3 9.7.8 8l5.5-1.7z" fill="#fff6c9" stroke="#e9b949" stroke-width="1" stroke-linejoin="round"/>`,
    16, 16,
  ],
  mini: [
    `<path d="M8 14C2.5 10 1.2 6.6 2.3 4.4c1.2-2.4 4.3-2.6 5.7-.3 1.4-2.3 4.5-2.1 5.7.3 1.1 2.2-.2 5.6-5.7 9.6Z" fill="#ffa4c9" stroke="#e5629d" stroke-width="1"/>`,
    16, 16,
  ],
  cloud: [
    `<path d="M22 46c-10 0-16-6-14-13 2-6 8-8 13-6 2-9 11-14 20-11 5-8 18-9 25-1 9-3 19 2 20 11 8 0 14 6 12 13-1 5-6 7-11 7Z" fill="#fff" opacity=".92" stroke="#dccbe8" stroke-width="2.2" stroke-linejoin="round"/>`,
    120, 52,
  ],
};

export const SOUNDS = {
  pop: [1.1, 0, 620, 0, 0.02, 0.13, 0, 1.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.03],
  star: [0.9, 0, 880, 0.01, 0.06, 0.35, 1, 1.4, 0, 0, 440, 0.07, 0, 0, 0, 0, 0.09, 0.6],
  heart: [0.9, 0, 523, 0.01, 0.08, 0.3, 1, 1, 0, 0, 262, 0.08, 0, 0, 0, 0, 0, 0.7],
  thorn: [1.3, 0.05, 150, 0, 0.04, 0.22, 1, 2, -5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.6, 0.02],
  flurry: [0.35, 0, 400, 0.18, 0.2, 0.45, 4, 1, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.5, 0, 0, 1800],
  over: [0.9, 0, 392, 0.02, 0.18, 0.6, 1, 1, -1.2, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.7],
};

/** The sky, hills and meadow, painted once per screen size. */
export function paintMeadow(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#ece0f8");
  sky.addColorStop(0.55, "#f6e9f6");
  sky.addColorStop(1, "#fde9f0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // a soft sun
  ctx.fillStyle = "rgba(255, 241, 196, 0.7)";
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.2, 34, 0, Math.PI * 2);
  ctx.fill();

  // far hills
  const hill = (base, amp, colour, edge) => {
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, base);
    for (let x = 0; x <= width + 40; x += 40) {
      ctx.quadraticCurveTo(x + 20, base - amp * (0.6 + 0.4 * Math.sin(x * 0.013)), x + 40, base);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  hill(height - 150, 26, "#e6d6f3", "#d6c1e6");
  hill(height - 92, 18, "#d9ecd0", "#bcd8b0");

  // the meadow with tiny flowers
  ctx.fillStyle = "#cfe6c4";
  ctx.fillRect(0, height - 40, width, 40);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < Math.round(width / 14); i++) {
    const x = rand() * width;
    const y = height - 82 + rand() * 72;
    ctx.fillStyle = rand() < 0.5 ? "#f2c6dc" : "#dcc8f5";
    ctx.beginPath();
    ctx.arc(x, y, 2.4 + rand() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // wisteria hanging in from the top corners
  const strand = (x, length) => {
    for (let i = 0; i < length; i++) {
      const r = 6.2 - i * 0.42;
      ctx.fillStyle = i % 2 ? "#cdb2ef" : "#b996e6";
      ctx.beginPath();
      ctx.arc(x + Math.sin(i * 1.7) * 3, 6 + i * 8, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  ctx.strokeStyle = "#8f7a64";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.quadraticCurveTo(width * 0.2, 16, width * 0.34, 2);
  ctx.moveTo(width + 10, 6);
  ctx.quadraticCurveTo(width * 0.84, 18, width * 0.7, 2);
  ctx.stroke();
  [0.04, 0.12, 0.2, 0.28].forEach((f, i) => strand(width * f, 7 + (i % 2) * 3));
  [0.96, 0.88, 0.8, 0.73].forEach((f, i) => strand(width * f, 6 + ((i + 1) % 2) * 3));
}
