// Holding a message (round 3): the chat blurs away, the message lifts out of it, quick reactions
// sit above it and its menu below: reply, edit (your own words and captions), copy, save to our
// memories, delete (yours; asks once more). Tap anywhere else to put it back.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatIcon } from "./parts.jsx";

const QUICK_REACTIONS = ["♥", "😭", "😂", "🥺", "✨", "😍", "👍"];
const time = (iso) =>
  new Date(iso).toLocaleString("en-SG", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" }).toLowerCase();

export function HoldMenu({ held, me, preview, onClose, onReact, onReply, onEdit, onCopy, onSave, onDelete }) {
  const { message, element } = held;
  const mine = message.sender === me;
  const editable = mine && !preview && (message.kind === "text" || message.kind === "image") && !message.locked;
  const copyable = message.kind === "text" && !message.locked && Boolean(message.body);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const stage = useRef(null);
  const lifted = useRef(null);
  const above = useRef(null);
  const below = useRef(null);
  const [place, setPlace] = useState(null);
  const current = message.reactions?.[me];

  // Copy the held message (exactly as it looks) into the overlay at the same spot, then work out
  // where it has to move so its reactions and menu both fit on screen.
  useLayoutEffect(() => {
    const host = lifted.current;
    if (!host || !element) return;
    const rect = element.getBoundingClientRect();
    const copy = element.cloneNode(true);
    copy.style.transform = "";
    copy.style.transition = "";
    copy.removeAttribute("id");
    copy.querySelectorAll("video").forEach((video) => video.removeAttribute("autoplay"));
    host.replaceChildren(copy);
    const row = element.closest(".msg");
    for (const name of ["data-mine", "data-kind", "data-first", "data-last", "data-reacted"]) {
      if (row?.hasAttribute(name)) host.setAttribute(name, row.getAttribute(name));
    }
    // The overlay's own padding is the phone's safe area (CSS env()), already in pixels here.
    const insets = getComputedStyle(stage.current);
    const view = window.visualViewport;
    const top = (view?.offsetTop ?? 0) + 12 + (parseFloat(insets.paddingTop) || 0);
    const bottom = (view ? view.offsetTop + view.height : window.innerHeight) - 12 - (parseFloat(insets.paddingBottom) || 0);
    const aboveH = above.current?.offsetHeight ?? 0;
    const belowH = below.current?.offsetHeight ?? 0;
    const room = bottom - top - aboveH - belowH - 20;
    const height = Math.min(rect.height, Math.max(80, room));
    let y = rect.top;
    if (y - aboveH - 10 < top) y = top + aboveH + 10;
    if (y + height + belowH + 10 > bottom) y = bottom - belowH - 10 - height;
    setPlace({ left: rect.left, width: rect.width, from: rect.top, top: y, height, clipped: height < rect.height });
    // The original steps out while its copy is lifted (like iMessage), and the chat comes forward.
    row?.setAttribute("data-held", "");
    const chat = element.closest(".chat");
    chat?.setAttribute("data-holding", "");
    return () => {
      row?.removeAttribute("data-held");
      chat?.removeAttribute("data-holding");
    };
  }, [element]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close(then) {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      onClose();
      then?.();
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 170);
  }

  const side = mine ? "end" : "start";
  return (
    <div ref={stage} className="hold" data-closing={closing || undefined} data-side={side} onClick={() => close()} role="dialog" aria-modal="true" aria-label="Message options">
      <div className="hold__veil" aria-hidden="true" />
      <div
        className="hold__stack"
        style={
          place
            ? { "--hold-left": `${place.left}px`, "--hold-width": `${place.width}px`, "--hold-top": `${place.top}px`, "--hold-from": `${place.from - place.top}px`, "--hold-height": `${place.height}px` }
            : { visibility: "hidden" }
        }
      >
        {!preview && (
          <div ref={above} className="hold__reactions" role="group" aria-label="React" onClick={(event) => event.stopPropagation()}>
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" aria-pressed={current === emoji} onClick={() => close(() => onReact(current === emoji ? null : emoji))}>
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div ref={lifted} className="hold__message msg" data-clipped={place?.clipped || undefined} aria-hidden="true" />
        <div ref={below} className="hold__menu" onClick={(event) => event.stopPropagation()}>
          <p className="hold__when">{time(message.createdAt)}</p>
          {!preview && (
            <button type="button" onClick={() => close(onReply)}>
              reply <ChatIcon name="reply" size={20} />
            </button>
          )}
          {editable && (
            <button type="button" onClick={() => close(onEdit)}>
              {message.kind === "image" && !message.body ? "add a caption" : message.kind === "image" ? "edit caption" : "edit"} <ChatIcon name="edit" size={20} />
            </button>
          )}
          {copyable && (
            <button type="button" onClick={() => close(onCopy)}>
              copy <ChatIcon name="copy" size={20} />
            </button>
          )}
          {!preview && !message.locked && (
            <button type="button" onClick={() => close(onSave)}>
              save to our memories <ChatIcon name="save" size={20} />
            </button>
          )}
          {mine && !preview &&
            (confirming ? (
              <button type="button" data-danger data-confirm onClick={() => close(onDelete)}>
                delete for both of us? <ChatIcon name="trash" size={20} />
              </button>
            ) : (
              <button type="button" data-danger onClick={() => setConfirming(true)}>
                delete <ChatIcon name="trash" size={20} />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
