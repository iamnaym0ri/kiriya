// English Wikipedia Action API: Apothecary Diaries episode list (title, original air date, short summary).
//
// Verified live 2026-09-15T14:52Z from a home WSL machine (not Vercel):
// - `action=parse&page=List_of_The_Apothecary_Diaries_episodes&prop=wikitext` → 200 JSON, revid 1371243362,
//   48 {{Episode list}} entries under "Season 1 (2023–24)" and "Season 2 (2025)"; no Season 3 rows yet.
// - siteinfo rightsinfo: "Creative Commons Attribution-Share Alike 4.0".
// - API:Etiquette: informative User-Agent with contact details, serial requests, `maxlag` for background
//   jobs. One request per build.
// The wikitext helpers below are shared with the Fandom adapter (fandom.js).
import { FeedError } from "../config.js";
import { CHARACTER_ALIASES, mentions } from "./tags.js";
import { clip, decodeEntities } from "./util.js";

export const WIKIPEDIA_VERIFIED_AT = "2026-09-15T14:52:02Z";
export const EPISODE_PAGE = "List_of_The_Apothecary_Diaries_episodes";
const DAY = 86_400_000;
export const RECENT_EPISODE_WINDOW = { before: 21 * DAY, after: 7 * DAY };
export const ROTATING_EPISODES = 3;
export const APOTHECARY_CHARACTERS = ["maomao", "jinshi", "pairin", "meimei", "joka", "xiaolan", "gaoshun", "lakan", "luomen", "gyokuyou"];

// Plot text is allowed to spoil, but these topics don't belong in a cheerful companion note.
export const SENSITIVE_LORE =
  /\b(?:rap(?:e|es|ed|ing|ist)|sexual(?:ly)?|molest\w*|suicid\w*|self-?harm\w*|self-inflicted|tortur\w*|prostitut\w*|naked|nude|nudity|genital\w*)\b/i;
const UNRENDERED = "\u0000";

/** The balanced `{{…}}` span that opens at `start`, or null when it never closes. */
export function templateAt(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return { start, end: i + 1, inner: text.slice(start + 2, i - 1) };
    }
  }
  return null;
}

/** Every `{{name…}}` span at any nesting depth whose name matches `pattern` (e.g. rows inside tables). */
export function templatesNamed(text, pattern) {
  const spans = [];
  for (const m of text.matchAll(/\{\{\s*([^|{}\n]+?)\s*(?=\||\}\})/g)) {
    if (!pattern.test(m[1].replace(/_/g, " "))) continue;
    const span = templateAt(text, m.index);
    if (span) spans.push(span);
  }
  return spans;
}

/** Top-level `{{…}}` spans in wikitext, with balanced nesting. */
export function findTemplates(text) {
  const spans = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      if (depth === 0) start = i;
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}" && depth > 0) {
      depth--;
      i++;
      if (depth === 0) spans.push({ start, end: i + 1, inner: text.slice(start + 2, i - 1) });
    }
  }
  return spans;
}

/** `name|a|key=b` split on top-level pipes only. */
export function templateParts(inner) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i++;
    } else if ((two === "}}" || two === "]]") && depth > 0) {
      depth--;
      current += two;
      i++;
    } else if (inner[i] === "|" && depth === 0) {
      parts.push(current);
      current = "";
    } else current += inner[i];
  }
  parts.push(current);
  const name = parts.shift().trim().replace(/_/g, " ");
  const positional = [];
  const named = {};
  for (const part of parts) {
    const m = part.match(/^\s*([^=\[\]{}|]+?)\s*=([\s\S]*)$/);
    if (m) named[m[1].trim()] = m[2].trim();
    else positional.push(part.trim());
  }
  return { name, key: name.toLowerCase(), positional, named };
}

/** Replaces templates through `render(parts)`; a null render marks the text as not verbatim-renderable. */
export function expandTemplates(text, render, rounds = 4) {
  let out = text;
  for (let round = 0; round < rounds; round++) {
    const spans = findTemplates(out);
    if (!spans.length) break;
    let next = "";
    let at = 0;
    for (const span of spans) {
      const value = render(templateParts(span.inner));
      next += out.slice(at, span.start) + (value === null ? UNRENDERED : value);
      at = span.end;
    }
    out = next + out.slice(at);
  }
  return findTemplates(out).length ? out.replace(/\{\{[\s\S]*?\}\}/g, UNRENDERED) : out;
}

/** Removes comments, references, galleries and tables (block-level constructs). */
export function stripBlocks(text) {
  let out = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<(gallery|syntaxhighlight|math|score|timeline|imagemap)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const lines = out.split("\n");
  const kept = [];
  let tables = 0;
  for (const line of lines) {
    if (/^\s*\{\|/.test(line)) tables++;
    if (!tables) kept.push(line);
    if (/^\s*\|\}/.test(line) && tables) tables--;
  }
  out = kept.join("\n");
  return out;
}

function stripLinks(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("[[", i)) {
      let depth = 0;
      let j = i;
      for (; j < text.length - 1; j++) {
        if (text.startsWith("[[", j)) {
          depth++;
          j++;
        } else if (text.startsWith("]]", j)) {
          depth--;
          j++;
          if (depth === 0) break;
        }
      }
      const inner = text.slice(i + 2, j - 1);
      i = j + 1;
      if (/^\s*:?\s*(?:file|image|category|media)\s*:/i.test(inner)) continue;
      const parts = inner.split("|");
      const label = parts.length > 1 ? parts.slice(1).join("|") : parts[0].replace(/^:/, "").replace(/#.*$/, "");
      out += stripLinks(label);
    } else out += text[i++];
  }
  return out;
}

/** Plain text for one already template-expanded fragment. */
export function inlinePlain(text) {
  const plain = stripLinks(String(text ?? ""))
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, "")
    .replace(/'{2,5}/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/__[A-Z]+__/g, "");
  return decodeEntities(plain).replace(/[ \t ]+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

/** Verbatim prefix of `text` of at most `max` characters, cut at a sentence end where possible. */
export function sentenceClip(text, max = 600) {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const ends = [...head.matchAll(/[.!?。！？]["”’)]?(?=\s|$)/g)];
  const cut = ends.length ? ends.at(-1).index + ends.at(-1)[0].length : 0;
  return cut >= max / 3 ? head.slice(0, cut).trim() : clip(text, max);
}

export const isRenderable = (text) => !text.includes(UNRENDERED) && !/\{\{|\}\}|\[\[|\]\]/.test(text);

// Wikipedia templates that can appear inside episode summaries/titles.
function renderWikipedia({ key, positional, named }) {
  if (/^(?:efn|efn-[a-z]+|sfn|sfnp|refn|r|rp|citation needed|cn|clarify|when|who|dubious|anchor|nbsp|zwsp|ref label|note label)$/.test(key))
    return key === "nbsp" ? " " : "";
  if (key === "ndash") return "–";
  if (key === "mdash") return "—";
  if (["snd", "spnd", "sndash", "spaced ndash", "spaced en dash"].includes(key)) return " – ";
  if (["nihongo", "ill", "interlanguage link", "small", "nowrap", "abbr", "lang-ja", "vanchor", "var"].includes(key))
    return positional[0] ?? "";
  if (key === "lang") return positional[1] ?? "";
  if (key === "transl" || key === "transliteration") return positional.at(-1) ?? "";
  if (key === "start date") return named.date ?? positional.filter(Boolean).join("-");
  return null;
}

/** ISO calendar date from `{{Start date|YYYY|MM|DD}}` or a plain "Month D, YYYY" string. */
export function airDate(value) {
  const text = String(value ?? "");
  const tpl = findTemplates(text).map((s) => templateParts(s.inner)).find((p) => p.key === "start date");
  if (tpl) {
    const [y, m, d] = tpl.positional.map((n) => Number(n));
    if (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d))
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const parsed = Date.parse(`${inlinePlain(expandTemplates(stripBlocks(text), () => ""))} 00:00 UTC`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

/** Every {{Episode list}} row with its season, taken from the nearest preceding "Season N" heading. */
export function episodeEntries(wikitext) {
  const text = String(wikitext ?? "").replace(/\r\n?/g, "\n");
  const headings = [...text.matchAll(/^(={2,6})\s*(.+?)\s*\1\s*$/gm)].map((m) => ({ at: m.index, title: m[2] }));
  const rows = [];
  // Rows sit inside {{Episode table|episodes=…}}, so search at every depth.
  for (const span of templatesNamed(text, /^episode list(?:\/sublist)?$/i)) {
    const parts = templateParts(span.inner);
    const heading = headings.filter((h) => h.at < span.start && /season\s+\d+/i.test(h.title)).at(-1);
    const season = heading ? Number(heading.title.match(/season\s+(\d+)/i)[1]) : null;
    const field = (name) => parts.named[name] ?? "";
    const plain = (name) => {
      const expanded = expandTemplates(stripBlocks(field(name)), renderWikipedia);
      const value = inlinePlain(expanded);
      return isRenderable(value) ? value : null;
    };
    const overall = Number.parseInt(field("EpisodeNumber"), 10);
    const number = Number.parseInt(field("EpisodeNumber2"), 10);
    rows.push({
      season,
      overall: Number.isInteger(overall) ? overall : null,
      number: Number.isInteger(number) ? number : Number.isInteger(overall) ? overall : null,
      title: plain("Title"),
      translit: plain("TranslitTitle"),
      native: plain("NativeTitle"),
      airDate: airDate(field("OriginalAirDate")),
      summary: plain("ShortSummary"),
    });
  }
  return rows.filter((r) => r.title && r.overall !== null && r.season !== null);
}

const dayIndex = (day) => Math.floor((Date.parse(`${day}T00:00:00Z`) || Date.now()) / DAY);

export function episodeItem(row) {
  const summary = row.summary ? sentenceClip(row.summary, 600) : "";
  const url = new URL(`https://en.wikipedia.org/wiki/${EPISODE_PAGE}`);
  // Distinct per row: canonical URLs drop fragments, and a shared page URL would merge every episode.
  url.searchParams.set("episode", String(row.overall));
  url.hash = `ep${row.overall}`;
  return {
    source: "wikipedia-apothecary",
    nativeId: `episode:${row.overall}`,
    sections: ["maomao"],
    kind: "lore",
    title: clip(`The Apothecary Diaries · S${row.season} E${row.number} “${row.title}”`, 200),
    url: url.href,
    credit: {
      name: "Wikipedia contributors",
      platform: "Wikipedia",
      license: "CC BY-SA 4.0",
      profileUrl: `https://en.wikipedia.org/w/index.php?title=${EPISODE_PAGE}&action=history`,
    },
    tags: {
      characters: mentions(`${row.title} ${row.summary ?? ""}`, CHARACTER_ALIASES).filter((c) => APOTHECARY_CHARACTERS.includes(c)),
      fandoms: ["the apothecary diaries"],
    },
    facts: {
      excerpts: summary ? [summary] : [],
      names: [row.title, row.translit, row.native].filter(Boolean).map((n) => clip(n, 100)),
      dates: row.airDate ? [row.airDate] : [],
      episode: row.number,
      airingAt: row.airDate ? `${row.airDate}T00:00:00+09:00` : null,
      datePrecision: row.airDate ? "day" : null,
    },
    safety: { rating: "unknown" },
  };
}

/** Recently aired/upcoming rows first (so Season 3 shows up once listed), then a daily rotation. */
export function selectEpisodes(rows, day, limit) {
  const reference = Date.parse(`${day}T00:00:00+08:00`);
  const now = Number.isFinite(reference) ? reference : Date.now();
  const usable = rows.filter((r) => !SENSITIVE_LORE.test(`${r.title} ${r.summary ?? ""}`));
  const recent = usable
    .filter((r) => {
      const at = r.airDate ? Date.parse(`${r.airDate}T00:00:00+09:00`) : NaN;
      return Number.isFinite(at) && at >= now - RECENT_EPISODE_WINDOW.before && at <= now + RECENT_EPISODE_WINDOW.after;
    })
    .sort((a, b) => a.overall - b.overall);
  const pool = usable.filter((r) => r.summary && !recent.includes(r)).sort((a, b) => a.overall - b.overall);
  const rotating = [];
  // The window moves by its own size each day so consecutive builds offer different rows.
  for (let i = 0; i < Math.min(ROTATING_EPISODES, pool.length); i++)
    rotating.push(pool[(dayIndex(day) * ROTATING_EPISODES + i) % pool.length]);
  return [...recent, ...rotating].slice(0, limit);
}

export async function fetchWikipedia(ctx) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({
    action: "parse",
    page: EPISODE_PAGE,
    prop: "wikitext|revid",
    redirects: "1",
    format: "json",
    formatversion: "2",
    maxlag: "5",
  }))
    url.searchParams.set(k, v);
  const body = await ctx.http.json(url.href);
  if (body?.error) {
    const code = String(body.error.code ?? "");
    if (code === "missingtitle" || code === "pagecannotexist") throw new FeedError("not_found", 404);
    if (code === "maxlag" || code === "ratelimited") throw new FeedError("rate_limited", 429);
    throw new FeedError("source_unavailable", 503);
  }
  if (typeof body?.parse?.wikitext !== "string") throw new FeedError("source_shape", 503);
  const rows = episodeEntries(body.parse.wikitext);
  if (!rows.length) throw new FeedError("source_shape", 503);
  const items = selectEpisodes(rows, ctx.day, Math.min(8, ctx.limits.items)).map(episodeItem);
  return { items, cursor: null, done: true };
}

export const wikipediaApothecary = {
  id: "wikipedia-apothecary",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["maomao"],
  hosts: ["en.wikipedia.org"],
  mediaHosts: [],
  linkHosts: [],
  profileHosts: [],
  requiredCredentials: [],
  optionalCredentials: [],
  maxRequests: 2,
  maxBytes: 1024 * 1024,
  paceMs: 1000,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  copyPermission: null,
  deletionPolicy: "none",
  deletionDeadlineHours: null,
  // Wikimedia Terms of Use (read through foundation.wikimedia.org's API, 2026-09-15): text is CC BY-SA 4.0
  // and reusers must credit the authors in a reasonable fashion (page history link).
  termsUrl: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use",
  docsUrl: "https://www.mediawiki.org/wiki/API:Etiquette",
  notes:
    "robots.txt disallows /w/ for crawlers; this is the documented Action API used once per build under API:Etiquette, not crawling. One Action API parse per build (maxlag=5). Rows come from {{Episode list}} templates: Title, TranslitTitle, NativeTitle, OriginalAirDate ({{Start date}}, day precision, JST) and ShortSummary (verbatim, cut at a sentence end ≤600 chars). Rows airing within 21 days before / 7 days after the build day come first, so Season 3 rows appear as soon as editors add them; then 3 rows rotate daily. Summaries with sexual-violence/self-harm/torture terms are skipped. Template output that can't be rendered verbatim drops that field. Credit: Wikipedia contributors, CC BY-SA 4.0, page history link.",
  fetch: fetchWikipedia,
};
