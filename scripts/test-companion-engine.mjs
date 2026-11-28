// The companion engine's tap menu and "stay" (src/world/companions/README.md, "The tap menu and
// stay"; docs/refactor/RENOVATION.md, "Companion contract, round 2"). The engine runs here without
// a browser: a stage with its layout stubbed, driven tick by tick.
import assert from "node:assert/strict";
import test from "node:test";
import { normaliseAction, normaliseCharacter } from "../src/world/companions/engine/character.js";
import { placeMenu } from "../src/world/companions/engine/menu.js";
import { buildLevels } from "../src/world/companions/engine/levels.js";
import { MENU_MS } from "../src/world/companions/engine/actor.js";
import { StageSim } from "../src/world/companions/engine/stage.js";
import { STAY_KEY, clearStay, placeSpot, readStay, spotAt, writeStay } from "../src/world/companions/engine/stay.js";
import { BLEND_MS, blendMs, settleKick } from "../src/world/companions/engine/blend.js";

// A phone's localStorage, enough of it.
const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
};
let phone = memoryStorage();
// Node has its own (file-backed, warning) localStorage: this test brings its own.
Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => phone });

const BAND = { top: 120, bottom: 790, left: 0, right: 414, width: 414, height: 896 };

const character = (extra = {}) =>
  normaliseCharacter({
    id: "tester",
    name: "Tester",
    Body: () => null,
    size: { width: 100, height: 120 },
    poses: ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held", "dance", "hum", "spin", "show"],
    movement: { restlessness: 1, jumpiness: 0.6, wander: 0.8, restSeconds: [0.3, 0.6], talkiness: 1 },
    behaviours: [
      { id: "pace", weight: 6, pose: "walk", roam: true, seconds: [1, 2] },
      { id: "climb", weight: 6, pose: "idle", level: "top", seconds: [1, 2] },
      { id: "dance", weight: 1, pose: "dance", seconds: [1, 2], bounce: 2, prop: "fan" },
      { id: "hum", weight: 1, pose: "hum", seconds: [1, 2], topic: "humming" },
      { id: "routine", weight: 1, steps: [{ pose: "spin", seconds: 0.6, turn: true }, { pose: "wave", seconds: 0.6 }] },
    ],
    lines: {
      greet: ["hi {name}"],
      idle: ["idle"],
      tapped: ["tapped"],
      pester: ["stop it"],
      action: ["look!"],
      stay: ["staying"],
      wander: ["off I go"],
      stayIdle: ["still here"],
      humming: ["hmm"],
      bye: ["bye"],
    },
    action: {
      id: "show",
      label: "show it a thing",
      icon: "✨",
      pose: "show",
      prop: "thing",
      expression: "curious",
      seconds: [0.8, 0.8],
      steps: [{ pose: "show", seconds: 0.8 }, { pose: "spin", prop: null, expression: "happy", seconds: 0.5, topic: "humming" }],
    },
    ...extra,
  });

/** A stage with its layout stubbed (no DOM), its band and levels set by hand. */
function makeStage({ lively = true } = {}) {
  const sim = new StageSim({});
  sim.layout = () => {};
  sim.band = { ...BAND };
  sim.scale = 0.9;
  sim.levels = buildLevels(sim.band, { count: 4, bodyWidth: 90, bodyHeight: 108 });
  sim.setOptions({ avoidText: false, visits: { enabled: false } });
  sim.lively = lively;
  sim.name = "kiriya";
  return sim;
}

const run = (sim, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) sim.tick(dt);
};
/** Taps the host once its feet are on a level (a tap mid-jump does nothing, as on the phone). */
const tapHost = (sim, options) => {
  for (let i = 0; i < 600 && ["air", "crouch", "float"].includes(sim.host.mode); i++) sim.tick(1 / 60);
  sim.host.tap(options);
};

test("An action comes back with steps, a topic and props passed down", () => {
  const a = normaliseAction({ label: "show her an herb", icon: "🌿", pose: "herb", prop: "herb", seconds: [3, 5] });
  assert.equal(a.id, "action");
  assert.equal(a.topic, "action");
  assert.equal(a.steps.length, 1);
  assert.deepEqual(a.steps[0], { pose: "herb", prop: "herb", expression: undefined, seconds: [3, 5], topic: "action", bounce: null, turn: false, chance: 1 });
  const b = normaliseAction({ id: "leek", label: "a leek", pose: "hold", prop: "leek", topic: "leek", steps: [{ seconds: 1 }, { pose: "spin", seconds: [2, 3], bounce: 3 }, { prop: null }] });
  assert.equal(b.steps[0].topic, "leek");
  assert.equal(b.steps[0].prop, "leek");
  assert.deepEqual(b.steps[0].seconds, [1, 1]);
  assert.equal(b.steps[1].pose, "spin");
  assert.equal(b.steps[1].bounce.count, 3);
  assert.equal(b.steps[2].prop, null);
  assert.equal(normaliseAction({ pose: "x" }), null, "no label, no action");
  const c = normaliseAction({ label: "maybe", steps: [{ pose: "a" }, { pose: "b", chance: 0.3 }, { pose: "c", chance: 7 }] });
  assert.deepEqual(c.steps.map((step) => step.chance), [1, 0.3, 1]);
  assert.equal(normaliseAction(null), null);
});

test("Stay spots are kept per character, cleaned, and placed on today's levels", () => {
  localStorage.clear();
  assert.equal(readStay("maomao"), null);
  assert.ok(writeStay("maomao", { x: 0.25, level: 2 }));
  assert.ok(writeStay("kaito", { x: 1.4, level: -3 }));
  assert.deepEqual(readStay("maomao"), { x: 0.25, level: 2 });
  assert.deepEqual(readStay("kaito"), { x: 1, level: 0 }, "out-of-range values are clamped");
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(STAY_KEY))), ["maomao", "kaito"]);
  clearStay("maomao");
  assert.equal(readStay("maomao"), null);
  clearStay("kaito");
  assert.equal(localStorage.getItem(STAY_KEY), null, "nothing left: the key goes");
  localStorage.setItem(STAY_KEY, "{not json");
  assert.equal(readStay("maomao"), null, "a broken value is ignored");
  localStorage.clear();

  const levels = buildLevels(BAND, { count: 3, bodyWidth: 90, bodyHeight: 108 });
  const here = spotAt(300, 1, BAND);
  assert.ok(Math.abs(here.x - 300 / 414) < 1e-9 && here.level === 1);
  const there = placeSpot({ x: 0.5, level: 5 }, levels, BAND);
  assert.equal(there.level, 2, "a level that no longer exists becomes the top one");
  assert.ok(there.x >= levels[2].x0 && there.x <= levels[2].x1);
  const edge = placeSpot({ x: 0, level: 0 }, levels, BAND);
  assert.equal(edge.x, levels[0].x0, "kept inside the level's span");
});

test("Storage that refuses doesn't break staying", () => {
  const saved = phone;
  const deny = () => {
    throw new Error("denied");
  };
  phone = { getItem: deny, setItem: deny, removeItem: deny };
  assert.equal(readStay("maomao"), null);
  assert.equal(writeStay("maomao", { x: 0.5, level: 0 }), false);
  assert.equal(clearStay("maomao"), true, "nothing to forget");
  phone = saved;
});

test("The menu goes beside the character when there is room, and is always inside the band", () => {
  const size = { column: { w: 180, h: 104 }, row: { w: 290, h: 54 } };
  const inside = (p) => p.left >= BAND.left + 8 && p.left + p.w <= BAND.right - 8 && p.top >= BAND.top + 8 && p.top + p.h <= BAND.bottom - 8;
  const at = (x, feet) => ({ x, feet, w: 66, h: 104, cloud: 22 });

  const nearLeft = placeMenu({ band: BAND, actor: at(70, 500), size });
  assert.equal(nearLeft.side, "right");
  assert.equal(nearLeft.layout, "column");
  assert.ok(inside(nearLeft));

  const nearRight = placeMenu({ band: BAND, actor: at(360, 500), size });
  assert.equal(nearRight.side, "left");
  assert.ok(inside(nearRight));

  // Centred on a narrow phone: no room beside, so under its cloud…
  const narrow = { ...BAND, right: 375, width: 375 };
  const centred = placeMenu({ band: narrow, actor: at(187, 400), size });
  assert.equal(centred.side, "below");
  assert.equal(centred.layout, "row");
  // …or, on the bottom level, over its head (and over the bubble there).
  const bubble = { left: 120, right: 260, top: 236, bottom: 280 };
  const bottom = placeMenu({ band: narrow, actor: at(187, 768), size, bubble: { ...bubble, top: 610, bottom: 656 } });
  assert.equal(bottom.side, "above");
  assert.ok(bottom.top + bottom.h <= 610, "above the bubble, not on it");

  // Right under the top bars: still never above the band.
  const top = placeMenu({ band: BAND, actor: at(70, 250), size });
  assert.ok(top.top >= BAND.top + 8);

  // A bubble beside its head on the right pushes the menu to the left.
  const avoid = placeMenu({ band: BAND, actor: at(207, 300), size: { column: { w: 150, h: 104 }, row: size.row }, bubble: { left: 240, right: 400, top: 190, bottom: 260 } });
  assert.equal(avoid.side, "left");

  // Every spot across a 375 pt phone, every level: inside the band.
  for (let x = 40; x <= 335; x += 15) for (let feet = 240; feet <= 768; feet += 44) {
    const p = placeMenu({ band: narrow, actor: at(x, feet), size });
    assert.ok(p.left >= 8 && p.left + p.w <= 367 && p.top >= BAND.top + 8 && p.top + p.h <= BAND.bottom - 8, `x ${x} feet ${feet}: ${JSON.stringify(p)}`);
  }
});

test("A tap opens the menu for the host only, and it closes on its own", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 2);
  tapHost(sim);
  assert.ok(host.view.get().menu, "menu open");
  assert.equal(host.view.get().bubble.text, "tapped");
  run(sim, 2);
  assert.ok(host.menu, "still open after 2 s");
  assert.equal(host.step.type, "hold", "it waits for her choice");
  const x = host.x;
  run(sim, 2);
  assert.equal(host.x, x, "it didn't wander off while she was choosing");
  host.menu.at -= MENU_MS;
  sim.tick(1 / 60);
  assert.equal(host.view.get().menu, null, "closed after 5 s of nothing");

  // A visitor only says something.
  const visitor = new host.constructor(sim, character({ id: "guest" }), { role: "visitor" });
  visitor.placeAt(0, 300, "instant");
  visitor.tap();
  assert.equal(visitor.view.get().menu, null);

  // Three quick taps: pester (the menu stays).
  tapHost(sim);
  run(sim, 0.9);
  tapHost(sim);
  run(sim, 0.9);
  tapHost(sim);
  assert.equal(host.view.get().bubble.text, "stop it");
  assert.ok(host.menu);
  host.closeMenu("outside");
  assert.equal(host.menu, null);
});

test("The action plays its steps with their poses, props and lines", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 2);
  tapHost(sim);
  run(sim, 0.6);
  host.choose("action");
  assert.equal(host.menu, null);
  run(sim, 0.05);
  assert.equal(host.view.get().pose, "show");
  assert.equal(host.view.get().prop, "thing");
  assert.equal(host.view.get().expression, "curious");
  assert.equal(host.view.get().bubble.text, "look!", "says an action line");
  run(sim, 0.85);
  assert.equal(host.view.get().pose, "spin");
  assert.equal(host.view.get().prop, null, "the second step puts it away");
  run(sim, 0.6);
  assert.notEqual(host.view.get().pose, "spin");
  assert.equal(host.view.get().prop, null);
});

test("Told to stay, it never travels, whatever it would like to do", () => {
  localStorage.clear();
  const free = makeStage();
  free.setHost(character());
  const before = { x: free.host.x, level: free.host.level };
  run(free, 40);
  assert.ok(free.host.x !== before.x || free.host.level !== before.level, "left alone it moves about (sanity)");

  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1);
  tapHost(sim);
  run(sim, 0.6);
  host.choose("stay");
  assert.equal(host.view.get().bubble.text, "staying");
  assert.ok(host.staying && host.view.get().staying);
  run(sim, 1);
  const spot = { x: host.x, level: host.level };
  const saved = readStay("tester");
  assert.ok(saved && saved.level === spot.level, "kept on the phone");
  const seen = new Set();
  const props = new Set();
  for (let i = 0; i < 120 * 60; i++) {
    sim.tick(1 / 60);
    if (host.mode !== "air" && host.mode !== "crouch") {
      assert.equal(host.level, spot.level, `left its level at ${i}`);
      assert.ok(Math.abs(host.x - spot.x) < 0.5, `moved ${host.x - spot.x}px at ${i}`);
    }
    if (host.behaviour) seen.add(host.behaviour.id);
    props.add(host.view.get().prop);
    assert.notEqual(host.mode, "walk");
    assert.notEqual(host.mode, "float");
  }
  assert.ok(!seen.has("pace") && !seen.has("climb"), `only in-place behaviours: ${[...seen]}`);
  assert.ok(seen.has("dance") && seen.has("hum") && seen.has("routine"), `all of them: ${[...seen]}`);
  assert.ok(props.has("fan"), "a behaviour's prop reaches the body");

  // Tapping while staying: the menu offers wander.
  tapHost(sim);
  assert.ok(host.view.get().staying);
  run(sim, 0.6);
  host.choose("wander");
  assert.equal(host.staying, false);
  assert.equal(readStay("tester"), null, "forgotten");
  assert.equal(host.view.get().bubble.text, "off I go");
});

test("Dropped while staying, it lands straight below and that becomes its spot", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1);
  host.setStay(true);
  run(sim, 0.5);
  const start = { x: host.x, level: host.level };
  const dropX = start.x > 207 ? 90 : 320;
  host.pointerDown({ pointerId: 1, clientX: start.x, clientY: host.y - 50 });
  host.pointerMove({ pointerId: 1, clientX: start.x + 12, clientY: host.y - 50 });
  assert.equal(host.mode, "held");
  // Carried up and across, then flung sideways as she lets go.
  for (let i = 1; i <= 30; i++) {
    host.pointerMove({ pointerId: 1, clientX: start.x + ((dropX - start.x) * i) / 30, clientY: 200 });
    sim.tick(1 / 60);
  }
  host.pointer.vx = 2400;
  run(sim, 0.4);
  host.pointerUp({ pointerId: 1, type: "pointerup" });
  run(sim, 2);
  assert.equal(host.mode === "air", false);
  assert.ok(Math.abs(host.x - dropX) < 6, `no throw while staying: ${host.x} vs ${dropX}`);
  assert.ok(host.staying);
  const saved = readStay("tester");
  assert.equal(saved.level, host.level);
  assert.ok(Math.abs(saved.x - host.x / 414) < 0.01);
  const level = host.level;
  run(sim, 30);
  assert.equal(host.level, level);
  assert.ok(Math.abs(host.x - dropX) < 6);
});

test("A staying character is on its spot next time home opens", () => {
  localStorage.clear();
  writeStay("tester", { x: 0.8, level: 1 });
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  assert.ok(host.staying);
  assert.equal(host.level, 1);
  const expected = placeSpot({ x: 0.8, level: 1 }, sim.levels, sim.band).x;
  assert.ok(Math.abs(host.x - expected) < 0.5);
  run(sim, 20);
  assert.equal(host.level, 1);
  assert.ok(Math.abs(host.x - expected) < 0.5);
  localStorage.clear();
});

test("Quiet mode: the menu, the action and stay still work, without hops", () => {
  localStorage.clear();
  const sim = makeStage({ lively: false });
  sim.setHost(character());
  const host = sim.host;
  run(sim, 2);
  tapHost(sim);
  assert.ok(host.menu);
  host.choose("action");
  run(sim, 0.05);
  assert.equal(host.view.get().pose, "show");
  host.setStay(true, { say: true });
  run(sim, 30);
  assert.equal(host.hopY, 0);
  assert.equal(host.bounce, null);
  localStorage.clear();
});

test("A step with a chance plays only that often", () => {
  const sim = makeStage();
  sim.setHost(character({ action: { label: "sometimes", pose: "show", steps: [{ pose: "show", seconds: 0.2 }, { pose: "spin", seconds: 0.2, chance: 0 }, { pose: "dance", seconds: 0.2, chance: 0.5 }] } }));
  run(sim, 1);
  const host = sim.host;
  let spins = 0;
  let dances = 0;
  for (let i = 0; i < 40; i++) {
    host.runAction();
    const poses = host.plan.filter((s) => s.type === "act").map((s) => s.s.pose);
    if (poses.includes("spin")) spins++;
    if (poses.includes("dance")) dances++;
  }
  assert.equal(spins, 0);
  assert.ok(dances > 5 && dances < 35, `about half: ${dances}`);
});

test("Nothing moves it off somewhere in the middle of its action, and travelling puts the prop down", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 2);
  tapHost(sim);
  run(sim, 0.6);
  host.choose("action");
  run(sim, 0.05);
  // Pretend she stopped scrolling over text: the host would normally go somewhere clearer.
  const at = { x: host.x, level: host.level };
  sim.options.avoidText = true;
  sim.spotScore = (_actor, level, x) => (level === at.level && Math.abs(x - at.x) < 2 ? 1 : 0);
  sim.scrollAt = sim.time - 1;
  run(sim, 0.5);
  assert.equal(host.view.get().pose, "show", "still showing it");
  assert.deepEqual({ x: host.x, level: host.level }, at);
  // A real jump elsewhere drops the prop.
  host.interrupt([...host.pathTo(host.level + 1 < sim.levels.length ? host.level + 1 : host.level - 1, host.x), { type: "rest" }]);
  run(sim, 0.3);
  assert.equal(host.view.get().prop, null);
});

test("Characters without an action still get stay", () => {
  const c = character({ action: undefined });
  assert.equal(c.action, null);
  const sim = makeStage();
  sim.setHost(c);
  run(sim, 1);
  tapHost(sim);
  assert.ok(sim.host.menu);
  assert.equal(sim.host.runAction(), false);
});

// --- Round 3: transitions (README.md, "Transitions") ------------------------------------------------

test("Each change of pose blends for a time that suits the move", () => {
  const how = { restPose: "idle", walkPose: "walk", lively: true };
  assert.equal(blendMs("idle", "react", how), BLEND_MS.quick, "a reaction is quick");
  assert.equal(blendMs("walk", "crouch", how), BLEND_MS.quick, "so is a jump");
  assert.equal(blendMs("idle", "walk", how), BLEND_MS.walk);
  assert.equal(blendMs("walk", "idle", how), BLEND_MS.stop, "coming to a stop");
  assert.equal(blendMs("dance", "idle", how), BLEND_MS.settle, "settling is the softest");
  assert.equal(blendMs("idle", "sit", how), BLEND_MS.settle);
  assert.equal(blendMs("land", "dance", how), BLEND_MS.settle, "after landing it settles first");
  assert.equal(blendMs("idle", "dance", how), BLEND_MS.step);
  assert.equal(blendMs("idle", "dance", { ...how, lively: false }), BLEND_MS.quiet, "quiet: one short plain fade");
  for (const ms of Object.values(BLEND_MS)) assert.ok(ms >= 80 && ms <= 240, `${ms} ms: never a snap, never sluggish`);
});

test("Weight shifts with the pose: sitting sinks, getting up stretches, travel has its own", () => {
  const how = { restPose: "idle", walkPose: "walk", squash: 1 };
  const [sx, sy] = settleKick("idle", "sit", how);
  assert.ok(sx > 0 && sy < 0, "sits down: wider and lower");
  const [ux, uy] = settleKick("sit", "idle", how);
  assert.ok(ux < 0 && uy > 0, "gets up: a little stretch");
  assert.equal(settleKick("idle", "walk", how), null, "walking has its own motion");
  assert.equal(settleKick("idle", "crouch", how), null, "so do jumps");
  assert.equal(settleKick("idle", "idle", how), null);
  assert.equal(settleKick("idle", "dance", { ...how, squash: 0 }), null, "squash 0: none");
});

test("setPose hands the blend time to the view, and only on a real change", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1);
  host.interrupt([{ type: "wait", pose: "idle", seconds: [9, 9] }]);
  run(sim, 1);
  host.setPose("sit");
  assert.equal(host.view.get().pose, "sit");
  assert.equal(host.view.get().blend, BLEND_MS.settle);
  assert.ok(host.svy < 0, "sitting down pushes the squash spring down");
  host.setPose("react");
  assert.equal(host.view.get().blend, BLEND_MS.quick);
  const before = host.view.get();
  host.setPose("react");
  assert.equal(host.view.get(), before, "same pose: nothing re-renders");
});

test("The tap's little hop is one startled jump: no crouch or take-off poses flicking past", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character({ poses: ["idle", "walk", "crouch", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held", "dance", "hum", "spin", "show"] }));
  const host = sim.host;
  run(sim, 2);
  tapHost(sim);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    sim.tick(1 / 60);
    seen.add(host.view.get().pose);
  }
  assert.ok(seen.has("react"));
  for (const pose of ["crouch", "jump", "fall", "land"]) assert.ok(!seen.has(pose), `no ${pose} during the tap's hop`);
  // A real jump still crouches, takes off and lands in its own poses.
  host.closeMenu("away");
  host.interrupt([{ type: "jump", level: host.level + 1 < sim.levels.length ? host.level + 1 : host.level - 1, to: host.x + 30 }, { type: "rest" }]);
  const jumped = new Set();
  for (let i = 0; i < 120; i++) {
    sim.tick(1 / 60);
    jumped.add(host.view.get().pose);
  }
  for (const pose of ["crouch", "jump", "land"]) assert.ok(jumped.has(pose), `a real jump has ${pose}`);
});

test("After travelling it takes a breath in its rest pose before starting something new", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1);
  const dance = host.c.behaviours.find((b) => b.id === "dance");
  const level = sim.levels[host.level];
  host.interrupt([{ type: "walk", to: Math.min(level.x1, host.x + 40) > host.x + 10 ? Math.min(level.x1, host.x + 40) : Math.max(level.x0, host.x - 40) }, { type: "behave", b: dance }]);
  const poses = [];
  for (let i = 0; i < 600 && host.step?.type !== "behave"; i++) {
    sim.tick(1 / 60);
    if (poses.at(-1) !== host.view.get().pose) poses.push(host.view.get().pose);
  }
  assert.deepEqual(poses.slice(-3), ["walk", "idle", "dance"], `walk, a breath, then the dance (saw ${poses.join(" → ")})`);
  // Quiet mode doesn't walk, so there is nothing to settle from.
  const quiet = makeStage({ lively: false });
  quiet.setHost(character());
  run(quiet, 1);
  quiet.host.settleNext = true;
  quiet.host.interrupt([{ type: "behave", b: dance }]);
  quiet.tick(1 / 60);
  assert.equal(quiet.host.view.get().pose, "dance");
});

test("Setting off and stopping lean the body a little, and it comes back upright", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1);
  const level = sim.levels[host.level];
  const to = host.x - level.x0 > level.x1 - host.x ? level.x0 + 10 : level.x1 - 10;
  host.interrupt([{ type: "walk", to }, { type: "rest", seconds: [30, 30] }]);
  let most = 0;
  let forward = 0;
  for (let i = 0; i < 60 * 12; i++) {
    sim.tick(1 / 60);
    most = Math.max(most, Math.abs(host.lean));
    if (host.step?.type === "rest") break;
  }
  for (let i = 0; i < 20; i++) {
    sim.tick(1 / 60);
    forward = Math.max(forward, host.lean);
  }
  assert.ok(most > 0.3, "it leans");
  assert.ok(most <= 4, "never more than a few degrees");
  assert.ok(forward > 0, "stopping, it carries on forward a touch");
  run(sim, 2);
  assert.equal(host.lean, 0, "and settles upright");
});

// --- Round 3b: on every page (README.md, "Every page") -----------------------------------------------

test("A new page: within a moment it walks or hops off anything she is reading", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1.5);
  host.interrupt([{ type: "wait", pose: "idle", seconds: [30, 30] }]);
  run(sim, 0.1);
  // The new page has text right where it stands, and clear room elsewhere.
  const at = { level: host.level, x: host.x };
  sim.options.avoidText = true;
  sim.spotScore = (_a, level, x) => (level === at.level && Math.abs(x - at.x) < 60 ? 1 : 0);
  sim.pageChanged();
  run(sim, 0.7);
  assert.notEqual(host.step?.type, "wait", "its little pause was cut short for it");
  run(sim, 6);
  assert.ok(host.level !== at.level || Math.abs(host.x - at.x) >= 60, "it moved somewhere clear");
});

test("Nowhere clear of what she is reading: it steps aside, and comes back when there is room", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1.5);
  host.interrupt([{ type: "rest", seconds: [30, 30] }]);
  run(sim, 0.1);
  sim.options.avoidText = true;
  let busy = 3; // the chat's newest messages, everywhere (the keyboard is up)
  sim.spotScore = () => busy;
  let told = null;
  sim.onAside = (on) => (told = on);
  sim.pageChanged();
  run(sim, 0.7);
  assert.equal(sim.aside, true, "stepped aside");
  assert.equal(told, true);
  assert.ok(sim.ticker.reasons.includes("aside"), "and paused");
  sim.recheckAside();
  assert.equal(sim.aside, true, "still nowhere clear");
  busy = 0; // the keyboard went down
  sim.recheckAside();
  assert.equal(sim.aside, false, "back");
  assert.ok(!sim.ticker.reasons.includes("aside"));
});

test("When its level moves (a new page, the keyboard) it glides there instead of jumping", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1.5);
  for (let i = 0; i < 600 && host.level == null; i++) sim.tick(1 / 60);
  host.interrupt([{ type: "wait", pose: "idle", seconds: [30, 30] }]);
  run(sim, 0.05);
  host.glideFrom(40);
  assert.equal(host.glideY, 40, "starts where it was");
  run(sim, 0.15);
  assert.ok(host.glideY > 0 && host.glideY < 40, "on its way");
  run(sim, 0.2);
  assert.equal(host.glideY, 0, "there");
  // Quiet mode: just there.
  sim.setLively(false);
  host.glideFrom(40);
  assert.equal(host.glideY, 0);
});

test("Each decision looks under only a few spots once its time budget is spent", () => {
  localStorage.clear();
  const sim = makeStage();
  sim.setHost(character());
  const host = sim.host;
  run(sim, 1);
  let looks = 0;
  sim.spotScore = () => {
    looks++;
    const until = performance.now() + 2; // a slow page: each look takes 2 ms
    while (performance.now() < until);
    return 0.5;
  };
  host.planMove(null, { force: true, better: 0.9, anyLevel: true });
  assert.ok(looks >= 3, "always at least three spots");
  assert.ok(looks <= 4, `stopped once the budget was spent (${looks} looks)`);
});
