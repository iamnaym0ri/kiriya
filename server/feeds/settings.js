import { inArray } from "drizzle-orm";
import { z } from "zod";
import { settings } from "../db/schema.js";
import {
  BANNED_JOKES,
  BAD_TEXT,
  POLITICS,
  RULE_VERSION,
  THRESHOLDS,
} from "./rules.js";

const terms = z.array(z.string().trim().min(1).max(80)).max(30);
export const FeedTuningSchema = z
  .object({
    version: z.literal(RULE_VERSION),
    // Overrides may tighten thresholds, never turn off a core safety category.
    thresholds: z
      .object(
        Object.fromEntries(
          Object.entries(THRESHOLDS).map(([key, max]) => [
            key,
            z.number().min(0).max(max),
          ]),
        ),
      )
      .strict(),
    additionalBlockedTerms: terms,
    minimumScores: z
      .object({
        danbooru: z.number().min(8).max(1000),
        sakugabooru: z.number().min(0).max(1000),
      })
      .strict(),
  })
  .strict();
export const VoiceLexiconSchema = z
  .object({ formats: terms, fresh: terms })
  .strict()
  .refine((v) =>
    [...v.formats, ...v.fresh].every(
      (t) => !BANNED_JOKES.test(t) && !BAD_TEXT.test(t) && !POLITICS.test(t),
    ),
  );
export const FEED_TUNING_DEFAULTS = FeedTuningSchema.parse({
  version: RULE_VERSION,
  thresholds: THRESHOLDS,
  additionalBlockedTerms: [],
  minimumScores: { danbooru: 8, sakugabooru: 0 },
});
export const VOICE_LEXICON_DEFAULTS = VoiceLexiconSchema.parse({
  formats: ["pov:", "me when", "nobody: / kiriya:"],
  fresh: ["rent free", "just one more", "the side-eye"],
});

export async function getFeedSettings(db) {
  const values = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, ["feed_tuning", "voice_lexicon"]));
  const value = (key) => values.find((row) => row.key === key)?.value;
  const tuning = FeedTuningSchema.safeParse(
    value("feed_tuning") ?? FEED_TUNING_DEFAULTS,
  );
  const lexicon = VoiceLexiconSchema.safeParse(
    value("voice_lexicon") ?? VOICE_LEXICON_DEFAULTS,
  );
  return {
    tuning: tuning.success ? tuning.data : FEED_TUNING_DEFAULTS,
    lexicon: lexicon.success ? lexicon.data : VOICE_LEXICON_DEFAULTS,
    invalid: !tuning.success || !lexicon.success,
  };
}
