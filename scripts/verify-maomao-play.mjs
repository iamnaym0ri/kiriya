import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { MAOMAO_REMARKS } from "../src/shared/play/maomaoDialogue.js";
import { newPaletteRounds } from "../src/world/play/palette.js";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../.data/redesign/maomao-play/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const checks = [], errors = [];
const GAME_NAMES = ["Colour club", "Memory drawer", "Odd jar", "Herb sequence", "Lantern puzzle"];
// The public page keeps the pinned buddy; inside her world Maomao roams instead
// (src/world/mascot/MaomaoCompanion.jsx, covered by `npm run verify:maomao-companion`).
const ready = async page => {
  await page.locator(".maomao-buddy, .companion__figure").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
};
async function context(options = {}, authenticated = true) {
  const ctx = await browser.newContext(options);
  await ctx.route("**/api/public/view", route => route.fulfill({ json: { views: 0 } }));
  await ctx.route(/https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ body: "<p>Provider frame fixture</p>", contentType: "text/html" }));
  if (authenticated) {
    const response = await ctx.request.post(BASE + "/api/session/unlock", {
      headers: { "x-kw": "1" }, data: { passphrase: process.env.VERIFY_PASSPHRASE ?? "kiriya" },
    });
    assert.equal(response.status(), 200);
  }
  ctx.on("page", page => {
    page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
  });
  return ctx;
}
const screenshot = (locator, name) => locator.screenshot({ path: OUT + name + ".png", animations: "disabled" });
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
try {
  const ctx = await context({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { Math.random = () => 0.4; });
  const page = await ctx.newPage();
  await page.goto(BASE + "/world");
  await ready(page);
  assert.equal((await page.locator(".home-welcome__line").innerText()).replace(/\s+/g, " "), "A world just for you full of soo much love and all ur faves (˘ ³˘)♡");
  assert.equal((await page.locator(".birthday-love-note p").innerText()).replace(/\s+/g, " "), "That u will keep being unique and speciall just like u always have been forever!!");
  assert.equal(await page.locator(".home-portrait figcaption .handwritten").innerText(), "Happy birthday miss apothecary💕");
  assert.equal(await page.locator(".birthday-forever").evaluate(el => getComputedStyle(el).animationName), "none");
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".home-portrait figcaption .handwritten" });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  assert(fonts.some(font => /Emoji/.test(font.familyName) && font.glyphCount > 0), "Caption hearts must have a rendered emoji glyph");
  await cdp.detach();
  await screenshot(page.locator(".home-opening"), "desktop-opening");
  checks.push("Exact welcome, birthday wish and caption; local colour heart glyph renders; reduced motion settles Forever.");

  await page.getByRole("tab", { name: "Memory drawer" }).click();
  const memory = page.getByRole("tabpanel", { name: "Memory drawer" });
  const cards = memory.locator(".memory-card");
  async function solveMemory(count) {
    const seen = new Map(), found = new Set();
    assert.equal(await cards.count(), count);
    const flip = async index => {
      await cards.nth(index).click();
      const symbol = (await cards.nth(index).getAttribute("aria-label")).split(", ")[1].replace("matched ", "");
      seen.set(index, symbol);
      return symbol;
    };
    let misses = 0;
    for (let turn = 0; found.size < count && turn < 40; turn++) {
      const available = Array.from({ length: count }, (_, i) => i).filter(i => !found.has(i));
      const pair = available.flatMap(i => available.filter(j => j > i && seen.has(i) && seen.get(i) === seen.get(j)).map(j => [i, j]))[0];
      const first = pair?.[0] ?? available.find(i => !seen.has(i)) ?? available[0];
      const before = await memory.locator(".game-comment").innerText();
      const symbol = await flip(first);
      assert.notEqual(await memory.locator(".game-comment").innerText(), before);
      const second = pair?.[1] ?? available.find(i => i !== first && seen.get(i) === symbol)
        ?? available.find(i => i !== first && !seen.has(i)) ?? available.find(i => i !== first);
      await flip(second);
      if (await cards.nth(first).getAttribute("data-matched") === "true") { found.add(first); found.add(second); }
      else {
        misses++;
        assert.equal(await memory.locator(".memory-card:disabled").count(), count);
        await memory.getByRole("button", { name: "Turn them over" }).click();
      }
    }
    assert.equal(found.size, count, "Every pair is solvable using observed pictures");
    assert.match(await memory.locator(".game-comment").innerText(), /Every pair accounted for/);
    return misses;
  }
  await solveMemory(8);
  await page.getByRole("tab", { name: "Odd jar" }).click();
  await page.getByRole("tab", { name: "Memory drawer" }).click();
  assert.equal(await memory.locator('.memory-card[data-matched="true"]').count(), 8);
  await memory.getByRole("button", { name: "Try six pairs" }).click();
  assert((await solveMemory(12)) > 0, "Include a mismatched pair and retry");
  await screenshot(memory, "memory-six-pairs-complete");
  await memory.getByRole("button", { name: "Back to four pairs" }).click();
  assert.equal(await cards.count(), 8);
  assert.equal(await memory.locator('.memory-card[data-revealed="true"]').count(), 0);
  checks.push("Four- and six-pair memory games complete from observed clues, handle mismatches, preserve tab state and replay.");

  await page.getByRole("tab", { name: "Odd jar" }).click();
  const jars = page.getByRole("tabpanel", { name: "Odd jar" });
  const clueKinds = new Set();
  for (let round = 0; round < 5; round++) {
    const choices = jars.locator(".jar-choice");
    const labels = await choices.evaluateAll(elements => elements.map(el => el.getAttribute("aria-label").split(", ")[1]));
    const normal = labels.find(label => labels.filter(other => other === label).length > 1);
    const odd = labels.find(label => label !== normal);
    clueKinds.add(odd);
    assert.equal(labels.length, round === 0 ? 6 : 9);
    await jars.getByRole("button", { name: new RegExp(normal) }).first().click();
    assert.equal(await jars.locator('[data-retry="true"]').count(), 1);
    await jars.getByRole("button", { name: "A little clue?" }).click();
    assert(await jars.locator(".palette-clue").isVisible());
    await jars.getByRole("button", { name: new RegExp(odd) }).click();
    assert.equal(await jars.locator('[data-found="true"]').count(), 1);
    assert.equal(await jars.locator(".jar-choice:disabled").count(), labels.length);
    if (round < 4) await jars.getByRole("button", { name: "Next little mystery" }).click();
  }
  assert.equal(clueKinds.size, 5);
  assert.match(await jars.locator(".game-comment").innerText(), /Five little mysteries settled/);
  await screenshot(jars, "odd-jar-complete");
  await jars.getByRole("button", { name: "Investigate again" }).click();
  assert.match(await jars.locator(".little-game__progress").innerText(), /1 of 5/);
  await page.getByRole("tab", { name: "Odd jar" }).focus();
  await page.keyboard.press("Home");
  assert.equal(await page.getByRole("tab", { name: "Colour club" }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Memory drawer" }).getAttribute("aria-selected"), "true");
  checks.push("Odd jar supports retries, clues, all five distinct visual mysteries and replay; tabs work with arrow/Home keys.");

  await page.getByRole("tab", { name: "Colour club" }).click();
  const palette = page.getByRole("tabpanel", { name: "Colour club" });
  for (const [index, round] of newPaletteRounds(() => .4).entries()) {
    await palette.getByRole("button", { name: "A little hint?" }).click();
    assert(!/Try \d+%/.test(await palette.locator(".palette-clue").innerText()), "First hint must not give the exact answer");
    for (let attempt = 0; attempt < 2; attempt++) {
      await palette.getByRole("slider").fill("0");
      await palette.getByRole("button", { name: "How close am I?" }).click();
    }
    await palette.getByRole("button", { name: "Show the exact mix" }).click();
    assert.match(await palette.locator(".palette-clue").innerText(), new RegExp(`Try ${round.target}%`));
    await palette.getByRole("slider").fill(String(round.target));
    await palette.getByRole("button", { name: "How close am I?" }).click();
    assert.match(await palette.locator(".palette-verdict").innerText(), /100% match/);
    await palette.getByRole("button", { name: index === 2 ? "Keep my birthday palette" : "Next little colour" }).click();
  }
  await palette.getByRole("link", { name: "Use these in lets doodle<3" }).click();
  await page.getByRole("heading", { name: "lets doodle<3" }).waitFor();
  assert(new URL(page.url()).searchParams.get("paint")?.split(",").length === 3);
  checks.push("Existing Colour Club completes all three rounds and sends its palette into the unified doodle panel beside the games.");

  await page.goto(BASE + "/world");
  await ready(page);
  await page.getByRole("tab", { name: "Herb sequence" }).click();
  const sequence = page.getByRole("tabpanel", { name: "Herb sequence" });
  for (let round = 0; round < 3; round++) {
    const pattern = await sequence.locator(".sequence-slots li").evaluateAll(items => items.map(el => el.getAttribute("aria-label").split(", ")[1]));
    assert.equal(pattern.length, 3 + round);
    await sequence.getByRole("button", { name: "Hide the note" }).click();
    assert.equal(await sequence.locator(".sequence-slots .game-symbol").count(), 0, "Hidden note must not reveal its pictures");
    if (round === 0) {
      await sequence.getByRole("button", { name: `Add ${pattern[0]}`, exact: true }).click();
      await sequence.getByRole("button", { name: "Undo last picture" }).click();
      assert.equal(await sequence.locator(".sequence-slots .game-symbol").count(), 0);
      const wrong = pattern[0] === "little bottle" ? "flower" : "little bottle";
      for (let i = 0; i < pattern.length; i++) await sequence.getByRole("button", { name: `Add ${wrong}`, exact: true }).click();
      assert(await sequence.getByRole("button", { name: "Read the note & retry" }).isVisible());
      await sequence.getByRole("button", { name: "Read the note & retry" }).click();
      await sequence.getByRole("button", { name: "Hide the note" }).click();
    }
    await sequence.getByRole("button", { name: `Add ${pattern[0]}`, exact: true }).click();
    await page.getByRole("tab", { name: "Lantern puzzle" }).click();
    await page.getByRole("tab", { name: "Herb sequence" }).click();
    assert.equal(await sequence.locator(".sequence-slots .game-symbol").count(), 1, "Recall survives changing tabs");
    for (const kind of pattern.slice(1)) await sequence.getByRole("button", { name: `Add ${kind}`, exact: true }).click();
    assert.match(await sequence.locator(".sequence-note").innerText(), /A PERFECT COPY/);
    if (round < 2) await sequence.getByRole("button", { name: "Next sequence" }).click();
  }
  await screenshot(sequence, "sequence-complete");
  await sequence.getByRole("button", { name: "Another set of notes" }).click();
  assert.equal(await sequence.locator(".sequence-slots li").count(), 3);
  checks.push("Herb Sequence grows from three to five symbols; hidden answers, mistakes, undo, peek/retry, tab retention and replay all work.");

  await page.getByRole("tab", { name: "Lantern puzzle" }).click();
  const lanterns = page.getByRole("tabpanel", { name: "Lantern puzzle" });
  const lights = lanterns.locator(".lantern-cell");
  for (let round = 0; round < 3; round++) {
    const before = await lights.evaluateAll(items => items.map(el => el.getAttribute("aria-pressed")));
    await lights.nth(0).click();
    const after = await lights.evaluateAll(items => items.map(el => el.getAttribute("aria-pressed")));
    assert.deepEqual(after.flatMap((value, i) => value !== before[i] ? [i] : []), [0, 1, 3]);
    await lanterns.getByRole("button", { name: "Undo last tap" }).click();
    assert.deepEqual(await lights.evaluateAll(items => items.map(el => el.getAttribute("aria-pressed"))), before);
    await page.getByRole("tab", { name: "Herb sequence" }).click();
    await page.getByRole("tab", { name: "Lantern puzzle" }).click();
    assert.deepEqual(await lights.evaluateAll(items => items.map(el => el.getAttribute("aria-pressed"))), before);
    for (let move = 0; move < round + 3; move++) {
      await lanterns.getByRole("button", { name: "A little nudge?" }).click();
      await lanterns.getByRole("button", { name: /Maomao’s suggestion/ }).click();
    }
    assert.equal(await lanterns.locator('.lantern-cell[aria-pressed="true"]').count(), 9);
    if (round < 2) await lanterns.getByRole("button", { name: "Next corridor" }).click();
  }
  await screenshot(lanterns, "lanterns-complete");
  await lanterns.getByRole("button", { name: "Light another path" }).click();
  assert(await lanterns.getByRole("button", { name: "A little nudge?" }).isVisible());
  await page.getByRole("tab", { name: "Lantern puzzle" }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Colour club" }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("End");
  assert.equal(await page.getByRole("tab", { name: "Lantern puzzle" }).getAttribute("aria-selected"), "true");
  checks.push("Lantern Puzzle changes the correct neighbors, undoes moves, preserves tabs, solves all three increasing rounds with hints, replays, and wraps keyboard tabs.");

  for (const route of ["/", "/world"]) {
    await page.goto(BASE + route);
    await ready(page);
    for (const [width, height] of [[320, 740], [390, 844], [430, 932], [650, 900], [700, 900], [820, 1180], [844, 390], [1024, 900], [1440, 1050]]) {
      await page.setViewportSize({ width, height });
      const buddy = page.locator(".maomao-buddy");
      if (route === "/") {
        await buddy.scrollIntoViewIfNeeded();
        await page.getByRole("button", { name: "Poke the apothecary" }).click();
        const music = page.locator(".music-object").first();
        assert(!overlaps(await buddy.boundingBox(), await music.boundingBox()), `${route} ${width}: companion overlaps music`);
        for (const selector of [".buddy-bubble", ".maomao-buddy .mascot", ".music-object"]) {
          const box = await page.locator(selector).first().boundingBox();
          assert(box.x >= -1 && box.x + box.width <= width + 1, `${route} ${width}: ${selector} outside viewport`);
        }
        for (const button of await buddy.locator(".buddy-offers button").all()) {
          const box = await button.boundingBox();
          assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1, `${route} ${width}: offer touch target`);
        }
        await music.click({ trial: true });
        if (width === 390) await screenshot(buddy, "phone-public-buddy");
      } else {
        // In her world the companion is fixed to the foot of the page and must stay inside it.
        const box = await page.locator(".companion__stage > .mascot").boundingBox();
        assert(box.x >= -1 && box.x + box.width <= width + 1, `${route} ${width}: companion outside viewport`);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${width}: horizontal overflow`);
      if (route === "/world") {
        for (const name of GAME_NAMES) {
          await page.getByRole("tab", { name }).click();
          const panel = page.getByRole("tabpanel", { name });
          const box = await panel.boundingBox();
          assert(box.x >= 0 && box.x + box.width <= width + 1, `${width}: ${name} outside viewport`);
          if (width === 390) await screenshot(panel, "phone-" + name.toLowerCase().replaceAll(" ", "-"));
        }
      }
    }
  }
  checks.push("Public/private buddy, music hit target and all five games fit 320–1440px, tablet and landscape; no music overlap or horizontal overflow.");
  await ctx.close();

  const movingCtx = await context({ viewport: { width: 1440, height: 1100 } });
  const moving = await movingCtx.newPage();
  await moving.clock.install();
  await moving.goto(BASE + "/");
  await ready(moving);
  const bubble = moving.locator(".buddy-bubble");
  const poke = moving.getByRole("button", { name: "Poke the apothecary" });
  await bubble.scrollIntoViewIfNeeded();
  await moving.getByRole("button", { name: "Show an herb" }).click();
  assert.equal(await poke.getAttribute("data-expression"), "herb");
  assert(await poke.locator(".mascot__eager-hands").count());
  assert(await poke.locator(".mascot__cat-ears").count());
  assert.equal(await poke.locator(".mascot__float").evaluate(el => getComputedStyle(el).animationName), "mascot-herb-gasp");
  assert(MAOMAO_REMARKS.herb.map(line => line.text).includes(await bubble.innerText()));
  await screenshot(moving.locator(".maomao-buddy"), "maomao-herb");
  await moving.getByRole("button", { name: "A curious vial" }).click();
  const vialText = await bubble.innerText();
  const vialReply = MAOMAO_REMARKS.vial.find(line => line.text === vialText);
  assert(vialReply);
  assert.equal(await poke.getAttribute("data-expression"), vialReply.expression);
  await screenshot(moving.locator(".maomao-buddy"), "maomao-vial");
  const taps = new Set();
  for (let i = 0; i < 12; i++) {
    await poke.click();
    const line = await bubble.innerText();
    assert(!taps.has(line), "Click dialogue repeated too soon");
    taps.add(line);
  }
  // Four rapid pokes trigger irritation, not another delighted herb face.
  for (let i = 0; i < 4; i++) await poke.click();
  assert.equal(await poke.getAttribute("data-expression"), "ew");
  assert(MAOMAO_REMARKS.pester.map(line => line.text).includes(await bubble.innerText()));
  const beforeIdle = await bubble.innerText();
  await moving.clock.fastForward(41000);
  await moving.waitForFunction(before => document.querySelector(".buddy-bubble").textContent !== before, beforeIdle);
  assert.equal(await moving.locator(".maomao-buddy .sr-only").innerText(), beforeIdle, "Idle speech must not interrupt screen readers");
  const beforeOffscreen = await bubble.innerText();
  await moving.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await moving.waitForTimeout(100);
  await moving.clock.fastForward(41000);
  assert.equal(await bubble.innerText(), beforeOffscreen, "Offscreen buddy should stay quiet");
  await bubble.scrollIntoViewIfNeeded();
  await moving.getByRole("button", { name: "Pause little animations" }).click();
  await bubble.scrollIntoViewIfNeeded();
  await moving.clock.fastForward(41000);
  assert.equal(await bubble.innerText(), beforeOffscreen, "Paused buddy should stay quiet");
  await moving.getByRole("button", { name: "Resume little animations" }).click();
  await moving.locator(".birthday-love-note").scrollIntoViewIfNeeded();
  assert.equal(await moving.locator(".birthday-forever").evaluate(el => getComputedStyle(el).animationName), "forever-sway");
  await bubble.scrollIntoViewIfNeeded();
  await moving.emulateMedia({ reducedMotion: "reduce" });
  const beforeReduced = await bubble.innerText();
  await moving.clock.fastForward(41000);
  assert.equal(await bubble.innerText(), beforeReduced, "Reduced motion should disable spontaneous chatter");
  await moving.emulateMedia({ reducedMotion: "no-preference" });
  await moving.evaluate(() => {
    const input = document.createElement("textarea");
    input.id = "typing-fixture";
    document.querySelector(".home-collage").append(input);
    input.focus({ preventScroll: true });
  });
  await moving.clock.fastForward(41000);
  assert.equal(await bubble.innerText(), beforeReduced, "She should stay quiet while someone types");
  await moving.evaluate(() => document.querySelector("#typing-fixture").remove());
  await moving.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await moving.clock.fastForward(41000);
  assert.equal(await bubble.innerText(), beforeReduced, "A hidden tab should stay quiet");
  await moving.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await moving.locator(".music-object").first().click();
  await moving.getByRole("complementary", { name: "Music player" }).waitFor();
  assert(MAOMAO_REMARKS.music.map(line => line.text).includes(await bubble.innerText()), "Music gets a contextual remark");
  await moving.getByRole("button", { name: "Close music player and stop playback" }).click();
  await screenshot(moving.locator(".maomao-buddy"), "maomao-detail");
  checks.push("Herb/vial offers select matching dialogue, facial expressions and poses; rapid pokes trigger annoyance. Varied click/idle/music remarks, quiet states and animated Forever still work.");
  await movingCtx.close();
  assert.deepEqual(errors, [], "Uncaught application errors");
  await writeFile(OUT + "checks.json", JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
