// The worker's only way onto the web. Every fetch goes: blocked-host list → robots.txt (cached a day,
// our token and Anthropic's) → per-host pacing (robots Crawl-delay, at least 2 s) → the bounded,
// SSRF-safe client of the feeds pipeline (server/feeds/http.js) with an honest user agent.
import { sourceHttp } from "../../feeds/http.js";
import { blockedHost } from "./registry.js";
import { AGENT_TOKENS, USER_AGENT, robotsVerdict } from "./robots.js";
import { readKv, writeKv } from "./store.js";

const ROBOTS_TTL_MS = 24 * 3600_000;
const ROBOTS_RETRY_MS = 6 * 3600_000;
const MIN_GAP_MS = 2000;

export class PoliteError extends Error {
  constructor(code, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
  }
}

/**
 * A fetcher bound to one worker run. `send` replaces the network (tests pass recorded responses).
 * Returns `{get(url, opts), robots(url), stats}`; `get` resolves to
 * `{status, notModified, url, headers, text, contentType}`.
 */
export function politeFetcher({ db, send, lookup, deadline = Date.now() + 10 * 60_000, signal, now = () => Date.now(), tokens = AGENT_TOKENS } = {}) {
  const lastAt = new Map();
  const delays = new Map();
  const stats = { requests: 0, blocked: 0, robotsDenied: 0 };

  const client = (host, paceMs) =>
    sourceHttp(
      { id: `events-${host}`, hosts: [host], mediaHosts: [host], maxRequests: 1_000, maxBytes: 3 * 1024 * 1024, paceMs: 0, timeoutMs: 20_000 },
      { deadline, signal, send, lookup },
    );

  async function pace(host) {
    const gap = Math.max(MIN_GAP_MS, (delays.get(host) ?? 0) * 1000);
    const wait = (lastAt.get(host) ?? 0) + gap - now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt.set(host, now());
  }

  async function robotsRecord(host) {
    const key = `events:robots:${host}`;
    const cached = await readKv(db, key, null);
    const fresh = cached && now() - Date.parse(cached.fetchedAt) < (cached.status >= 200 && cached.status < 300 || cached.status === 404 ? ROBOTS_TTL_MS : ROBOTS_RETRY_MS);
    if (fresh) return cached;
    let record;
    try {
      await pace(host);
      stats.requests++;
      const r = await client(host).request(`https://${host}/robots.txt`, { as: "text", types: ["text/plain", "text/html", "application/octet-stream"], headers: { "user-agent": USER_AGENT } });
      record = { status: r.status, text: r.buffer.toString("utf8").slice(0, 500 * 1024), fetchedAt: new Date(now()).toISOString() };
    } catch (error) {
      const status = error.code === "not_found" ? 404 : error.code === "blocked" ? 403 : error.code === "unexpected_content_type" ? 200 : error.code?.startsWith?.("source_http_") ? Number(error.code.slice(12)) : 0;
      // A robots.txt served with an odd content type still counts as present but rule-less.
      record = { status, text: "", fetchedAt: new Date(now()).toISOString(), error: error.code ?? "error" };
    }
    await writeKv(db, key, record);
    return record;
  }

  /** The robots verdict for a URL (after the blocked-host check). */
  async function robots(url) {
    const blocked = blockedHost(url);
    if (blocked) return { allowed: false, reason: `blocked_host: ${blocked.reason}` };
    const host = new URL(url).hostname.toLowerCase();
    const verdict = robotsVerdict(await robotsRecord(host), url, tokens);
    if (verdict.crawlDelay) delays.set(host, verdict.crawlDelay);
    return verdict;
  }

  async function get(url, { types, etag = null, lastModified = null, minDelaySeconds = 0 } = {}) {
    const blocked = blockedHost(url);
    if (blocked) {
      stats.blocked++;
      throw new PoliteError("blocked_host", blocked.reason);
    }
    const verdict = await robots(url);
    if (!verdict.allowed) {
      stats.robotsDenied++;
      throw new PoliteError("robots_denied", verdict.reason);
    }
    const host = new URL(url).hostname.toLowerCase();
    if (minDelaySeconds) delays.set(host, Math.max(delays.get(host) ?? 0, minDelaySeconds));
    await pace(host);
    stats.requests++;
    const headers = { "user-agent": USER_AGENT };
    if (etag) headers["if-none-match"] = etag;
    if (lastModified) headers["if-modified-since"] = lastModified;
    const r = await client(host).request(url, { as: "text", types, headers, allowNotModified: Boolean(etag || lastModified) });
    const header = (name) => {
      const v = r.headers?.[name];
      return Array.isArray(v) ? v[0] : (v ?? null);
    };
    return {
      status: r.notModified ? 304 : r.status,
      notModified: Boolean(r.notModified),
      url: r.url ?? url,
      etag: header("etag"),
      lastModified: header("last-modified"),
      contentType: r.contentType ?? null,
      buffer: r.buffer,
      text: r.notModified ? "" : r.buffer.toString("utf8"),
    };
  }

  /** A picture (JPEG, PNG or WebP, at most 4 MB), under the same rules as a page. */
  async function image(url) {
    const blocked = blockedHost(url);
    if (blocked) {
      stats.blocked++;
      throw new PoliteError("blocked_host", blocked.reason);
    }
    const verdict = await robots(url);
    if (!verdict.allowed) {
      stats.robotsDenied++;
      throw new PoliteError("robots_denied", verdict.reason);
    }
    const host = new URL(url).hostname.toLowerCase();
    await pace(host);
    stats.requests++;
    const r = await client(host).request(url, { as: "image", headers: { "user-agent": USER_AGENT } });
    return { url: r.url ?? url, contentType: r.contentType, buffer: r.buffer };
  }

  return { get, image, robots, stats };
}
