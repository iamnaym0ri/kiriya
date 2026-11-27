import { useEffect, useId, useRef, useState } from "react";
import { EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { DEFAULT_GREETING, defaultCaptions, defaultPhotos } from "./stage.js";
import { useHomeEdit } from "./useHome.js";
import HomeIcon from "./icons.jsx";

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Keeps a draft copy while the sheet is open, fresh each time it opens. */
function useDraft(open, initial) {
  const [draft, setDraft] = useState(initial);
  const start = useRef(initial);
  useEffect(() => {
    if (open) {
      start.current = initial;
      setDraft(initial);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return [draft, setDraft, !same(draft, start.current)];
}

// ---------- the greeting ----------

export function GreetingSheet({ open, onClose, greeting }) {
  const save = useHomeEdit("/greeting");
  const [draft, setDraft, dirty] = useDraft(open, greeting ?? "");
  const text = draft.trim();
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="the greeting"
      subtitle="the first words she reads, above her name"
      dirty={dirty}
      saveDisabled={!dirty}
      onSave={() => save.mutateAsync({ greeting: text && text !== DEFAULT_GREETING ? text : null })}
    >
      <EditField label="greeting" hint={`${draft.length}/60 · empty goes back to “${DEFAULT_GREETING}”`}>
        <input
          className="home-edit__input"
          value={draft}
          maxLength={60}
          placeholder={DEFAULT_GREETING}
          enterKeyHint="done"
          onChange={(event) => setDraft(event.target.value)}
        />
      </EditField>
      <div className="home-edit__preview home-edit__preview--greeting" aria-hidden="true">
        <span className="handwritten">{text || DEFAULT_GREETING}</span>
        <span className="home-edit__preview-name">kiriya</span>
      </div>
      <p className="home-edit__note">On her birthday it says “happy birthday,” instead.</p>
    </EditSheet>
  );
}

// ---------- the photos ----------

async function sizeOf(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return {};
  }
}

export function PhotosSheet({ open, onClose, stage }) {
  const save = useHomeEdit("/photos");
  const [draft, setDraft, dirty] = useDraft(open, stage.photos);
  const [uploading, setUploading] = useState([]);
  const [problem, setProblem] = useState(null);
  const inputId = useId();
  const move = (from, to) =>
    setDraft((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const change = (id, patch) => setDraft((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function add(files) {
    setProblem(null);
    for (const original of files) {
      const key = newId("up");
      setUploading((list) => [...list, { key, name: original.name, progress: 0 }]);
      try {
        const file = await shrinkImage(original, 1800, 0.86);
        const [{ url }, size] = await Promise.all([
          uploadFile(file, { folder: "cosplay", onProgress: (progress) => setUploading((list) => list.map((item) => (item.key === key ? { ...item, progress } : item))) }),
          sizeOf(file),
        ]);
        setDraft((list) => [...list, { id: newId("photo"), src: url, alt: "", focus: "center", ownCaptionsOnly: false, ...size }]);
      } catch (error) {
        setProblem(error?.message || "That photo couldn’t upload. Try again?");
      } finally {
        setUploading((list) => list.filter((item) => item.key !== key));
      }
    }
  }

  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="her photos"
      subtitle="she swipes through them; a different one opens first every two days"
      dirty={dirty}
      saveDisabled={!dirty || uploading.length > 0 || !draft.length}
      error={problem}
      onSave={() => save.mutateAsync({ photos: same(draft, defaultPhotos()) ? null : draft })}
    >
      <label className="home-edit__add" htmlFor={inputId}>
        <HomeIcon name="plus" />
        <span>add photos from your phone</span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = [...event.target.files];
            event.target.value = "";
            add(files);
          }}
        />
      </label>
      {uploading.map((item) => (
        <p key={item.key} className="home-edit__uploading" role="status">
          uploading {item.name}… {item.progress ? `${Math.round(item.progress)}%` : ""}
        </p>
      ))}
      {!draft.length && <p className="home-edit__note">Add at least one photo.</p>}
      <ol className="home-edit__photos">
        {draft.map((item, i) => (
          <li key={item.id} className="home-edit__photo">
            <img src={item.src} alt="" style={{ objectPosition: `50% ${item.focus === "top" ? "18%" : item.focus === "bottom" ? "82%" : "50%"}` }} />
            <div className="home-edit__photo-fields">
              <EditField label={`photo ${i + 1}`} hint="what’s in it, for VoiceOver">
                <input className="home-edit__input" value={item.alt} maxLength={200} placeholder="Kiriya in her Maomao cosplay…" onChange={(event) => change(item.id, { alt: event.target.value })} />
              </EditField>
              <div className="home-edit__segmented" role="group" aria-label={`Keep in view, photo ${i + 1}`}>
                {["top", "center", "bottom"].map((focus) => (
                  <button key={focus} type="button" aria-pressed={item.focus === focus} onClick={() => change(item.id, { focus })}>
                    {focus === "center" ? "middle" : focus}
                  </button>
                ))}
              </div>
              <div className="home-edit__row-actions">
                <button type="button" className="home-edit__icon-button" aria-label={`Move photo ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <HomeIcon name="up" />
                </button>
                <button type="button" className="home-edit__icon-button" aria-label={`Move photo ${i + 1} down`} disabled={i === draft.length - 1} onClick={() => move(i, i + 1)}>
                  <HomeIcon name="down" />
                </button>
                <button type="button" className="home-edit__remove" onClick={() => setDraft((list) => list.filter((other) => other.id !== item.id))}>
                  remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {stage.custom.photos && (
        <button type="button" className="home-edit__reset" onClick={() => setDraft(defaultPhotos())}>
          go back to the original photos
        </button>
      )}
    </EditSheet>
  );
}

// ---------- the captions ----------

export function CaptionsSheet({ open, onClose, stage, currentPhoto }) {
  const save = useHomeEdit("/captions");
  const initial = { captions: stage.captions, pinned: stage.pinned };
  const [draft, setDraft, dirty] = useDraft(open, initial);
  const [fresh, setFresh] = useState("");
  const { captions, pinned } = draft;
  const photoLabel = (id) => {
    const at = stage.photos.findIndex((item) => item.id === id);
    return at < 0 ? "a photo that’s gone" : `photo ${at + 1}`;
  };
  const change = (id, patch) => setDraft((value) => ({ ...value, captions: value.captions.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  const add = () => {
    const text = fresh.trim();
    if (!text) return;
    setDraft((value) => ({ ...value, captions: [{ id: newId("caption"), text, photo: null }, ...value.captions] }));
    setFresh("");
  };
  const valid = captions.length > 0 && captions.every((item) => item.text.trim());
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="the captions"
      subtitle={`${captions.length} under her photos, a new one every two hours`}
      dirty={dirty}
      saveDisabled={!dirty || !valid}
      onSave={() =>
        save.mutateAsync({
          captions: same(captions, defaultCaptions()) ? null : captions.map((item) => ({ ...item, text: item.text.trim() })),
          pinned: pinned && captions.some((item) => item.id === pinned) ? pinned : null,
        })
      }
    >
      <EditField label="a new caption" hint={`${fresh.length}/160`}>
        <textarea className="home-edit__input" rows={2} maxLength={160} value={fresh} placeholder="ur cosplay is cute. u make it unforgettable. ♡" onChange={(event) => setFresh(event.target.value)} />
      </EditField>
      <button type="button" className="home-edit__button" disabled={!fresh.trim()} onClick={add}>
        add it to the list
      </button>
      <p className="home-edit__note">
        Pin one to keep it under the photos until you unpin it.
      </p>
      <ol className="home-edit__captions">
        {captions.map((item) => (
          <li key={item.id} className="home-edit__caption" data-pinned={pinned === item.id || undefined}>
            <textarea
              className="home-edit__input home-edit__caption-text"
              rows={2}
              maxLength={160}
              value={item.text}
              aria-label="Caption"
              onChange={(event) => change(item.id, { text: event.target.value })}
            />
            <div className="home-edit__row-actions">
              <button
                type="button"
                className="home-edit__chip"
                aria-pressed={pinned === item.id}
                onClick={() => setDraft((value) => ({ ...value, pinned: value.pinned === item.id ? null : item.id }))}
              >
                {pinned === item.id ? "📌 pinned" : "pin"}
              </button>
              <select
                className="home-edit__select"
                aria-label="Shows under"
                value={item.photo ?? ""}
                onChange={(event) => change(item.id, { photo: event.target.value || null })}
              >
                <option value="">under any photo</option>
                {item.photo && !stage.photos.some((photo) => photo.id === item.photo) && <option value={item.photo}>only under {photoLabel(item.photo)}</option>}
                {stage.photos.map((photo, i) => (
                  <option key={photo.id} value={photo.id}>
                    only under photo {i + 1}
                    {photo.id === currentPhoto?.id ? " (showing now)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="home-edit__remove"
                onClick={() => setDraft((value) => ({ ...value, captions: value.captions.filter((other) => other.id !== item.id), pinned: value.pinned === item.id ? null : value.pinned }))}
              >
                remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      {stage.custom.captions && (
        <button type="button" className="home-edit__reset" onClick={() => setDraft({ captions: defaultCaptions(), pinned: null })}>
          go back to the original captions
        </button>
      )}
    </EditSheet>
  );
}
