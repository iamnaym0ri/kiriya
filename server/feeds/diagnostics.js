// Admin-only production diagnostics. Bounded, redacted, ledger-accounted probes that verify the
// deployed runtime's database target, private Blob I/O and provider credentials without touching the
// published edition, Kiriya's seen/hidden history, faves, saves or uploads. Results never include
// secrets, tokens, connection strings or private content.
import { createHash, randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { get } from "@vercel/blob";
import { migrationsFolder } from "../db/client.js";
import { blobOptions } from "../lib/blob.js";
import { feedConfig } from "./config.js";
import { checkpointRun, registerStage } from "./jobs.js";
import { rows } from "./repository.js";
import { sourceHttp } from "./http.js";
import { blobOps } from "./storage.js";
import { continuationBase } from "./orchestrate.js";

export const DIAGNOSTIC_CHECKS = ["database", "blob", "openai", "youtube", "tumblr", "bluesky"];
const fingerprint = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 10);
const redact = (text) =>
  String(text ?? "")
    .replace(/([?&](?:key|api_key|access_token|token|password)=)[^&\s]+/gi, "$1<redacted>")
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer <redacted>")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<connection-string>")
    .slice(0, 160);

function parseDb(value) {
  try {
    const u = new URL(value);
    return { host: u.hostname, database: u.pathname.slice(1) };
  } catch {
    return null;
  }
}

export function databaseTargets(environment = process.env) {
  const explicit = environment.DATABASE_URL ? parseDb(environment.DATABASE_URL) : null;
  const managed = environment.kData_DATABASE_URL ? parseDb(environment.kData_DATABASE_URL) : null;
  const normalize = (host) => host.replace(/-pooler(?=\.)/, "");
  return {
    effective: explicit ? "DATABASE_URL" : managed ? "kData_DATABASE_URL" : "none",
    explicitPresent: Boolean(environment.DATABASE_URL),
    explicitParseable: Boolean(explicit),
    managedPresent: Boolean(environment.kData_DATABASE_URL),
    sameHostAndDatabase: explicit && managed ? explicit.host === managed.host && explicit.database === managed.database : null,
    sameNeonEndpoint: explicit && managed ? normalize(explicit.host) === normalize(managed.host) && explicit.database === managed.database : null,
    effectiveHostFingerprint: fingerprint((explicit ?? managed)?.host ?? "none"),
  };
}

const entries = {
  youtube: { id: "diagnostic-youtube", hosts: ["www.googleapis.com"], mediaHosts: [], maxRequests: 2, maxBytes: 256 * 1024, paceMs: 0, timeoutMs: 10000 },
  tumblr: { id: "diagnostic-tumblr", hosts: ["api.tumblr.com"], mediaHosts: [], maxRequests: 1, maxBytes: 512 * 1024, paceMs: 0, timeoutMs: 10000 },
  bluesky: { id: "diagnostic-bluesky", hosts: ["bsky.social"], mediaHosts: [], maxRequests: 2, maxBytes: 512 * 1024, paceMs: 0, timeoutMs: 10000 },
};

async function timed(fn) {
  const started = Date.now();
  try {
    return { ...(await fn()), ms: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error.code ?? error.name ?? "error", detail: redact(error.message), ms: Date.now() - started };
  }
}

async function checkDatabase(db) {
  const targets = databaseTargets();
  const applied = rows(await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0]?.n ?? null;
  const tracked = (await readdir(migrationsFolder)).filter((f) => f.endsWith(".sql")).length;
  const tables = rows(
    await db.execute(sql`SELECT to_regclass('public.feed_items') IS NOT NULL AS items, to_regclass('public.feed_usage') IS NOT NULL AS usage,
      to_regclass('public.saves') IS NOT NULL AS saves, to_regclass('public.events') IS NOT NULL AS events`),
  )[0];
  return { ok: applied === tracked && Object.values(tables).every(Boolean), targets, migrations: { applied, tracked }, tables };
}

async function checkBlob(ctx, testId) {
  const ops = await blobOps();
  if (!ops) return { ok: false, error: "not_configured" };
  const pathname = `saves/diagnostic-${testId}.png`;
  const body = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 200, g: 170, b: 230 } } }).png().toBuffer();
  const result = { ok: false, testId, pathname, steps: {} };
  try {
    await ops.put(pathname, body, "image/png");
    result.steps.put = true;
    const read = await get(pathname, { access: "private", ...blobOptions() });
    const chunks = [];
    for await (const chunk of read.stream) chunks.push(Buffer.from(chunk));
    result.steps.privateRead = Buffer.concat(chunks).equals(body);
    const base = continuationBase();
    if (base) {
      const anonymous = await fetch(`${base}/api/uploads/media?path=${encodeURIComponent(pathname)}`, { signal: AbortSignal.timeout(10000) });
      result.steps.anonymousRejected = anonymous.status === 401;
      result.steps.anonymousStatus = anonymous.status;
    }
  } finally {
    try {
      await ops.del(pathname);
      result.steps.deleted = (await ops.head(pathname)) === null;
    } catch (error) {
      result.steps.deleted = false;
      result.cleanupError = redact(error.message);
    }
  }
  result.ok = Boolean(result.steps.put && result.steps.privateRead && result.steps.deleted && result.steps.anonymousRejected !== false);
  return result;
}

async function checkOpenAi(ctx, nonce) {
  const config = feedConfig();
  if (!config.apiKey) return { ok: false, error: "not_configured" };
  const spent = rows(
    await ctx.db.execute(sql`SELECT coalesce(sum(charged_micros),0)::bigint AS micros FROM feed_usage WHERE purpose LIKE 'diagnostic%' AND month=${ctx.build.day.slice(0, 7)}`),
  )[0];
  if (Number(spent.micros) >= config.diagnosticsAllowanceMicros) return { ok: false, error: "diagnostics_allowance_used" };
  const image = `data:image/png;base64,${(await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 186, g: 160, b: 220 } } }).png().toBuffer()).toString("base64")}`;
  const out = { steps: {} };
  const step = async (name, fn) => {
    try {
      const value = await fn();
      out.steps[name] = { ok: true, ...(value?.colour ? { colour: String(value.colour).slice(0, 20) } : {}), ...(typeof value?.flagged === "boolean" ? { flagged: value.flagged } : {}) };
    } catch (error) {
      out.steps[name] = { ok: false, error: error.code ?? "error" };
    }
  };
  await step("moderation", () => ctx.provider.moderateText(nonce, "a lilac flower drawing"));
  await step("primaryModel", () => ctx.provider.probe({ key: `${nonce}:primary`, model: config.model }));
  await step("fallbackModel", () => ctx.provider.probe({ key: `${nonce}:fallback`, model: config.fallbackModel }));
  await step("vision", () => ctx.provider.probe({ key: `${nonce}:vision`, model: config.model, image }));
  out.models = { primary: config.model, fallback: config.fallbackModel };
  out.ok = Object.values(out.steps).every((s) => s.ok);
  return out;
}

async function checkYouTube(ctx) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };
  const http = sourceHttp(entries.youtube, { deadline: ctx.deadline });
  const channel = await http.json(`https://www.googleapis.com/youtube/v3/channels?part=id&id=UCdMGYXL38w6htx6Yf9YJa-w&key=${encodeURIComponent(key)}`);
  const video = await http.json(`https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=l1UOPIr76CA&key=${encodeURIComponent(key)}`);
  const v = video.items?.[0];
  const restriction = v?.contentDetails?.regionRestriction;
  const regionOk = !restriction || (restriction.allowed ? restriction.allowed.includes("SG") : !(restriction.blocked ?? []).includes("SG"));
  return {
    ok: Boolean(channel.items?.length && v),
    channelFound: Boolean(channel.items?.length),
    sampleVideo: v ? { embeddable: Boolean(v.status?.embeddable), regionEvaluable: true, regionOkSG: regionOk, ageRestricted: v.contentDetails?.contentRating?.ytRating === "ytAgeRestricted" } : null,
    quotaUnits: 2,
  };
}

async function checkTumblr(ctx) {
  const key = process.env.TUMBLR_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };
  const http = sourceHttp(entries.tumblr, { deadline: ctx.deadline });
  const response = await http.json(`https://api.tumblr.com/v2/tagged?tag=maomao&limit=1&api_key=${encodeURIComponent(key)}`);
  return { ok: response.meta?.status === 200, apiStatus: response.meta?.status ?? null, items: Array.isArray(response.response) ? response.response.length : null };
}

async function checkBluesky(ctx) {
  const identifier = process.env.BLUESKY_HANDLE, password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return { ok: false, error: "not_configured" };
  const http = sourceHttp(entries.bluesky, { deadline: ctx.deadline });
  const session = await http.json("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
    headers: { "content-type": "application/json" },
  });
  if (!session.accessJwt) return { ok: false, error: "session_missing" };
  const search = await http.json("https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=maomao&limit=1", {
    headers: { authorization: `Bearer ${session.accessJwt}`, "atproto-proxy": "did:web:api.bsky.app#bsky_appview" },
  });
  return { ok: Array.isArray(search.posts), sessionCreated: true, searchResults: Array.isArray(search.posts) ? search.posts.length : null, writes: "none" };
}

export async function runDiagnostics(ctx) {
  const results = { ...(ctx.run.checkpoint.results ?? {}) };
  const nonce = ctx.run.checkpoint.nonce ?? randomUUID();
  const testId = ctx.run.checkpoint.testId ?? `${ctx.build.day}-${nonce.slice(0, 8)}`;
  const selected = ctx.run.checkpoint.checks ?? DIAGNOSTIC_CHECKS;
  let index = ctx.run.checkpoint.index ?? 0;
  results.execution = {
    location: process.env.VERCEL ? `vercel ${process.env.VERCEL_ENV ?? ""} ${process.env.VERCEL_REGION ?? ""}`.trim() : "local",
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    startedAt: results.execution?.startedAt ?? new Date().toISOString(),
  };
  while (index < selected.length) {
    if (Date.now() + 30000 > ctx.deadline) return false;
    const name = selected[index];
    const check = { database: () => checkDatabase(ctx.db), blob: () => checkBlob(ctx, testId), openai: () => checkOpenAi(ctx, nonce), youtube: () => checkYouTube(ctx), tumblr: () => checkTumblr(ctx), bluesky: () => checkBluesky(ctx) }[name];
    results[name] = check ? await timed(check) : { ok: false, error: "unknown_check" };
    index++;
    await checkpointRun(ctx.db, ctx.run, { index, nonce, testId, checks: selected, results });
  }
  results.execution.finishedAt = new Date().toISOString();
  await checkpointRun(ctx.db, ctx.run, { index, nonce, testId, checks: selected, results });
  return true;
}

registerStage("diagnostics", (ctx) => runDiagnostics(ctx));
