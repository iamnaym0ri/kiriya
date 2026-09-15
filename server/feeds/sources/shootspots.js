// Singapore shoot-spot cards for dress-up: one verified spot a week from the static pool in
// server/content/shootSpots.js. No network access: the pool was verified by hand against NParks,
// Gardens by the Bay and PUB pages (their terms do not allow automated monitoring), and every
// quote is served with its official source link.
import { SHOOT_SPOTS } from "../../content/shootSpots.js";
import { FeedError } from "../config.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, VOICEBANKS } from "./tags.js";

const DAY_MS = 86400000;
// Weeks start on Monday in Singapore; 2026-01-05 is a Monday.
const EPOCH = Date.UTC(2026, 0, 5);
export const STALE_AFTER_DAYS = 180;

const hostOf = (url) => new URL(url).hostname.toLowerCase();
const spotUrls = (spot) => [spot.officialUrl, spot.status?.sourceUrl, spot.permit?.sourceUrl, spot.rulesSourceUrl].filter(Boolean);
export const SHOOT_SPOT_HOSTS = [...new Set(SHOOT_SPOTS.flatMap((spot) => spotUrls(spot).map(hostOf)))].sort();

function dayIndex(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ""));
  if (!m) throw new FeedError("invalid_day");
  return Math.floor((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EPOCH) / DAY_MS);
}
export const weekIndex = (day) => Math.floor(dayIndex(day) / 7);

/** Spots still inside the re-verification window on `day`, in pool order. */
export function servableSpots(day, pool = SHOOT_SPOTS) {
  const today = dayIndex(day) * DAY_MS + EPOCH;
  return pool.filter(
    (spot) =>
      spot.status?.state !== "closed" &&
      Number.isFinite(Date.parse(spot.verifiedAt)) &&
      today - Date.parse(spot.verifiedAt) <= STALE_AFTER_DAYS * DAY_MS,
  );
}

/** The spot featured for the Singapore week containing `day`. */
export function spotForDay(day, pool = SHOOT_SPOTS) {
  const servable = servableSpots(day, pool);
  if (!servable.length) return null;
  const week = weekIndex(day);
  return servable[((week % servable.length) + servable.length) % servable.length];
}

export function spotItem(spot) {
  const characters = spot.goodFor.filter((tag) => Object.hasOwn(CHARACTER_ALIASES, tag));
  const links = [
    { kind: "source", label: "permit rules (official)", url: spot.permit.sourceUrl },
    ...(spot.rulesSourceUrl && spot.rulesSourceUrl !== spot.permit.sourceUrl
      ? [{ kind: "source", label: "visitor rules (official)", url: spot.rulesSourceUrl }]
      : []),
    ...(spot.status?.sourceUrl && ![spot.permit.sourceUrl, spot.rulesSourceUrl].includes(spot.status.sourceUrl)
      ? [{ kind: "source", label: "opening hours (official)", url: spot.status.sourceUrl }]
      : []),
  ];
  return {
    source: "shootspots",
    nativeId: spot.id,
    sections: ["dressup"],
    kind: "spot",
    title: `shoot spot: ${spot.name}`.slice(0, 200),
    url: spot.officialUrl,
    credit: { name: spot.organisation, platform: "official guidance" },
    tags: {
      characters,
      fandoms: spot.goodFor.filter((tag) => Object.hasOwn(FANDOM_ALIASES, tag)),
      voicebanks: characters.filter((tag) => VOICEBANKS.includes(tag)),
      formats: ["photoshoot"], // COSPLAY_FORMATS
    },
    facts: {
      excerpts: [spot.permit.quote, ...spot.rules].slice(0, 3),
      names: [spot.name, spot.area].map((n) => n.slice(0, 100)),
      links,
      venue: spot.name.slice(0, 200),
      city: "Singapore",
      lang: "en",
    },
    safety: { rating: "g" },
    publishedAt: spot.verifiedAt,
  };
}

export async function fetchShootSpots(ctx) {
  const spot = spotForDay(ctx.day);
  // Stale or missing verification is a source problem for health, not an empty success.
  if (!spot) throw new FeedError("source_stale", 503);
  return { items: ctx.limits.items > 0 ? [spotItem(spot)] : [], cursor: null, done: true };
}

export const shootSpots = {
  id: "shootspots",
  stage: "fetch-a",
  status: "enabled",
  sections: ["dressup"],
  hosts: SHOOT_SPOT_HOSTS,
  linkHosts: SHOOT_SPOT_HOSTS,
  mediaHosts: [],
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  deletionPolicy: "none",
  maxRequests: 0, // static verified pool: any network call is a contract failure
  maxBytes: 64 * 1024,
  paceMs: 0,
  timeoutMs: 1000,
  cacheSeconds: 7 * 86400,
  attributionRequired: true,
  termsUrl: "https://www.nparks.gov.sg/terms-of-use",
  docsUrl: "https://www.nparks.gov.sg/services/apply-on-location-filming-permit",
  notes:
    "One verified Singapore spot per week (Monday-based rotation of the pool). Quotes are verbatim from NParks, Gardens by the Bay and PUB pages checked by hand on 2026-09-15; entries older than 180 days stop serving until re-verified. Link-only, no media.",
  fetch: fetchShootSpots,
};
