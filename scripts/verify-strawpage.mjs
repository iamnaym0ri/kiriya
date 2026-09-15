import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../docs/redesign/screenshots/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const checks = [],
  errors = [],
  cleanup = [];
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const page = await phone.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => errors.push(e.message));
const api = (ctx, path, method = "GET", data) =>
  ctx.request.fetch(BASE + "/api" + path, {
    method,
    headers: { "x-kw": "1" },
    ...(data ? { data } : {}),
  });
const unlock = (ctx) =>
  api(ctx, "/session/unlock", "POST", { passphrase: "kiriya" });
const ready = async (p) => {
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
};
const shot = async (p, name, fullPage = false) => {
  await ready(p);
  await p.screenshot({
    path: OUT + name + ".png",
    fullPage,
    animations: "disabled",
  });
};
const ink = async (canvas) =>
  canvas.evaluate((el) => {
    const a = el.getContext("2d").getImageData(0, 0, el.width, el.height).data;
    for (let i = 3; i < a.length; i += 4) if (a[i]) return true;
    return false;
  });
async function touchDraw(canvas) {
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  const cdp = await phone.newCDPSession(page);
  const point = (t) => ({
    x: b.x + b.width * (0.18 + t * 0.58),
    y: b.y + b.height * (0.2 + t * 0.28),
    radiusX: 2,
    radiusY: 2,
    force: 0.5,
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(0)],
  });
  for (let i = 1; i <= 12; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(i / 12)],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
try {
  assert.equal((await api(phone, "/me/curation?kind=maomao")).status(), 401);
  await page.goto(BASE);
  await page.getByRole("heading", { name: "kiriya", exact: true }).waitFor();
  await ready(page);
  assert.equal(await page.locator("iframe,audio").count(), 0);
  assert(await page.locator(".identity-mobile-portrait").isVisible());
  assert(
    (await page.locator(".identity-mobile-portrait").boundingBox()).y < 450,
  );
  assert(
    (await page.locator(".identity-mobile-portrait").boundingBox()).height <
      350,
    "The phone portrait should keep its intended crop.",
  );
  await shot(page, "strawpage-phone-public", true);
  await unlock(phone);
  await page.goto(BASE + "/world");
  await page.locator(".birthday-love-note").waitFor();
  await ready(page);
  const portrait = await page.locator(".home-portrait").boundingBox();
  assert(
    portrait.y + portrait.height < 844,
    "Phone opening should show the complete main portrait.",
  );
  assert(
    await page
      .getByRole("button", { name: "Reduced motion is on" })
      .isDisabled(),
  );
  await shot(page, "strawpage-phone-home");
  checks.push(
    "Phone first: full birthday portrait is visible in the opening; public profile, silent music entrance and reduced-motion controls work.",
  );
  assert.equal((await api(phone, "/me/curation?kind=__proto__")).status(), 404);
  for (const kind of ["maomao", "miku"]) {
    const { slides } = await (
      await api(phone, "/me/curation?kind=" + kind)
    ).json();
    assert.equal(slides.length, 5);
    assert(
      slides.every(
        (s) =>
          s.source.startsWith("https://") && s.image.url.startsWith("/images/"),
      ),
    );
  }
  checks.push(
    "Both five-slide collections require authentication, have source links and use local pictures; invalid collection names are rejected.",
  );
  await page.locator("#play-desk").scrollIntoViewIfNeeded();
  const doodle = page.getByRole("img", {
    name: "Birthday doodle canvas",
    exact: true,
  });
  await doodle.waitFor();
  await touchDraw(doodle);
  assert(await ink(doodle));
  await page
    .locator(".mini-sketchbook")
    .getByRole("button", { name: "Undo", exact: false })
    .click();
  assert(
    await page
      .getByRole("button", { name: "Keep this doodle ♡", exact: true })
      .isDisabled(),
  );
  await touchDraw(doodle);
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/me/artworks") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Keep this doodle ♡", exact: true })
    .click();
  const drawing = await (await saved).json();
  assert(drawing.id);
  assert.equal(drawing.width, drawing.height);
  cleanup.push(() => api(phone, "/me/artworks/" + drawing.id, "DELETE"));
  await page
    .getByRole("button", { name: "Kept in your gallery ♡", exact: true })
    .waitFor();
  assert.equal((await fetch(BASE + drawing.url)).status, 401);
  await shot(page, "strawpage-phone-doodle");
  await touchDraw(doodle);
  await page.getByRole("link", { name: "Letters", exact: true }).click();
  await page.getByRole("link", { name: "Kiriya’s home", exact: true }).click();
  await page.locator("#play-desk").scrollIntoViewIfNeeded();
  await doodle.waitFor();
  assert(await ink(doodle));
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "A fresh page" }).click();
  assert(await page.getByRole("button", { name: "Keep this doodle ♡", exact: true }).isDisabled());
  checks.push("Native touch drawing, undo, square PNG save, private gallery and unified draft retention work; starting over confirms unsaved ink.");
  const game = page.locator("#palette-party");
  await game.scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    document.querySelector("#palette-party").scrollIntoView({ block: "start" }),
  );
  await shot(page, "strawpage-phone-game");
  const slider = game.getByRole("slider");
  for (let i = 0; i < 3; i++) {
    await slider.press("Home");
    await game.getByRole("button", { name: "How close am I?" }).click();
    assert.match(await game.locator(".palette-verdict").innerText(), /\d+% match\./);
    await game.getByRole("button", { name: "How close am I?" }).click();
    await game.getByRole("button", { name: "A little hint?" }).click();
    await game.getByRole("button", { name: "Show the exact mix" }).click();
    const target = Number((await game.locator(".palette-clue").innerText()).match(/Try (\d+)%/)[1]);
    await slider.press(target > 50 ? "End" : "Home");
    for (let n = 0; n < (target > 50 ? 100 - target : target); n++)
      await slider.press(target > 50 ? "ArrowLeft" : "ArrowRight");
    await game.getByRole("button", { name: "How close am I?" }).click();
    await game.getByText("100% match.", { exact: false }).waitFor();
    await game
      .getByRole("button", {
        name: i === 2 ? "Keep my birthday palette" : "Next little colour",
        exact: false,
      })
      .click();
  }
  await game.getByRole("heading", { name: "Your birthday palette!" }).waitFor();
  const palette = await game
    .locator(".won-palette span")
    .evaluateAll((es) => es.map((e) => e.title));
  assert.equal(palette.length, 3);
  await shot(page, "strawpage-phone-game-complete");
  await game
    .getByRole("link", { name: "Use these in lets doodle<3", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "lets doodle<3" })
    .waitFor();
  for (const colour of palette)
    assert.equal(
      await page.getByRole("button", { name: `Paint in ${colour}`, exact: true }).count(),
      1,
    );
  assert.equal(
    await page
      .getByRole("button", { name: `Paint in ${palette[0]}`, exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  checks.push(
    "The colour game handles a miss, all three matches, its birthday reward and a working palette handoff to the sketchbook using keyboard controls.",
  );
  await page.goto(BASE + "/world/apothecary");
  const mao = page.getByRole("region", {
    name: "Maomao picture & lore collection",
  });
  await mao.locator(".lore-slide").waitFor();
  const titles = [];
  for (let n = 0; n < 5; n++) {
    titles.push(await mao.locator("h3").textContent());
    assert.equal(await mao.locator(".lore-slide").count(), 1);
    await mao
      .getByRole("button", { name: "Next Maomao slide", exact: true })
      .click();
  }
  assert.equal(new Set(titles).size, 5);
  await mao
    .getByRole("button", { name: "Enlarge Maomao illustration" })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page.goto(BASE + "/world/stage");
  const miku = page.getByRole("region", {
    name: "Miku picture & lore collection",
  });
  await miku.locator(".lore-slide").waitFor();
  await miku.getByRole("button", { name: "Next Miku slide" }).click();
  await miku.getByRole("button", { name: "Next Miku slide" }).click();
  await miku.getByRole("button", { name: "Listen to Crystal Snow" }).click();
  await page.locator(".listening-room iframe").waitFor();
  assert.equal(await page.locator("iframe").count(), 1);
  assert(
    (await page.locator("iframe").getAttribute("src")).includes("QcHZdiVD0Ww"),
  );
  await page
    .getByRole("button", { name: "Close music player and stop playback" })
    .click();
  checks.push(
    "Maomao picture/lore pagination and enlarged viewing work; Miku’s song story opens the correct single player on explicit play.",
  );
  // Public date and portrait fixtures alter responses only; they never change saved profile data.
  await page.route("**/api/public/profile", async (route) => {
    const r = await route.fetch();
    const data = await r.json();
    data.avatarUrl = "/__qa/portrait.svg";
    data.birthday = { ...data.birthday, isBirthday: true };
    await route.fulfill({ json: data });
  });
  await page.route("**/__qa/portrait.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="600"><rect width="500" height="600" fill="#edddeb"/><text x="250" y="300" text-anchor="middle" fill="#684d7b" font-size="24">PORTRAIT TEST FIXTURE</text></svg>',
    }),
  );
  await page.goto(BASE);
  await page.locator(".identity-mobile-portrait img").waitFor();
  assert(
    (
      await page.locator(".identity-mobile-portrait img").getAttribute("src")
    ).includes("/__qa/"),
  );
  await page.goto(BASE + "/world");
  await page.locator(".home-portrait .celebration-portrait").waitFor();
  assert(
    (
      await page
        .locator(".home-portrait .celebration-portrait")
        .getAttribute("src")
    ).includes("/__qa/"),
  );
  await page.unroute("**/api/public/profile");
  await page.unroute("**/__qa/portrait.svg");
  checks.push(
    "A supplied owner portrait becomes the main public and private birthday image; this was verified with an isolated fixture, without replacing real profile data.",
  );
  // Motion is checked in a separate mouse context with a controllable browser clock.
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  const d = await desktop.newPage();
  d.on("pageerror", (e) => errors.push(e.message));
  await unlock(desktop);
  await d.clock.install();
  await d.goto(BASE + "/world");
  await d.locator(".home-portrait").waitFor();
  await d.waitForFunction(
    () => document.documentElement.dataset.littleMotion === "on",
  );
  await d.mouse.move(500, 300);
  await d.mouse.move(560, 340, { steps: 6 });
  await d.clock.runFor(80);
  assert(await ink(d.locator(".cursor-sparkles")));
  await d.clock.fastForward(1000);
  assert.equal(await ink(d.locator(".cursor-sparkles")), false);
  await d
    .getByRole("button", { name: "Poke the apothecary", exact: true })
    .click();
  await d
    .getByText("Birthday rule: cake before chores.", { exact: false })
    .waitFor();
  const carousel = d.getByRole("region", {
    name: "Maomao picture & lore collection",
  });
  await carousel.scrollIntoViewIfNeeded();
  await d.mouse.move(3, 3);
  await d.waitForFunction(
    () =>
      document.querySelector(".lore-carousel--maomao").dataset.inView === "yes",
  );
  const title = () => carousel.locator("h3").textContent();
  let before = await title();
  await d.clock.fastForward(17000);
  assert.notEqual(await title(), before);
  await carousel.hover();
  before = await title();
  await d.clock.fastForward(17000);
  assert.equal(await title(), before);
  await d.mouse.move(3, 3);
  await d.clock.fastForward(17000);
  assert.notEqual(await title(), before);
  await carousel.getByRole("button", { name: "Next Maomao slide" }).focus();
  before = await title();
  await d.mouse.move(3, 3);
  await d.clock.fastForward(17000);
  assert.equal(await title(), before);
  await carousel
    .getByRole("button", { name: "Start Maomao slideshow" })
    .click();
  await d.mouse.move(3, 3);
  await d.clock.fastForward(17000);
  assert.notEqual(await title(), before);
  await d.evaluate(() => window.scrollTo(0, 0));
  await d.waitForFunction(
    () =>
      document.querySelector(".lore-carousel--maomao").dataset.inView === "no",
  );
  before = await title();
  await d.clock.fastForward(17000);
  assert.equal(await title(), before);
  await d.getByRole("button", { name: "Pause little animations" }).click();
  assert.equal(
    await d.locator("html").getAttribute("data-little-motion"),
    "off",
  );
  await d.goto(BASE + "/world/apothecary");
  await d.locator(".lore-slide").waitFor();
  assert.equal(
    await d.locator("html").getAttribute("data-little-motion"),
    "off",
  );
  assert.equal(
    await d.locator(".lore-slide").evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  await d.getByRole("button", { name: "Resume little animations" }).click();
  assert.equal(
    await d.locator("html").getAttribute("data-little-motion"),
    "on",
  );
  checks.push(
    "Cursor sparkles render and expire; Maomao reacts to touch/click. Slides rotate in view, pause on hover, stop on keyboard focus, restart explicitly and stop offscreen. The global pause persists and keeps slides visible after navigation.",
  );
  assert.deepEqual(errors, []);
  checks.push("No uncaught application errors in the phone or motion checks.");
  console.log(checks.join("\n"));
} finally {
  for (const fn of cleanup.reverse()) await fn();
  await writeFile(
    new URL("../docs/redesign/strawpage-checks.json", import.meta.url),
    JSON.stringify({ checks, errors }, null, 2) + "\n",
  );
  await browser.close();
}
