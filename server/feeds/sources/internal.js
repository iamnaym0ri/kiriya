// Internal sources read Neon (events and her own faves) instead of the network. They still produce
// normal feed items so safety checks, the grounded writer, seen/hide and editions all apply.
import { and, eq, inArray, sql } from "drizzle-orm";
import * as s from "../../db/schema.js";
import { addDays, zonedInstant } from "../../lib/time.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, mentions } from "./tags.js";

const daysBetweenDays = (from, to) =>
  Math.round((zonedInstant(to, 12) - zonedInstant(from, 12)) / 86400000);
const isoWeek = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-w${Math.ceil(((d - onejan) / 86400000 + onejan.getUTCDay() + 1) / 7)}`;
};
const COUNTDOWN = [30, 14, 7, 1, 0];
const TRUSTED = ["official", "listing", "owner_confirmed"];

export function eventMilestones(event, day, { hers }) {
  const out = [];
  if (!event.startsOn || !TRUSTED.includes(event.confidence)) {
    if (hers) out.push({ key: `tbc-${day.slice(0, 7)}`, label: "dates to be confirmed" });
    return out;
  }
  const until = daysBetweenDays(day, event.startsOn);
  const end = event.endsOn ?? event.startsOn;
  if (until < 0 && daysBetweenDays(day, end) >= 0) out.push({ key: `open-${isoWeek(day)}`, label: "open now" });
  if (hers && COUNTDOWN.includes(until)) out.push({ key: `t-${until}`, label: until === 0 ? "today" : `in ${until} days` });
  if (!hers && event.tier === "sg" && until >= 0 && until <= 6) out.push({ key: "this-week", label: "this week" });
  const verified = event.lastVerifiedAt ? daysBetweenDays(new Date(event.lastVerifiedAt).toISOString().slice(0, 10), day) : null;
  if (event.dateEvidence?.verified && verified !== null && verified <= 7 && until > 0)
    out.push({ key: `dates-${event.startsOn}`, label: "dates announced" });
  return out;
}

export async function fetchEventCountdowns(ctx) {
  const events = await ctx.db
    .select()
    .from(s.events)
    .where(eq(s.events.status, "upcoming"))
    .orderBy(s.events.startsOn)
    .limit(80);
  const names = (ctx.taste?.events ?? []).map((n) => n.toLowerCase());
  const items = [];
  for (const event of events) {
    const hers = event.hers || names.some((n) => event.name.toLowerCase().includes(n));
    for (const milestone of eventMilestones(event, ctx.day, { hers })) {
      const text = `${event.name} ${event.venue ?? ""} ${(event.tags ?? []).join(" ")}`;
      const fandoms = mentions(text, FANDOM_ALIASES);
      const characters = mentions(text, CHARACTER_ALIASES);
      const sections = ["dressup"];
      if (fandoms.includes("the apothecary diaries") || characters.includes("maomao")) sections.push("maomao");
      if (fandoms.some((f) => ["vocaloid", "project sekai"].includes(f)) || characters.includes("hatsune miku")) sections.push("music");
      items.push({
        source: "events-countdown",
        nativeId: `${event.id}:${milestone.key}`,
        sections,
        kind: "event",
        title: event.name.slice(0, 200),
        url: event.url,
        credit: { name: new URL(event.url).hostname.replace(/^www\./, ""), platform: "official event page" },
        tags: { fandoms, characters, topics: ["event", milestone.label] },
        facts: {
          excerpts: event.dateEvidence?.text ? [String(event.dateEvidence.text).slice(0, 600)] : [],
          names: [event.name.slice(0, 100)],
          dates: [event.startsOn, event.endsOn].filter(Boolean),
          eventAt: event.startsOn ? zonedInstant(event.startsOn, 0).toISOString() : null,
          eventEndAt: event.endsOn ? zonedInstant(event.endsOn, 23, 59).toISOString() : null,
          datePrecision: event.startsOn ? "day" : null,
          venue: (event.venue ?? "").slice(0, 200),
          city: (event.city ?? "").slice(0, 100),
          eventId: event.id.slice(0, 120),
          links: [{ kind: "official", label: "event page", url: event.url }],
        },
        publishedAt: new Date(`${ctx.day}T00:00:00+08:00`).toISOString(),
        expiresAt: zonedInstant(addDays(ctx.day, milestone.key.startsWith("open-") ? 7 : 1), 0).toISOString(),
      });
    }
  }
  const offset = Number(ctx.cursor ?? 0);
  const page = items.slice(offset, offset + Math.min(8, ctx.limits.items));
  const next = offset + page.length;
  return { items: page, cursor: next < items.length ? next : null, done: next >= items.length };
}

export async function fetchFavesCreators(ctx) {
  const urls = ctx.taste?.creators ?? [];
  const month = ctx.day.slice(0, 7);
  const items = urls.map((url) => {
    const u = new URL(url);
    const handle = decodeURIComponent(u.pathname.split("/").filter(Boolean).find((p) => p !== "profile") ?? u.hostname).replace(/^@/, "");
    const platform = u.hostname.includes("tiktok") ? "TikTok" : u.hostname.includes("instagram") ? "Instagram" : "Bluesky";
    return {
      source: "faves-creators",
      nativeId: `${url}#${month}`,
      sections: ["dressup"],
      kind: "creator",
      title: `@${handle}`.slice(0, 200),
      url,
      credit: { name: handle.slice(0, 200), handle: handle.slice(0, 100), platform },
      tags: { topics: ["singapore cosplay scene"] },
      facts: { names: [handle.slice(0, 100)], links: [{ kind: "source", label: `${platform} profile`, url }] },
    };
  });
  const offset = Number(ctx.cursor ?? 0);
  const page = items.slice(offset, offset + Math.min(8, ctx.limits.items));
  const next = offset + page.length;
  return { items: page, cursor: next < items.length ? next : null, done: next >= items.length };
}

export const eventsCountdown = {
  id: "events-countdown",
  stage: "fetch-a",
  internal: true,
  sections: ["dressup", "maomao", "music"],
  hosts: ["kiriya.love"],
  mediaHosts: [],
  mediaPolicy: "link_only",
  cacheSeconds: 86400,
  notes: "Milestone items from verified/owner-confirmed events in Neon (countdowns, open now, this week, dates announced, TBC).",
  fetch: fetchEventCountdowns,
};
export const favesCreators = {
  id: "faves-creators",
  stage: "fetch-a",
  internal: true,
  sections: ["dressup"],
  hosts: ["kiriya.love"],
  mediaHosts: [],
  mediaPolicy: "link_only",
  cacheSeconds: 86400,
  notes: "Link cards for creators she adds in my faves. No fetching or scraping of those platforms.",
  fetch: fetchFavesCreators,
};
