// The luck shelf (src/world/play/games/luck/): the server's daily allowances and keepsakes, and
// the pure rules of each game.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "APNS_KEY_ID"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
globalThis.fetch = () => { throw new Error("External network is disabled in these tests"); };

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });

const luck = await import("../server/lib/gamesLuck.js");
const content = await import("../server/content/luck.js");
const { stickers: drawerStickers } = await import("../server/content/birthday.js");
const handlers = await import("../api/index.js");
const { mulberry32 } = await import("../src/world/play/games/luck/_kit/random.js");
const cups = await import("../src/world/play/games/luck/cups/logic.js");
const cards = await import("../src/world/play/games/luck/cards/logic.js");
const lanterns = await import("../src/world/play/games/luck/lanterns/logic.js");
const dome = await import("../src/world/play/games/luck/capsule/dome.js");

const DAY = "2026-11-27";
const NEXT = "2026-11-28";
const stickerRows = async () => (await db.select().from(schema.kv).where(eq(schema.kv.key, "stickers")))[0]?.value ?? [];
const reset = async () => {
  await db.delete(schema.kv);
};
const never = () => 0.99; // no sticker capsule, everyday charm
const always = () => 0.01; // a sticker capsule whenever one is allowed

// ---------- server: the capsule machine's daily allowance ----------

test("Three capsules a day; a repeated turn (same id) returns the same capsule without using a turn", async () => {
  await reset();
  const first = randomUUID();
  const a = await luck.pullCapsule(db, "kiriya", { pullId: first, day: DAY, random: never });
  assert.equal(a.repeat, false);
  assert.equal(a.luck.capsule.left, 2);
  const again = await luck.pullCapsule(db, "kiriya", { pullId: first, day: DAY, random: always });
  assert.equal(again.repeat, true);
  assert.deepEqual(again.pull, a.pull);
  assert.equal(again.luck.capsule.left, 2);
  await luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: never });
  await luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: never });
  await assert.rejects(luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: never }), (error) => error.code === "no_turns");
  const { state } = await luck.readLuck(db, "kiriya");
  assert.equal(luck.luckSummary(state, DAY).capsule.left, 0);
  assert.equal(Object.values(state.capsule.charms).reduce((sum, n) => sum + n, 0), 3);
});

test("Turns come back the next day, and yesterday's spare coin doesn't carry over", async () => {
  await reset();
  const coin = await luck.claimLanternCoin(db, "kiriya", { day: DAY });
  assert.equal(coin.granted, true);
  assert.equal(coin.luck.capsule.left, 4);
  assert.equal((await luck.claimLanternCoin(db, "kiriya", { day: DAY })).granted, false, "one golden coin a day");
  for (let i = 0; i < 4; i++) await luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: never });
  await assert.rejects(luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: never }));
  const { state } = await luck.readLuck(db, "kiriya");
  assert.deepEqual(luck.capsuleToday(state.capsule, NEXT), { used: 0, bonus: 0, left: luck.CAPSULE_TURNS_PER_DAY });
  const next = await luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: NEXT, random: never });
  assert.equal(next.luck.capsule.left, 2);
  assert.equal((await luck.claimLanternCoin(db, "kiriya", { day: NEXT })).coins, 2);
});

test("Quick taps from two phones at once can't turn out more than the day's capsules", async () => {
  await reset();
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: never })),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  const { state } = await luck.readLuck(db, "kiriya");
  assert.equal(state.capsule.pulls.length, 3);
  assert.equal(state.capsule.used, 3);
});

test("At most one sticker capsule a day; hers go into her collection once, Josh's never do", async () => {
  await reset();
  const one = await luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: always });
  assert.equal(one.pull.kind, "sticker");
  assert.ok(one.pull.sticker.id.startsWith("st-"));
  const two = await luck.pullCapsule(db, "kiriya", { pullId: randomUUID(), day: DAY, random: always });
  assert.equal(two.pull.kind, "charm", "the second sticker of the day becomes a charm");
  await luck.pullCapsule(db, "kiriya", { pullId: one.pull.id, day: DAY, random: always });
  const rows = await stickerRows();
  assert.equal(rows.length, 1, "a repeated pull doesn't save the sticker twice");
  assert.deepEqual(rows[0], { id: one.pull.sticker.id, day: DAY, game: "capsule", reason: `capsule ${one.pull.id}` });
  const his = await luck.pullCapsule(db, "admin", { pullId: randomUUID(), day: DAY, random: always });
  assert.equal(his.pull.kind, "sticker");
  assert.equal((await stickerRows()).length, 1, "test pulls stay out of her collection");
  assert.equal(his.luck.capsule.stickers, 1);
});

test("Sticker capsules prefer stickers she doesn't have yet; charms she lacks come out more often", () => {
  const state = luck.blankLuck();
  const owned = luck.STICKER_POOL.slice(1).map((s) => s.id);
  const prize = luck.choosePrize(state, { day: DAY, random: always, ownedStickers: owned });
  assert.equal(prize.id, luck.STICKER_POOL[0].id);
  assert.equal(prize.isNew, true);
  assert.ok(luck.STICKER_POOL.every((s) => !s.birthdayOnly));
  // Everyday charms: with one already owned, the unowned ones share most of the weight.
  const everyday = content.CHARMS.filter((c) => c.rarity === "everyday");
  state.capsule.charms = { [everyday[0].id]: 2 };
  const rng = mulberry32(3);
  const counts = {};
  for (let i = 0; i < 4000; i++) {
    const p = luck.choosePrize({ ...state, capsule: { ...state.capsule, stickerDay: DAY } }, { day: DAY, random: rng });
    counts[p.id] = (counts[p.id] ?? 0) + 1;
    if (p.id === "crystal-heart") assert.equal(p.capsule, "gold");
  }
  const ownedShare = counts[everyday[0].id] / everyday.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);
  assert.ok(ownedShare < 0.08, `owned charm share ${ownedShare}`);
  assert.ok(Object.keys(counts).length === content.CHARMS.length, "every charm can come out");
});

// ---------- server: the fortune slip ----------

test("One fortune a day, the same one all day, and no repeats until she has read them all", async () => {
  await reset();
  const rng = mulberry32(11);
  const first = await luck.drawFortune(db, "kiriya", { day: DAY, random: rng });
  assert.equal(first.isNew, true);
  assert.ok(first.fortune.text.length > 10);
  assert.ok(content.FORTUNE_LEVELS.some((level) => level.id === first.fortune.level.id));
  const again = await luck.drawFortune(db, "kiriya", { day: DAY, random: rng });
  assert.equal(again.isNew, false);
  assert.deepEqual(again.fortune, first.fortune);
  const seen = new Set([first.fortune.id]);
  for (let i = 1; i < content.FORTUNES.length; i++) {
    const day = new Date(Date.UTC(2026, 10, 27 + i)).toISOString().slice(0, 10);
    const { fortune } = await luck.drawFortune(db, "kiriya", { day, random: rng });
    assert.ok(!seen.has(fortune.id), `repeat on day ${i}`);
    seen.add(fortune.id);
  }
  const { state } = await luck.readLuck(db, "kiriya");
  assert.equal(state.fortune.history.length, content.FORTUNES.length);
  assert.equal(luck.luckSummary(state, DAY).fortune.today, null);
  assert.equal(new Set(content.FORTUNES.map((f) => f.id)).size, content.FORTUNES.length, "fortune ids are unique");
});

test("Best streaks only ever go up, and report the best before", async () => {
  await reset();
  assert.deepEqual((await luck.saveBest(db, "kiriya", { game: "cards", streak: 4, day: DAY })).previous, 0);
  const up = await luck.saveBest(db, "kiriya", { game: "cards", streak: 6, day: DAY });
  assert.equal(up.previous, 4);
  assert.equal(up.best, 6);
  const down = await luck.saveBest(db, "kiriya", { game: "cards", streak: 2, day: DAY });
  assert.equal(down.best, 6);
});

// ---------- the API ----------

function request(route, { method = "GET", cookie, body } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: { "x-kw": "1", ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

test("The luck API needs her sign-in, checks its input, and answers a used-up machine kindly", async () => {
  await reset();
  assert.equal((await request("me/games/luck")).status, 401);
  const unlocked = await request("session/unlock", { method: "POST", body: { passphrase: phrases.kiriya } });
  const cookie = unlocked.headers.get("set-cookie").split(";")[0];
  const summary = await (await request("me/games/luck", { cookie })).json();
  assert.equal(summary.capsule.left, 3);
  assert.equal(summary.capsule.catalogue.length, content.CHARMS.length);
  assert.equal((await request("me/games/luck/capsule", { method: "POST", cookie, body: { pullId: "nope" } })).status, 400);
  for (let i = 0; i < 3; i++) {
    const response = await request("me/games/luck/capsule", { method: "POST", cookie, body: { pullId: randomUUID() } });
    assert.equal(response.status, 200);
  }
  const tired = await request("me/games/luck/capsule", { method: "POST", cookie, body: { pullId: randomUUID() } });
  assert.equal(tired.status, 429);
  assert.match((await tired.json()).message, /tomorrow/);
  assert.equal((await request("me/games/luck/best", { method: "POST", cookie, body: { game: "darts", streak: 3 } })).status, 400);
  const fortune = await (await request("me/games/luck/fortune", { method: "POST", cookie, body: {} })).json();
  assert.ok(fortune.fortune.text);
});

// ---------- client art matches the server's lists ----------

test("Every charm and luck sticker the server can hand out has a picture", async () => {
  const charmArt = await readFile(new URL("../src/world/play/games/luck/capsule/charms.jsx", import.meta.url), "utf8");
  for (const charm of content.CHARMS) assert.ok(charmArt.includes(`${JSON.stringify(charm.id)}:`) || charmArt.includes(`  ${charm.id}:`), charm.id);
  const stickerArt = await readFile(new URL("../src/world/play/games/luck/stickers.jsx", import.meta.url), "utf8");
  for (const sticker of content.LUCK_STICKERS) {
    assert.ok(stickerArt.includes(`  ${sticker.art}: (`), sticker.art);
    assert.ok(stickerArt.includes(`id: "${sticker.id}"`), sticker.id);
  }
  const drawerIds = new Set(drawerStickers.map((s) => s.id));
  for (const m of [...cups.MILESTONES, ...cards.MILESTONES]) {
    assert.ok(drawerIds.has(m.sticker) || content.LUCK_STICKERS.some((s) => s.id === m.sticker), m.sticker);
  }
});

// ---------- the games' rules ----------

test("Teacup shuffle: the star is always where the swaps say, and the pace stays readable", () => {
  for (let round = 1; round <= 30; round++) {
    const settings = cups.roundSettings(round);
    assert.ok(settings.swapMs >= cups.MIN_SWAP_MS);
    assert.ok(settings.cups === 3 || settings.cups === 4);
    if (round > 1) assert.ok(settings.swapMs <= cups.roundSettings(round - 1).swapMs);
    const rng = mulberry32(round);
    for (let charm = 0; charm < settings.cups; charm++) {
      const plan = cups.planSwaps(settings, charm, rng);
      assert.equal(plan.length, settings.swaps);
      let withCharm = 0;
      let at = charm;
      for (const [i, [a, b]] of plan.entries()) {
        assert.ok(a < b && a >= 0 && b < settings.cups);
        if (i > 0) assert.notDeepEqual([a, b], plan[i - 1], "never the same pair twice in a row");
        if (a === at || b === at) withCharm++;
        at = at === a ? b : at === b ? a : at;
      }
      assert.ok(withCharm >= plan.length / 2, "the star's cup really moves");
      const slots = cups.applySwaps(Array.from({ length: settings.cups }, (_, i) => i), plan);
      assert.equal(slots[charm], cups.followCharm(charm, plan));
      assert.equal(new Set(slots).size, settings.cups);
    }
  }
});

test("Lilac cards: a full deck, kind judging (a tie counts), and a fresh deck when it runs out", () => {
  const deck = cards.newDeck(mulberry32(1));
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((c) => c.id)).size, 52);
  const five = { rank: 5 };
  assert.equal(cards.judge(five, { rank: 9 }, "higher"), "right");
  assert.equal(cards.judge(five, { rank: 2 }, "higher"), "wrong");
  assert.equal(cards.judge(five, { rank: 5 }, "lower"), "same");
  let game = cards.newGame(mulberry32(2));
  assert.equal(game.deck.length, 51);
  const total = cards.chances(game.current, game.deck);
  assert.equal(total.higher + total.lower + total.same, 51);
  for (let i = 0; i < 60; i++) {
    const guess = game.current.rank >= 7 ? "lower" : "higher";
    const before = game.streak;
    game = cards.guessTurn(game, guess, mulberry32(i));
    assert.equal(game.streak, game.last.result === "wrong" ? 0 : before + 1);
  }
  assert.ok(game.turns === 60 && game.deck.length < 52);
  assert.strictEqual(cards.guessTurn(game, "sideways"), game);
});

test("Wishing lanterns: a full sky in separate lanes, one golden lantern at most, positions stay on screen", () => {
  const sky = lanterns.newSky(mulberry32(5), { count: 7, golden: true });
  assert.equal(sky.length, 7);
  assert.equal(sky.filter((l) => l.kind === "golden").length, 1);
  assert.equal(new Set(sky.map((l) => l.x)).size, 7);
  assert.equal(new Set(sky.map((l) => l.wish)).size, 7, "no wish twice in one sky");
  assert.equal(lanterns.newSky(mulberry32(5), { golden: false }).filter((l) => l.kind === "golden").length, 0);
  for (const lantern of sky) {
    for (let t = 0; t < 120; t += 0.7) {
      const at = lanterns.lanternAt(lantern, t);
      assert.ok(at.x > 0 && at.x < 1 && at.y > -0.2 && at.y <= 1.1, JSON.stringify(at));
    }
  }
  const used = lanterns.WISHES.slice(0, 20);
  assert.ok(lanterns.newSky(mulberry32(9), { usedWishes: used }).every((l) => !used.includes(l.wish)));
});

test("Capsule dome: capsules stay inside the glass, settle down, and the dome refills", () => {
  const d = dome.createDome({ radius: 104, ballRadius: 20, count: 15, seed: 4 });
  const inside = () => d.balls.every((b) => Math.hypot(b.x, b.y) <= d.radius - b.r + 0.5 && Number.isFinite(b.x + b.y));
  assert.ok(inside());
  for (let turn = 0; turn < 4; turn++) {
    dome.stirDome(d, 1.2);
    for (let i = 0; i < 30; i++) dome.stepDome(d, 1 / 60);
    assert.ok(inside());
  }
  for (let i = 0; i < 400; i++) dome.stepDome(d, 1 / 60);
  assert.ok(d.calm > 30, "the heap comes to rest, so the animation can stop");
  const taken = dome.takeCapsule(d);
  assert.equal(d.balls.length, 14);
  assert.ok(taken.y > 40, "the capsule nearest the exit comes out");
  dome.addCapsule(d);
  assert.equal(d.balls.length, 15);
});
