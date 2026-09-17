import { z } from "zod";
import {
  BANNED_JOKES,
  POLITICS,
  RULE_VERSION,
  sourceVerdict,
  THRESHOLDS,
} from "./rules.js";
import { canonicalCharacters, mentions, CHARACTER_ALIASES, VOICEBANKS } from "./sources/tags.js";

export const VisionSchema = z
  .object({
    characters: z.array(z.string().max(80)).max(20),
    isCosplayPhoto: z.boolean(),
    isMeme: z.boolean(),
    meme: z
      .object({
        format: z.enum([
          "pov",
          "me_when",
          "text_post",
          "reaction",
          "comic",
          "other",
        ]),
        humor: z.enum([
          "relatable",
          "dark",
          "absurd",
          "wholesome",
          "brainrot",
          "unknown",
        ]),
        political: z.boolean(),
        topics: z.array(z.string().max(80)).max(15),
        text: z.string().max(1200),
        fandom: z.string().max(100),
      })
      .strict(),
    suggestive: z.enum(["none", "uncertain", "suggestive", "explicit"]),
    // Required age read. Suggestive content is allowed for adult subjects only, so this is the
    // one axis where uncertainty rejects instead of approving (see judge).
    apparentMinor: z.boolean(),
    gore: z.boolean(),
    horror: z.boolean(),
    political: z.boolean(),
    quality: z.number().int().min(1).max(5),
    aiLikelihood: z.enum(["low", "uncertain", "high"]),
    aiConfidence: z.number().min(0).max(1),
    note: z.string().max(300),
  })
  .strict();

// Kinds whose visuals ARE the slide. Their section needs the section's subject in the image.
const VISUAL_KINDS = new Set(["image", "clip", "meme", "cosplay"]);
// Runner conditions, not item problems: they stop the stage (to checkpoint or pause) instead of
// marking the item pending. `invocation_request_limit` was missing in the first production run.
const PASS_THROUGH = [
  "paused_for_budget",
  "request_limit",
  "invocation_request_limit",
  "request_in_progress",
  "deadline",
  "lease_lost",
  "request_uncertain",
  "unknown_model_price",
];
const PLAYBACK_MAX_AGE_MS = 7 * 86400000;

function visionCharacters(v) {
  const direct = canonicalCharacters(v.characters);
  return [...new Set([...direct, ...mentions(v.characters.join(" | "), CHARACTER_ALIASES)])];
}

/** Media-policy gate. Returns a pending/rejected reason, or null when inspection may proceed. */
export function mediaGate(item, source, now = Date.now()) {
  for (const media of item.media) {
    if (media.type === "image") continue;
    if (media.type === "youtube") {
      if (source?.mediaPolicy !== "embed_provenance") return ["pending", "moving_review_required"];
      const p = item.facts.playback;
      if (!p) return ["pending", "playback_unverified"];
      if (!p.embeddable || !p.regionOk) return ["rejected", "playback_unavailable"];
      if (p.ageRestricted) return ["rejected", "age_restricted"];
      // A channel verified as the creator's own (e.g. a cosplay tutorial maker) counts like an official
      // channel. Search-found uploads count only for sources that say so (owner decision 2026-09-17):
      // the uploader may be reposting someone else's work, and the checks below see the thumbnail only.
      const allowed = ["official_channel", "vocadb_original", "creator_upload"];
      if (source?.searchProvenance === true) allowed.push("search_result");
      if (!allowed.includes(p.provenance)) return ["pending", "provenance_unverified"];
      if (now - new Date(p.checkedAt).getTime() > PLAYBACK_MAX_AGE_MS)
        return ["pending", "playback_stale"];
      if (!media.poster) return ["pending", "poster_missing"];
      continue;
    }
    // gif, mp4, hls: only sources whose policy allows sampled inspection, with a sampler present.
    if (source?.mediaPolicy !== "moving_sampled") return ["pending", "moving_review_required"];
  }
  return null;
}

export async function checkItem(
  item,
  provider,
  { blocklist = { sources: [], creators: [] }, tuning = {}, source } = {},
) {
  const thresholds = tuning.thresholds ?? THRESHOLDS;
  const evidence = {
    rulesVersion: RULE_VERSION,
    thresholds,
    checkedAt: new Date().toISOString(),
    scope: item.media.length ? "still-images" : "text",
  };
  const verdict = (status, reason) => ({ status, reason, evidence });
  const sourceReason = sourceVerdict(item, blocklist, tuning);
  if (sourceReason) return verdict("rejected", sourceReason);
  const gate = mediaGate(item, source);
  if (gate) {
    if (gate[1] === "moving_review_required") evidence.scope = "unreviewed-moving-media";
    return verdict(gate[0], gate[1]);
  }
  const moderationOk = (moderation) => {
    if (
      !moderation ||
      typeof moderation.flagged !== "boolean" ||
      !moderation.category_scores ||
      !moderation.categories
    )
      return "incomplete";
    if (
      Object.keys(THRESHOLDS).some(
        (key) =>
          typeof moderation.categories[key] !== "boolean" ||
          typeof moderation.category_scores[key] !== "number" ||
          !Number.isFinite(moderation.category_scores[key]) ||
          moderation.category_scores[key] < 0 ||
          moderation.category_scores[key] > 1,
      )
    )
      return "incomplete";
    // Owner decision (2026-09-16): reject what OpenAI's moderation flags. Of the stricter score
    // thresholds only the minors check stays; other scores are recorded as evidence, not used to reject.
    if (
      moderation.flagged ||
      Object.values(moderation.categories).some((value) => value === true) ||
      moderation.category_scores["sexual/minors"] > thresholds["sexual/minors"]
    )
      return "flagged";
    return "ok";
  };
  try {
    // Legacy providers (tests) have no `views`: every image media entry is one still view.
    const views = provider.views
      ? await provider.views(item)
      : item.media
          .map((m, mediaIndex) => ({ kind: "still", mediaIndex, type: m.type }))
          .filter((v) => v.type === "image");
    evidence.views = views.map(({ url, ...v }) => v);
    if (views.some((v) => v.kind === "frames")) evidence.scope = "sampled-frames";
    else if (views.some((v) => v.kind === "poster")) evidence.scope = "embed-provenance+thumbnail";
    if (item.media.length && views.length === 0) return verdict("pending", "no_inspectable_view");

    // Text is always moderated (alone when there are no views, otherwise with each image).
    const checks = views.length ? views.map((_, i) => i) : [null];
    evidence.moderation = [];
    for (const index of checks) {
      const moderation = await provider.moderate(item, index);
      const outcome = moderationOk(moderation);
      if (outcome === "incomplete") return verdict("pending", "incomplete_moderation");
      evidence.moderation.push({ view: index, flagged: moderation.flagged, scores: moderation.category_scores });
      if (outcome === "flagged") return verdict("rejected", "moderation");
    }

    // Owner decision (2026-09-16): uncertainty alone never withholds. Only a definite finding rejects
    // (suggestive/explicit, gore, horror, political, confident AI art, low quality); an uncertain call
    // is approved and flagged in the evidence for admin review.
    const isUncertain = (v) =>
      v.suggestive === "uncertain" || v.aiLikelihood === "uncertain" || v.aiConfidence < 0.75;
    // Owner decision (2026-09-16, second pass): the bar for sexiness is lowered to "not explicit" so
    // the dress-up/cosplay shelves actually fill. Suggestive and mildly sexy art stays.
    const sexualised = (v) => v.suggestive !== "none";
    const judge = (v) => {
      // Non-negotiable: anything sexualised must read as an adult. Unlike every other axis, an
      // uncertain age read rejects rather than approves.
      if (sexualised(v) && v.apparentMinor) return ["rejected", "apparent_minor"];
      if (
        v.suggestive === "explicit" ||
        v.gore ||
        v.horror ||
        v.political ||
        (v.aiLikelihood === "high" && v.aiConfidence >= 0.75) ||
        // Memes are exempt: a grainy screenshot is still the joke.
        (item.kind !== "meme" && v.quality < 2)
      )
        return ["rejected", "vision"];
      return null;
    };
    // Owner decision (2026-09-16, third pass): a meme is approved unless it is outright explicit,
    // so the stream stays alive. Explicitness, gore and the apparent-minor gate are judged above
    // and still apply. What remains here are the two standing exclusions that were never about
    // taste: politics, and jokes about self-harm or someone's body.
    // Deliberately dropped: `!v.isMeme` (the classifier calls plenty of real memes "not a meme",
    // which was rejecting whole posts from her own communities) and the humour-style filter
    // (brainrot/unknown), which threw away anything the model could not label neatly.
    const memeRules = (v) =>
      v.meme.political ||
      POLITICS.test(v.meme.text) ||
      BANNED_JOKES.test(`${v.meme.text} ${v.meme.topics.join(" ")}`);

    const results = [];
    if (views.length) {
      evidence.vision = [];
      for (let i = 0; i < views.length; i++) {
        const parsed = VisionSchema.safeParse(await provider.vision(item, i));
        if (!parsed.success) return verdict("pending", "incomplete_vision");
        const v = parsed.data;
        evidence.vision.push(v);
        const bad = judge(v);
        if (bad) return verdict(...bad);
        results.push(v);
      }
    } else if (item.kind === "meme") {
      // Owner decision (2026-09-16, second pass): a meme has to be something you can look at.
      // Text-only posts are dropped here, before spending a classification request on them.
      return verdict("rejected", "meme_needs_media");
    }
    if (results.some(isUncertain)) evidence.uncertain = true;

    if (item.kind === "meme" && results.some(memeRules)) return verdict("rejected", "meme_rules");
    if (["cosplay", "dare"].includes(item.kind) && views.length && !results.some((v) => v.isCosplayPhoto))
      return verdict("rejected", "cosplay_required");

    // Section eligibility: a visual slide must show its section's subject. Non-visual kinds
    // (news, lore, merch, songs…) stay eligible as text even when their thumbnail doesn't.
    const seen = new Set(results.flatMap(visionCharacters));
    const eligible = item.sections.filter((section) => {
      if (!views.length || !VISUAL_KINDS.has(item.kind)) return true;
      if (section === "maomao") return seen.has("maomao");
      if (section === "music") return VOICEBANKS.some((c) => seen.has(c));
      return true;
    });
    evidence.eligibleSections = eligible;
    evidence.characters = [...seen];
    if (!eligible.length) return verdict("rejected", "required_character_missing");
    return verdict("approved", null);
  } catch (error) {
    if (PASS_THROUGH.includes(error.code)) throw error;
    return verdict(
      "pending",
      error.code === "provider_not_configured"
        ? "provider_not_configured"
        : error.code === "motion_sampler_unavailable"
          ? "motion_sampler_unavailable"
          : "safety_unavailable",
    );
  }
}
