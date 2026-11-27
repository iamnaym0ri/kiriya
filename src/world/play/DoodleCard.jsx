import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useToday } from "../../lib/world.js";
import { useIsAdmin } from "../../lib/session.js";
import { HEART } from "../../../shared/reactions.js";
import ReactionBar from "../../shared/ReactionBar.jsx";
import { AdminEdit, EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";

// The doodle card at the top of the play hub: her sketchbook, her latest doodles, and the notes
// Josh leaves on them. Signed in as Josh, tapping a doodle opens his reaction and note sheet (the
// website admin's "Her doodles", in place). Owner: the frame agent.

const NOTE_MAX = 300;
const reactionGlyph = (reaction) => (reaction === HEART ? "♥" : reaction);

function SketchbookArt() {
  return (
    <svg viewBox="0 0 88 76" aria-hidden="true" className="play-doodle__art">
      <path d="M10 8h66q4 0 4 4v54q0 4-4 4H10q-4 0-4-4V12q0-4 4-4Z" fill="#fffaf2" stroke="#b39ac4" strokeWidth="2" />
      <path d="M14 22h58M14 34h58M14 46h58M14 58h58" stroke="#efe2f5" strokeWidth="1.5" />
      {[16, 26, 36, 46, 56, 66].map((x) => (
        <path key={x} d={`M${x} 4v8`} stroke="#9c86ad" strokeWidth="2.4" strokeLinecap="round" />
      ))}
      <path d="M26 52c-6-4-9-8-8-12 1-4 6-5 8-1 2-4 7-3 8 1 1 4-2 8-8 12Z" fill="#f6b6cf" stroke="#c77ba1" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M46 52c2-9 8-14 16-14M54 30c1 4 4 6 8 6" fill="none" stroke="#7e5aa0" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M62 22l1.6 3.4 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="#efcf88" />
    </svg>
  );
}

export default function DoodleCard({ onOpenSketchbook, onOpenDoodle }) {
  const admin = useIsAdmin();
  const gallery = useQuery({ queryKey: ["me", "artworks"], queryFn: () => api("/me/artworks") });
  const signature = useToday().data?.signature ?? "josh";
  const artworks = gallery.data?.artworks ?? [];
  const unseen = artworks.filter((art) => art.notes?.some((note) => !note.seenAt));
  const [noting, setNoting] = useState(null);
  const recent = artworks.slice(0, 12);

  return (
    <section className="app-card app-card--flush play-doodle" aria-labelledby="play-doodle-title">
      <header className="app-card__head">
        <h2 className="app-card__title" id="play-doodle-title">
          doodle
        </h2>
        <div className="app-card__action">
          <AdminEdit compact label="notes on her doodles" onClick={() => artworks[0] && setNoting(artworks[0].id)} />
          {artworks.length > 0 && (
            <button type="button" onClick={() => onOpenSketchbook({ gallery: true })}>
              gallery · {artworks.length}
            </button>
          )}
        </div>
      </header>
      <button type="button" className="play-doodle__open" onClick={() => onOpenSketchbook({})}>
        <SketchbookArt />
        <span className="play-doodle__words">
          <strong>
            lets doodle<span aria-hidden="true">&lt;3</span>
          </strong>
          <span>a flower? a tiny cat? whatever’s in your head.</span>
          <span className="play-doodle__cta">open your sketchbook</span>
        </span>
      </button>
      {!admin && unseen.length > 0 && (
        <button type="button" className="play-doodle__news" onClick={() => onOpenDoodle(unseen[0].id)}>
          <span aria-hidden="true">💌</span>
          {unseen.length === 1 ? `a little note from ${signature} on your doodle` : `little notes from ${signature} on ${unseen.length} doodles`}
        </button>
      )}
      {recent.length > 0 && (
        <ul className="play-doodle__strip" aria-label={admin ? "Her latest doodles" : "Your latest doodles"}>
          {recent.map((art) => {
            const fresh = art.notes?.some((note) => !note.seenAt);
            const label = art.prompt || "a little untitled thing";
            return (
              <li key={art.id}>
                <button
                  type="button"
                  className="play-doodle__thumb"
                  onClick={() => (admin ? setNoting(art.id) : onOpenDoodle(art.id))}
                  aria-label={admin ? `React or leave a note on ${label}` : `Open ${label}`}
                >
                  <img src={art.url} alt="" loading="lazy" decoding="async" />
                  {art.reaction && (
                    <span className="play-doodle__mark" data-heart={art.reaction === HEART}>
                      {reactionGlyph(art.reaction)}
                    </span>
                  )}
                  {art.notes?.length > 0 && (
                    <span className="play-doodle__note" data-new={fresh || undefined} aria-hidden="true">
                      💌
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {admin && <DoodleNotesSheet artworks={artworks} openId={noting} onChange={setNoting} />}
    </section>
  );
}

/** Josh's sheet for one of her doodles: a heart or an emoji, and little notes she'll see beside it. */
function DoodleNotesSheet({ artworks, openId, onChange }) {
  const queryClient = useQueryClient();
  const index = artworks.findIndex((art) => art.id === openId);
  const art = index >= 0 ? artworks[index] : null;
  const [shown, setShown] = useState(null);
  const viewing = art ?? shown;
  const [draft, setDraft] = useState("");
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    if (art) setShown(art);
  }, [art]);
  useEffect(() => setDraft(""), [openId]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["me", "artworks"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "artworks"] });
  };
  const patch = (id, change) =>
    queryClient.setQueryData(["me", "artworks"], (old) => old && { ...old, artworks: old.artworks.map((each) => (each.id === id ? change(each) : each)) });
  const react = useMutation({
    mutationFn: ({ id, reaction }) => api(`/admin/artworks/${id}/reaction`, { method: "PUT", body: { reaction } }),
    onMutate: ({ id, reaction }) => {
      const previous = artworks.find((each) => each.id === id)?.reaction ?? null;
      patch(id, (each) => ({ ...each, reaction }));
      return { previous };
    },
    onError: (_error, { id }, context) => patch(id, (each) => ({ ...each, reaction: context?.previous ?? null })),
    onSettled: refresh,
  });
  const add = useMutation({
    mutationFn: ({ id, body }) => api(`/admin/artworks/${id}/notes`, { method: "POST", body: { body, notify } }),
    onSuccess: ({ note }, { id }) => {
      patch(id, (each) => ({ ...each, notes: [...(each.notes ?? []), note] }));
      setDraft("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (noteId) => api(`/admin/artworks/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: (_data, noteId) => {
      patch(viewing.id, (each) => ({ ...each, notes: (each.notes ?? []).filter((note) => note.id !== noteId) }));
      refresh();
    },
  });
  const step = (by) => onChange(artworks[(index + by + artworks.length) % artworks.length].id);
  const when = useMemo(
    () => (viewing?.createdAt ? new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" }).format(new Date(viewing.createdAt)) : ""),
    [viewing?.createdAt],
  );
  return (
    <EditSheet
      open={Boolean(art)}
      onClose={() => onChange(null)}
      title="her doodle"
      subtitle={viewing ? `${viewing.prompt || "a little untitled thing"}${when ? ` · ${when}` : ""}` : undefined}
      onSave={draft.trim() ? () => add.mutateAsync({ id: viewing.id, body: draft.trim() }).then(() => false) : undefined}
      saveLabel="Leave note"
      dirty={Boolean(draft.trim())}
    >
      {viewing && (
        <div className="doodle-notes-sheet">
          <div className="doodle-notes-sheet__picture">
            <img src={viewing.url} alt={viewing.prompt || "Her doodle"} />
            {artworks.length > 1 && (
              <>
                <button type="button" className="doodle-notes-sheet__step" data-side="left" onClick={() => step(-1)} aria-label="Newer doodle">
                  ‹
                </button>
                <button type="button" className="doodle-notes-sheet__step" data-side="right" onClick={() => step(1)} aria-label="Older doodle">
                  ›
                </button>
              </>
            )}
          </div>
          <ReactionBar
            what="this doodle"
            reaction={viewing.reaction ?? null}
            onReact={(reaction) => react.mutate({ id: viewing.id, reaction })}
            error={react.isError ? "That reaction didn’t save. Try again?" : null}
            note="she sees it beside the doodle"
          />
          {viewing.notes?.length > 0 && (
            <ul className="doodle-notes-sheet__notes" aria-label="Your notes on this doodle">
              {viewing.notes.map((note) => (
                <li key={note.id}>
                  <p>{note.body}</p>
                  <div>
                    <small>{note.seenAt ? "she’s seen it ♡" : "not seen yet"}</small>
                    <button type="button" disabled={remove.isPending && remove.variables === note.id} onClick={() => remove.mutate(note.id)}>
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <EditField label="a little note on this one" hint={`${draft.length}/${NOTE_MAX} · signed with your signature`}>
            <textarea rows={3} maxLength={NOTE_MAX} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="this is so cute…" />
          </EditField>
          <label className="doodle-notes-sheet__notify">
            <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
            tell her phone (it opens this doodle)
          </label>
          {remove.error && <p role="alert">{remove.error.message}</p>}
        </div>
      )}
    </EditSheet>
  );
}
