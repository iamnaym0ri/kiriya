// Makes the iPhone app's notification extras (docs/refactor/MAC-BUILD.md), all original:
// - the envelope and jar pictures the Notification Service Extension attaches to letters, little
//   notes and new jar notes (ios/App/KiriyaNotificationService/), drawn here as SVG and rendered
//   with sharp;
// - four short chimes, synthesised with the bundled ffmpeg as Linear PCM .caf (Apple's notification
//   sound format; each well under the 30 s limit) into ios/App/App/Sounds/. The server names them
//   in aps.sound: chat.caf, tap.caf, letter.caf (letters and notes), jar.caf (jar and reminders).
//   node scripts/make-notification-assets.mjs
import { execFileSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;
const nse = path.resolve("ios/App/KiriyaNotificationService");
const sounds = path.resolve("ios/App/App/Sounds");

const LILAC = "#efe5f6";
const PLUM = "#4e2f63";
const HEART = "#e2445c";
const heart = (x, y, s, fill = HEART) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" d="M0 30C-28 10-46-6-46-24-46-38-35-48-22-48-12-48-4-42 0-34 4-42 12-48 22-48 35-48 46-38 46-24 46-6 28 10 0 30Z"/>`;

const envelope = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#fff6fb"/><stop offset="1" stop-color="${LILAC}"/></radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf3"/><stop offset="1" stop-color="#f6ead9"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#glow)"/>
  <g transform="translate(256 268) rotate(-6)">
    <rect x="-170" y="-110" width="340" height="230" rx="22" fill="url(#paper)" stroke="${PLUM}" stroke-width="8"/>
    <path d="M-166-104 0 22 166-104" fill="none" stroke="${PLUM}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M-166 114-48-8M166 114 48-8" fill="none" stroke="${PLUM}" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
    <circle cx="0" cy="18" r="40" fill="#c9304a"/>
    ${heart(0, 22, 0.6, "#ffe9ee")}
  </g>
  <path d="M398 92Q402 112 422 116 402 120 398 140 394 120 374 116 394 112 398 92Z" fill="#b48ad0"/>
  <path d="M112 380Q115 394 129 397 115 400 112 414 109 400 95 397 109 394 112 380Z" fill="#d99ab8"/>
</svg>`;

const jar = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#fff6fb"/><stop offset="1" stop-color="${LILAC}"/></radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="0.5" stop-color="#f3ecfb" stop-opacity="0.45"/><stop offset="1" stop-color="#e4d6f2" stop-opacity="0.8"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#glow)"/>
  <rect x="176" y="92" width="160" height="44" rx="12" fill="#b48ad0" stroke="${PLUM}" stroke-width="7"/>
  <path d="M188 136h136v20q52 26 52 96v130q0 46-46 46H182q-46 0-46-46V252q0-70 52-96Z" fill="url(#glass)" stroke="${PLUM}" stroke-width="8" stroke-linejoin="round"/>
  <g stroke="${PLUM}" stroke-width="4" stroke-linejoin="round">
    <rect x="170" y="330" width="70" height="48" rx="6" fill="#fff4c9" transform="rotate(-14 205 354)"/>
    <rect x="236" y="338" width="74" height="46" rx="6" fill="#ffd9e6" transform="rotate(9 273 361)"/>
    <rect x="290" y="300" width="62" height="44" rx="6" fill="#dff3ff" transform="rotate(-7 321 322)"/>
    <rect x="196" y="282" width="66" height="44" rx="6" fill="#e9ffe4" transform="rotate(12 229 304)"/>
  </g>
  <path d="M168 200q-8 60 0 150" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.8"/>
  <circle cx="352" cy="120" r="58" fill="${HEART}" stroke="#ffffff" stroke-width="8"/>
  ${heart(352, 126, 0.78, "#ffffff")}
</svg>`;

async function picture(svg, file) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(file);
  console.log("wrote", path.relative(process.cwd(), file), `${Math.round((await stat(file)).size / 1024)} KB`);
}

await picture(envelope, path.join(nse, "envelope.png"));
await picture(jar, path.join(nse, "jar.png"));

// A struck bell: a few decaying partials. `t0` delays the note; envelope = attack × exp decay.
const bell = (freq, t0, decay, gain, partials = [[1, 1], [2, 0.35], [2.76, 0.18], [5.4, 0.06]]) =>
  partials
    .map(([ratio, weight]) => `${(gain * weight).toFixed(4)}*sin(2*PI*${(freq * ratio).toFixed(2)}*(t-${t0}))*exp(-${decay}*${ratio === 1 ? 1 : ratio * 0.8}*(t-${t0}))*min(1,(t-${t0})*400)*gte(t,${t0})`)
    .join("+");

const CHIMES = {
  // A soft "pop": a quick upward blip with a round body.
  chat: { seconds: 0.35, expr: `0.42*sin(2*PI*(520*t+1400*t*t))*exp(-18*t)*min(1,t*600)+0.12*sin(2*PI*1040*t)*exp(-26*t)*min(1,t*600)` },
  // A tiny sparkle: three quick high notes.
  tap: { seconds: 0.6, expr: [bell(1568, 0, 9, 0.22), bell(2093, 0.07, 9, 0.2), bell(2637, 0.14, 8, 0.18)].join("+") },
  // A two-note bell for letters and little notes (G5 then C6).
  letter: { seconds: 1.5, expr: [bell(784, 0, 3.2, 0.3), bell(1046.5, 0.2, 2.8, 0.3)].join("+") },
  // A glassy twinkle for the jar: a rising arpeggio with bright, inharmonic partials.
  jar: {
    seconds: 1.3,
    expr: [
      [2093, 0],
      [2637, 0.09],
      [3136, 0.18],
      [4186, 0.27],
    ]
      .map(([f, t0]) => bell(f, t0, 4.5, 0.13, [[1, 1], [2.41, 0.3], [3.9, 0.12]]))
      .join("+"),
  },
};

await mkdir(sounds, { recursive: true });
for (const [name, { seconds, expr }] of Object.entries(CHIMES)) {
  const file = path.join(sounds, `${name}.caf`);
  // A 15 ms fade-out avoids a click at the end; -1 dB headroom keeps it gentle and unclipped.
  execFileSync(ffmpeg, [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `aevalsrc=exprs='${expr}':s=44100:d=${seconds}`,
    "-af", `afade=t=out:st=${(seconds - 0.015).toFixed(3)}:d=0.015,alimiter=limit=0.89`,
    "-ac", "1", "-c:a", "pcm_s16le", "-f", "caf", file,
  ]);
  console.log("wrote", path.relative(process.cwd(), file), `${Math.round((await stat(file)).size / 1024)} KB`);
}
