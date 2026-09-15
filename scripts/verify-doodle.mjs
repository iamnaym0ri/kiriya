import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../.data/redesign/unified-doodle/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const checks = [], errors = [], created = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
const api = (path, method = "GET", data) => ctx.request.fetch(BASE + "/api" + path, { method, headers: { "x-kw": "1" }, ...(data ? { data } : {}) });
await api("/session/unlock", "POST", { passphrase: process.env.VERIFY_PASSPHRASE ?? "kiriya" });
const page = await ctx.newPage(); page.setDefaultTimeout(12000); page.on("pageerror", error => errors.push(error.message));
const studio = page.locator(".doodle-studio"), canvas = studio.locator(".canvas-ink");
const button = name => studio.getByRole("button", { name, exact: true });
const digest = () => canvas.evaluate(el => {
  const data = el.getContext("2d").getImageData(0, 0, el.width, el.height).data;
  let count = 0, sum = 0; for (let i = 3; i < data.length; i += 4) { if (data[i]) count++; sum += data[i]; }
  return { count, sum };
});
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function draw(from = [.2, .35], to = [.7, .55]) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 18 }); await page.mouse.up(); await settle();
}
async function fresh() { page.once("dialog", dialog => dialog.accept()); await button("A fresh page ↗").click(); await settle(); }
try {
  await page.goto(BASE + "/world#play-desk"); await studio.waitFor(); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator(".canvas-ink").count(), 1);
  assert.equal(await page.getByRole("heading", { name: "From your imagination." }).count(), 0);
  assert.equal(await studio.evaluate(el => getComputedStyle(el).rotate), "0deg", "Drawing coordinates must not be rotated");
  const left = await studio.boundingBox(), right = await page.locator(".maomao-games").boundingBox();
  assert(left.x + left.width <= right.x && Math.abs(left.y - right.y) < 15, "Doodle and games sit side by side");
  await page.locator("#play-desk").screenshot({ path: OUT + "desktop-play.png", animations: "disabled" });
  await draw(); const first = await digest(); assert(first.count > 100);
  await button("Undo ↶").click(); await settle(); assert.equal((await digest()).count, 0);
  await button("Redo ↷").click(); await settle(); assert.deepEqual(await digest(), first);
  await studio.getByText("More art toys", { exact: false }).click();
  await button("Clear the page ↺ (you can undo this)").click(); await settle(); assert.equal((await digest()).count, 0);
  await button("Undo ↶").click(); await settle(); assert.deepEqual(await digest(), first, "Clear is undoable as one action");
  await button("Eraser").click(); await studio.getByRole("slider", { name: "Brush size" }).fill("48");
  await draw(); assert((await digest()).sum < first.sum / 2, "Eraser removes existing ink");
  await button("Undo ↶").click(); await settle(); assert.deepEqual(await digest(), first);
  await page.getByRole("link", { name: "Letters", exact: true }).click();
  await page.getByRole("link", { name: "Kiriya’s home", exact: true }).click();
  await page.locator("#play-desk").scrollIntoViewIfNeeded(); await canvas.waitFor(); await settle(); assert.deepEqual(await digest(), first, "Draft survives private navigation");
  await studio.getByText("More art toys", { exact: false }).click();
  await studio.getByRole("slider", { name: "Brush size" }).fill("20");
  const styles = {};
  for (const style of ["Brush", "Pencil", "Marker", "Crayon"]) {
    await fresh(); await studio.getByRole("group", { name: "Brush styles" }).getByRole("button", { name: style, exact: true }).click();
    await draw(); styles[style] = await digest(); assert(styles[style].count > 0, style + " makes ink");
  }
  assert(new Set(Object.values(styles).map(value => value.sum)).size === 4, "Brush styles render differently");
  checks.push("One aligned doodle canvas sits beside games. Drawing, erase, undo/redo, undoable clear, four distinct brushes and private draft retention work.");

  await fresh(); await studio.getByRole("button", { name: "Heart", exact: true }).click();
  await studio.getByRole("checkbox", { name: "Mirror drawing" }).check(); await draw([.15, .2], [.35, .4]);
  const mirrored = await canvas.evaluate(el => {
    const { data } = el.getContext("2d").getImageData(0, 0, el.width, el.height); let left = 0, right = 0;
    for (let y = 0; y < el.height; y++) for (let x = 0; x < el.width; x++) { const alpha = data[(y * el.width + x) * 4 + 3]; x < el.width / 2 ? left += alpha : right += alpha; }
    return [left, right];
  });
  assert(mirrored[0] > 0 && Math.abs(mirrored[0] - mirrored[1]) / mirrored[0] < .04);
  await studio.getByRole("checkbox", { name: "Mirror drawing" }).uncheck();
  for (const shape of ["Line", "Box", "Circle", "Star", "Sparkle"]) {
    await fresh(); await studio.getByRole("button", { name: shape, exact: true }).click(); await draw(); assert((await digest()).count > 0, shape);
  }
  await fresh(); await button("Box").click(); await draw([.2,.2],[.7,.7]); const filled = await digest();
  await fresh(); await studio.getByRole("checkbox", { name: "Fill shapes" }).uncheck(); await draw([.2,.2],[.7,.7]); assert((await digest()).sum < filled.sum / 2);
  await fresh(); await studio.getByRole("checkbox", { name: "Fill shapes" }).check(); await button("Heart").click();
  await studio.getByRole("slider", { name: "Ink opacity" }).fill("30"); await draw(); const pale = await digest();
  await fresh(); await studio.getByRole("slider", { name: "Ink opacity" }).fill("100"); await draw(); assert((await digest()).sum > pale.sum * 2);
  await studio.getByLabel("Pick any colour").fill("#d17baf");
  await studio.getByText("Mix a new colour", { exact: false }).click();
  await studio.getByRole("button", { name: "First paint: #365dd7", exact: true }).click();
  await studio.getByRole("button", { name: "Second paint: #edba69", exact: true }).click();
  await studio.getByRole("slider", { name: "Mix amount", exact: true }).fill("0.6");
  await studio.getByRole("button", { name: "Paint with this", exact: true }).click();
  const mixed = (await studio.locator(".mixer__use code").innerText()).trim();
  assert(/^#[0-9a-f]{6}$/.test(mixed));
  assert.equal(await studio.getByRole("button", { name: `Paint in ${mixed}`, exact: true }).getAttribute("aria-pressed"), "true");
  await studio.getByText("Mix a new colour", { exact: false }).click();
  await studio.getByRole("button", { name: "Lined", exact: true }).click();
  await studio.getByRole("textbox", { name: "Name your doodle" }).fill("Doodle integration check");
  checks.push("Six shape tools, filled/outline shapes, mirror drawing, opacity, arbitrary colours and real pigment mixing work in the folded art tray.");

  let fail = true;
  await page.route("**/api/me/artworks", async route => {
    if (route.request().method() === "POST" && fail) { fail = false; return route.fulfill({ status: 503, json: { message: "Temporary saving test. Please retry." } }); }
    return route.continue();
  });
  const beforeFailure = await digest();
  await button("Keep this doodle ♡").click(); await studio.getByRole("alert").waitFor();
  assert.deepEqual(await digest(), beforeFailure, "Failed save preserves ink");
  const savedResponse = page.waitForResponse(response => response.url().endsWith("/api/me/artworks") && response.request().method() === "POST" && response.status() === 200);
  await button("Keep this doodle ♡").click(); const saved = await (await savedResponse).json(); created.push(saved.id);
  await button("Kept in your gallery ♡").waitFor(); assert.equal(saved.width, 1600); assert.equal(saved.height, 1600);
  assert.equal((await fetch(BASE + saved.url)).status, 401);
  const stored = await ctx.request.get(BASE + saved.url); assert.equal(stored.status(), 200);
  const file = await stored.body();
  const exported = await page.evaluate(async url => {
    const response = await fetch(url), bitmap = await createImageBitmap(await response.blob());
    const c = document.createElement("canvas"); c.width = bitmap.width; c.height = bitmap.height; c.getContext("2d").drawImage(bitmap, 0, 0);
    return { width: c.width, corner: [...c.getContext("2d").getImageData(5, 5, 1, 1).data], line: [...c.getContext("2d").getImageData(50, 48, 1, 1).data] };
  }, saved.url);
  assert.deepEqual(exported.corner, [255,250,246,255]); assert.notDeepEqual(exported.line, exported.corner, "Ruled paper is exported too");
  await studio.getByRole("button", { name: "Open Doodle integration check", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.waitFor();
  const download = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Download image" }).click(); assert((await download).suggestedFilename().endsWith(".png"));
  await page.keyboard.press("Escape");
  await studio.getByRole("button", { name: "Plain", exact: true }).click();
  assert(await button("Keep this doodle ♡").isEnabled(), "Changing paper marks a saved page as changed");
  const share = page.waitForEvent("download"); await button("Share / download ↗").click(); assert((await share).suggestedFilename().endsWith(".png"));
  await studio.getByRole("button", { name: "Add artwork" }).click();
  await dialog.getByLabel("Artwork", { exact: true }).setInputFiles({ name: "doodle-test.png", mimeType: "image/png", buffer: file });
  await dialog.getByLabel("Title or a little note").fill("Uploaded integration check");
  const uploadedResponse = page.waitForResponse(response => response.url().endsWith("/api/me/artworks") && response.request().method() === "POST" && response.status() === 200);
  await dialog.getByRole("button", { name: "Save to your gallery" }).click(); const uploaded = await (await uploadedResponse).json(); created.push(uploaded.id);
  await studio.getByRole("button", { name: "Open Uploaded integration check", exact: true }).click();
  page.once("dialog", d => d.accept()); await dialog.getByRole("button", { name: "Delete saved artwork", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const remaining = await (await api("/me/artworks")).json(); assert(!remaining.artworks.some(art => art.id === uploaded.id));
  checks.push("PNG save/retry, 1600px export including paper, authenticated media, download, artwork upload, enlarged viewing and explicit deletion work. Existing artwork is retained.");

  await page.unroute("**/api/me/artworks");
  await page.route("**/api/me/artworks", async route => {
    const response = await route.fetch(); const data = await response.json();
    await route.fulfill({ response, json: { artworks: [...data.artworks, { ...saved, id: "date-fixture-a", prompt: "Day one", createdAt: "2026-09-14T15:59:59Z" }, { ...saved, id: "date-fixture-b", prompt: "Day two", createdAt: "2026-09-14T16:00:00Z" }] } });
  });
  await page.goto(BASE + "/world/art"); await studio.locator(".doodle-gallery").waitFor();
  await studio.getByLabel("Find a day").selectOption("2026-09-14");
  assert.equal(await studio.getByRole("button", { name: "Open Day one", exact: true }).count(), 1);
  assert.equal(await studio.getByRole("button", { name: "Open Day two", exact: true }).count(), 0);
  await studio.getByLabel("Find a day").selectOption("2026-09-15");
  assert.equal(await studio.getByRole("button", { name: "Open Day two", exact: true }).count(), 1);
  await studio.getByLabel("Find a day").selectOption("all");
  await studio.locator(".doodle-gallery").screenshot({ path: OUT + "dated-gallery.png" });
  await page.goto(BASE + "/world/studio?paint=%23aa66bb,%23bb8899,%2366aa99"); await studio.waitFor();
  await studio.getByRole("button", { name: "Paint in #aa66bb", exact: true }).waitFor();
  assert.equal(await page.locator(".canvas-ink").count(), 1);
  assert.equal(new URL(page.url()).pathname, "/world");
  assert.equal(await studio.getByRole("button", { name: "Paint in #aa66bb", exact: true }).getAttribute("aria-pressed"), "true");
  checks.push("Gallery filters use Singapore calendar dates; old art/studio routes and palette links arrive at the same doodle workspace.");

  for (const [width, height] of [[320,740],[390,844],[650,900],[720,950],[820,1180],[844,390],[1024,900],[1440,1100]]) {
    await page.setViewportSize({width,height}); await studio.scrollIntoViewIfNeeded(); await settle();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: overflow`);
    for (const control of await studio.locator('button:visible, summary:visible, input[type="range"]:visible').all()) {
      const box = await control.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width + 1, `${width}: outside control`); assert(box.height >= 43, `${width}: short touch target`);
    }
    if (width === 390) { await page.addStyleTag({ content: '.world-mast, .skip-link { visibility: hidden !important; }' }); await studio.screenshot({ path: OUT + "phone-art-tray.png" }); }
  }
  checks.push("Expanded controls fit 320–1440px, tablet and landscape; visible drawing controls keep at least 44px touch height.");

  const touch = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:"reduce"});
  await touch.request.post(BASE + "/api/session/unlock", {headers:{"x-kw":"1"},data:{passphrase:"kiriya"}});
  const phone = await touch.newPage(); phone.on("pageerror", e => errors.push(e.message)); await phone.goto(BASE + "/world#play-desk");
  const touchCanvas = phone.locator(".canvas-ink"); await touchCanvas.waitFor(); await touchCanvas.scrollIntoViewIfNeeded();
  const box = await touchCanvas.boundingBox(); const cdp = await touch.newCDPSession(phone);
  const point = t => ({ x: box.x + box.width * (.2 + .5 * t), y: box.y + box.height * (.3 + .2 * t), radiusX: 2, radiusY: 2, force: .5, id: 1 });
  await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[point(0)]});
  for(let i=1;i<=12;i++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[point(i/12)]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  assert(await phone.getByRole("button",{name:"Keep this doodle ♡",exact:true}).isEnabled());
  assert(await touchCanvas.evaluate(el=>el.getContext("2d").getImageData(0,0,el.width,el.height).data.some((value,i)=>i%4===3 && value>0)));
  await phone.getByText("More art toys",{exact:false}).click();
  await phone.getByRole("button",{name:"Star",exact:true}).click();
  await touchCanvas.scrollIntoViewIfNeeded(); const stampBox=await touchCanvas.boundingBox(); await phone.touchscreen.tap(stampBox.x+stampBox.width*.6,stampBox.y+stampBox.height*.4);
  await phone.getByRole("button",{name:"Undo ↶",exact:true}).click();
  assert(await phone.getByRole("button",{name:"Keep this doodle ♡",exact:true}).isEnabled());
  await touch.close(); checks.push("Native Chromium touch drawing and tap stamps work on a phone-sized canvas.");
  assert.deepEqual(errors, []);
  await writeFile(OUT + "checks.json", JSON.stringify({checks,errors},null,2)); console.log(JSON.stringify({checks,errors},null,2));
} finally {
  for (const id of created) await api(`/me/artworks/${id}`, "DELETE");
  await browser.close();
}
