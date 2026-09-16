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
    // Poses can be brief, so record every change rather than sampling and hoping to catch one.
    await page.evaluate(() => {
      window.__poses = new Set();
      window.__tasks = new Set();
      const mascot = document.querySelector(".companion .mascot");
      const root = document.querySelector(".companion");
      if (!mascot || !root) return;
      window.__poses.add(mascot.dataset.pose);
      window.__tasks.add(root.dataset.activity);
      new MutationObserver(() => window.__poses.add(mascot.dataset.pose)).observe(mascot, {
        attributes: true,
        attributeFilter: ["data-pose"],
      });
      new MutationObserver(() => window.__tasks.add(root.dataset.activity)).observe(root, {
        attributes: true,
        attributeFilter: ["data-activity"],
      });
    });

    // She starts on her shelf — the nav bar — and works there.
    assert.equal(
      await page.locator(".companion").getAttribute("data-rail"),
      "ledge",
      `${label}: her shelf is the nav bar`,
    );
    // She settles into her own work, with a workbench drawn around her, and moves between places.
    await page.locator(".companion__scene .scene").waitFor({ timeout: 40000 });
    const seen = [await figure.evaluate((el) => el.getBoundingClientRect().left)];
    const spread = () => Math.max(...seen) - Math.min(...seen);
    const taskCount = async () => (await page.evaluate(() => [...(window.__tasks ?? [])])).length;
    for (let i = 0; i < 34 && !((await taskCount()) >= 3 && spread() > 40); i++) {
      await page.waitForTimeout(1500);
      const left = await page.evaluate(
        () => document.querySelector(".companion__figure")?.getBoundingClientRect().left ?? null,
      );
      if (left !== null) seen.push(left);
    }
    const tasks = await page.evaluate(() => [...(window.__tasks ?? [])]);
    // 3 because "walk" is itself one of them: she must actually settle into two pieces of work.
    assert.ok(tasks.length >= 3, `${label}: expected her work to change, saw ${tasks.join(", ") || "none"}`);
    assert.ok(
      spread() > 40,
      `${label}: expected her to walk; positions stayed within ${Math.round(spread())}px (${seen.map(Math.round).join(",")})`,
    );
    const poses = await page.evaluate(() => [...(window.__poses ?? [])]);
    assert.ok(poses.includes("walk"), `${label}: she should use a walk cycle, saw poses ${poses.join(", ")}`);
    checks.push(
      `✓ ${label}: works at her bench (${tasks.length - 1} tasks), strides, and covers ${Math.round(spread())}px`,
    );

    // Passive talk is to herself; an interruption is addressed to Kiriya.
    const settled = async () => {
      await page.waitForFunction(
        () => document.querySelector(".companion .mascot")?.dataset.pose !== "walk",
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(250);
    };
    // Settled AND stationary: her box must stop moving before we can aim at her.
    const stationary = async () => {
      await settled();
      let last = null;
      for (let i = 0; i < 40; i++) {
        const now = await figure.evaluate((el) => el.getBoundingClientRect().left);
        if (last !== null && Math.abs(now - last) < 0.5) return;
        last = now;
        await page.waitForTimeout(250);
      }
    };
    await settled();
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
      await settled();
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

    // Picked up like a kitten: she hangs from the scruff, objects, then lands and carries on.
    await stationary();
    const grip = await page.locator(".companion .mascot").boundingBox();
    const gx = grip.x + grip.width / 2;
    const gy = grip.y + grip.height / 2;
    // A touch device has to be carried with real touch events; synthetic mouse is ignored there.
    const touch = width < 500;
    const cdp = touch ? await context.newCDPSession(page) : null;
    const finger = async (type, px, py) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py, radiusX: 8, radiusY: 8, force: 1 }],
      });
    const grab = async () => {
      if (!touch) {
        await page.mouse.move(gx, gy);
        await page.mouse.down();
        return;
      }
      await finger("touchStart", gx, gy);
    };
    const carryTo = async (px, py, steps) => {
      if (!touch) return page.mouse.move(px, py, { steps });
      for (let i = 1; i <= steps; i++)
        await finger("touchMove", gx + ((px - gx) * i) / steps, gy + ((py - gy) * i) / steps);
    };
    const release = async () => (touch ? finger("touchEnd", 0, 0) : page.mouse.up());
    await grab();
    // Clear Motion's drag threshold first, then carry her.
    await carryTo(gx + 14, gy - 10, 3);
    await carryTo(gx + 120, gy - 60, 14);
    // Motion starts the drag on its own schedule; wait for her to notice rather than guessing.
    await page
      .waitForFunction(() => document.querySelector(".companion")?.hasAttribute("data-held"), null, {
        timeout: 5000,
      })
      .catch(() => {});
    await page.waitForTimeout(300);
    const carried = await page.evaluate(() => ({
      held: document.querySelector(".companion")?.hasAttribute("data-held"),
      pose: document.querySelector(".companion .mascot")?.dataset.pose,
      text: document.querySelector(".companion__bubble")?.textContent?.trim() ?? "",
    }));
    assert.equal(carried.held, true, `${label}: she should know she is being carried`);
    assert.equal(carried.pose, "held", `${label}: carried pose was ${carried.pose}`);
    assert.ok(carried.text.length > 0, `${label}: she should have something to say about it`);
    const movedTo = await figure.evaluate((el) => el.getBoundingClientRect().left);
    await release();
    // She settles onto whichever shelf she was dropped nearest, then gets back to work.
    await page.waitForTimeout(2600);
    const after = await page.evaluate(() => ({
      held: document.querySelector(".companion")?.hasAttribute("data-held"),
      pose: document.querySelector(".companion .mascot")?.dataset.pose,
      rail: document.querySelector(".companion")?.dataset.rail,
      left: document.querySelector(".companion__figure")?.getBoundingClientRect().left,
    }));
    assert.equal(after.held, false, `${label}: she should be put down again`);
    assert.ok(["sit", "stand", "walk"].includes(after.pose), `${label}: after landing pose was ${after.pose}`);
    assert.ok(Math.abs(after.left - movedTo) < 140, `${label}: she should stay near where she was put down`);
    checks.push(`✓ ${label}: picks up by the scruff, complains, lands on the ${after.rail} and resumes`);

    assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
    await context.close();
  }

  // Quiet mode: she stops moving but stays present and answerable.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const { page, errors } = await open(context, base);
  await page.evaluate(() => {
    window.__tasks = new Set();
    const root = document.querySelector(".companion");
    if (!root) return;
    window.__tasks.add(root.dataset.activity);
    new MutationObserver(() => window.__tasks.add(root.dataset.activity)).observe(root, {
      attributes: true,
      attributeFilter: ["data-activity"],
    });
  });
  const before = await page.locator(".companion__figure").evaluate((el) => el.getBoundingClientRect().left);
  // She must not travel, but she must still be alive: less motion is not the same as a statue.
  const quietTask = async () => (await page.evaluate(() => [...(window.__tasks ?? [])])).length;
  for (let i = 0; i < 30 && (await quietTask()) < 2; i++) await page.waitForTimeout(1500);
  const quietTasks = await page.evaluate(() => [...(window.__tasks ?? [])]);
  const after = await page.locator(".companion__figure").evaluate((el) => el.getBoundingClientRect().left);
  assert.equal(before, after, "reduced motion: she should stay where she is");
  assert.ok(
    quietTasks.length >= 2,
    `reduced motion: she should still change task, saw ${quietTasks.join(", ") || "none"}`,
  );
  await page.locator(".companion .mascot").click();
  await page.waitForTimeout(600);
  assert.ok(
    (await page.locator(".companion__bubble").textContent()).trim().length > 0,
    "reduced motion: she still answers when spoken to",
  );
  assert.deepEqual(errors, [], `reduced motion: page errors ${errors.join(" | ")}`);
  checks.push(`✓ reduced motion: stays put but keeps working (${quietTasks.length} tasks) and still answers`);
  await context.close();
} finally {
  await browser?.close();
  await server?.close();
}
for (const c of checks) console.log(c);
console.log(`\n${checks.length} companion checks passed.`);
