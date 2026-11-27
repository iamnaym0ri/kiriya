import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api.js";
import { useIsAdmin } from "../../../lib/session.js";
import { shrinkImage, uploadFile } from "../../../lib/uploads.js";
import { useAppBack } from "../../../shared/AppFrame.jsx";
import { AdminEdit, EditField, EditSheet } from "../../../shared/admin/AdminEdit.jsx";
import { DoodleNotesSheet } from "../DoodleCard.jsx";
import { KINDS, artKind, artTitle, groupByMonth, kindsIn } from "./kinds.js";
import { KindIcon, KindMark, LetterIcon } from "./GalleryParts.jsx";
import { ARTWORKS_KEY, isHeart, reactionGlyph, useArtworks, useMarkNotesSeen, useSignature } from "./useArtworks.js";
import Viewer from "./Viewer.jsx";
import "./gallery.css";

/**
 * Her gallery, a pushed screen of the play tab (/world/play?gallery=1): everything she has kept
 * (doodles, kaleidoscopes, paper doll looks, bouquets) in a grid by month, a filter by kind, and
 * one opened big (?doodle=<id>, a history entry of its own, so back and the edge swipe close it).
 * Josh sees the same screen as "her gallery", with his heart and note sheet on each piece.
 */
export default function GalleryScreen({ onStartDoodle }) {
  const admin = useIsAdmin();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back = useAppBack("/world/play");
  const signature = useSignature();
  const { query, artworks, withNews } = useArtworks();
  const [filter, setFilter] = useState("all");
  const [noting, setNoting] = useState(null);
  const [adding, setAdding] = useState(false);
  const kinds = useMemo(() => kindsIn(artworks), [artworks]);
  const shown = useMemo(() => (filter === "all" ? artworks : artworks.filter((art) => artKind(art) === filter)), [artworks, filter]);
  const groups = useMemo(() => groupByMonth(shown), [shown]);
  const title = admin ? "her gallery" : "your gallery";

  // ---------- one piece, opened big ----------
  const viewingId = params.get("doodle");
  const list = shown.some((art) => art.id === viewingId) ? shown : artworks;
  const index = list.findIndex((art) => art.id === viewingId);
  const viewing = index >= 0 ? list[index] : null;
  const openArt = (id) => navigate(`/world/play?gallery=1&doodle=${encodeURIComponent(id)}`, { state: { viewer: true } });
  const stepTo = (id) => navigate(`/world/play?gallery=1&doodle=${encodeURIComponent(id)}`, { replace: true, state: location.state });
  const closeArt = () => (location.state?.viewer ? navigate(-1) : navigate("/world/play?gallery=1", { replace: true }));
  // A link to something that's gone (deleted, or not hers to see) just lands on the gallery.
  useEffect(() => {
    if (viewingId && query.isSuccess && !artworks.some((art) => art.id === viewingId)) navigate("/world/play?gallery=1", { replace: true });
  }, [viewingId, query.isSuccess, artworks, navigate]);

  // Opening a piece marks Josh's notes on it seen; they still say "new" for the rest of this visit.
  const markSeen = useMarkNotesSeen();
  const [fresh, setFresh] = useState(() => new Set());
  useEffect(() => {
    if (admin) return;
    const unread = viewing?.notes?.filter((note) => !note.seenAt) ?? [];
    if (!unread.length) return;
    setFresh((current) => new Set([...current, ...unread.map((note) => note.id)]));
    markSeen.mutate(viewing.id);
  }, [viewing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-screen gallery-screen">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          play
        </button>
        <h1 className="app-section__title">{title}</h1>
        <div className="app-section__actions">
          {!admin && (
            <button type="button" className="app-action" aria-label="add a picture you made" onClick={() => setAdding(true)}>
              <PlusIcon />
            </button>
          )}
        </div>
        <p className="app-section__subtitle">
          {query.isPending ? "opening your pages…" : artworks.length ? `${artworks.length} little ${artworks.length === 1 ? "thing" : "things"}, newest first` : admin ? "what she keeps gathers here" : "everything you keep gathers here"}
        </p>
      </header>

      <div className="app-section__body">
        {!admin && withNews.length > 0 && (
          <button type="button" className="gallery-news" onClick={() => openArt(withNews[0].id)}>
            <LetterIcon size={20} />
            <span>{withNews.length === 1 ? `a little note from ${signature} on “${artTitle(withNews[0])}”` : `little notes from ${signature} on ${withNews.length} of your things`}</span>
            <span className="gallery-news__go" aria-hidden="true">
              open
            </span>
          </button>
        )}

        {kinds.length > 1 && (
          <div className="gallery-filters app-bleed" role="tablist" aria-label="show">
            <button type="button" role="tab" className="gallery-filter" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
              all <small>{artworks.length}</small>
            </button>
            {kinds.map((kind) => (
              <button key={kind.id} type="button" role="tab" className="gallery-filter" aria-selected={filter === kind.id} onClick={() => setFilter(kind.id)}>
                <KindIcon kind={kind.id} />
                {kind.name} <small>{kind.count}</small>
              </button>
            ))}
          </div>
        )}

        {query.isPending ? (
          <div className="gallery-grid" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="gallery-tile gallery-tile--ghost" />
            ))}
          </div>
        ) : query.isError ? (
          <section className="app-card app-empty">
            <strong>your pages didn’t open</strong>
            <button type="button" className="gallery-retry" onClick={() => query.refetch()}>
              try again
            </button>
          </section>
        ) : artworks.length === 0 ? (
          <section className="app-card app-empty gallery-empty">
            <EmptyArt />
            <strong>{admin ? "nothing here yet" : "your first little masterpiece goes here"}</strong>
            <span>{admin ? "her doodles, kaleidoscopes, paper doll looks and bouquets gather here when she keeps them." : "keep a doodle, a kaleidoscope, a paper doll look or a bouquet, and it lives here."}</span>
            {!admin && (
              <button type="button" className="gallery-retry" onClick={onStartDoodle}>
                start a doodle
              </button>
            )}
          </section>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="gallery-month" aria-labelledby={`gallery-${group.key}`}>
              <h2 className="app-group-title gallery-month__title" id={`gallery-${group.key}`}>
                {group.label}
                <span>{group.artworks.length}</span>
              </h2>
              <ul className="gallery-grid">
                {group.artworks.map((art) => {
                  const unread = art.notes?.some((note) => !note.seenAt);
                  return (
                    <li key={art.id}>
                      <button type="button" className="gallery-tile" onClick={() => openArt(art.id)} aria-label={`open ${artTitle(art)}${art.reaction ? `, ${isHeart(art.reaction) ? "hearted" : `reacted ${art.reaction}`} by ${signature}` : ""}${art.notes?.length ? `, ${unread ? "a new note" : "a note"} from ${signature}` : ""}`}>
                        <img src={art.url} alt="" loading="lazy" decoding="async" />
                        <KindMark kind={artKind(art)} />
                        {art.reaction && (
                          <span className="gallery-tile__heart" data-heart={isHeart(art.reaction) || undefined} aria-hidden="true">
                            {reactionGlyph(art.reaction)}
                          </span>
                        )}
                        {art.notes?.length > 0 && (
                          <span className="gallery-tile__note" data-new={unread || undefined} aria-hidden="true">
                            <LetterIcon />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {viewing && (
        <Viewer
          art={viewing}
          index={index}
          count={list.length}
          onPrev={list.length > 1 ? () => stepTo(list[(index - 1 + list.length) % list.length].id) : null}
          onNext={list.length > 1 ? () => stepTo(list[(index + 1) % list.length].id) : null}
          onClose={closeArt}
          onRemoved={() => (list.length > 1 ? stepTo(list[(index + 1) % list.length].id) : closeArt())}
          fresh={fresh}
          adminControls={<AdminEdit label="react or leave her a note" onClick={() => setNoting(viewing.id)} />}
        />
      )}
      {admin && <DoodleNotesSheet artworks={artworks} openId={noting} onChange={setNoting} />}
      {!admin && <AddArtSheet open={adding} onClose={() => setAdding(false)} onAdded={(art) => art?.id && openArt(art.id)} />}
    </div>
  );
}

/** Adds a picture she made somewhere else (a photo of a drawing, a screenshot) to her gallery. */
function AddArtSheet({ open, onClose, onAdded }) {
  const client = useQueryClient();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState(null);
  const input = useRef(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (open) return;
    setFile(null);
    setCaption("");
  }, [open]);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPG or WebP picture.");
      const picture = await shrinkImage(file);
      const bitmap = await createImageBitmap(picture);
      const { width, height } = bitmap;
      bitmap.close();
      const stored = await uploadFile(picture, { folder: "art" });
      return api("/me/artworks", { method: "POST", body: { ...stored, prompt: caption.trim() || null, width, height } });
    },
    onSuccess: (art) => {
      client.invalidateQueries({ queryKey: ARTWORKS_KEY });
      onAdded(art);
    },
  });
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="add a little masterpiece"
      subtitle="a photo of something you drew, painted or made"
      saveLabel="keep it ♡"
      saveDisabled={!file}
      dirty={Boolean(file)}
      onSave={() => upload.mutateAsync()}
    >
      <div className="gallery-add">
        <button type="button" className="gallery-add__pick" onClick={() => input.current?.click()}>
          {preview ? <img src={preview} alt="the picture you chose" /> : <span>choose a picture</span>}
        </button>
        <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <EditField label="a title or a little note (optional)">
          <input value={caption} maxLength={300} onChange={(event) => setCaption(event.target.value)} placeholder="my little masterpiece" />
        </EditField>
      </div>
    </EditSheet>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EmptyArt() {
  return (
    <svg className="gallery-empty__art" viewBox="0 0 120 80" aria-hidden="true">
      {KINDS.map((kind, i) => (
        <g key={kind.id} transform={`translate(${8 + i * 27} ${i % 2 ? 22 : 14}) rotate(${i % 2 ? 5 : -6} 14 18)`}>
          <rect width="28" height="34" rx="3" fill="#fffaf2" stroke="#c9b1ee" strokeWidth="1.6" />
          <g transform="translate(5 5) scale(0.75)" color="#9a6cc8">
            <KindIcon kind={kind.id} size={24} />
          </g>
        </g>
      ))}
    </svg>
  );
}
