import { seededRandom } from "../engine/pick.js";
import { localDay, zonedInstant } from "../lib/time.js";
const maxMatch = (tags, weights) =>
  Math.max(0, ...tags.map((t) => weights[t] ?? 0));
const lowerTags = (list) => (list ?? []).map((t) => String(t).toLowerCase());

export function scoreItem(
  item,
  taste,
  {
    day,
    section,
    now = zonedInstant(day, 7),
    kinds = [],
    recentCreators = [],
    episodeDay = false,
    countdown = false,
    dislikes = { tags: {}, creators: {} },
  } = {},
) {
  const tags = item.tags;
  let affinity = Math.max(
    maxMatch(tags.characters, taste.characters),
    maxMatch(tags.voicebanks, taste.voicebanks),
    maxMatch(tags.fandoms, taste.fandoms),
    maxMatch(tags.units, taste.sekai.units),
  );
  if (tags.units.length) affinity = Math.max(affinity, taste.sekai.otherUnits);
  if (tags.fandoms.includes("project sekai") && tags.voicebanks.length)
    affinity = Math.max(affinity, taste.sekai.virtualSingers);
  if (tags.characters.includes("maomao"))
    affinity +=
      taste.companions.filter((c) => tags.characters.includes(c)).length *
      taste.companionBonus;
  const all = [
    item.title,
    ...item.facts.excerpts,
    ...Object.values(tags).flat(),
  ]
    .join(" ")
    .toLowerCase();
  if (taste.maomaoMoments.some((t) => all.includes(t)))
    affinity += taste.momentBonus;
  if (tags.topics.some((t) => taste.eras.includes(t)))
    affinity = Math.max(affinity, taste.eraWeight);
  const half =
    { news: 2, event: 2, merch: 2, image: 5, meme: 5, song: 10, tutorial: 30 }[
      item.kind
    ] ?? 5;
  const age = item.publishedAt
    ? Math.max(0, (now - new Date(item.publishedAt)) / 86400000)
    : half;
  const freshness = 2 ** (-age / half);
  if (
    item.kind === "song" &&
    item.publishedAt &&
    age <= 7 &&
    maxMatch(tags.voicebanks, taste.voicebanks) > 0
  )
    affinity = Math.max(affinity, taste.newSongWeight);
  const quality = item.safety.vision?.length
    ? Math.min(...item.safety.vision.map((v) => v.quality)) / 5
    : Math.min(1, Math.log1p(item.facts.sourceScore) / Math.log(1001));
  let boosts = 0;
  if (episodeDay && section === "maomao") boosts += 0.5;
  if (countdown) boosts += 0.4;
  if (taste.cosplayWishlist.some((w) => all.includes(w)))
    boosts += taste.wishlistBonus;
  if (
    item.kind === "merch" &&
    typeof item.facts.sgd === "number" &&
    item.facts.sgd >= taste.merch.minSgd &&
    item.facts.sgd <= taste.merch.maxSgd
  )
    boosts += taste.merch.budgetBonus;
  if (item.facts.preorderUntil) {
    const left = new Date(item.facts.preorderUntil) - now;
    if (left >= 0 && left <= 7 * 86400000) boosts += 0.3;
  }
  if (
    tags.fandoms.includes("project sekai") &&
    item.facts.eventAt &&
    localDay(new Date(item.facts.eventAt)) === day
  )
    boosts += 0.3;
  if (tags.fandoms.includes("project sekai") && tags.voicebanks.length)
    boosts += 0.2;
  if (
    item.kind === "merch" &&
    tags.topics.some((t) => taste.merch.types.includes(t))
  )
    boosts += taste.merch.typeBonus;
  if (
    item.kind === "meme" &&
    tags.formats.some((t) => taste.memeFormats.includes(t))
  )
    boosts += taste.memeFormatBonus;
  const creator =
    `${item.source}:${item.credit.handle || item.credit.name}`.toLowerCase();
  // "Not for me" feeds back here. Each repeatedly-hidden tag the item carries costs a little, and a
  // hidden creator costs more; both are capped so a run of hides damps a subject rather than
  // erasing it, and an explicit favourite can still outscore the penalty.
  const hiddenTags = ["characters", "fandoms", "topics", "formats"].reduce(
    (n, key) =>
      n + lowerTags(tags[key]).filter((t) => dislikes.tags?.[`${key}:${t}`]).length,
    0,
  );
  const disliked =
    Math.min(0.6, 0.2 * hiddenTags) +
    Math.min(0.5, 0.25 * (dislikes.creators?.[creator] ?? 0));
  const penalties = (recentCreators.includes(creator) ? 0.3 : 0) + disliked;
  const parts = {
    taste: affinity,
    freshness,
    quality,
    variety: kinds.includes(item.kind) ? 0 : 1,
    boosts,
    penalties,
  };
  return {
    score:
      0.45 * affinity +
      0.2 * freshness +
      0.2 * quality +
      0.15 * parts.variety +
      boosts -
      penalties,
    parts,
    tie: seededRandom(day, section, item.id)(),
  };
}

// Shared primitives; the exact meal/episode/cosplay schedules belong to Claude's section planners.
export function assembleSection(
  items,
  taste,
  {
    day,
    section,
    slotCount = 3,
    reserveCount = 2,
    excludedIds = [],
    recentProducers = [],
  } = {},
) {
  const candidates = items.filter(
    (i) =>
      i.sections.includes(section) &&
      i.safetyStatus === "approved" &&
      i.visibility === "active" &&
      !excludedIds.includes(i.id),
  );
  const selected = [],
    producers = new Set(recentProducers.map((p) => p.toLowerCase()));
  while (selected.length < slotCount + reserveCount) {
    const eligible = candidates.filter(
      (i) =>
        !selected.some((s) => s.item.id === i.id) &&
        !i.tags.producers.some((p) => producers.has(p.toLowerCase())),
    );
    if (!eligible.length) break;
    const ranked = eligible
      .map((item) => ({
        item,
        ...scoreItem(item, taste, {
          day,
          section,
          kinds: selected.map((i) => i.item.kind),
        }),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.tie - b.tie ||
          a.item.id.localeCompare(b.item.id),
      );
    const pick = ranked[0];
    selected.push(pick);
    pick.item.tags.producers.forEach((p) => producers.add(p.toLowerCase()));
  }
  const slots = selected.map(({ item }, i) => ({
    key: `${section}-${i}`,
    primaryId: item.id,
    companionIds: [],
  }));
  return {
    slots: slots.slice(0, slotCount),
    reserve: slots.slice(slotCount),
    selected,
  };
}
