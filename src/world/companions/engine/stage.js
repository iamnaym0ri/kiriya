// The stage: the band of screen the characters live in, its invisible levels, who is on it, the
// visits, and the one frame loop that runs them all (README.md documents every option).
import { Actor } from "./actor.js";
import { buildLevels, busyScore, measureBand } from "./levels.js";
import { createTicker } from "./ticker.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

export const STAGE_DEFAULTS = {
  levels: null, // number of levels (2..6), or [{ at, from, to }], or null for as many as fit
  scale: null, // body scale; null: 0.9 on a 414 pt phone, a little less on narrower ones
  speed: 1, // time multiplier for everything the engine animates (the lab's slow motion)
  avoidText: true, // prefer spots that don't cover text, pictures or buttons
  insets: null, // { top, bottom } in px to override the measured band
  visits: {
    enabled: true,
    chance: 0.35, // chance a visit happens during a stay on home, once the cooldown has passed
    delay: [25, 80], // seconds on home before the visitor turns up
    cooldown: 20, // minutes between visits
  },
  chatGap: 14, // seconds between unprompted remarks (longer in quiet mode)
  debug: false, // draws the levels
};

const VISIT_KEY = "kiriya:companion:last-visit";
const readLastVisit = () => {
  try {
    return Number(localStorage.getItem(VISIT_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeLastVisit = () => {
  try {
    localStorage.setItem(VISIT_KEY, String(Date.now()));
  } catch {
    // Private mode: visits just aren't rationed across launches.
  }
};

// Where the host was, so coming back to home (or a remount) finds it where it was left.
const memory = { host: null };

export class StageSim {
  constructor({ onActors, onLayout, loadCharacter, haptic } = {}) {
    this.onActors = onActors ?? (() => {});
    this.onLayout = onLayout ?? (() => {});
    this.loadCharacter = loadCharacter ?? (async () => null);
    this.haptic = haptic;
    this.options = { ...STAGE_DEFAULTS, visits: { ...STAGE_DEFAULTS.visits } };
    this.time = 0;
    this.lively = true;
    this.name = "";
    this.birthday = false;
    this.lastAside = -Infinity;
    this.host = null;
    this.visitor = null;
    this.visit = null;
    this.actors = [];
    this.band = { top: 0, bottom: 600, left: 0, right: 375, width: 375, height: 700 };
    this.levels = [];
    this.scale = 0.9;
    this.layer = null;
    this.ticker = createTicker((dt) => this.tick(dt));
    this.ticker.block("empty");
    this.ticker.block("unmounted");
    this.scrollAt = null;
    this.relayoutAt = 0;
    this.lastAvoid = -Infinity;
    this.lastComfort = 0;
  }

  get chatGap() {
    return this.options.chatGap * (this.lively ? 1 : 1.5);
  }

  // --- Lifecycle -----------------------------------------------------------------------------------

  mount(layer) {
    this.layer = layer;
    this.onVisibility = () => this.ticker.block("hidden", document.hidden);
    this.onResize = () => {
      this.relayoutAt = this.time + 0.15;
      if (!this.ticker.running) this.layout();
    };
    this.onScroll = () => {
      this.scrollAt = this.time;
    };
    document.addEventListener("visibilitychange", this.onVisibility);
    addEventListener("resize", this.onResize);
    addEventListener("orientationchange", this.onResize);
    addEventListener("scroll", this.onScroll, { passive: true });
    this.onVisibility();
    this.layout();
    this.ticker.block("unmounted", false);
  }

  destroy() {
    // Not final: React's strict mode unmounts and mounts again, so this only pauses.
    this.ticker.block("unmounted", true);
    document.removeEventListener("visibilitychange", this.onVisibility);
    removeEventListener("resize", this.onResize);
    removeEventListener("orientationchange", this.onResize);
    removeEventListener("scroll", this.onScroll);
    this.remember();
  }

  setOptions(options = {}) {
    const prev = this.options;
    this.options = {
      ...STAGE_DEFAULTS,
      ...options,
      visits: { ...STAGE_DEFAULTS.visits, ...(options.visits ?? {}) },
    };
    if (prev.levels !== this.options.levels || prev.scale !== this.options.scale || JSON.stringify(prev.insets) !== JSON.stringify(this.options.insets)) this.layout();
  }

  setActive(active) {
    this.ticker.block("inactive", !active);
    if (active) {
      this.layout();
      this.rollVisit();
    } else this.remember();
  }

  setLively(lively) {
    if (this.lively === lively) return;
    this.lively = lively;
    for (const actor of this.actors) actor.settle?.();
  }

  remember() {
    const h = this.host;
    if (h && h.level != null) memory.host = { id: h.c.id, level: h.level, fx: (h.x - this.band.left) / Math.max(1, this.band.width), facing: h.facing };
  }

  // --- Layout --------------------------------------------------------------------------------------

  layout() {
    if (!this.layer) return;
    const band = measureBand(this.options.insets ?? {});
    const scale = this.options.scale ?? clamp(0.9 * (band.width / 414), 0.74, 1);
    const sizeChanged = scale !== this.scale;
    this.scale = scale;
    this.band = band;
    const tallest = Math.max(96, ...this.actors.map((a) => a.c.size.height * scale * (a.c.scale ?? 1)));
    const widest = Math.max(80, ...this.actors.map((a) => a.c.size.width * scale * (a.c.scale ?? 1)));
    const levels = buildLevels(band, {
      count: typeof this.options.levels === "number" ? this.options.levels : undefined,
      custom: Array.isArray(this.options.levels) ? this.options.levels : undefined,
      bodyWidth: widest,
      bodyHeight: tallest,
    });
    const changed = levels.length !== this.levels.length || levels.some((l, i) => Math.abs(l.y - this.levels[i].y) > 1 || Math.abs(l.x0 - this.levels[i].x0) > 1 || Math.abs(l.x1 - this.levels[i].x1) > 1);
    this.levels = levels;
    if (sizeChanged) for (const actor of this.actors) actor.resize();
    if (changed) {
      for (const actor of this.actors) {
        if (actor.level == null) continue;
        const index = Math.min(actor.level, levels.length - 1);
        actor.level = index;
        actor.y = levels[index].y;
        actor.x = clamp(actor.x, levels[index].x0, levels[index].x1);
        actor.tilesDirty = true;
        actor.fadeTiles(0, true);
        actor.groundTile(true);
        actor.write(true);
      }
      this.onLayout(levels, band);
    }
  }

  /** How busy (0..1) the spot is where this actor would stand at x on a level. */
  spotScore(actor, levelIndex, x) {
    if (!this.options.avoidText) return 0;
    const level = this.levels[levelIndex];
    if (!level) return 0;
    return busyScore(
      { left: x - actor.w * 0.4, right: x + actor.w * 0.4, top: level.y - actor.h * 0.92, bottom: level.y + 10 },
      this.layer,
    );
  }

  /** The best place to stand right now: clear of text, low-ish, a little random. */
  findSpot(actor, { prefer } = {}) {
    let best = null;
    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i];
      for (let k = 0; k < 4; k++) {
        const x = level.x0 + ((k + 0.25 + Math.random() * 0.5) / 4) * (level.x1 - level.x0);
        const cost = this.spotScore(actor, i, x) * 2 + (i / this.levels.length) * 0.35 + Math.random() * 0.3 + (prefer != null && i !== prefer ? 0.3 : 0);
        if (!best || cost < best.cost) best = { level: i, x, cost };
      }
    }
    return best ?? { level: 0, x: (this.band.left + this.band.right) / 2 };
  }

  // --- Who is on stage -----------------------------------------------------------------------------

  publish() {
    this.actors = [this.host, this.visitor].filter(Boolean);
    this.ticker.block("empty", this.actors.length === 0);
    this.onActors(this.actors);
  }

  /**
   * Sets who lives here (a normalised character, or null for nobody). The first one fades in where
   * it was last left (or somewhere clear); a new pick drops in from the top onto a cloud.
   */
  setHost(character, { entrance } = {}) {
    if (this.host?.c === character) return;
    const old = this.host;
    if (this.visit) this.endVisit(true);
    if (old) {
      old.opacityTarget = 0;
      old.opacityRate = 5;
      old.fadeTiles(0);
      old.leavingAt = this.time + 0.25;
    }
    if (!character) {
      this.host = null;
      setTimeout(() => this.publish(), 260);
      return;
    }
    const actor = new Actor(this, character, { role: "host" });
    this.host = actor;
    this.layout();
    actor.resize();
    const remembered = memory.host?.id === character.id ? memory.host : null;
    const how = entrance ?? (old ? "drop" : "appear");
    if (remembered && this.levels[remembered.level]) {
      actor.facing = remembered.facing ?? 1;
      actor.turn = actor.facing;
      actor.view.set({ facing: actor.facing });
      actor.placeAt(remembered.level, this.band.left + remembered.fx * this.band.width);
    } else {
      const spot = this.findSpot(actor);
      if (how === "drop") actor.dropIn(spot.level, spot.x);
      else actor.placeAt(spot.level, spot.x);
      actor.plan.push({ type: "wait", seconds: [1.1, 1.6] }, { type: "say", topics: null, line: null });
      // Says hello a beat after arriving.
      actor.plan[1] = { type: "call", fn: (a) => a.greet() };
    }
    if (!remembered && how !== "drop") actor.until = 0;
    if (old) setTimeout(() => this.publish(), 260);
    else this.publish();
    this.rollVisit();
  }

  // --- Visits --------------------------------------------------------------------------------------

  /** Once per stay on home: maybe someone drops by later. */
  rollVisit() {
    const v = this.options.visits;
    this.visitAt = null;
    if (!v.enabled || !this.host || this.visit) return;
    if (Date.now() - readLastVisit() < v.cooldown * 60_000) return;
    if (Math.random() >= v.chance) return;
    this.visitAt = this.time + between(v.delay);
  }

  /** Brings a visitor now (the lab, or when the roll says so). `id` picks who; otherwise random. */
  async startVisit(id) {
    if (!this.host || this.visit || this.pendingVisit) return false;
    this.pendingVisit = true;
    try {
      const pick = id ?? (await this.pickVisitorId?.(this.host.c.id));
      if (!pick || pick === this.host.c.id) return false;
      const character = await this.loadCharacter(pick);
      if (!character || !this.host || this.visit) return false;
      this.beginVisit(character);
      return true;
    } finally {
      this.pendingVisit = false;
    }
  }

  beginVisit(character) {
    const host = this.host;
    if (!host || host.level == null || host.mode === "held" || host.mode === "air") {
      // Try again shortly: she is busy carrying it about.
      this.visitAt = this.time + 4;
      this.queuedVisitor = character;
      return;
    }
    writeLastVisit();
    const visitor = new Actor(this, character, { role: "visitor" });
    this.visitor = visitor;
    visitor.resize();
    const level = this.levels[host.level];
    const gap = (host.w + visitor.w) / 2 + 6 * this.scale;
    const roomLeft = host.x - level.x0;
    const roomRight = level.x1 - host.x;
    const side = roomLeft >= roomRight ? -1 : 1;
    // Make room if the host is too near the end it will be visited from.
    let hostX = host.x;
    if (side < 0 && roomLeft < gap) hostX = Math.min(level.x1, level.x0 + gap);
    if (side > 0 && roomRight < gap) hostX = Math.max(level.x0, level.x1 - gap);
    const meetX = hostX + side * gap;
    host.interrupt([
      ...(Math.abs(hostX - host.x) > 2 ? [{ type: "walk", to: hostX }] : []),
      { type: "face", dir: side },
      { type: "rest", seconds: [600, 600] },
    ]);
    host.hush();
    visitor.enterFrom(side, host.level, meetX);
    visitor.plan.push({ type: "face", dir: -side }, { type: "call", fn: () => this.converse() }, { type: "rest", seconds: [600, 600] });
    this.visit = { host, visitor, side, phase: "arriving", lines: this.pickTalk(host, visitor), i: 0, nextAt: Infinity, startedAt: this.time };
    this.publish();
  }

  /** The conversation: a pair from either character's file, or each one's own visit lines. */
  pickTalk(host, visitor) {
    const options = [];
    for (const talk of host.c.visit.with[visitor.c.id] ?? []) options.push({ first: host, lines: talk });
    for (const talk of visitor.c.visit.with[host.c.id] ?? []) options.push({ first: visitor, lines: talk });
    if (!options.length) {
      for (const talk of visitor.c.visit.any ?? []) options.push({ first: visitor, lines: talk });
      for (const talk of host.c.visit.any ?? []) options.push({ first: host, lines: talk });
    }
    if (options.length) return options[Math.floor(Math.random() * options.length)];
    // Nobody wrote anything for this pair: the visitor says hello, the host answers.
    const hello = visitor.pick("visit") ?? visitor.pick("greet");
    const reply = host.pick("visit") ?? host.pick("greet");
    return { first: visitor, lines: [hello, reply].filter(Boolean) };
  }

  converse() {
    const v = this.visit;
    if (!v) return;
    v.phase = "talking";
    v.nextAt = this.time + 0.35;
  }

  updateVisit() {
    const v = this.visit;
    if (!v) {
      if (this.visitAt != null && this.time >= this.visitAt && this.host?.mode === "rest") {
        this.visitAt = null;
        if (this.queuedVisitor) {
          const c = this.queuedVisitor;
          this.queuedVisitor = null;
          this.beginVisit(c);
        } else this.startVisit();
      }
      return;
    }
    if (v.phase === "arriving" && this.time - v.startedAt > 30) {
      this.endVisit();
      return;
    }
    if (v.phase !== "talking" || this.time < v.nextAt) return;
    const { lines, first } = v.lines;
    if (v.i < lines.length) {
      const speaker = v.i % 2 === 0 ? first : first === v.host ? v.visitor : v.host;
      const other = speaker === v.host ? v.visitor : v.host;
      other.hush();
      const line = lines[v.i];
      speaker.say(line);
      // The first line of a visit comes with a wave.
      if (v.i === 0) {
        speaker.setPose("wave");
        speaker.interrupt([{ type: "wait", seconds: [1.4, 1.4], pose: "wave" }, { type: "rest", seconds: [600, 600] }]);
      }
      v.i += 1;
      v.nextAt = this.time + speaker.bubbleUntil - this.time + 0.25;
      return;
    }
    this.endVisit();
  }

  /** The visitor waves and leaves the way it came; the host goes back to its day. */
  endVisit(now = false) {
    const v = this.visit;
    if (!v) return;
    this.visit = null;
    const { host, visitor, side } = v;
    visitor.leaving = true;
    if (now) {
      this.visitor = null;
      this.publish();
    } else {
      visitor.interrupt([
        { type: "wait", seconds: [0.5, 0.5] },
        { type: "say", topics: ["bye"] },
        { type: "wait", seconds: [1.1, 1.1], pose: "wave" },
        { type: "leave", side },
      ]);
    }
    if (host === this.host && host.mode !== "held") {
      host.interrupt([{ type: "wait", seconds: [1.6, 2.4] }]);
    }
  }

  onPicked(actor) {
    // Carrying either one away ends the visit; the visitor leaves once it is put down.
    if (this.visit) {
      const v = this.visit;
      this.visit = null;
      v.visitor.leaving = true;
      v.visitor.cutShort = true;
      if (v.host.mode !== "held") v.host.interrupt([{ type: "wait", seconds: [1.2, 1.8] }]);
      if (v.visitor.mode !== "held") v.visitor.interrupt([{ type: "wait", seconds: [0.4, 0.4] }, { type: "leave" }]);
    }
    void actor;
  }

  onLanded(actor) {
    if (actor.role === "visitor" && actor.leaving) actor.interrupt([{ type: "wait", seconds: [1.4, 1.4] }, { type: "leave" }]);
  }

  // --- The frame -----------------------------------------------------------------------------------

  tick(dt) {
    dt *= this.options.speed ?? 1;
    this.time += dt;
    if (this.relayoutAt && this.time >= this.relayoutAt) {
      this.relayoutAt = 0;
      this.layout();
    }
    for (const actor of this.actors) actor.update(dt);
    // Someone faded out or walked off: take them off the stage.
    let changed = false;
    if (this.visitor?.gone) {
      this.visitor = null;
      changed = true;
    }
    if (changed) this.publish();
    this.updateVisit();
    this.avoidAfterScroll();
  }

  /**
   * Home scrolls under the characters, and its content arrives and changes. Once a scroll settles,
   * and every few seconds while it rests, the host checks what it is standing over; if that is
   * text or a button and a clearly clearer spot exists, it walks (or hops) there.
   */
  avoidAfterScroll() {
    const scrolled = this.scrollAt != null && this.time - this.scrollAt >= 0.7;
    if (this.scrollAt != null && !scrolled) return;
    if (scrolled) {
      this.scrollAt = null;
      this.relayoutAt = this.time;
    } else if (this.time - this.lastComfort < 5) return;
    this.lastComfort = this.time;
    const host = this.host;
    if (!host || !this.lively || this.visit || host.level == null || host.mode !== "rest" || host.step?.type === "wait" || this.time - this.lastAvoid < 6) return;
    if (!this.options.avoidText) return;
    const here = this.spotScore(host, host.level, host.x);
    if (here < 0.35) return;
    const steps = host.planMove(null, { force: true, better: here - 0.25 });
    if (!steps.length) return;
    this.lastAvoid = this.time;
    host.interrupt([...steps, { type: "rest" }]);
  }
}
