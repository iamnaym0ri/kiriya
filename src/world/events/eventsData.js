// The one place the events & merch screens get their data from: the events API
// (docs/refactor/EVENTS-API.md, served by the events engine). Cards and dossiers are turned into
// one item shape here, so the screens never depend on the wire format:
//
// {
//   id, kind ("con" | "fair" | "popup" | "cafe" | "concert" | "merch" | "event"), kindLabel, name, tagline,
//   fandoms, fandomLabels, tags, hers, big, status ("upcoming" | "on_now" | "past" | "cancelled"),
//   startsAt, endsAt (ISO with +08:00, or plain days when the times aren't known), startsOn, endsOn,
//   datesTbc, dateLabel, timeLabel, days: [{ date, opens, closes, note, sourceId }],
//   venue: { name, hall, area, address, lat, lng, directions: [{ how, text, sourceId }], sourceId },
//   tickets: { status, label, from, url, opensAt, note: Claim, tiers: [{ name, price, priceLabel, status, note, sourceId }] },
//   drop (merch drops only): { dropAt, until },
//   image: { url, alt, credit }, url (official page), updatedAt, lastUpdate, unseen (count), saved,
//   ...and on a full item: about, like, highlights, datesNote, popup, links, guests, goods (merch
//   cards), size, tips, timeline, updates, sources, weather, transit, admin.
// }
// A Claim is { text, sourceIds, sourceId }.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ORIGIN, api, apiUrl } from "../../lib/api.js";
import { useSession } from "../../lib/session.js";
import { haptic } from "../../lib/native.js";

export const eventPath = (id) => `/world/events/${encodeURIComponent(id)}`;
export const merchPath = (id) => `/world/events/merch/${encodeURIComponent(id)}`;
export const MERCH_LIST = "/world/events/merch";
export const eventsKey = ["me", "events-ui"];
const enc = encodeURIComponent;

// ---------- from the wire to the item shape ----------
/** Our own media links are relative on the website; inside the app they need the API's origin. */
export function mediaUrl(url) {
  if (!url) return null;
  return url.startsWith("/api/") ? `${API_ORIGIN}${url}` : url;
}

const KINDS = new Set(["con", "fair", "popup", "cafe", "concert", "merch"]);
const dayAfter = (day) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const timeOfIso = (iso) => (typeof iso === "string" && iso.length > 10 ? iso.slice(11, 16) : null);

/**
 * A card has no day-by-day hours. For a short run with known start and end times, each day gets the
 * first day's opening and the last day's closing, so "on now", "back tomorrow" and countdowns work
 * on the list; the event's page replaces these with the real days.
 */
function roughDays(card) {
  const opens = timeOfIso(card.startsAt);
  const closes = timeOfIso(card.endsAt);
  if (!card.startsOn || !opens || !closes) return [];
  const last = card.endsOn ?? card.startsOn;
  const days = [];
  for (let d = card.startsOn; d <= last && days.length < 8; d = dayAfter(d)) days.push({ date: d, opens, closes });
  return days.length && days.at(-1).date === last ? days : [];
}

function guessHow(text = "") {
  if (/\bmrt\b|station|\bexit\b|line\b/i.test(text)) return "mrt";
  if (/\bbus(es)?\b/i.test(text)) return "bus";
  if (/taxi|drop-off|car park|parking|grab|drive/i.test(text)) return "car";
  return "walk";
}

export function fromCard(card) {
  if (!card) return null;
  const kind = KINDS.has(card.kind) ? card.kind : "event";
  const startsAt = card.startsAt ?? card.startsOn ?? null;
  const endsAt = card.endsAt ?? card.endsOn ?? null;
  const item = {
    id: card.id,
    kind,
    kindLabel: card.kindLabel,
    name: card.name,
    tagline: card.tagline ?? null,
    fandoms: card.fandoms ?? [],
    fandomLabels: card.fandomLabels ?? [],
    tags: card.tags ?? [],
    hers: Boolean(card.hers),
    big: Boolean(card.big),
    status: card.status,
    state: card.status === "cancelled" ? "cancelled" : undefined,
    startsOn: card.startsOn ?? null,
    endsOn: card.endsOn ?? null,
    startsAt,
    endsAt,
    datesTbc: Boolean(card.datesTbc) || !startsAt,
    openEnded: Boolean(card.openEnded),
    dateLabel: card.dateLabel,
    timeLabel: card.timeLabel ?? null,
    days: roughDays(card),
    venue: card.venueName ? { name: card.venueName, area: card.venueArea ?? null } : null,
    tickets: card.tickets ? { status: card.tickets.status, label: card.tickets.label ?? null, from: card.tickets.from ?? null } : null,
    merchInfo: card.merch ?? null,
    countdown: card.countdown ?? null,
    image: card.image?.url ? { ...card.image, url: mediaUrl(card.image.url) } : null,
    url: card.url ?? null,
    updatedAt: card.updatedAt ?? null,
    lastUpdate: card.lastUpdate ?? null,
    unseen: card.unseenUpdates ?? 0,
    saved: Boolean(card.saved),
    lastLookedAt: card.lastLookedAt ?? null,
    fixture: Boolean(card.fixture),
  };
  if (kind === "merch" && card.startsOn) {
    item.drop = {
      dropAt: card.startsAt ?? `${card.startsOn}T00:00:00+08:00`,
      until: card.endsOn && card.endsOn !== card.startsOn ? card.endsAt ?? `${card.endsOn}T23:59:00+08:00` : null,
    };
  }
  return item;
}

export function fromMerchCard(card) {
  if (!card) return null;
  const images = [...new Set([...(card.images ?? []), card.image].filter((u) => typeof u === "string"))].map(mediaUrl);
  return {
    ...card,
    image: images[0] ?? null,
    images,
    exclusive: card.kind === "exclusive",
    saved: Boolean(card.saved),
    event: card.event ? { ...card.event, image: card.event.image?.url ? { ...card.event.image, url: mediaUrl(card.event.image.url) } : null } : null,
    more: (card.more ?? []).map(fromMerchCard),
  };
}

export function fromDetail(detail) {
  const item = fromCard(detail);
  const d = detail.dossier ?? {};
  if (d.days?.length) item.days = d.days.map((day) => ({ date: day.date, opens: day.opens, closes: day.closes, note: day.note ?? null, sourceId: day.sourceId ?? null }));
  if (d.venue)
    item.venue = {
      ...d.venue,
      directions: (d.venue.directions ?? []).map((c) => ({ how: guessHow(c.text), text: c.text, sourceId: c.sourceId ?? null })),
    };
  item.about = d.about?.summary ?? null;
  item.like = d.about?.like ?? null;
  item.highlights = d.about?.highlights ?? [];
  item.datesNote = d.datesNote ?? null;
  item.popup = d.popup ? { about: d.popup.about ?? null, sold: d.popup.sold ?? [] } : null;
  if (d.tickets)
    item.tickets = {
      ...item.tickets,
      status: d.tickets.status ?? item.tickets?.status,
      url: d.tickets.buyUrl ?? null,
      opensAt: d.tickets.opensAt ?? null,
      note: d.tickets.note ?? null,
      tiers: d.tickets.tiers ?? [],
    };
  item.links = d.links ?? [];
  item.guests = d.guests ?? [];
  item.goods = (d.merch ?? []).map(fromMerchCard);
  item.size = d.size ?? null;
  item.tips = d.tips ?? [];
  item.timeline = detail.timeline ?? [];
  item.updates = detail.updates ?? [];
  item.sources = (detail.sources ?? []).map((s) => ({ ...s, images: (s.images ?? []).map(mediaUrl) }));
  item.weather = detail.weather ?? null;
  item.transit = detail.transit ?? null;
  item.admin = detail.admin ?? null;
  item.full = true;
  return item;
}

// ---------- this visit: what counts as new stays put while she's here ----------
// The server clears an event's "new" once she has looked at it, and everything once the section
// has been on screen. So marks don't vanish under her thumb, each visit remembers what was new when
// it began; opening an event clears just that one. Coming back after a while starts a new visit.
const VISIT_GAP_MS = 10 * 60_000;
function createVisit() {
  const listeners = new Set();
  let newness = new Map(); // id → "new" | "updated" | null
  let seenNow = new Set(); // opened during this visit
  let fresh = null; // the home block's "new since you last looked" list, as it was
  const saved = new Map(); // id → true/false while a save is on its way
  let version = 0;
  let hiddenAt = null;
  const emit = () => {
    version++;
    listeners.forEach((listener) => listener());
  };
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > VISIT_GAP_MS) {
        newness = new Map();
        seenNow = new Set();
        fresh = null;
        hiddenAt = null;
        emit();
      }
    });
  return {
    subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    version: () => version,
    newness(item) {
      if (!newness.has(item.id)) newness.set(item.id, item.unseen > 0 ? (item.lastUpdate?.kind === "new" ? "new" : "updated") : null);
      return seenNow.has(item.id) ? null : newness.get(item.id);
    },
    /** Whether it was new when this visit began (it stays in the "new" filter after she opens it). */
    wasNew(item) {
      this.newness(item);
      return Boolean(newness.get(item.id));
    },
    fresh(list) {
      fresh ??= list;
      return fresh;
    },
    seen: (id) => seenNow.has(id),
    // Opening something only dims its "new" mark: nothing she was looking at leaves the screen.
    looked(id) {
      seenNow.add(id);
      emit();
    },
    savedOverride: (id) => saved.get(id),
    setSaved(id, value) {
      if (value === undefined) saved.delete(id);
      else saved.set(id, value);
      emit();
    },
  };
}
const visit = createVisit();
const useVisitVersion = () => useSyncExternalStore(visit.subscribe, visit.version, visit.version);

// ---------- hooks ----------
const useRole = () => useSession().data?.role ?? null;

function useEventsQuery(key, path, options = {}) {
  const role = useRole();
  const { enabled = true, ...rest } = options;
  return useQuery({
    queryKey: [...eventsKey, ...key],
    queryFn: () => api(path),
    enabled: Boolean(role) && enabled,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    ...rest,
  });
}

/** The home block: next, on now, coming up, what's new, merch, counts. */
export function useEventsHome() {
  const query = useEventsQuery(["home"], "/events/home");
  const data = useMemo(() => {
    const d = query.data;
    if (!d) return null;
    return {
      next: fromCard(d.next),
      onNow: (d.onNow ?? []).map(fromCard),
      upcoming: (d.upcoming ?? []).map(fromCard),
      fresh: d.fresh ?? [],
      merch: (d.merch ?? []).map(fromMerchCard),
      counts: d.counts ?? {},
      me: d.me ?? null,
    };
  }, [query.data]);
  return { ...query, data };
}

/** Everything coming up (and on now), soonest first. `when: "past"` for what just ended. */
export function useEventsList({ when = "upcoming", enabled = true } = {}) {
  const query = useEventsQuery(["list", when], `/events?when=${when}&limit=${when === "past" ? 12 : 200}`, { enabled });
  const items = useMemo(() => (query.data?.events ?? []).map(fromCard), [query.data]);
  return { ...query, items, me: query.data?.me ?? null };
}

/** Merch and exclusives from upcoming and on-now events. */
export function useMerchList({ enabled = true } = {}) {
  const query = useEventsQuery(["merch"], "/events/merch", { enabled });
  const items = useMemo(() => (query.data?.merch ?? []).map(fromMerchCard), [query.data]);
  return { ...query, items };
}

/** Her saves: events and merch. */
export function useSavedList() {
  const query = useEventsQuery(["saved"], "/events/saved");
  const data = useMemo(() => ({ events: (query.data?.events ?? []).map(fromCard), merch: (query.data?.merch ?? []).map(fromMerchCard) }), [query.data]);
  return { ...query, ...data };
}

/** A card for `id` from any list already on this phone (lists, home), or null. */
function cachedCard(queryClient, id) {
  for (const [, data] of queryClient.getQueriesData({ queryKey: eventsKey })) {
    const cards = [...(data?.events ?? []), ...(data?.onNow ?? []), ...(data?.upcoming ?? []), ...(data?.next ? [data.next] : [])];
    const card = cards.find((e) => e?.id === id);
    if (card) return card;
  }
  return null;
}

/**
 * One event, everything about it. Shows the list's card at once while the rest arrives, and never
 * blanks: a refresh that fails or says the event is gone keeps what's on screen (`gone` says so).
 * An id that was folded into another event comes back as that event (`movedTo`).
 */
export function useEvent(id) {
  const queryClient = useQueryClient();
  const query = useEventsQuery(["item", id], `/events/${enc(id)}`, {
    enabled: Boolean(id),
    retry: (count, error) => error?.status !== 404 && count < 1,
  });
  const item = useMemo(() => {
    if (query.data?.event) return fromDetail(query.data.event);
    // A card from a list already on this phone, so the page has a head straight away.
    const card = cachedCard(queryClient, id);
    return card ? fromCard(card) : null;
  }, [query.data, queryClient, id]);
  const missing = query.error?.status === 404;
  const movedTo = query.data?.event && query.data.event.id !== id ? query.data.event.id : null;
  return {
    item,
    me: query.data?.me ?? null,
    isPending: query.isPending,
    isError: query.isError && !missing,
    missing,
    gone: missing && Boolean(item),
    movedTo,
    refetch: query.refetch,
  };
}

/** One merch piece with where it is. Starts from a card already on this phone. */
export function useMerchItem(id) {
  const queryClient = useQueryClient();
  const query = useEventsQuery(["merch-item", id], `/events/merch/${enc(id)}`, {
    enabled: Boolean(id),
    retry: (count, error) => error?.status !== 404 && count < 1,
  });
  const item = useMemo(() => {
    if (query.data?.merch) return fromMerchCard(query.data.merch);
    for (const [, data] of queryClient.getQueriesData({ queryKey: eventsKey })) {
      const lists = [data?.merch, data?.event?.dossier?.merch].filter(Array.isArray);
      for (const list of lists) {
        const card = list.find((m) => m?.id === id);
        if (card) return fromMerchCard(card);
      }
    }
    return null;
  }, [query.data, queryClient, id]);
  const missing = query.error?.status === 404;
  return {
    item,
    full: Boolean(query.data?.merch),
    isPending: query.isPending,
    isError: query.isError && !missing,
    missing,
    gone: missing && Boolean(item),
    movedTo: query.data?.merch && query.data.merch.id !== id ? query.data.merch.id : null,
    refetch: query.refetch,
  };
}

/** "new", "updated" or null for an item, steady for this visit. */
export function useNewness() {
  const version = useVisitVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((item) => visit.newness(item), [version]);
}

/** Whether an item was new when this visit began (filters keep it after she opens it). */
export function useWasNew() {
  const version = useVisitVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((item) => visit.wasNew(item), [version]);
}

/** Whether she has opened this event during this visit. */
export function useSeenNow() {
  const version = useVisitVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((id) => visit.seen(id), [version]);
}

/** The home block's list of what's new, steady for this visit. */
export function useFreshSnapshot(fresh) {
  useVisitVersion();
  return fresh ? visit.fresh(fresh) : [];
}

/** Whether something is saved, counting a tap that's still on its way. */
export function useIsSaved() {
  const version = useVisitVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((thing) => visit.savedOverride(thing.id) ?? Boolean(thing.saved), [version]);
}

/**
 * Save or unsave an event or a merch item. Her taps save; Josh's come back as a preview and change
 * nothing (`onPreview` lets the screen say so).
 */
export function useToggleSave({ onPreview } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ thing, saved, merch = false }) =>
      api(merch ? `/events/merch/${enc(thing.id)}/save` : `/events/${enc(thing.id)}/save`, { method: "POST", body: { saved } }),
    onMutate: ({ thing, saved }) => {
      visit.setSaved(thing.id, saved);
      haptic(saved ? "success" : "light");
    },
    onSuccess: (data, { thing }) => {
      if (data?.preview) {
        visit.setSaved(thing.id, undefined);
        onPreview?.();
      }
    },
    onError: (_error, { thing }) => visit.setSaved(thing.id, undefined),
    onSettled: async (data, error, { thing }) => {
      if (data?.preview || error) return;
      await queryClient.invalidateQueries({ queryKey: eventsKey });
      visit.setSaved(thing.id, undefined);
    },
  });
}

/** Moves "last looked" for the section (no id) or one event. Only her session moves it on the server. */
export function markLooked(id) {
  if (typeof document !== "undefined" && document.hidden) return;
  if (id) visit.looked(id);
  api("/events/seen", { method: "POST", body: id ? { eventId: id } : {} }).catch(() => {});
}

/** Marks one event (or the section) looked at, after she has had a moment with it. */
export function useMarkLooked(id, { enabled = true, delay = 1500 } = {}) {
  const role = useRole();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || !role) return undefined;
    const timer = setTimeout(() => {
      markLooked(id);
      // The lists' counts change for next time; what's on screen keeps what it showed.
      queryClient.invalidateQueries({ queryKey: [...eventsKey, "home"], refetchType: "none" });
      queryClient.invalidateQueries({ queryKey: [...eventsKey, "list"], refetchType: "none" });
    }, delay);
    return () => clearTimeout(timer);
  }, [id, enabled, role, delay, queryClient]);
}

// ---------- Josh's side ----------
/** The paste-a-link box: hands a link to the event finder. → { id, status, message, eventId } */
export function usePasteLink() {
  return useMutation({
    mutationFn: ({ url, note }) => api("/admin/events/links", { method: "POST", body: { url, ...(note ? { note } : {}) } }),
  });
}

export const SETTLED_LINK = new Set(["added", "updated", "not_an_event", "duplicate", "failed", "paused", "skipped"]);

/** Follows a pasted link while it's on screen. */
export function useLinkStatus(link) {
  const role = useRole();
  return useQuery({
    queryKey: ["admin", "events-link", link?.id],
    queryFn: () => api(`/admin/events/links/${enc(link.id)}`),
    enabled: role === "admin" && Boolean(link?.id) && !SETTLED_LINK.has(link?.status),
    initialData: link ?? undefined,
    refetchInterval: (q) => (SETTLED_LINK.has(q.state.data?.status) ? false : 4000),
    meta: { persist: false },
  });
}

/** Asks the event finder to look into an event again. */
export function useRefreshEvent() {
  return useMutation({ mutationFn: (id) => api(`/admin/events/${enc(id)}/refresh`, { method: "POST", body: {} }) });
}

/** The .ics link: the app opens it in Safari, which offers Add to Calendar (no session needed). */
export const calendarLink = (id) => apiUrl(`/events/${enc(id)}/calendar.ics`);
