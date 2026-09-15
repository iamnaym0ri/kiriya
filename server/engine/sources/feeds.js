// News feeds that reliably answer a server (checked 2026-09-14). Each item keeps only a title, a link
// and a short excerpt; the site always links back to the original.
import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { getText } from "../../lib/http.js";

export const FEEDS = [
  {
    source: "Anime News Network",
    url: "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w",
    route: [
      { category: "apothecary", match: /apothecary diaries|kusuriya|maomao/i },
      { category: "vocaloid", match: /hatsune miku|vocaloid|project sekai|magical mirai|kagamine|crypton/i },
      { category: "cosplay", match: /cosplay/i },
    ],
  },
  { source: "Crypton (piapro blog)", url: "https://blog.piapro.net/feed", route: [{ category: "vocaloid", match: /./ }], language: "ja" },
  { source: "r/Vocaloid", url: "https://www.reddit.com/r/Vocaloid/top/.rss?t=day", route: [{ category: "vocaloid", match: /miku|rin|len|kagamine|sekai/i }], exclude: /nsfw|spoiler/i },
  { source: "Anime Corner", url: "https://animecorner.me/category/cosplay/feed/", route: [{ category: "cosplay", match: /cosplay/i }] },
  { source: "Kamui Cosplay", url: "https://www.kamuicosplay.com/feed/", route: [{ category: "cosplay", match: /./ }] },
  { source: "Pointe Magazine", url: "https://pointemagazine.com/feed/", route: [{ category: "ballet", match: /./ }] },
  { source: "Dance Magazine", url: "https://www.dancemagazine.com/feed/", route: [{ category: "ballet", match: /ballet|pointe|nutcracker|swan lake|giselle/i }] },
  { source: "Colossal", url: "https://www.thisiscolossal.com/feed/", route: [{ category: "art", match: /./ }] },
  { source: "Parka Blogs", url: "https://www.parkablogs.com/rss.xml", route: [{ category: "art", match: /procreate|drawing|sketch|illustrat|art book|ipad/i }] },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "text", cdataPropName: false });

const text = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.text ?? value["#text"] ?? "";
};

function stripHtml(html) {
  return text(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linkOf(entry) {
  if (typeof entry.link === "string") return entry.link;
  if (Array.isArray(entry.link)) return entry.link.find((l) => l.rel === "alternate")?.href ?? entry.link[0]?.href;
  return entry.link?.href ?? entry.guid?.text ?? null;
}

export async function fetchFeed(feed) {
  const xml = await getText(feed.url, { timeoutMs: 15_000 });
  const doc = parser.parse(xml);
  const rawItems = doc.rss?.channel?.item ?? doc.feed?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .map((entry) => {
      const title = stripHtml(entry.title);
      const url = linkOf(entry);
      const summary = stripHtml(entry.description ?? entry.summary ?? entry.content ?? "")
        .replace(/\s*submitted by\s+\/u\/.*$/i, "")
        .slice(0, 420);
      const date = entry.pubDate ?? entry.published ?? entry.updated ?? entry["dc:date"];
      const blob = `${title} ${summary}`;
      if (!title || !url) return null;
      if (feed.exclude?.test(blob)) return null;
      const route = feed.route.find((r) => r.match.test(blob));
      if (!route) return null;
      return {
        id: `feed:${createHash("sha1").update(url).digest("base64url").slice(0, 16)}`,
        source: feed.source,
        category: route.category,
        title,
        url,
        summary,
        publishedAt: date ? new Date(text(date)).toISOString() : null,
        data: feed.language ? { language: feed.language } : null,
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}
