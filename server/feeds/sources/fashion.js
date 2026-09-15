// J-fashion looks. ACDC RAG (acdcrag.com, Shopify) was the approved lead for new arrivals, but it stays
// disabled: its terms forbid crawling and its Harajuku punk catalogue is a weak fit for her styles.
//
// Checked live on 2026-09-15 (home WSL machine, US exit, not Vercel):
// - https://acdcrag.com/robots.txt (Shopify 2026 wording) would allow product pages and JSON.
// - https://acdcrag.com/policies/terms-of-service (the /en/ path serves the same Japanese body) lists
//   among prohibited uses "（i）スパム、フィッシング、ファーム、プレテクスト、スパイダー、クローリング、スクレイピング"
//   (spam, phishing, pharming, pretexting, spidering, crawling, scraping). Terms beat robots.txt here, so
//   products.json is never requested; no ACDC data was fetched to build fixtures either.
// - Fit: research (docs/feeds/research/merch-and-fashion.md) describes the catalogue as Harajuku punk;
//   PIPELINE §5.3 wants Y2K/skater streetwear and sweet/girly, which have no feed-backed brands.
import { FeedError } from "../config.js";
import { FASHION_STYLES } from "./tags.js";

// Literal style cues for future look sources. A style is tagged only when the text says it plainly.
const STYLE_CUES = [
  ["y2k", /\by2k\b|\bheisei\s+retro\b/i],
  ["skater streetwear", /\bskater\b|\bskate\s*(?:wear|board)\b|\bstreetwear\b/i],
  ["sweet", /\bsweet\s+(?:lolita|style|fashion)\b|\bama[- ]?lolita\b|甘ロリ/i],
  ["girly", /\bgirly\b|\bgirlish\b|ガーリー/i],
];

/** FASHION_STYLES values that the text clearly names; empty when unsure. */
export function styleTopics(text) {
  const found = new Set(STYLE_CUES.filter(([, cue]) => cue.test(String(text ?? ""))).map(([style]) => style));
  return FASHION_STYLES.filter((style) => found.has(style));
}

export const acdcRagLooks = {
  id: "acdcrag-looks",
  stage: "fetch-a",
  status: "optional",
  enabled: false,
  sections: ["dressup"],
  kind: "look",
  hosts: ["acdcrag.com"],
  mediaHosts: ["cdn.shopify.com"],
  linkHosts: ["acdcrag.com"],
  requiredCredentials: [],
  maxRequests: 1,
  maxBytes: 512 * 1024,
  paceMs: 2000,
  timeoutMs: 12000,
  cacheSeconds: 86400,
  mediaPolicy: "still_only",
  copyPolicy: "link_only",
  deletionPolicy: "none",
  attributionRequired: true,
  termsUrl: "https://acdcrag.com/policies/terms-of-service",
  docsUrl: "https://acdcrag.com/agents.md",
  notes:
    "Disabled 2026-09-15 (checked from a home WSL machine, not Vercel). Terms of service, prohibited uses (i): 'スパイダー、クローリング、スクレイピング' (spidering, crawling, scraping), " +
    "which overrides the permissive Shopify robots.txt; style fit is also low (Harajuku punk vs her Y2K/skater streetwear and sweet/girly). " +
    "fetch() makes no request and fails loudly. Enabling needs ACDC's written permission, a live products.json review and real fixtures first.",
  async fetch() {
    throw new FeedError("restricted_by_source_terms", 403);
  },
};
