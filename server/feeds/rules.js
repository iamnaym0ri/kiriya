export const RULE_VERSION = "2026-09-15.1";
export const THRESHOLDS = {
  sexual: 0.12,
  "sexual/minors": 0.01,
  "violence/graphic": 0.1,
  "self-harm": 0.1,
  hate: 0.1,
};
export const BAD_TAGS =
  /(?:^|[\s_-])(ai[\s_-]?(?:generated|assisted)|guro|blood|injury|corpse|nude|nudity|underwear|swimsuit|bikini|cleavage|ass|panties|nsfw|gore|horror)(?:$|[\s_-])/i;
export const BAD_TEXT =
  /\bai[\s_-]?(?:art|generated|assisted)\b|midjourney|stable[ -]?diffusion|nijijourney|#nsfw|18\+|r-?18\b|lewd|onlyfans|fansly|patreon exclusive|lawsuit|\bsue[sd]?\b|arrest|scandal|allegation|controvers|harass|abus|assault|\bdied\b|\bdeath\b|passed away|layoff|boycott|callout|\bdrama\b|\bleak(?:ed|s)?\b|plagiar|cancel(?:l)?ed over/i;
export const POLITICS =
  /\b(?:trump|biden|putin|netanyahu|democrats?|republicans?|election|politic\w*|war|shooting|assassinat\w*|protest\w*)\b/i;
export const BANNED_JOKES =
  /\b(?:kms|kys|suicid\w*|unalive|skibidi|gyatt|rizzler|fanum tax|sigma|ohio|mewing|diet|calories)\b|kill (?:my|ur|your)self|want to die|end it all|(?:ur|your) (?:mom|dad|parents|family|weight|body|face|skin)/i;
const BAD_LABELS = new Set([
  "porn",
  "sexual",
  "nudity",
  "graphic-media",
  "gore",
  "!hide",
  "!warn",
  "!no-unauthenticated",
]);

const GENERAL_RATING = { danbooru: "g", sakugabooru: "s" };

export function sourceVerdict(
  item,
  { sources = [], creators = [] } = {},
  tuning = {},
) {
  const safety = item.safety.source ?? item.safety;
  const rawText = [
    item.title,
    ...item.facts.excerpts,
    ...Object.values(item.tags).flat(),
    ...safety.sourceTags,
    ...safety.labels,
  ].join(" ");
  const creator =
    `${item.source}:${item.credit.handle || item.credit.name}`.toLowerCase();
  if (sources.includes(item.source) || creators.includes(creator))
    return "blocked_origin";
  if (safety.deleted || safety.removed) return "source_removed";
  if (
    safety.nsfw ||
    safety.communityNsfw ||
    safety.labels.some((l) => BAD_LABELS.has(l.toLowerCase()))
  )
    return "source_labels";
  // Source families share rules across purpose-specific entries (danbooru-maomao, danbooru-memes…).
  // Each booru's safest tier: Danbooru "g" (general); Moebooru/Sakugabooru "s" (safe).
  const family = item.source.split("-")[0];
  if (family in GENERAL_RATING && safety.rating !== GENERAL_RATING[family])
    return "source_rating";
  if (
    item.facts.sourceScore <
    (tuning.minimumScores?.[item.source] ?? tuning.minimumScores?.[family] ?? 0)
  )
    return "source_score";
  if (
    tuning.additionalBlockedTerms?.some((term) =>
      rawText.toLowerCase().includes(term.toLowerCase()),
    )
  )
    return "additional_blocked_term";
  if (BAD_TAGS.test(safety.sourceTags.join(" ")) || BAD_TEXT.test(rawText))
    return "source_content";
  if (POLITICS.test(rawText) || BANNED_JOKES.test(rawText)) return "off_limits";
  if (item.tags.fandoms.includes("minecraft") && item.kind !== "meme")
    return "minecraft_memes_only";
  // Released-only applies to game content (songs, events, cards); official merch preorders are fine.
  if (
    item.kind !== "merch" &&
    item.facts.releaseAt &&
    new Date(item.facts.releaseAt) > new Date() &&
    item.tags.fandoms.includes("project sekai")
  )
    return "unreleased_sekai";
  return null;
}
