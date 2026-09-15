// Adapter test harness: runs adapters through the REAL sourceHttp helper (host allowlists, content
// types, byte limits, redirects, pacing) with a recorded-fixture transport. No network access.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceHttp } from "../../server/feeds/http.js";
import { SourcePageSchema, defineSource, validateAdapterItem } from "../../server/feeds/sources/registry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/feeds");

export async function fixture(source, name) {
  return readFile(path.join(root, source, name));
}

/**
 * routes: [{ match: string | RegExp | (url) => boolean, status?, type?, file?, body?, headers?, source? }]
 * `file` is relative to scripts/fixtures/feeds/<source>/. A request with no matching route fails the
 * test, so adapters cannot silently depend on unrecorded calls.
 */
export function fixtureTransport(source, routes, calls = []) {
  return async (url, options) => {
    const href = url.href;
    const route = routes.find((r) =>
      typeof r.match === "string" ? href === r.match || href.startsWith(r.match) : r.match instanceof RegExp ? r.match.test(href) : r.match(href, options),
    );
    calls.push({ url: href, method: options.method, headers: options.headers });
    if (!route) throw new Error(`Unrecorded request in ${source} test: ${href.replace(/([?&](?:key|api_key|password)=)[^&]+/gi, "$1<redacted>")}`);
    const buffer = route.file
      ? await fixture(route.source ?? source, route.file)
      : Buffer.from(typeof route.body === "string" ? route.body : JSON.stringify(route.body ?? {}));
    if (buffer.length > options.maxBytes) {
      const { FeedError } = await import("../../server/feeds/config.js");
      throw new FeedError("response_too_large");
    }
    return {
      status: route.status ?? 200,
      headers: { "content-type": route.type ?? "application/json", ...(route.headers ?? {}) },
      buffer,
    };
  };
}

export const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

/** Runs one adapter page with fixtures and validates the page and every item exactly like `collect`. */
export async function runAdapterPage(rawEntry, { routes, cursor = null, day = "2026-09-15", items = 8, credentials = {}, calls = [] } = {}) {
  const entry = defineSource(rawEntry);
  const stats = {};
  const http = sourceHttp({ ...entry, paceMs: 0 }, {
    deadline: Date.now() + 60_000,
    stats,
    send: fixtureTransport(entry.id, routes, calls),
    lookup: publicLookup,
  });
  const raw = await entry.fetch({
    day,
    cursor,
    deadline: Date.now() + 60_000,
    signal: AbortSignal.timeout(60_000),
    run: null,
    limits: { items },
    credentials,
    http,
  });
  const page = SourcePageSchema.parse(raw);
  if (page.items.length > Math.min(8, items)) throw new Error("adapter returned too many items");
  if (!page.done && page.cursor === cursor) throw new Error("adapter did not advance its cursor");
  return { page, items: page.items.map((item) => validateAdapterItem(item, entry)), stats, calls, entry };
}

/** Runs pages until done (bounded), collecting validated items. */
export async function runAdapterAll(rawEntry, options = {}, maxPages = 12) {
  let cursor = options.cursor ?? null;
  const all = [];
  const calls = [];
  for (let i = 0; i < maxPages; i++) {
    const { page, items } = await runAdapterPage(rawEntry, { ...options, cursor, calls });
    all.push(...items);
    if (page.done) return { items: all, calls, pages: i + 1 };
    cursor = page.cursor;
  }
  throw new Error("adapter did not finish within the page bound");
}
