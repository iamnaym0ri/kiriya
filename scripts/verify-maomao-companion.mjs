// Companion check: she lives in the world, works at her bench, walks, and engages when interrupted.
// Isolated in-process dev server + PGlite, generated passphrases, no network and no real credentials.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const k of ["DATABASE_URL", "kData_DATABASE_URL", "OPENAI_API_KEY", "VERCEL", "VERCEL_ENV"])
  delete process.env[k];
const phrases = { kiriya: randomBytes(24).toString("hex"), admin: randomBytes(24).toString("hex") };
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
const { PGlite } = await import("@electric-sql/pglite");
const { drizzle } = await import("drizzle-orm/pglite");
const { migrate } = await import("drizzle-orm/pglite/migrator");
const schema = await import("../server/db/schema.js");
const client = new PGlite(),
  db = drizzle({ client, schema });
await migrate(db, {
  migrationsFolder: new URL("../server/db/migrations/", import.meta.url).pathname,
});
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });

const { createServer } = await import("vite");
const checks = [];
let server, browser;

const open = async (context, base) => {
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 160)));
  await page.goto(base + "/world");
  await page.getByLabel("Passphrase", { exact: true }).fill(phrases.kiriya);
  await page.getByRole("button", { name: "Open your world" }).click();
  await page.locator(".companion__figure").waitFor();
  return { page, errors };
};

try {
  server = await createServer({
    server: { port: 5179, strictPort: true, host: "127.0.0.1" },
    mode: "development",
  });
  await server.listen();
  const base = "http://127.0.0.1:5179";
  browser = await chromium.launch();

  for (const [label, width, height] of [
    ["phone", 390, 844],
    ["tablet", 820, 1180],
    ["desktop", 1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const { page, errors } = await open(context, base);
    const figure = page.locator(".companion__figure");

    // She settles into her own work, with a workbench drawn around her, and moves between places.
    await page.locator(".companion__scene .scene").waitFor({ timeout: 40000 });
    const scenes = new Set();
    const seen = [await figure.evaluate((el) => el.getBoundingClientRect().left)];
    const spread = () => Math.max(...seen) - Math.min(...seen);
    for (let i = 0; i < 24 && !(scenes.size >= 2 && spread() > 40); i++) {
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => ({
        scene: document.querySelector(".companion__scene .scene")?.getAttribute("class") ?? null,
        left: document.querySelector(".companion__figure")?.getBoundingClientRect().left ?? null,
      }));
      if (state.scene) scenes.add(state.scene);
      if (state.left !== null) seen.push(state.left);
    }
    assert.ok(scenes.size >= 2, `${label}: expected her activity to change, saw ${[...scenes].join(", ") || "none"}`);
    assert.ok(
      spread() > 40,
      `${label}: expected her to walk; positions stayed within ${Math.round(spread())}px (${seen.map(Math.round).join(",")})`,
    );
    checks.push(
      `✓ ${label}: works at her bench (${scenes.size} activities) and walks ${Math.round(spread())}px across the world`,
    );

    // Passive talk is to herself; an interruption is addressed to Kiriya.
    await page.locator(".companion .mascot").click();
    await page.waitForTimeout(900);
    const engaged = await page.evaluate(() => ({
      text: document.querySelector(".companion__bubble")?.textContent?.trim() ?? "",
      aside: document.querySelector(".companion__bubble")?.hasAttribute("data-aside"),
      tray: [...document.querySelectorAll(".companion__tray button")].map((b) => b.textContent.trim()),
    }));
    assert.ok(engaged.text.length > 0, `${label}: a poke should get an answer`);
    assert.equal(engaged.aside, false, `${label}: an answer to Kiriya is not an aside`);
    for (const offer of ["show her an herb", "a curious vial", "ask her something"])
      assert.ok(engaged.tray.includes(offer), `${label}: tray missing "${offer}" (saw ${engaged.tray.join(" / ")})`);
    checks.push(`✓ ${label}: interrupting her engages Kiriya directly and opens the tray`);

    // Keep poking: she should not repeat herself.
    const said = new Set([engaged.text]);
    for (let i = 0; i < 6; i++) {
      await page.locator(".companion .mascot").click();
      await page.waitForTimeout(420);
      said.add((await page.locator(".companion__bubble").textContent()).trim());
    }
    assert.ok(said.size >= 6, `${label}: repeated pokes should keep saying new things, got ${said.size}`);
    checks.push(`✓ ${label}: ${said.size} different answers from seven pokes`);

    // The direct offers land, and she never covers or blocks the page.
    await page.getByRole("button", { name: "show her an herb" }).click();
    await page.waitForTimeout(700);
    const layout = await page.evaluate(() => ({
      expression: document.querySelector(".companion .mascot")?.dataset.expression,
      overflow: document.documentElement.scrollWidth <= window.innerWidth,
      layer: getComputedStyle(document.querySelector(".companion")).pointerEvents,
    }));
    assert.ok(layout.expression, `${label}: she should hold an expression after an offer`);
    assert.ok(layout.overflow, `${label}: the companion must not cause horizontal overflow`);
    assert.equal(layout.layer, "none", `${label}: her layer must not swallow taps meant for the page`);
    checks.push(`✓ ${label}: offers land, no overflow, the page stays clickable through her layer`);

    assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
    await context.close();
  }

  // Quiet mode: she stops moving but stays present and answerable.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const { page, errors } = await open(context, base);
  const before = await page.locator(".companion__figure").evaluate((el) => el.getBoundingClientRect().left);
  await page.waitForTimeout(6000);
  const after = await page.locator(".companion__figure").evaluate((el) => el.getBoundingClientRect().left);
  assert.equal(before, after, "reduced motion: she should stay where she is");
  await page.locator(".companion .mascot").click();
  await page.waitForTimeout(600);
  assert.ok(
    (await page.locator(".companion__bubble").textContent()).trim().length > 0,
    "reduced motion: she still answers when spoken to",
  );
  assert.deepEqual(errors, [], `reduced motion: page errors ${errors.join(" | ")}`);
  checks.push("✓ reduced motion: she stays put, still answers when spoken to");
  await context.close();
} finally {
  await browser?.close();
  await server?.close();
}
for (const c of checks) console.log(c);
console.log(`\n${checks.length} companion checks passed.`);
