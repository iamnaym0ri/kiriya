import { feedConfig, FeedError } from "../config.js";
import { allowedUrl } from "../http.js";
import { normalizeItem } from "../normalize.js";
import { z } from "zod";
import { LIVE_ADAPTERS } from "./index.js";

export const SourcePageSchema = z
  .object({
    items: z.array(z.unknown()).max(8),
    cursor: z
      .union([
        z.string().max(2000),
        z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      ])
      .nullable(),
    done: z.boolean(),
  })
  .strict()
  .refine((page) => page.done || page.cursor !== null);

// Conservative defaults. Every live adapter states its own verified policy explicitly; a reachable
// URL never implies permission to copy, embed moving media or skip deletion handling.
export const BASE_POLICY = {
  enabled: true,
  status: "enabled", // enabled | optional | restricted | unavailable
  fixture: false,
  maxRequests: 4,
  maxBytes: 512 * 1024,
  paceMs: 1000,
  timeoutMs: 12000,
  requiredCredentials: [],
  linkHosts: null, // defaults to hosts
  mediaPolicy: "still_only", // still_only | moving_sampled | embed_provenance | link_only
  // Owner decision (2026-09-17): an embed_provenance source may also publish uploads found by
  // keyword search, where the uploader is not known to be the creator. Off unless stated, because
  // the safety check only ever sees the thumbnail.
  searchProvenance: false,
  copyPolicy: "link_only",
  copyPermission: null, // {basis, sourceUrl, verifiedAt} when copyPolicy is private_copy
  deletionPolicy: "none", // none | recheck_before_publish | honor_deletions
  deletionDeadlineHours: null,
  cacheSeconds: 86400,
  retentionHours: null, // a storage ceiling from the source terms (e.g. Tumblr 72 h)
  attributionRequired: true,
  termsUrl: null,
  docsUrl: null,
  notes: "",
};
const PolicySchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
    stage: z.enum(["fetch-a", "fetch-b"]),
    sections: z.array(z.enum(["maomao", "music", "dressup", "meme", "merch"])).min(1),
    hosts: z.array(z.string().min(3)).min(1),
    mediaHosts: z.array(z.string()),
    mediaPolicy: z.enum(["still_only", "moving_sampled", "embed_provenance", "link_only"]),
    copyPolicy: z.enum(["link_only", "private_copy"]),
    deletionPolicy: z.enum(["none", "recheck_before_publish", "honor_deletions"]),
    status: z.enum(["enabled", "optional", "restricted", "unavailable"]),
  })
  .passthrough()
  .superRefine((entry, ctx) => {
    if (
      entry.copyPolicy === "private_copy" &&
      !(
        entry.copyPermission?.basis &&
        entry.copyPermission?.sourceUrl &&
        entry.copyPermission?.verifiedAt
      )
    )
      ctx.addIssue({ code: "custom", message: "copy permission basis required" });
    if (entry.deletionPolicy === "honor_deletions" && !entry.deletionDeadlineHours)
      ctx.addIssue({ code: "custom", message: "deletion deadline required" });
  });

export function defineSource(entry) {
  const merged = { ...BASE_POLICY, ...entry };
  PolicySchema.parse(merged);
  if (typeof merged.fetch !== "function")
    throw new FeedError("adapter_contract");
  if (merged.deletionPolicy !== "none" && typeof merged.recheck !== "function")
    throw new FeedError("deletion_check_missing");
  return merged;
}

export async function sourceRegistry({
  fixtures = feedConfig().fixtureMode,
} = {}) {
  if (fixtures) {
    if (!feedConfig().fixtureMode)
      throw new FeedError("fixtures_disabled", 403);
    const { fetchFixtures } = await import("./fixtures.js");
    return [
      {
        ...BASE_POLICY,
        id: "fixture",
        stage: "fetch-a",
        enabled: true,
        fixture: true,
        sections: ["maomao", "music", "dressup", "meme", "merch"],
        hosts: ["fixtures.kiriya.invalid"],
        mediaHosts: [],
        paceMs: 0,
        fetch: fetchFixtures,
        recheck: async () => ({ state: "present", scope: "fixture" }),
      },
    ];
  }
  return LIVE_ADAPTERS.map((entry) => defineSource(entry));
}

export function validateAdapterItem(raw, entry) {
  const item = normalizeItem(raw);
  if (
    item.source !== entry.id ||
    item.sections.some((s) => !entry.sections.includes(s))
  )
    throw new FeedError("adapter_contract");
  // Internal adapters emit owner-entered or verified event/creator URLs from Neon; the strict item
  // schema still requires credential-free HTTPS. External adapters stay on exact hosts.
  if (!entry.internal) allowedUrl(item.url, entry.hosts);
  if (item.credit.profileUrl)
    allowedUrl(item.credit.profileUrl, [
      ...entry.hosts,
      ...(entry.profileHosts ?? []),
    ]);
  for (const m of item.media) {
    allowedUrl(m.url, entry.mediaHosts);
    if (m.poster) allowedUrl(m.poster, entry.mediaHosts);
  }
  if (!entry.internal)
    for (const link of item.facts.links)
      allowedUrl(link.url, entry.linkHosts ?? entry.hosts);
  return item;
}
