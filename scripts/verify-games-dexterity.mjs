// Plays the dexterity shelf in Playwright WebKit as an iPhone 11 (and a 375 pt phone), saves
// screenshots and frame times. Run against your own dev server, inside a slot:
//   ~/.cache/kiriya-agents/slot.sh node scripts/verify-games-dexterity.mjs [game-id ...]
// Env: VERIFY_BASE_URL (default http://localhost:5316), VERIFY_OUT (default .lab/dexterity).
import { mkdir, writeFile } from "node:fs/promises";
import { devices, webkit } from "playwright";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5316";
const OUT = process.env.VERIFY_OUT ?? new URL("../.lab/dexterity/", import.meta.url).pathname;
const ALL = ["petal-catch", "boop-the-cats", "rhythm-tap", "mochi-tower", "crane-flight"];
const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const narrow = process.argv.includes("--narrow");
const calm = process.argv.includes("--calm");
const games = only.length ? only : ALL;
await mkdir(OUT, { recursive: true });

const browser = await webkit.launch();
const report = {};
const errors = [];

async function open(id, phone) {
  const context = await browser.newContext({ ...phone, reducedMotion: calm ? "reduce" : "no-preference" });
  const unlock = await context.request.post(`${BASE}/api/session/unlock`, { headers: { "x-kw": "1" }, data: { passphrase: "kiriya" } });
  if (unlock.status() !== 200) throw new Error(`unlock failed: ${unlock.status()}`);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(`${id}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${id} console: ${message.text()}`);
    if (message.type() === "info" && message.text().startsWith("reward")) report[id].rewards.push(message.text());
  });
  await page.goto(`${BASE}/world/game-lab?g=${id}&app=1`);
  await page.locator(".dex__play:not([disabled])").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` });
const state = (page) => page.evaluate(() => window.__dex?.engine.debug?.());
const phase = (page) => page.evaluate(() => window.__dex?.phase());
const frames = (page, reset = false) => page.evaluate((r) => window.__dexFrames?.(r), reset);

async function stageBox(page) {
  return page.locator(".dex").boundingBox();
}

// ---------- bots: each plays its game the way a careful person would ----------
const BOTS = {
  async "petal-catch"(page, box, seconds) {
    const until = Date.now() + seconds * 1000;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 40);
    await page.mouse.down();
    while (Date.now() < until && (await phase(page)) === "playing") {
      const s = await state(page);
      const rim = s.basket.y - s.basket.h * 0.22;
      const falling = s.items.filter((item) => item.active && item.y < rim);
      const thorns = falling.filter((item) => item.kind === "thorn" && rim - item.y < 140);
      const wanted = falling.filter((item) => item.kind !== "thorn").sort((a, b) => b.y - a.y)[0];
      let x = wanted ? wanted.x : s.basket.x;
      for (const thorn of thorns) if (Math.abs(thorn.x - x) < 70) x = thorn.x + (thorn.x > s.width / 2 ? -90 : 90);
      await page.mouse.move(box.x + Math.max(10, Math.min(box.width - 10, x)), box.y + box.height - 40, { steps: 2 });
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
  },
  async "mochi-tower"(page, box, seconds) {
    const until = Date.now() + seconds * 1000;
    while (Date.now() < until && (await phase(page)) === "playing") {
      const s = await state(page);
      if (s.piece.mode === "hang" && s.piece.wait === 0 && Math.abs(s.piece.x - s.topX) < s.w * 0.07) {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 60);
        await page.waitForTimeout(300);
      } else await page.waitForTimeout(12);
    }
  },
  async "crane-flight"(page, box, seconds) {
    const until = Date.now() + seconds * 1000;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    while (Date.now() < until && (await phase(page)) === "playing") {
      const s = await state(page);
      const next = s.obstacles.filter((o) => o.active && o.x + 33 > s.crane.x - 13).sort((a, b) => a.x - b.x)[0];
      const target = next ? next.gapY + 18 : s.height * 0.45;
      if (s.crane.y > target && s.crane.vy > -40) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.waitForTimeout(10);
    }
  },
  async "rhythm-tap"(page, box, seconds) {
    const until = Date.now() + seconds * 1000;
    const tapped = new Set();
    while (Date.now() < until && (await phase(page)) === "playing") {
      const s = await state(page);
      const lanes = [];
      s.times.forEach((t, i) => {
        const key = `${t}:${s.lanes[i]}`;
        if (!tapped.has(key) && t - s.now < 0.035 && t - s.now > -0.1) {
          tapped.add(key);
          lanes.push(s.lanes[i]);
        }
      });
      for (const lane of lanes) await page.touchscreen.tap(box.x + (lane + 0.5) * (box.width / 3), box.y + s.hitY + 70);
      if (!lanes.length) await page.waitForTimeout(4);
    }
  },
  async "boop-the-cats"(page, box, seconds) {
    const until = Date.now() + seconds * 1000;
    while (Date.now() < until && (await phase(page)) === "playing") {
      const s = await state(page);
      const target = s.cells.findIndex((cell) => (cell.mode === "up" || cell.mode === "rising") && cell.lift > 0.5 && cell.kind !== "sleepy");
      if (target >= 0) {
        const b = s.boxes[target];
        await page.touchscreen.tap(box.x + b.x, box.y + b.rim - 30);
      } else await page.waitForTimeout(25);
    }
  },
};

async function playOne(id, phone, label) {
  report[id] ??= { rewards: [] };
  const { context, page } = await open(id, phone);
  await shot(page, `${id}-${label}-start`);
  await page.locator(".dex__play").click();
  await page.waitForTimeout(400);
  await frames(page, true);
  const box = await stageBox(page);
  const bot = BOTS[id];
  if (bot) await bot(page, box, 9, "early");
  await shot(page, `${id}-${label}-playing`);
  const early = await frames(page);
  if (bot) await bot(page, box, Number(process.env.VERIFY_SECONDS ?? 40));
  const late = await frames(page);
  await shot(page, `${id}-${label}-late`);
  const now = await phase(page);
  if (now === "playing") {
    await page.locator(".dex__tool[aria-label=pause]").click();
    await shot(page, `${id}-${label}-paused`);
  }
  if (now === "over") await shot(page, `${id}-${label}-over`);
  report[id][label] = { early, late, phase: now, state: summarise(await state(page)) };
  await context.close();
}

function summarise(s) {
  if (!s) return null;
  const out = {};
  for (const [key, value] of Object.entries(s)) if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  return out;
}

try {
  for (const id of games) {
    await playOne(id, devices["iPhone 11"], "iphone11");
    if (narrow) await playOne(id, { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } }, "375");
  }
} finally {
  await browser.close();
}
await writeFile(`${OUT}report.json`, JSON.stringify({ report, errors }, null, 2));
console.log(JSON.stringify({ report, errors }, null, 2));
