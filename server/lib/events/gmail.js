// The newsletter inbox: a Gmail address subscribed to organiser newsletters (AFA/SOZO, SGCC, Friends
// of JCC, Eventbrite/Peatix "follow organiser" emails, mall newsletters). Read-only Gmail API access
// with an OAuth refresh token; each new newsletter that mentions events becomes a signal.
import { sourceHttp } from "../../feeds/http.js";
import { renderText } from "../../feeds/events/sources.js";
import { prefilterMatch } from "./fandoms.js";
import { enqueueSignal, readKv, sha, writeKv } from "./store.js";

const STATE_KEY = "events:gmail";
const LINK_SKIP = /unsubscribe|optout|opt-out|preferences|manage|privacy|terms|mailchimp\.com\/|list-manage\.com\/(?!track)|facebook\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com\/(?:user|channel)|mailto:/i;

const b64url = (s) => Buffer.from(String(s ?? "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

/** Subject, sender, date, visible text and links of a Gmail API `format=full` message. */
export function readMessage(message) {
  const headers = Object.fromEntries((message.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
  const parts = [];
  const walk = (p) => {
    if (!p) return;
    if (p.body?.data && /^text\/(plain|html)/.test(p.mimeType ?? "")) parts.push({ type: p.mimeType, text: b64url(p.body.data) });
    for (const child of p.parts ?? []) walk(child);
  };
  walk(message.payload);
  const html = parts.find((p) => p.type.startsWith("text/html"))?.text ?? "";
  const plain = parts.find((p) => p.type.startsWith("text/plain"))?.text ?? "";
  const text = (plain || renderText(html)).replace(/\s+/g, " ").trim();
  const links = [...new Set([...html.matchAll(/href\s*=\s*["'](https:\/\/[^"'\s>]+)["']/gi)].map((m) => m[1].replace(/&amp;/g, "&")))].filter((u) => !LINK_SKIP.test(u)).slice(0, 15);
  return { id: message.id, subject: headers.subject ?? "", from: headers.from ?? "", date: headers.date ?? null, text, links };
}

async function accessToken(http, { clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }).toString();
  const token = await http.json("https://oauth2.googleapis.com/token", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  if (!token?.access_token) throw Object.assign(new Error("gmail auth failed"), { code: "gmail_auth" });
  return token.access_token;
}

export function gmailConfig(env = process.env) {
  const c = { clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET, refreshToken: env.GMAIL_REFRESH_TOKEN, query: env.EVENTS_GMAIL_QUERY || "newer_than:7d -in:spam -in:trash" };
  return c.clientId && c.clientSecret && c.refreshToken ? c : null;
}

/** Reads new mail (when due) and queues newsletters that mention events. Returns a summary. */
export async function checkGmail(db, { config = gmailConfig(), everyMinutes = 30, now = new Date(), send, deadline = Date.now() + 2 * 60_000 } = {}) {
  if (!config) return { ran: false, reason: "no Gmail credentials" };
  const state = await readKv(db, STATE_KEY, { seen: [], lastRunAt: null });
  if (state.lastRunAt && now - new Date(state.lastRunAt) < everyMinutes * 60_000) return { ran: false, reason: "not due" };
  const http = sourceHttp({ id: "events-gmail", hosts: ["oauth2.googleapis.com", "gmail.googleapis.com"], mediaHosts: [], maxRequests: 30, maxBytes: 4 * 1024 * 1024, paceMs: 100, timeoutMs: 20_000 }, { deadline, send });
  const token = await accessToken(http, config);
  const auth = { authorization: `Bearer ${token}` };
  const list = await http.json(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(config.query)}`, { headers: auth });
  const seen = new Set(state.seen);
  let queued = 0;
  let read = 0;
  for (const { id } of list?.messages ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const message = readMessage(await http.json(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, { headers: auth }));
    read++;
    if (!prefilterMatch(message.subject, message.text)) continue;
    const { created } = await enqueueSignal(db, {
      origin: "newsletter",
      sourceId: `mail:${message.from.replace(/.*<|>.*/g, "").toLowerCase().slice(0, 80)}`,
      url: message.links[0] ?? null,
      title: message.subject.slice(0, 200),
      excerpt: message.text.slice(0, 3000),
      payload: { from: message.from, date: message.date, links: message.links },
      hash: sha("newsletter", id),
    });
    if (created) queued++;
  }
  await writeKv(db, STATE_KEY, { seen: [...seen].slice(-500), lastRunAt: now.toISOString() });
  return { ran: true, read, queued };
}
