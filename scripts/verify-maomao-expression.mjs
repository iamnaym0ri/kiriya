import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:5173";
const OUT = new URL("../.data/redesign/maomao-smoothing/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
// Review-only mount, served by Vite from the ignored QA directory. It uses the real component.
await writeFile(OUT + "review.jsx", `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import MaomaoMascot, {MAOMAO_EXPRESSIONS} from '../../../src/world/mascot/MaomaoMascot.jsx';
import {PlayContext} from '../../../src/shared/play/PlayfulContext.js';
function Review(){
 const [expression,setExpression]=useState('deadpan'),[revision,setRevision]=useState(0),[moving,setMoving]=useState(true);
 window.maomaoReview={expressions:MAOMAO_EXPRESSIONS,change:next=>{setExpression(next);setRevision(n=>n+1)},quiet:value=>setMoving(!value)};
 return <PlayContext.Provider value={{moving}}><h1 style={{font:'28px Georgia'}}>Maomao · smoother expressions</h1><div id="live-face" style={{width:260,margin:'20px auto'}}><MaomaoMascot size={260} expression={expression} reactionKey={revision}/></div><p style={{textAlign:'center',font:'20px Georgia'}}>{expression}</p></PlayContext.Provider>;
}
export function mount(){const el=document.createElement('div');el.id='maomao-review';el.style.cssText='position:absolute;top:0;left:0;width:500px;padding:30px;background:#fff9fc;z-index:9999;color:#493653;min-height:600px';document.body.append(el);createRoot(el).render(<Review/>);}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 850 } });
const page = await ctx.newPage(); page.setDefaultTimeout(12000);
const errors = [], checks = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(BASE + "/"); await page.locator('.identity-name').waitFor();
  await page.evaluate(async () => { const {mount} = await import('/.data/redesign/maomao-smoothing/review.jsx'); mount(); });
  const mascot=page.locator('#live-face .mascot');
  await mascot.waitFor(); await page.waitForFunction(()=>document.querySelector('#live-face .mascot').dataset.mascotMotion==='on');
  const smooth = await page.evaluate(async () => {
    const root=document.querySelector('#live-face'), body=root.querySelector('.mascot__float'), eye=root.querySelector('.mascot__aperture'), face=root.querySelector('.mascot__face-rig');
    const initial=eye.getAttribute('d'), samples=[];
    window.maomaoReview.change('herb');
    const start=performance.now();
    while(performance.now()-start<520){await new Promise(requestAnimationFrame); samples.push(eye.getAttribute('d'));}
    const end=eye.getAttribute('d');
    return {stable:body===root.querySelector('.mascot__float')&&face===root.querySelector('.mascot__face-rig'),initial,end,intermediate:[...new Set(samples.filter(d=>d!==initial&&d!==end))],finite:samples.every(d=>!d.includes('NaN'))};
  });
  assert(smooth.stable,'Expression changes must preserve the face and body DOM');
  assert.notEqual(smooth.initial,smooth.end);
  assert(smooth.intermediate.length>3,'Face must pass through intermediate shapes');assert(smooth.finite);
  const interrupted=await page.evaluate(async()=>{
    const root=document.querySelector('#live-face'), eye=root.querySelector('.mascot__aperture');
    window.maomaoReview.change('startled');await new Promise(resolve=>setTimeout(resolve,70));
    window.maomaoReview.change('skeptical');await new Promise(resolve=>setTimeout(resolve,70));
    const before=eye.getAttribute('d');window.maomaoReview.change('shy');
    const immediate=eye.getAttribute('d');await new Promise(resolve=>setTimeout(resolve,420));
    return {before,immediate,end:eye.getAttribute('d')};
  });
  assert.equal(interrupted.before,interrupted.immediate);assert.notEqual(interrupted.before,interrupted.end);
  checks.push('Face geometry morphs through intermediate states without replacing its DOM; interrupted reactions continue from the current face.');

  const phase=await page.evaluate(async()=>{
    const root=document.querySelector('#live-face'), breath=root.querySelector('.mascot__breath'), mask=root.querySelector('.mascot__blink-mask');
    const breathing=breath.getAnimations()[0], blink=mask.getAnimations()[0], start=breathing.currentTime, blinking=blink.currentTime;
    window.maomaoReview.change('shy');await new Promise(resolve=>setTimeout(resolve,100));
    return {breathingStable:breath.getAnimations()[0]===breathing,blinkStable:mask.getAnimations()[0]===blink,advanced:breathing.currentTime>start&&blink.currentTime>blinking};
  });
  assert(phase.breathingStable && phase.blinkStable && phase.advanced);
  await page.evaluate(()=>window.maomaoReview.change('herb')); await page.waitForTimeout(420);
  const blink=await page.evaluate(()=>{
    const root=document.querySelector('#live-face'),mask=root.querySelector('.mascot__blink-mask'),line=root.querySelector('.mascot__blink-line'),iris=root.querySelector('.mascot__iris-gaze');
    const blinking=mask.getAnimations()[0],lid=line.getAnimations()[0],blinkTime=blinking.currentTime,lidTime=lid.currentTime;
    blinking.currentTime=6700*.442;lid.currentTime=6700*.442;
    const result={scale:getComputedStyle(mask).scale,stroke:getComputedStyle(line).opacity,irisScale:getComputedStyle(iris).scale};
    blinking.currentTime=blinkTime;lid.currentTime=lidTime;return result;
  });
  assert(parseFloat(blink.scale.split(' ')[1])<.1);assert(Number(blink.stroke)>.9);assert.equal(blink.irisScale,'none');
  await page.waitForTimeout(2300);
  const replay=await page.evaluate(async()=>{
    const body=document.querySelector('#live-face .mascot__float');
    const stopped=body.getAnimations().length===0;
    window.maomaoReview.change('herb');await new Promise(resolve=>setTimeout(resolve,100));
    const animation=body.getAnimations().find(a=>a.animationName==='mascot-herb-gasp');
    const braids=[...document.querySelectorAll('#live-face .mascot__braid')].every(node=>node.getAnimations().some(a=>a.animationName==='mascot-braid-delight'&&a.currentTime<200));
    return stopped&&!!animation&&animation.currentTime<200&&braids;
  });
  assert(replay,'A repeated herb reaction must replay after its previous gesture has finished');
  checks.push('Repeated reactions preserve breathing and blink phases. Blinking closes a mask over the iris and draws a lid without squashing the eye artwork.');

  for(const expression of await page.evaluate(()=>window.maomaoReview.expressions)) {
    await page.evaluate(expression=>window.maomaoReview.change(expression),expression);await page.waitForTimeout(380);
    assert(await mascot.locator('.mascot__face-rig').evaluate(el=>[...el.querySelectorAll('path')].every(p=>p.getAttribute('d')&&!p.getAttribute('d').includes('NaN'))));
    assert(await mascot.evaluate(el=>{const box=el.getBoundingClientRect();return box.width===260&&box.height>300&&box.height<310;}));
  }
  await page.evaluate(()=>window.maomaoReview.change('sniff'));await page.waitForTimeout(400);
  assert(await mascot.locator('.mascot__sniff-hand').count());
  assert.equal(await mascot.locator('.mascot__head').evaluate(el=>getComputedStyle(el).animationName),'mascot-sniff');
  checks.push('All 17 expressions render valid facial geometry; skeptical, shy and sniff reactions have distinct faces and poses.');

  await page.evaluate(()=>{window.maomaoReview.change('herb');window.maomaoReview.quiet(true);});
  await page.waitForFunction(()=>document.querySelector('#live-face .mascot').dataset.mascotMotion==='off');
  assert.equal(await mascot.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.evaluate(()=>window.maomaoReview.change('startled'));await page.waitForTimeout(30);
  const quiet=await mascot.locator('.mascot__aperture').first().getAttribute('d');await page.waitForTimeout(150);
  assert.equal(await mascot.locator('.mascot__aperture').first().getAttribute('d'),quiet);
  await page.evaluate(()=>window.maomaoReview.quiet(false));await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#live-face .mascot').dataset.mascotMotion==='off');
  assert.equal(await mascot.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#maomao-review').evaluate(el=>el.style.top='5000px');
  await page.waitForFunction(()=>document.querySelector('#live-face .mascot').dataset.mascotMotion==='off');
  assert.equal(await mascot.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  checks.push('Quiet mode, reduced motion and offscreen placement stop both CSS motion and JS face interpolation while preserving a readable final expression.');
  await page.evaluate(()=>{window.maomaoReview.quiet(true);window.maomaoReview.change('sniff');document.querySelector('#maomao-review').style.top='0';});
  await page.locator('#maomao-review').screenshot({path:OUT+'sniff-review.png'});
  assert.deepEqual(errors,[]);
  await writeFile(OUT+'expression-checks.json',JSON.stringify({checks,errors,intermediateFrames:smooth.intermediate.length},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally { await browser.close(); }
