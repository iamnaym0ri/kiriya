import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../lib/api.js";
import { haptic } from "../../../../../lib/native.js";
import { shrinkImage, uploadFile } from "../../../../../lib/uploads.js";
import { celebrate } from "../../../../../shared/effects.js";
import { AdminEdit, EditField, EditSheet } from "../../../../../shared/admin/AdminEdit.jsx";
import PastimeShell, { PastimeSheet, PausedCard, prefersLessMotion, usePause, useSize } from "../_shared/PastimeShell.jsx";
import { play } from "../_shared/sound.js";
import { load, rewardOnce, save } from "../_shared/storage.js";
import { scenePicture, svgUrl } from "../spot-difference/scenes.js";
import { SIZES, canSlide, gapOf, isPuzzle, isSolved, newPuzzle, slide } from "./engine.js";
import "./Game.css";

const GAME = "slide-us";
const PHOTOS_KEY = ["pastime", "slide-photos"];
const MAX_PHOTOS = 40;

// Our own drawn pictures, so the puzzle is lovely before any photo is added.
const DRAWN = [0, 1, 2, 3].map((i) => {
  const picture = scenePicture(i, 11 + i * 7);
  return { id: picture.id, url: svgUrl(picture.svg), caption: picture.title, drawn: true };
});

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function restore() {
  const saved = load(GAME) ?? {};
  return {
    pictureId: saved.pictureId ?? null,
    n: SIZES.includes(saved.n) ? saved.n : 3,
    puzzle: isPuzzle(saved.puzzle) ? saved.puzzle : null,
    seconds: Number.isInteger(saved.seconds) ? saved.seconds : 0,
    solved: saved.solved ?? 0,
    best: saved.best ?? {},
    seen: Array.isArray(saved.seen) ? saved.seen : [],
  };
}

/** Josh's photo shelf for the puzzle, edited where she plays it. */
function PhotoEditor({ open, photos, onClose }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(photos);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState(null);
  const input = useRef(null);
  useEffect(() => {
    if (open) {
      setDraft(photos);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveList = useMutation({
    mutationFn: (list) => api("/me/games/pastime/slide-photos", { method: "PUT", body: { photos: list } }),
    onSuccess: (data) => queryClient.setQueryData(PHOTOS_KEY, data),
  });

  async function add(files) {
    const picked = [...files].slice(0, MAX_PHOTOS - draft.length);
    setError(null);
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      try {
        const small = await shrinkImage(file, 1400);
        const { url } = await uploadFile(small, { folder: "photos" });
        setDraft((list) => [...list, { url, caption: "" }]);
      } catch (err) {
        setError(err?.message || "That photo didn't upload. Try again?");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }
  const update = (i, change) => setDraft((list) => list.map((photo, k) => (k === i ? { ...photo, ...change } : photo)));
  const moveUp = (i) => setDraft((list) => (i === 0 ? list : [...list.slice(0, i - 1), list[i], list[i - 1], ...list.slice(i + 1)]));

  return (
    <EditSheet open={open} title="puzzle photos" subtitle="she slides these back together" onClose={onClose}
      onSave={() => saveList.mutateAsync(draft)} saveDisabled={uploading > 0} dirty={draft !== photos} error={error}>
      <div className="slide-editor">
        {draft.length === 0 && <p className="slide-editor__empty">No photos yet: she plays with the drawn pictures until you add some.</p>}
        {draft.map((photo, i) => (
          <div key={photo.id ?? photo.url} className="slide-editor__row">
            <img src={photo.url} alt="" />
            <EditField label={`photo ${i + 1}`} hint="a few words she sees when it's done (optional)">
              <input type="text" value={photo.caption ?? ""} maxLength={80} placeholder="us at the beach" onChange={(event) => update(i, { caption: event.target.value })} />
            </EditField>
            <div className="slide-editor__tools">
              <button type="button" onClick={() => moveUp(i)} disabled={i === 0} aria-label={`Move photo ${i + 1} up`}>↑</button>
              <button type="button" onClick={() => setDraft((list) => list.filter((_, k) => k !== i))} aria-label={`Remove photo ${i + 1}`}>✕</button>
            </div>
          </div>
        ))}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(event) => { add(event.target.files); event.target.value = ""; }} />
        <button type="button" className="slide-editor__add" onClick={() => input.current?.click()} disabled={draft.length >= MAX_PHOTOS}>
          {uploading ? `adding ${uploading} photo${uploading > 1 ? "s" : ""}…` : "+ add photos from your phone"}
        </button>
      </div>
    </EditSheet>
  );
}

const HELP = (
  <>
    <p>The picture has been cut into squares and mixed up. Slide them back.</p>
    <ul>
      <li>Tap a square next to the gap to slide it in. Tap one further along the same row or column to slide the whole line.</li>
      <li>Hold <b>peek</b> to see the whole picture.</li>
      <li><b>numbers</b> shows where each square belongs, for the trickier ones.</li>
      <li>3×3 is a gentle start; 5×5 takes a while. Your puzzle waits for you if you leave.</li>
    </ul>
  </>
);

export default function SlideUs({ onReward }) {
  const initial = useMemo(restore, []);
  const photosQuery = useQuery({ queryKey: PHOTOS_KEY, queryFn: () => api("/me/games/pastime/slide-photos"), staleTime: 30_000 });
  const photos = photosQuery.data?.photos ?? [];
  const pictures = useMemo(() => [...photos, ...DRAWN], [photos]);
  const [state, setState] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [peek, setPeek] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [finished, setFinished] = useState(false);
  const { paused, resume } = usePause();
  const stage = useRef(null);
  const board = useRef(null);
  const { width, height } = useSize(stage);
  const calm = prefersLessMotion();

  const picture = pictures.find((each) => each.id === state.pictureId) ?? pictures[0];
  const n = state.n;
  const puzzle = state.puzzle && state.puzzle.n === n && state.pictureId === picture.id ? state.puzzle : null;
  const solvedNow = puzzle ? isSolved(puzzle) : false;

  // A fresh mix when the picture or size changes (or nothing was saved).
  useEffect(() => {
    if (!picture || puzzle) return;
    setState((old) => ({ ...old, pictureId: picture.id, puzzle: newPuzzle(old.n), seconds: 0 }));
  }, [picture?.id, n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => save(GAME, state), [state]);

  // The clock runs only while she's playing.
  useEffect(() => {
    if (paused || !puzzle || solvedNow || peek) return undefined;
    const id = setInterval(() => setState((old) => ({ ...old, seconds: old.seconds + 1 })), 1000);
    return () => clearInterval(id);
  }, [paused, puzzle, solvedNow, peek]);

  // New photos from Josh carry a little "new" until she's opened them.
  const unseen = new Set(photos.filter((photo) => !state.seen.includes(photo.id)).map((photo) => photo.id));

  function choose(id, size = n) {
    if (id === picture.id && size === n) return;
    play("tap");
    setFinished(false);
    setState((old) => ({ ...old, pictureId: id, n: size, puzzle: newPuzzle(size), seconds: 0, seen: unseen.has(id) ? [...old.seen, id] : old.seen }));
  }
  function remix() {
    setFinished(false);
    setState((old) => ({ ...old, puzzle: newPuzzle(old.n), seconds: 0 }));
    play("swap");
  }

  function tap(index) {
    if (!puzzle || solvedNow || paused) return;
    if (!canSlide(puzzle, index)) {
      play("nope");
      return;
    }
    const next = slide(puzzle, index);
    play("tap");
    haptic("light");
    setState((old) => ({ ...old, puzzle: next }));
    if (isSolved(next)) {
      const key = `${picture.id}:${n}`;
      setState((old) => {
        const best = old.best[key];
        const record = !best || next.moves < best.moves ? { moves: next.moves, seconds: old.seconds } : best;
        return { ...old, puzzle: next, solved: old.solved + 1, best: { ...old.best, [key]: record } };
      });
      play("win", 3);
      haptic("success");
      setTimeout(() => {
        const rect = board.current?.getBoundingClientRect();
        if (rect) celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }, 0.9);
        setFinished(true);
      }, calm ? 100 : 650);
      rewardOnce(onReward, { sticker: "st-polaroid", game: GAME, reason: "first picture put back together" });
      if (n === 5) rewardOnce(onReward, { sticker: "st-bow", game: GAME, reason: "first five by five" });
    }
  }

  const boardPx = Math.max(240, Math.floor(Math.min(width, height)) || 320);
  const gap = solvedNow ? 0 : Math.max(2, Math.round(boardPx / 120));
  const cell = (boardPx - gap * (n - 1)) / n;
  const gapIndex = puzzle ? gapOf(puzzle) : -1;
  const best = state.best[`${picture?.id}:${n}`];

  return (
    <PastimeShell game={GAME} kicker="us, in pieces · slide them home" help={HELP}>
      <div className="slide">
        <div className="slide-pictures" role="listbox" aria-label="Pictures">
          {pictures.map((each) => (
            <button key={each.id} type="button" role="option" aria-selected={each.id === picture?.id} className="slide-thumb"
              onClick={() => choose(each.id)} aria-label={each.caption || (each.drawn ? "a drawn picture" : "a photo")}>
              <img src={each.url} alt="" draggable="false" />
              {unseen.has(each.id) && <span className="slide-thumb__new">new</span>}
            </button>
          ))}
          <AdminEdit label="photos" onClick={() => setEditing(true)} className="slide-admin" />
        </div>
        <div className="slide-bar">
          <div className="slide-sizes" role="radiogroup" aria-label="How many pieces">
            {SIZES.map((size) => (
              <button key={size} type="button" role="radio" aria-checked={size === n} onClick={() => choose(picture.id, size)}>
                {size}×{size}
              </button>
            ))}
          </div>
          <span className="slide-count">{puzzle?.moves ?? 0} move{puzzle?.moves === 1 ? "" : "s"} · {clock(state.seconds)}</span>
        </div>
        <div className="slide-stage" ref={stage}>
          <div ref={board} className="slide-board" data-solved={solvedNow || undefined} style={{ width: boardPx, height: boardPx }}
            role="grid" aria-label={`Sliding puzzle, ${n} by ${n}`}>
            {puzzle && puzzle.tiles.map((tile, at) => {
              const home = { r: Math.floor(tile / n), c: tile % n };
              const isGap = at === gapIndex;
              if (isGap && !solvedNow) return null;
              const r = Math.floor(at / n), c = at % n;
              return (
                <button key={tile} type="button" className="slide-tile" data-gap={isGap || undefined}
                  style={{ width: cell, height: cell, transform: `translate3d(${c * (cell + gap)}px, ${r * (cell + gap)}px, 0)` }}
                  onClick={() => tap(at)} aria-label={`piece ${tile + 1}${canSlide(puzzle, at) ? ", can slide" : ""}`} tabIndex={canSlide(puzzle, at) ? 0 : -1}>
                  <img src={picture.url} alt="" draggable="false"
                    style={{ width: boardPx, height: boardPx, transform: `translate3d(${-home.c * (cell + gap)}px, ${-home.r * (cell + gap)}px, 0)` }} />
                  {numbers && !solvedNow && <span className="slide-tile__n">{tile + 1}</span>}
                </button>
              );
            })}
            {peek && <img className="slide-peek" src={picture.url} alt="" draggable="false" />}
          </div>
        </div>
        <div className="slide-foot">
          <button type="button" className="pastime-button pastime-button--small slide-peek-button"
            onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)}
            onKeyDown={(event) => (event.key === " " || event.key === "Enter") && setPeek(true)} onKeyUp={() => setPeek(false)}>
            peek 👀
          </button>
          <button type="button" className="pastime-button pastime-button--small" aria-pressed={numbers} onClick={() => setNumbers((on) => !on)}>
            numbers {numbers ? "on" : "off"}
          </button>
          <button type="button" className="pastime-button pastime-button--small" onClick={remix}>mix ↺</button>
        </div>
      </div>
      {paused && puzzle && !solvedNow && <PausedCard onResume={resume} line="the pieces stayed right where you left them." />}
      <PastimeSheet open={finished} title="all in one piece ♡" closeLabel={null}>
        {picture?.caption && <p className="slide-caption">{picture.caption}</p>}
        <p>{n}×{n} in {puzzle?.moves} moves and {clock(state.seconds)}{best && best.moves < (puzzle?.moves ?? 0) ? ` (best: ${best.moves} moves)` : best ? ", your best yet." : "."}</p>
        <div className="slide-done-actions">
          <button type="button" className="pastime-button" onClick={() => setFinished(false)}>look at it</button>
          <button type="button" className="pastime-button pastime-button--primary" onClick={() => {
            const i = pictures.findIndex((each) => each.id === picture.id);
            choose(pictures[(i + 1) % pictures.length].id);
          }}>next picture →</button>
        </div>
      </PastimeSheet>
      <PhotoEditor open={editing} photos={photos} onClose={() => setEditing(false)} />
    </PastimeShell>
  );
}
