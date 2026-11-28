// The private chat's data on the phone (docs/refactor/PLAN.md phase 4, RENOVATION.md round 3).
// Messages are cached by TanStack Query; sends show at once (optimistic) and are idempotent by
// clientId; live events come from Ably when configured, otherwise a light poll runs while the chat
// is open. Everything that leaves the phone is sealed and everything that arrives is opened through
// src/lib/chatCrypto.js (owned by the chat-room side); nothing here reads sealed data itself.
import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { openIncoming, sealFile, sealOutgoing } from "./chatCrypto.js";
import { forgetChat, loadChat, rememberRaw, saveChat } from "./chatCache.js";
import { uploadFile } from "./uploads.js";
import { viewingAs } from "./viewAs.js";

export const chatKey = ["me", "chat", "messages"];
export const chatPrefsKey = ["me", "chat", "prefs"];
export const chatSummaryKey = ["me", "chat", "summary"];
export const ALBUM_MAX = 10;
const CHANNEL = "kiriya-josh";
const POLL_MS = 2500;
const TYPING_EVERY_MS = 2500;
const TYPING_SHOWN_MS = 6000;

export const newClientId = () => `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 13)}`;

// Everything that arrives is opened (src/lib/chatCrypto.js) before anything renders it: pages,
// catch-ups, a send's or edit's echo, and the summary's latest message.
// The server's own copy of each is remembered for the phone's sealed cache (src/lib/chatCache.js).
const openPage = async (page) => {
  rememberRaw(page.messages);
  return { ...page, messages: await Promise.all((page.messages ?? []).map((m) => openIncoming(m))) };
};
const openOne = async (message) => {
  rememberRaw([message]);
  return openIncoming(message);
};

/** The photos and videos of a message, whichever shape it was stored in (one photo, or an album). */
export function mediaItems(message) {
  const media = message?.media;
  if (!media || (message.kind !== "image" && message.kind !== "video")) return [];
  if (Array.isArray(media.items)) return media.items;
  return [{ type: "image", ...media }];
}

/** Media as it is sent and stored: without the phone-only preview links and progress. */
function cleanMedia(media) {
  if (!media || typeof media !== "object") return media;
  const clean = ({ localUrl, progress, ...entry }) => (entry.poster ? { ...entry, poster: clean(entry.poster) } : entry); // eslint-disable-line no-unused-vars
  return Array.isArray(media.items) ? { ...media, items: media.items.map(clean) } : clean(media);
}

/** Keeps this phone's own previews of what it just sent, so the picture never flickers. */
function keepLocal(saved, local) {
  if (local?.media?.localUrl && saved?.media && !Array.isArray(saved.media.items)) return { ...saved, media: { ...saved.media, localUrl: local.media.localUrl } };
  const savedItems = saved?.media?.items;
  const localItems = local?.media?.items;
  if (!Array.isArray(savedItems) || !Array.isArray(localItems)) return saved;
  return {
    ...saved,
    media: {
      ...saved.media,
      items: savedItems.map((item, i) => {
        const mine = localItems[i];
        if (!mine?.localUrl) return item;
        return { ...item, localUrl: mine.localUrl, ...(item.poster && mine.poster?.localUrl ? { poster: { ...item.poster, localUrl: mine.poster.localUrl } } : {}) };
      }),
    },
  };
}

// ---------- the chat kept on the phone ----------

let primed = null;
let saving = 0;

/**
 * Puts the chat kept on the phone back into memory (opened) as early as possible, keeps it up to
 * date as messages come and go, and forgets it when the app locks. Safe to call from many places.
 */
export function primeChat(queryClient) {
  if (primed) return primed;
  primed = (async () => {
    const cache = queryClient.getQueryCache();
    cache.subscribe((event) => {
      if (event.query.queryHash !== JSON.stringify(chatKey)) return;
      if (event.type === "removed") return void forgetChat();
      if (event.type !== "updated" || viewingAs()) return;
      clearTimeout(saving);
      saving = setTimeout(() => saveChat(queryClient.getQueryData(chatKey)).catch(() => {}), 2000);
    });
    window.addEventListener("kiriya:locked", () => forgetChat());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden" || viewingAs()) return;
      clearTimeout(saving);
      saveChat(queryClient.getQueryData(chatKey)).catch(() => {});
    });
    // The chat screen's own code, fetched while the phone is idle, so the first tap opens it at once.
    setTimeout(() => import("../world/chat/ChatPage.jsx").catch(() => {}), 1500);
    if (viewingAs() || queryClient.getQueryData(chatKey)) return;
    const kept = await loadChat();
    if (!kept) return;
    const pages = await Promise.all(kept.pages.map(openPage));
    // Someone else signed in on this phone since, or this phone can't open them yet: start fresh.
    if (pages.some((page) => page.messages.some((m) => m.locked))) return;
    if (!queryClient.getQueryData(chatKey)) queryClient.setQueryData(chatKey, { pages, pageParams: kept.pageParams }, { updatedAt: kept.savedAt });
  })().catch(() => {});
  return primed;
}

/**
 * The newest page, fetched quietly and folded into what's shown (new messages, reactions, reads,
 * deletions); if more arrived meanwhile than one page holds, the newest page replaces the rest.
 */
export async function refreshLatest(queryClient) {
  const fresh = await api("/me/chat/messages").then(openPage);
  const data = queryClient.getQueryData(chatKey);
  const newest = newestServerAt(data);
  const oldestFresh = fresh.messages[0]?.createdAt;
  const gap = Boolean(fresh.next && oldestFresh && newest && oldestFresh > newest);
  if (!data?.pages?.length || gap || data.pages[0].me !== fresh.me) return queryClient.setQueryData(chatKey, { pages: [fresh], pageParams: [null] });
  const { messages, next: _next, ...meta } = fresh; // eslint-disable-line no-unused-vars
  mergeMessages(queryClient, messages, meta);
}

export function useChatMessages() {
  const queryClient = useQueryClient();
  // What was already in memory (kept on the phone, or from an earlier visit) shows at once; only
  // the newest page is fetched again, quietly. Older pages come as she scrolls up.
  const hadData = useRef(Boolean(queryClient.getQueryData(chatKey)));
  useEffect(() => {
    primeChat(queryClient);
    if (hadData.current) refreshLatest(queryClient).catch(() => {});
  }, [queryClient]);
  return useInfiniteQuery({
    queryKey: chatKey,
    queryFn: async ({ pageParam, signal }) => openPage(await api(`/me/chat/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`, { signal })),
    initialPageParam: null,
    getNextPageParam: (page) => page.next ?? undefined,
    staleTime: Infinity,
    refetchOnMount: false,
    // Opened words never go into the app's general cache; the sealed copy is kept by chatCache.js.
    meta: { persist: false },
  });
}

/** Oldest first, across every loaded page (page 0 is the newest). */
export const flatten = (data) => (data?.pages ?? []).slice().reverse().flatMap((page) => page.messages);
export const newestServerAt = (data) =>
  flatten(data)
    .filter((m) => !m.pending)
    .reduce((latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest), null);

/**
 * Adds or replaces messages (matching id, or the optimistic copy by clientId). New ones join the
 * newest page; a change to a message older than anything loaded is left for when it's scrolled to.
 */
export function mergeMessages(queryClient, incoming, extra = {}) {
  queryClient.setQueryData(chatKey, (data) => {
    if (!data?.pages?.length) return data;
    const pages = data.pages.map((page) => ({ ...page, messages: page.messages.slice() }));
    const oldest = pages.at(-1).messages[0]?.createdAt;
    const olderExists = Boolean(pages.at(-1).next);
    for (const message of incoming) {
      let placed = false;
      for (const page of pages) {
        const i = page.messages.findIndex((m) => m.id === message.id || (message.clientId && m.clientId === message.clientId));
        if (i >= 0) {
          page.messages[i] = keepLocal(message, page.messages[i]);
          placed = true;
          break;
        }
      }
      if (placed) continue;
      if (olderExists && oldest && message.createdAt < oldest) continue;
      pages[0].messages.push(message);
    }
    pages[0].messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    pages[0] = { ...pages[0], ...extra };
    return { ...data, pages };
  });
}

export function updateMessage(queryClient, id, change) {
  queryClient.setQueryData(chatKey, (data) =>
    data && { ...data, pages: data.pages.map((page) => ({ ...page, messages: page.messages.map((m) => (m.id === id ? change(m) : m)) })) },
  );
}

function removeMessage(queryClient, id) {
  queryClient.setQueryData(chatKey, (data) => data && { ...data, pages: data.pages.map((page) => ({ ...page, messages: page.messages.filter((m) => m.id !== id) })) });
}

function setFirstPage(queryClient, change) {
  queryClient.setQueryData(chatKey, (data) => data?.pages?.length && { ...data, pages: [change(data.pages[0]), ...data.pages.slice(1)] });
}

const gone = (m) => ({ ...m, kind: "deleted", body: "", media: null, enc: null, reactions: {}, leaving: false });

/**
 * Keeps an open chat live: Ably events when the server has a key, otherwise a poll every few
 * seconds while the page is visible. Also carries typing and "here now".
 */
export function useChatLive({ live, me, enabled = true }) {
  const queryClient = useQueryClient();
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const channel = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const typingOn = useRef(false);

  const catchUp = useCallback(async () => {
    const data = queryClient.getQueryData(chatKey);
    if (!data) return;
    const newest = newestServerAt(data);
    // Live (Ably) events carry reactions and reads, so only what's new, edited or deleted since the
    // newest message needs fetching. Without Ably, re-read the latest page, which has it all.
    const query = live && newest ? `?after=${encodeURIComponent(newest)}` : "";
    const page = await api(`/me/chat/messages${query}`).then(openPage).catch(() => null);
    if (!page) return;
    mergeMessages(queryClient, page.messages, { reads: page.reads, unread: page.unread });
    if (!live) setTyping(Boolean(page.typing));
  }, [queryClient, live]);

  const showTyping = useCallback((on = true) => {
    clearTimeout(typingTimer.current);
    setTyping(on);
    if (on) typingTimer.current = setTimeout(() => setTyping(false), TYPING_SHOWN_MS);
  }, []);

  useEffect(() => {
    if (!enabled || !me) return;
    let closed = false;
    let client = null;
    let poll = null;
    const onVisible = () => document.visibilityState === "visible" && catchUp();
    document.addEventListener("visibilitychange", onVisible);
    if (live) {
      import("ably")
        .then((Ably) => {
          if (closed) return;
          client = new Ably.Realtime({
            authCallback: (_params, done) => api("/me/chat/realtime").then((token) => done(null, token), (error) => done(error?.message ?? "auth", null)),
            echoMessages: false,
          });
          const ch = client.channels.get(CHANNEL);
          channel.current = ch;
          // Each subscribe attaches the channel and returns a promise; leaving the chat before the attach
          // finishes rejects them with "Connection closed" (harmless, but not to be left unhandled).
          const on = (name, listener) => ch.subscribe(name, listener).catch(() => {});
          on("message", (event) => {
            // Their message arriving ends their "typing…".
            if (event.data?.sender && event.data.sender !== me) showTyping(false);
            catchUp();
          });
          on("edited", () => catchUp());
          // The theme or background changed (theirs together), or their bubbles or typing style.
          on("look", () => queryClient.invalidateQueries({ queryKey: chatPrefsKey }));
          on("reaction", ({ data }) =>
            updateMessage(queryClient, data.messageId, (m) => {
              const reactions = { ...m.reactions };
              if (data.emoji) reactions[data.role] = data.emoji;
              else delete reactions[data.role];
              return { ...m, reactions };
            }),
          );
          on("deleted", ({ data }) => updateMessage(queryClient, data.id, gone));
          on("read", ({ data }) => setFirstPage(queryClient, (page) => ({ ...page, reads: { ...page.reads, [data.role]: data.at } })));
          on("typing", (message) => message.clientId !== me && showTyping(!message.data?.stop));
          const refreshPresence = () => ch.presence.get().then((members) => setOnline(members.some((m) => m.clientId !== me))).catch(() => {});
          ch.presence.subscribe(refreshPresence).catch(() => {});
          ch.presence.enter().then(refreshPresence).catch(() => {});
          // After a dropped connection, fetch whatever arrived meanwhile.
          client.connection.on("connected", () => catchUp());
        })
        .catch(() => {});
    } else {
      poll = setInterval(() => document.visibilityState === "visible" && catchUp(), POLL_MS);
    }
    return () => {
      closed = true;
      clearInterval(poll);
      clearTimeout(typingTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current = null;
      client?.close();
    };
  }, [enabled, live, me, catchUp, queryClient, showTyping]);

  /**
   * Call with the field's text on every change: "typing" goes out at most every 2.5 s while there
   * are words, and "stopped" goes out once when the field empties (or on send/blur, with "").
   */
  const notifyTyping = useCallback((text = "x") => {
    const now = Date.now();
    const on = Boolean(text.trim());
    if (on && now - lastTypingSent.current < TYPING_EVERY_MS) return;
    if (!on && !typingOn.current) return;
    lastTypingSent.current = on ? now : 0;
    typingOn.current = on;
    const data = on ? {} : { stop: true };
    if (channel.current) channel.current.publish("typing", data).catch(() => {});
    else api("/me/chat/typing", { method: "POST", body: data }).catch(() => {});
  }, []);

  return { typing, online, notifyTyping, catchUp };
}

// ---------- sending ----------

/**
 * Files waiting to go up, by the message's clientId, so a failed send can be tried again with the
 * same photos. Each attachment: { file, type: "image"|"video", width, height, duration, mime,
 * previewUrl, poster: { blob, width, height, previewUrl } }.
 */
const outbox = new Map();

/** Seals and uploads one file; returns the stored media entry (without the phone-only fields). */
async function storeFile(file, onProgress) {
  const { blob, sealed } = await sealFile(file);
  const stored = await uploadFile(blob, { folder: "chat", onProgress });
  return { url: stored.url, ...(sealed ? { sealed } : {}) };
}

/** Uploads a message's photos and videos (three at a time) and returns its album. */
async function uploadAlbum(attachments, onProgress) {
  const items = new Array(attachments.length);
  const progress = attachments.map(() => 0);
  const report = (i, value) => {
    progress[i] = value;
    onProgress?.(progress.slice());
  };
  let next = 0;
  async function worker() {
    while (next < attachments.length) {
      const i = next++;
      const a = attachments[i];
      const posterEntry = a.poster?.blob ? await storeFile(a.poster.blob) : null;
      const stored = await storeFile(a.file, (pct) => report(i, Math.min(99, pct)));
      report(i, 100);
      items[i] = {
        type: a.type,
        ...stored,
        ...(a.width ? { width: Math.round(a.width), height: Math.round(a.height) } : {}),
        ...(a.mime ? { mime: a.mime } : {}),
        ...(a.type === "video" ? { duration: Math.round((a.duration || 0) * 10) / 10 } : {}),
        ...(posterEntry ? { poster: { ...posterEntry, width: a.poster.width, height: a.poster.height, mime: a.poster.blob.type } } : {}),
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, attachments.length) }, worker));
  return { items };
}

/** What the phone shows for an album while it uploads: its own previews, with progress. */
const localAlbum = (attachments) => ({
  items: attachments.map((a) => ({
    type: a.type,
    url: a.previewUrl,
    localUrl: a.previewUrl,
    width: a.width,
    height: a.height,
    ...(a.type === "video" ? { duration: a.duration, ...(a.poster ? { poster: { url: a.poster.previewUrl, localUrl: a.poster.previewUrl, width: a.poster.width, height: a.poster.height } } : {}) } : {}),
    progress: 0,
  })),
});

async function postMessage(message) {
  const body = await sealOutgoing({
    clientId: message.clientId,
    kind: message.kind,
    body: message.body ?? "",
    ...(message.media ? { media: cleanMedia(message.media) } : {}),
    replyTo: message.replyTo?.id ?? null,
  });
  return openOne(await api("/me/chat/messages", { method: "POST", body }));
}

/**
 * Sends a message. With `attachments` (photos/videos picked on the phone) the message shows at once
 * with the phone's own previews and upload progress, then goes out once every file is up.
 */
export function useSendMessage(me) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message) => {
      // `after`: what was sent just before this in the same go (a sticker before her words); this
      // one is posted only once that has been, so both phones keep the order she sent them in.
      const before = message.after;
      const attachments = message.attachments ?? (message.sticker ? null : outbox.get(message.clientId));
      let media = message.media;
      // A sticker or Genmoji from the iPhone keyboard: one see-through PNG, sealed like a photo.
      const sticker = message.sticker ?? (message.kind === "sticker" ? outbox.get(message.clientId)?.[0] : null);
      if (sticker?.file) {
        outbox.set(message.clientId, [sticker]);
        const stored = await storeFile(sticker.file);
        media = { ...stored, width: Math.round(sticker.width), height: Math.round(sticker.height), mime: sticker.file.type || "image/png", ...(sticker.alt ? { alt: sticker.alt } : {}) };
      } else if (attachments?.length) {
        outbox.set(message.clientId, attachments);
        let frame = 0;
        media = await uploadAlbum(attachments, (progress) => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() =>
            updateMessage(queryClient, `pending-${message.clientId}`, (m) =>
              m.media?.items ? { ...m, media: { ...m.media, items: m.media.items.map((item, i) => ({ ...item, progress: progress[i] })) } } : m,
            ),
          );
        });
        cancelAnimationFrame(frame);
      }
      const { sticker: _sticker, after: _after, ...rest } = message; // eslint-disable-line no-unused-vars
      if (before) await Promise.resolve(before).catch(() => {});
      const saved = await postMessage({ ...rest, media });
      outbox.delete(message.clientId);
      return saved;
    },
    onMutate: (message) => {
      const { attachments, sticker, after: _after, ...rest } = message; // eslint-disable-line no-unused-vars
      mergeMessages(queryClient, [
        {
          reactions: {},
          body: "",
          media: null,
          ...rest,
          ...(attachments?.length ? { media: localAlbum(attachments) } : {}),
          ...(sticker?.previewUrl ? { media: { url: sticker.previewUrl, localUrl: sticker.previewUrl, width: sticker.width, height: sticker.height } } : {}),
          id: `pending-${message.clientId}`,
          sender: me,
          pending: true,
          failed: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    onSuccess: (saved) => {
      mergeMessages(queryClient, [saved]);
      queryClient.invalidateQueries({ queryKey: chatSummaryKey });
    },
    onError: (error, message) =>
      updateMessage(queryClient, `pending-${message.clientId}`, (m) => ({
        ...m,
        failed: true,
        failure: error?.code === "chat_locked" ? "locked" : error?.status === 413 ? "too_big" : "failed",
      })),
  });
}

/** Whether a failed album still has its files on this phone (so "try again" can work). */
export const canRetry = (message) => !mediaItems(message).some((item) => item.localUrl) || outbox.has(message.clientId);

/** Forgets a message that never reached the server (a failed or stuck send). */
export function useDiscardMessage() {
  const queryClient = useQueryClient();
  return useCallback(
    (message) => {
      outbox.delete(message.clientId);
      removeMessage(queryClient, message.id);
    },
    [queryClient],
  );
}

/**
 * Sends one picture to the chat from elsewhere in the app (a game's "send to chat"): sealed,
 * uploaded and sent exactly like the composer's photos. Returns the stored message.
 */
export async function sendPhotoToChat({ file, width, height, alt, caption = "" }, queryClient) {
  const stored = await storeFile(file);
  const item = { type: "image", ...stored, ...(width ? { width: Math.round(width), height: Math.round(height) } : {}), ...(alt ? { alt: alt.slice(0, 200) } : {}), ...(file.type ? { mime: file.type } : {}) };
  const saved = await postMessage({ clientId: newClientId(), kind: "image", body: caption, media: { items: [item] } });
  if (queryClient) {
    mergeMessages(queryClient, [saved]);
    queryClient.invalidateQueries({ queryKey: chatSummaryKey });
  }
  return saved;
}

// ---------- editing and deleting ----------

/** Edits your own text or caption. Shows the new words at once; puts the old ones back if it fails. */
export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ message, body }) => {
      // Sealed under the original message's identity (chat-room's rule), so it opens like the original.
      const sealed = await sealOutgoing({ clientId: message.clientId, kind: message.kind, body, ...(message.media ? { media: cleanMedia(message.media) } : {}) });
      const payload = { body: sealed.body, ...(sealed.enc ? { enc: sealed.enc, ...(sealed.media ? { media: sealed.media } : {}) } : {}) };
      return openOne(await api(`/me/chat/messages/${message.id}`, { method: "PATCH", body: payload }));
    },
    onMutate: ({ message, body }) => {
      updateMessage(queryClient, message.id, (m) => ({ ...m, body, editedAt: new Date().toISOString(), saving: true }));
      return { previous: message };
    },
    onSuccess: (saved) => {
      mergeMessages(queryClient, [saved]);
      queryClient.invalidateQueries({ queryKey: chatSummaryKey });
    },
    onError: (_error, _vars, context) => context?.previous && updateMessage(queryClient, context.previous.id, () => context.previous),
  });
}

/**
 * Deletes your own message for both of you. The bubble first plays its goodbye (`leaving`), then
 * the message is gone; if the server says no, it comes back.
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message) => api(`/me/chat/messages/${message.id}`, { method: "DELETE" }),
    onMutate: (message) => {
      updateMessage(queryClient, message.id, (m) => ({ ...m, leaving: true }));
      return { previous: message };
    },
    onSuccess: (_r, message) => {
      updateMessage(queryClient, message.id, gone);
      queryClient.invalidateQueries({ queryKey: chatSummaryKey });
    },
    onError: (_error, _message, context) => context?.previous && updateMessage(queryClient, context.previous.id, () => ({ ...context.previous, leaving: false })),
  });
}

export function useReact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }) => api(`/me/chat/messages/${id}/reaction`, { method: "PUT", body: { emoji } }),
    onMutate: ({ id, emoji, me }) =>
      updateMessage(queryClient, id, (m) => {
        const reactions = { ...m.reactions };
        if (emoji) reactions[me] = emoji;
        else delete reactions[me];
        return { ...m, reactions };
      }),
  });
}

/** Marks everything read while the chat is open and visible (at most every few seconds). */
export function useMarkRead({ data, me, enabled }) {
  const queryClient = useQueryClient();
  const last = useRef(0);
  const newestFromThem = flatten(data).filter((m) => m.sender !== me && !m.pending).at(-1)?.createdAt;
  const readAt = data?.pages?.[0]?.reads?.[me];
  useEffect(() => {
    if (!enabled || !newestFromThem || (readAt && readAt >= newestFromThem)) return;
    if (document.visibilityState !== "visible" || Date.now() - last.current < 3000) return;
    last.current = Date.now();
    api("/me/chat/read", { method: "POST", body: {} })
      .then((reads) => {
        setFirstPage(queryClient, (page) => ({ ...page, reads, unread: 0 }));
        queryClient.setQueryData(chatSummaryKey, (summary) => summary && { ...summary, unread: 0 });
      })
      .catch(() => {});
  }, [enabled, newestFromThem, readAt, queryClient]);
}

export function useChatPrefs() {
  return useQuery({ queryKey: chatPrefsKey, queryFn: () => api("/me/chat/prefs"), staleTime: Infinity });
}
export function useSaveChatPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs) => api("/me/chat/prefs", { method: "PUT", body: prefs }),
    onMutate: (prefs) => queryClient.setQueryData(chatPrefsKey, (current) => ({ ...current, ...prefs })),
    onSuccess: (saved) => queryClient.setQueryData(chatPrefsKey, saved),
  });
}

// This phone's time zone, so the other one can tell when it's night here ("sleep").
const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
};

export function useChatSummary({ enabled = true, every } = {}) {
  const queryClient = useQueryClient();
  // The tab bar asks for this as the app starts: a good moment to put the kept chat back.
  useEffect(() => {
    if (enabled) primeChat(queryClient);
  }, [enabled, queryClient]);
  return useQuery({
    queryKey: chatSummaryKey,
    queryFn: async () => {
      const tz = timeZone();
      const summary = await api(`/me/chat/summary${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`);
      return summary.last ? { ...summary, last: await openIncoming(summary.last) } : summary;
    },
    staleTime: 30_000,
    enabled,
    refetchInterval: every ?? 60_000,
    // Its latest message is opened words: not for the app's general cache.
    meta: { persist: false },
  });
}

export function useSaveMemory() {
  return useMutation({ mutationFn: ({ kind, sourceId, caption = "" }) => api("/me/memories", { method: "POST", body: { kind, sourceId, caption } }) });
}
