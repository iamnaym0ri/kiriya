import { createHash } from "node:crypto";
import { z } from "zod";
import { SECTIONS } from "./config.js";
import { stableJson } from "./taste.js";

const short = z.string().trim().min(1).max(200);
const list = z.array(z.string().trim().min(1).max(100)).max(40).default([]);
const httpsUrl = z
  .string()
  .max(1600)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443")
    );
  });
export const TagsSchema = z
  .object({
    characters: list,
    fandoms: list,
    voicebanks: list,
    producers: list,
    units: list,
    formats: list,
    topics: list,
  })
  .strict();
export const MediaSchema = z
  .object({
    type: z.enum(["image", "gif", "mp4", "hls", "youtube"]),
    url: httpsUrl,
    width: z.number().int().min(1).max(30000).nullable().default(null),
    height: z.number().int().min(1).max(30000).nullable().default(null),
    poster: httpsUrl.nullable().default(null),
    alt: z.string().max(500).default(""),
    duration: z.number().min(0).max(36000).nullable().default(null),
    bytes: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
    identity: short.optional(),
  })
  .strict();
const instant = z.string().datetime({ offset: true }).nullable().default(null);
export const LINK_KINDS = [
  "official",
  "retailer",
  "sg_search",
  "taobao_search",
  "source",
  "listen",
  "watch",
  "tickets",
];
export const FactsSchema = z
  .object({
    excerpts: z.array(z.string().max(600)).max(3).default([]),
    names: list,
    dates: list,
    prices: list,
    sourceScore: z.number().min(0).max(1000000000).default(0),
    releaseAt: instant,
    sgd: z.number().min(0).nullable().default(null),
    eventAt: instant,
    preorderUntil: instant,
    // Outgoing links are validated against the adapter's link host allowlist.
    links: z
      .array(
        z
          .object({
            kind: z.enum(LINK_KINDS),
            label: z.string().trim().min(1).max(80),
            url: httpsUrl,
          })
          .strict(),
      )
      .max(8)
      .default([]),
    // A dated source price; the SGD figure is always an approximation derived from `fx`.
    priceOriginal: z
      .object({
        amount: z.number().min(0).max(100_000_000),
        currency: z.enum(["JPY", "USD", "SGD", "EUR", "GBP", "TWD", "HKD", "MYR", "KRW", "CNY"]),
        asOf: z.string().datetime({ offset: true }),
      })
      .strict()
      .nullable()
      .default(null),
    fx: z
      .object({
        rate: z.number().positive(),
        asOf: z.string().max(40),
        source: z.string().max(80),
      })
      .strict()
      .nullable()
      .default(null),
    availability: z
      .enum(["announced", "preorder", "in_stock", "sold_out", "released", "unknown"])
      .nullable()
      .default(null),
    availabilityCheckedAt: instant,
    releasePrecision: z.enum(["datetime", "day", "month", "season", "year"]).nullable().default(null),
    episode: z.number().int().min(0).max(10000).nullable().default(null),
    airingAt: instant,
    eventId: z.string().max(120).nullable().default(null),
    eventEndAt: instant,
    datePrecision: z.enum(["datetime", "day", "month", "year"]).nullable().default(null),
    venue: z.string().max(200).default(""),
    city: z.string().max(100).default(""),
    // Recorded platform playback checks; never inferred from a reachable URL.
    playback: z
      .object({
        embeddable: z.boolean(),
        regionOk: z.boolean(),
        ageRestricted: z.boolean(),
        checkedAt: z.string().datetime({ offset: true }),
        provenance: z.enum(["official_channel", "vocadb_original", "creator_upload", "unknown"]),
      })
      .strict()
      .nullable()
      .default(null),
    lang: z.string().max(10).default(""),
  })
  .strict();
export const FeedItemSchema = z
  .object({
    source: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
    nativeId: z.string().min(1).max(1000),
    sections: z.array(z.enum(SECTIONS)).min(1).max(5),
    kind: z.enum([
      "image",
      "clip",
      "song",
      "video",
      "news",
      "lore",
      "event",
      "cosplay",
      "tutorial",
      "dare",
      "merch",
      "meme",
      "look",
      "spot",
      "creator",
    ]),
    title: short,
    url: httpsUrl,
    media: z.array(MediaSchema).max(4).default([]),
    credit: z
      .object({
        name: short,
        handle: z.string().max(100).default(""),
        profileUrl: httpsUrl.nullable().default(null),
        platform: short,
        license: z.string().max(200).default(""),
      })
      .strict(),
    tags: TagsSchema.default({
      characters: [],
      fandoms: [],
      voicebanks: [],
      producers: [],
      units: [],
      formats: [],
      topics: [],
    }),
    facts: FactsSchema.default(() => FactsSchema.parse({})),
    safety: z
      .object({
        rating: z.string().max(30).default("unknown"),
        labels: list,
        sourceTags: list,
        nsfw: z.boolean().default(false),
        deleted: z.boolean().default(false),
        removed: z.boolean().default(false),
        communityNsfw: z.boolean().default(false),
      })
      .strict()
      .default({
        rating: "unknown",
        labels: [],
        sourceTags: [],
        nsfw: false,
        deleted: false,
        removed: false,
        communityNsfw: false,
      }),
    publishedAt: z.string().datetime({ offset: true }).nullable().default(null),
    expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
    mediaIdentity: z.string().min(1).max(300).optional(),
  })
  .strict();

export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = "";
  for (const name of [...url.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$)/i.test(name)) url.searchParams.delete(name);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.href;
}
export function normalizeItem(input) {
  const item = FeedItemSchema.parse(input);
  item.sections = [...new Set(item.sections)];
  item.tags = Object.fromEntries(
    Object.entries(item.tags).map(([k, v]) => [
      k,
      [...new Set(v.map((t) => t.toLowerCase()))],
    ]),
  );
  const keys = [
    `native:${item.source}:${item.nativeId}`,
    `url:${canonicalUrl(item.url)}`,
  ];
  // Independent aliases: a known image identity matches across different post URLs.
  if (item.mediaIdentity) keys.push(`media:${item.mediaIdentity}`);
  for (const media of item.media)
    keys.push(
      media.identity
        ? `media:${media.identity}`
        : `media-url:${canonicalUrl(media.url)}`,
    );
  return {
    ...item,
    id: `${item.source}:${digest(item.nativeId).slice(0, 32)}`,
    identityKeys: [...new Set(keys.map(digest))],
    fingerprint: digest(stableJson(stableProjection(item))),
  };
}

// Volatile source metadata changes on nearly every fetch (booru/post scores, FX-derived SGD prices,
// availability and playback check times, computed expiry). It is refreshed in place on re-fetch and is
// not a content change: it must not reset safety, re-run paid checks or drop published slots.
export const VOLATILE_FACTS = ["sourceScore", "sgd", "fx", "availabilityCheckedAt"];
export function stableProjection(item) {
  const facts = Object.fromEntries(
    Object.entries(item.facts ?? {}).filter(([key]) => !VOLATILE_FACTS.includes(key)),
  );
  if (facts.playback) facts.playback = { ...facts.playback, checkedAt: null };
  if (facts.priceOriginal) facts.priceOriginal = { ...facts.priceOriginal, asOf: null };
  // eslint-disable-next-line no-unused-vars
  const { expiresAt, ...rest } = item;
  return { ...rest, facts };
}

export const SLOT_TYPES = [
  "visual",
  "note",
  "meme",
  "merch",
  "song",
  "sekai",
  "three",
  "process",
  "dare",
  "event",
  "extra",
  "news",
  "cosplay",
  "look",
  "spot",
  "creator",
  "tutorial",
  "lore",
  "image",
  "clip",
  "video",
];
export const SlotSchema = z
  .object({
    key: z.string().max(100),
    type: z.enum(SLOT_TYPES).optional(),
    hook: z.string().max(40).optional(),
    primaryId: z.string().max(120),
    companionIds: z.array(z.string().max(120)).max(3).default([]),
  })
  .strict();
export const slotIds = (slot) => [slot.primaryId, ...slot.companionIds];
