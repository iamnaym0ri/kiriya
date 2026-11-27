// The one place the events & merch screens get their data from (docs/refactor/PLAN.md phase 6).
//
// Until the events engine's API lands (docs/refactor/EVENTS-API.md, the events agent), the list is
// today's `events` table (GET /me/events) plus, in local development only, the sample events in
// fixtures.js; her saves and "when she last looked" are kept on this phone. When the API lands,
// point SOURCE at `apiSource` below (and match its paths and field names): the screens only ever
// talk to the hooks at the bottom of this file.
//
// An item (event or merch drop), as the screens read it. Every field but id, kind and name is
// optional; times carry their Singapore offset ("2026-11-28T10:00:00+08:00") or are plain days:
// {
//   id, kind: "con" | "fair" | "popup" | "cafe" | "concert" | "merch", name, tagline,
//   fandoms: [..], hers (one of her fandoms), big (worth an instant push), state ("cancelled"),
//   startsAt, endsAt, datesTbc, datesNote ("usually june"),
//   days: [{ date, opens: "10:00", closes: "21:00", note }],   // cons and fairs: each open day
//   hours: { opens, closes },                                    // pop-ups/cafés open every day
//   venue: { name, hall, area, address, lat, lng, directions: [{ how: "mrt"|"bus"|"walk"|"car", text }], sourceId },
//   about: { text, sourceId }, like: { text, sourceId },
//   popup: { about: { text, sourceId }, sold: { text, items: [..], sourceId } },
//   tickets: { status, summary, url, sourceId, tiers: [{ name, price: { amount, currency }, status, note, sourceId }] },
//   drop: { status, dropAt, until, price, ships, where: [{ name, url }], sourceId },   // merch
//   guests: [{ name, role, when, sourceId }], goods: [{ name, note, price, exclusive, sourceId }],
//   size: { text, sourceId }, weather: { provider, updatedAt, sourceId, days: [{ date, sky, high, low, rain, text }] },
//   tips: [{ text, sourceId }], links: [{ kind, label, url }],
//   timeline: [{ stage: "announced"|"guests"|"tickets"|"merch"|"schedule"|"day"|"after", at, title, text, sourceId }],
//   updates: [{ id, at, title, text, sourceId, stage }],
//   sources: [{ id, kind, label, url, checkedAt }],
//   image: { url, alt, credit }, createdAt, updatedAt,
// }
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.js";
import { haptic } from "../../lib/native.js";
import { sortTime } from "./eventFormat.js";

export const eventPath = (id) => `/world/events/${encodeURIComponent(id)}`;
export const eventsKey = ["me", "events-ui"];

// ---------- sample data in local development ----------
// `?fixtures=0` on any page turns the samples off for this tab (to see the empty states).
function fixturesWanted() {
  if (!import.meta.env.DEV) return false;
  try {
    const flag = new URLSearchParams(window.location.search).get("fixtures");
    if (flag === "0") sessionStorage.setItem("kiriya:dev-no-fixtures", "1");
    if (flag === "1") sessionStorage.removeItem("kiriya:dev-no-fixtures");
    return sessionStorage.getItem("kiriya:dev-no-fixtures") !== "1";
  } catch {
    return true;
  }
}
async function devFixtures() {
  if (!import.meta.env.DEV || !fixturesWanted()) return [];
  const { eventFixtures } = await import("./fixtures.js");
  return eventFixtures();
}

// ---------- today's events table ----------
function fromLegacy(event) {
  const host = (() => {
    try {
      return new URL(event.url).hostname.replace(/^www\./, "");
    } catch {
      return "the event page";
    }
  })();
  return {
    id: event.id,
    kind: "con",
    name: event.name,
    hers: Boolean(event.hers),
    startsAt: event.startsOn ?? null,
    endsAt: event.endsOn ?? event.startsOn ?? null,
    datesTbc: Boolean(event.tbc),
    venue: event.venue ? { name: event.venue, area: event.city ?? null } : null,
    links: [{ kind: "official", label: host, url: event.url }],
    sources: [{ id: "s1", kind: "official", label: host, url: event.url }],
    about: null,
    thin: true, // only the basics so far; the full write-up comes with the events engine
  };
}

const legacySource = {
  personal: "local",
  async list() {
    const [legacy, samples] = await Promise.all([api("/me/events").catch(() => ({ events: [] })), devFixtures()]);
    const real = (legacy.events ?? []).filter((e) => e.tier === "sg").map(fromLegacy);
    const seen = new Set(samples.map((s) => s.id));
    return { items: [...samples, ...real.filter((e) => !seen.has(e.id))] };
  },
  async paste({ url, eventId }) {
    try {
      return await api("/admin/events/paste", { method: "POST", body: { url, eventId } });
    } catch (error) {
      if (error?.status !== 404) throw error;
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return { status: "queued" };
      }
      throw Object.assign(new Error("the event finder isn’t switched on yet. this box starts working once it is."), { status: 404 });
    }
  },
};

// The events engine's API, once it lands (paths to be matched with docs/refactor/EVENTS-API.md).
// eslint-disable-next-line no-unused-vars
const apiSource = {
  personal: "server",
  list: () => api("/me/events/all"), // → { items, saved: [ids], lastLookedAt, lookedAt: { id: at } }
  one: (id) => api(`/me/events/${encodeURIComponent(id)}`), // → the full item
  save: (id, saved) => api(`/me/events/${encodeURIComponent(id)}/save`, { method: "POST", body: { saved } }),
  looked: (id) => api("/me/events/looked", { method: "POST", body: id ? { id } : {} }),
  paste: ({ url, eventId }) => api("/admin/events/paste", { method: "POST", body: { url, eventId } }),
  calendarUrl: (id) => `/events/${encodeURIComponent(id)}/calendar.ics`,
};

const SOURCE = legacySource;

// ---------- her saves and "last looked", kept on this phone until the API holds them ----------
const SESSION_GAP_MS = 10 * 60_000; // back after this long: a fresh "since you last looked"
const FIRST_LOOK_DAYS = 3; // the very first time, the last three days count as new

function createPersonalStore() {
  const listeners = new Set();
  let role = null;
  let state = { saved: {}, looked: { all: null, byId: {} } };
  let baseline = null; // "last looked" as it was when this visit began
  let hiddenAt = null;
  let snapshot = null;
  const key = () => `kiriya:events:v1:${role}`;
  const load = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(key()) ?? "null");
      state = raw && typeof raw === "object" ? { saved: raw.saved ?? {}, looked: { all: raw.looked?.all ?? null, byId: raw.looked?.byId ?? {} } } : { saved: {}, looked: { all: null, byId: {} } };
    } catch {
      state = { saved: {}, looked: { all: null, byId: {} } };
    }
    if (!state.looked.all) state.looked.all = new Date(Date.now() - FIRST_LOOK_DAYS * 86_400_000).toISOString();
    baseline = state.looked.all;
  };
  const persist = () => {
    try {
      localStorage.setItem(key(), JSON.stringify(state));
    } catch {
      // Private storage blocked: saves last for this visit only.
    }
  };
  const emit = () => listeners.forEach((listener) => listener());
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (role && hiddenAt && Date.now() - hiddenAt > SESSION_GAP_MS) {
        baseline = state.looked.all;
        hiddenAt = null;
        snapshot = null;
        emit();
      }
    });
  return {
    use(nextRole) {
      if (nextRole && nextRole !== role) {
        role = nextRole;
        load();
        snapshot = null;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get() {
      snapshot ??= { saved: state.saved, lookedById: state.looked.byId, baseline };
      return snapshot;
    },
    setSaved(item, on) {
      const saved = { ...state.saved };
      if (on) saved[item.id] = { at: new Date().toISOString(), item: savedCopy(item) };
      else delete saved[item.id];
      state = { ...state, saved };
      snapshot = null;
      persist();
      emit();
    },
    looked(id) {
      if (!role) return;
      const now = new Date().toISOString();
      state = id ? { ...state, looked: { ...state.looked, byId: { ...state.looked.byId, [id]: now } } } : { ...state, looked: { ...state.looked, all: now } };
      snapshot = null;
      persist();
      emit();
    },
  };
}
const personal = createPersonalStore();

// What a save keeps of an item, so it still shows if the item leaves the list.
function savedCopy(item) {
  const { id, kind, name, tagline, startsAt, endsAt, datesTbc, datesNote, days, hours, drop, hers, fandoms, tickets } = item;
  return { id, kind, name, tagline, startsAt, endsAt, datesTbc, datesNote, days, hours, drop, hers, fandoms, tickets: tickets ? { status: tickets.status } : undefined, venue: item.venue ? { name: item.venue.name, hall: item.venue.hall, area: item.venue.area } : null };
}

/** The newest change to an item: its latest update, or when it was first found. */
export function latestChange(item) {
  const times = [...(item.updates ?? []).map((u) => Date.parse(u.at)), Date.parse(item.createdAt ?? ""), Date.parse(item.updatedAt ?? "")].filter(Number.isFinite);
  return times.length ? Math.max(...times) : 0;
}

// ---------- hooks ----------
function useRole() {
  return useSession().data?.role ?? null;
}

function sortItems(items) {
  return [...items].sort((a, b) => sortTime(a) - sortTime(b) || String(a.name).localeCompare(String(b.name)));
}

/** Everything on the list, soonest first. */
export function useEventsList() {
  const role = useRole();
  const query = useQuery({
    queryKey: [...eventsKey, "list"],
    queryFn: () => SOURCE.list(),
    enabled: Boolean(role),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const items = useMemo(() => sortItems(query.data?.items ?? []), [query.data]);
  return { ...query, items };
}

/** One item, from the list straight away; the full write-up when the API serves it separately. */
export function useEvent(id) {
  const list = useEventsList();
  const fromList = list.items.find((item) => item.id === id) ?? null;
  const separate = Boolean(SOURCE.one);
  const one = useQuery({
    queryKey: [...eventsKey, "item", id],
    queryFn: () => SOURCE.one(id),
    enabled: separate && Boolean(id),
    placeholderData: fromList ?? undefined,
    staleTime: 60_000,
  });
  const item = separate ? one.data ?? fromList : fromList;
  return {
    item,
    isPending: !item && (separate ? one.isPending : list.isPending),
    isError: !item && (separate ? one.isError : list.isError),
    missing: !item && !list.isPending && !(separate && one.isPending),
    refetch: separate ? one.refetch : list.refetch,
  };
}

/** Her saves and what's new since she last looked. */
export function useEventsPersonal() {
  const role = useRole();
  personal.use(role);
  const state = useSyncExternalStore(personal.subscribe, personal.get, personal.get);
  return useMemo(() => {
    const since = (id) => {
      const one = Date.parse(state.lookedById[id] ?? "") || 0;
      const all = Date.parse(state.baseline ?? "") || 0;
      return Math.max(one, all);
    };
    return {
      saved: state.saved,
      isSaved: (id) => Boolean(state.saved[id]),
      savedCount: Object.keys(state.saved).length,
      /** "new" (found since she last looked), "updated" (changed since), or null. */
      newness(item) {
        const after = since(item.id);
        if (!after) return null;
        if (Date.parse(item.createdAt ?? "") > after) return "new";
        return latestChange(item) > after ? "updated" : null;
      },
      /** The updates she hasn't seen, newest first. `at` freezes the moment to compare against. */
      unseenUpdates(item, at = since(item.id)) {
        return (item.updates ?? []).filter((u) => Date.parse(u.at) > at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      },
      since,
    };
  }, [state]);
}

/** Save or unsave an item (a little haptic tap in the app). */
export function useToggleSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, saved }) => {
      if (SOURCE.personal === "server") return SOURCE.save(item.id, saved);
      personal.setSaved(item, saved);
      return { saved };
    },
    onMutate: ({ saved }) => haptic(saved ? "success" : "light"),
    onSettled: () => {
      if (SOURCE.personal === "server") queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

/** Marks the section (no id) or one item as looked at, after she has had a moment with it. */
export function useMarkLooked(id, { enabled = true, delay = 1200 } = {}) {
  const role = useRole();
  useEffect(() => {
    if (!enabled || !role) return undefined;
    const timer = setTimeout(() => markLooked(id), delay);
    return () => clearTimeout(timer);
  }, [id, enabled, role, delay]);
}

/** Moves "last looked" for the section (no id) or one item, now. */
export function markLooked(id) {
  if (typeof document !== "undefined" && document.hidden) return;
  if (SOURCE.personal === "server") SOURCE.looked(id).catch(() => {});
  else personal.looked(id);
}

/** Josh's paste-a-link box: hands a link to the event finder. */
export function usePasteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => SOURCE.paste(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey }),
  });
}

/** A server link to the .ics, once the API serves one (the app can't hand Calendar a blob). */
export const calendarUrl = (id) => SOURCE.calendarUrl?.(id) ?? null;

/** For the saves screen: her saves as items (live where the list still has them). */
export function useSavedItems() {
  const list = useEventsList();
  const mine = useEventsPersonal();
  const items = useMemo(() => {
    const live = new Map(list.items.map((item) => [item.id, item]));
    return sortItems(Object.entries(mine.saved).map(([id, save]) => live.get(id) ?? { ...save.item, gone: !list.isPending }));
  }, [list.items, list.isPending, mine.saved]);
  return { items, isPending: list.isPending };
}

/** Plain helper for components that need a stable callback to open an item. */
export function useOpenEvent(navigate) {
  return useCallback((id, hash = "") => navigate(`${eventPath(id)}${hash}`), [navigate]);
}
