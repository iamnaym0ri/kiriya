import { request as httpsRequest } from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { XMLParser } from "fast-xml-parser";
import { FeedError } from "./config.js";

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      // 192.168/16, 192.0.0/24 (protocol assignments), 192.0.2/24 (TEST-NET-1) — not all of
      // 192.0/16, which includes public hosting (e.g. WordPress VIP on 192.0.66.x).
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      // 198.18/15 (benchmarking) and 198.51.100/24 (TEST-NET-2).
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return (
    isIP(address) === 6 &&
    /^[23]/i.test(address) &&
    !/^2001:(?:0:|db8:|10:|20:)|^2002:/i.test(address)
  );
}
export function allowedUrl(value, hosts) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new FeedError("invalid_source_url");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    !hosts.includes(u.hostname.toLowerCase()) ||
    isIP(u.hostname.replace(/[\[\]]/g, ""))
  )
    throw new FeedError("source_host_denied");
  return u;
}

// Resolve and pin a public address for this connection, including every redirect. No open proxy.
async function transport(
  url,
  { method, headers, body, signal, maxBytes, lookup = dnsLookup },
) {
  let abort;
  const aborted = new Promise((_, reject) => {
    abort = () => reject(new FeedError("source_timeout", 503));
    signal.addEventListener("abort", abort, { once: true });
  });
  let addresses;
  try {
    signal.throwIfAborted();
    addresses = await Promise.race([
      lookup(url.hostname, { all: true, verbatim: true }),
      aborted,
    ]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new FeedError("private_destination");
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method,
        headers,
        signal,
        agent: false,
        lookup: (_host, options, callback) =>
          options.all
            ? callback(null, addresses)
            : callback(null, addresses[0].address, addresses[0].family),
      },
      (res) => {
        if (Number(res.headers["content-length"] || 0) > maxBytes) {
          res.destroy();
          reject(new FeedError("response_too_large"));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy(new FeedError("response_too_large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Response kinds. Text covers RSS/Atom/XML/HTML/plain documents read by feed adapters; binary is for
// bounded moving-media inspection and saved copies. Callers may only narrow these type lists.
const STILL_TYPES = ["image/png", "image/jpeg", "image/webp"];
const TEXT_TYPES = [
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "application/json",
];
const BINARY_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "video/mp2t",
  "video/iso.segment",
  // Only accepted when a caller lists it explicitly (HLS segments served generically).
  "application/octet-stream",
];
export const MEDIA_LIMITS = { still: 4 * 1024 * 1024, binary: 8 * 1024 * 1024 };
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
});

export function sourceHttp(
  entry,
  { deadline, signal, stats = {}, send = transport, lookup } = {},
) {
  let previous = 0;
  stats.requests ??= 0;
  async function wait(ms) {
    if (Date.now() + ms + 250 >= deadline) throw new FeedError("deadline", 409);
    if (ms > 0) await sleep(ms, undefined, { signal });
  }
  async function request(
    value,
    {
      method = "GET",
      body,
      headers = {},
      media = false,
      as = media ? "image" : "json",
      types,
      maxBytes,
      allowNotModified = false,
    } = {},
  ) {
    if (!["json", "text", "image", "binary"].includes(as))
      throw new FeedError("invalid_response_kind");
    const mediaRequest = as === "image" || as === "binary";
    const allowedTypes =
      as === "image"
        ? STILL_TYPES
        : as === "binary"
          ? (types ?? []).filter((t) => BINARY_TYPES.includes(t))
          : as === "text"
            ? (types ?? TEXT_TYPES).filter((t) => TEXT_TYPES.includes(t))
            : null;
    if (as === "binary" && !allowedTypes.length)
      throw new FeedError("binary_types_required");
    const limit =
      as === "image"
        ? MEDIA_LIMITS.still
        : as === "binary"
          ? Math.min(maxBytes ?? MEDIA_LIMITS.binary, MEDIA_LIMITS.binary)
          : Math.min(maxBytes ?? entry.maxBytes, entry.maxBytes);
    const hosts = mediaRequest ? entry.mediaHosts : entry.hosts;
    let url = allowedUrl(value, hosts);
    let redirects = 0,
      retries = 0;
    while (true) {
      if (stats.requests >= entry.maxRequests)
        throw new FeedError("source_request_limit", 429);
      await wait(Math.max(0, previous + entry.paceMs - Date.now()));
      const remaining = deadline - Date.now();
      const timed = AbortSignal.timeout(
        Math.max(1, Math.min(remaining, entry.timeoutMs ?? 12000)),
      );
      const combined = signal ? AbortSignal.any([signal, timed]) : timed;
      stats.requests++;
      previous = Date.now();
      let result;
      try {
        result = await send(url, {
          method,
          body,
          headers: {
            "user-agent":
              "kiriya.love personal feed/1.0 (+https://kiriya.love)",
            accept: allowedTypes ? allowedTypes.join(",") : "application/json",
            ...headers,
          },
          signal: combined,
          maxBytes: limit,
          lookup,
        });
      } catch (error) {
        if (error instanceof FeedError) throw error;
        if (retries++ < 1) {
          await wait(500);
          continue;
        }
        throw new FeedError("source_unavailable", 503);
      }
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (++redirects > 2) throw new FeedError("redirect_limit");
        const next = allowedUrl(
          new URL(result.headers.location, url).href,
          hosts,
        );
        // Credentials never cross origins; POST adapters must use their direct API endpoint. Media
        // CDNs may redirect between their own listed media hosts (checked above) for plain GETs.
        const authorized = Object.keys(headers).some((h) => /^(authorization|cookie)$/i.test(h));
        if (
          method !== "GET" ||
          (next.origin !== url.origin && (!mediaRequest || authorized))
        )
          throw new FeedError("redirect_denied");
        url = next;
        continue;
      }
      if (result.status === 304 && allowNotModified)
        return {
          ...result,
          notModified: true,
          contentType: null,
          buffer: Buffer.alloc(0),
        };
      if ([401, 403].includes(result.status))
        throw new FeedError("blocked", 403);
      if ([404, 410].includes(result.status))
        throw new FeedError("not_found", 404);
      if ([429, 500, 502, 503, 504].includes(result.status) && retries++ < 1) {
        const retry = result.headers["retry-after"];
        const delay = retry
          ? /^\d+$/.test(retry)
            ? Number(retry) * 1000
            : Math.max(0, Date.parse(retry) - Date.now())
          : 1000;
        await wait(Number.isFinite(delay) ? Math.min(delay, 30000) : 1000);
        continue;
      }
      if (result.status === 429) throw new FeedError("rate_limited", 429);
      if (result.status < 200 || result.status >= 300)
        throw new FeedError(`source_http_${result.status}`, 503);
      const contentType = (result.headers["content-type"] ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (
        allowedTypes
          ? !allowedTypes.includes(contentType)
          : !/^application\/(?:[\w.-]+\+)?json$/.test(contentType)
      )
        throw new FeedError("unexpected_content_type");
      if (result.buffer.length > limit)
        throw new FeedError("response_too_large");
      return { ...result, contentType, url: url.href };
    }
  }
  async function json(url, options = {}) {
    const r = await request(url, { ...options, as: "json" });
    if (r.notModified) return { notModified: true };
    try {
      return JSON.parse(r.buffer.toString("utf8"));
    } catch {
      throw new FeedError("invalid_source_json");
    }
  }
  /** A bounded text document: {text, contentType, headers, notModified}. */
  async function text(url, options = {}) {
    const r = await request(url, { ...options, as: "text" });
    return {
      text: r.buffer.toString("utf8"),
      contentType: r.contentType,
      headers: r.headers,
      notModified: Boolean(r.notModified),
    };
  }
  /** RSS/Atom/XML parsed with entity decoding; attributes use the "@_" prefix. */
  async function xml(url, options = {}) {
    const r = await text(url, {
      types: [
        "application/rss+xml",
        "application/atom+xml",
        "application/xml",
        "text/xml",
        "text/html",
        "text/plain",
      ],
      ...options,
    });
    if (r.notModified) return { notModified: true, headers: r.headers };
    try {
      return { doc: xmlParser.parse(r.text), headers: r.headers };
    } catch {
      throw new FeedError("invalid_source_xml");
    }
  }
  return {
    stats,
    request,
    json,
    text,
    xml,
    async image(url) {
      return request(url, { as: "image" });
    },
    /** Bounded moving-media or saved-copy download. Types must be listed explicitly. */
    async binary(url, { types, maxBytes } = {}) {
      return request(url, { as: "binary", types, maxBytes });
    },
  };
}
