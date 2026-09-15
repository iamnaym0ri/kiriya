// Section planners. Each returns {slots, reserve, selected, meta, hints} for stageEdition/writer.
// Allocation (recorded once; PIPELINE.md §8.2–8.5, using the primary/companion slot contract):
//
// maomao   12 slots: 8 visual (image|clip|cosplay≤2|video≤1, ≥2 clips when available) each with ≤1
//          companion note (lore|news|event); 2 meme; 1 merch; 1 note (episode/exhibition/news).
//          Episode-day: airing today → episode note leads slot 0; day after → episode-related
//          visuals/notes lead. Reserve 20 in the same proportions.
// music    13 slots: 5 song (2 new originals, 1 classic, 1 rin & len story, 1 modern/SEKAI), 2 sekai
//          (released Global news/events), 2 note (news/lore), 2 visual (art/GIF), 1 meme, 1 merch.
//          7-day producer exclusion is hard; no producer twice in an edition; a non-Miku voicebank at
//          least every other day. Reserve 20.
// dressup  12 slots (+ her photo in meta = 13): daily three (miku, maomao, rotating fandom),
//          2 process (transformation/tutorial + wig/makeup/wip), 1 dare (wishlist-type cosplay),
//          2 event (countdowns/new dates/this weekend), 1 extra (look → spot → wig find → scene by day),
//          1 meme, 1 merch, 1 news. Reserve 20.
// meme     1 featured + 5 reserve: general/relatable/anime memes only (fandom memes stay in sections).
// merch    shelf: up to 40 live items (seen items stay listed), preorder deadline → fandom → budget.
// Empty categories reallocate their slot to the best remaining eligible item; nothing is invented.
import { scoreItem } from "./score.js";
import { ERAS, VOICEBANKS } from "./sources/tags.js";
import { addDays, localDay, zonedInstant } from "../lib/time.js";

export const QUOTAS = {
  maomao: { visual: 8, meme: 2, merch: 1, note: 1, reserve: 20 },
  music: { song: 5, sekai: 2, note: 2, visual: 2, meme: 1, merch: 1, reserve: 20 },
  dressup: { three: 3, process: 2, dare: 1, event: 2, extra: 1, meme: 1, merch: 1, news: 1, reserve: 20 },
  meme: { featured: 1, reserve: 5 },
  merch: { shelf: 40 },
};
const COUNTDOWN_DAYS = [30, 14, 7, 1, 0];

export const inSection = (item, section) =>
  item.sections.includes(section) &&
  (!Array.isArray(item.safety?.eligibleSections) || item.safety.eligibleSections.includes(section));
const lower = (list) => (list ?? []).map((v) => String(v).toLowerCase());
const hasAny = (list, wanted) => lower(list).some((v) => wanted.includes(v));
const textOf = (item) =>
  [item.title, ...(item.facts?.excerpts ?? []), ...Object.values(item.tags ?? {}).flat()]
    .join(" ")
    .toLowerCase();
const creatorOf = (item) => `${item.source}:${item.credit?.handle || item.credit?.name}`.toLowerCase();
const sgDay = (value) => (value ? localDay(new Date(value)) : null);

function ranker(taste, ctx, section) {
  const cache = new Map();
  return (item, kinds = []) => {
    const key = `${item.id}|${kinds.join(",")}`;
    if (!cache.has(key))
      cache.set(
        key,
        scoreItem(item, taste, {
          day: ctx.day,
          section,
          kinds,
          recentCreators: ctx.recentCreators ?? [],
          episodeDay: Boolean(ctx.episodeRelated?.has(item.id)),
          countdown: Boolean(ctx.countdownIds?.has(item.id)),
        }),
      );
    return cache.get(key);
  };
}

// At most two pieces by the same artist/cosplayer/poster per edition. Outlets, wikis, shops and
// producers are governed by their own rules (producer exclusion for songs) instead.
const CREATOR_KINDS = new Set(["image", "clip", "cosplay", "meme", "look"]);

/** Greedy picker with hard exclusions and per-edition creator/producer diversity. */
function picker(taste, ctx, section) {
  const rank = ranker(taste, ctx, section);
  const used = new Set();
  const producers = new Set(lower(ctx.recentProducers));
  const creators = new Map();
  const selected = [];
  const pick = (candidates, predicate = () => true, { enforceProducers = false } = {}) => {
    const kinds = selected.map((s) => s.item.kind);
    const eligible = candidates.filter(
      (i) =>
        !used.has(i.id) &&
        predicate(i) &&
        (!enforceProducers || !lower(i.tags.producers).some((p) => producers.has(p))) &&
        (!CREATOR_KINDS.has(i.kind) || (creators.get(creatorOf(i)) ?? 0) < 2),
    );
    if (!eligible.length) return null;
    const best = eligible
      .map((item) => ({ item, ...rank(item, kinds) }))
      .sort((a, b) => b.score - a.score || a.tie - b.tie || a.item.id.localeCompare(b.item.id))[0];
    used.add(best.item.id);
    if (enforceProducers || section === "music")
      lower(best.item.tags.producers).forEach((p) => producers.add(p));
    creators.set(creatorOf(best.item), (creators.get(creatorOf(best.item)) ?? 0) + 1);
    selected.push(best);
    return best.item;
  };
  return { pick, used, selected, rank };
}

const slot = (section, n, type, primary, companions = [], hook = null) => ({
  key: `${section}-${n}`,
  type,
  primaryId: primary.id,
  companionIds: companions.map((c) => c.id),
  ...(hook ? { hook } : {}),
});

function overlap(a, b) {
  const set = (i) => new Set([...lower(i.tags.characters), ...lower(i.tags.topics), ...lower(i.tags.fandoms)]);
  const x = set(a);
  return [...set(b)].filter((v) => x.has(v)).length;
}

function finish(section, ordered, reserveEntries, selected, meta, hints) {
  let n = 0;
  const build = (entries) => entries.map((e) => slot(section, n++, e.type, e.primary, e.companions, e.hook));
  const slots = build(ordered);
  const reserve = build(reserveEntries);
  const ids = new Set([...slots, ...reserve].flatMap((s) => [s.primaryId, ...s.companionIds]));
  return { slots, reserve, selected: selected.filter((s) => ids.has(s.item.id)), meta, hints };
}

/** Episode state from AniList airing items (fresh data from the latest fetch). */
export function episodeState(items, day) {
  const episodes = items
    .filter((i) => i.facts?.airingAt && Number.isInteger(i.facts?.episode))
    .map((i) => ({ item: i, day: sgDay(i.facts.airingAt) }));
  const today = episodes.find((e) => e.day === day);
  if (today) return { mode: "airing_today", episode: today.item.facts.episode, airingAt: today.item.facts.airingAt, itemId: today.item.id };
  const yesterday = episodes.find((e) => e.day === addDays(day, -1));
  if (yesterday)
    return { mode: "day_after", episode: yesterday.item.facts.episode, airingAt: yesterday.item.facts.airingAt, itemId: yesterday.item.id };
  return null;
}

function episodeRelatedIds(items, state) {
  if (!state) return new Set();
  const since = new Date(state.airingAt);
  const n = String(state.episode);
  return new Set(
    items
      .filter((i) => {
        const t = textOf(i);
        const mentionsEpisode =
          new RegExp(`(?:\\bep(?:isode)?\\.?\\s*${n}\\b|第${n}話)`, "iu").test(t) || t.includes("season 3");
        const published = i.publishedAt ? new Date(i.publishedAt) >= since : false;
        return i.id === state.itemId || (mentionsEpisode && (state.mode === "airing_today" || published));
      })
      .map((i) => i.id),
  );
}

export function planMaomao(items, ctx) {
  const taste = ctx.taste, section = "maomao", q = QUOTAS.maomao;
  const pool = items.filter((i) => inSection(i, section));
  const episode = episodeState(pool, ctx.day);
  const related = episodeRelatedIds(pool, episode);
  const exhibition = pool.filter(
    (i) => i.kind === "event" && i.facts?.eventAt && sgDay(i.facts.eventAt) <= ctx.day && (!i.facts.eventEndAt || sgDay(i.facts.eventEndAt) >= ctx.day),
  );
  const local = { ...ctx, episodeRelated: related, countdownIds: new Set(exhibition.map((i) => i.id)) };
  const { pick, selected } = picker(taste, local, section);
  const visuals = pool.filter((i) => ["image", "clip", "cosplay", "video"].includes(i.kind));
  const notes = pool.filter((i) => ["lore", "news", "event"].includes(i.kind));
  const counts = { cosplay: 0, video: 0 };
  const visualOk = (i) => (i.kind === "cosplay" ? counts.cosplay < 2 : i.kind === "video" ? counts.video < 1 : true);
  const takeVisual = (prefer) => {
    const item = pick(visuals, (i) => visualOk(i) && (!prefer || prefer(i)));
    if (item && counts[item.kind] !== undefined) counts[item.kind]++;
    return item;
  };
  const companionFor = (visual) => {
    const candidates = notes.filter((n) => !selected.some((s) => s.item.id === n.id));
    if (!candidates.length) return [];
    const best = candidates
      .map((n) => ({ n, o: overlap(visual, n) + (related.has(n.id) ? 2 : 0) }))
      .sort((a, b) => b.o - a.o)[0];
    const chosen = pick(candidates, (i) => i.id === best.n.id);
    return chosen ? [chosen] : [];
  };
  const ordered = [];
  const hints = {};
  // Episode or exhibition note leads when present.
  let lead = null;
  if (episode?.mode === "airing_today") lead = pick(notes, (i) => i.id === episode.itemId);
  if (!lead && exhibition.length) lead = pick(exhibition);
  if (lead) {
    hints[lead.id] = { hook: episode?.mode === "airing_today" && lead.id === episode.itemId ? "episode_tonight" : "exhibition_open" };
    ordered.push({ type: "note", primary: lead, companions: [] });
  }
  // Day after airing: episode-related visuals first.
  const visualEntries = [];
  if (episode?.mode === "day_after")
    for (let k = 0; k < 3; k++) {
      const v = takeVisual((i) => related.has(i.id));
      if (!v) break;
      hints[v.id] = { hook: "episode_reactions", derived: { episode: String(episode.episode) } };
      visualEntries.push({ type: "visual", primary: v, companions: companionFor(v) });
    }
  const clipCount = () => visualEntries.filter((e) => e.primary.kind === "clip").length;
  while (visualEntries.length < q.visual) {
    const v = clipCount() < 2 ? takeVisual((i) => i.kind === "clip") ?? takeVisual() : takeVisual();
    if (!v) break;
    visualEntries.push({ type: "visual", primary: v, companions: companionFor(v) });
  }
  const memes = [];
  for (let k = 0; k < q.meme; k++) {
    const m = pick(pool, (i) => i.kind === "meme");
    if (m) memes.push({ type: "meme", primary: m, companions: [] });
  }
  const merch = pick(pool, (i) => i.kind === "merch" && i.media?.length > 0);
  const note = lead ? null : pick(notes);
  // Interleave: visuals with a meme after the 2nd and 6th, merch after the 5th, a note at 4th.
  const sequence = [];
  visualEntries.forEach((entry, i) => {
    sequence.push(entry);
    if (i === 1 && memes[0]) sequence.push(memes[0]);
    if (i === 2 && note) sequence.push({ type: "note", primary: note, companions: [] });
    if (i === 4 && merch) sequence.push({ type: "merch", primary: merch, companions: [] });
    if (i === 5 && memes[1]) sequence.push(memes[1]);
  });
  if (visualEntries.length <= 1 && memes[0]) sequence.push(memes[0]);
  if (visualEntries.length <= 2 && note) sequence.push({ type: "note", primary: note, companions: [] });
  if (visualEntries.length <= 4 && merch) sequence.push({ type: "merch", primary: merch, companions: [] });
  if (visualEntries.length <= 5 && memes[1]) sequence.push(memes[1]);
  ordered.push(...sequence);
  // Reallocate empty categories to the best remaining visual/note items up to 12.
  while (ordered.length < 12) {
    const extra = takeVisual() ?? pick(notes);
    if (!extra) break;
    ordered.push({ type: ["lore", "news", "event"].includes(extra.kind) ? "note" : "visual", primary: extra, companions: ["lore", "news", "event"].includes(extra.kind) ? [] : companionFor(extra) });
  }
  const reserve = [];
  while (reserve.length < q.reserve) {
    const position = reserve.length % 10;
    const item =
      position === 3 || position === 8
        ? pick(pool, (i) => i.kind === "meme") ?? takeVisual()
        : position === 6
          ? pick(pool, (i) => i.kind === "merch" && i.media?.length > 0) ?? takeVisual()
          : takeVisual() ?? pick(notes);
    if (!item) break;
    const type = item.kind === "meme" ? "meme" : item.kind === "merch" ? "merch" : ["lore", "news", "event"].includes(item.kind) ? "note" : "visual";
    reserve.push({ type, primary: item, companions: type === "visual" ? companionFor(item) : [] });
  }
  return finish(section, ordered, reserve, selected, { episode, allocation: "maomao-v1" }, hints);
}

export function planMusic(items, ctx) {
  const taste = ctx.taste, section = "music", q = QUOTAS.music;
  const pool = items.filter((i) => inSection(i, section));
  const { pick, selected } = picker(taste, ctx, section);
  const songs = pool.filter((i) => i.kind === "song" || (i.kind === "video" && i.tags.voicebanks?.length));
  const now = zonedInstant(ctx.day, 7);
  const ageDays = (i) => (i.publishedAt ? (now - new Date(i.publishedAt)) / 86400000 : Infinity);
  const isMiku = (i) => lower(i.tags.voicebanks).includes("hatsune miku");
  const nonMiku = (i) => hasAny(i.tags.voicebanks, VOICEBANKS.filter((v) => v !== "hatsune miku"));
  const hints = {};
  const entries = [];
  const song = (predicate, hint) => {
    const s = pick(songs, predicate, { enforceProducers: true });
    if (s) {
      entries.push({ type: "song", primary: s, companions: [] });
      if (hint) hints[s.id] = hint;
    }
    return s;
  };
  // Two new originals: ≥48 h old (ratings settle) within 14 days; fall back to <48 h if none.
  const fresh = (i) => ageDays(i) <= 14 && ageDays(i) >= 2;
  const newest = (i) => ageDays(i) <= 14;
  song((i) => fresh(i) && isMiku(i), { why: ["miku first"] }) ?? song((i) => newest(i) && isMiku(i), { why: ["miku first"] }) ?? song(fresh);
  const needNonMiku = !ctx.nonMikuYesterday;
  song((i) => newest(i) && (needNonMiku ? nonMiku(i) : true)) ?? song(newest);
  song((i) => hasAny(i.tags.topics, [ERAS.classics]), { why: ["classics"] });
  song((i) => hasAny(i.tags.topics, [ERAS.story]), { why: ["rin & len story songs"] });
  song((i) => hasAny(i.tags.topics, [ERAS.modern]) || lower(i.tags.fandoms).includes("project sekai"));
  // Non-Miku guarantee when yesterday had none: swap in if still missing and supply exists.
  if (needNonMiku && !entries.some((e) => nonMiku(e.primary))) song(nonMiku, { why: ["also rin, len, luka, kaito, meiko, teto, gumi"] });
  const sekai = pool.filter((i) => lower(i.tags.fandoms).includes("project sekai") && ["news", "event"].includes(i.kind));
  for (let k = 0; k < q.sekai; k++) {
    const s = pick(sekai);
    if (s) entries.push({ type: "sekai", primary: s, companions: [] });
  }
  const notes = pool.filter((i) => ["news", "lore", "event"].includes(i.kind));
  for (let k = 0; k < q.note; k++) {
    const s = pick(notes);
    if (s) entries.push({ type: "note", primary: s, companions: [] });
  }
  for (let k = 0; k < q.visual; k++) {
    const s = pick(pool, (i) => ["image", "clip"].includes(i.kind));
    if (s) entries.push({ type: "visual", primary: s, companions: [] });
  }
  const meme = pick(pool, (i) => i.kind === "meme");
  if (meme) entries.push({ type: "meme", primary: meme, companions: [] });
  const merch = pick(pool, (i) => i.kind === "merch");
  if (merch) entries.push({ type: "merch", primary: merch, companions: [] });
  // Order: song, visual, song, sekai, song, note, song, meme, song, visual, sekai, note, merch.
  const byType = (t) => entries.filter((e) => e.type === t);
  const order = ["song", "visual", "song", "sekai", "song", "note", "song", "meme", "song", "visual", "sekai", "note", "merch"];
  const queues = Object.fromEntries(["song", "visual", "sekai", "note", "meme", "merch"].map((t) => [t, byType(t)]));
  const ordered = order.map((t) => queues[t].shift()).filter(Boolean);
  ordered.push(...Object.values(queues).flat());
  while (ordered.length < 13) {
    const extra = pick(pool, () => true, { enforceProducers: true });
    if (!extra) break;
    ordered.push({ type: extra.kind === "song" ? "song" : ["news", "lore", "event"].includes(extra.kind) ? "note" : "visual", primary: extra, companions: [] });
  }
  const reserve = [];
  const reservePattern = ["song", "visual", "song", "note", "song", "visual", "song", "sekai", "song", "meme", "song", "visual", "song", "note", "song", "visual", "note", "merch", "visual", "note"];
  for (const t of reservePattern) {
    const item =
      t === "song" ? pick(songs, () => true, { enforceProducers: true })
      : t === "visual" ? pick(pool, (i) => ["image", "clip"].includes(i.kind))
      : t === "sekai" ? pick(sekai)
      : t === "note" ? pick(notes)
      : t === "meme" ? pick(pool, (i) => i.kind === "meme")
      : pick(pool, (i) => i.kind === "merch");
    if (item) reserve.push({ type: t, primary: item, companions: [] });
  }
  return finish(section, ordered, reserve, selected, { allocation: "music-v1", nonMikuRequired: needNonMiku }, hints);
}

export function rotatingFandom(taste, day, offset = 0) {
  const list = taste.rotatingFandoms;
  const index = Math.floor(zonedInstant(day, 12).getTime() / 86400000) + offset;
  return list[((index % list.length) + list.length) % list.length];
}
const MUSIC_ANIME = ["oshi no ko", "bocchi the rock!", "girls band cry"];
const EXTRAS = ["look", "spot", "wig", "scene"];

export function planDressup(items, ctx) {
  const taste = ctx.taste, section = "dressup", q = QUOTAS.dressup;
  const pool = items.filter((i) => inSection(i, section));
  const countdownIds = new Set(
    pool
      .filter((i) => i.kind === "event" && i.facts?.eventAt)
      .filter((i) => COUNTDOWN_DAYS.some((d) => sgDay(i.facts.eventAt) === addDays(ctx.day, d)) || /this weekend/i.test(i.title))
      .map((i) => i.id),
  );
  const { pick, selected } = picker(taste, { ...ctx, countdownIds }, section);
  const cosplay = pool.filter((i) => i.kind === "cosplay");
  const hints = {};
  const three = [];
  const miku = pick(cosplay, (i) => lower(i.tags.characters).includes("hatsune miku"));
  if (miku) three.push({ type: "three", primary: miku, companions: [], hook: "daily_three_miku" });
  const maomao = pick(cosplay, (i) => lower(i.tags.characters).includes("maomao"));
  if (maomao) three.push({ type: "three", primary: maomao, companions: [], hook: "daily_three_maomao" });
  let fandom = null;
  for (let offset = 0; offset < taste.rotatingFandoms.length; offset++) {
    const candidate = rotatingFandom(taste, ctx.day, offset);
    const wanted = candidate === "music anime" ? MUSIC_ANIME : [candidate];
    const found = pick(cosplay, (i) => hasAny(i.tags.fandoms, wanted));
    if (found) {
      fandom = candidate;
      three.push({ type: "three", primary: found, companions: [], hook: "daily_three_rotation" });
      hints[found.id] = { why: [`today's rotating fandom: ${candidate}`] };
      break;
    }
  }
  const entries = [...three];
  const tutorial = pick(pool, (i) => i.kind === "tutorial" && hasAny(i.tags.formats, ["transformation", "tutorial"])) ?? pick(pool, (i) => i.kind === "tutorial");
  if (tutorial) entries.push({ type: "process", primary: tutorial, companions: [] });
  const processPost = pick(pool, (i) => hasAny(i.tags.formats, ["wig", "makeup", "wip"]));
  if (processPost) entries.push({ type: "process", primary: processPost, companions: [] });
  // Wishlist match uses canonical tags: Miku versions need Miku plus the version wording (or the
  // SEKAI fandom for "sekai miku"); fandom entries match the fandom tag.
  const wishlistMatch = (i) =>
    lower(taste.cosplayWishlist).some((w) => {
      const version = w.match(/^(.*) miku$/)?.[1];
      if (version)
        return (
          lower(i.tags.characters).includes("hatsune miku") &&
          (version === "sekai" ? lower(i.tags.fandoms).includes("project sekai") : textOf(i).includes(version))
        );
      return lower(i.tags.fandoms).includes(w) || lower(i.tags.characters).includes(w);
    });
  const dare = pick(cosplay, wishlistMatch);
  if (dare) {
    entries.push({ type: "dare", primary: dare, companions: [], hook: "dare" });
    hints[dare.id] = { hook: "dare", why: ["on her want-to-cosplay list"] };
  }
  const events = pool.filter((i) => i.kind === "event");
  for (let k = 0; k < q.event; k++) {
    const e = pick(events, (i) => countdownIds.has(i.id)) ?? pick(events);
    if (!e) break;
    const daysLeft = e.facts?.eventAt ? Math.round((zonedInstant(sgDay(e.facts.eventAt), 12) - zonedInstant(ctx.day, 12)) / 86400000) : null;
    hints[e.id] = { hook: countdownIds.has(e.id) ? "countdown" : "event", derived: daysLeft !== null ? { daysUntil: String(daysLeft) } : {} };
    entries.push({ type: "event", primary: e, companions: [] });
  }
  const extraKind = EXTRAS[Math.floor(zonedInstant(ctx.day, 12).getTime() / 86400000) % EXTRAS.length];
  const extra =
    extraKind === "look" ? pick(pool, (i) => i.kind === "look")
    : extraKind === "spot" ? pick(pool, (i) => i.kind === "spot")
    : extraKind === "wig" ? pick(pool, (i) => hasAny(i.tags.formats, ["wig"]) && i.kind !== "cosplay")
    : pick(pool, (i) => i.kind === "creator" || (i.kind === "event" && /cosplay/i.test(textOf(i))));
  const fallbackExtra = extra ?? pick(pool, (i) => ["look", "spot", "creator"].includes(i.kind));
  if (fallbackExtra) entries.push({ type: "extra", primary: fallbackExtra, companions: [] });
  const meme = pick(pool, (i) => i.kind === "meme");
  if (meme) entries.push({ type: "meme", primary: meme, companions: [] });
  const merch = pick(pool, (i) => i.kind === "merch");
  if (merch) entries.push({ type: "merch", primary: merch, companions: [] });
  const news = pick(pool, (i) => i.kind === "news");
  if (news) entries.push({ type: "news", primary: news, companions: [] });
  while (entries.length < 12) {
    const more = pick(cosplay) ?? pick(pool);
    if (!more) break;
    entries.push({ type: more.kind === "cosplay" ? "cosplay" : more.kind, primary: more, companions: [] });
  }
  const reserve = [];
  const pattern = ["cosplay", "process", "cosplay", "news", "cosplay", "look", "cosplay", "process", "cosplay", "event", "cosplay", "news", "cosplay", "process", "look", "cosplay", "news", "meme", "process", "merch"];
  for (const t of pattern) {
    const item =
      t === "cosplay" ? pick(cosplay)
      : t === "process" ? pick(pool, (i) => i.kind === "tutorial" || hasAny(i.tags.formats, ["wig", "makeup", "wip", "transformation"]))
      : t === "look" ? pick(pool, (i) => ["look", "spot", "creator"].includes(i.kind))
      : t === "event" ? pick(events)
      : t === "meme" ? pick(pool, (i) => i.kind === "meme")
      : t === "merch" ? pick(pool, (i) => i.kind === "merch")
      : pick(pool, (i) => i.kind === "news");
    if (item) reserve.push({ type: t, primary: item, companions: [] });
  }
  return finish(section, entries, reserve, selected, { allocation: "dressup-v1", rotatingFandom: fandom, extraKind, personal: ctx.personal ?? null }, hints);
}

const HUMOR_WEIGHT = { relatable: 1, dark: 0.9, absurd: 0.85, wholesome: 0.4 };
export function planMeme(items, ctx) {
  const section = "meme";
  // Fandom memes stay in their sections; the home meme is general/anime/relatable.
  const pool = items.filter((i) => inSection(i, section) && i.kind === "meme" && !i.sections.includes("maomao") && !i.sections.includes("music"));
  const humor = (i) => HUMOR_WEIGHT[i.safety?.vision?.[0]?.meme?.humor] ?? 0.5;
  const format = (i) => (hasAny(i.tags.formats, lower(ctx.taste.memeFormats)) ? 0.2 : 0);
  const ranked = pool
    .map((item) => ({ item, ...scoreItem(item, ctx.taste, { day: ctx.day, section, recentCreators: ctx.recentCreators ?? [] }) }))
    .map((r) => ({ ...r, score: r.score + humor(r.item) + format(r.item) }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie || a.item.id.localeCompare(b.item.id));
  const chosen = [];
  let lastCreator = null;
  for (const r of ranked) {
    const c = creatorOf(r.item);
    const community = r.item.credit?.platform ?? "";
    if (chosen.length && (c === lastCreator || chosen.at(-1).item.credit?.platform === community && community.startsWith("lemmy:"))) continue;
    chosen.push(r);
    lastCreator = c;
    if (chosen.length >= QUOTAS.meme.featured + QUOTAS.meme.reserve) break;
  }
  const entries = chosen.map((r) => ({ type: "meme", primary: r.item, companions: [] }));
  return finish(section, entries.slice(0, 1), entries.slice(1), chosen, { allocation: "meme-v1" }, {});
}

export function planMerch(items, ctx) {
  const section = "merch", taste = ctx.taste;
  const now = zonedInstant(ctx.day, 12);
  const pool = items.filter(
    (i) => inSection(i, section) && i.kind === "merch" && (!i.facts?.availability || i.facts.availability !== "sold_out"),
  );
  const ranked = pool
    .map((item) => {
      const base = scoreItem(item, taste, { day: ctx.day, section });
      const deadline = item.facts?.preorderUntil ? new Date(item.facts.preorderUntil) - now : null;
      const urgent = deadline !== null && deadline >= 0 ? Math.max(0, 1 - deadline / (30 * 86400000)) : 0;
      return { item, ...base, score: base.score + urgent };
    })
    .sort((a, b) => b.score - a.score || a.tie - b.tie || a.item.id.localeCompare(b.item.id))
    .slice(0, QUOTAS.merch.shelf);
  const entries = ranked.map((r) => ({ type: "merch", primary: r.item, companions: [] }));
  return finish(section, entries, [], ranked, { allocation: "merch-shelf-v1" }, {});
}

export const PLANNERS = { maomao: planMaomao, music: planMusic, dressup: planDressup, meme: planMeme, merch: planMerch };
