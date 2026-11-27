import { useEffect, useRef, useState } from "react";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";
import { useIsAdmin } from "../../lib/session.js";
import { useOpenDrawer, useToday } from "../../lib/world.js";
import { useMarkSeen } from "./useHome.js";
import { PinSheet } from "./PinEditor.jsx";

const TILTS = [-1.8, 1.4, -0.9, 2.1, -1.3, 0.7, 1.9, -2.2];
const SHIFTS = [-6, 8, -2, 5, -8, 3];
function hash(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(value);
}
const pinnedOn = (at) =>
  new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" }).format(new Date(at)).toLowerCase();

/** One note on the board: a pushpin or a strip of washi tape, a colour, maybe a sticker. */
export function PinNote({ pin, signature = "Josh", onEdit, preview = false }) {
  const seed = hash(pin.id);
  return (
    <article
      className="home-pin"
      data-style={pin.style}
      data-colour={pin.colour}
      data-new={pin.new || undefined}
      style={{ "--tilt": `${TILTS[seed % TILTS.length]}deg`, "--shift": `${SHIFTS[seed % SHIFTS.length]}px` }}
    >
      <span className={pin.style === "tape" ? "home-pin__tape" : "home-pin__pushpin"} aria-hidden="true" />
      {pin.new && <span className="home-pin__new">new ♡</span>}
      <span className="home-pin__label">{pin.label || `from ${signature} ♡`}</span>
      <p className="home-pin__text">{pin.text}</p>
      <footer className="home-pin__foot">
        {onEdit && <AdminEdit compact label="this note" onClick={onEdit} />}
        {pin.updatedAt && !preview && <time dateTime={pin.updatedAt}>{pinnedOn(pin.updatedAt)}</time>}
      </footer>
      {pin.sticker && <StickerArt art={pin.sticker} size={50} className="home-pin__sticker" />}
    </article>
  );
}

/**
 * The pinboard: the birthday wish stays pinned at the top; under it, the notes Josh pins and
 * changes from his phone. Something new shows "new" until she has looked at the board.
 */
export default function Pinboard({ home, signature = "Josh", todayNote }) {
  const admin = useIsAdmin();
  const pins = home?.pins ?? [];
  const board = useRef(null);
  const markSeen = useMarkSeen();
  const [editing, setEditing] = useState(null);
  const newest = pins.reduce((latest, pin) => (!latest || pin.updatedAt > latest ? pin.updatedAt : latest), null);
  const anyNew = pins.some((pin) => pin.new);

  // Looking at the board for a moment counts as having seen what's new on it.
  useEffect(() => {
    const node = board.current;
    if (!node || !anyNew || !newest || typeof IntersectionObserver === "undefined") return undefined;
    let timer;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry.isIntersecting) timer = setTimeout(() => {
          markSeen.mutate({ pinsAt: newest });
          observer.disconnect();
        }, 1500);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [anyNew, newest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Before Josh pins anything, today's little note from him (when there is one) hangs here instead.
  const notes = pins.length ? pins : todayNote ? [{ id: `today-${todayNote.id}`, text: todayNote.body, label: todayNote.title, style: "pin", colour: "lilac" }] : [];

  return (
    <section className="home-board" id="home-pinboard" aria-labelledby="home-board-title" ref={board}>
      <header className="home-board__head">
        <h2 id="home-board-title" className="home-board__title">
          the pinboard
        </h2>
        <AdminEdit label="pin a note" onClick={() => setEditing({ kind: "new" })} />
      </header>
      <div className="home-board__notes" data-companion-avoid>
        <article className="home-pin home-pin--wish" data-style="tape" data-colour="cream" style={{ "--tilt": "-1.2deg", "--shift": "0px" }}>
          <span className="home-pin__tape" aria-hidden="true" />
          <span className="home-pin__label">a little birthday wish ♡</span>
          <p className="home-pin__text">
            That u will keep being unique and speciall just like u always have been <span className="birthday-forever">forever!!</span>
          </p>
        </article>
        {notes.map((pin) => (
          <PinNote key={pin.id} pin={pin} signature={signature} onEdit={pins.length ? () => setEditing({ kind: "edit", pin }) : undefined} />
        ))}
        {admin && !pins.length && (
          <p className="home-board__hint">Pin a note for her: something to cheer her on, or just because. When you change it, she sees it as new.</p>
        )}
      </div>
      <BoardExtras />
      <PinSheet editing={editing} onClose={() => setEditing(null)} signature={signature} />
    </section>
  );
}

/** The stamps and the little surprise envelope from the old home, tucked at the foot of the board. */
function BoardExtras() {
  const { copy } = useDailyStyle();
  const today = useToday();
  const drawer = useOpenDrawer();
  const [open, setOpen] = useState(false);
  const data = today.data;
  const reward = data?.drawer?.reward ?? drawer.data?.reward;
  return (
    <div className="home-board__extras">
      <div className="home-board__stamps" aria-label="Little stamps" data-companion-ok>
        <span>{copy?.birthdayStamp ?? "🎂 SEPTEMBER GIRL"}</span>
        <span>♡ VERY LOVED</span>
        <span>✿ DOODLES WELCOME</span>
      </div>
      <button
        type="button"
        className="home-surprise-env"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => {
          setOpen(!open);
          if (!data?.drawer?.opened && !drawer.data && !drawer.isPending) drawer.mutate();
        }}
      >
        <svg className="home-surprise-env__art" viewBox="0 0 72 50" aria-hidden="true">
          <rect x="2" y="6" width="68" height="42" rx="4" fill="#fffaf3" stroke="#b996c6" strokeWidth="1.6" />
          <path className="home-surprise-env__flap" d="M3 8 36 31 69 8" fill="#f6e9f7" stroke="#b996c6" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M36 28c-5-3.4-6.2-6.6-3.6-8 1.4-.7 2.8 0 3.6 1.1.8-1.1 2.2-1.8 3.6-1.1 2.6 1.4 1.4 4.6-3.6 8z" fill="#c9739f" />
        </svg>
        <span className="home-surprise-env__words">{open ? "a little keepsake" : "psst… a little surprise"}</span>
      </button>
      {open && (
        <div className="home-keepsake-card" role="status">
          {reward?.sticker ? (
            <>
              <StickerArt art={reward.sticker.art} size={72} />
              <span>{reward.sticker.label ?? reward.sticker.name ?? "A keepsake for your collection"}</span>
            </>
          ) : (
            <span>{drawer.isError ? "The drawer is stuck. Tap again to retry." : "Opening the little drawer…"}</span>
          )}
        </div>
      )}
    </div>
  );
}
