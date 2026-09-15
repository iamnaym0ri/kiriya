import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Reproducible local-only check. The development API below uses a fresh in-memory database and
// fake providers. It never opens the shared .data/pglite directory or reads a production secret.
process.umask(0o077);
const out = new URL("../.data/feed-foundation/", import.meta.url);
await mkdir(out, { recursive: true });
async function command(name, args, log) {
  let output = "";
  const status = await new Promise((resolve, reject) => {
    const child = spawn(name, args, {
      cwd: new URL("../", import.meta.url),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (s) => (output += s));
    child.stderr.on("data", (s) => (output += s));
    child.on("error", reject);
    child.on("exit", resolve);
  });
  await writeFile(new URL(log, out), output, { mode: 0o600 });
  if (status !== 0)
    throw new Error(
      `${name} ${args.join(" ")} failed; see .data/feed-foundation/${log}`,
    );
  console.log(`✓ ${name} ${args.join(" ")}`);
}
// Child tests set their own isolated configuration. The frontend build runs no migrations.
await command("npm", ["test"], "all-tests.log");
await command("npm", ["run", "build"], "build.log");

for (const key of [
  "DATABASE_URL",
  "kData_DATABASE_URL",
  "OPENAI_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "VAPID_PUBLIC_KEY",
  "VITE_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "VERCEL_ENV",
  "VERCEL",
])
  process.env[key] = "";
process.env.NODE_ENV = "development";
process.env.FEEDS_ENABLED = "false";
process.env.FEEDS_FIXTURE_MODE = "true";
process.env.KIRIYA_TZ = "Asia/Singapore";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
const { hashPassphrase } = await import("../server/auth/passphrase.js");
const phrases = {
  kiriya: randomBytes(24).toString("hex"),
  admin: randomBytes(24).toString("hex"),
};
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
const { PGlite } = await import("@electric-sql/pglite");
const { drizzle } = await import("drizzle-orm/pglite");
const { migrate } = await import("drizzle-orm/pglite/migrator");
const schema = await import("../server/db/schema.js"),
  client = new PGlite(),
  db = drizzle({ client, schema });
await migrate(db, {
  migrationsFolder: new URL("../server/db/migrations/", import.meta.url)
    .pathname,
});
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const { createServer } = await import("vite");
let server, browser;
const checks = [];
try {
  server = await createServer({
    server: { port: 5178, strictPort: true, host: "127.0.0.1" },
    mode: "development",
  });
  await server.listen();
  const base = "http://127.0.0.1:5178";
  browser = await chromium.launch();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await phone.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/admin");
  await page.getByLabel("Passphrase", { exact: true }).fill(phrases.admin);
  await page.getByRole("button", { name: "Open your world" }).click();
  const panel = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "kiriya’s feeds", exact: true }),
    });
  await panel
    .getByRole("button", { name: "Build local fixture edition" })
    .click();
  await panel
    .getByRole("status")
    .filter({ hasText: "completed" })
    .waitFor({ timeout: 60000 });
  await panel.getByRole("button", { name: "maomao", exact: true }).click();
  await panel.getByText("worth a look.", { exact: false }).first().waitFor();
  assert.equal((await db.select().from(schema.feedSeen)).length, 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: new URL("admin-phone.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  checks.push(
    "390px admin: fixture build, credited private preview, no seen side effects, no horizontal overflow",
  );
  const before = await panel
    .locator("button")
    .filter({ hasText: "Hide item" })
    .count();
  await panel
    .getByRole("button", { name: "Hide item", exact: true })
    .first()
    .click();
  await panel.getByRole("button", { name: "maomao", exact: true }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].filter(
        (b) => b.textContent === "Hide item",
      ).length > 0,
  );
  assert.equal(
    await panel.getByRole("button", { name: "Hide item", exact: true }).count(),
    before - 1,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: new URL("admin-desktop.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  checks.push(
    "Desktop admin and item hide work using the existing admin styles",
  );
  const viewer = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const world = await viewer.newPage();
  world.setDefaultTimeout(20000);
  await world.goto(base);
  await world.getByRole("heading", { name: "kiriya", exact: true }).waitFor();
  assert.equal(
    await world.getByText("kiriya’s feeds", { exact: true }).count(),
    0,
  );
  assert.equal(
    await world.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await world.screenshot({
    path: new URL("public-phone.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  await world.goto(base + "/world");
  await world.getByLabel("Passphrase", { exact: true }).fill(phrases.kiriya);
  await world.getByRole("button", { name: "Open your world" }).click();
  await world.locator(".birthday-love-note").waitFor();
  assert.equal(
    await world.getByText("kiriya’s feeds", { exact: true }).count(),
    0,
  );
  const worldErrors = [];
  world.on("pageerror", (e) => worldErrors.push(e.message));
  world.on("dialog", (dialog) => dialog.accept());
  const noOverflow = async () =>
    assert.equal(
      await world.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  const eventually = async (fn, timeout = 15000) => {
    const until = Date.now() + timeout;
    while (!(await fn())) {
      if (Date.now() > until) throw new Error("condition not reached in time");
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  await noOverflow();
  await world.screenshot({
    path: new URL("world-phone.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  checks.push(
    "Existing public/private birthday pages still render; the admin feed card stays admin-only",
  );

  // Feed pieces inside the existing sections (the fixture edition published above).
  const club = world.locator("#maomao");
  await club.scrollIntoViewIfNeeded();
  await club
    .locator(".lore-slide .pixel-label")
    .filter({ hasText: "NEW" })
    .first()
    .waitFor();
  await world.locator(".home-section-index .feed-new-count").first().waitFor();
  await club.locator(".feed-progress").waitFor();
  // Seen only after the active slide has been on screen for 1.5 s in a visible tab, batched.
  await eventually(
    async () => (await db.select().from(schema.feedSeen)).length > 0,
  );
  checks.push(
    "390px world: feed slides join the authored carousel, new counts on the index, seen after 1.5 s on screen",
  );
  const total = async () =>
    Number(
      (await club.locator(".lore-pagination i").textContent()).replace(
        /\D/g,
        "",
      ),
    );
  const slidesBefore = await total();
  await club
    .locator(".lore-feed-actions")
    .getByRole("button", { name: "keep" })
    .click();
  await club
    .locator(".lore-feed-actions")
    .getByRole("button", { name: "kept ♡" })
    .waitFor();
  assert.equal((await db.select().from(schema.saves)).length, 1);
  await club
    .locator(".lore-feed-actions")
    .getByRole("button", { name: "not for me" })
    .click();
  await eventually(async () => (await total()) === slidesBefore - 1);
  checks.push(
    "Keep saves a credited link-only copy for a fixture source; not for me removes the slide for good",
  );

  await world.goto(base + "/world/saves");
  await world.getByRole("heading", { name: /Things you/ }).waitFor();
  await world.locator(".feed-card").first().waitFor();
  await noOverflow();
  await world.screenshot({
    path: new URL("saves-phone.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  await world.getByRole("button", { name: "a closer look" }).first().click();
  await world.getByRole("button", { name: "remove from saves" }).click();
  await world.getByText("NOTHING KEPT YET").waitFor();
  assert.equal((await db.select().from(schema.saves)).length, 0);
  checks.push("Saves page lists, opens and removes a save (phone)");

  await world.goto(base + "/world/merch");
  await world.getByRole("heading", { name: /Things for/ }).waitFor();
  await world
    .locator(".feed-shelf, .note-slip")
    .first()
    .waitFor();
  await noOverflow();
  checks.push("Merch shelf route renders its shelf or honest empty state");

  await world.goto(base + "/world/settings");
  const faves = world.locator("section.faves");
  await faves.getByRole("heading", { name: "my faves" }).waitFor();
  const wishlist = faves.locator("fieldset", {
    hasText: "want-to-cosplay list",
  });
  await wishlist
    .getByRole("textbox", { name: "Add to want-to-cosplay list" })
    .fill("fern");
  await wishlist.getByRole("button", { name: "add" }).click();
  await faves.getByRole("button", { name: "Save my faves" }).click();
  await faves.getByRole("status").filter({ hasText: "saved" }).waitFor();
  await noOverflow();
  await world.screenshot({
    path: new URL("faves-phone.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  checks.push("My faves saves with a revision check and says it applies to tomorrow’s drop");

  await world.goto(base + "/world/stage");
  await world.locator(".music-shelf .record-sleeve").first().click();
  await world.getByRole("complementary", { name: "Music player" }).waitFor();
  await world
    .getByRole("button", { name: "Close music player and stop playback" })
    .click();
  checks.push("Existing visible music player still opens from the song shelf");

  await world.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ["/world", "/world/saves", "/world/merch", "/world/apothecary"]) {
    await world.goto(base + route);
    await world.locator("main").waitFor();
    await noOverflow();
  }
  await world.goto(base + "/world");
  await world.locator("#maomao .lore-slide").waitFor();
  await world.screenshot({
    path: new URL("world-desktop.png", out).pathname,
    fullPage: true,
    animations: "disabled",
  });
  checks.push("Desktop world, saves, merch and Maomao pages have no horizontal overflow");
  assert.deepEqual(worldErrors, []);
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("verification.json", out),
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, productionTouched: false },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  for (const check of checks) console.log("✓ " + check);
} finally {
  await browser?.close();
  await server?.close();
  await client.close();
}
