import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.js";
import { creditLine, sgDate, youtubeSong } from "../../lib/feeds.js";
import { SectionHeading } from "../collection/Collections.jsx";
import { Icon, Modal } from "../../shared/WorldPrimitives.jsx";
import { useMusic } from "../../shared/music/MusicRoom.jsx";
import { FeedFacts, FeedLinks, FeedMedia } from "../feeds/FeedPieces.jsx";

const GROUPS = [
  { label: "songs", kinds: ["song"] },
  { label: "pictures & clips", kinds: ["image", "clip", "video"] },
  { label: "cosplay", kinds: ["cosplay", "tutorial", "dare", "look", "spot", "creator"] },
  { label: "news & events", kinds: ["news", "lore", "event"] },
  { label: "merch", kinds: ["merch"] },
  { label: "memes", kinds: ["meme"] },
];
const COPY_STATE = {
  ready: "private copy ♡",
  pending: "saving a private copy…",
  copying: "saving a private copy…",
  retryable: "saving a private copy…",
  link_only: "kept as a link",
};

// A saved copy plays from the private store; otherwise the original media (still credited).
function saveMedia(save) {
  if (save.removed) return null;
  if (save.copy) {
    const type = save.copy.contentType?.startsWith("video/")
      ? "mp4"
      : save.copy.contentType === "image/gif"
        ? "gif"
        : "image";
    return { type, url: save.copy.url, poster: save.media?.[0]?.poster ?? null, width: save.media?.[0]?.width ?? null, height: save.media?.[0]?.height ?? null, alt: save.media?.[0]?.alt ?? save.title };
  }
  return save.media?.[0] ?? null;
}

function SaveCard({ save, onOpen }) {
  const music = useMusic();
  const media = saveMedia(save);
  const song = save.removed ? null : youtubeSong(save);
  return (
    <article className="note-slip feed-card" data-removed={save.removed ? "" : undefined}>
      <span className="micro-label">
        KEPT {sgDate(save.createdAt)?.toUpperCase()} · {COPY_STATE[save.copyState] ?? "kept"}
      </span>
      {media && !song && (
        <button type="button" className="feed-card__media" aria-label={`A closer look: ${save.title}`} onClick={onOpen}>
          <FeedMedia item={{ ...save, media: [media] }} media={media} />
        </button>
      )}
      <strong className="feed-card__headline">{save.blurb?.headline || save.title}</strong>
      {save.removed ? (
        <p>the creator removed this, so the copy is gone too. the credit stays ♡</p>
      ) : (
        <p>{save.blurb?.text}</p>
      )}
      {!save.removed && <FeedFacts item={save} />}
      {song && (
        <button type="button" className="button-plum lore-song" onClick={() => music.play(song)}>
          <Icon name="play" size={14} /> Listen to {save.title}
        </button>
      )}
      {!save.removed && <FeedLinks item={save} />}
      <div className="note-slip__source feed-byline">
        <a href={save.url} target="_blank" rel="noopener noreferrer">
          {creditLine(save) || "the source"} ↗
        </a>
        <span className="handwritten">{save.signature}</span>
      </div>
      <div className="feed-actions">
        <button type="button" className="quiet-button" onClick={onOpen}>
          a closer look
        </button>
      </div>
    </article>
  );
}

function SaveViewer({ save, onClose, onRemove, removing, canRemove }) {
  const media = saveMedia(save);
  return (
    <Modal title={save.blurb?.headline || save.title} onClose={onClose} className="gallery-dialog feed-viewer">
      {media && <FeedMedia item={{ ...save, media: [media] }} media={media} viewer />}
      <p>{save.removed ? "the creator removed this. the credit stays ♡" : save.blurb?.text}</p>
      {!save.removed && <FeedFacts item={save} />}
      <div className="note-slip__source feed-byline">
        <a href={save.url} target="_blank" rel="noopener noreferrer">
          {creditLine(save) || "the source"} ↗
        </a>
        <span className="handwritten">{save.signature}</span>
      </div>
      <div className="gallery-dialog__actions">
        <span className="status-copy">{COPY_STATE[save.copyState] ?? "kept"}</span>
        {canRemove && (
          <button
            type="button"
            className="quiet-button"
            disabled={removing || save.copyState === "copying"}
            onClick={() => {
              if (window.confirm("Remove this from your saves?")) onRemove(save.id);
            }}
          >
            {removing ? "removing…" : "remove from saves"}
          </button>
        )}
      </div>
    </Modal>
  );
}

export default function SavesPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [open, setOpen] = useState(null);
  const list = useQuery({
    queryKey: ["me", "saves"],
    queryFn: () => api("/me/saves"),
    retry: false,
    // A copy finishes in the background; check back while any are still being made.
    refetchInterval: (q) =>
      q.state.data?.saves?.some((s) => ["pending", "copying", "retryable"].includes(s.copyState)) ? 15_000 : false,
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/me/saves/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setOpen(null);
      queryClient.invalidateQueries({ queryKey: ["me", "saves"] });
    },
  });
  useEffect(() => {
    document.title = "ur saves ♡";
  }, []);
  const saves = list.data?.saves ?? [];
  const current = saves.find((s) => s.id === open);
  return (
    <section className="editorial-section feed-page" id="saves">
      <SectionHeading
        index="♡ THE KEEPSAKE BOX"
        title="Things you"
        emphasis="kept."
        subtitle="Everything you tapped keep on, with its credit. Only you can see these."
        page
      />
      {list.data?.storage?.warning && (
        <p className="collection-label">
          <span />
          STORAGE IS GETTING FULL
          <span className="collection-label__detail">new saves may be kept as links for now.</span>
        </p>
      )}
      {list.isPending && <p className="status-copy">Opening the keepsake box…</p>}
      {list.isError && (
        <aside className="note-slip">
          <span className="micro-label">NOT RIGHT NOW</span>
          <p>ur saves couldn’t load. everything is still safe; try again in a bit.</p>
          <div className="note-slip__source">
            <button type="button" onClick={() => list.refetch()}>
              Try again ↺
            </button>
          </div>
        </aside>
      )}
      {list.isSuccess && !saves.length && (
        <aside className="note-slip">
          <span className="micro-label">NOTHING KEPT YET</span>
          <p>tap keep on anything in ur feeds and it lands here, credit and all.</p>
          <div className="note-slip__source">
            <Link to="/world#maomao">back to the club →</Link>
          </div>
        </aside>
      )}
      {GROUPS.map((group) => {
        const items = saves.filter((s) => group.kinds.includes(s.kind));
        if (!items.length) return null;
        return (
          <div key={group.label} className="feed-group">
            <p className="collection-label">
              <span />
              {group.label.toUpperCase()}
              <span className="collection-label__detail">{items.length} kept</span>
            </p>
            <div className="feed-notes">
              {items.map((save) => (
                <SaveCard key={save.id} save={save} onOpen={() => setOpen(save.id)} />
              ))}
            </div>
          </div>
        );
      })}
      {current && (
        <SaveViewer
          save={current}
          onClose={() => setOpen(null)}
          onRemove={(id) => remove.mutate(id)}
          removing={remove.isPending}
          canRemove={session.data?.role === "kiriya"}
        />
      )}
      {remove.error && (
        <p role="alert" className="status-copy">
          {remove.error.code === "copy_in_progress"
            ? "that one is still being saved. try again in a minute."
            : "couldn’t remove that one. try again in a bit."}
        </p>
      )}
    </section>
  );
}
