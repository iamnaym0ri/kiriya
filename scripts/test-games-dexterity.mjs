// The dexterity shelf's rules (src/world/play/games/dexterity/*/logic.js), without a browser.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { seeded } from "../src/world/play/games/dexterity/_kit/random.js";
import { zzfxSamples } from "../src/world/play/games/dexterity/_kit/zzfx.js";
import * as petals from "../src/world/play/games/dexterity/petal-catch/logic.js";
import * as boop from "../src/world/play/games/dexterity/boop-the-cats/logic.js";
import * as tower from "../src/world/play/games/dexterity/mochi-tower/logic.js";
import * as crane from "../src/world/play/games/dexterity/crane-flight/logic.js";

const run = (step, state, seconds, dt = 1 / 60, each) => {
  for (let t = 0; t < seconds; t += dt) {
    step(state, dt);
    each?.(state);
    if (state.over) break;
  }
  return state;
};

describe("kit", () => {
  test("seeded randomness repeats", () => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 20; i++) assert.equal(a(), b());
  });
  test("ZzFX renders every length of design, including a full 21-number one", () => {
    const full = zzfxSamples([0.35, 0, 400, 0.18, 0.2, 0.45, 4, 1, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.5, 0, 0, 1800], { random: seeded(1) });
    assert.ok(full.length > 30000);
    assert.ok(full.every(Number.isFinite));
    const short = zzfxSamples([1, 0, 440], { random: seeded(1) });
    assert.ok(short.length > 4000);
  });
});

describe("petal catch", () => {
  test("a petal falling into the basket is caught, one beside it is missed", () => {
    const s = petals.createPetals({ width: 400, height: 760, random: seeded(3) });
    s.spawnIn = 99;
    s.flurryIn = 99;
    const inside = petals.spawn(s, "lilac", s.basket.x);
    inside.sway = 0;
    run(petals.stepPetals, s, 12);
    assert.equal(s.caught, 1);
    assert.equal(s.score, 1);
    const t = petals.createPetals({ width: 400, height: 760, random: seeded(3) });
    t.spawnIn = 99;
    t.flurryIn = 99;
    const outside = petals.spawn(t, "sakura", 20);
    outside.sway = 0;
    t.basket.x = t.basket.target = 340;
    run(petals.stepPetals, t, 12);
    assert.equal(t.caught, 0);
    assert.equal(t.missed, 1);
  });

  test("three thorns end the round; a thorn right after another bounces off", () => {
    const s = petals.createPetals({ width: 400, height: 760, random: seeded(5) });
    s.spawnIn = 99;
    s.flurryIn = 99;
    for (let hit = 0; hit < 3; hit++) {
      const thorn = petals.spawn(s, "thorn", s.basket.x);
      thorn.sway = 0;
      run(petals.stepPetals, s, 12);
      s.hurt = 0;
    }
    assert.equal(s.lives, 0);
    assert.equal(s.over, true);

    const t = petals.createPetals({ width: 400, height: 760, random: seeded(5) });
    t.spawnIn = 99;
    t.flurryIn = 99;
    const a = petals.spawn(t, "thorn", t.basket.x);
    const b = petals.spawn(t, "thorn", t.basket.x);
    a.sway = b.sway = 0;
    b.y -= 10;
    run(petals.stepPetals, t, 12);
    assert.equal(t.lives, petals.LIVES - 1);
  });

  test("stars are worth five, hearts heal, long streaks double", () => {
    const s = petals.createPetals({ width: 400, height: 760, random: seeded(9) });
    s.spawnIn = 99;
    s.flurryIn = 99;
    s.lives = 2;
    for (const kind of ["star", "heart"]) {
      const item = petals.spawn(s, kind, s.basket.x);
      item.sway = 0;
      run(petals.stepPetals, s, 12);
    }
    assert.equal(s.score, 6);
    assert.equal(s.lives, 3);
    s.streak = 25;
    const p = petals.spawn(s, "lilac", s.basket.x);
    p.sway = 0;
    run(petals.stepPetals, s, 12);
    assert.equal(s.score, 8);
  });

  test("the ramp is gentle and calm mode is gentler", () => {
    const start = petals.difficulty(0);
    const later = petals.difficulty(120);
    assert.ok(later.fall > start.fall && later.fall < 250);
    assert.ok(later.every < start.every && later.every > 0.4);
    assert.equal(petals.difficulty(5).thorn, 0, "no thorns in the first seconds");
    assert.ok(petals.difficulty(120, true).fall < later.fall);
    assert.ok(petals.difficulty(120, true).thorn < later.thorn);
  });

  test("a perfect basket keeps catching for minutes without allocating new petals", () => {
    const s = petals.createPetals({ width: 414, height: 760, random: seeded(11) });
    const pool = s.items;
    run(petals.stepPetals, s, 240, 1 / 60, (st) => {
      // follow the lowest petal, dodge thorns: the bot from the lab script, simplified
      const rim = st.basket.y - st.basket.h * 0.22;
      let best = null;
      for (const item of st.items) if (item.active && item.kind !== "thorn" && item.y < rim && (!best || item.y > best.y)) best = item;
      let x = best ? best.x : st.basket.x;
      for (const item of st.items) {
        if (item.active && item.kind === "thorn" && item.y < rim && rim - item.y < 150 && Math.abs(item.x - x) < 75) {
          x = item.x + (item.x > st.width / 2 ? -95 : 95);
        }
      }
      petals.aimBasket(st, x);
    });
    assert.equal(s.items, pool);
    assert.ok(s.caught > 150, `caught ${s.caught}`);
  });

  test("rewards", () => {
    assert.deepEqual(petals.rewardsFor({ caught: 10, bestStreak: 5 }), []);
    assert.deepEqual(petals.rewardsFor({ caught: 60, bestStreak: 40 }).map((r) => r.sticker), ["st-petal", "st-bow"]);
  });
});

describe("boop the cats", () => {
  test("a cat pops up, can be booped once it shows, and beams before hiding", () => {
    const s = boop.createBoop({ random: seeded(1) });
    s.spawnIn = 99;
    boop.popUp(s, 4, "calico");
    assert.equal(boop.boop(s, 4), "", "too early: still inside the box");
    run(boop.stepBoop, s, 0.1);
    assert.equal(boop.boop(s, 4), "boop");
    assert.equal(s.score, 1);
    assert.equal(s.cells[4].mode, "booped");
    assert.equal(boop.boop(s, 4), "", "no double boops");
    run(boop.stepBoop, s, 1);
    assert.equal(s.cells[4].mode, "empty");
  });

  test("chonks need two boops, sleepy cats cost a point and the combo", () => {
    const s = boop.createBoop({ random: seeded(2) });
    s.spawnIn = 99;
    boop.popUp(s, 0, "chonk");
    run(boop.stepBoop, s, 0.3);
    assert.equal(boop.boop(s, 0), "nudge");
    assert.equal(boop.boop(s, 0), "boop");
    assert.equal(s.score, 3);
    boop.popUp(s, 1, "sleepy");
    run(boop.stepBoop, s, 0.3);
    assert.equal(boop.boop(s, 1), "woke");
    assert.equal(s.score, 2);
    assert.equal(s.combo, 0);
    assert.equal(s.woke, 1);
  });

  test("unbooped cats count as missed (but sleepy ones don't), and the round ends on time", () => {
    const s = boop.createBoop({ random: seeded(4) });
    s.spawnIn = 99;
    boop.popUp(s, 2, "grey");
    boop.popUp(s, 3, "sleepy");
    run(boop.stepBoop, s, 3);
    assert.equal(s.missed, 1);
    run(boop.stepBoop, s, 60);
    assert.equal(s.over, true);
    assert.equal(s.time, boop.roundLength(false));
  });

  test("a quick, careful player can earn both stickers; the pace stays fair", () => {
    const s = boop.createBoop({ random: seeded(7) });
    run(boop.stepBoop, s, 60, 1 / 60, (st) => {
      for (let i = 0; i < boop.CELLS; i++) {
        const cell = st.cells[i];
        if ((cell.mode === "up" || cell.mode === "rising") && cell.kind !== "sleepy" && cell.lift > 0.5) boop.boop(st, i);
      }
    });
    assert.equal(s.missed, 0);
    assert.equal(s.woke, 0);
    assert.ok(s.boops >= 40, `boops ${s.boops}`);
    assert.deepEqual(boop.rewardsFor(s).map((r) => r.sticker), ["st-kitten", "st-paw"]);
    const p = boop.pace(45);
    assert.ok(p.stay >= 0.85 && p.gap >= 0.45);
    assert.ok(boop.pace(60, true).stay > p.stay);
  });
});

describe("mochi tower", () => {
  const fresh = (seed = 1, calm = false) => {
    const s = tower.createTower({ width: 414, calm, random: seeded(seed) });
    tower.layoutTower(s, 414, 680);
    return s;
  };
  const settle = (s) => {
    for (let i = 0; i < 240 && s.piece.mode !== "hang"; i++) tower.stepTower(s, 1 / 60);
    for (let i = 0; i < 30; i++) tower.stepTower(s, 1 / 60); // the breath before the next drop
  };
  // swing until the piece is `offset` px from the top floor's centre, then let go
  const dropAt = (s, offset) => {
    let found = false;
    for (let i = 0; i < 4000 && !found; i++) {
      tower.stepTower(s, 1 / 240);
      found = s.piece.wait === 0 && Math.abs(s.piece.x - tower.topX(s) - offset) < 1.2;
    }
    assert.ok(found, `the swing reaches ${offset}`);
    assert.equal(tower.dropPiece(s), true);
    settle(s);
  };

  test("the first mochi hangs still and lands on the plate", () => {
    const s = fresh();
    tower.stepTower(s, 0.5);
    assert.equal(s.piece.x, 0);
    tower.dropPiece(s);
    settle(s);
    assert.equal(s.floors, 1);
    assert.equal(s.lives, tower.LIVES);
  });

  test("dead centre is perfect and snaps; a little off lands; past the edge tips off", () => {
    const s = fresh(2);
    tower.dropPiece(s);
    settle(s);
    dropAt(s, 3);
    assert.equal(s.floors, 2);
    assert.equal(s.perfects, 1);
    assert.ok(Math.abs(s.xs[1] - s.xs[0]) < 0.01, "a perfect lands exactly on top");
    dropAt(s, s.w * 0.3);
    assert.equal(s.floors, 3);
    assert.equal(s.combo, 0);
    dropAt(s, -s.w * 0.62);
    assert.equal(s.floors, 3);
    assert.equal(s.lives, tower.LIVES - 1);
  });

  test("three tumbles end the round", () => {
    const s = fresh(3);
    tower.dropPiece(s);
    settle(s);
    for (let i = 0; i < 3; i++) dropAt(s, s.w * 0.56);
    for (let i = 0; i < 120 && !s.over; i++) tower.stepTower(s, 1 / 60);
    assert.equal(s.over, true);
    assert.equal(s.floors, 1);
  });

  test("swing and sway grow gently; calm mode is gentler", () => {
    assert.equal(tower.swing(0).angle, 0);
    assert.ok(tower.swing(25).angle > tower.swing(5).angle);
    assert.ok(tower.swing(25).period > 1.5);
    assert.equal(tower.sway(3), 0);
    assert.ok(tower.sway(30) <= 20);
    assert.ok(tower.swing(25, true).angle < tower.swing(25).angle);
    assert.ok(tower.sway(30, true) < tower.sway(30));
  });

  test("a steady hand builds a tall tower and earns both stickers", () => {
    const s = fresh(4);
    tower.dropPiece(s);
    settle(s);
    for (let i = 0; i < 24; i++) dropAt(s, 0);
    assert.equal(s.floors, 25);
    assert.ok(s.bestCombo >= 5);
    assert.deepEqual(tower.rewardsFor(s).map((r) => r.sticker), ["st-mochi", "st-star"]);
    assert.ok(tower.cameraHeight(s) > 0, "the view follows the tower up");
  });
});

describe("paper-crane flight", () => {
  const fly = (s, seconds, pilot) => run(crane.stepFlight, s, seconds, 1 / 60, pilot);
  // a careful pilot: flap whenever below the next gap's middle and not already rising
  const careful = (s) => {
    let next = null;
    for (const o of s.obstacles) if (o.active && o.x + crane.OBSTACLE_WIDTH / 2 > s.crane.x - crane.CRANE_RADIUS && (!next || o.x < next.x)) next = o;
    const target = next ? next.gapY + 18 : s.height * 0.45;
    if (s.crane.y > target && s.crane.vy > -40) crane.flap(s);
  };

  test("the crane waits, hovering, until the first tap", () => {
    const s = crane.createFlight({ random: seeded(1) });
    fly(s, 5);
    assert.equal(s.started, false);
    assert.equal(s.lives, crane.LIVES);
    assert.ok(s.obstacles.every((o) => !o.active));
    crane.flap(s);
    assert.equal(s.started, true);
    assert.ok(s.crane.vy < 0);
  });

  test("falling into the meadow bounces and costs one heart, with grace afterwards", () => {
    const s = crane.createFlight({ random: seeded(2) });
    crane.flap(s);
    fly(s, 2);
    assert.equal(s.lives, crane.LIVES - 1);
    assert.ok(s.crane.vy < 0, "bounced back up");
    assert.ok(s.hurt > 0);
    fly(s, 4);
    assert.ok(s.lives < crane.LIVES - 1, "after the grace period it can bump again");
    fly(s, 20);
    assert.equal(s.over, true);
  });

  test("a careful pilot flies through many gaps; gaps stay reachable and fair", () => {
    const s = crane.createFlight({ random: seeded(3) });
    crane.flap(s);
    let previous = null;
    let widest = 0;
    fly(s, 120, (st) => {
      careful(st);
      for (const o of st.obstacles) {
        if (!o.active || o.seen) continue;
        o.seen = true;
        if (previous !== null) widest = Math.max(widest, Math.abs(o.gapY - previous));
        previous = o.gapY;
        assert.ok(o.gapH >= 170, `gap ${o.gapH}`);
        assert.ok(o.gapY - o.gapH / 2 >= st.ceiling, "gap below the score");
        assert.ok(o.gapY + o.gapH / 2 <= st.ground, "gap above the meadow");
      }
    });
    assert.ok(widest <= 191, `jump between gaps ${widest}`);
    assert.ok(s.gaps >= 40, `gaps ${s.gaps}`);
    assert.ok(s.bestClean >= 15, `clean ${s.bestClean}`);
    assert.deepEqual(crane.rewardsFor(s).map((r) => r.sticker), ["st-crane", "st-sprig"]);
  });

  test("calm mode is slower with wider gaps", () => {
    assert.ok(crane.tuning(30, true).speed < crane.tuning(30).speed);
    assert.ok(crane.tuning(30, true).gap > crane.tuning(30).gap);
  });
});
