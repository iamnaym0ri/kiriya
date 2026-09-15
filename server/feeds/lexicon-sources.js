// Candidate slang for the weekly voice-lexicon refresh (PIPELINE §9.6). Candidate generation only:
// the events stage runs `filterLexiconTerms` and then a model check before anything reaches
// `voice_lexicon`. Three bounded sources, at most five requests a week:
// - Wiktionary "Category:English internet slang", newest additions first, plus one category lookup
//   that labels vulgar/derogatory/slur/eponym entries (if that lookup fails, Wiktionary terms are
//   dropped rather than passed unlabelled);
// - the net diff of Wikipedia's "Glossary of 2020s slang" since the last run (glossary `;term` lines);
// - Danbooru's newest `*_(meme)` general tags.
// MediaWiki API use follows mediawiki.org/wiki/API:Etiquette (identifying User-Agent with a contact
// URL, serial requests, maxlag). Danbooru's robots.txt disallows /*.json for crawlers; this relies on
// its documented API and stays one request a week (see the source report).
import { BAD_TEXT, BANNED_JOKES, POLITICS } from "./rules.js";

const WIKTIONARY_API = "https://en.wiktionary.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const GLOSSARY = "Glossary_of_2020s_slang";
const DANBOORU_TAGS = "https://danbooru.donmai.us/tags.json";

/** `sourceHttp` policy for the lexicon refresh. */
export const lexiconSourceEntry = {
  id: "lexicon-refresh",
  hosts: ["en.wiktionary.org", "en.wikipedia.org", "danbooru.donmai.us"],
  mediaHosts: [],
  maxRequests: 8, // five planned requests plus retries
  maxBytes: 1024 * 1024,
  paceMs: 1100,
  timeoutMs: 15000,
  cacheSeconds: 7 * 86400,
  termsUrl: "https://www.mediawiki.org/wiki/API:Etiquette",
  notes:
    "Weekly and serial. Wiktionary/Wikipedia text is CC BY-SA; only short terms are kept as writer vocabulary. Danbooru tags.json is disallowed by robots.txt for crawlers; kept to one documented-API request a week and removable with `sources`.",
};

// Wiktionary categories whose members never become candidates.
export const BLOCKING_LABELS = [
  "English vulgarities",
  "English offensive terms",
  "English derogatory terms",
  "English ethnic slurs",
  "English swear words",
  "English eponyms",
  "en:Sex",
  "en:Sexuality",
  "en:Pornography",
  "en:Politics",
  "en:Death",
  "en:Suicide",
  "en:Recreational drugs",
  "en:Violence",
];

// Crude, sexual, violent, drug and slur vocabulary (a moderation list, matched case-insensitively).
// Stems in SUBSTRING match inside words ("netwank"); the rest need a word start.
const SUBSTRING = ["fuck", "fuk", "fck", "phuck", "shit", "cunt", "wank", "jizz", "porn", "hentai", "nsfw", "dildo", "bdsm", "milf", "nigg", "fagg", "tranny", "retard", "incest", "zoophil", "bestiality", "masturbat", "orgasm", "erotic", "fetish", "onlyfans", "wetback", "raghead", "towelhead"];
const WORD_START = [
  "bitch\\p{L}*", "biatch", "twat\\p{L}*", "dick(?:s|head\\p{L}*)?", "cock(?:s|y)?", "puss(?:y|ies)", "ass(?:es|hole\\p{L}*)?", "butt(?:s|hole\\p{L}*|hurt)?",
  "boob\\p{L}*", "tit(?:s|ty|ties)", "sex\\p{L}*", "horny", "nude\\p{L}*", "naked", "thot\\p{L}*", "slut\\p{L}*", "whore\\p{L}*", "hoes?",
  "rap(?:e|ed|es|ing|ist\\p{L}*)", "cum(?:s|ming|med)?", "coom\\p{L}*", "goon(?:er|ers|ing|s)?", "bussy", "penis\\p{L}*", "vagina\\p{L}*", "anal", "anus",
  "thicc\\p{L}*", "deez", "balls", "piss\\p{L}*", "poop\\p{L}*", "fart\\p{L}*", "kink\\p{L}*", "loli\\p{L}*", "shota\\p{L}*", "pedo\\p{L}*", "paedo\\p{L}*",
  "(?:give|gives|giving|getting|got|best|good) head", "body count", "kill(?:s|ed|ing|er|ers)?", "murder\\p{L}*", "guns?", "shooter\\p{L}*",
  "bomb(?:s|ed|ing|er|ers)?", "terror\\p{L}*", "nazi\\p{L}*", "hitler\\p{L}*", "genocid\\p{L}*", "strangl\\p{L}*", "stab(?:s|bed|bing)?", "cocaine",
  "weed", "stoned", "drunk\\p{L}*", "meth", "crackhead\\p{L}*", "fags?", "dyke\\p{L}*", "spics?", "chink\\p{L}*", "kikes?", "goy(?:im|s)?", "coons?",
  "gypped", "mog(?:s|ged|ging)?", "looksmax\\p{L}*", "fat(?:ty|ties)?", "ugly",
];
export const CRUDE_TERMS = new RegExp(
  `(?:${SUBSTRING.join("|")})|(?<![\\p{L}\\p{N}])(?:${WORD_START.join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);

// Real people who recur in meme vocabulary (prefix stems catch "Kirkmas", "Kirkination").
export const REAL_PEOPLE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[
    "kirk\\p{L}*", "trump\\p{L}*", "biden\\p{L}*", "obama\\p{L}*", "musk\\p{L}*", "elon", "bezos", "zuckerberg\\p{L}*", "putin\\p{L}*", "xi jinping",
    "kim jong", "netanyahu", "zelensk\\p{L}*", "kamala", "harris", "vance", "desantis", "clinton\\p{L}*", "hillary", "bernie", "pelosi", "epstein\\p{L}*",
    "diddy", "kanye", "kardashian\\p{L}*", "taylor swift", "swifties", "beyonc\\p{L}*", "drake\\p{L}*", "mr ?beast", "logan paul", "jake paul",
    "andrew tate", "tate", "mangione", "trudeau", "modi", "sunak", "starmer", "farage", "lee hsien loong", "lawrence wong", "pooh shiesty",
  ].join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);
const FIRST_NAMES = new Set(
  "aaron adam alex andrew anthony ben bill bob brandon brian bruce carl charlie chris dan daniel danny dave david donald doug emma eric frank gary george greg harry henry jack jake james jeff jennifer jerry jim jimmy joe john johnny jordan josh justin karen kevin kim kyle larry logan luigi mark matt michael mike nick oprah paul pete peter rick ricky rob robert ron ryan sam scott sean steve steven taylor ted tim tom tony travis walter wesley zach".split(" "),
);
const LONG_FIRST_NAMES = [...FIRST_NAMES].filter((name) => name.length >= 5);
const FUNCTION_WORDS = new Set("a an the be is are was when me my i you your u ur of to in on at and or but if so".split(" "));

/** Why a candidate term is rejected, or null when it may go to the model check. */
export function lexiconBlockReason(entry) {
  const term = String(entry?.term ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!term) return "empty";
  const words = term.split(" ");
  if (term.length < 2) return "too_short";
  if (term.length > 40 || words.length > 5) return "too_long";
  if (/\d/.test(term)) return "digits";
  if (/https?:|www\.|\.(?:com|net|org|io|gg|tv|app|dev|me|ly|sg|jp)\b|[/@#]/i.test(term)) return "url";
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’.,!?& -]*$/u.test(term)) return "characters";
  const labels = (entry?.labels ?? []).map((l) => String(l).replace(/^Category:/, ""));
  if (labels.some((l) => BLOCKING_LABELS.includes(l))) return "blocked_label";
  if (BANNED_JOKES.test(term)) return "banned_joke";
  if (POLITICS.test(term)) return "politics";
  if (BAD_TEXT.test(term)) return "bad_text";
  if (CRUDE_TERMS.test(term)) return "crude";
  if (REAL_PEOPLE.test(term)) return "real_person";
  // Proper-name shapes: "Charlie Kirk", or a common first name followed by another word.
  if (words.length >= 2 && words.length <= 4 && words.every((w) => /^\p{Lu}[\p{Ll}'’.-]+$/u.test(w))) return "real_person";
  if (words.length >= 2 && FIRST_NAMES.has(words[0].toLowerCase()) && !FUNCTION_WORDS.has(words[1].toLowerCase())) return "real_person";
  // Creator handles glued into one word ("imbrandonfarris").
  if (words.some((w) => w.length >= 10 && LONG_FIRST_NAMES.some((name) => w.toLowerCase().includes(name)))) return "real_person";
  return null;
}

/** Removes blocked, malformed and duplicate candidates (case-insensitive), keeping order. */
export function filterLexiconTerms(terms) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(terms) ? terms : []) {
    if (!entry || typeof entry.term !== "string" || lexiconBlockReason(entry)) continue;
    const term = entry.term.normalize("NFC").replace(/\s+/g, " ").trim();
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...entry, term });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

const query = (base, params) =>
  `${base}?${Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")}`;

function sinceInstant(since) {
  if (typeof since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(since)) return `${since}T00:00:00Z`;
  const t = since instanceof Date ? since.getTime() : Date.parse(since ?? "");
  return new Date(Number.isFinite(t) ? t : Date.now() - 7 * 86400000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function apiError(json) {
  if (json && typeof json === "object" && json.error) {
    const error = new Error(`mediawiki_${json.error.code ?? "error"}`);
    error.code = `mediawiki_${String(json.error.code ?? "error").slice(0, 40)}`;
    throw error;
  }
  return json;
}

async function wiktionaryTerms(http, sinceIso) {
  const members = apiError(
    await http.json(
      query(WIKTIONARY_API, {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:English internet slang",
        cmsort: "timestamp",
        cmdir: "desc",
        cmend: sinceIso,
        cmlimit: "50",
        cmprop: "ids|title|timestamp",
        cmnamespace: "0",
        format: "json",
        formatversion: "2",
        maxlag: "5",
      }),
    ),
  );
  const list = (members?.query?.categorymembers ?? []).filter((m) => typeof m?.title === "string").slice(0, 50);
  if (!list.length) return [];
  const labelled = apiError(
    await http.json(
      query(WIKTIONARY_API, {
        action: "query",
        prop: "categories",
        titles: list.map((m) => m.title).join("|"),
        clcategories: BLOCKING_LABELS.map((l) => `Category:${l}`).join("|"),
        cllimit: "max",
        format: "json",
        formatversion: "2",
        maxlag: "5",
      }),
    ),
  );
  const labels = new Map((labelled?.query?.pages ?? []).map((p) => [p.title, (p.categories ?? []).map((c) => c.title.replace(/^Category:/, ""))]));
  for (const n of labelled?.query?.normalized ?? []) if (labels.has(n.to)) labels.set(n.from, labels.get(n.to));
  return list.map((m) => ({
    term: m.title,
    source: "wiktionary",
    sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(m.title.replaceAll(" ", "_"))}`,
    addedAt: m.timestamp,
    labels: labels.get(m.title) ?? [],
  }));
}

const decode = (s) =>
  String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");

function stripTemplates(text) {
  let s = text, previous;
  do {
    previous = s;
    s = s.replace(/\{\{[^{}]*\}\}/g, "");
  } while (s !== previous && s.includes("{{"));
  return s;
}

/** Terms named by one glossary definition-list line (";[[Bro culture|bruh/bru]] (…)"). */
export function glossaryLineTerms(line) {
  if (!/^\s*;/.test(line)) return [];
  let s = line.replace(/^\s*;\s*/, "");
  s = s.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  s = stripTemplates(s)
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\([^)]*\)/g, "")
    .split(/\s:\s|:$/)[0];
  return s
    .split(/\s*\/\s*/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** Newly added glossary terms from a MediaWiki `action=compare` table diff body. */
export function glossaryDiffTerms(body) {
  const side = (row, kind, drop) => {
    const m = row.match(new RegExp(`class="diff-${kind}line[^"]*"[^>]*>\\s*<div>([\\s\\S]*?)</div>`));
    return m ? decode(m[1].replace(new RegExp(`<${drop}\\b[^>]*>[\\s\\S]*?</${drop}>`, "g"), "").replace(/<[^>]+>/g, "")) : null;
  };
  const added = new Map();
  const removed = new Set();
  for (const row of String(body ?? "").split("<tr>")) {
    const addedLine = side(row, "added", "del");
    const deletedLine = side(row, "deleted", "ins");
    for (const t of deletedLine ? glossaryLineTerms(deletedLine) : []) removed.add(t.toLowerCase());
    for (const t of addedLine ? glossaryLineTerms(addedLine) : []) if (!added.has(t.toLowerCase())) added.set(t.toLowerCase(), t);
  }
  return [...added].filter(([key]) => !removed.has(key)).map(([, term]) => term).slice(0, 30);
}

async function wikipediaTerms(http, sinceIso) {
  const history = apiError(
    await http.json(
      query(WIKIPEDIA_API, {
        action: "query",
        prop: "revisions",
        titles: GLOSSARY,
        rvprop: "ids|timestamp",
        rvlimit: "50",
        rvend: sinceIso,
        format: "json",
        formatversion: "2",
        maxlag: "5",
      }),
    ),
  );
  const revisions = history?.query?.pages?.[0]?.revisions ?? [];
  if (!revisions.length) return [];
  const newest = revisions[0], oldest = revisions.at(-1);
  if (!Number.isInteger(newest.revid) || !Number.isInteger(oldest.parentid) || oldest.parentid <= 0) return [];
  const compare = apiError(
    await http.json(
      query(WIKIPEDIA_API, {
        action: "compare",
        fromrev: String(oldest.parentid),
        torev: String(newest.revid),
        prop: "diff|ids|timestamp",
        difftype: "table",
        format: "json",
        formatversion: "2",
        maxlag: "5",
      }),
    ),
  );
  const body = compare?.compare?.body ?? "";
  const addedAt = compare?.compare?.totimestamp ?? newest.timestamp;
  const sourceUrl = `https://en.wikipedia.org/w/index.php?title=${GLOSSARY}&diff=${newest.revid}&oldid=${oldest.parentid}`;
  return glossaryDiffTerms(body).map((term) => ({ term, source: "wikipedia", sourceUrl, addedAt }));
}

async function danbooruTerms(http, sinceIso) {
  const tags = await http.json(
    query(DANBOORU_TAGS, {
      "search[name_matches]": "*_(meme)",
      "search[order]": "date",
      limit: "40",
      only: "id,name,post_count,category,created_at,is_deprecated",
    }),
  );
  const since = Date.parse(sinceIso);
  return (Array.isArray(tags) ? tags : [])
    .filter(
      (t) =>
        typeof t?.name === "string" &&
        /_\(meme\)$/.test(t.name) &&
        t.category === 0 &&
        !t.is_deprecated &&
        (t.post_count ?? 0) > 0 &&
        Date.parse(t.created_at) >= since,
    )
    .map((t) => ({
      term: t.name.replace(/_\(meme\)$/, "").replaceAll("_", " ").trim(),
      source: "danbooru",
      sourceUrl: `https://danbooru.donmai.us/wiki_pages/${encodeURIComponent(t.name)}`,
      addedAt: new Date(t.created_at).toISOString(),
    }));
}

const RETHROW = new Set(["deadline", "lease_lost", "invocation_request_limit"]);

/**
 * Bounded candidate collection: `{terms:[{term, source, sourceUrl, addedAt, labels?}], errors}`.
 * Terms are deduplicated but NOT filtered; call `filterLexiconTerms` before any model check.
 * A failing source is reported in `errors` and does not hide the others.
 */
export async function fetchLexiconCandidates(http, { since, sources = ["wiktionary", "wikipedia", "danbooru"], limit = 100 } = {}) {
  const sinceIso = sinceInstant(since);
  const readers = { wiktionary: wiktionaryTerms, wikipedia: wikipediaTerms, danbooru: danbooruTerms };
  const terms = [];
  const errors = [];
  for (const name of sources) {
    if (!readers[name]) continue;
    try {
      terms.push(...(await readers[name](http, sinceIso)));
    } catch (error) {
      if (RETHROW.has(error?.code)) throw error;
      errors.push({ source: name, code: String(error?.code ?? "source_failed").slice(0, 60) });
    }
  }
  const seen = new Set();
  const unique = terms.filter((t) => {
    const key = t.term.toLowerCase();
    if (!t.term || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { terms: unique.slice(0, limit), errors };
}
