// One pass of the events worker. Each step is cheap and bounded; a failing step never stops the
// others. Order: heartbeat → sources due → Instagram → newsletters → the signal queue (Claude) →
// weather and trains → push delivery.
import { eq, isNull } from "drizzle-orm";
import { schema } from "../server/db/client.js";
import { localDay } from "../server/lib/time.js";
import { claudeFor } from "../server/lib/events/claude.js";
import { detect } from "../server/lib/events/detect.js";
import { politeFetcher } from "../server/lib/events/fetch.js";
import { checkGmail } from "../server/lib/events/gmail.js";
import { checkInstagram, loadBlobImage } from "../server/lib/events/instagram.js";
import { processQueue, requeuePaused } from "../server/lib/events/pipeline.js";
import { deliverEventPushes } from "../server/lib/events/push.js";
import { enabledSources } from "../server/lib/events/registry.js";
import { canSpend } from "../server/lib/events/spend.js";
import { addLogEntries, enqueueSignal, listEventRows, readKv, readMe, sha, writeKv, writeSetting } from "../server/lib/events/store.js";
import { apiClient, loadTrainAlerts, loadWeatherFeeds, weatherFor } from "../server/lib/events/weather.js";
import { describe, workerConfig } from "./config.js";

export const VERSION = "events-worker/1";
const BACKOFF_MAX_HOURS = 48;

/** Checks the sources whose time has come (at most `perTick`), queueing what changed. */
export async function checkSources(db, { fetcher, now = new Date(), perTick = 6, sources = enabledSources() } = {}) {
  const states = await Promise.all(sources.map(async (s) => ({ source: s, state: await readKv(db, `events:src:${s.id}`, {}) })));
  const due = states.filter(({ state }) => !state.nextAt || new Date(state.nextAt) <= now).sort((a, b) => (a.state.nextAt ?? "").localeCompare(b.state.nextAt ?? "")).slice(0, perTick);
  const out = [];
  for (const { source, state } of due) {
    let result;
    try {
      result = await detect(source, fetcher, state, { now: now.getTime() });
      let queued = 0;
      for (const item of result.items) {
        const { created } = await enqueueSignal(db, { origin: "crawler", sourceId: source.id, url: item.url, title: item.title, excerpt: item.excerpt, payload: { source: source.name, published: item.published }, hash: sha("crawler", source.id, item.key) });
        if (created) queued++;
      }
      const jitter = Math.round(source.every * 0.1 * Math.random());
      await writeKv(db, `events:src:${source.id}`, { ...result.state, failures: 0, status: result.outcome, nextAt: new Date(now.getTime() + (source.every + jitter) * 60_000).toISOString() });
      out.push({ id: source.id, outcome: result.outcome, queued });
    } catch (error) {
      // Blocked by robots.txt or failing: back off (doubling, up to two days) and say why.
      const failures = (state.failures ?? 0) + 1;
      const hours = Math.min(BACKOFF_MAX_HOURS, (source.every / 60) * 2 ** Math.min(failures, 4));
      await writeKv(db, `events:src:${source.id}`, { ...state, failures, status: error.code ?? "error", error: String(error.message).slice(0, 200), checkedAt: now.toISOString(), nextAt: new Date(now.getTime() + hours * 3600_000).toISOString() });
      out.push({ id: source.id, outcome: "error", error: error.code ?? "error" });
    }
  }
  return out;
}

/** The admin status list: every source with its method, last check and next one. */
export async function sourcesStatus(db, sources = enabledSources()) {
  const list = [];
  for (const s of sources) {
    const st = await readKv(db, `events:src:${s.id}`, {});
    list.push({ id: s.id, name: s.name, method: s.method, signal: s.signal, lastCheckAt: st.checkedAt ?? null, status: st.status ?? "not checked yet", nextAt: st.nextAt ?? null, error: st.error ?? null });
  }
  await writeSetting(db, "events_sources_status", { at: new Date().toISOString(), sources: list });
  return list;
}

/** Upcoming events with no dossier yet (e.g. seeded by the old weekly stage) get researched once. */
export async function queueMissingDossiers(db, { now = new Date() } = {}) {
  const today = localDay(now);
  const rows = await listEventRows(db);
  let queued = 0;
  for (const row of rows) {
    if (row.investigatedAt || row.origin === "fixture" || (row.endsOn ?? row.startsOn ?? "9999") < today) continue;
    const { created } = await enqueueSignal(db, { origin: "refresh", eventId: row.id, url: row.url, title: row.name, hash: sha("first-research", row.id) });
    if (created) queued++;
  }
  return queued;
}

/** Weather (and, on event days, trains) for upcoming dated events. Saved events get a train alert. */
export async function refreshWeather(db, { api, now = new Date(), everyMinutes = 180 } = {}) {
  const today = localDay(now);
  const last = await readKv(db, "events:weather", null);
  const rows = (await listEventRows(db)).filter((r) => r.status === "upcoming" && r.startsOn && (r.endsOn ?? r.startsOn) >= today);
  const onToday = rows.some((r) => r.startsOn <= today);
  const gap = onToday ? Math.min(30, everyMinutes) : everyMinutes;
  if (last?.at && now - new Date(last.at) < gap * 60_000) return { ran: false };
  await writeKv(db, "events:weather", { at: now.toISOString() });
  const { feeds } = await loadWeatherFeeds(api, rows, today);
  const trains = onToday || rows.some((r) => r.startsOn === localDay(new Date(now.getTime() + 86400_000))) ? await loadTrainAlerts(api).catch(() => null) : null;
  const me = await readMe(db);
  let updated = 0;
  for (const row of rows) {
    const weather = await weatherFor(row, today, feeds, { fetchedAt: now.toISOString() });
    const isOn = row.startsOn <= today;
    const transit = isOn || row.startsOn === localDay(new Date(now.getTime() + 86400_000)) ? trains : null;
    const patch = {};
    if (weather) patch.weather = weather;
    if (transit) patch.transit = transit;
    if (!Object.keys(patch).length) continue;
    // A train disruption on the day of an event she saved is worth telling her about at once.
    if (transit?.status === "disrupted" && isOn && me.saved.events[row.id]) {
      const key = sha(JSON.stringify(transit.alerts.map((a) => [a.line, a.message])));
      if (row.transit?.alertKey !== key) {
        const lines = transit.alerts.map((a) => a.line).filter(Boolean);
        await addLogEntries(db, row.id, [{ kind: "transit", title: `train delays${lines.length ? ` on the ${lines.join(", ")}` : ""}`, text: transit.alerts[0]?.message ?? "check the MRT before you go", sourceIds: [], push: "instant", big: true }], { now });
      }
      patch.transit = { ...transit, alertKey: key };
    }
    await db.update(schema.events).set(patch).where(eq(schema.events.id, row.id));
    updated++;
  }
  return { ran: true, updated, feeds: Object.keys(feeds) };
}

/** Asks the API to deliver due pushes (push keys stay in Vercel); in dry runs, nothing is sent. */
export async function deliver(db, { config, now = new Date(), post = globalThis.fetch, local = null } = {}) {
  const last = await readKv(db, "events:deliver", null);
  if (last?.at && now - new Date(last.at) < config.deliverEveryMinutes * 60_000) return { ran: false };
  await writeKv(db, "events:deliver", { at: now.toISOString() });
  if (local) return { ran: true, ...(await deliverEventPushes(db, { now, send: local })) };
  if (config.dryRun || !config.cronSecret) return { ran: false, reason: config.dryRun ? "dry run: pushes are not sent" : "no CRON_SECRET" };
  const response = await post(`${config.apiOrigin}/api/jobs/events/deliver`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.cronSecret}`, "content-type": "application/json", "x-kw": "1" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(60_000),
  });
  return { ran: true, status: response.status, ...(response.ok ? await response.json() : {}) };
}

/**
 * One tick. `deps` lets tests replace the network: `send` (web transport), `responder` (Claude),
 * `instagram`/`gmail` overrides, `post` (delivery HTTP), `localDeliver` (a fake push sender).
 */
export async function tick(db, deps = {}) {
  const now = deps.now ?? new Date();
  const config = deps.config ?? workerConfig();
  const report = { at: now.toISOString() };
  const step = async (name, fn) => {
    try {
      report[name] = await fn();
    } catch (error) {
      report[name] = { error: String(error.code ?? error.message).slice(0, 160) };
    }
  };
  const fetcher = politeFetcher({ db, send: deps.send, now: deps.clock ?? (() => Date.now()) });
  const api = apiClient({ send: deps.send });
  const claude = claudeFor(db, { responder: deps.responder ?? null, dryRun: deps.responder ? true : config.dryRun, now: () => now });

  await step("dossiers", () => queueMissingDossiers(db, { now }));
  await step("sources", () => checkSources(db, { fetcher, now, perTick: config.sourcesPerTick }));
  await step("instagram", () => checkInstagram(db, { now, send: deps.send, ...(deps.instagram ?? {}) }));
  await step("gmail", () => checkGmail(db, { now, send: deps.send, ...(deps.gmail ?? {}) }));
  await step("requeued", async () => requeuePaused(db, await canSpend(db, "investigate", { now })));
  await step("queue", () => processQueue(db, claude, { limit: config.signalsPerTick, now: () => now, loadImage: deps.loadImage ?? loadBlobImage, log: deps.log }));
  await step("weather", () => refreshWeather(db, { api, now, everyMinutes: config.weatherEveryMinutes }));
  await step("deliver", () => deliver(db, { config, now, post: deps.post, local: deps.localDeliver ?? null }));
  await step("status", async () => (await sourcesStatus(db)).length);
  const pending = await db.select({ id: schema.eventLog.id }).from(schema.eventLog).where(isNull(schema.eventLog.pushedAt)).limit(50);
  await writeSetting(db, "events_worker", { lastTickAt: now.toISOString(), version: VERSION, ...describe(), pendingPushes: pending.length, last: summarise(report) });
  return report;
}

const summarise = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? `${v.length} checked` : v]));

