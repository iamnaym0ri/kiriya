// One character on the stage: where it is, what it is doing, and what it plans to do next.
//
// Everything that changes every frame (position, squash, sway, the turn) is written straight to
// its DOM nodes as transforms. Everything that changes now and then (pose, expression, the clouds,
// the speech bubble) goes through a tiny store that React reads, so React renders a few times a
// second at most, never per frame. All timing runs on the stage's clock, which stops when the
// stage is paused, so a hidden home costs nothing and picks up where it left off.
import { motionValue } from "motion/react";
import { staysPut } from "./character.js";
import { placeMenu } from "./menu.js";
import { clearStay, spotAt, writeStay } from "./stay.js";
import { createLinePicker, fillName, greetTopics, readMs } from "./talk.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

/** A small external store for the parts of an actor React renders. */
function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      let changed = false;
      for (const key in patch) if (state[key] !== patch[key]) changed = true;
      if (!changed) return;
      state = { ...state, ...patch };
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

let actorSeq = 0;
let tileSeq = 0;
let lineSeq = 0;
let menuSeq = 0;

/** The tap menu closes by itself after this long without a choice (README.md). */
export const MENU_MS = 5000;
/** Steps that take it somewhere else; none of them run while it is told to stay. */
const TRAVEL = new Set(["walk", "jump", "float"]);

export class Actor {
  constructor(stage, character, { role = "host" } = {}) {
    this.stage = stage;
    this.c = character;
    this.m = character.movement;
    this.role = role;
    this.key = `${character.id}-${++actorSeq}`;
    this.pick = createLinePicker(character.lines);
    this.resize();

    // Where the feet are, in viewport px, and how it is moving.
    this.x = -999;
    this.y = -999;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.stride = 0;
    this.level = null; // index into stage.levels while standing on one
    this.facing = 1;
    this.turn = 1; // animates toward facing: -1..1, the paper-cutout turn
    // Squash and stretch: springs toward 1.
    this.sx = 1;
    this.sy = 1;
    this.svx = 0;
    this.svy = 0;
    this.squashTarget = [1, 1];
    // Swing while carried: a spring toward a target angle (degrees).
    this.rot = 0;
    this.rotV = 0;
    this.rotTarget = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.opacity = 0;
    this.opacityTarget = 1;
    this.opacityRate = 4;

    this.mode = "rest";
    this.step = null;
    this.plan = [];
    this.until = Infinity;
    this.gone = false;
    this.behaviour = null;
    this.lastBehaviour = null;
    this.moment = null; // { expression, until }: a brief expression from tapping, picking up…
    this.sayAt = null; // { topic, at }: a remark queued a beat after starting a behaviour
    this.staying = false; // told to stay: it never travels, and `spot` is where it stays
    this.spot = null; // { x: 0..1, level } (stay.js)
    this.menu = null; // { id, at, focus } while the tap menu is open
    this.menuSize = null; // { column: { w, h }, row: { w, h } }, measured by ActorView
    this.menuPlace = null;
    this.bubbleRect = null;
    this.bounce = null; // { t0, count, height, every, hops }: little hops on the spot
    this.hopY = 0;

    this.tiles = [];
    this.ride = null; // { id, state, at } for "ride" platforms: the one cloud it sits on
    this.pointer = null;
    this.taps = [];
    this.bubbleUntil = 0;
    this.bubbleSize = { w: 180, h: 44 };
    this.bubblePlace = "";

    this.frame = {
      time: motionValue(0),
      stride: motionValue(0),
      speed: motionValue(0),
      vy: motionValue(0),
    };
    this.view = createStore({
      pose: character.resolvePose(this.m.restPose),
      expression: undefined,
      facing: 1,
      tiles: [],
      ride: null,
      bubble: null,
      talking: false,
      held: false,
      prop: null,
      menu: null,
      staying: false,
    });
    this.els = {};
  }

  /** Body and platform sizes at the stage's current scale. */
  resize() {
    const scale = this.stage.scale * (this.c.scale ?? 1);
    this.scale = scale;
    this.w = this.c.size.width * scale;
    this.h = this.c.size.height * scale;
    this.pw = this.m.platformWidth * scale;
    this.surface = this.c.platformSurface * scale;
  }

  attach(name, el) {
    this.els[name] = el;
    if (name === "root" && el) this.write(true);
  }

  // --- Small helpers -----------------------------------------------------------------------------

  get time() {
    return this.stage.time;
  }
  get lively() {
    return this.stage.lively;
  }
  get levelObj() {
    return this.level == null ? null : this.stage.levels[this.level];
  }
  setPose(pose) {
    this.view.set({ pose: this.c.resolvePose(pose) });
  }
  baseExpression() {
    if (this.moment && this.moment.until > this.time) return this.moment.expression;
    if (this.mode === "walk") return this.m.expressions.walk ?? this.behaviour?.expression;
    if (this.mode === "air" || this.mode === "crouch") return this.m.expressions.jump ?? this.behaviour?.expression;
    return this.behaviour?.expression;
  }
  refreshExpression() {
    const bubble = this.view.get().bubble;
    this.view.set({ expression: bubble?.expression ?? this.baseExpression(), prop: this.mode === "held" ? null : (this.behaviour?.prop ?? null) });
  }
  get inVisit() {
    const v = this.stage.visit;
    return !!v && (v.host === this || v.visitor === this);
  }
  setMoment(name, seconds = 2.2) {
    const expression = this.m.expressions[name];
    this.moment = expression ? { expression, until: this.time + seconds } : null;
    this.refreshExpression();
  }
  face(direction) {
    if (!direction || direction === this.facing) return false;
    this.facing = direction > 0 ? 1 : -1;
    this.view.set({ facing: this.facing });
    if (!this.lively || !this.m.flip) this.turn = this.facing;
    return true;
  }

  // --- Talking -----------------------------------------------------------------------------------

  /** Says a line from the first topic that has one. Returns the line, or null if none. */
  say(topics, { aside = false } = {}) {
    let line = null;
    if (topics && typeof topics === "object" && !Array.isArray(topics)) line = topics;
    else for (const topic of [].concat(topics)) if ((line = this.pick(topic))) break;
    if (!line) return null;
    const text = fillName(line.text, this.stage.name);
    this.view.set({ bubble: { id: ++lineSeq, text, aside, expression: line.expression }, talking: true });
    this.refreshExpression();
    this.bubbleUntil = this.time + (readMs(text) / 1000) * (this.lively ? 1 : 1.25);
    if (aside) this.stage.lastAside = this.time;
    return line;
  }
  hush() {
    this.view.set({ bubble: null, talking: false });
    this.bubbleRect = null;
    this.refreshExpression();
  }
  /** Something unprompted: the behaviour's topic, now and then something sweet. */
  muse(topic) {
    if (this.time - this.stage.lastAside < this.stage.chatGap) return;
    const topics = [];
    if (this.stage.birthday && Math.random() < 0.3) topics.push("birthday");
    if (Math.random() < 0.22) topics.push("sweet");
    // Told to stay, it now and then remarks on staying put instead of the behaviour's own topic.
    if (this.staying && (!topic || Math.random() < 0.4)) topics.push("stayIdle");
    if (topic) topics.push(topic);
    topics.push("idle");
    this.say(topics, { aside: true });
  }
  greet() {
    this.say(greetTopics(new Date(), { birthday: this.stage.birthday }));
  }

  // --- Placement ---------------------------------------------------------------------------------

  /** Puts it on a level at x, at rest, with its cloud. `how`: "appear" (fade in) or "instant". */
  placeAt(levelIndex, x, how = "appear") {
    const level = this.stage.levels[levelIndex];
    this.level = levelIndex;
    this.x = clamp(x, level.x0, level.x1);
    this.y = level.y;
    this.vx = this.vy = this.speed = 0;
    this.mode = "rest";
    this.opacity = how === "instant" ? 1 : 0;
    this.opacityTarget = 1;
    this.opacityRate = 3.2;
    this.clearTiles();
    this.groundTile(true);
    this.write(true);
  }

  /** Drops in from above the band onto a level (a new pick arriving), or fades in when quiet. */
  dropIn(levelIndex, x) {
    const level = this.stage.levels[levelIndex];
    if (!this.lively) {
      this.placeAt(levelIndex, x);
      return;
    }
    this.level = null;
    this.x = clamp(x, level.x0, level.x1);
    this.y = this.stage.band.top - 8;
    this.opacity = 0;
    this.opacityTarget = 1;
    this.opacityRate = 8;
    this.vx = 0;
    this.vy = 80 * this.scale;
    this.fall = { level: levelIndex, x: this.x };
    this.mode = "air";
    this.setPose("fall");
    this.plan = [];
    this.write(true);
  }

  /** Arrives from beyond an edge of the screen, walking (or gliding) in along a level. */
  enterFrom(side, levelIndex, toX) {
    const level = this.stage.levels[levelIndex];
    const band = this.stage.band;
    this.level = levelIndex;
    this.y = level.y;
    if (!this.lively) {
      this.placeAt(levelIndex, toX);
      this.face(-side);
      return;
    }
    this.x = side < 0 ? band.left - this.w * 0.7 : band.right + this.w * 0.7;
    this.opacity = 1;
    this.opacityTarget = 1;
    this.face(-side);
    this.turn = this.facing;
    if (this.m.platform === "ride") this.ride = { id: ++tileSeq, state: "steady", at: this.time };
    this.plan.unshift({ type: "walk", to: toX, off: true });
    this.mode = "rest";
    this.until = 0;
    this.write(true);
  }

  // --- Planning ----------------------------------------------------------------------------------

  pickBehaviour() {
    const hour = new Date().getHours();
    // Told to stay: only what it can do where it stands.
    const allowed = this.staying ? this.c.behaviours.filter(staysPut) : this.c.behaviours;
    const pool = allowed.filter((b) => {
      if (!this.lively && b.quiet === false) return false;
      if (Array.isArray(b.hours)) {
        const [from, to] = b.hours;
        const inside = from <= to ? hour >= from && hour < to : hour >= from || hour < to;
        if (!inside) return false;
      }
      return true;
    });
    const list = pool.length ? pool : allowed.length ? allowed : [this.restBehaviour()];
    const weights = list.map((b) => (b.weight ?? 1) * (b === this.lastBehaviour && list.length > 1 ? 0.25 : 1));
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((roll -= weights[i]) <= 0) return list[i];
    return list[0];
  }

  /** Staying with nothing it may do in place: it just settles where it is. */
  restBehaviour() {
    this.stayRest ??= { id: "stay-rest", weight: 1, pose: this.m.restPose, seconds: this.m.restSeconds, say: this.m.talkiness, stay: true, prop: null, bounce: null, steps: null };
    return this.stayRest;
  }

  /** What to do next when left alone: maybe go somewhere, then a behaviour, then settle. */
  decide() {
    if (this.role === "visitor") {
      this.plan.push({ type: "rest", seconds: [1, 1] });
      return;
    }
    const b = this.pickBehaviour();
    const steps = [];
    if (this.lively && this.level != null && !b.stay && !this.staying) {
      const here = this.stage.spotScore(this, this.level, this.x);
      if (Math.random() < this.m.restlessness || here > 0.3 || b.level) steps.push(...this.planMove(b));
      if (b.roam) steps.push(...this.planRoam(b));
    }
    steps.push({ type: "behave", b });
    if (b.pose !== this.m.restPose && this.m.restSeconds[1] > 0) steps.push({ type: "rest" });
    this.plan.push(...steps);
  }

  /** A path to a good spot: a walk on this level, or hops (or a float) to another one. */
  planMove(b = null, { force = false, better = null } = {}) {
    const levels = this.stage.levels;
    if (this.level == null || !levels.length) return [];
    let targets;
    if (b?.level === "top") targets = [levels.length - 1];
    else if (b?.level === "bottom") targets = [0];
    else if (better != null) {
      // Getting off something she wants to read: look here and on the levels either side.
      targets = [this.level, this.level + 1, this.level - 1].filter((i) => i >= 0 && i < levels.length);
    } else if (levels.length > 1 && Math.random() < this.m.jumpiness) {
      const up = this.level + 1 < levels.length;
      const down = this.level > 0;
      targets = [up && down ? this.level + (Math.random() < 0.5 ? 1 : -1) : up ? this.level + 1 : this.level - 1];
    } else targets = [this.level];
    const reach = this.stage.band.width * this.m.wander;
    // A handful of candidates along each level, judged by what's underneath and how far away.
    const candidates = [];
    for (const target of targets) {
      const level = levels[target];
      const count = targets.length > 1 ? 4 : 6;
      for (let i = 0; i < count; i++) {
        const x = i < count / 2
          ? clamp(this.x + (Math.random() * 2 - 1) * reach, level.x0, level.x1)
          : level.x0 + Math.random() * (level.x1 - level.x0);
        const busy = this.stage.spotScore(this, target, x);
        const cost = busy * 2 + (Math.abs(x - this.x) / this.stage.band.width) * 0.5 + (target === this.level ? 0 : 0.2) + Math.random() * 0.25;
        candidates.push({ target, x, cost, busy });
      }
    }
    // Moving off something only makes sense if the new spot is clearly clearer.
    const pool = better != null ? candidates.filter((c) => c.busy <= better) : candidates;
    if (!pool.length) return [];
    pool.sort((a, c) => a.cost - c.cost);
    const { target, x: tx } = pool[0];
    if (target === this.level) {
      if (!force && Math.abs(tx - this.x) < 24 * this.scale) return [];
      return [{ type: "walk", to: tx }];
    }
    return this.pathTo(target, tx);
  }

  /** Steps from where it stands to x on another level, one level at a time. */
  pathTo(target, tx) {
    const levels = this.stage.levels;
    const steps = [];
    const reach = this.m.maxJumpX * this.scale;
    let from = this.level;
    let px = this.x;
    if (!this.m.hop) {
      // Floating carries it straight there; just keep the drift sideways modest.
      const level = levels[target];
      const land = clamp(tx, level.x0, level.x1);
      return [{ type: "float", level: target, to: land }];
    }
    while (from !== target) {
      const next = from + Math.sign(target - from);
      const a = levels[from];
      const b = levels[next];
      let land = clamp(next === target ? tx : tx, b.x0, b.x1);
      let off = clamp(px, a.x0, a.x1);
      if (Math.abs(land - off) > reach) off = clamp(land - Math.sign(land - off) * reach * 0.85, a.x0, a.x1);
      if (Math.abs(land - off) > reach) land = clamp(off + Math.sign(land - off) * reach, b.x0, b.x1);
      // A little sideways travel makes the hop read as a hop, not a lift.
      if (Math.abs(land - off) < 18 * this.scale) {
        const dir = off < (b.x0 + b.x1) / 2 ? 1 : -1;
        land = clamp(off + dir * 34 * this.scale, b.x0, b.x1);
      }
      if (Math.abs(off - px) > 6) steps.push({ type: "walk", to: off });
      steps.push({ type: "jump", level: next, to: land });
      px = land;
      from = next;
    }
    if (Math.abs(tx - px) > 24 * this.scale) steps.push({ type: "walk", to: clamp(tx, levels[target].x0, levels[target].x1) });
    return steps;
  }

  /** A behaviour with roam: true keeps it on the move for a while (pacing, dancing about). */
  planRoam(b) {
    const steps = [];
    const level = this.stage.levels[this.level];
    let x = this.x;
    const legs = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < legs; i++) {
      const span = (60 + Math.random() * 120) * this.scale;
      const dir = x + span > level.x1 ? -1 : x - span < level.x0 ? 1 : Math.random() < 0.5 ? -1 : 1;
      x = clamp(x + dir * span, level.x0, level.x1);
      steps.push({ type: "walk", to: x, pose: b.roamPose ?? this.m.walkPose, speed: b.roamSpeed ?? 1 });
      if (Math.random() < 0.5) steps.push({ type: "wait", seconds: [0.6, 1.4], pose: b.pose });
    }
    return steps;
  }

  /**
   * What to carry on with after a tap or a choice: what it was doing (shortened, unless a visit is
   * holding it there) and the rest of its plan.
   */
  resumeSteps() {
    const step = this.step;
    const keep = this.inVisit;
    let resume = null;
    if (step?.type === "behave" || step?.type === "rest") resume = keep ? step : { ...step, seconds: [2, 4], resumed: true };
    else if (step?.type === "act" && !step.solid) resume = { ...step, s: { ...step.s, seconds: keep ? step.s.seconds : [2, 4], topic: null, bounce: null } };
    const plan = this.plan.filter((s) => s.type !== "hold" && (s.type !== "walk" || s.to !== step?.to));
    return resume ? [resume, ...plan] : plan;
  }

  /** Drops the current plan (keeping what it is standing on) and does `steps` instead. */
  interrupt(steps = []) {
    this.plan = [...steps];
    this.speed = 0;
    this.until = 0;
    if (this.mode === "walk" || this.mode === "turn") this.mode = "rest";
  }

  // --- Running the plan --------------------------------------------------------------------------

  next() {
    let guard = 0;
    while (!this.plan.length && guard++ < 3) this.decide();
    const step = this.plan.shift() ?? { type: "rest" };
    this.step = step;
    const slow = this.lively ? 1 : 1.6;
    switch (step.type) {
      case "behave": {
        const b = step.b;
        this.lastBehaviour = b;
        if (b.steps && !step.resumed) {
          // A little sequence: each step is its own pose (and prop, and line) in turn.
          if (b.topic && Math.random() < b.say) this.sayAt = { topic: b.topic, at: this.time + 0.9 };
          this.plan.unshift(...b.steps.filter((s) => s.chance >= 1 || Math.random() < s.chance).map((s) => ({ type: "act", s, parent: b })));
          this.next();
          return;
        }
        this.behaviour = b;
        this.mode = "rest";
        this.setPose(b.pose);
        this.refreshExpression();
        this.until = this.time + between(step.seconds ?? b.seconds) * slow;
        if (step.resumed) break;
        if (b.bounce && this.lively) this.startBounce(b.bounce);
        if (b.topic && Math.random() < b.say) this.sayAt = { topic: b.topic, at: this.time + 0.9 };
        else if (Math.random() < b.say * 0.4) this.sayAt = { topic: null, at: this.time + 1.2 };
        break;
      }
      case "act": {
        // One step of the tap menu's action (`solid`: said to her) or of a behaviour's sequence.
        const s = step.s;
        const parent = step.parent;
        this.behaviour = { id: parent?.id ?? step.action ?? "action", pose: s.pose, expression: s.expression, prop: s.prop };
        this.mode = "rest";
        if (s.turn) this.face(-this.facing);
        this.setPose(s.pose);
        this.refreshExpression();
        this.until = this.time + between(s.seconds) * slow;
        if (s.bounce && this.lively) this.startBounce(s.bounce);
        if (s.topic) {
          if (step.solid) this.say([s.topic]);
          else if (Math.random() < (parent?.say ?? this.m.talkiness)) this.sayAt = { topic: s.topic, at: this.time + 0.6 };
        }
        break;
      }
      case "hold":
        // The tap menu is open: it waits, looking at her, until she chooses or it closes.
        this.mode = "rest";
        this.setPose(step.pose ?? this.m.restPose);
        this.refreshExpression();
        this.until = this.menu ? Infinity : 0;
        break;
      case "rest":
        this.behaviour = null;
        this.mode = "rest";
        this.setPose(step.pose ?? this.m.restPose);
        this.refreshExpression();
        this.until = this.time + between(step.seconds ?? this.m.restSeconds) * slow;
        break;
      case "wait":
        this.mode = "rest";
        if (step.pose) this.setPose(step.pose);
        this.until = this.time + between(step.seconds ?? [1, 1]);
        break;
      case "face":
        this.mode = "rest";
        this.face(step.dir);
        this.until = this.time + this.m.turnMs / 1000;
        break;
      case "say":
        this.say(step.topics ?? step.line, { aside: step.aside });
        this.until = 0;
        break;
      case "call":
        this.until = 0;
        step.fn?.(this);
        break;
      case "walk": {
        if (!this.lively && !step.off) {
          this.until = 0;
          break;
        }
        const dir = Math.sign(step.to - this.x);
        if (Math.abs(step.to - this.x) < 1) {
          this.until = 0;
          break;
        }
        const turned = this.face(dir);
        this.mode = turned && this.m.flip ? "turn" : "walk";
        this.until = this.mode === "turn" ? this.time + (this.m.turnMs / 1000) * 0.7 : Infinity;
        this.behaviour = null;
        this.setPose(step.pose ?? this.m.walkPose);
        this.refreshExpression();
        this.lastSpawn = null;
        break;
      }
      case "jump":
        if (!this.lively) {
          this.until = 0;
          break;
        }
        this.beginJump(step);
        break;
      case "float":
        if (!this.lively) {
          this.until = 0;
          break;
        }
        this.beginFloat(step);
        break;
      case "leave": {
        const band = this.stage.band;
        const side = step.side ?? (this.x < (band.left + band.right) / 2 ? -1 : 1);
        if (!this.lively) {
          this.opacityTarget = 0;
          this.opacityRate = 3;
          this.mode = "rest";
          this.until = this.time + 0.45;
          this.plan.unshift({ type: "call", fn: () => (this.gone = true) });
          break;
        }
        this.plan.unshift({ type: "walk", to: side < 0 ? band.left - this.w : band.right + this.w, off: true }, { type: "call", fn: () => (this.gone = true) });
        this.until = 0;
        break;
      }
      default:
        this.until = 0;
    }
  }

  beginJump(step) {
    const levels = this.stage.levels;
    const to = levels[step.level];
    if (!to) {
      this.until = 0;
      return;
    }
    const g = this.m.gravity * this.scale;
    const apex = Math.min(this.y, to.y) - (step.height ?? this.m.jumpHeight) * this.scale;
    const up = Math.sqrt((2 * Math.max(1, this.y - apex)) / g);
    const down = Math.sqrt((2 * Math.max(1, to.y - apex)) / g);
    const land = step.to ?? this.x;
    this.face(Math.sign(land - this.x));
    this.jump = { vx: (land - this.x) / (up + down), vy: -g * up, level: step.level, x: land, small: step.small };
    this.mode = "crouch";
    this.until = this.time + (step.anticipation ?? this.m.anticipation) / 1000;
    const k = this.m.squash * (step.small ? 0.5 : 1);
    this.squashTarget = [1 + 0.1 * k, 1 - 0.14 * k];
    this.setPose(this.c.poses.includes("crouch") ? "crouch" : "jump");
    this.refreshExpression();
  }

  takeOff() {
    const k = this.m.squash * (this.jump.small ? 0.5 : 1);
    this.squashTarget = [1, 1];
    this.sx = 1 - 0.08 * k;
    this.sy = 1 + 0.13 * k;
    this.vx = this.jump.vx;
    this.vy = this.jump.vy;
    this.fall = { level: this.jump.level, x: this.jump.x };
    this.level = null;
    this.mode = "air";
    this.setPose("jump");
    if (!this.jump.small) this.fadeTiles(0.08);
    else this.fadeTiles(0.25, true);
  }

  beginFloat(step) {
    const to = this.stage.levels[step.level];
    const distance = Math.hypot(step.to - this.x, to.y - this.y);
    this.face(Math.sign(step.to - this.x));
    this.floating = {
      x0: this.x,
      y0: this.y,
      x1: step.to,
      y1: to.y,
      level: step.level,
      t0: this.time,
      dur: Math.max(0.6, this.m.floatSeconds * (0.6 + distance / 320)),
    };
    this.level = null;
    this.mode = "float";
    this.setPose(step.pose ?? this.m.walkPose);
    this.until = Infinity;
  }

  land() {
    const fall = this.fall;
    const level = this.stage.levels[fall.level] ?? this.stage.levels[0];
    this.level = this.stage.levels.indexOf(level);
    this.y = level.y;
    this.x = clamp(this.x, level.x0 - 4, level.x1 + 4);
    this.vx = this.vy = 0;
    const k = this.m.squash * (this.jump?.small ? 0.45 : 1);
    this.sx = 1 + 0.18 * k;
    this.sy = 1 - 0.2 * k;
    this.squashTarget = [1, 1];
    this.groundTile(false);
    this.mode = "rest";
    this.setPose(this.jump?.small ? "react" : "land");
    this.until = this.time + (this.jump?.small ? 0.15 : this.m.landing / 1000);
    const dropped = this.fall.dropped;
    this.fall = null;
    this.jump = null;
    // Told to stay and put down somewhere new: this is its spot now.
    if (this.staying) this.saveSpot();
    if (dropped) {
      this.setMoment("putDown");
      this.say(["putDown"]);
      this.stage.onLanded?.(this);
    }
  }

  // --- Clouds ------------------------------------------------------------------------------------

  spawnTile(x, y, state = "forming") {
    const tile = { id: ++tileSeq, x, y, state, at: this.time };
    this.tiles.push(tile);
    this.tilesDirty = true;
    return tile;
  }
  clearTiles() {
    this.tiles = [];
    this.ride = null;
    this.tilesDirty = true;
  }
  fadeTiles(delay = 0, keepRide = false) {
    for (const tile of this.tiles) if (tile.state !== "fading") Object.assign(tile, { state: "fading", at: this.time + delay });
    if (this.ride && !keepRide) this.detachRide();
    this.tilesDirty = true;
  }
  /** "ride": the cloud it was sitting on stays where it was and fades. */
  detachRide() {
    if (!this.ride) return;
    this.tiles.push({ id: this.ride.id, x: this.x, y: this.y, state: "fading", at: this.time });
    this.ride = null;
    this.tilesDirty = true;
  }
  /** Makes sure there is a cloud under its feet. */
  groundTile(steady) {
    if (this.m.platform === "ride") {
      if (!this.ride || this.ride.state === "fading") this.ride = { id: ++tileSeq, state: steady ? "steady" : "forming", at: this.time };
      this.tilesDirty = true;
      return;
    }
    const under = this.tiles.find((t) => t.state !== "fading" && t.y === this.y && Math.abs(t.x - this.x) < this.pw * 0.1);
    if (!under) this.spawnTile(this.x, this.y, steady ? "steady" : "forming");
  }

  updateTiles() {
    const form = this.m.platformForm / 1000;
    const fade = this.m.platformFade / 1000;
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const tile = this.tiles[i];
      if (tile.state === "forming" && this.time - tile.at >= form) {
        tile.state = "steady";
        tile.at = this.time;
        this.tilesDirty = true;
      } else if (tile.state === "fading" && this.time - tile.at >= fade) {
        this.tiles.splice(i, 1);
        this.tilesDirty = true;
      }
    }
    if (this.ride?.state === "forming" && this.time - this.ride.at >= form) {
      this.ride = { ...this.ride, state: "steady", at: this.time };
      this.tilesDirty = true;
    }
    if (this.m.platform !== "ride" && this.level != null && this.mode !== "air") {
      const y = this.y;
      if (this.mode === "walk") {
        // Clouds form just ahead of the feet and fade once they are left behind.
        const lead = this.pw * 0.42;
        const ahead = this.x + this.facing * lead;
        const covered = this.tiles.some((t) => t.state !== "fading" && t.y === y && Math.abs(t.x - ahead) < this.pw * 0.26);
        if (!covered) this.spawnTile(ahead, y);
        for (const t of this.tiles) {
          if (t.state === "fading") continue;
          if (t.y !== y || (this.x - t.x) * this.facing > this.pw * 0.72 || Math.abs(this.x - t.x) > this.pw * 1.2) {
            t.state = "fading";
            t.at = this.time;
            this.tilesDirty = true;
          }
        }
      } else if (this.mode === "rest" || this.mode === "turn") {
        // Standing still, the clouds gather into one under its feet.
        const centred = this.tiles.find((t) => t.state !== "fading" && t.y === y && Math.abs(t.x - this.x) < this.pw * 0.12);
        if (!centred) this.spawnTile(this.x, y);
        else
          for (const t of this.tiles) {
            if (t === centred || t.state === "fading") continue;
            if (this.time - centred.at > 0.15 || centred.state === "steady") {
              t.state = "fading";
              t.at = this.time;
              this.tilesDirty = true;
            }
          }
      }
    }
    if (this.tilesDirty) {
      this.tilesDirty = false;
      this.view.set({
        tiles: this.tiles.map((t) => ({ id: t.id, x: t.x, y: t.y, state: this.time < t.at && t.state === "fading" ? "steady" : t.state })),
        ride: this.ride ? { id: this.ride.id, state: this.ride.state } : null,
      });
    }
  }

  // --- Touch ---------------------------------------------------------------------------------------

  pointerDown(event) {
    if (this.role === "visitor" && this.leaving) return;
    this.pointer = { id: event.pointerId, x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY, t0: performance.now(), picked: false, vx: 0, vy: 0, lt: performance.now() };
  }
  pointerMove(event) {
    const p = this.pointer;
    if (!p || p.id !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - p.lt) / 1000;
    p.vx = p.vx * 0.6 + ((event.clientX - p.x) / dt) * 0.4;
    p.vy = p.vy * 0.6 + ((event.clientY - p.y) / dt) * 0.4;
    p.x = event.clientX;
    p.y = event.clientY;
    p.lt = now;
    if (!p.picked && Math.hypot(p.x - p.x0, p.y - p.y0) > 8) this.pickUp();
  }
  pointerUp(event) {
    const p = this.pointer;
    if (!p || p.id !== event.pointerId) return;
    this.pointer = null;
    if (p.picked) this.putDown(p);
    else if (event.type !== "pointercancel" && performance.now() - p.t0 < 500) this.tap();
  }

  /**
   * A tap: the `react` pose and a `tapped` line (three quick taps: `pester`), and for the host the
   * tap menu, while it waits for her choice. `keyboard`: opened from the keyboard, so the menu's
   * first chip takes the focus.
   */
  tap({ keyboard = false } = {}) {
    if (this.mode === "air" || this.mode === "crouch" || this.mode === "held") return;
    const now = this.time;
    this.taps = [...this.taps.filter((t) => now - t < 2.4), now];
    const pester = this.taps.length >= 3 && this.c.lines.pester;
    this.setMoment("tapped", 2.4);
    this.say(pester ? ["pester", "tapped"] : ["tapped"]);
    this.stage.haptic?.("light");
    if (this.role === "visitor") return;
    const rest = this.resumeSteps();
    this.openMenu({ focus: keyboard });
    const hold = { type: "hold" };
    if (this.lively && this.m.hop && this.level != null) {
      this.interrupt([{ type: "jump", level: this.level, to: this.x, small: true, height: 14, anticipation: 70 }, { type: "wait", seconds: [0.9, 0.9], pose: "react" }, hold, ...rest]);
    } else {
      this.sx = 1.08;
      this.sy = 0.92;
      this.interrupt([{ type: "wait", seconds: [1.1, 1.1], pose: "react" }, hold, ...rest]);
    }
  }

  // --- The tap menu, the action and stay -------------------------------------------------------------

  openMenu({ focus = false } = {}) {
    if (this.role !== "host") return;
    this.menu = { id: ++menuSeq, at: performance.now(), focus };
    this.lastMenu = null;
    this.view.set({ menu: { id: this.menu.id, focus } });
  }

  /** Closes the menu: `reason` is "chose", "outside", "scroll", "drag", "timeout", "escape" or "away". */
  closeMenu(reason = "away") {
    if (!this.menu) return;
    this.menu = null;
    this.menuPlace = null;
    this.view.set({ menu: null });
    if (this.step?.type === "hold") this.until = 0;
    this.stage.onMenuClosed?.(this, reason);
  }

  /** A chip in the menu: "action", "stay" or "wander". */
  choose(which) {
    this.closeMenu("chose");
    this.stage.haptic?.("light");
    if (which === "action") this.runAction();
    else this.setStay(which === "stay", { say: true });
  }

  /** Plays its own action (`character.action`): each step's pose, prop and expression in turn. */
  runAction() {
    const action = this.c.action;
    if (!action || this.mode === "held") return false;
    this.moment = null;
    const steps = action.steps.filter((s) => s.chance >= 1 || Math.random() < s.chance).map((s) => ({ type: "act", s, solid: true, action: action.id }));
    const after = this.inVisit ? [{ type: "rest", seconds: [600, 600] }] : [{ type: "rest" }];
    // Mid-hop (the tap's little jump): it plays as soon as the feet are down.
    if (this.mode === "air" || this.mode === "crouch") this.plan = [...steps, ...after];
    else this.interrupt([...steps, ...after]);
    return true;
  }

  /** Stay (true) or wander again (false). `say`: answer with a `stay` / `wander` line. */
  setStay(on, { say = false } = {}) {
    if (this.role !== "host") return;
    if (on) {
      this.staying = true;
      // Stops where it stands: no more walks, hops to other levels or floats.
      if (this.mode === "walk" || this.mode === "turn") {
        this.mode = "rest";
        this.speed = 0;
        this.until = 0;
      }
      this.plan = this.plan.filter((s) => !TRAVEL.has(s.type) || s.off || s.small);
      if (this.level != null) this.saveSpot();
      this.view.set({ staying: true });
      if (say) {
        this.moment = null;
        this.setMoment("stay", 2.4);
        this.say(["stay"]);
        if (this.lively && this.mode === "rest") this.startBounce({ count: 1, height: 6, every: 0.3 });
      }
    } else {
      this.staying = false;
      this.spot = null;
      clearStay(this.c.id);
      this.view.set({ staying: false });
      if (say) {
        this.moment = null;
        this.setMoment("wander", 2.4);
        this.say(["wander"]);
        if (this.lively && this.mode === "rest") this.startBounce({ count: 2, height: 8, every: 0.32 });
        if (!this.inVisit && this.mode === "rest") this.interrupt([{ type: "wait", seconds: [1.2, 1.6] }]);
      }
    }
  }

  /** Where it stands now becomes its spot, kept on this phone. */
  saveSpot() {
    if (this.level == null) return;
    this.spot = spotAt(this.x, this.level, this.stage.band);
    writeStay(this.c.id, this.spot);
  }

  /** Little hops on the spot (a dance, a happy bounce): the feet never leave their level. */
  startBounce(bounce) {
    this.bounce = { t0: this.time, count: bounce.count, height: bounce.height ?? 9, every: bounce.every ?? 0.36, hops: 0 };
  }

  pickUp() {
    const p = this.pointer;
    p.picked = true;
    this.closeMenu("drag");
    this.bounce = null;
    this.hopY = 0;
    this.mode = "held";
    this.plan = [];
    this.step = null;
    this.behaviour = null;
    this.level = null;
    this.speed = 0;
    this.fall = this.jump = this.floating = null;
    this.squashTarget = [1, 1];
    this.fadeTiles(0);
    this.setPose("held");
    this.setMoment("picked", 30);
    this.view.set({ held: true });
    this.say(["picked"]);
    this.stage.haptic?.("light");
    this.stage.onPicked?.(this);
  }

  /** Let go: it falls to the nearest level below (with a little of the throw), lands, carries on. */
  putDown(p) {
    this.view.set({ held: false });
    this.moment = null;
    this.rotTarget = 0;
    const levels = this.stage.levels;
    const g = this.m.gravity * this.scale;
    // Told to stay, it drops straight down: where she lets go is its new spot.
    const throwX = this.staying ? 0 : clamp(p.vx * 0.35, -420, 420);
    const below = levels.filter((l) => l.y >= this.y - 4).sort((a, b) => a.y - b.y);
    let choice = null;
    for (const level of below) {
      const t = Math.sqrt((2 * Math.max(1, level.y - this.y)) / g);
      const lx = this.x + throwX * t;
      if (lx >= level.x0 - 12 && lx <= level.x1 + 12) {
        choice = { level, x: clamp(lx, level.x0, level.x1), t };
        break;
      }
    }
    if (!choice) {
      const level = levels[0];
      const t = Math.sqrt((2 * Math.max(1, level.y - this.y)) / g);
      choice = { level, x: clamp(this.x + throwX * t, level.x0, level.x1), t };
    }
    const index = levels.indexOf(choice.level);
    if (!this.lively) {
      this.x = choice.x;
      this.fall = { level: index, x: choice.x, dropped: true };
      this.land();
      this.rot = 0;
      return;
    }
    this.vx = (choice.x - this.x) / Math.max(0.12, choice.t);
    this.vy = 0;
    this.fall = { level: index, x: choice.x, dropped: true };
    this.jump = null;
    this.mode = "air";
    this.setPose("fall");
  }

  /** Quiet mode switched on mid-move: finish wherever it was going, at once and without fuss. */
  settle() {
    if (this.lively) return;
    if (this.mode === "air" || this.mode === "crouch") {
      if (this.mode === "crouch") this.fall = { level: this.jump.level, x: this.jump.x };
      this.x = this.fall.x;
      this.land();
    } else if (this.mode === "float") {
      const f = this.floating;
      this.floating = null;
      this.level = f.level;
      this.x = f.x1;
      this.y = f.y1;
      this.mode = "rest";
    } else if (this.mode === "walk" || this.mode === "turn") {
      this.mode = "rest";
      this.speed = 0;
    }
    this.plan = this.plan.filter((s) => s.type !== "walk" && s.type !== "jump" && s.type !== "float" || s.off);
    this.until = Math.min(this.until, this.time + 0.5);
    this.setPose(this.view.get().pose === this.c.resolvePose(this.m.walkPose) ? this.m.restPose : this.view.get().pose);
    this.write(true);
  }

  // --- The frame -----------------------------------------------------------------------------------

  update(dt) {
    const t = this.time;
    const lively = this.lively;

    if (this.bubbleUntil && t >= this.bubbleUntil && this.view.get().bubble) {
      this.bubbleUntil = 0;
      this.hush();
    }
    if (this.moment && this.moment.until <= t) {
      this.moment = null;
      this.refreshExpression();
    }
    if (this.sayAt && t >= this.sayAt.at) {
      const topic = this.sayAt.topic;
      this.sayAt = null;
      if (this.mode === "rest" && !this.view.get().bubble) this.muse(topic);
    }
    // A long press without moving picks it up too.
    if (this.pointer && !this.pointer.picked && performance.now() - this.pointer.t0 > 420) this.pickUp();
    if (this.menu && performance.now() - this.menu.at > MENU_MS) this.closeMenu("timeout");

    switch (this.mode) {
      case "rest":
        if (t >= this.until) this.next();
        break;
      case "turn":
        if (t >= this.until) {
          this.mode = "walk";
          this.until = Infinity;
        }
        break;
      case "walk": {
        const step = this.step;
        const target = step.off ? step.to : this.levelObj ? clamp(step.to, this.levelObj.x0, this.levelObj.x1) : step.to;
        const dist = Math.abs(target - this.x);
        const max = this.m.walkSpeed * this.scale * (step.speed ?? 1) * (step.off ? 1.6 : 1);
        const accel = max / 0.28;
        const brake = (this.speed * this.speed) / (2 * accel);
        this.speed = dist <= brake + 0.5 ? Math.max(this.speed - accel * dt, 10 * this.scale) : Math.min(this.speed + accel * dt, max);
        const move = Math.min(dist, this.speed * dt);
        this.x += Math.sign(target - this.x) * move;
        this.stride += move;
        if (dist - move < 0.5) {
          this.x = target;
          this.speed = 0;
          this.mode = "rest";
          this.setPose(this.m.restPose);
          if (this.staying && !step.off) this.saveSpot();
          // At the end of a level it turns back to face the room.
          const level = this.levelObj;
          if (level && !step.off && (this.x <= level.x0 + 2 || this.x >= level.x1 - 2) && !this.plan.some((s) => s.type === "walk")) {
            this.plan.unshift({ type: "face", dir: this.x <= level.x0 + 2 ? 1 : -1 });
          }
          this.next();
        }
        break;
      }
      case "crouch":
        if (t >= this.until) this.takeOff();
        break;
      case "air": {
        const g = this.m.gravity * this.scale;
        this.vy += g * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        const level = this.stage.levels[this.fall.level] ?? this.stage.levels[0];
        if (this.vy > 0 && this.view.get().pose !== this.c.resolvePose("fall") && !this.jump?.small) this.setPose("fall");
        // The cloud puffs in just before the feet arrive.
        if (this.vy > 0 && !this.fall.puffed && (level.y - this.y) / Math.max(1, this.vy) < 0.16) {
          this.fall.puffed = true;
          if (this.m.platform === "ride") this.ride = { id: ++tileSeq, state: "forming", at: t };
          else if (!this.jump?.small || !this.tiles.some((tile) => tile.state !== "fading")) this.spawnTile(this.fall.x, level.y);
          else for (const tile of this.tiles) if (tile.state === "fading" && tile.at > t) Object.assign(tile, { state: "steady", at: t });
          this.tilesDirty = true;
        }
        if (this.vy > 0 && this.y >= level.y) {
          this.x = this.fall.x;
          this.land();
        }
        break;
      }
      case "float": {
        const f = this.floating;
        const p = clamp((t - f.t0) / f.dur, 0, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        this.x = f.x0 + (f.x1 - f.x0) * e;
        this.y = f.y0 + (f.y1 - f.y0) * e - Math.sin(p * Math.PI) * 14 * this.scale;
        this.speed = Math.abs(f.x1 - f.x0) / f.dur;
        if (p >= 1) {
          this.level = f.level;
          this.y = f.y1;
          this.floating = null;
          if (this.staying) this.saveSpot();
          this.sx = 1.05;
          this.sy = 0.95;
          this.mode = "rest";
          this.until = 0;
          this.next();
        }
        break;
      }
      case "held": {
        const p = this.pointer;
        if (p) {
          const band = this.stage.band;
          const bottom = this.stage.levels[0]?.y ?? band.bottom;
          const tx = clamp(p.x, band.left + this.w / 2, band.right - this.w / 2);
          const ty = clamp(p.y + this.h * this.m.heldAt, band.top + this.h + 2, bottom);
          const k = 1 - Math.exp(-dt * 22);
          const px = this.x;
          this.x += (tx - this.x) * k;
          this.y += (ty - this.y) * k;
          this.vx = this.vx * 0.8 + ((this.x - px) / Math.max(dt, 0.001)) * 0.2;
          this.rotTarget = lively ? clamp(this.vx * 0.045 * this.m.sway, -30, 30) : 0;
        }
        break;
      }
      default:
        break;
    }

    // Springs: squash back to round, swing back to hanging straight.
    if (lively) {
      const [tx, ty] = this.squashTarget;
      const k = 340;
      const c = 15;
      this.svx += (-(this.sx - tx) * k - this.svx * c) * dt;
      this.svy += (-(this.sy - ty) * k - this.svy * c) * dt;
      this.sx += this.svx * dt;
      this.sy += this.svy * dt;
      if (this.mode === "held" || Math.abs(this.rot) > 0.05 || Math.abs(this.rotV) > 0.05) {
        this.rotV += (-(this.rot - this.rotTarget) * 70 - this.rotV * 5.5) * dt;
        this.rot += this.rotV * dt;
      }
      const turnRate = 2 / Math.max(0.05, this.m.turnMs / 1000);
      if (this.turn !== this.facing) this.turn = this.facing > this.turn ? Math.min(this.facing, this.turn + turnRate * dt) : Math.max(this.facing, this.turn - turnRate * dt);
    } else {
      this.sx = this.sy = 1;
      this.svx = this.svy = 0;
      this.rot = 0;
      this.turn = this.facing;
    }
    // Hops on the spot: a lift written with the frame, a little squash each time the feet touch.
    let hop = 0;
    if (this.bounce) {
      const b = this.bounce;
      const p = (t - b.t0) / b.every;
      if (!lively || this.mode !== "rest" || p >= b.count) {
        if (lively && p >= b.count) this.squashKick(0.06);
        this.bounce = null;
      } else {
        const i = Math.floor(p);
        if (i > b.hops) {
          b.hops = i;
          this.squashKick(0.06);
        }
        hop = Math.sin(Math.PI * (p - i)) * b.height * this.scale;
      }
    }
    this.hopY = hop;
    if (this.opacity !== this.opacityTarget) {
      const step = this.opacityRate * dt;
      this.opacity = this.opacity < this.opacityTarget ? Math.min(this.opacityTarget, this.opacity + step) : Math.max(this.opacityTarget, this.opacity - step);
    }

    this.updateTiles();
    this.write();
    if (this.view.get().bubble) this.placeBubble();
    if (this.menu) this.placeMenu();

    const f = this.frame;
    f.time.set(t);
    if (f.stride.get() !== this.stride) f.stride.set(this.stride);
    const speed = this.mode === "walk" ? this.speed : this.mode === "float" ? this.speed : 0;
    if (f.speed.get() !== speed) f.speed.set(speed);
    const vy = this.mode === "air" ? this.vy : 0;
    if (f.vy.get() !== vy) f.vy.set(vy);
  }

  /** Writes the frame to the DOM: only transforms and opacity, and only what changed. */
  write(force = false) {
    const { root, squash, sway } = this.els;
    if (!root) return;
    const bob = this.m.bob && this.lively && this.level != null && this.mode !== "held" ? Math.sin(this.time * 2.4 + this.bobPhase) * this.m.bob * this.scale : 0;
    const x = Math.round(this.x * 10) / 10;
    const y = Math.round((this.y + bob - this.hopY) * 10) / 10;
    const rootKey = `${x},${y}`;
    if (force || rootKey !== this.lastRoot) {
      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      this.lastRoot = rootKey;
    }
    const opacity = Math.round(this.opacity * 100) / 100;
    if (force || opacity !== this.lastOpacity) {
      root.style.opacity = String(opacity);
      this.lastOpacity = opacity;
    }
    if (squash) {
      const flip = this.m.flip ? this.turn : 1;
      // Mid-turn it never goes fully edge-on: a sliver of the body stays, like a paper doll.
      const fx = Math.sign(flip || 1) * Math.max(0.12, Math.abs(flip));
      const key = `${(this.sx * fx).toFixed(3)},${this.sy.toFixed(3)}`;
      if (force || key !== this.lastSquash) {
        squash.style.transform = near(this.sx * fx, 1, 0.001) && near(this.sy, 1, 0.001) ? "" : `scale(${(this.sx * fx).toFixed(3)}, ${this.sy.toFixed(3)})`;
        this.lastSquash = key;
      }
    }
    if (sway) {
      const r = Math.round(this.rot * 10) / 10;
      if (force || r !== this.lastRot) {
        sway.style.transform = r ? `rotate(${r}deg)` : "";
        this.lastRot = r;
      }
    }
  }

  /** Keeps the bubble near the head and fully inside the band (never under the top bar or tabs). */
  placeBubble() {
    const el = this.els.bubble;
    if (!el) return;
    const band = this.stage.band;
    const { w: bw, h: bh } = this.bubbleSize;
    const pad = 8;
    const head = this.y - this.h * (this.mode === "held" ? 1 : this.sy);
    let place = "above";
    let left = clamp(this.x - bw / 2, band.left + pad, band.right - pad - bw);
    let top = head - 8 - bh;
    if (top < band.top + pad) {
      const roomRight = band.right - (this.x + this.w * 0.42);
      const roomLeft = this.x - this.w * 0.42 - band.left;
      top = clamp(head + this.h * 0.12, band.top + pad, band.bottom - pad - bh);
      if (roomRight >= bw + pad || roomRight >= roomLeft) {
        place = "right";
        left = clamp(this.x + this.w * 0.42, band.left + pad, band.right - pad - bw);
      } else {
        place = "left";
        left = clamp(this.x - this.w * 0.42 - bw, band.left + pad, band.right - pad - bw);
      }
    }
    const tail =
      place === "above"
        ? clamp(this.x - left, 14, bw - 14)
        : clamp(head + this.h * 0.3 - top, 12, bh - 12);
    const lx = Math.round(left);
    const ty = Math.round(top);
    this.bubbleRect = { left: lx, top: ty, right: lx + bw, bottom: ty + bh };
    const key = `${lx},${ty},${place},${Math.round(tail)}`;
    if (key === this.lastBubble) return;
    this.lastBubble = key;
    el.style.transform = `translate3d(${lx}px, ${ty}px, 0)`;
    if (place !== this.bubblePlace) {
      el.dataset.place = place;
      this.bubblePlace = place;
    }
    el.style.setProperty("--tail", `${Math.round(tail)}px`);
  }

  squashKick(amount) {
    const k = this.m.squash;
    this.sx = 1 + amount * k;
    this.sy = 1 - amount * 1.2 * k;
  }

  /** Keeps the tap menu beside it (menu.js), clear of the bubble and inside the band. */
  placeMenu() {
    const el = this.els.menu;
    if (!el || !this.menuSize) return;
    const levels = this.stage.levels;
    // The level it stands on (or is hopping back down to), so the tap's little hop doesn't shake it.
    const level = this.level != null ? levels[this.level] : this.fall ? levels[this.fall.level] : null;
    const feet = level ? level.y : this.y;
    const x = this.fall?.x ?? this.x;
    const place = placeMenu({
      band: this.stage.band,
      actor: { x, feet, w: this.w * 0.74, h: this.h * 0.97, cloud: this.pw * 0.24 },
      size: this.menuSize,
      bubble: this.view.get().bubble ? this.bubbleRect : null,
      prev: this.menuPlace,
    });
    this.menuPlace = place;
    const key = `${place.left},${place.top},${place.layout}`;
    if (key === this.lastMenu) return;
    this.lastMenu = key;
    el.style.transform = `translate3d(${place.left}px, ${place.top}px, 0)`;
    el.dataset.layout = place.layout;
    el.dataset.side = place.side;
  }
}
