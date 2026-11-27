import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useSession } from "../../lib/session.js";
import { isAppShell } from "../../lib/native.js";
import { useMediaUrl } from "../../lib/chatCrypto.js";
import { useChatSummary } from "../../lib/chat.js";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { tapByKey } from "../../../shared/taps.js";
import Sheet from "./theme/Sheet.jsx";
import { SHELVES, picturesOf, useMemoryShelf, useRemoveMemory } from "./memories/useMemories.js";
import { VoicePlayer } from "./memories/VoicePlayer.jsx";
import { Viewer } from "./memories/Viewer.jsx";
import "./theme/themes.css";
import "./theme/sheet.css";
import "./memories/memories.css";

const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" }).toLowerCase() : "");
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** "from josh · 27 november 2026 · saved by you" */
function useByline() {
  const role = useSession().data?.role;
  const names = useChatSummary().data?.names ?? { admin: "Josh", kiriya: "Kiriya" };
  return (memory) => {
    const s = memory.snapshot ?? {};
    const from = memory.kind === "message" ? (s.sender === role ? "from you" : `from ${String(names[s.sender] ?? "").toLowerCase()}`) : { note: "a little note", letter: "a letter", jar: "from the jar" }[memory.kind];
    const saved = memory.savedBy === role ? "" : ` · kept by ${String(names[memory.savedBy] ?? "them").toLowerCase()}`;
    return `${from} · ${when(s.at ?? memory.createdAt)}${saved}`;
  };
}

function Remove({ onRemove }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <span className="mem-confirm">
      <button type="button" data-danger onClick={onRemove}>
        take it out
      </button>
      <button type="button" onClick={() => setAsking(false)}>
        keep
      </button>
    </span>
  ) : (
    <button type="button" className="mem-remove" onClick={() => setAsking(true)} aria-label="Remove from our memories">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </svg>
    </button>
  );
}

const ICONS = {
  message: <path d="M4 5h16v11H9l-5 4Z" />,
  picture: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 17 5-5 4 4 2-2 5 4" />
      <circle cx="15.5" cy="9.5" r="1.5" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  letter: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="m4 8 8 6 8-6" />
    </>
  ),
};
const ShelfIcon = ({ name }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

const Locked = () => <p className="mem-card__locked">this one is still unlocking ♡</p>;

function MessageCard({ memory, byline, onRemove }) {
  const s = memory.snapshot;
  const tap = s.kind === "tap" ? tapByKey[s.body] : null;
  return (
    <article className="mem-card mem-card--message">
      {s.locked ? <Locked /> : tap ? <p className="mem-card__tap"><span aria-hidden="true">{tap.emoji}</span> {tap.label}</p> : <p className="mem-card__words">{s.body}</p>}
      {memory.caption && <p className="mem-card__caption">“{memory.caption}”</p>}
      <footer>
        <span>{byline(memory)}</span>
        <Remove onRemove={onRemove} />
      </footer>
    </article>
  );
}

function Thumb({ item }) {
  const still = item.type === "video" ? (item.poster ?? null) : item.type === "gif" ? { url: item.still ?? item.url } : item;
  const src = useMediaUrl(still);
  if (!src) return <span className="mem-tile__blank" aria-hidden="true">{item.type === "video" ? "▶" : ""}</span>;
  return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} data-sticker={item.type === "sticker" || undefined} />;
}

function PictureTile({ memory, byline, onOpen }) {
  const items = picturesOf(memory);
  const first = items[0];
  if (memory.snapshot.locked || !first)
    return (
      <div className="mem-tile mem-tile--locked">
        <span>still unlocking ♡</span>
      </div>
    );
  const label = `${items.length > 1 ? `${items.length} pictures` : first.type === "video" ? "a video" : first.type === "gif" ? "a GIF" : first.type === "sticker" ? "a sticker" : "a photo"}, ${byline(memory)}`;
  return (
    <button type="button" className="mem-tile" onClick={onOpen} aria-label={label}>
      <Thumb item={first} />
      {first.type === "video" && <span className="mem-tile__badge">▶ {first.duration ? clock(first.duration) : ""}</span>}
      {first.type === "gif" && <span className="mem-tile__badge">GIF</span>}
      {items.length > 1 && <span className="mem-tile__more">+{items.length - 1}</span>}
    </button>
  );
}

function VoiceCard({ memory, byline, onRemove }) {
  const s = memory.snapshot;
  return (
    <article className="mem-card mem-card--voice">
      {s.locked || !s.media ? <Locked /> : <VoicePlayer media={s.media} />}
      <footer>
        <span>{byline(memory)}</span>
        <Remove onRemove={onRemove} />
      </footer>
    </article>
  );
}

function LetterCard({ memory, byline, onOpen }) {
  const s = memory.snapshot;
  const title = memory.kind === "jar" ? (s.label ?? "a note from the jar") : s.title;
  const text = memory.kind === "jar" ? s.text : s.body;
  return (
    <button type="button" className="mem-card mem-card--letter" data-kind={memory.kind} onClick={onOpen}>
      <strong>{title}</strong>
      <p>{String(text ?? "").length > 160 ? `${String(text).slice(0, 160)}…` : text}</p>
      <span className="mem-card__meta">{byline(memory)}</span>
    </button>
  );
}

function Reading({ memory, byline, onClose, onRemove }) {
  const s = memory.snapshot;
  const title = memory.kind === "jar" ? (s.label ?? "a note from the jar") : s.title;
  return (
    <Sheet title={title} onClose={onClose} className="mem-reading">
      <div className="mem-reading__paper">
        <p>{memory.kind === "jar" ? s.text : s.body}</p>
        {memory.kind === "jar" && s.byline && <p className="mem-reading__byline">— {s.byline}</p>}
      </div>
      <div className="mem-reading__foot">
        <span>{byline(memory)}</span>
        <Remove onRemove={onRemove} />
      </div>
    </Sheet>
  );
}

function Shelf({ shelf, byline }) {
  const query = useMemoryShelf(shelf.key);
  const remove = useRemoveMemory();
  const [viewing, setViewing] = useState(null);
  const [reading, setReading] = useState(null);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (query.isPending) return <p className="memories-status" role="status">opening the scrapbook…</p>;
  if (query.isError)
    return (
      <p className="memories-status" role="alert">
        your memories couldn’t load. <button type="button" className="memories-retry" onClick={() => query.refetch()}>try again</button>
      </p>
    );
  if (!items.length)
    return (
      <div className="memories-empty">
        <span aria-hidden="true">✿</span>
        <p>{shelf.empty}</p>
      </div>
    );
  const drop = (id) => {
    setViewing(null);
    setReading(null);
    remove.mutate(id);
  };
  return (
    <>
      {shelf.key === "pictures" ? (
        <div className="memories-grid">
          {items.map((memory) => (
            <PictureTile key={memory.id} memory={memory} byline={byline} onOpen={() => setViewing(memory)} />
          ))}
        </div>
      ) : (
        <div className="memories-list" data-shelf={shelf.key}>
          {items.map((memory) =>
            shelf.key === "messages" ? (
              <MessageCard key={memory.id} memory={memory} byline={byline} onRemove={() => drop(memory.id)} />
            ) : shelf.key === "voice" ? (
              <VoiceCard key={memory.id} memory={memory} byline={byline} onRemove={() => drop(memory.id)} />
            ) : (
              <LetterCard key={memory.id} memory={memory} byline={byline} onOpen={() => setReading(memory)} />
            ),
          )}
        </div>
      )}
      {query.hasNextPage && (
        <button type="button" className="memories-more" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
          {query.isFetchingNextPage ? "finding older ones…" : "older memories"}
        </button>
      )}
      {viewing && (
        <Viewer memory={viewing} items={picturesOf(viewing)} caption={viewing.snapshot.body} meta={byline(viewing)} onClose={() => setViewing(null)} onRemove={() => drop(viewing.id)} />
      )}
      {reading && <Reading memory={reading} byline={byline} onClose={() => setReading(null)} onRemove={() => drop(reading.id)} />}
    </>
  );
}

/** "Our memories": everything either of them saved, on four shelves: messages, pictures, voice notes, letters & notes. */
export default function MemoriesPage() {
  const app = isAppShell();
  const back = useAppBack("/world/chat");
  const byline = useByline();
  const first = useMemoryShelf("messages");
  const counts = first.data?.pages?.[0]?.counts;
  const [shelf, setShelf] = useState(null);
  // Open on the first shelf with something on it.
  const current = shelf ?? (counts ? (SHELVES.find((s) => counts[s.key] > 0)?.key ?? "messages") : "messages");
  useEffect(() => {
    document.title = "our memories ♡";
  }, []);
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : null;
  return (
    <div className="app-screen memories-screen chat-themed" data-theme="lilac">
      <header className="app-section__head memories-head">
        {app ? (
          <button type="button" className="app-screen__back" onClick={back}>
            chat
          </button>
        ) : (
          <Link className="text-link memories-back" to="/world/chat">
            ← back to messages
          </Link>
        )}
        <h1 className="app-section__title memories-title">
          our <em>memories</em>
        </h1>
        <p className="app-section__subtitle">{total ? `${total} little ${total === 1 ? "moment" : "moments"} you two kept ♡` : "everything you two keep, in one place ♡"}</p>
      </header>
      <div className="memories-shelves" role="tablist" aria-label="Kinds of memories">
        {SHELVES.map((s) => (
          <button key={s.key} type="button" role="tab" id={`shelf-${s.key}`} aria-selected={current === s.key} aria-controls="memories-shelf" onClick={() => setShelf(s.key)}>
            <ShelfIcon name={s.icon} />
            <span className="memories-shelves__label">{s.label}</span>
            {counts?.[s.key] ? <span className="memories-shelves__count" aria-label={`, ${counts[s.key]}`}>{counts[s.key]}</span> : null}
          </button>
        ))}
      </div>
      <section id="memories-shelf" role="tabpanel" aria-labelledby={`shelf-${current}`} className="memories-shelf">
        <Shelf key={current} shelf={SHELVES.find((s) => s.key === current)} byline={byline} />
      </section>
    </div>
  );
}
