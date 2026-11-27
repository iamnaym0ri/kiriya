import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { MessageScroller, useMessageScroller } from "@shadcn/react/message-scroller";
import { flatten, newClientId, useChatLive, useChatMessages, useChatPrefs, useMarkRead, useReact, useSaveMemory, useSendMessage, useUnsend } from "../../lib/chat.js";
import { Modal } from "../../shared/WorldPrimitives.jsx";
import { haptic, isAppShell } from "../../lib/native.js";
import PageLoader from "../../shared/PageLoader.jsx";
import Composer from "./Composer.jsx";
import ChatLook from "./ChatLook.jsx";
import { WALLPAPERS, wallpaperUrl } from "./wallpapers.js";
import { ChatIcon, Message, MessageActions, TypingIndicator } from "./parts.jsx";
import "./Chat.css";

const GROUP_GAP_MS = 5 * 60 * 1000;
const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
function dayLabel(iso) {
  const key = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "today";
  if (key === yesterday) return "yesterday";
  return new Date(iso).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Singapore" });
}

/**
 * When the screen gets shorter (the keyboard comes up, a panel opens), the newest message stays in
 * sight if she was reading at the bottom, the way every chat app behaves.
 */
function useStayAtBottom(viewport) {
  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    let atBottom = true;
    let height = node.clientHeight;
    const onScroll = () => {
      atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    };
    const observer = new ResizeObserver(() => {
      const shrank = node.clientHeight < height;
      height = node.clientHeight;
      if (shrank && atBottom) node.scrollTop = node.scrollHeight;
    });
    node.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [viewport]);
}

function Thread({ list, me, names, reads, typing, typingStyle, hasOlder, loadingOlder, onOlder, onActions, onRetry, onOpenImage, onTapBack, children }) {
  const { scrollToMessage } = useMessageScroller();
  const viewport = useRef(null);
  useStayAtBottom(viewport);
  const other = me === "kiriya" ? "admin" : "kiriya";
  const myLast = [...list].reverse().find((m) => m.sender === me && m.kind !== "tap")?.id;
  return (
    <MessageScroller.Root className="chat__scroller">
      <MessageScroller.Viewport ref={viewport} className="chat__viewport" preserveScrollOnPrepend aria-label="Messages">
        <MessageScroller.Content>
          {hasOlder && (
            <button type="button" className="text-link chat__older" onClick={onOlder} disabled={loadingOlder}>
              {loadingOlder ? "finding older messages…" : "older messages ↑"}
            </button>
          )}
          {list.length === 0 && <p className="chat__empty">say hi ♡ everything you two send stays right here.</p>}
          {list.map((message, i) => {
            const previous = list[i - 1];
            const next = list[i + 1];
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
            const first = newDay || previous.sender !== message.sender || Date.parse(message.createdAt) - Date.parse(previous.createdAt) > GROUP_GAP_MS;
            const last = !next || next.sender !== message.sender || Date.parse(next.createdAt) - Date.parse(message.createdAt) > GROUP_GAP_MS || dayKey(next.createdAt) !== dayKey(message.createdAt);
            return (
              <MessageScroller.Item key={message.clientId ?? message.id} messageId={message.id}>
                {newDay && (
                  <p className="chat__day">
                    <span>{dayLabel(message.createdAt)}</span>
                  </p>
                )}
                <Message
                  message={message}
                  me={me}
                  names={names}
                  first={first}
                  last={last}
                  showStatus={message.id === myLast}
                  readByThem={Boolean(reads?.[other] && reads[other] >= message.createdAt)}
                  onActions={onActions}
                  onRetry={onRetry}
                  onQuote={(id) => scrollToMessage(id, { align: "center", behavior: "smooth" })}
                  onOpenImage={onOpenImage}
                  onTapBack={onTapBack}
                />
              </MessageScroller.Item>
            );
          })}
          {typing && <TypingIndicator style={typingStyle} name={names[other]} />}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button className="chat__jump" direction="end" aria-label="Jump to the newest message">
        <ChatIcon name="down" />
      </MessageScroller.Button>
      {children}
    </MessageScroller.Root>
  );
}

export default function ChatPage() {
  const messages = useChatMessages();
  const first = messages.data?.pages?.[0];
  const me = first?.me;
  const names = first?.names ?? { admin: "Josh", kiriya: "Kiriya" };
  const other = me === "kiriya" ? "admin" : "kiriya";
  const prefs = useChatPrefs().data ?? { bubble: "lilac", background: "petals", typing: "hearts" };
  const live = useChatLive({ live: first?.live, me, enabled: Boolean(first) });
  const send = useSendMessage(me);
  const react = useReact();
  const unsend = useUnsend();
  const saveMemory = useSaveMemory();
  const [replyTo, setReplyTo] = useState(null);
  const [acting, setActing] = useState(null);
  const [look, setLook] = useState(false);
  const [image, setImage] = useState(null);
  const [toast, setToast] = useState("");
  const list = useMemo(() => flatten(messages.data), [messages.data]);
  const shell = useRef(null);
  const app = isAppShell();
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
  // The app: a full screen between the status bar and the tab bar, or the keyboard while she types.
  // It follows what is actually visible (in Safari the keyboard covers the page instead of resizing
  // it; in the app the web view resizes and this simply matches the window).
  useLayoutEffect(() => {
    const node = shell.current;
    const viewport = window.visualViewport;
    if (!app || !node) return undefined;
    const place = () => {
      const height = viewport ? viewport.height : window.innerHeight;
      const top = viewport ? Math.max(0, viewport.offsetTop) : 0;
      node.style.setProperty("--chat-vv-h", `${Math.round(height)}px`);
      node.style.setProperty("--chat-vv-top", `${Math.round(top)}px`);
    };
    place();
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [app, messages.isPending]);
  useMarkRead({ data: messages.data, me, enabled: Boolean(first) });

  useEffect(() => {
    document.title = "messages ♡";
    document.body.dataset.page = "chat";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

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
  const replyLabel = replyTo ? (replyTo.kind === "text" ? `“${replyTo.body.slice(0, 60)}”` : `a ${replyTo.kind}`) : "";

  return (
    <div ref={shell} className="chat" data-app={app || undefined} data-theme={prefs.theme ?? "lilac"} data-bubble={prefs.bubble} data-background={background} style={style}>
      <div className="chat__backdrop" aria-hidden="true" />
      {WALLPAPERS[background] && !app && <p className="chat__credit">{WALLPAPERS[background].credit}</p>}
      <header className="chat__head">
        {app ? (
          <span className="chat__avatar" aria-hidden="true">
            {(names[other] ?? "").slice(0, 1).toUpperCase()}
            <i data-online={live.online || undefined} />
          </span>
        ) : (
          <Link className="chat__icon-button" to="/world#letters-hub" aria-label="Back to letters & notes">
            <ChatIcon name="back" />
          </Link>
        )}
        <div className="chat__who">
          <strong>{names[other]}</strong>
          <span data-online={live.online || undefined}>{live.typing ? "typing…" : live.online ? "here now ♡" : "your little chat"}</span>
        </div>
        <Link className="chat__icon-button" to="/world/memories" aria-label="Our memories">
          <ChatIcon name="book" />
        </Link>
        <button type="button" className="chat__icon-button" aria-label="Change how the chat looks" onClick={() => setLook(true)}>
          <ChatIcon name="palette" />
        </button>
      </header>
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
          onActions={setActing}
          onRetry={(message) => send.mutate({ clientId: message.clientId, kind: message.kind, body: message.body, media: message.media, replyTo: message.replyTo })}
          onOpenImage={setImage}
          onTapBack={(key) => {
            haptic("success");
            send.mutate({ clientId: newClientId(), kind: "tap", body: key });
          }}
        >
          {app && WALLPAPERS[background] && <p className="chat__credit">{WALLPAPERS[background].credit}</p>}
          {app && toast && (
            <p className="chat__toast" role="status">
              {toast}
            </p>
          )}
        </Thread>
      </MessageScroller.Provider>
      <Composer
        onSend={(message) => {
          haptic("light");
          send.mutate(message);
          setReplyTo(null);
        }}
        replyTo={replyTo}
        replyLabel={replyLabel}
        onCancelReply={() => setReplyTo(null)}
        notifyTyping={live.notifyTyping}
        placeholder="message…"
      />
      {toast && !app && (
        <p className="chat__toast" role="status">
          {toast}
        </p>
      )}
      {acting && (
        <MessageActions
          message={acting}
          me={me}
          onClose={() => setActing(null)}
          onReact={(emoji) => {
            haptic("light");
            react.mutate({ id: acting.id, emoji, me });
            setActing(null);
          }}
          onReply={() => {
            setReplyTo(acting);
            setActing(null);
          }}
          onSave={() => {
            saveMemory.mutate({ kind: "message", sourceId: acting.id }, { onSuccess: () => setToast("saved to our memories ✿"), onError: () => setToast("that couldn’t be saved") });
            setActing(null);
          }}
          onUnsend={() => {
            unsend.mutate(acting.id);
            setActing(null);
          }}
        />
      )}
      {look && <ChatLook prefs={prefs} name={names[other]} onClose={() => setLook(false)} />}
      {image && (
        <Modal title="a closer look" onClose={() => setImage(null)} className="chat-image-dialog">
          <img src={image} alt="" style={{ width: "100%", borderRadius: 14 }} />
        </Modal>
      )}
    </div>
  );
}
