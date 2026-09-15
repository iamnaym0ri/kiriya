import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../docs/redesign/screenshots/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const checks = [];
const errorDetails = [];
const cleanup = [];
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
page.on("pageerror", (e) => {
  errors.push(e.message);
  errorDetails.push({
    url: page.url(),
    stack: e.stack,
    lastCheck: checks.at(-1),
  });
  console.error("BROWSER ERROR", JSON.stringify(errorDetails.at(-1)));
});
const request = (path, method = "GET", data) =>
  context.request.fetch(BASE + "/api" + path, {
    method,
    headers: { "x-kw": "1" },
    ...(data ? { data } : {}),
  });
const shot = async (name, fullPage = false) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => {
        i.loading = "eager";
        return i.decode().catch(() => {});
      }),
    );
  });
  await page.screenshot({
    path: OUT + name + ".png",
    fullPage,
    animations: "disabled",
  });
};
try {
  await page.goto(BASE);
  await page.getByRole("heading", { name: "kiriya", exact: true }).waitFor();
  assert.equal(await page.locator("iframe,audio").count(), 0);
  checks.push(
    "Silent public entrance: no audio or provider iframe before a playback choice.",
  );
  await shot("phone-public", true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await shot("desktop-public", true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "The rest is just for Kiriya" })
    .click();
  await page.getByLabel("Passphrase", { exact: true }).fill("kiriya");
  await page
    .getByRole("button", { name: "Open your world", exact: true })
    .click();
  await page.waitForURL("**/world");
  await page.locator(".home-discovery .note-slip p").waitFor();
  checks.push("Public passphrase door opens the authenticated home.");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  const today = await (await request("/me/today")).json();
  assert.deepEqual(
    today.cards.map((c) => c.kind).filter((k) => k !== "special"),
    ["maomao", "vocaloid", "cosplay", "art"],
  );
  assert(!today.outfits);
  assert(!today.finds);
  checks.push(
    "Authenticated day payload only exposes the retained collection.",
  );
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["desktop", 1440, 1000],
    ["narrow", 320, 760],
    ["tablet", 820, 1180],
    ["landscape", 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [route, label] of [
      ["/world", "home"],
      ["/world/atelier", "cosplay"],
      ["/world/art", "art"],
      ["/world/apothecary", "maomao"],
      ["/world/stage", "music"],
      ["/world/letters", "letters"],
      ["/world/settings", "settings"],
      ["/world/studio", "canvas"],
    ]) {
      await page.goto(BASE + route);
      await page.locator("#world-main").waitFor();
      await page.locator("#world-main h1").waitFor();
      if (label === "home")
        await page.locator(".home-discovery .note-slip p").waitFor();
      if (label === "settings")
        await page.getByLabel("Profile bio (one line each, up to 6)").waitFor();
      assert.equal(await page.locator("vite-error-overlay").count(), 0);
      const over = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert(over <= 1, `${name} ${route} overflow ${over}`);
      if (["phone", "desktop"].includes(name))
        await shot(`${name}-${label}`, label !== "home" && label !== "canvas");
      if (label === "home" && name === "desktop")
        await shot("desktop-home-full", true);
    }
    checks.push(
      `${name} (${width} × ${height}): all eight private surfaces fit without horizontal overflow.`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/world");
  await page.getByRole("button", { name: "Open section menu" }).click();
  assert.equal(
    await page.getByRole("navigation", { name: "Sections" }).isVisible(),
    true,
  );
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link", { name: "doodle & play", exact: true })
    .click();
  await page.waitForURL("**/world#play-desk");
  assert.equal(await page.locator("#world-mobile-menu").count(), 0);
  checks.push("Compact phone section menu navigates and closes.");
  // Actual canvas interaction, undo/redo, local upload, gallery fetch and viewer.
  await page.goto(BASE + "/world/studio");
  const canvas = page.getByRole("img", { name: "Drawing canvas" });
  await canvas.waitFor();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, {
    steps: 15,
  });
  await page.mouse.up();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert(
    await page
      .getByRole("button", { name: "Save to gallery", exact: true })
      .isDisabled(),
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const saveResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/me/artworks") && response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save to gallery", exact: true })
    .click();
  const created = await (await saveResponse).json();
  assert(created.id);
  cleanup.push(() => request("/me/artworks/" + created.id, "DELETE"));
  await page.getByText("Kept in your sketchbook. Maomao approves. ♡").waitFor();
  const after = await (await request("/me/artworks")).json();
  assert(after.artworks.some((art) => art.id === created.id));
  const media = await request(created.url.replace("/api", ""));
  assert.equal(media.status(), 200);
  assert.equal(media.headers()["cache-control"], "private, no-store");
  const pub = await fetch(BASE + created.url);
  assert.equal(pub.status, 401);
  checks.push(
    "Drawing, undo/redo, save and authenticated media work; public media fetch is denied.",
  );
  await page.goto(BASE + "/world/art");
  await page.locator(".sketchbook-work").first().click();
  await page.locator("dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  checks.push("Saved artwork enlarges; Escape dismisses the native dialog.");
  // Upload a private cosplay image through the actual form, then enlarge it.
  const cosplaysBefore = (await (await request("/me/atelier/cosplay")).json())
    .projects;
  await page.goto(BASE + "/world/atelier");
  await page.getByRole("button", { name: "Add a cosplay photo" }).click();
  await page
    .getByLabel("Character", { exact: true })
    .fill("Verification costume");
  await page
    .getByLabel("A caption", { exact: true })
    .fill("Temporary upload check");
  await page.getByLabel("Photograph", { exact: true }).setInputFiles({
    name: "check.png",
    mimeType: "image/png",
    buffer: Buffer.from(await media.body()),
  });
  await page
    .getByRole("button", { name: "Save photograph", exact: true })
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: "Verification costume" })
    .waitFor();
  const cosplaysAfter = (await (await request("/me/atelier/cosplay")).json())
    .projects;
  const costume = cosplaysAfter.find(
    (p) => !cosplaysBefore.some((q) => q.id === p.id),
  );
  assert(costume);
  cleanup.push(() => request("/me/atelier/cosplay/" + costume.id, "DELETE"));
  assert.equal((await fetch(BASE + costume.coverUrl)).status, 401);
  await page
    .getByRole("button")
    .filter({ hasText: "Verification costume" })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  checks.push(
    "Cosplay photograph upload, private access and full-size viewing work.",
  );
  // Gallery references and spoilers.
  await page.goto(BASE + "/world/apothecary");
  await page
    .getByRole("button", { name: "Enlarge Maomao illustration" })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.keyboard.press("Escape");
  let sealed = false;
  for (let i = 0; i < 13; i++) {
    if (
      await page.getByRole("button", { name: "Reveal manga spoiler" }).count()
    ) {
      sealed = true;
      break;
    }
    await page.getByRole("button", { name: "Another little find" }).click();
  }
  assert(sealed);
  await page.getByRole("button", { name: "Reveal manga spoiler" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Reveal manga spoiler" }).count(),
    0,
  );
  checks.push("Maomao image switching and explicit manga-spoiler reveal work.");
  // Visible single player, persistence across SPA navigation, close stops playback.
  await page.goto(BASE + "/world/stage");
  await page.locator(".record-sleeve").nth(1).click();
  await page.locator(".listening-room iframe").waitFor();
  assert.equal(await page.locator("iframe").count(), 1);
  const frame = await page.locator("iframe").boundingBox();
  assert(frame.width >= 200 && frame.height >= 200);
  const src = await page.locator("iframe").getAttribute("src");
  await page.getByRole("link", { name: "Kiriya’s home", exact: true }).click();
  assert.equal(await page.locator("iframe").getAttribute("src"), src);
  await page
    .getByRole("button", { name: "Close music player and stop playback" })
    .click();
  assert.equal(await page.locator("iframe").count(), 0);
  checks.push(
    "Exactly one visible provider player, at least 200 × 200; SPA navigation preserves it, close removes it.",
  );
  // Birthday dates change the flourish, never access.
  for (const date of ["2026-09-15", "2026-09-22", "2026-11-04"]) {
    await page.route("**/api/me/today", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.day = date;
      data.birthday = {
        isBirthday: date.endsWith("09-15"),
        isBirthdayWeek: date.endsWith("09-15"),
      };
      await route.fulfill({ json: data });
    });
    await page.goto(BASE + "/world/letters");
    await page
      .getByRole("button", { name: "Blow out the candle", exact: true })
      .click();
    await page.getByText("Wish kept. Just between us.").waitFor();
    await page.getByRole("button", { name: "Make another wish" }).click();
    assert(
      await page
        .getByRole("button", { name: "Blow out the candle", exact: true })
        .isVisible(),
    );
    await page.locator(".envelope").last().click();
    await page.locator("dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.unroute("**/api/me/today");
  }
  checks.push(
    "Gift, letters and candle replay work for September 15, September 22 and November 4.",
  );
  // Recordings stay private until explicitly starred. This uses a tiny valid WAV.
  const wav = Buffer.alloc(44 + 1600);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(1600, 40);
  const stored = await (
    await context.request.post(BASE + "/api/uploads/local?folder=songs", {
      headers: { "x-kw": "1", "content-type": "audio/wav" },
      data: wav,
    })
  ).json();
  const createdSong = await (
    await request("/me/songs", "POST", {
      upload: {
        url: stored.url,
        title: "Verification recording",
        artist: "Temporary test",
      },
    })
  ).json();
  cleanup.push(() => request("/me/songs/" + createdSong.id, "DELETE"));
  assert.equal(createdSong.isPublic, false);
  assert.equal((await fetch(BASE + stored.url)).status, 401);
  const previousSongs = (await (await request("/me/songs")).json()).songs;
  const previousFeatured = previousSongs.find((s) => s.featured);
  if (previousFeatured)
    cleanup.push(() =>
      request("/me/songs/" + previousFeatured.id, "PATCH", { featured: true }),
    );
  await page.goto(BASE + "/world/stage");
  await page
    .locator(".shelf__song")
    .filter({ hasText: "Verification recording" })
    .getByRole("button", { name: "Play Verification recording", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await page.waitForFunction(
    () => document.querySelector("audio")?.duration > 0,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert(await page.locator("audio").evaluate((audio) => audio.paused));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Close music player and stop playback" })
    .click();
  assert.equal(await page.locator("audio").count(), 0);
  checks.push(
    "Uploaded recording plays, reports duration, pauses, resumes and closes without an event error.",
  );
  await page
    .locator(".shelf__song")
    .filter({ hasText: "Verification recording" })
    .getByRole("button", { name: "Put on your profile" })
    .click();
  await page
    .locator(".shelf__song")
    .filter({ hasText: "Verification recording" })
    .getByRole("button", { name: "On your profile" })
    .waitFor();
  assert.equal((await fetch(BASE + stored.url)).status, 200);
  assert.equal(
    (
      await context.request.get(BASE + stored.url, {
        headers: { range: "bytes=0-20" },
      })
    ).status(),
    206,
  );
  checks.push(
    "Recording upload is private; explicitly starring it enables public playback; byte-range responses work.",
  );
  // Lock clears private cache and player.
  await page.goto(BASE + "/world/settings");
  await page
    .getByRole("button", { name: "Lock kiriya on this device" })
    .click();
  await page.waitForURL(BASE + "/");
  assert.equal((await request("/me/letters")).status(), 401);
  checks.push("Lock returns to public view and removes private API access.");
  assert.deepEqual(errors, []);
  checks.push("No uncaught application errors.");
  console.log(checks.join("\n"));
} finally {
  await context.request.post(BASE + "/api/session/unlock", {
    headers: { "x-kw": "1" },
    data: { passphrase: "kiriya" },
  });
  for (const fn of cleanup.reverse()) await fn();
  await writeFile(
    new URL("../docs/redesign/browser-checks.json", import.meta.url),
    JSON.stringify({ checks, errors, errorDetails }, null, 2) + "\n",
  );
  await browser.close();
}
