#!/usr/bin/env node
// LIVE, bounded, local-only source probe. It never touches a database, never prints credentials and
// writes a private JSON record under .data/feed-probes/. Usage:
//   node scripts/probe-feed-sources.mjs --module server/feeds/sources/danbooru.js --export danbooru [--pages 1] [--items 8]
// Credentialed adapters read their variables from the current shell only; Vercel Sensitive values are
// not available locally, so those adapters report `not_configured` here.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sourceHttp } from "../server/feeds/http.js";
import { SourcePageSchema, defineSource, validateAdapterItem } from "../server/feeds/sources/registry.js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1]]] : pairs), []),
);
if (!args.module || !args.export) {
  console.error("usage: --module <path> --export <name> [--pages 1] [--items 8] [--cursor <value>]");
  process.exit(2);
}
const mod = await import(pathToFileURL(path.resolve(args.module)).href);
const entry = defineSource(mod[args.export]);
const pages = Math.min(Number(args.pages ?? 1), 5);
const itemsPerPage = Math.min(Number(args.items ?? 8), 8);
const credentials = Object.fromEntries(
  [...entry.requiredCredentials, ...(entry.optionalCredentials ?? [])]
    .map((k) => [k, process.env[k]])
    .filter(([, v]) => v),
);
const record = { source: entry.id, startedAt: new Date().toISOString(), location: "local WSL machine (not Vercel)", pages: [], errors: [] };
if (entry.requiredCredentials.some((k) => !process.env[k])) {
  record.status = "not_configured_locally";
  console.log(`${entry.id}: required credentials are not available in this shell; skipped.`);
} else {
  const stats = {};
  const deadline = Date.now() + 240_000;
  const http = sourceHttp(entry, { deadline, stats });
  let cursor = args.cursor ?? null;
  for (let p = 0; p < pages; p++) {
    const started = Date.now();
    try {
      const raw = await entry.fetch({ day: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date()), cursor, deadline, signal: AbortSignal.timeout(240_000), run: null, limits: { items: itemsPerPage }, credentials, http });
      const page = SourcePageSchema.parse(raw);
      const valid = [], invalid = [];
      for (const item of page.items) {
        try { valid.push(validateAdapterItem(item, entry)); } catch (e) { invalid.push(e.code ?? e.message); }
      }
      record.pages.push({
        ms: Date.now() - started,
        requests: stats.requests,
        count: page.items.length,
        invalid,
        done: page.done,
        items: valid.map((i) => ({ kind: i.kind, sections: i.sections, title: i.title.slice(0, 80), url: i.url, credit: i.credit.name, media: i.media.map((m) => `${m.type}:${new URL(m.url).hostname}`), tags: i.tags, facts: { dates: i.facts.dates, sourceScore: i.facts.sourceScore, links: i.facts.links.length, sgd: i.facts.sgd, preorderUntil: i.facts.preorderUntil, releaseAt: i.facts.releaseAt, eventAt: i.facts.eventAt, airingAt: i.facts.airingAt, playback: i.facts.playback }, safety: i.safety, publishedAt: i.publishedAt })),
      });
      console.log(`${entry.id} page ${p + 1}: ${page.items.length} items (${invalid.length} invalid), ${stats.requests} requests total, ${Date.now() - started} ms`);
      for (const i of valid.slice(0, 8)) console.log(`  - [${i.kind}] ${i.title.slice(0, 70)} | ${i.credit.name.slice(0, 30)} | ${i.media.map((m) => m.type).join(",")}`);
      if (page.done) break;
      cursor = page.cursor;
    } catch (error) {
      record.errors.push({ page: p + 1, code: error.code ?? "error", message: String(error.message).slice(0, 200) });
      console.log(`${entry.id} page ${p + 1}: FAILED ${error.code ?? ""} ${String(error.message).slice(0, 160)}`);
      break;
    }
  }
  record.status = record.errors.length ? (record.pages.length ? "partial" : "failed") : "ok";
}
record.finishedAt = new Date().toISOString();
const dir = path.resolve(".data/feed-probes");
await mkdir(dir, { recursive: true });
const file = path.join(dir, `${entry.id}-${record.startedAt.replace(/[:.]/g, "-")}.json`);
await writeFile(file, JSON.stringify(record, null, 2));
console.log(`record: ${path.relative(process.cwd(), file)} (status ${record.status})`);
