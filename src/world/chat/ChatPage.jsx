// The chat (round 3). A header with their name and the activity dot (memories and design on the
// right), the conversation, and the composer riding on the keyboard. Messages arrive smoothly:
// what she sends rises into place at once (it's sent in the background), what arrives eases in,
// and the rest of the conversation glides up to make room; a deleted message folds away and the
// ones around it close the gap.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MessageScroller, useMessageScroller } from "@shadcn/react/message-scroller";
import {
  canRetry,
  flatten,
  newClientId,
  updateMessage,
  useChatLive,
  useChatMessages,
  useChatPrefs,
  useDeleteMessage,
  useDiscardMessage,
  useEditMessage,
  useMarkRead,
  useReact,
  useSaveMemory,
  useSendMessage,
} from "../../lib/chat.js";
import { haptic, isAppShell } from "../../lib/native.js";
import { viewingAs } from "../../lib/viewAs.js";
import PageLoader from "../../shared/PageLoader.jsx";
import Composer, { lockedHint } from "./Composer.jsx";
import ChatLook from "./ChatLook.jsx";
import { HoldMenu } from "./HoldMenu.jsx";
import { useKeyboardLift } from "./keyboard.js";
import { Message } from "./Message.jsx";
import { openViewer } from "./viewer.js";
import { WALLPAPERS, wallpaperUrl } from "./wallpapers.js";
import { ChatIcon, TypingIndicator } from "./parts.jsx";
import "./Chat.css";
import "./legacyLook.css";

const GROUP_GAP_MS = 5 * 60 * 1000;
const LEAVE_MS = 240;
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
function dayLabel(iso) {
  const key = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "today";
  if (key === yesterday) return "yesterday";
  return new Date(iso).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Singapore" }).toLowerCase();
}
const keyOf = (message) => message.clientId ?? message.id;

/** Where each message row is on screen right now (for gliding the others when one leaves). */
function snapshot(root) {
  const rects = new Map();
  root?.querySelectorAll(".msg[data-id]").forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.bottom > -200 && rect.top < window.innerHeight + 200) rects.set(node.dataset.id, rect.top);
  });
  return rects;
}
function glide(root, before, { skip } = {}) {
  if (!root || reducedMotion()) return;
  root.querySelectorAll(".msg[data-id]").forEach((node) => {
    if (skip?.has(node.dataset.id)) return;
    const was = before.get(node.dataset.id);
    if (was === undefined) return;
    const delta = was - node.getBoundingClientRect().top;
    if (Math.abs(delta) < 0.5) return;
    node.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 300, easing: "cubic-bezier(0.22, 0.9, 0.3, 1)" });
  });
}

function Thread({ list, me, names, reads, typing, typingStyle, hasOlder, loadingOlder, onOlder, actions, preview, flashId, viewport, jumpRef }) {
  const { scrollToMessage } = useMessageScroller();
  jumpRef.current = scrollToMessage;
  const content = useRef(null);
  const other = me === "kiriya" ? "admin" : "kiriya";

  // Messages that just went (deleted here or on the other phone) stay a moment to fold away.
  const [ghosts, setGhosts] = useState(() => new Map());
  const shownBefore = useRef(new Map());
  const pendingGlide = useRef(null);
  const isGone = (m) => m.kind === "deleted" || m.leaving;
  useLayoutEffect(() => {
    const now = new Map(list.map((m) => [m.id, m]));
    const newlyGone = [...shownBefore.current.values()].filter((m) => now.has(m.id) && isGone(now.get(m.id)) && !ghosts.has(m.id));
    if (!newlyGone.length) return;
    setGhosts((current) => {
      const next = new Map(current);
      newlyGone.forEach((m) => next.set(m.id, m));
      return next;
    });
    setTimeout(() => {
      pendingGlide.current = snapshot(content.current);
      setGhosts((current) => {
        const next = new Map(current);
        newlyGone.forEach((m) => next.delete(m.id));
        return next;
      });
    }, reducedMotion() ? 0 : LEAVE_MS);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!pendingGlide.current) return;
    glide(content.current, pendingGlide.current);
    pendingGlide.current = null;
  }, [ghosts]);

  const visible = useMemo(() => list.filter((m) => !isGone(m) || ghosts.has(m.id)).map((m) => (isGone(m) ? { ...ghosts.get(m.id), leaving: true } : m)), [list, ghosts]); // eslint-disable-line react-hooks/exhaustive-deps

  // New messages at the end ease in; the conversation glides up to make room (transform only).
  const known = useRef(null);
  const newestAt = useRef("");
  const arriving = useRef(new Set());
  if (known.current === null) {
    known.current = new Set(visible.map(keyOf));
    newestAt.current = visible.at(-1)?.createdAt ?? "";
  } else {
    for (const m of visible) {
      const key = keyOf(m);
      if (!known.current.has(key) && m.createdAt >= newestAt.current) arriving.current.add(key);
    }
  }
  const lastKey = visible.length ? keyOf(visible.at(-1)) : null;
  useLayoutEffect(() => {
    const node = viewport.current;
    const fresh = [...arriving.current].filter((key) => !known.current.has(key));
    for (const m of visible) known.current.add(keyOf(m));
    newestAt.current = visible.reduce((latest, m) => (m.createdAt > latest ? m.createdAt : latest), newestAt.current);
    if (!fresh.length || !node || reducedMotion()) return;
    const top = node.scrollTop;
    // The scroller follows the bottom right after this (before the screen is drawn); measure how far it moved.
    requestAnimationFrame(() => {
      const delta = node.scrollTop - top;
      if (delta <= 0) return;
      const skip = new Set(visible.filter((m) => fresh.includes(keyOf(m))).map((m) => m.id));
      content.current?.querySelectorAll(".msg[data-id]").forEach((row) => {
        if (skip.has(row.dataset.id)) return;
        const rect = row.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        row.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 320, easing: "cubic-bezier(0.22, 0.9, 0.3, 1)" });
      });
    });
    setTimeout(() => fresh.forEach((key) => arriving.current.delete(key)), 600);
  }, [lastKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const myLast = [...visible].reverse().find((m) => m.sender === me && m.kind !== "tap" && !m.leaving)?.id;
  const onScroll = (event) => {
    if (hasOlder && !loadingOlder && event.currentTarget.scrollTop < 400) onOlder();
  };
  return (
    <MessageScroller.Root className="chat__scroller">
      <MessageScroller.Viewport ref={viewport} className="chat__viewport" preserveScrollOnPrepend aria-label="Messages" onScroll={onScroll}>
        <MessageScroller.Content ref={content} className="chat__content">
          {hasOlder ? (
            <p className="chat__older" role="status">
              {loadingOlder ? "finding older messages…" : ""}
            </p>
          ) : (
            visible.length > 0 && <p className="chat__beginning">the very beginning of your chat ♡</p>
          )}
          {visible.length === 0 && <p className="chat__empty">say hi ♡ everything you two send stays right here.</p>}
          {visible.map((message, i) => {
            const previous = visible[i - 1];
            const next = visible[i + 1];
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
            const joins = (a, b) => a && b && a.sender === b.sender && a.kind !== "tap" && b.kind !== "tap" && Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) <= GROUP_GAP_MS && dayKey(a.createdAt) === dayKey(b.createdAt);
            const key = keyOf(message);
            return (
              <MessageScroller.Item key={key} messageId={message.id}>
                {newDay && (
                  <p className="chat__day">
                    <span>{dayLabel(message.createdAt)}</span>
                  </p>
                )}
                <Message
                  message={message}
                  me={me}
                  names={names}
                  first={!joins(previous, message) || newDay}
                  last={!joins(message, next)}
                  showStatus={message.id === myLast}
                  readByThem={Boolean(reads?.[other] && reads[other] >= message.createdAt)}
                  arrive={arriving.current.has(key) ? (message.sender === me ? "mine" : "theirs") : null}
                  flash={flashId === message.id}
                  leaving={Boolean(message.leaving)}
                  preview={preview}
                  canRetry={message.failed ? canRetry(message) : false}
                  actions={actions}
                />
              </MessageScroller.Item>
            );
          })}
          {typing && (
            <div className="typing-row">
              <TypingIndicator style={typingStyle} name={names[other]} />
            </div>
          )}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button className="chat__jump" direction="end" aria-label="Jump to the newest message">
        <ChatIcon name="down" />
      </MessageScroller.Button>
    </MessageScroller.Root>
  );
}

/** Their name and whether they're here right now; memories and the design sheet on the right. */
function ChatHeader({ name, online, typing, app, onOpenDesign }) {
  return (
    <header className="chat__head">
      {!app && (
        <Link className="chat__icon-button" to="/world#letters-hub" aria-label="Back to letters & notes">
          <ChatIcon name="back" />
        </Link>
      )}
      <h1 className="chat__who">
        <span className="chat__name">{name}</span>
        <i className="chat__dot" data-online={online || undefined} data-typing={typing || undefined} role="img" aria-label={typing ? "typing" : online ? "here now" : "away"} />
      </h1>
      <div className="chat__actions">
        <Link className="chat__icon-button" to="/world/memories" aria-label="Our memories">
          <ChatIcon name="book" />
        </Link>
        <button type="button" className="chat__icon-button" aria-label="Chat design" onClick={onOpenDesign}>
          <ChatIcon name="palette" />
        </button>
      </div>
    </header>
  );
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const messages = useChatMessages();
  const first = messages.data?.pages?.[0];
  const me = first?.me;
  const names = first?.names ?? { admin: "Josh", kiriya: "Kiriya" };
  const other = me === "kiriya" ? "admin" : "kiriya";
  const preview = Boolean(viewingAs());
  const prefs = useChatPrefs().data ?? { bubble: "lilac", background: "petals", typing: "hearts" };
  const live = useChatLive({ live: first?.live, me, enabled: Boolean(first) });
  const send = useSendMessage(me);
  const edit = useEditMessage();
  const remove = useDeleteMessage();
  const discard = useDiscardMessage();
  const react = useReact();
  const saveMemory = useSaveMemory();
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [held, setHeld] = useState(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [flashId, setFlashId] = useState(null);
  const list = useMemo(() => flatten(messages.data), [messages.data]);
  const shell = useRef(null);
  const viewport = useRef(null);
  const field = useRef(null);
  const jumpRef = useRef(null);
  const app = isAppShell();
  useKeyboardLift({ shell, viewport, enabled: app && !messages.isPending });

  // The website: the chat fills exactly the space under the site's top bar, like an app screen: the
  // page itself never scrolls, only the messages do.
  useLayoutEffect(() => {
    if (app) return undefined;
    const place = () => {
      const bar = document.querySelector(".world-mast")?.getBoundingClientRect().bottom ?? 80;
      shell.current?.style.setProperty("--chat-top", `${Math.max(0, Math.round(bar))}px`);
    };
    place();
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
    };
  });
  // The app: a full screen from the status bar down. In Safari (and the Simulator) the keyboard
  // covers the page, so the chat follows what's actually visible; in the app the keyboard plugin
  // leaves the page alone and keyboard.js lifts the composer instead.
  useLayoutEffect(() => {
    const node = shell.current;
    const view = window.visualViewport;
    if (!app || !node) return undefined;
    const place = () => {
      node.style.setProperty("--chat-vv-h", `${Math.round(view ? view.height : window.innerHeight)}px`);
      node.style.setProperty("--chat-vv-top", `${Math.round(view ? Math.max(0, view.offsetTop) : 0)}px`);
    };
    place();
    view?.addEventListener("resize", place);
    view?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      view?.removeEventListener("resize", place);
      view?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [app, messages.isPending]);
  useMarkRead({ data: messages.data, me, enabled: Boolean(first) && !preview });

  useEffect(() => {
    document.title = "messages ♡";
    document.body.dataset.page = "chat";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  // A send that was cut off (the app closed mid-send) shows as not sent, with "try again".
  useEffect(() => {
    if (!first) return;
    const inFlight = new Set(
      queryClient
        .getMutationCache()
        .findAll({ status: "pending" })
        .map((mutation) => mutation.state.variables?.clientId)
        .filter(Boolean),
    );
    flatten(messages.data)
      .filter((m) => m.pending && !m.failed && !inFlight.has(m.clientId))
      .forEach((m) => updateMessage(queryClient, m.id, (current) => ({ ...current, failed: true, failure: "failed" })));
  }, [Boolean(first)]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = useCallback((words) => setToast(words), []);
  const doSend = useCallback(
    (message) => {
      haptic("light");
      send.mutate(message, { onError: (error) => error?.code === "chat_locked" && say(lockedHint) });
      setReplyTo(null);
    },
    [send, say],
  );

  // One stable set of actions for every message (so a message re-renders only when it changes).
  const latest = useRef({});
  latest.current = { list, me, send, preview, messages };
  const actions = useMemo(
    () => ({
      hold: (message, element) => {
        document.activeElement?.blur?.();
        setHeld({ message, element });
      },
      reply: (message) => {
        if (latest.current.preview) return;
        haptic("light");
        setEditing(null);
        setReplyTo(message);
      },
      jump: async (id) => {
        let found = latest.current.list.some((m) => m.id === id);
        // The original may be further back than what's loaded: fetch older pages until it's there.
        for (let tries = 0; !found && tries < 8 && latest.current.messages.hasNextPage; tries++) {
          const result = await latest.current.messages.fetchNextPage();
          found = flatten(result.data).some((m) => m.id === id);
        }
        if (!found) return say("that one is too far back to find ♡");
        requestAnimationFrame(() => {
          jumpRef.current?.(id, { align: "center", behavior: reducedMotion() ? "auto" : "smooth" });
          setFlashId(id);
          setTimeout(() => setFlashId((current) => (current === id ? null : current)), 1600);
        });
      },
      open: (slides, index) => {
        if (!slides[index]?.src && !slides[index]?.poster) return;
        openViewer(
          slides.filter((s) => s.src || s.poster),
          slides.slice(0, index).filter((s) => s.src || s.poster).length,
        ).catch(() => say("that couldn’t open just now"));
      },
      tapBack: (key) => {
        haptic("success");
        latest.current.send.mutate({ clientId: newClientId(), kind: "tap", body: key });
      },
      retry: (message) => latest.current.send.mutate({ clientId: message.clientId, kind: message.kind, body: message.body, media: message.media, replyTo: message.replyTo }),
      discard: (message) => discard(message),
    }),
    [discard, say],
  );

  if (messages.isPending) return <PageLoader />;
  if (messages.isError)
    return (
      <div className="note-slip" role="alert">
        <p>Your messages couldn’t load.</p>
        <button className="text-link" onClick={() => messages.refetch()}>
          Try again
        </button>
      </div>
    );

  const background = prefs.background === "photo" && !prefs.backgroundUrl ? "petals" : WALLPAPERS[prefs.background] || ["petals", "night", "notebook", "photo"].includes(prefs.background) ? prefs.background : "petals";
  const style = {
    ...(background === "photo" ? { "--chat-photo": `url("${prefs.backgroundUrl}")` } : {}),
    ...(WALLPAPERS[background] ? { "--chat-wallpaper": `url("${wallpaperUrl(background, prefs)}")` } : {}),
  };

  return (
    <div ref={shell} className="chat" data-app={app || undefined} data-theme={prefs.theme ?? "lilac"} data-bubble={prefs.bubble} data-background={background} style={style}>
      <div className="chat__backdrop" aria-hidden="true" />
      <ChatHeader name={names[other]} online={live.online} typing={live.typing} app={app} onOpenDesign={() => setDesignOpen(true)} />
      <MessageScroller.Provider autoScroll defaultScrollPosition="end">
        <Thread
          list={list}
          me={me}
          names={names}
          reads={first?.reads}
          typing={live.typing}
          typingStyle={prefs.typing}
          hasOlder={messages.hasNextPage}
          loadingOlder={messages.isFetchingNextPage}
          onOlder={() => messages.fetchNextPage()}
          actions={actions}
          preview={preview}
          flashId={flashId}
          viewport={viewport}
          jumpRef={jumpRef}
        />
      </MessageScroller.Provider>
      {WALLPAPERS[background] && <p className="chat__credit">{WALLPAPERS[background].credit}</p>}
      <Composer
        names={names}
        me={me}
        preview={preview}
        fieldRef={field}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={doSend}
        onEdit={(message, body) => {
          setEditing(null);
          haptic("light");
          edit.mutate({ message, body }, { onError: (error) => say(error?.code === "chat_locked" ? lockedHint : (error?.message ?? "that edit didn’t save")) });
        }}
        notifyTyping={live.notifyTyping}
      />
      {toast && (
        <p className="chat__toast" role="status">
          {toast}
        </p>
      )}
      {held && (
        <HoldMenu
          held={held}
          me={me}
          preview={preview}
          onClose={() => setHeld(null)}
          onReact={(emoji) => {
            haptic("light");
            react.mutate({ id: held.message.id, emoji, me });
          }}
          onReply={() => actions.reply(held.message)}
          onEdit={() => {
            setReplyTo(null);
            setEditing(held.message);
          }}
          onCopy={() =>
            navigator.clipboard
              ?.writeText(held.message.body)
              .then(() => say("copied ♡"))
              .catch(() => {})
          }
          onSave={() =>
            saveMemory.mutate(
              { kind: "message", sourceId: held.message.id },
              { onSuccess: () => (haptic("success"), say("saved to our memories ✿")), onError: () => say("that couldn’t be saved") },
            )
          }
          onDelete={() => {
            const message = held.message;
            if (message.pending || message.failed || String(message.id).startsWith("pending-")) return discard(message);
            haptic("warning");
            if (editing?.id === message.id) setEditing(null);
            remove.mutate(message, { onError: () => say("that couldn’t be deleted just now") });
          }}
        />
      )}
      {designOpen && <ChatLook prefs={prefs} name={names[other]} onClose={() => setDesignOpen(false)} />}
    </div>
  );
}
