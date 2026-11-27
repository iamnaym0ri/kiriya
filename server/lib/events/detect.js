// Change detection, cheapest first (PLAN.md §6). Each method turns one fetch into a list of changed
// items plus the state to remember. Nothing here calls Claude: items go to the signal queue, and only
// those passing the source's filter are ever triaged.
import { XMLParser } from "fast-xml-parser";
import { dateExcerpts, jsonLdEvents, mainText, pageHashOf, renderText } from "../../feeds/events/sources.js";
import { prefilterMatch } from "./fandoms.js";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true, htmlEntities: true });
const SEEN_KEEP = 400;
const FIRST_RUN_DAYS = 21; // on the first check, only recent items are news
const TEXT_TYPES = ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml", "text/html", "text/plain", "application/json", "application/xhtml+xml"];

const text = (v) => (v == null ? "" : typeof v === "string" ? v : typeof v === "object" ? (v["#text"] ?? v.__cdata ?? "") : String(v));
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const strip = (html, n = 1200) => clip(renderText(String(html ?? "")), n);

/** RSS 2.0, RSS 1.0/RDF and Atom → [{key, url, title, published, summary}]. */
export function parseFeed(body) {
  const doc = xml.parse(body);
  if (doc.rss?.channel) {
    return arr(doc.rss.channel.item).map((i) => {
      const url = text(i.link).trim();
      return { key: text(i.guid).trim() || url, url, title: strip(text(i.title), 300), published: text(i.pubDate) || text(i["dc:date"]) || null, summary: strip(text(i["content:encoded"]) || text(i.description)) };
    });
  }
  if (doc.feed) {
    return arr(doc.feed.entry).map((e) => {
      const links = arr(e.link);
      const href = (links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0])?.["@_href"] ?? "";
      return { key: text(e.id).trim() || href, url: href, title: strip(text(e.title), 300), published: text(e.published) || text(e.updated) || null, summary: strip(text(e.summary) || text(e.content)) };
    });
  }
  if (doc["rdf:RDF"]) {
    return arr(doc["rdf:RDF"].item).map((i) => ({ key: text(i.link), url: text(i.link), title: strip(text(i.title), 300), published: text(i["dc:date"]) || null, summary: strip(text(i.description)) }));
  }
  throw Object.assign(new Error("not a feed"), { code: "not_a_feed" });
}

/** Sitemap or sitemap index → {urls: [{loc, lastmod}], children: [loc]}. */
export function parseSitemap(body) {
  const doc = xml.parse(body);
  if (doc.sitemapindex) return { urls: [], children: arr(doc.sitemapindex.sitemap).map((s) => text(s.loc).trim()) };
  return { urls: arr(doc.urlset?.url).map((u) => ({ loc: text(u.loc).trim(), lastmod: text(u.lastmod).trim() || null })), children: [] };
}

const ageOk = (published, now) => {
  const t = Date.parse(published ?? "");
  return !Number.isFinite(t) || now - t < FIRST_RUN_DAYS * 86400_000;
};

/** Passes the source's filter: "none", "keywords" (fandom/event words) or "singapore". */
export function passesFilter(source, ...texts) {
  if (source.filter === "keywords") return prefilterMatch(...texts);
  if (source.filter === "singapore") return /singapore|\bsg\b/i.test(texts.join(" ")) && prefilterMatch(...texts);
  return true;
}

function keywordExcerpt(body, source) {
  const t = mainText(body);
  const windows = dateExcerpts(t, { sourceUrl: source.url, keywords: [source.name] });
  const excerpt = windows.map((w) => w.text).join("\n…\n");
  return clip(excerpt || t.slice(0, 1500), 3000);
}

/**
 * Checks one source. `fetcher` is lib/events/fetch.js; `state` what the last check stored.
 * Returns `{state, items, outcome}`; outcome is unchanged | changed | baseline (first run) | error.
 */
export async function detect(source, fetcher, state = {}, { now = Date.now() } = {}) {
  const first = !state.checkedAt;
  const done = (next, items, outcome) => ({ state: { ...next, checkedAt: new Date(now).toISOString(), method: source.method }, items, outcome });
  const minDelaySeconds = source.crawlDelaySeconds ?? 0;

  if (source.method === "rss") {
    const r = await fetcher.get(source.url, { types: TEXT_TYPES, etag: state.etag, lastModified: state.lastModified, minDelaySeconds });
    if (r.notModified) return done(state, [], "unchanged");
    const items = parseFeed(r.text);
    const seen = new Set(state.seen ?? []);
    const fresh = items.filter((i) => i.key && !seen.has(i.key) && (!first || ageOk(i.published, now)) && passesFilter(source, i.title, i.summary));
    const next = { etag: r.etag, lastModified: r.lastModified, seen: [...new Set([...items.map((i) => i.key), ...seen])].slice(0, SEEN_KEEP) };
    return done(next, fresh.map((i) => ({ key: i.key, url: i.url, title: i.title, published: i.published, excerpt: i.summary })), fresh.length ? "changed" : "unchanged");
  }

  if (source.method === "wp-json") {
    const r = await fetcher.get(source.url, { types: ["application/json"], etag: state.etag, lastModified: state.lastModified, minDelaySeconds });
    if (r.notModified) return done(state, [], "unchanged");
    const list = [JSON.parse(r.text)].flat().filter((e) => e && typeof e === "object" && e.id != null);
    const known = state.modified ?? {};
    const changed = list.filter((e) => known[e.id] !== (e.modified_gmt ?? e.modified));
    const next = { etag: r.etag, lastModified: r.lastModified, modified: Object.fromEntries(list.map((e) => [e.id, e.modified_gmt ?? e.modified])) };
    const items = changed
      .filter((e) => !first || ageOk(e.modified_gmt ? `${e.modified_gmt}Z` : e.modified, now))
      .map((e) => ({ key: `${e.id}@${e.modified_gmt ?? e.modified}`, url: e.link, title: strip(e.title?.rendered ?? "", 300), published: e.modified_gmt ? `${e.modified_gmt}Z` : null, excerpt: strip(e.content?.rendered ?? e.excerpt?.rendered ?? "", 2000) }))
      .filter((i) => passesFilter(source, i.title, i.excerpt));
    return done({ ...next, modified: { ...known, ...next.modified } }, items, items.length ? "changed" : "unchanged");
  }

  if (source.method === "sitemap") {
    const filter = new RegExp(source.sitemapFilter, "i");
    const r = await fetcher.get(source.url, { types: TEXT_TYPES, etag: state.etag, lastModified: state.lastModified, minDelaySeconds });
    if (r.notModified) return done(state, [], "unchanged");
    let { urls, children } = parseSitemap(r.text);
    // A sitemap index: read the children whose names look like events pages (at most three).
    for (const child of children.filter((c) => /event|whats|show|page|en/i.test(c)).slice(0, 3)) {
      const c = await fetcher.get(child, { types: TEXT_TYPES, minDelaySeconds });
      urls = urls.concat(parseSitemap(c.text).urls);
    }
    const known = state.lastmod ?? {};
    const matching = urls.filter((u) => filter.test(u.loc));
    const changed = matching.filter((u) => !(u.loc in known) || (u.lastmod && u.lastmod !== known[u.loc]));
    const next = { etag: r.etag, lastModified: r.lastModified, lastmod: Object.fromEntries(matching.map((u) => [u.loc, u.lastmod])) };
    const items = (first ? changed.filter((u) => ageOk(u.lastmod, now)) : changed).map((u) => ({ key: `${u.loc}@${u.lastmod ?? ""}`, url: u.loc, title: decodeURIComponent(u.loc.split("/").filter(Boolean).at(-1) ?? "").replace(/[-_]/g, " "), published: u.lastmod, excerpt: null }));
    return done(next, items, items.length ? "changed" : "unchanged");
  }

  if (source.method === "page" || source.method === "json-ld") {
    const r = await fetcher.get(source.url, { types: ["text/html", "application/xhtml+xml"], etag: state.etag, lastModified: state.lastModified, minDelaySeconds });
    if (r.notModified) return done(state, [], "unchanged");
    const basis = source.method === "json-ld" ? JSON.stringify(jsonLdEvents(r.text, { sourceUrl: source.url }).map(({ evidence, ...e }) => e)) : mainText(r.text);
    const hash = pageHashOf(basis);
    const next = { etag: r.etag, lastModified: r.lastModified, hash };
    if (hash === state.hash) return done(next, [], "unchanged");
    const excerpt = source.method === "json-ld" ? clip(basis, 3000) : keywordExcerpt(r.text, source);
    if (first) return done(next, [], "baseline");
    if (!passesFilter(source, excerpt)) return done(next, [], "unchanged");
    return done(next, [{ key: `${source.id}@${hash.slice(0, 16)}`, url: r.url, title: source.name, published: null, excerpt }], "changed");
  }

  if (source.method === "listing") {
    const r = await fetcher.get(source.url, { types: ["text/html", "application/xhtml+xml"], etag: state.etag, lastModified: state.lastModified, minDelaySeconds });
    if (r.notModified) return done(state, [], "unchanged");
    const re = new RegExp(source.listing.pattern, "g");
    const found = [];
    for (const m of r.text.matchAll(re)) if (!found.some((f) => f.id === m[1])) found.push({ id: m[1], index: m.index });
    const seen = new Set(state.seen ?? []);
    const fresh = found.filter((f) => !seen.has(f.id));
    const next = { etag: r.etag, lastModified: r.lastModified, seen: [...new Set([...found.map((f) => f.id), ...seen])].slice(0, SEEN_KEEP) };
    if (first) return done(next, [], "baseline");
    const items = fresh
      .map((f) => {
        const around = strip(r.text.slice(f.index, f.index + 4000), 1500);
        const url = source.listing.link ? source.listing.link.replace("{id}", f.id) : new URL(f.id.startsWith("/") ? f.id : source.url, source.url).href;
        return { key: f.id, url, title: `${source.name}: new post`, published: null, excerpt: around };
      })
      .filter((i) => passesFilter(source, i.excerpt));
    return done(next, items, items.length ? "changed" : "unchanged");
  }

  if (source.method === "redirect") {
    let r;
    try {
      r = await fetcher.get(source.url, { types: ["text/html", "application/xhtml+xml"], minDelaySeconds });
    } catch (error) {
      // A 404 is a valid answer for an edition probe: not there yet.
      if (error.code === "not_found") return done({ target: "404" }, [], state.target === "404" || !state.target ? "unchanged" : "changed");
      throw error;
    }
    const target = r.url;
    const next = { target, hash: pageHashOf(mainText(r.text)) };
    if (first || target === state.target) return done(next, [], first ? "baseline" : "unchanged");
    return done(next, [{ key: `${source.id}@${target}`, url: target, title: `${source.name}: now ${new URL(target).pathname}`, published: null, excerpt: keywordExcerpt(r.text, source) }], "changed");
  }

  throw new Error(`unknown method ${source.method}`);
}
