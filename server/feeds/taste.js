import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { settings } from "../db/schema.js";
import { TASTE_DEFAULTS } from "../content/taste.js";
import { FeedError } from "./config.js";

const label = z.string().trim().min(1).max(80);
const list = z
  .array(label)
  .max(40)
  .transform((v) => [...new Set(v.map((s) => s.toLowerCase()))]);
const weights = z
  .record(label, z.number().min(0).max(1))
  .refine((v) => Object.keys(v).length <= 80);
export const TasteOverridesSchema = z
  .object({
    characters: weights.optional(),
    voicebanks: weights.optional(),
    fandoms: weights.optional(),
    units: weights.optional(),
    eras: list.optional(),
    producers: list.optional(),
    cosplayWishlist: list.optional(),
    events: list.optional(),
    fashion: list.optional(),
    memeFormats: list.optional(),
    offLimits: list.optional(),
    creators: z
      .array(
        z
          .string()
          .url()
          .max(400)
          .refine((v) =>
            /^https:\/\/(www\.)?(instagram\.com|tiktok\.com|bsky\.app)\//.test(
              v,
            ),
          ),
      )
      .max(30)
      .optional(),
    merch: z
      .object({
        minSgd: z.number().min(0).max(10000),
        maxSgd: z.number().min(0).max(10000),
        types: list,
      })
      .strict()
      .refine((v) => v.minSgd <= v.maxSgd)
      .optional(),
  })
  .strict();

export const ResolvedTasteSchema = z
  .object({
    characters: weights,
    companions: list,
    companionBonus: z.number().min(0).max(1),
    voicebanks: weights,
    sekai: z
      .object({
        server: z.literal("global"),
        virtualSingers: z.number().min(0).max(1),
        units: weights,
        otherUnits: z.number().min(0).max(1),
        releasedOnly: z.literal(true),
      })
      .strict(),
    fandoms: weights,
    eras: list,
    eraWeight: z.number().min(0).max(1),
    newSongWeight: z.number().min(0).max(1),
    producers: list,
    producerWindowDays: z.literal(7),
    maomaoMoments: list,
    momentBonus: z.number().min(0).max(1),
    cosplayWishlist: list,
    wishlistBonus: z.number().min(0).max(1),
    pastCosplays: list,
    skills: list,
    rotatingFandoms: list,
    events: list,
    fashion: list,
    merch: z
      .object({
        minSgd: z.number().min(0),
        maxSgd: z.number().min(0),
        budgetBonus: z.number().min(0).max(1),
        typeBonus: z.number().min(0).max(1),
        types: list,
        shops: list,
        shipsTo: z.literal("SG"),
      })
      .strict(),
    memeFormats: list,
    memeFormatBonus: z.number().min(0).max(1),
    humor: list,
    minecraftMemesOnly: z.literal(true),
    offLimits: z.array(label).max(80),
    spoilers: z.literal("none"),
    shipsAllowed: z.literal(true),
    insideJokes: z.array(label).max(0),
    creators: z.array(z.string().url()).max(30).optional(),
  })
  .strict();
ResolvedTasteSchema.parse(TASTE_DEFAULTS);

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const tasteRevision = (value) =>
  createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 24);

export function resolveTaste(overrides = {}) {
  const checked = TasteOverridesSchema.safeParse(overrides);
  const o = checked.success ? checked.data : {};
  const value = structuredClone(TASTE_DEFAULTS);
  for (const key of ["characters", "voicebanks", "fandoms"])
    if (o[key])
      value[key] = {
        ...value[key],
        ...Object.fromEntries(
          Object.entries(o[key]).map(([k, v]) => [k.toLowerCase(), v]),
        ),
      };
  for (const key of [
    "eras",
    "producers",
    "cosplayWishlist",
    "events",
    "fashion",
    "memeFormats",
    "creators",
  ])
    if (o[key]) value[key] = o[key];
  if (o.units)
    value.sekai.units = {
      ...value.sekai.units,
      ...Object.fromEntries(
        Object.entries(o.units).map(([k, v]) => [k.toLowerCase(), v]),
      ),
    };
  if (o.merch) value.merch = { ...value.merch, ...o.merch };
  value.offLimits = [
    ...new Set([...TASTE_DEFAULTS.offLimits, ...(o.offLimits ?? [])]),
  ];
  const merged = ResolvedTasteSchema.safeParse(value);
  if (!merged.success) return { ...resolveTaste(), invalidOverrides: true };
  const validated = merged.data;
  return {
    taste: validated,
    revision: tasteRevision(validated),
    overrides: o,
    invalidOverrides: !checked.success,
  };
}
export async function getTaste(db) {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "taste_overrides"));
  return resolveTaste(row?.value?.overrides ?? row?.value ?? {});
}
export async function putTaste(db, overrides, expectedRevision) {
  const next = resolveTaste(TasteOverridesSchema.parse(overrides));
  const current = await getTaste(db);
  if (expectedRevision !== current.revision)
    throw new FeedError("taste_changed", 409);
  const record = { overrides: next.overrides, revision: next.revision };
  const result = await db.execute(sql`
    INSERT INTO settings (key,value) VALUES ('taste_overrides',${JSON.stringify(record)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()
    WHERE coalesce(settings.value->>'revision',${current.revision}) = ${expectedRevision}
    RETURNING key`);
  if (!(result.rows ?? result).length)
    throw new FeedError("taste_changed", 409);
  return next;
}

// Deliberately constructed; never spread a profile, settings row, mood, letter, or request into a prompt.
export function writerTaste(taste) {
  const enabled = (weights) =>
    Object.keys(weights).filter((key) => weights[key] > 0);
  return {
    characters: enabled(taste.characters),
    fandoms: enabled(taste.fandoms),
    voicebanks: enabled(taste.voicebanks),
    pastCosplays: taste.pastCosplays,
    cosplayWishlist: taste.cosplayWishlist,
    eras: taste.eras,
    offLimits: taste.offLimits,
  };
}
