// Continuation tests: planners, grounded voice, media gates, motion sampling, saved copies and the
// storage meter, orchestration, internal sources, diagnostics redaction and the new feed routes.
// Isolated in-memory PGlite; no network, no real credentials, no shared .data directory.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of [
  "DATABASE_URL",
  "kData_DATABASE_URL",
  "OPENAI_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "YOUTUBE_API_KEY",
  "TUMBLR_API_KEY",
  "BLUESKY_HANDLE",
  "BLUESKY_APP_PASSWORD",
  "FEED_MODEL_PRICES_JSON",
])
  delete process.env[name];
process.env.NODE_ENV = "test";
process.env.FEEDS_ENABLED = "false";
process.env.FEEDS_FIXTURE_MODE = "true";
process.env.KIRIYA_TZ = "Asia/Singapore";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.CRON_SECRET = randomBytes(32).toString("hex");
const phrase = {
  kiriya: randomBytes(24).toString("hex"),
  admin: randomBytes(24).toString("hex"),
};
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrase.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrase.admin);
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("External fetch disabled in continuation tests");
};

const s = await import("../server/db/schema.js");
const client = new PGlite(),
  db = drizzle({ client, schema: s });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
await migrate(db, { migrationsFolder: "server/db/migrations" });

const { env } = await import("../server/env.js");
const { resolveTaste } = await import("../server/feeds/taste.js");
const P = await import("../server/feeds/planners.js");
const { ERAS } = await import("../server/feeds/sources/tags.js");
const { validateVoice } = await import("../server/feeds/voice.js");
const { derivedFacts } = await import("../server/feeds/writer.js");
const { checkItem, mediaGate } = await import("../server/feeds/moderate.js");
const { THRESHOLDS } = await import("../server/feeds/rules.js");
const M = await import("../server/feeds/motion.js");
const storage = await import("../server/feeds/storage.js");
const { ensureSave, SAVE_LIMITS } = await import("../server/feeds/saves.js");
const { normalizeItem } = await import("../server/feeds/normalize.js");
const { ingestItem, createBuild, rows, hideItems, dislikeSignals } = await import(
  "../server/feeds/repository.js"
);
const { scoreItem } = await import("../server/feeds/score.js");
const { readFeed, markSeen, deletionFresh } = await import(
  "../server/feeds/editions.js"
);
const { afterStage, requestContinuation } = await import(
  "../server/feeds/orchestrate.js"
);
const { eventMilestones, fetchFavesCreators, favesCreators } = await import(
  "../server/feeds/sources/internal.js"
);
const { defineSource, validateAdapterItem } = await import(
  "../server/feeds/sources/registry.js"
);
const { databaseTargets } = await import("../server/feeds/diagnostics.js");
const { upsertEvent } = await import("../server/feeds/events.js");
const { localDay } = await import("../server/lib/time.js");
const { GET, POST, PUT, DELETE } = await import("../api/index.js");

function request(route, { method = "GET", cookie, body, headers = {} } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const u = new URL("/api", original);
  u.search = original.search;
  u.searchParams.set("__route", original.pathname.slice(5));
  return { GET, POST, PUT, DELETE }[method](
    new Request(u, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        "x-kw": "1",
        ...headers,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
async function login(role) {
  const r = await request("session/unlock", {
    method: "POST",
    body: { passphrase: phrase[role] },
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}

const DAY = "2026-10-02";
const taste = resolveTaste().taste;
const ctx = (extra = {}) => ({
  taste,
  day: DAY,
  recentProducers: [],
  recentCreators: [],
  ...extra,
});
const still = (n) => ({
  type: "image",
  url: `https://img.example.test/${n}.jpg`,
  width: 800,
  height: 600,
  poster: null,
  alt: "",
  duration: null,
  bytes: null,
});
let counter = 0;
// An approved feed row in the shape eligibleItems returns.
function row({
  kind = "image",
  sections = ["maomao"],
  tags = {},
  facts = {},
  credit,
  publishedAt = "2026-10-01T10:00:00Z",
  source = "danbooru",
  title,
  media,
} = {}) {
  const n = ++counter;
  return {
    id: `${source}:${n}`,
    source,
    kind,
    sections,
    title: title ?? `${kind} ${n}`,
    url: `https://img.example.test/post/${n}`,
    media:
      media ??
      (["image", "cosplay", "meme", "merch", "look"].includes(kind)
        ? [still(n)]
        : []),
    credit: credit ?? {
      name: `creator ${n}`,
      handle: `creator${n}`,
      platform: source,
      profileUrl: null,
      license: "",
    },
    tags: {
      characters: [],
      fandoms: [],
      voicebanks: [],
      producers: [],
      units: [],
      formats: [],
      topics: [],
      ...tags,
    },
    facts: {
      excerpts: [],
      names: [],
      dates: [],
      prices: [],
      sourceScore: 50,
      links: [],
      ...facts,
    },
    safety: {
      fingerprint: `fp-${n}`,
      source: {
        rating: "g",
        labels: [],
        sourceTags: [],
        nsfw: false,
        deleted: false,
        removed: false,
        communityNsfw: false,
      },
    },
    publishedAt,
    fetchedAt: new Date(),
    expiresAt: null,
  };
}
const ids = (plan) =>
  [...plan.slots, ...plan.reserve].flatMap((slot) => [
    slot.primaryId,
    ...slot.companionIds,
  ]);

// In-memory private Blob store with the blobOps() shape.
function fakeBlob() {
  const objects = new Map();
  return {
    objects,
    async put(pathname, body, contentType) {
      if (objects.has(pathname)) throw new Error("exists");
      objects.set(pathname, {
        size: body.length,
        contentType,
        uploadedAt: new Date(),
      });
      return { pathname };
    },
    async head(pathname) {
      const o = objects.get(pathname);
      return o ? { pathname, size: o.size, contentType: o.contentType } : null;
    },
    async del(pathname) {
      objects.delete(pathname);
    },
    async list(cursor, prefix = "") {
      return {
        blobs: [...objects.entries()]
          .filter(([p]) => p.startsWith(prefix))
          .map(([pathname, o]) => ({
            pathname,
            size: o.size,
            uploadedAt: o.uploadedAt,
          })),
        hasMore: false,
      };
    },
  };
}
const copySource = (extra = {}) =>
  defineSource({
    id: "copytest",
    stage: "fetch-b",
    sections: ["maomao"],
    hosts: ["img.example.test"],
    mediaHosts: ["img.example.test"],
    copyPolicy: "private_copy",
    copyPermission: {
      basis: "synthetic test permission",
      sourceUrl: "https://img.example.test/terms",
      verifiedAt: "2026-09-15",
    },
    deletionPolicy: "honor_deletions",
    deletionDeadlineHours: 24,
    fetch: async () => ({ items: [], cursor: null, done: true }),
    recheck: async () => ({ state: "present" }),
    ...extra,
  });
async function approvedItem(raw) {
  const id = await ingestItem(db, normalizeItem(raw));
  await db
    .update(s.feedItems)
    .set({ safetyStatus: "approved" })
    .where(eq(s.feedItems.id, id));
  return (await db.select().from(s.feedItems).where(eq(s.feedItems.id, id)))[0];
}
const rawItem = (n, extra = {}) => ({
  source: "copytest",
  nativeId: `native-${n}`,
  sections: ["maomao"],
  kind: "image",
  title: `synthetic maomao picture ${n}`,
  url: `https://img.example.test/post/native-${n}`,
  media: [still(`native-${n}`)],
  credit: {
    name: "synthetic artist",
    handle: "synthetic",
    profileUrl: null,
    platform: "Test",
    license: "",
  },
  tags: { characters: ["maomao"] },
  ...extra,
});
const png = await sharp({
  create: {
    width: 4,
    height: 4,
    channels: 3,
    background: { r: 200, g: 170, b: 230 },
  },
})
  .png()
  .toBuffer();

try {
  await test("Maomao planner keeps the recorded allocation, pairs notes, caps creators and never repeats an item", () => {
    const visuals = Array.from({ length: 12 }, () =>
      row({ tags: { characters: ["maomao"] } }),
    );
    const notes = Array.from({ length: 12 }, () =>
      row({ kind: "lore", source: "fandom", tags: { characters: ["maomao"] } }),
    );
    const memes = Array.from({ length: 3 }, () =>
      row({ kind: "meme", source: "bluesky", tags: { characters: ["maomao"] } }),
    );
    const merch = row({
      kind: "merch",
      source: "gsc",
      tags: { characters: ["maomao"] },
      facts: { sgd: 60 },
    });
    const plan = P.planMaomao([...visuals, ...notes, ...memes, merch], ctx());
    const all = ids(plan);
    assert.equal(new Set(all).size, all.length);
    assert.equal(plan.slots.length, 12);
    const count = (type) => plan.slots.filter((x) => x.type === type).length;
    assert.equal(count("visual"), 8);
    assert.equal(count("meme"), 2);
    assert.equal(count("merch"), 1);
    assert.equal(count("note"), 1);
    assert.ok(
      plan.slots
        .filter((x) => x.type === "visual")
        .every((x) => x.companionIds.length === 1),
    );
    assert.ok(plan.reserve.length <= P.QUOTAS.maomao.reserve);
    assert.equal(plan.meta.allocation, "maomao-v1");

    const oneArtist = {
      name: "one artist",
      handle: "one",
      platform: "danbooru",
      profileUrl: null,
      license: "",
    };
    const same = Array.from({ length: 6 }, () =>
      row({ tags: { characters: ["maomao"] }, credit: oneArtist }),
    );
    assert.equal(ids(P.planMaomao(same, ctx())).length, 2);
  });

  await test("Episode-day mode leads with tonight's episode, then the morning-after reactions", () => {
    const airing = row({
      kind: "news",
      source: "anilist",
      title: "the apothecary diaries season 3 episode 3",
      tags: {
        characters: ["maomao"],
        fandoms: ["the apothecary diaries"],
      },
      facts: { airingAt: "2026-10-02T14:00:00Z", episode: 3 },
    });
    const art = Array.from({ length: 4 }, () =>
      row({ tags: { characters: ["maomao"] } }),
    );
    const tonight = P.planMaomao([airing, ...art], ctx());
    assert.equal(tonight.meta.episode.mode, "airing_today");
    assert.equal(tonight.slots[0].primaryId, airing.id);
    assert.equal(tonight.hints[airing.id].hook, "episode_tonight");

    const reaction = row({
      title: "maomao episode 3 reaction art",
      tags: { characters: ["maomao"] },
      publishedAt: "2026-10-02T15:00:00Z",
    });
    const after = P.planMaomao(
      [airing, ...art, reaction],
      ctx({ day: "2026-10-03" }),
    );
    assert.equal(after.meta.episode.mode, "day_after");
    assert.equal(after.slots[0].primaryId, reaction.id);
    assert.equal(after.hints[reaction.id].hook, "episode_reactions");
    assert.equal(after.hints[reaction.id].derived.episode, "3");
  });

  await test("Music planner enforces the seven-day producer rule and a non-Miku song after a Miku-only day", () => {
    const song = (extra) =>
      row({ kind: "song", sections: ["music"], source: "vocadb", media: [], ...extra });
    const recent = song({
      tags: { voicebanks: ["hatsune miku"], producers: ["deco*27"] },
      publishedAt: "2026-09-29T00:00:00Z",
    });
    const twinA = song({
      tags: { voicebanks: ["hatsune miku"], producers: ["pinocchiop"] },
      publishedAt: "2026-09-28T00:00:00Z",
    });
    const twinB = song({
      tags: { voicebanks: ["hatsune miku"], producers: ["pinocchiop"] },
      publishedAt: "2026-09-27T00:00:00Z",
    });
    const teto = song({
      tags: { voicebanks: ["kasane teto"], producers: ["someone else"] },
      publishedAt: "2026-09-26T00:00:00Z",
    });
    const classic = song({
      tags: {
        voicebanks: ["hatsune miku"],
        producers: ["ryo"],
        topics: [ERAS.classics],
      },
      publishedAt: "2010-01-01T00:00:00Z",
    });
    const plan = P.planMusic(
      [recent, twinA, twinB, teto, classic],
      ctx({ recentProducers: ["deco*27"], nonMikuYesterday: false }),
    );
    const chosen = ids(plan);
    assert.ok(!chosen.includes(recent.id), "recent producer excluded");
    assert.ok(!(chosen.includes(twinA.id) && chosen.includes(twinB.id)));
    assert.ok(plan.slots.some((x) => x.primaryId === teto.id));
    assert.ok(plan.slots.some((x) => x.primaryId === classic.id));
    assert.equal(plan.meta.allocation, "music-v1");
  });

  await test("Dress-up builds today's three with the rotating fandom and her own photo; home memes and the shelf follow their rules", () => {
    const first = P.rotatingFandom(taste, DAY);
    assert.equal(P.rotatingFandom(taste, DAY), first);
    assert.notEqual(P.rotatingFandom(taste, "2026-10-03"), first);
    const wanted = first === "music anime" ? "oshi no ko" : first;
    const cos = (characters, fandoms = []) =>
      row({
        kind: "cosplay",
        sections: ["dressup"],
        source: "bluesky",
        tags: { characters, fandoms },
      });
    const plan = P.planDressup(
      [cos(["hatsune miku"]), cos(["maomao"]), cos([], [wanted])],
      ctx({
        personal: {
          photoId: "photo-1",
          character: "Lynette",
          coverUrl: "/api/uploads/media?path=cosplay/x.jpg",
        },
      }),
    );
    const three = plan.slots.filter((x) => x.type === "three");
    assert.deepEqual(
      three.map((x) => x.hook),
      ["daily_three_maomao", "daily_three_rotation", "daily_three_miku"],
    );
    assert.equal(plan.meta.rotatingFandom, first);
    assert.equal(plan.meta.personal.photoId, "photo-1");
    const mao1 = cos(["maomao"]), mao2 = cos(["maomao"]), miku = cos(["hatsune miku"]);
    const preferred = P.planDressup([miku, mao1, mao2, cos([], [wanted])], ctx());
    const pickIds = preferred.slots.filter((x) => x.type === "three").map((x) => x.primaryId);
    assert.deepEqual(new Set(pickIds.slice(0, 2)), new Set([mao1.id, mao2.id]));
    assert.equal(pickIds[2], miku.id);
    const illustration = row({ kind: "image", sections: ["dressup"], tags: { characters: ["maomao"] } });
    const sparse = P.planDressup([miku, illustration], ctx());
    assert.deepEqual(sparse.slots.filter((x) => x.type === "three").map((x) => x.primaryId), [miku.id]);

    // Empty dress-up slots are never filled with extra merch (first production run had 8 merch slots).
    const merchHeavy = P.planDressup(
      [cos(["hatsune miku"]), ...Array.from({ length: 9 }, () => row({ kind: "merch", sections: ["dressup", "merch"], source: "gsc", facts: { sgd: 50 } }))],
      ctx(),
    );
    assert.ok(merchHeavy.slots.filter((x) => x.type === "merch").length <= 1);

    // Owner decision (2026-09-16, second pass): a meme must carry an image or video and must be
    // about something she actually follows. Fandom memes now qualify instead of being excluded —
    // they just rank below an equally relevant general meme so the sections don't repeat.
    const hers = { characters: ["maomao"] };
    const general = Array.from({ length: 7 }, () =>
      row({ kind: "meme", sections: ["meme"], source: "lemmy", tags: hers }),
    );
    const offTopic = row({ kind: "meme", sections: ["meme"], source: "lemmy" });
    const textOnly = row({ kind: "meme", sections: ["meme"], source: "lemmy", tags: hers, media: [] });
    const fandomMeme = row({ kind: "meme", sections: ["meme", "maomao"], source: "bluesky", tags: hers });
    const memes = P.planMeme([fandomMeme, textOnly, offTopic, ...general], ctx());
    assert.equal(memes.slots.length, 1);
    assert.ok(memes.reserve.length <= P.QUOTAS.meme.reserve);
    assert.ok(!ids(memes).includes(offTopic.id), "a meme about nothing she follows is not relevant");
    assert.ok(!ids(memes).includes(textOnly.id), "a text-only meme has nothing to look at");
    assert.notEqual(memes.slots[0].primaryId, fandomMeme.id, "an equally relevant general meme leads");
    // When her fandom is all that's relevant, the fandom meme is used rather than leaving it empty.
    const fandomOnly = P.planMeme([fandomMeme, offTopic], ctx());
    assert.deepEqual([fandomOnly.slots.length, fandomOnly.slots[0]?.primaryId], [1, fandomMeme.id]);

    // Production shipped an empty meme section because community memes carry no taggable subject:
    // a picture from an anime community scored zero affinity and was dropped. Coming FROM one of
    // her communities is the second route to being relevant; a general community still is not.
    const community = (name) =>
      row({
        kind: "meme",
        sections: ["meme"],
        source: "lemmy",
        credit: { name: "poster", handle: "poster", profileUrl: null, platform: `Lemmy · !${name}@ani.social`, license: "" },
      });
    const hersByPlace = community("animemes");
    const anyoneElse = community("memes");
    const placed = P.planMeme([hersByPlace, anyoneElse], ctx());
    assert.ok(ids(placed).includes(hersByPlace.id), "a meme from her anime community is relevant");
    assert.ok(!ids(placed).includes(anyoneElse.id), "a general community meme still needs a subject she follows");

    const merch = (facts) =>
      row({ kind: "merch", sections: ["merch"], source: "gsc", facts: { sgd: 60, ...facts } });
    const later = merch({ preorderUntil: "2026-10-30T00:00:00Z" });
    const soldOut = merch({ availability: "sold_out" });
    const soon = merch({ preorderUntil: "2026-10-05T00:00:00Z" });
    const shelf = P.planMerch([later, soldOut, soon], ctx());
    assert.equal(shelf.slots[0].primaryId, soon.id);
    assert.ok(!ids(shelf).includes(soldOut.id));
  });

  await test("Voice grounding accepts natural blurbs and derived facts but rejects unsupported numbers, claims and names", () => {
    const art = row({
      title: "maomao side-eye",
      tags: { characters: ["maomao"] },
      credit: {
        name: "hanamaru",
        handle: "hanamaru",
        platform: "danbooru",
        profileUrl: null,
        license: "",
      },
    });
    const ok = (blurb, item = art, options) =>
      validateVoice(blurb, item, options);
    assert.equal(
      ok({
        headline: "the side-eye in this one",
        text: "maomao is judging all of us again. honestly fair",
      }),
      null,
    );
    assert.equal(
      ok({ headline: "rare", text: "only 3 of these exist" }),
      "unsupported_number",
    );
    assert.equal(
      ok({ headline: "big news", text: "they just announced a sequel" }),
      "unsupported_claim",
    );
    assert.equal(
      ok({ headline: "tonight only", text: "this drops tonight" }),
      "unsupported_claim",
    );
    assert.equal(
      ok({ headline: "no notes", text: "jinshi could never pull this off" }),
      "unsupported_entity",
    );
    assert.equal(
      ok({ headline: "a callback", text: "giving ur lynette era energy" }),
      "unsupported_entity",
    );
    assert.equal(
      ok(
        { headline: "a callback", text: "giving ur lynette era energy" },
        art,
        { tasteNames: ["lynette"] },
      ),
      null,
    );

    const figure = row({
      kind: "merch",
      title: "nendoroid maomao",
      tags: { characters: ["maomao"] },
      facts: {
        sgd: 89.4,
        preorderUntil: "2026-10-30T03:00:00Z",
        excerpts: ["Preorder period ends 30 Oct"],
      },
    });
    const derived = derivedFacts(figure, DAY);
    assert.equal(derived.sgd, "S$89");
    assert.equal(derived.preorderUntil, "30 Oct");
    assert.equal(
      ok(
        {
          headline: "the wallet is crying",
          text: `preorder until ${derived.preorderUntil}, about ${derived.sgd}. just one more figure`,
        },
        figure,
        { derived },
      ),
      null,
    );
    const episode = row({
      kind: "news",
      facts: { airingAt: "2026-10-02T14:00:00Z", episode: 3 },
    });
    const airing = derivedFacts(episode, DAY);
    assert.equal(airing.airingTime, "22:00");
    assert.equal(airing.airingDay, "tonight");
    assert.equal(airing.episode, "3");
    assert.equal(derivedFacts(episode, "2026-10-01").airingDay, undefined);
  });

  await test("Fallback blurbs survive emoji-heavy source titles (a section emptied in production)", async () => {
    const { writeBlurbs, templateBlurb } = await import("../server/feeds/writer.js");
    assert.equal(templateBlurb({ id: "x", title: "今日はマッチの日🔥" }).text, "今日はマッチの日. worth a look.");
    const items = ["今日はマッチの日🔥", "ミクの日だ〜🎉", "chaos boogie", "初音ミク新曲✨", "ボカロ最高🥰"].map((title, n) => ({
      ...row({ kind: "song", sections: ["music"], source: "vocadb-songs", media: [], title, tags: { voicebanks: ["hatsune miku"] } }),
      id: `vocadb-songs:${n}`,
      safetyStatus: "approved",
      visibility: "active",
    }));
    const offline = {
      model: "gpt-5.6-luna",
      fallbackModel: "gpt-5.4-mini-2026-03-17",
      write: async () => {
        throw Object.assign(new Error("offline"), { code: "provider_unavailable" });
      },
    };
    const stats = {};
    const blurbs = await writeBlurbs(items, offline, {
      taste,
      day: DAY,
      section: "music",
      recentOpeners: [],
      lexicon: { formats: [], fresh: [] },
      hints: {},
      stats,
      history: [],
    });
    assert.equal(stats.skipped, 0);
    assert.equal(blurbs.filter((b) => !b.skip).length, items.length);
  });

  await test("Media gates require recorded YouTube playback and a moving-media policy; sampled frames approve only when every view passes", async () => {
    const now = Date.parse("2026-10-02T00:00:00Z");
    const embed = { mediaPolicy: "embed_provenance" };
    const fresh = {
      embeddable: true,
      regionOk: true,
      ageRestricted: false,
      checkedAt: "2026-10-01T00:00:00Z",
      provenance: "official_channel",
    };
    const yt = (playback, poster = "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg") =>
      row({
        kind: "song",
        sections: ["music"],
        media: [
          {
            type: "youtube",
            url: "https://www.youtube.com/watch?v=abcdefghijk",
            poster,
            width: null,
            height: null,
            alt: "",
            duration: null,
            bytes: null,
          },
        ],
        facts: { playback },
      });
    assert.deepEqual(mediaGate(yt(null), embed, now), ["pending", "playback_unverified"]);
    assert.deepEqual(mediaGate(yt({ ...fresh, regionOk: false }), embed, now), ["rejected", "playback_unavailable"]);
    assert.deepEqual(mediaGate(yt({ ...fresh, ageRestricted: true }), embed, now), ["rejected", "age_restricted"]);
    assert.deepEqual(mediaGate(yt({ ...fresh, provenance: "unknown" }), embed, now), ["pending", "provenance_unverified"]);
    assert.equal(mediaGate(yt({ ...fresh, provenance: "creator_upload" }), embed, now), null);
    assert.deepEqual(mediaGate(yt({ ...fresh, checkedAt: "2026-09-20T00:00:00Z" }), embed, now), ["pending", "playback_stale"]);
    assert.deepEqual(mediaGate(yt(fresh, null), embed, now), ["pending", "poster_missing"]);
    assert.equal(mediaGate(yt(fresh), embed, now), null);
    assert.deepEqual(mediaGate(yt(fresh), { mediaPolicy: "still_only" }, now), ["pending", "moving_review_required"]);

    const gif = row({
      kind: "clip",
      media: [{ ...still("g"), type: "gif", url: "https://img.example.test/g.gif" }],
      tags: { characters: ["maomao"] },
    });
    assert.deepEqual(mediaGate(gif, { mediaPolicy: "still_only" }), ["pending", "moving_review_required"]);
    assert.equal(mediaGate(gif, { mediaPolicy: "moving_sampled" }), null);

    const clean = {
      flagged: false,
      categories: Object.fromEntries(Object.keys(THRESHOLDS).map((k) => [k, false])),
      category_scores: Object.fromEntries(Object.keys(THRESHOLDS).map((k) => [k, 0.001])),
    };
    const vision = (characters) => ({
      characters,
      isCosplayPhoto: false,
      isMeme: false,
      meme: { format: "other", humor: "unknown", political: false, topics: [], text: "", fandom: "" },
      suggestive: "none",
      apparentMinor: false,
      gore: false,
      horror: false,
      political: false,
      quality: 4,
      aiLikelihood: "low",
      aiConfidence: 0.9,
      note: "",
    });
    const frames = [
      { kind: "frames", mediaIndex: 0, type: "gif", sampledFrames: 4 },
      { kind: "frames", mediaIndex: 0, type: "gif", sampledFrames: 4 },
    ];
    const provider = {
      views: async () => frames,
      moderate: async () => clean,
      vision: async (item, index) => vision(index === 0 ? ["maomao"] : []),
    };
    const source = { mediaPolicy: "moving_sampled" };
    const approved = await checkItem(gif, provider, { source });
    assert.equal(approved.status, "approved");
    assert.equal(approved.evidence.scope, "sampled-frames");
    assert.deepEqual(approved.evidence.eligibleSections, ["maomao"]);
    // Owner decision (2026-09-16): scores below OpenAI's own flag don't reject, except the minors check.
    const scored = (key, score) => ({ ...clean, category_scores: { ...clean.category_scores, [key]: score } });
    assert.equal((await checkItem(gif, { ...provider, moderate: async () => scored("sexual", 0.4) }, { source })).status, "approved");
    assert.equal((await checkItem(gif, { ...provider, moderate: async () => scored("sexual/minors", 0.05) }, { source })).status, "rejected");
    const flaggedSecondSheet = {
      ...provider,
      moderate: async (item, index) => (index === 1 ? { ...clean, flagged: true } : clean),
    };
    assert.equal((await checkItem(gif, flaggedSecondSheet, { source })).status, "rejected");
    // Owner decision (2026-09-16): uncertainty approves (flagged); definite suggestive/explicit rejects.
    const unsure = await checkItem(gif, { ...provider, vision: async (item, index) => ({ ...vision(index === 0 ? ["maomao"] : []), suggestive: "uncertain", aiConfidence: 0.5 }) }, { source });
    assert.deepEqual([unsure.status, unsure.evidence.uncertain], ["approved", true]);
    // Owner decision (2026-09-16, second pass): suggestive/sexy passes, only explicit rejects…
    const suggestive = await checkItem(gif, { ...provider, vision: async (item, index) => ({ ...vision(index === 0 ? ["maomao"] : []), suggestive: "suggestive" }) }, { source });
    assert.equal(suggestive.status, "approved");
    assert.equal((await checkItem(gif, { ...provider, vision: async () => ({ ...vision(["maomao"]), suggestive: "explicit" }) }, { source })).status, "rejected");
    // …except that anything sexualised must read as an adult. Here uncertainty rejects, and it
    // applies to the merely-suggestive and the uncertain alike, not just the explicit.
    for (const level of ["uncertain", "suggestive", "explicit"]) {
      const minor = await checkItem(gif, { ...provider, vision: async () => ({ ...vision(["maomao"]), suggestive: level, apparentMinor: true }) }, { source });
      assert.deepEqual([minor.status, minor.reason], ["rejected", "apparent_minor"], `suggestive=${level} + apparentMinor must reject`);
    }
    // A non-sexualised image of a young-looking character is ordinary content and stays.
    assert.equal((await checkItem(gif, { ...provider, vision: async (item, index) => ({ ...vision(index === 0 ? ["maomao"] : []), suggestive: "none", apparentMinor: true }) }, { source })).status, "approved");
    // Owner decision (2026-09-16, third pass): a meme is approved unless it is outright explicit,
    // so the stream stays alive. The classifier calling it "not a meme", an unlabelled sense of
    // humour, or a grainy picture no longer turn one away.
    const asMeme = { ...gif, kind: "meme", sections: ["meme"] };
    const memeVision = (over) => ({ ...vision(["maomao"]), isMeme: true, ...over });
    for (const [label, over] of [
      ["the classifier says it is not a meme", { isMeme: false }],
      ["the humour is brainrot", { meme: { ...memeVision().meme, humor: "brainrot" } }],
      ["the humour is unlabelled", { meme: { ...memeVision().meme, humor: "unknown" } }],
      ["the picture is grainy", { quality: 1 }],
    ]) {
      const got = await checkItem(asMeme, { ...provider, vision: async () => memeVision(over) }, { source });
      assert.equal(got.status, "approved", `a meme should survive when ${label} (got ${got.reason})`);
    }
    // The two standing exclusions still hold, and explicit still rejects.
    for (const [label, over] of [
      ["politics", { meme: { ...memeVision().meme, political: true } }],
      ["a joke about self-harm", { meme: { ...memeVision().meme, text: "kys lol" } }],
    ]) {
      const got = await checkItem(asMeme, { ...provider, vision: async () => memeVision(over) }, { source });
      assert.deepEqual([got.status, got.reason], ["rejected", "meme_rules"], `a meme with ${label} is still out`);
    }
    const explicitMeme = await checkItem(asMeme, { ...provider, vision: async () => memeVision({ suggestive: "explicit" }) }, { source });
    assert.equal(explicitMeme.status, "rejected", "outright explicit is still the line");

    const noMaomao = { ...provider, vision: async () => vision(["frieren"]) };
    assert.deepEqual(
      [(await checkItem(gif, noMaomao, { source })).reason],
      ["required_character_missing"],
    );
  });

  await test("Motion sampling spreads frames evenly, tiles contact sheets and refuses encrypted playlists", async () => {
    assert.deepEqual(M.evenlySpaced(3, 8), [0, 1, 2]);
    const spread = M.evenlySpaced(100, 8);
    assert.equal(spread.length, 8);
    assert.ok(spread.every((v, i) => v >= 0 && v < 100 && (i === 0 || v > spread[i - 1])));
    const playlist = M.parsePlaylist(
      [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:BANDWIDTH=2000000",
        "high/index.m3u8",
        "#EXT-X-STREAM-INF:BANDWIDTH=400000",
        "low/index.m3u8",
      ].join("\n"),
      "https://video.example.test/v/master.m3u8",
    );
    assert.equal(playlist.variants[0].url, "https://video.example.test/v/low/index.m3u8");
    const media = M.parsePlaylist(
      ['#EXTM3U', '#EXT-X-MAP:URI="init.mp4"', "#EXTINF:4.0,", "seg0.m4s", "#EXTINF:4.0,", "seg1.m4s"].join("\n"),
      "https://video.example.test/v/low/index.m3u8",
    );
    assert.equal(media.init, "https://video.example.test/v/low/init.mp4");
    assert.equal(media.segments.length, 2);
    assert.throws(
      () => M.parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:4,\ns.ts', "https://video.example.test/v/"),
      (e) => e.code === "motion_encrypted",
    );
    const pages = await Promise.all(
      [...Array(10).keys()].map((i) =>
        sharp({ create: { width: 32, height: 32, channels: 3, background: { r: i * 25, g: 90, b: 200 } } })
          .png()
          .toBuffer(),
      ),
    );
    const gif = await sharp(pages, { join: { animated: true } }).gif().toBuffer();
    const sampled = await M.sampleAnimatedImage(gif);
    assert.equal(sampled.sampledFrames, 8);
    const sheets = await M.contactSheets(sampled.frames);
    assert.equal(sheets.length, 2);
    const meta = await sharp(sheets[0]).metadata();
    assert.deepEqual([meta.width, meta.height], [512, 512]);
  });

  await test("Saved copies are verified before ready, cleaned up on failure, reconciled after crashes and removed when the creator deletes", async () => {
    const blob = fakeBlob();
    const registry = [copySource()];
    // A personal upload shares the store and must never be touched by copy cleanup.
    await blob.put("cosplay/her-photo.jpg", Buffer.alloc(2048), "image/jpeg");
    const http = { binary: async (url) => ({ buffer: png, contentType: "image/png", url }) };

    const item = await approvedItem(rawItem(1));
    const save = await ensureSave(db, item, registry[0]);
    assert.equal(save.copyState, "pending");
    const done = await storage.copySave(db, save.id, { registry, ops: blob, http });
    assert.equal(done.outcome, "ready");
    const [ready] = await db.select().from(s.saves).where(eq(s.saves.id, save.id));
    assert.equal(ready.copyState, "ready");
    assert.match(ready.blobPath, /^saves\//);
    assert.equal(blob.objects.get(ready.blobPath).size, png.length);
    let [meter] = await db.select().from(s.feedStorage);
    assert.equal(Number(meter.reservedBytes), 0);
    assert.equal(Number(meter.copyBytes), png.length);

    // Verification failure: the partial object is deleted and the reservation released.
    const broken = { ...blob, head: async (p) => (blob.objects.has(p) ? { pathname: p, size: 1 } : null) };
    const second = await ensureSave(db, await approvedItem(rawItem(2)), registry[0]);
    const failed = await storage.copySave(db, second.id, { registry, ops: broken, http });
    assert.deepEqual([failed.outcome, failed.reason], ["failed", "copy_verification_failed"]);
    const [retry] = await db.select().from(s.saves).where(eq(s.saves.id, second.id));
    assert.equal(retry.copyState, "retryable");
    assert.ok(![...blob.objects.keys()].some((p) => p.startsWith(`saves/${second.id}`)));
    [meter] = await db.select().from(s.feedStorage);
    assert.equal(Number(meter.reservedBytes), 0);

    // A worker that disappeared after upload: reconciliation completes from the stored object.
    const { reserveCopy } = await import("../server/feeds/saves.js");
    const third = await ensureSave(db, await approvedItem(rawItem(3)), registry[0]);
    const stale = await reserveCopy(db, third.id, SAVE_LIMITS.itemBytes, { now: new Date(Date.now() - 600000) });
    assert.equal(stale.outcome, "reserved");
    await blob.put(`saves/${third.id}-0123456789abcdef.png`, png, "image/png");
    const reconciled = await storage.reconcileCopies(db, { ops: blob });
    assert.deepEqual(reconciled.results.map((r) => r.outcome), ["completed"]);

    // Orphans: an old unreferenced saves/ object goes; uploads and referenced copies stay.
    blob.objects.set(`saves/${randomUUID()}-deadbeefdeadbeef.png`, { size: 10, uploadedAt: new Date(Date.now() - 7200000) });
    const cleaned = await storage.cleanupOrphans(db, { ops: blob });
    assert.equal(cleaned.removed, 1);
    assert.ok(blob.objects.has("cosplay/her-photo.jpg"));
    assert.ok(blob.objects.has(ready.blobPath));

    // Creator deletion: the copy is deleted and bytes released; the credit and title remain.
    const removedRegistry = [copySource({ recheck: async () => ({ state: "removed", scope: "deleted" }) })];
    await db.update(s.saves).set({ lastCheckedAt: new Date(Date.now() - 2 * 86400000) }).where(eq(s.saves.id, save.id));
    const recheck = await storage.recheckSavedCopies(db, { registry: removedRegistry, ops: blob });
    assert.ok(recheck.removed >= 1);
    const [gone] = await db.select().from(s.saves).where(eq(s.saves.id, save.id));
    assert.equal(gone.copyState, "removed");
    assert.equal(gone.blobPath, null);
    assert.equal(gone.credit.name, "synthetic artist");
    assert.ok(!blob.objects.has(ready.blobPath));

    // A copy that isn't permitted by the source stays a link, never a private copy.
    const linkOnly = defineSource({ ...copySource(), copyPolicy: "link_only", copyPermission: null });
    const linked = await ensureSave(db, await approvedItem(rawItem(4)), linkOnly);
    assert.equal(linked.copyState, "link_only");

    // Upload guard: a fresh meter close to capacity refuses another maximum-size upload.
    await db.execute(sql`UPDATE feed_storage SET total_store_bytes=${990 * 1024 * 1024},measured_at=now()`);
    assert.equal((await storage.uploadCapacity(15 * 1024 * 1024)).ok, false);
    await db.execute(sql`UPDATE feed_storage SET total_store_bytes=${100 * 1024 * 1024},measured_at=now()`);
    assert.equal((await storage.uploadCapacity(15 * 1024 * 1024)).ok, true);
    await db.execute(sql`UPDATE feed_storage SET measured_at=now()-interval '3 days'`);
    assert.equal((await storage.uploadCapacity(15 * 1024 * 1024)).measured, false);
  });

  await test("A source storage ceiling keeps only credit and link in saves, and expired payloads are purged", async () => {
    const { pruneFeeds } = await import("../server/feeds/repository.js");
    const tumblrLike = copySource({
      id: "copytest",
      copyPolicy: "link_only",
      copyPermission: null,
      retentionHours: 72,
    });
    const post = await approvedItem(
      rawItem(60, {
        title: "a tumblr post caption that must not outlive 72 hours",
        facts: { excerpts: ["source caption text"] },
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    );
    const saved = await ensureSave(db, post, tumblrLike);
    await db.execute(sql`UPDATE feed_items SET expires_at=now()-interval '1 minute' WHERE id=${post.id}`);
    assert.equal(saved.copyState, "link_only");
    assert.equal(saved.title, "a post by synthetic");
    assert.deepEqual([saved.snapshot.media, saved.snapshot.facts], [[], {}]);
    assert.equal(saved.url, post.url);
    assert.equal(saved.credit.name, "synthetic artist");
    const { payloadsRemoved } = await pruneFeeds(db);
    assert.ok(payloadsRemoved >= 1);
    assert.equal((await db.select().from(s.feedItems).where(eq(s.feedItems.id, post.id))).length, 0);
    assert.equal((await db.select().from(s.saves).where(eq(s.saves.id, saved.id))).length, 1);
  });

  await test("\"Not for me\" hides the post and teaches the next edition, without burying a whole subject", async () => {
    // Owner ask (2026-09-16): hiding should filter out things she doesn't like, not just that post.
    const genshin = { characters: ["furina"], fandoms: ["genshin impact"] };
    const hidden = [];
    for (let n = 0; n < 2; n++)
      hidden.push(await approvedItem(rawItem(600 + n, { kind: "meme", sections: ["meme"], tags: genshin, credit: { name: "repeat poster", handle: "repeat", profileUrl: null, platform: "Test", license: "" } })));
    const once = await approvedItem(rawItem(610, { kind: "meme", sections: ["meme"], tags: { fandoms: ["frieren"] } }));

    // Nothing is learned until she actually hides something.
    assert.deepEqual(await dislikeSignals(db), { tags: {}, creators: {} });
    await hideItems(db, hidden.map((i) => i.id), "kiriya");
    await hideItems(db, [once.id], "kiriya");
    const signals = await dislikeSignals(db);
    // Two hides of the same subject register; a single hide of another does not bury it.
    assert.equal(signals.tags["fandoms:genshin impact"], 2);
    assert.equal(signals.tags["fandoms:frieren"], undefined, "one hide never buries a whole fandom");
    assert.equal(signals.creators["copytest:repeat"], 2);

    // An owner moderation hide is not her preference and must not train anything.
    const ownerHidden = await approvedItem(rawItem(620, { kind: "meme", sections: ["meme"], tags: { fandoms: ["bocchi the rock!"] } }));
    await hideItems(db, [ownerHidden.id], "owner");
    assert.equal((await dislikeSignals(db)).tags["fandoms:bocchi the rock!"], undefined);

    // The learned signal actually moves ranking: same item, lower score once its subject is hidden.
    const candidate = await approvedItem(rawItem(630, { kind: "meme", sections: ["meme"], tags: genshin }));
    const opts = { day: DAY, section: "meme" };
    const before = scoreItem(candidate, taste, opts);
    const after = scoreItem(candidate, taste, { ...opts, dislikes: signals });
    assert.ok(after.score < before.score, "a hidden subject ranks lower next time");
    assert.ok(after.parts.penalties > before.parts.penalties);
  });

  await test("Deletion deadlines hide stale community items; the merch shelf keeps items she has already looked at", async () => {
    const fresh = deletionFresh(Date.parse("2026-10-02T12:00:00Z"), [
      { id: "bluesky", deletionPolicy: "honor_deletions", deletionDeadlineHours: 24 },
    ]);
    assert.equal(fresh({ source: "bluesky", fetchedAt: new Date("2026-10-01T13:00:00Z"), safety: {} }), true);
    assert.equal(fresh({ source: "bluesky", fetchedAt: new Date("2026-09-30T00:00:00Z"), safety: {} }), false);
    assert.equal(fresh({ source: "bluesky", fetchedAt: new Date("2026-09-30T00:00:00Z"), safety: { recheckedAt: "2026-10-02T06:00:00Z" } }), true);
    assert.equal(fresh({ source: "danbooru", fetchedAt: new Date("2020-01-01T00:00:00Z"), safety: {} }), true);

    const day = localDay();
    const build = await createBuild(db, day, { mode: "live", force: true });
    const shelfItem = await approvedItem(rawItem(10, { sections: ["merch", "maomao"], kind: "merch", title: "synthetic acrylic stand" }));
    const blurb = { id: shelfItem.id, skip: false, skipReason: "", headline: "a shelf thing", text: "look at her", cta: "shop", drawPrompt: false };
    for (const section of ["merch", "maomao"])
      await db.insert(s.feedEditions).values({
        buildId: build.id,
        section,
        day,
        revision: `${build.id}:${section}`,
        tasteRevision: build.tasteRevision,
        state: "published",
        slots: [{ key: `${section}-0`, type: "merch", primaryId: shelfItem.id, companionIds: [] }],
        reserve: [],
        meta: { fixture: false, blurbs: { [shelfItem.id]: blurb }, fingerprints: { [shelfItem.id]: shelfItem.safety.fingerprint }, scores: {}, plan: null },
        publishedAt: new Date(),
      });
    await markSeen(db, { revision: `${build.id}:maomao`, ids: [shelfItem.id] }, "kiriya");
    const shelf = await readFeed(db, "merch", { day });
    assert.deepEqual(shelf.slots.map((x) => x.primary.id), [shelfItem.id]);
    assert.equal(shelf.counts.new, 0);
    assert.equal(shelf.closing, null);
    const club = await readFeed(db, "maomao", { day });
    assert.equal(club.slots.length, 0);
    assert.equal(club.seenEarlier.length, 1);
    assert.match(club.closing, /everything/);
  });

  await test("Re-fetching refreshes volatile facts without resetting safety; real content changes still re-check", async () => {
    const first = await approvedItem(rawItem(20, { facts: { sourceScore: 12, sgd: 40 } }));
    const again = normalizeItem(rawItem(20, { facts: { sourceScore: 97, sgd: 41 } }));
    assert.equal(again.fingerprint, first.safety.fingerprint);
    await ingestItem(db, again);
    let [row20] = await db.select().from(s.feedItems).where(eq(s.feedItems.id, first.id));
    assert.equal(row20.safetyStatus, "approved");
    assert.deepEqual([row20.facts.sourceScore, row20.facts.sgd], [97, 41]);
    await ingestItem(db, normalizeItem(rawItem(20, { title: "a different picture now", facts: { sourceScore: 97 } })));
    [row20] = await db.select().from(s.feedItems).where(eq(s.feedItems.id, first.id));
    assert.equal(row20.safetyStatus, "pending");
    assert.equal(row20.title, "a different picture now");
  });

  await test("Paid checks go to each section's likeliest items first, and daily pacing leaves the writer room", async () => {
    const { checkQueue } = await import("../server/feeds/jobs.js");
    const { reserveRequest, spentToday } = await import("../server/feeds/usage.js");
    const { feedConfig } = await import("../server/feeds/config.js");
    const build = await createBuild(db, localDay(), { mode: "live", force: true });
    const pendingIds = {};
    const add = async (key, raw) => (pendingIds[key] = await ingestItem(db, normalizeItem(raw)));
    await add("note", rawItem(30, { kind: "lore", media: [], title: "a lore note" }));
    await add("loved", rawItem(31, { title: "maomao with herbs", tags: { characters: ["maomao"] } }));
    for (let i = 0; i < 6; i++)
      await add(`plain${i}`, rawItem(40 + i, { title: `a quiet picture ${i}`, tags: {} }));
    const config = { ...feedConfig(), checkQuotas: { maomao: 3, music: 3, dressup: 3, meme: 3, merch: 3 } };
    const heldBack = await ingestItem(db, normalizeItem(rawItem(50, { title: "a quiet picture held back earlier", tags: {} })));
    await db.update(s.feedItems).set({ reason: "vision_uncertain" }).where(eq(s.feedItems.id, heldBack));
    const fandomMeme = await ingestItem(db, normalizeItem(rawItem(51, { kind: "meme", sections: ["meme", "maomao"], title: "a maomao meme", tags: { characters: ["maomao"] } })));
    const homeMeme = await ingestItem(db, normalizeItem(rawItem(52, { kind: "meme", sections: ["meme"], title: "a general anime meme", tags: {} })));
    const queue = await checkQueue(db, build, config);
    assert.equal(queue[0], pendingIds.note, "free text checks come first");
    assert.ok(queue.indexOf(heldBack) > 0 && queue.indexOf(heldBack) < queue.indexOf(pendingIds.loved), "earlier uncertain items are re-evaluated first");
    assert.ok(queue.includes(homeMeme));
    assert.ok(queue.includes(fandomMeme), "fandom memes still come through their own section's quota");
    // A moderation rejection made under an older rules version is reconsidered once under the current rules.
    const oldRejection = await ingestItem(db, normalizeItem(rawItem(53, { title: "a cosplay photo rejected by the old threshold", tags: {} })));
    await db.execute(sql`UPDATE feed_items SET safety_status='rejected',reason='moderation',safety=safety||'{"rulesVersion":"2026-09-15.1"}'::jsonb WHERE id=${oldRejection}`);
    const currentRejection = await ingestItem(db, normalizeItem(rawItem(54, { title: "a photo rejected under the current rules", tags: {} })));
    const { RULE_VERSION } = await import("../server/feeds/rules.js");
    await db.execute(sql`UPDATE feed_items SET safety_status='rejected',reason='moderation',safety=safety||jsonb_build_object('rulesVersion',${RULE_VERSION}::text) WHERE id=${currentRejection}`);
    const requeued = await checkQueue(db, build, config);
    assert.ok(requeued.includes(oldRejection));
    assert.ok(!requeued.includes(currentRejection));
    const paid = queue.filter((id) => id !== pendingIds.note && Object.values(pendingIds).includes(id));
    assert.ok(paid.length <= 4, "paid checks respect the section quota");
    assert.equal(paid[0], pendingIds.loved, "the item her taste favours is inspected first");

    const month = localDay().slice(0, 7);
    const usage = (purpose, stage, micros) =>
      db.insert(s.feedUsage).values({
        id: randomUUID(),
        requestKey: `${build.id}:${stage}:${purpose}:${randomUUID()}`,
        month,
        buildId: build.id,
        stage,
        purpose,
        model: "gpt-5.6-luna",
        status: "settled",
        reservedMicros: micros,
        chargedMicros: micros,
      });
    const before = await spentToday(db);
    await usage("diagnostic_vision", "diagnostics", 90000);
    assert.equal(await spentToday(db), before, "diagnostics sit outside daily pacing");
    await usage("vision", "check", config.dailyLimitMicros);
    await assert.rejects(
      reserveRequest(db, {
        run: { buildId: build.id, stage: "plan-write" },
        key: "writer:paced",
        model: "gpt-5.6-luna",
        purpose: "writer",
        estimate: 1000,
        prices: {},
        config,
      }),
      (e) => e.code === "paused_for_budget",
    );
  });

  await test("The check stage stops cleanly at the request cap and retries transient failures once (first production run)", async () => {
    const { FeedError, feedConfig } = await import("../server/feeds/config.js");
    const { runStage } = await import("../server/feeds/jobs.js");
    const clean = {
      flagged: false,
      categories: Object.fromEntries(Object.keys(THRESHOLDS).map((k) => [k, false])),
      category_scores: Object.fromEntries(Object.keys(THRESHOLDS).map((k) => [k, 0.001])),
    };
    const capped = {
      views: async () => [{ kind: "still", mediaIndex: 0, type: "image" }],
      moderate: async () => {
        throw new FeedError("invocation_request_limit", 429);
      },
      vision: async () => ({}),
    };
    await assert.rejects(
      checkItem(row({ tags: { characters: ["maomao"] } }), capped, { source: { mediaPolicy: "still_only" } }),
      (e) => e.code === "invocation_request_limit",
    );

    const build = await createBuild(db, localDay(), { mode: "live", force: true });
    for (const stage of ["fetch-a", "fetch-b"])
      await db.execute(sql`INSERT INTO feed_runs(build_id,stage,day,status) VALUES (${build.id}::uuid,${stage},${build.day}::date,'done')`);
    const flaky = await ingestItem(db, normalizeItem(rawItem(70, { kind: "lore", media: [], title: "a lore note that fails once" })));
    const steady = await ingestItem(db, normalizeItem(rawItem(71, { kind: "lore", media: [], title: "a lore note that passes" })));
    let failedOnce = false;
    const provider = {
      moderate: async (item) => {
        if (item.id === flaky && !failedOnce) {
          failedOnce = true;
          throw new Error("transient upstream failure");
        }
        return clean;
      },
      vision: async () => ({}),
    };
    const result = await runStage(db, {
      buildId: build.id,
      stage: "check",
      config: { ...feedConfig(), enabled: true, fixtureMode: false },
      providerFactory: () => provider,
      registry: [copySource()],
    });
    assert.equal(result.outcome, "completed");
    const status = async (id) => (await db.select().from(s.feedItems).where(eq(s.feedItems.id, id)))[0].safetyStatus;
    assert.equal(failedOnce, true);
    assert.equal(await status(steady), "approved");
    assert.equal(await status(flaky), "approved", "the retry pass re-checks a transient failure in the same build");
  });

  await test("FEEDS_ENABLED=manual allows owner stage runs but keeps cron, continuations and catch-up off", async () => {
    const { feedConfig } = await import("../server/feeds/config.js");
    const { runStage, claimCatchUp } = await import("../server/feeds/jobs.js");
    const previous = process.env.FEEDS_ENABLED;
    process.env.FEEDS_ENABLED = "manual";
    try {
      const manual = { ...feedConfig(), fixtureMode: false };
      assert.deepEqual([manual.enabled, manual.manualRuns], [false, true]);
      const cron = await request("jobs/feeds/check", { headers: { authorization: `Bearer ${env.cronSecret}` } });
      assert.equal((await cron.json()).outcome, "disabled");
      const continued = await request("jobs/feeds/check/continue", {
        method: "POST",
        headers: { authorization: `Bearer ${env.cronSecret}` },
        body: { buildId: randomUUID() },
      });
      assert.equal((await continued.json()).outcome, "disabled");
      assert.equal((await claimCatchUp(db, { config: manual })).outcome, "disabled");
      const build = await createBuild(db, localDay(), { mode: "live", force: true });
      const owner = await runStage(db, { buildId: build.id, stage: "fetch-a", config: manual, registry: [] });
      assert.notEqual(owner.outcome, "disabled");
      const off = { ...manual, manualRuns: false };
      assert.equal((await runStage(db, { buildId: build.id, stage: "fetch-a", config: off, registry: [] })).outcome, "disabled");
    } finally {
      process.env.FEEDS_ENABLED = previous;
    }
  });

  await test("Continuations target the production domain with the cron bearer, chain stages and stop at the cap", async () => {
    const build = await createBuild(db, localDay(), { mode: "live", force: true });
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return { status: 202 };
    };
    // A preview deployment (behind deployment protection) never continues itself.
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    assert.deepEqual(
      await requestContinuation(db, { buildId: build.id, stage: "check", fetchImpl }),
      { scheduled: false, reason: "no_continuation_target" },
    );
    assert.equal(calls.length, 0);
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "kiriya.love";
    try {
      const next = await afterStage(db, { buildId: build.id, stage: "fetch-a", outcome: "completed" }, { fetchImpl });
      assert.equal(next.next, "fetch-b");
      assert.equal(next.scheduled, true);
      assert.equal(calls[0].url, "https://kiriya.love/api/jobs/feeds/fetch-b/continue");
      assert.equal(calls[0].options.method, "POST");
      assert.ok(calls[0].options.headers.authorization === `Bearer ${env.cronSecret}`);
      assert.deepEqual(JSON.parse(calls[0].options.body), { buildId: build.id });
      assert.equal((await afterStage(db, { buildId: build.id, stage: "check", outcome: "checkpointed" }, { fetchImpl })).next, "check");
      assert.equal((await afterStage(db, { buildId: build.id, stage: "publish", outcome: "completed" }, { fetchImpl })).next, null);
      assert.equal((await afterStage(db, { buildId: build.id, stage: "check", outcome: "failed" }, { fetchImpl })).next, null);
      await db.execute(sql`INSERT INTO feed_runs(build_id,stage,day,status,stats) VALUES (${build.id}::uuid,'plan-write',${build.day}::date,'pending','{"continuations":16}'::jsonb)`);
      assert.deepEqual(
        await requestContinuation(db, { buildId: build.id, stage: "plan-write", fetchImpl }),
        { scheduled: false, reason: "continuation_cap" },
      );
    } finally {
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    }
  });

  await test("Internal sources: countdown milestones, owner-confirmed events and creator link cards", async () => {
    const day = "2026-11-20";
    const afa = { name: "AFA Singapore", startsOn: "2026-11-27", endsOn: "2026-11-29", confidence: "official", tier: "sg", dateEvidence: {}, lastVerifiedAt: null };
    assert.ok(eventMilestones(afa, day, { hers: true }).some((m) => m.key === "t-7"));
    assert.ok(!eventMilestones(afa, day, { hers: false }).some((m) => m.key.startsWith("t-")));
    const sgcc = { ...afa, name: "SGCC", startsOn: "2026-11-24", endsOn: "2026-11-25" };
    assert.ok(eventMilestones(sgcc, day, { hers: false }).some((m) => m.key === "this-week"));
    const open = { ...afa, startsOn: "2026-11-18", endsOn: "2026-11-23" };
    assert.ok(eventMilestones(open, day, { hers: false }).some((m) => m.key.startsWith("open-")));
    assert.deepEqual(
      eventMilestones({ ...afa, confidence: "unconfirmed" }, day, { hers: true }).map((m) => m.label),
      ["dates to be confirmed"],
    );

    const descriptor = { id: "afa-sg", name: "AFA Singapore", tier: "sg", country: "Singapore", city: "Singapore", officialUrl: "https://animefestival.asia/afasg26/" };
    const id = await upsertEvent(db, descriptor, { name: "AFA Singapore", startsOn: "2026-11-27", endsOn: "2026-11-29" }, { confidence: "official", evidence: { verified: true, text: "27 - 29 November 2026" } });
    await db.execute(sql`UPDATE events SET confidence='owner_confirmed',starts_on='2026-11-28',ends_on='2026-11-29' WHERE id=${id}`);
    await upsertEvent(db, descriptor, { name: "AFA Singapore", startsOn: "2026-11-26", endsOn: "2026-11-29" }, { confidence: "official", evidence: { verified: true } });
    await upsertEvent(db, descriptor, { name: "AFA Singapore", startsOn: null }, { confidence: "unconfirmed", evidence: {} });
    const [kept] = rows(await db.execute(sql`SELECT starts_on::text AS starts_on, confidence FROM events WHERE id=${id}`));
    assert.deepEqual([kept.starts_on, kept.confidence], ["2026-11-28", "owner_confirmed"]);

    const page = await fetchFavesCreators({
      taste: { creators: ["https://www.instagram.com/some.cosplayer/"] },
      day,
      limits: { items: 8 },
      cursor: null,
    });
    assert.equal(page.done, true);
    const card = validateAdapterItem(page.items[0], defineSource(favesCreators));
    assert.equal(card.kind, "creator");
    assert.equal(card.credit.handle, "some.cosplayer");
    assert.equal(card.credit.platform, "Instagram");
  });

  await test("Verified events seed with their recorded evidence; owner edits and past editions are left alone", async () => {
    const { seedVerifiedEvents } = await import("../server/feeds/events.js");
    const events = await import("../server/feeds/events/sources.js");
    const ctx = { db, build: { day: "2026-09-15" } };
    const { seeded } = await seedVerifiedEvents(ctx, { events });
    assert.ok(seeded >= 3);
    const byId = Object.fromEntries(
      rows(await db.execute(sql`SELECT id, starts_on::text AS starts_on, confidence, hers FROM events`)).map((r) => [r.id, r]),
    );
    assert.deepEqual(
      [byId["apothecary-diaries-exhibition-sg:2026"]?.starts_on, byId["apothecary-diaries-exhibition-sg:2026"]?.hers],
      ["2026-09-30", true],
    );
    assert.equal(byId["singapore-comic-con:2026"]?.confidence, "official");
    await db.execute(sql`UPDATE events SET confidence='owner_confirmed',starts_on='2026-12-05' WHERE id='singapore-comic-con:2026'`);
    await seedVerifiedEvents(ctx, { events });
    const [sgcc] = rows(await db.execute(sql`SELECT starts_on::text AS starts_on FROM events WHERE id='singapore-comic-con:2026'`));
    assert.equal(sgcc.starts_on, "2026-12-05");
    const later = await seedVerifiedEvents({ db, build: { day: "2027-12-31" } }, { events });
    assert.equal(later.seeded, 0, "past editions are not re-seeded");

    // An undated mention of an edition that already has dates doesn't add a TBC twin (seen in the
    // first production run); a new edition number or year still becomes its own TBC row.
    const { duplicatesDatedEdition } = await import("../server/feeds/events.js");
    const afaRow = { name: "AFA Singapore", starts_on: "2026-11-27", ends_on: "2026-11-29" };
    assert.equal(duplicatesDatedEdition("AFA Singapore 2026", afaRow), true);
    assert.equal(duplicatesDatedEdition("AFA Singapore", afaRow), true);
    assert.equal(duplicatesDatedEdition("AFA Singapore 2027", afaRow), false);
    const c109 = { name: "Comic Market 109 (Comiket 109)", starts_on: "2026-12-29", ends_on: "2026-12-31" };
    assert.equal(duplicatesDatedEdition("Comic Market 110 (Comiket 110)", c109), false);
    const sgccDescriptor = { id: "singapore-comic-con", name: "Singapore Comic Con", tier: "sg", officialUrl: "https://www.singaporecomiccon.com/" };
    const twin = await upsertEvent(db, sgccDescriptor, { name: "Singapore Comic Con 2026", startsOn: null }, { confidence: "unconfirmed", evidence: {} });
    assert.equal(twin, "singapore-comic-con:2026");
    const [{ n }] = rows(await db.execute(sql`SELECT count(*)::int AS n FROM events WHERE id LIKE 'singapore-comic-con:%'`));
    assert.equal(n, 1);
  });

  await test("Diagnostics compare database targets without exposing connection details", () => {
    const secret = "correct-horse-battery";
    const targets = databaseTargets({
      DATABASE_URL: `postgres://owner:${secret}@ep-quiet-lilac-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`,
      kData_DATABASE_URL: `postgres://owner:${secret}@ep-quiet-lilac-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`,
    });
    assert.equal(targets.effective, "DATABASE_URL");
    assert.equal(targets.sameHostAndDatabase, false);
    assert.equal(targets.sameNeonEndpoint, true);
    const text = JSON.stringify(targets);
    for (const leak of [secret, "owner", "ep-quiet-lilac", "neon.tech", "neondb"])
      assert.ok(!text.includes(leak), "diagnostic output leaks a connection detail");
  });

  await test("Saves and faves routes: Kiriya keeps and removes, previews change nothing, faves use compare-and-set", async () => {
    const kiriya = await login("kiriya");
    const admin = await login("admin");
    const card = await approvedItem({
      source: "faves-creators",
      nativeId: "https://www.instagram.com/some.cosplayer/#2026-10",
      sections: ["dressup"],
      kind: "creator",
      title: "@some.cosplayer",
      url: "https://www.instagram.com/some.cosplayer/",
      credit: { name: "some.cosplayer", handle: "some.cosplayer", profileUrl: null, platform: "Instagram", license: "" },
    });
    const preview = await request("me/saves", { method: "POST", cookie: admin, body: { id: card.id } });
    assert.deepEqual(await preview.json(), { preview: true, saved: false });
    const kept = await request("me/saves", { method: "POST", cookie: kiriya, body: { id: card.id } });
    assert.equal(kept.status, 200);
    const keptBody = await kept.json();
    assert.equal(keptBody.copy, "link_only");
    const list = await (await request("me/saves", { cookie: kiriya })).json();
    const mine = list.saves.find((x) => x.itemId === card.id);
    assert.ok(mine);
    assert.equal(mine.copy, null);
    assert.ok(!("blobPath" in mine));
    assert.equal((await request(`me/saves/${mine.id}`, { method: "DELETE", cookie: admin })).status, 403);
    assert.equal((await request(`me/saves/${mine.id}`, { method: "DELETE", cookie: kiriya })).status, 200);

    const faves = await (await request("me/faves", { cookie: kiriya })).json();
    assert.equal(faves.applies, "next_build");
    const saved = await request("me/faves", {
      method: "PUT",
      cookie: kiriya,
      body: { overrides: { cosplayWishlist: ["fern"] }, expectedRevision: faves.revision },
    });
    assert.equal(saved.status, 200);
    const stale = await request("me/faves", {
      method: "PUT",
      cookie: kiriya,
      body: { overrides: { cosplayWishlist: ["frieren"] }, expectedRevision: faves.revision },
    });
    assert.equal(stale.status, 409);
    assert.equal(
      (await request("me/faves", { method: "PUT", cookie: admin, body: { overrides: {}, expectedRevision: (await saved.json()).revision } })).status,
      403,
    );

    const status = await (await request("admin/feeds/status", { cookie: admin })).json();
    assert.ok(Array.isArray(status.hidden));
    assert.ok(Array.isArray(status.events));
    const catchup = Date.now();
    const response = await request("me/feed/catchup", { method: "POST", cookie: kiriya, body: {} });
    assert.equal(response.status, 200);
    assert.ok(Date.now() - catchup < 5000, "catch-up must not wait for the stage");
    assert.ok(
      ["scheduled", "before_catchup_window", "rate_limited", "completed", "build_mode_mismatch"].includes(
        (await response.json()).outcome,
      ),
    );
  });
  await test("Discovery and music compatibility routes use published editions, exclude hidden items, and keep seed albums image-only", async () => {
    const oldFixture = process.env.FEEDS_FIXTURE_MODE;
    process.env.FEEDS_FIXTURE_MODE = "false";
    try {
      const cookie = await login("admin");
      assert.equal((await request("me/discoveries?kind=maomao")).status, 401);
      assert.equal((await request("me/discoveries?kind=__proto__", { cookie })).status, 404);
      const day = localDay(), build = await createBuild(db, day, { mode: "live", force: true });
      const note = await approvedItem(rawItem(901, { kind: "lore", media: [], title: "A fresh, published apothecary note" }));
      const song = await approvedItem(rawItem(902, { kind: "song", sections: ["music"], title: "A fresh published song", media: [{ type: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", poster: "https://img.example.test/song.jpg" }] }));
      for (const [section, item, type] of [["maomao", note, "note"], ["music", song, "song"]]) {
        await db.insert(s.feedEditions).values({
          buildId: build.id, section, day, revision: `${build.id}:${section}`, tasteRevision: build.tasteRevision,
          state: "staged", slots: [{ key: `${section}-audit`, type, primaryId: item.id, companionIds: [] }], reserve: [],
          meta: { fixture: false, blurbs: { [item.id]: { headline: item.title, text: "Words from the published item." } }, fingerprints: { [item.id]: item.safety.fingerprint }, scores: {}, plan: null },
        });
      }
      assert(!(await (await request("me/discoveries?kind=maomao", { cookie })).json()).items.some((item) => item.id === note.id), "staged notes must not leak");
      await db.update(s.feedEditions).set({ state: "published", publishedAt: new Date() }).where(eq(s.feedEditions.buildId, build.id));
      const notes = await (await request("me/discoveries?kind=maomao", { cookie })).json();
      assert.deepEqual(notes.items.map((item) => item.id), [note.id]);
      assert.equal(notes.items[0].body, "Words from the published item.");
      const songs = await (await request("me/music-picks", { cookie })).json();
      assert.deepEqual(songs.songs.map((item) => item.title), [song.title]);
      assert.equal(songs.songs[0].embedId, "abcdefghijk");
      await db.update(s.feedItems).set({ visibility: "hidden" }).where(eq(s.feedItems.id, note.id));
      assert.deepEqual((await (await request("me/discoveries?kind=maomao", { cookie })).json()).items, []);
      const album = await (await request("me/curation?kind=maomao", { cookie })).json();
      assert(album.slides.length > 0);
      assert(album.slides.every((slide) => slide.image?.url && !slide.body && !slide.song));
      const art = await (await request("me/discoveries?kind=art", { cookie })).json();
      assert(art.items.length > 0, "authored drawing prompts remain available");
    } finally { process.env.FEEDS_FIXTURE_MODE = oldFixture; }
  });

  await test("Public music has no fixed default and never substitutes an unshared song", async () => {
    assert.equal((await (await request("public/profile")).json()).song, null);
    const [song] = await db.insert(s.songs).values({ kind: "link", url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Explicit public choice", artist: "A saved artist", featured: true, isPublic: false }).returning();
    assert.equal((await (await request("public/profile")).json()).song, null);
    await db.update(s.songs).set({ isPublic: true }).where(eq(s.songs.id, song.id));
    assert.equal((await (await request("public/profile")).json()).song.title, song.title);
  });

} finally {
  globalThis.fetch = originalFetch;
  // Let a background catch-up stage settle before closing the in-memory database.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await client.close();
}
