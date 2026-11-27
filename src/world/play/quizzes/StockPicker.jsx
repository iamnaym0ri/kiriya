import { useEffect, useRef, useState } from "react";
import { EditSheet } from "../../../shared/admin/AdminEdit.jsx";
import { PHOTO_IDEAS, searchPhotos } from "./openverse.js";

/** A bottom sheet to find a free stock photo (Openverse). Picking one closes it. */
export default function StockPicker({ open, initial = "", onPick, onClose }) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState({ term: "", photos: [], next: null, loading: false, error: null });
  const controller = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTerm(initial);
    if (initial && initial !== search.term) run(initial);
    // Let the sheet rise before the keyboard does.
    const timer = setTimeout(() => !initial && input.current?.focus(), 380);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(q, cursor = null) {
    const query = q.trim();
    if (!query) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setSearch((current) => ({ ...current, term: query, loading: true, error: null, ...(cursor ? {} : { photos: [], next: null }) }));
    try {
      const page = await searchPhotos(query, { cursor, signal: abort.signal });
      setSearch((current) => {
        const seen = new Set(cursor ? current.photos.map((p) => p.id) : []);
        const photos = cursor ? [...current.photos, ...page.photos.filter((p) => !seen.has(p.id))] : page.photos;
        return { term: query, photos, next: page.next, loading: false, error: null };
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      setSearch((current) => ({ ...current, loading: false, error: error.message || "The photo library didn’t answer. Try again?" }));
    }
  }

  const submit = (event) => {
    event.preventDefault();
    input.current?.blur();
    run(term);
  };

  return (
    <EditSheet open={open} title="find a photo" subtitle="free photos, credited on the card" onClose={onClose}>
      <div className="quiz-stock">
        <form className="quiz-stock__search" role="search" onSubmit={submit}>
          <input
            ref={input}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={term}
            placeholder="cats, ramen, the beach…"
            aria-label="search photos"
            onChange={(event) => setTerm(event.target.value)}
          />
          <button type="submit" className="quiz-button quiz-button--primary" disabled={!term.trim()}>
            search
          </button>
        </form>

        {!search.term && (
          <div className="quiz-stock__ideas" aria-label="ideas">
            {PHOTO_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                className="quiz-chip"
                onClick={() => {
                  setTerm(idea);
                  run(idea);
                }}
              >
                {idea}
              </button>
            ))}
          </div>
        )}

        {search.error && (
          <p className="quiz-error" role="alert">
            {search.error}
          </p>
        )}

        {search.term && !search.loading && !search.error && search.photos.length === 0 && (
          <p className="quiz-stock__empty">no photos for “{search.term}”. try a simpler word?</p>
        )}

        {search.photos.length > 0 && (
          <ul className="quiz-stock__grid" aria-label={`photos of ${search.term}`}>
            {search.photos.map((photo) => (
              <li key={photo.id}>
                <button type="button" className="quiz-stock__photo" onClick={() => onPick(photo)} aria-label={photo.credit.title || "photo"}>
                  <img src={photo.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {search.loading && (
          <ul className="quiz-stock__grid quiz-stock__grid--loading" aria-label="loading photos">
            {Array.from({ length: search.photos.length ? 4 : 8 }, (_, i) => (
              <li key={i}>
                <span className="quiz-stock__photo" />
              </li>
            ))}
          </ul>
        )}

        {search.next && !search.loading && search.photos.length > 0 && (
          <button type="button" className="quiz-button quiz-stock__more" onClick={() => run(search.term, search.next)}>
            more photos
          </button>
        )}

        <p className="quiz-stock__note">photos from Openverse, under Creative Commons licences. each one’s credit stays on the card.</p>
      </div>
    </EditSheet>
  );
}
