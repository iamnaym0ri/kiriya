import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { oklch } from "culori";
import { checkinCopy } from "../server/lib/checkin.js";
import { ADDRESS_OPTIONS } from "../server/content/moods.js";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../.data/redesign/feeling-corner/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce" });
const api = (path, method = "GET", data) => ctx.request.fetch(BASE + "/api" + path, { method, headers: { "x-kw": "1" }, ...(data ? { data } : {}) });
await api("/session/unlock", "POST", { passphrase: process.env.VERIFY_PASSPHRASE ?? "kiriya" });
const live = await (await api("/me/mood")).json();
assert.equal(live.choices.length, 4);
let state = { ...live, current: null, copy: null };
let failNext = false;
const checks = [], errors = [];
await ctx.route(/https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({body:"<p>Provider fixture</p>",contentType:"text/html"}));
await ctx.route("**/api/public/view", route => route.fulfill({ json: { views: 0 } }));
await ctx.route("**/api/me/mood", async route => {
  if (route.request().method() === "PUT") {
    if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { message: "Temporary check-in test. Try again." } }); }
    const body = route.request().postDataJSON();
    state = { ...state, choices: state.choices.map(choice => choice.key === body.mood ? { ...choice, address: ADDRESS_OPTIONS[body.address] } : choice) };
    state.current = { ...state.choices.find(choice => choice.key === body.mood), energy: body.energy, feeling: state.feelings.find(item => item.key === body.feeling) ?? null };
    state.copy = checkinCopy(state.current.address);
  }
  return route.fulfill({ json: state });
});
await ctx.route("**/api/me/address", async route => {
  if (route.request().method() === "PUT") {
    const body = route.request().postDataJSON();
    state = { ...state, choices: state.choices.map(choice => choice.key === body.mood ? { ...choice, address: ADDRESS_OPTIONS[body.address] } : choice) };
    if (state.current?.key === body.mood) { state.current = { ...state.current, address: ADDRESS_OPTIONS[body.address] }; state.copy = checkinCopy(state.current.address); }
    return route.fulfill({ json: { ok: true } });
  }
  return route.fulfill({ json: { options: state.addressOptions, moods: state.choices.map(choice => ({ key: choice.key, label: choice.label, current: choice.address.label })) } });
});
const page = await ctx.newPage(); page.setDefaultTimeout(12000); page.on("pageerror", error => errors.push(error.message));
const trigger = () => page.locator(".daily-style-button");
const dialog = () => page.getByRole("dialog", { name: "Whay u feeling like today ;)" });
async function open() { await trigger().click(); await page.locator(".mood-options").waitFor(); }
async function choose(label, address, energy = 2, feeling = null) {
  await open(); await dialog().getByRole("button", { name: new RegExp("^" + label) }).click();
  await dialog().getByRole("combobox", { name: "Pronouns for today", exact: true }).selectOption(address);
  if (feeling) await dialog().getByRole("button", {name: new RegExp("^" + feeling + ":")}).click();
  else if (await dialog().getByRole("button", {name: "clear", exact: true}).count()) await dialog().getByRole("button", {name: "clear", exact: true}).click();
  await dialog().getByRole("slider", { name: "Your energy", exact: true }).fill(String(energy));
  await dialog().getByRole("button", { name: "Keep today’s feeling ♡", exact: true }).click(); await dialog().waitFor({ state: "hidden" });
}
const theme = () => page.evaluate(() => {
  const root = document.documentElement, css = getComputedStyle(root);
  return { feeling: root.dataset.feeling, key: root.dataset.mood, energy: root.dataset.energy, accent: css.getPropertyValue("--theme-accent").trim(), paper: css.getPropertyValue("--theme-paper").trim(), filter: getComputedStyle(document.getElementById("root"), "::before").filter };
});
try {
  assert.equal((await fetch(BASE + "/api/me/mood")).status, 401);
  assert.equal((await fetch(BASE + "/api/me/mood", { method: "PUT", headers: { "Content-Type": "application/json", "x-kw": "1" }, body: JSON.stringify({ mood: "night", energy: 2 }) })).status, 401);
  assert.equal((await api("/me/mood", "PUT", { mood: "constructor", energy: 9 })).status(), 400);
  assert.equal((await api("/me/mood", "PUT", { mood: "rose", feeling: "constructor" })).status(), 400);
  const originalImage = await ctx.request.get(BASE + "/images/lilac-blossoms.webp"); assert.equal(originalImage.status(), 200);
  await page.goto(BASE + "/world"); await page.locator(".home-opening").waitFor(); await page.evaluate(() => document.fonts.ready);
  assert.equal((await theme()).key, undefined);
  assert((await page.locator("#root").evaluate(el => getComputedStyle(el, "::before").backgroundImage)).includes("lilac-blossoms.webp"));
  assert.match(await page.locator('.home-welcome h1').evaluate(el => getComputedStyle(el).fontFamily), /Parisienne/);
  assert.match(await page.locator('.birthday-love-note').innerText(), /have been/);
  assert.equal(await page.locator('.home-welcome__line em').evaluate(el=>getComputedStyle(el).display),'block');
  assert.equal(await page.locator('.welcome-emoticon').innerText(), '(˘ ³˘)♡');
  await page.screenshot({ path: OUT + "new-background-desktop.png" });
  const corner = page.locator('.daily-style-corner');
  const cornerBefore = await corner.boundingBox(); await page.evaluate(()=>scrollBy(0,300));
  assert.deepEqual(await corner.boundingBox(),cornerBefore,'The little corner floats while the page scrolls');
  await page.evaluate(()=>scrollTo(0,0));
  await page.getByRole('button',{name:'Make your little corner smaller'}).click();
  assert((await corner.boundingBox()).width < cornerBefore.width);
  await page.getByRole('button',{name:'Expand your little corner'}).click();
  await page.locator('.daily-style-corner__toggle').click(); await dialog().waitFor();
  assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  assert.equal(await dialog().evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Escape'); await dialog().waitFor({state:'hidden'});
  assert(await page.locator('.daily-style-corner__toggle').evaluate(el=>el===document.activeElement));
  checks.push('Cursive name, separate welcome line, animated emoticon copy and corrected birthday wish; floating corner resizes, permits page scrolling and restores focus after Escape.');
  const colors = {};
  for (const [label, key, address, caption] of [["Femme", "rose", "she/her", "miss"], ["Masc", "night", "he/him", "mister"], ["Fluid", "iris", "she/they", "my"], ["Just me", "cloud", "they/them", "my"]]) {
    await choose(label, address); const actual = await theme(); assert.equal(actual.key, key); colors[key] = actual;
    assert.equal(await page.locator(".home-portrait figcaption .handwritten").innerText(), `Happy birthday ${caption} apothecary💕`);
    await page.screenshot({ path: OUT + `theme-${key}.png` });
  }
  assert.equal(new Set(Object.values(colors).map(color => color.accent)).size, 4);
  assert.equal(new Set(Object.values(colors).map(color => color.paper)).size, 4);
  const channels = hex => hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
  for (const a of Object.values(colors)) for (const b of Object.values(colors)) {
    assert(channels(a.accent).every((v, i) => Math.abs(v - channels(b.accent)[i]) <= 40), "Accents should stay close to the original palette");
    assert(channels(a.paper).every((v, i) => Math.abs(v - channels(b.paper)[i]) <= 10), "Paper tint should remain subtle");
  }
  const paints = () => page.evaluate(() => {
    const probe=document.createElement('span'); probe.style.cssText='color:var(--theme-accent);background:var(--theme-paper)'; document.body.append(probe);
    const css=getComputedStyle(probe), result={accent:css.color,paper:css.backgroundColor}; probe.remove(); return result;
  });
  const rgba = value => value.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>value.startsWith('color(')?n*255:n);
  await choose('Fluid','he/they'); const baseline=await paints(); const emotionColors={};
  for(const feeling of live.feelings) {
    await choose('Fluid','he/they',2,feeling.label);
    assert.equal((await theme()).feeling,feeling.key); assert.equal((await theme()).key,'iris');
    assert.match(await page.locator('.daily-style-button .sr-only').innerText(),/he\/they/);
    const actual=await paints(); emotionColors[feeling.key]=actual;
    const [r,g,b]=rgba(actual.accent).map(v=>v/255), tint=oklch({mode:'rgb',r,g,b});
    assert(rgba(actual.accent).some((v,i)=>Math.abs(v-rgba(baseline.accent)[i])>=2),'Each feeling tints the lilac a little');
    assert(rgba(actual.accent).every((v,i)=>Math.abs(v-rgba(baseline.accent)[i])<=12),'The tint stays nuanced: noticeable only if you look for it');
    assert(tint.h>=290 && tint.h<=355 && tint.c>=.03,`${feeling.key} keeps the accent lilac (hue ${tint.h?.toFixed(0)})`);
    assert(rgba(actual.paper).every(v=>v>=235),'Paper stays light enough to read on');
  }
  assert.equal(new Set(Object.values(emotionColors).map(color=>color.accent)).size,8);
  await open(); await dialog().getByRole('button',{name:/^Happy:/}).click();
  await dialog().getByRole('button',{name:'low battery',exact:true}).click();
  assert.match(await dialog().locator('.energy-comment').innerText(),/leave me tf alone/);
  await dialog().getByRole('slider',{name:'Your energy'}).press('ArrowRight');
  assert.match(await dialog().locator('.energy-comment').innerText(),/short version pls/);
  await dialog().getByRole('button',{name:'full yap',exact:true}).click();
  assert.match(await dialog().locator('.energy-comment').innerText(),/3-hour yap session/);
  assert.equal(await dialog().locator('.energy-battery i[data-lit="true"]').count(),5);
  await dialog().screenshot({path:OUT+'energy-full-yap.png'});
  await dialog().getByRole('button',{name:'Keep today’s feeling ♡',exact:true}).click(); await dialog().waitFor({state:'hidden'});
  await open(); await dialog().evaluate(el=>el.scrollTop=0); await page.evaluate(()=>document.fonts.ready);
  await dialog().screenshot({path:OUT+'corner-desktop.png'});
  const cdp=await ctx.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument');
  for(let i=1;i<=8;i++) {
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.feeling-option:nth-child('+i+') .feeling-emoji'});
    const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
    assert(fonts.some(font=>/Emoji/.test(font.familyName)&&font.glyphCount>0),'Every mood needs a rendered emoji');
  }
  await cdp.detach();
  await page.keyboard.press('Escape');
  await page.reload(); await page.waitForFunction(()=>document.documentElement.dataset.feeling==='happy');
  checks.push('All eight moods save independently of presentation, address and energy, each a distinct, nuanced tint that stays lilac. Battery endpoints, keyboard adjustment, faces and sarcastic comments respond correctly; reload restores the mood.');
  await choose("Masc", "they/them", 0); assert.equal((await theme()).key, "night"); assert.equal((await theme()).energy, "0");
  assert.match(await page.locator(".daily-style-button .sr-only").innerText(), /Masc, they\/them/);
  const low = (await theme()).filter;
  await choose("Masc", "they/them", 4); assert.notEqual((await theme()).filter, low);
  const saved = await theme();
  await open(); await dialog().getByRole("button", { name: /^Femme/ }).click(); await page.keyboard.press("Escape"); assert.deepEqual(await theme(), saved, "Cancelled draft leaves the theme as saved");
  await open(); await dialog().getByRole("button", { name: /^Femme/ }).click(); failNext = true;
  await dialog().getByRole("button", { name: "Keep today’s feeling ♡", exact: true }).click(); await dialog().getByRole("alert").waitFor(); assert.deepEqual(await theme(), saved, "A failed save cannot leave an unsaved theme applied");
  await dialog().getByRole("button", { name: "Keep today’s feeling ♡", exact: true }).click(); await dialog().waitFor({ state: "hidden" }); assert.equal((await theme()).key, "rose");
  checks.push("Four close palette variants, independent address choices, gentle energy changes, cancelled edits and failed-save retry behave correctly.");

  await choose("Masc", "he/him");
  await page.goto(BASE + "/world/letters"); await trigger().waitFor(); assert.equal((await theme()).key, "night");
  await page.reload(); await trigger().waitFor(); await page.waitForFunction(() => document.documentElement.dataset.mood === "night");
  await page.goto(BASE + "/world/settings");
  await page.getByRole("combobox", { name: "Masc", exact: true }).selectOption("they/them");
  await page.waitForFunction(() => document.querySelector('.daily-style-button .sr-only')?.textContent.includes('they/them'));
  await page.goto(BASE + "/world"); await page.locator(".home-opening").waitFor();
  assert.equal(await page.locator(".home-portrait figcaption .handwritten").innerText(), "Happy birthday my apothecary💕");
  await choose("Femme", "she/her");
  await page.locator("#play-desk").scrollIntoViewIfNeeded(); await page.locator('.paint-blob--target').waitFor();
  const paint = await page.locator('.paint-blob--target').evaluate(el => getComputedStyle(el).backgroundColor);
  const portraitFilter = await page.locator('.home-portrait img').evaluate(el => getComputedStyle(el).filter);
  await choose("Masc", "he/him");
  assert.equal(await page.locator('.paint-blob--target').evaluate(el => getComputedStyle(el).backgroundColor), paint);
  assert.equal(await page.locator('.home-portrait img').evaluate(el => getComputedStyle(el).filter), portraitFilter);
  await page.goto(BASE + "/world/apothecary"); assert.match(await page.locator('.maomao-spread').innerText(), /the girl/);
  await page.goto(BASE + "/"); await page.locator('.identity-paper').waitFor(); await page.waitForFunction(() => document.documentElement.dataset.mood === "night");
  await ctx.route('**/api/public/profile', async route => {
    const response = await route.fetch(), profile = await response.json();
    await route.fulfill({ response, json: { ...profile, showViews: false, avatarUrl: '/images/maomao-floral.webp' } });
  });
  await page.reload(); await page.locator('.celebration-portrait').waitFor();
  assert.equal(await page.locator('.celebration-portrait').getAttribute('alt'), 'Kiriya, the birthday boy');
  assert.equal(await page.locator('.public-footer__date').innerText(), 'a world of his own');
  await choose('Fluid', 'they/them'); assert.equal(await page.locator('.public-footer__date').innerText(), 'a world of their own');
  await ctx.unroute('**/api/public/profile');
  checks.push("The saved selection follows private navigation, reloads and the owner’s public view. Settings updates refresh personal wording; character references and paint colours retain their own meaning and appearance.");

  for (const route of ["/", "/world", "/world/letters", "/world/settings", "/world/apothecary", "/world/stage", "/world/atelier"]) {
    await page.goto(BASE + route); await trigger().waitFor();
    assert((await page.locator('#root').evaluate(el => getComputedStyle(el,'::before').backgroundImage)).includes('lilac-blossoms.webp'));
    for (const [width, height] of [[320,740],[390,844],[720,960],[820,1180],[844,390],[1024,900],[1440,1050]]) {
      await page.setViewportSize({width,height});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${width}: overflow`);
      const box = await trigger().boundingBox(); assert(box.x>=0 && box.x+box.width<=width+1 && box.height>=44, `${route} ${width}: check-in target`);
      await trigger().click({trial:true});
      if(route==='/world' && width===390) await page.screenshot({path:OUT+'new-background-phone.png'});
    }
  }
  await page.goto(BASE+'/world'); await page.setViewportSize({width:320,height:740});
  await page.getByRole('button',{name:'Open section menu'}).click(); await page.getByRole('link',{name:'Settings',exact:true}).click(); assert.equal(new URL(page.url()).pathname,'/world/settings');
  await open(); await dialog().getByRole('button',{name:/^Fluid/}).click();
  await dialog().getByRole('button',{name:/^Content:/}).click();
  assert(await dialog().getByRole('combobox', { name: 'Pronouns for today', exact: true }).isVisible());
  await dialog().evaluate(el=>el.scrollTop=0);
  await dialog().screenshot({path:OUT+'checkin-phone-selected.png'});
  assert(await dialog().evaluate(el => el.scrollWidth <= el.clientWidth+1)); await page.keyboard.press('Escape');
  checks.push("Background and check-in access work across all private pages and the public view at 320–1440px; phone and landscape layouts fit, including the restored Settings menu link.");

  for(const [width,height] of [[320,740],[390,844],[820,1180],[844,390]]) {
    await page.setViewportSize({width,height}); await open();
    const box=await dialog().boundingBox(); assert(box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height);
    assert(await dialog().evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await dialog().getByRole('button',{name:/^Content:/}).click();
    await dialog().getByRole('button',{name:'Keep today’s feeling ♡',exact:true}).click(); await dialog().waitFor({state:'hidden'});
    assert.equal((await theme()).feeling,'content');
  }
  await page.goto(BASE+'/world'); await page.setViewportSize({width:390,height:844});
  await page.locator('.home-collage__music .music-object').click(); await page.locator('.listening-room').waitFor();
  const cb=await page.locator('.daily-style-corner').boundingBox(), mb=await page.locator('.listening-room').boundingBox();
  assert(cb.y+cb.height<=mb.y || cb.x+cb.width<=mb.x || cb.x>=mb.x+mb.width,'Closed corner must not cover music controls');
  await page.getByRole('button',{name:'Close music player and stop playback'}).click();
  await page.setViewportSize({width:1440,height:1050});
  await page.emulateMedia({reducedMotion:'no-preference'}); await page.evaluate(()=>scrollTo(0,0));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.welcome-emoticon')).animationName==='welcome-kiss');
  assert.notEqual(await page.locator('.name-charm--heart').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.welcome-emoticon').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('.name-charm--heart').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  checks.push('Corner and save controls fit phone, tablet and landscape; the collapsed corner clears the active music player. New charms and emoticon animate and respect reduced motion.');

  // Her check-in stays chosen across Singapore midnight; the day refreshes, the choice doesn't reset.
  const midnight = await ctx.newPage();
  await midnight.clock.install({time:new Date('2026-09-15T15:59:59Z')}); state={...state,day:'2026-09-15'};
  await midnight.goto(BASE+'/world'); await midnight.waitForFunction(()=>!!document.documentElement.dataset.mood);
  const beforeMidnight = await midnight.evaluate(()=>document.documentElement.dataset.mood);
  state={...state,day:'2026-09-16'}; await midnight.clock.fastForward(2500);
  await midnight.waitForTimeout(500);
  assert.equal(await midnight.evaluate(()=>document.documentElement.dataset.mood), beforeMidnight, 'Midnight keeps the saved choice');
  await midnight.close();
  await page.goto(BASE+'/world'); await page.locator('.home-opening').waitFor();
  await choose('Masc', 'he/him');
  await page.goto(BASE+'/world/settings'); await page.getByRole('button',{name:'Lock kiriya on this device'}).click();
  await page.waitForURL(BASE+'/'); await trigger().waitFor({state:'hidden'}); assert.equal((await theme()).key,undefined);
  await page.getByRole('button',{name:'The rest is just for Kiriya'}).click();
  await page.getByLabel('Passphrase',{exact:true}).fill(process.env.VERIFY_PASSPHRASE ?? 'kiriya');
  await page.getByRole('button',{name:'Open your world'}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.mood==='night');
  await page.goto(BASE+'/world/settings'); await page.getByRole('button',{name:'Lock kiriya on this device'}).click();
  await page.waitForURL(BASE+'/'); await trigger().waitFor({state:'hidden'}); assert.equal((await theme()).key,undefined);
  const guest = await browser.newContext(); const visitor = await guest.newPage(); let privateRequests=0;
  visitor.on('request',request=>{if(request.url().includes('/api/me/')) privateRequests++;});
  await visitor.goto(BASE+'/'); await visitor.locator('.identity-paper').waitFor(); assert.equal(privateRequests,0); assert.equal(await visitor.locator('.daily-style-button').count(),0);
  assert((await visitor.locator('#root').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).includes('lilac-blossoms.webp')); await guest.close();
  checks.push("Singapore midnight keeps the saved choice; locking clears the owner theme and unlocking restores the saved choice. Guests get the new background without requesting private check-in data.");
  assert.deepEqual(errors,[]);
  await writeFile(OUT+'checks.json',JSON.stringify({checks,errors,colors,storage:'Browser save responses are isolated fixtures; database persistence is covered by test-checkin.mjs.'},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally { await browser.close(); }
