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
      if (!["official_channel", "vocadb_original"].includes(p.provenance))
        return ["pending", "provenance_unverified"];
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
    if (
      moderation.flagged ||
      Object.values(moderation.categories).some((value) => value === true) ||
      Object.entries(thresholds).some(
        ([k, v]) => moderation.category_scores[k] > v,
      )
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

    const judge = (v) => {
      if (v.suggestive === "uncertain" || v.aiLikelihood === "uncertain" || v.aiConfidence < 0.75)
        return ["pending", "vision_uncertain"];
      if (
        v.suggestive !== "none" ||
        v.gore ||
        v.horror ||
        v.political ||
        (v.aiLikelihood === "high" && v.aiConfidence >= 0.75) ||
        v.quality < 3
      )
        return ["rejected", "vision"];
      return null;
    };
    const memeRules = (v) =>
      !v.isMeme ||
      v.meme.political ||
      ["brainrot", "unknown"].includes(v.meme.humor) ||
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
      // A text-post meme still needs humour/politics classification; without it, withhold.
      if (!provider.classifyText) return verdict("pending", "meme_classification_unavailable");
      const parsed = VisionSchema.safeParse(await provider.classifyText(item));
      if (!parsed.success) return verdict("pending", "incomplete_vision");
      const v = parsed.data;
      evidence.vision = [v];
      evidence.scope = "text-classification";
      if (v.suggestive === "uncertain") return verdict("pending", "vision_uncertain");
      if (v.suggestive !== "none" || v.gore || v.horror || v.political) return verdict("rejected", "vision");
      results.push(v);
    }

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
