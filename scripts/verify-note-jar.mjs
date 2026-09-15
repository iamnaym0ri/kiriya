import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { chromium } from "playwright";
// Isolated DB and credentials: no changes to Kiriya's history or paid services.
for(const key of ["DATABASE_URL","kData_DATABASE_URL","OPENAI_API_KEY","BLOB_READ_WRITE_TOKEN","BLOB_STORE_ID","QSTASH_TOKEN","VAPID_PUBLIC_KEY","VITE_VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","VERCEL_ENV","VERCEL","CRON_SECRET"])process.env[key]="";
process.env.NODE_ENV="development";process.env.FEEDS_ENABLED="false";process.env.KIRIYA_TZ="Asia/Singapore";process.env.SESSION_SECRET=randomBytes(32).toString("hex");
const {hashPassphrase}=await import("../server/auth/passphrase.js");
const phrase=randomBytes(20).toString("hex"),adminPhrase=randomBytes(20).toString("hex");
process.env.KIRIYA_PASSPHRASE_HASH=await hashPassphrase(phrase);process.env.ADMIN_PASSPHRASE_HASH=await hashPassphrase(adminPhrase);
const {PGlite}=await import("@electric-sql/pglite"),{drizzle}=await import("drizzle-orm/pglite"),{migrate}=await import("drizzle-orm/pglite/migrator");
const schema=await import("../server/db/schema.js"),client=new PGlite(),db=drizzle({client,schema});
await migrate(db,{migrationsFolder:new URL("../server/db/migrations",import.meta.url).pathname});
globalThis.__kiriyaDb=Promise.resolve({db,driver:"pglite"});
const {createServer}=await import("vite"),{birthdayInfo}=await import("../server/lib/birthday.js");
const OUT=new URL("../.data/redesign/note-jar/",import.meta.url);await mkdir(OUT,{recursive:true});
let server,browser;const checks=[],errors=[];
try{
  server=await createServer({server:{port:5182,strictPort:true,host:"127.0.0.1"},mode:"development"});await server.listen();const base="http://127.0.0.1:5182";
  browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1440,height:1050}});
  assert.equal((await ctx.request.get(base+"/api/me/note-jar")).status(),401);
  const auth=await ctx.request.post(base+"/api/session/unlock",{headers:{"x-kw":"1"},data:{passphrase:phrase}});assert.equal(auth.status(),200);
  assert.equal((await ctx.request.post(base+"/api/me/note-jar/pull",{data:{requestId:crypto.randomUUID()}})).status(),400);
  assert.equal((await ctx.request.post(base+"/api/me/note-jar/pull",{headers:{"x-kw":"1"},data:{requestId:"bad"}})).status(),400);
  const privateResponse=await ctx.request.get(base+"/api/me/note-jar");assert.match(privateResponse.headers()["cache-control"],/private, no-store/);
  const page=await ctx.newPage();page.setDefaultTimeout(18000);page.on("pageerror",e=>errors.push(e.message));
  let date="2026-09-16";
  await page.route("**/api/me/today",async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({json:{...data,day:date,birthday:birthdayInfo(date)}});});
  await page.goto(base+"/world#note-jar");const jar=page.locator("#note-jar");await jar.waitFor();await page.evaluate(()=>document.fonts.ready);await jar.scrollIntoViewIfNeeded();
  assert.equal(await page.locator(".personal-home > .birthday-gift").count(),0);assert.equal(await jar.locator(".birthday-gift").count(),0);
  assert(await jar.evaluate(el=>el.nextElementSibling.id==="play-desk"));
  const firstButton=jar.getByRole("button",{name:"pull a little note",exact:false});
  await firstButton.click();await page.waitForFunction(()=>document.querySelector('.jar-pull-cycle')?.dataset.drawing==='true');
  assert.equal(await jar.locator('.jar-vessel').evaluate(el=>getComputedStyle(el).animationName),'jar-shake');
  assert.equal(await jar.locator('.jar-lid').evaluate(el=>getComputedStyle(el).animationName),'jar-lid-lift');
  assert.equal(await jar.locator('.jar-flying-note').evaluate(el=>getComputedStyle(el).animationName),'jar-note-flight');
  const another=jar.getByRole('button',{name:'pull another little note',exact:false});await another.waitFor();
  const firstText=await jar.locator('.note-jar__message').innerText();
  await jar.getByRole('button',{name:'keep this',exact:false}).click();await jar.getByRole('button',{name:'kept close',exact:false}).waitFor();
  await page.reload();await jar.getByRole('button',{name:'kept close',exact:false}).waitFor();assert.equal(await jar.locator('.note-jar__message').innerText(),firstText);
  for(let i=0;i<3;i++){await another.click();await page.waitForFunction(()=>document.querySelector('.jar-pull-cycle')?.dataset.drawing==='true');assert.equal(await jar.locator('.jar-vessel').evaluate(el=>getComputedStyle(el).animationName),'jar-shake');await another.waitFor();}
  assert.notEqual(await jar.locator('.note-jar__message').innerText(),firstText);
  checks.push('Standalone jar replaces the old home gift block; every pull shakes the jar, lifts its lid, sends a note upward and reveals a different card.');
  await jar.getByRole('button',{name:'your little collection',exact:false}).click();const dialog=page.getByRole('dialog',{name:'little notes, kept close ♡'});
  await dialog.getByRole('button',{name:'favourites ♡',exact:true}).click();await dialog.locator('.note-jar-history__note').first().waitFor();assert.equal(await dialog.locator('.note-jar-history__note').count(),1);
  await dialog.locator('.note-jar-history__note').first().click();assert.equal(await jar.locator('.note-jar__message').innerText(),firstText);
  checks.push('Saved favourites, dated history, reopening a note and reload persistence work through the real private API.');
  let loseResponse=true;const requests=[];
  await page.route('**/api/me/note-jar/pull',async route=>{requests.push(route.request().postDataJSON().requestId);if(loseResponse){loseResponse=false;await route.fetch();await route.fulfill({status:503,json:{error:'fixture_lost_response'}});}else await route.continue();});
  const before=(await(await ctx.request.get(base+'/api/me/note-jar')).json()).pulled;
  await another.click();await jar.getByRole('alert').filter({hasText:'ribbon got'}).waitFor();await jar.getByRole('button',{name:'try that little pull again',exact:false}).click();await another.waitFor();
  assert.equal(requests[0],requests[1]);assert.equal((await(await ctx.request.get(base+'/api/me/note-jar')).json()).pulled,before+1);
  await page.unroute('**/api/me/note-jar/pull');checks.push('A lost response retries the same delivery; extra notes are not consumed.');
  await page.emulateMedia({reducedMotion:'reduce'});await another.click();await another.waitFor();
  assert(await jar.evaluate(el=>el.getAnimations({subtree:true}).length===0));
  await page.setViewportSize({width:390,height:844});await another.click();await another.waitFor();
  await page.waitForFunction(()=>{const paper=document.querySelector('.note-jar__paper').getBoundingClientRect(),mast=document.querySelector('.world-mast').getBoundingClientRect(),corner=document.querySelector('.daily-style-corner').getBoundingClientRect();return paper.top>=mast.bottom&&paper.bottom<=corner.top;});
  for(const width of [320,390,650,820,1440]){
    await page.setViewportSize({width,height:1000});await jar.scrollIntoViewIfNeeded();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow at '+width);
    const paper=await jar.locator('.note-jar__paper').boundingBox(),pull=await jar.locator('.note-jar__pull').boundingBox();
    assert(pull.height>=44);assert(paper.width>200);
    assert(paper.x>=pull.x+pull.width||pull.x>=paper.x+paper.width||paper.y>=pull.y+pull.height||pull.y>=paper.y+paper.height,'Paper covers pull button at '+width);
    if([390,1440].includes(width))await jar.screenshot({path:new URL(`jar-${width}.png`,OUT).pathname,style:'.world-mast,.daily-style-corner{visibility:hidden!important}'});
  }
  await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Pause little animations'}).click();await jar.scrollIntoViewIfNeeded();await another.click();await another.waitFor();assert(await jar.evaluate(el=>el.getAnimations({subtree:true}).length===0));
  checks.push('320–1440px layouts fit; tap targets and reading surfaces remain clear; quiet/reduced motion preserve functional pulls.');
  for(const next of ['2027-09-15','2027-09-16','2028-09-15']){
    date=next;await page.reload();await jar.waitFor();
    if(date.endsWith('09-15')){await jar.getByRole('button',{name:'Blow out the candle',exact:true}).waitFor();await jar.getByRole('button',{name:'Blow out the candle',exact:true}).click();await jar.getByRole('button',{name:'Light the candle again',exact:true}).waitFor();await another.click();await another.waitFor();}
    else{await jar.locator('.note-jar__message').waitFor();assert.equal(await jar.locator('.birthday-gift').count(),0);}
  }
  await jar.getByRole('button',{name:'Light the candle again',exact:true}).click();
  await jar.screenshot({path:new URL('birthday-jar.png',OUT).pathname,style:'.world-mast,.daily-style-corner{visibility:hidden!important}'});
  checks.push('Birthday cake/candle returns on September 15 in successive years, daily jar returns September 16, and notes remain available on the birthday.');
  const admin=await browser.newContext();await admin.request.post(base+'/api/session/unlock',{headers:{'x-kw':'1'},data:{passphrase:adminPhrase}});
  const ownerBefore=await(await ctx.request.get(base+'/api/me/note-jar')).json();const preview=await(await admin.request.post(base+'/api/me/note-jar/pull',{headers:{'x-kw':'1'},data:{requestId:crypto.randomUUID()}})).json();assert(preview.preview);assert.equal((await(await ctx.request.get(base+'/api/me/note-jar')).json()).pulled,ownerBefore.pulled);
  await ctx.request.post(base+'/api/session/lock',{headers:{'x-kw':'1'},data:{}});assert.equal((await ctx.request.get(base+'/api/me/note-jar/history')).status(),401);
  assert.deepEqual(errors,[]);checks.push('Private access, write validation and admin preview isolation hold; no browser errors.');
  await writeFile(new URL('checks.json',OUT),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser?.close();await server?.close();await client.close();}
