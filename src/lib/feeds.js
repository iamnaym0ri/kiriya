// Client side of kiriya's daily feeds. Everything here is additive: when a feed is empty, still
// building, or unavailable, callers render exactly what they rendered before.
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { useSession } from "./session.js";

export const FEED_SECTIONS = ["maomao", "music", "dressup", "meme", "merch"];
export const feedKey = (section) => ["me", "feed", section];
const SG = "Asia/Singapore";

// ---------- a tiny session store (kept and locally hidden items) ----------
function createStore() {
  const listeners = new Set();
  const state = { kept: new Set(), hidden: new Set(), version: 0 };
  return {
    state,
    change(fn) {
      fn(state);
      state.version++;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
const store = createStore();
const useStoreVersion = () =>
  useSyncExternalStore(store.subscribe, () => store.state.version);

// ---------- reading ----------
export function useFeed(section, { enabled = true } = {}) {
  const session = useSession();
  const role = session.data?.role;
  const query = useQuery({
    queryKey: feedKey(section),
    queryFn: () => api(`/me/feed/${section}`),
    enabled: enabled && Boolean(role),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Morning publication changes the revision, so an open page revalidates on a short interval.
    // TanStack Query pauses interval refetches while the tab is hidden.
    refetchInterval: (q) =>
      q.state.status === "error"
        ? false
        : (q.state.data?.revalidateAfterSeconds ?? 60) * 1000,
  });
  useCatchUp(query.data, role);
  return query;
}

function sgHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: SG,
    }).format(date),
  );
}

// Her first visit after 07:00 with no fresh edition starts the next pending stage on the server.
// The request returns straight away; the page never waits for it.
function useCatchUp(feed, role) {
  const stale = feed && (!feed.revision || feed.editionDay !== feed.day);
  useEffect(() => {
    if (role !== "kiriya" || !stale || sgHour() < 7) return;
    const key = `kiriya:feed-catchup:${feed.day}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage can be blocked; the server's claim is throttled either way.
    }
    api("/me/feed/catchup", { method: "POST", body: {} }).catch(() => {});
  }, [role, stale, feed?.day]);
}

const slotIds = (slot) => [
  slot.primary.id,
  ...(slot.companions ?? []).map((c) => c.id),
];

/**
 * Display entries for one edition. On arrival: unseen slots, unseen reserve, then today's seen
 * tail. While the page stays open, positions stay put (a slide marked seen doesn't jump away);
 * a new revision starts a new order.
 */
export function useFeedEntries(feed) {
  const order = useRef({ revision: null, keys: [] });
  const version = useStoreVersion();
  return useMemo(() => {
    if (!feed?.revision) return [];
    const seenEarlier = new Set((feed.seenEarlier ?? []).map((s) => s.key));
    const all = new Map(
      [...feed.slots, ...feed.reserve, ...(feed.seenEarlier ?? [])].map(
        (slot) => [slot.key, slot],
      ),
    );
    if (order.current.revision !== feed.revision)
      order.current = { revision: feed.revision, keys: [...all.keys()] };
    else {
      const known = new Set(order.current.keys);
      order.current.keys = [
        ...order.current.keys.filter((k) => all.has(k)),
        ...[...all.keys()].filter((k) => !known.has(k)),
      ];
    }
    return order.current.keys
      .map((key) => all.get(key))
      .filter((slot) => !slotIds(slot).some((id) => store.state.hidden.has(id)))
      .map((slot) => ({ ...slot, ids: slotIds(slot), seen: seenEarlier.has(slot.key) }));
    // `version` re-filters after a local hide.
  }, [feed, version]);
}

// ---------- seen ----------
const seenQueue = new Map(); // `${section}\n${revision}` -> Set(ids)
const sent = new Set(); // `${revision}\n${id}`
const flushedListeners = new Set();
let flushTimer = null;

function postSeen(section, revision, ids, keepalive) {
  const forget = () => ids.forEach((id) => sent.delete(`${revision}\n${id}`));
  return fetch("/api/me/feed/seen", {
    method: "POST",
    keepalive,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-kw": "1",
    },
    body: JSON.stringify({ revision, ids }),
  })
    .then((response) => {
      if (!response.ok) return forget();
      flushedListeners.forEach((listener) => listener(section));
    })
    .catch(forget);
}
function flushSeen({ keepalive = false } = {}) {
  clearTimeout(flushTimer);
  flushTimer = null;
  for (const [key, set] of seenQueue) {
    const [section, revision] = key.split("\n");
    const ids = [...set];
    seenQueue.delete(key);
    for (let i = 0; i < ids.length; i += 50)
      postSeen(section, revision, ids.slice(i, i + 50), keepalive);
  }
}
if (typeof window !== "undefined") {
  const leave = () => seenQueue.size && flushSeen({ keepalive: true });
  window.addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) leave();
  });
}

/**
 * Returns `mark(ids)`. Only Kiriya's own session marks items seen: the owner's session and admin
 * previews never do, and nothing is marked while the tab is hidden or merely because it loaded.
 */
export function useMarkSeen(section, revision) {
  const role = useSession().data?.role;
  const queryClient = useQueryClient();
  useEffect(() => {
    const listener = (flushed) => {
      if (flushed === section)
        queryClient.invalidateQueries({ queryKey: feedKey(section) });
    };
    flushedListeners.add(listener);
    return () => flushedListeners.delete(listener);
  }, [queryClient, section]);
  return useCallback(
    (ids) => {
      if (role !== "kiriya" || !revision || document.hidden) return;
      const key = `${section}\n${revision}`;
      const fresh = ids.filter((id) => !sent.has(`${revision}\n${id}`));
      if (!fresh.length) return;
      if (!seenQueue.has(key)) seenQueue.set(key, new Set());
      for (const id of fresh) {
        sent.add(`${revision}\n${id}`);
        seenQueue.get(key).add(id);
      }
      if (!flushTimer) flushTimer = setTimeout(flushSeen, 2000);
    },
    [role, revision, section],
  );
}

/** A card counts as seen once at least half of it has been on screen for a second. */
export function useSeenOnView(ref, onSeen, { enabled = true } = {}) {
  const callback = useRef(onSeen);
  callback.current = onSeen;
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return;
    let timer = null,
      visible = false;
    const arm = () => {
      clearTimeout(timer);
      if (visible && !document.hidden)
        timer = setTimeout(() => {
          if (visible && !document.hidden) callback.current();
        }, 1000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.intersectionRatio >= 0.5;
        arm();
      },
      { threshold: [0, 0.5] },
    );
    const wake = () => (document.hidden ? clearTimeout(timer) : arm());
    observer.observe(node);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [ref, enabled]);
}

// ---------- keep & hide ----------
export function useKept(id) {
  useStoreVersion();
  return store.state.kept.has(id);
}

export function useKeep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api("/me/saves", { method: "POST", body: { id } }),
    onSuccess: (data, id) => {
      if (data?.preview) return;
      store.change((s) => s.kept.add(id));
      queryClient.invalidateQueries({ queryKey: ["me", "saves"] });
    },
  });
}

function withoutItem(feed, id) {
  const keep = (slot) => !slotIds(slot).includes(id);
  return {
    ...feed,
    slots: feed.slots.filter(keep),
    reserve: feed.reserve.filter(keep),
    seenEarlier: (feed.seenEarlier ?? []).filter(keep),
  };
}

export function useHide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api("/me/feed/hide", { method: "POST", body: { id } }),
    onSuccess: (data, id) => {
      if (data?.preview) return;
      store.change((s) => s.hidden.add(id));
      for (const section of FEED_SECTIONS)
        queryClient.setQueryData(feedKey(section), (old) =>
          old?.slots ? withoutItem(old, id) : old,
        );
    },
  });
}

/** A broken image or video: drop the slide now and ask the server to recheck the item. */
export function useReportGone() {
  const role = useSession().data?.role;
  return useCallback(
    (id) => {
      if (store.state.hidden.has(id)) return;
      store.change((s) => s.hidden.add(id));
      if (role === "kiriya")
        api("/me/feed/recheck", { method: "POST", body: { id } }).catch(() => {});
    },
    [role],
  );
}

// ---------- formatting ----------
export function sgDate(value, options = { day: "numeric", month: "short" }) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+08:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("en-SG", { ...options, timeZone: SG }).format(date);
}
export function sgTime(value) {
  return value
    ? new Intl.DateTimeFormat("en-SG", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: SG,
      }).format(new Date(value))
    : null;
}
const sgDayOf = (date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: SG }).format(date);
/** Whole Singapore calendar days from today until `value` (negative once it has passed). */
export function daysUntil(value, now = new Date()) {
  if (!value) return null;
  const target = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : sgDayOf(new Date(value));
  return Math.round(
    (new Date(`${target}T12:00:00Z`) - new Date(`${sgDayOf(now)}T12:00:00Z`)) / 86400000,
  );
}
export function approxSgd(facts) {
  if (facts?.sgd == null) return null;
  return `~S$${facts.sgd >= 100 ? Math.round(facts.sgd) : facts.sgd.toFixed(0)}`;
}
export function originalPrice(facts) {
  const p = facts?.priceOriginal;
  if (!p) return null;
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: p.currency === "JPY" || p.currency === "KRW" ? 0 : 2,
  }).format(p.amount);
}

export { youtubeSong } from "../../shared/feedContent.js";

export function creditLine(item) {
  const credit = item.credit ?? {};
  const who = credit.handle ? `@${credit.handle.replace(/^@/, "")}` : credit.name;
  return [who, credit.platform].filter(Boolean).join(" · ");
}
