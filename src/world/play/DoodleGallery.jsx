import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { Modal } from "../../shared/WorldPrimitives.jsx";
import { usePrefs, useSetPin } from "../../lib/prefs.js";
import { downloadBlob, groupArtworksByDate } from "../studio/drawingTools.js";

export default function DoodleGallery({ open, onToggle }) {
  const client = useQueryClient();
  const gallery = useQuery({ queryKey: ["me", "artworks"], queryFn: () => api("/me/artworks") });
  const [adding, setAdding] = useState(false), [file, setFile] = useState(null), [caption, setCaption] = useState("");
  const [viewId, setViewId] = useState(null), [date, setDate] = useState("all"), [downloadError, setDownloadError] = useState("");
  const artworks = gallery.data?.artworks ?? [];
  const prefs = usePrefs(), setPin = useSetPin();
  const pinned = new Set((prefs.data?.pins ?? []).map(pin => pin.id));
  const groups = groupArtworksByDate(artworks);
  const index = artworks.findIndex(art => art.id === viewId), viewing = artworks[index];
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPG or WebP picture.");
      const picture = await shrinkImage(file);
      const bitmap = await createImageBitmap(picture);
      const width = bitmap.width, height = bitmap.height; bitmap.close();
      const stored = await uploadFile(picture, { folder: "art" });
      return api("/me/artworks", { method: "POST", body: { ...stored, prompt: caption.trim() || null, width, height } });
    },
    onSuccess: () => { setAdding(false); setFile(null); setCaption(""); setDate("all"); onToggle(true); client.invalidateQueries({ queryKey: ["me", "artworks"] }); },
  });
  const remove = useMutation({
    mutationFn: id => api(`/me/artworks/${id}`, { method: "DELETE" }),
    onSuccess: () => { setViewId(null); setDate("all"); client.invalidateQueries({ queryKey: ["me", "artworks"] }); },
  });
  async function download() {
    setDownloadError("");
    try {
      const response = await fetch(viewing.url);
      if (!response.ok) throw new Error("This picture couldn't be downloaded. Try again.");
      const blob = await response.blob();
      const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
      downloadBlob(blob, `kiriya-art-${viewing.id}.${ext}`);
    } catch (error) { setDownloadError(error.message); }
  }
  return <div className="doodle-keepsakes">
    <div className="doodle-keepsakes__links">
      <button className="doodle-link" aria-expanded={open} aria-controls="doodle-gallery" onClick={() => onToggle(!open)}>♡ Your gallery{artworks.length ? ` · ${artworks.length}` : ""} <span aria-hidden="true">{open ? "−" : "+"}</span></button>
      <button className="doodle-link" onClick={() => { upload.reset(); setAdding(true); }}>Add artwork ↗</button>
    </div>
    {open && <section className="doodle-gallery" id="doodle-gallery" aria-label="Your doodles by date">
      <h3>little things you’ve made ♡</h3>
      <p>Saved doodles & uploaded artwork, tucked away by date.</p>
      {gallery.isPending ? <p role="status">Opening your saved pages…</p> : gallery.isError ? <button className="doodle-link" onClick={() => gallery.refetch()}>Your pages couldn’t load. Try again ↻</button>
        : artworks.length === 0 ? <p className="doodle-gallery__empty">Your first little masterpiece goes here. Save a doodle or add something you’ve made.</p>
        : <>
          {groups.length > 1 && <label className="doodle-date-filter">Find a day <select value={date} onChange={event => setDate(event.target.value)}><option value="all">All your days</option>{groups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>}
          {groups.filter(group => date === "all" || date === group.key).map(group => <section key={group.key} className="doodle-gallery__day" aria-label={group.label}>
            <h4><time dateTime={group.key === "undated" ? undefined : group.key}>{group.label}</time><span>{group.artworks.length} {group.artworks.length === 1 ? "page" : "pages"}</span></h4>
            <ul>{group.artworks.map(art => <li key={art.id}><button onClick={() => { setViewId(art.id); remove.reset(); setPin.reset(); setDownloadError(""); }} aria-label={`Open ${art.prompt || "saved doodle"}`}>
              <img src={art.url} loading="lazy" alt={art.prompt || "A saved doodle"} /><span>{pinned.has(art.id) && <span className="doodle-pinned" title="Pinned to your public profile">📌 </span>}{art.prompt || "a little untitled thing"}</span>
            </button></li>)}</ul>
          </section>)}
        </>}
    </section>}
    {adding && <Modal title="Add a little masterpiece" className="doodle-dialog" onClose={() => { if (!upload.isPending) setAdding(false); }}>
      <form className="collection-form" onSubmit={event => { event.preventDefault(); upload.mutate(); }}>
        <fieldset disabled={upload.isPending}>
          <label>Artwork<input required className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { setFile(event.target.files?.[0] ?? null); upload.reset(); }} /></label>
          <label>Title or a little note<input className="field" value={caption} maxLength={300} onChange={event => setCaption(event.target.value)} /></label>
          <button className="button-plum" disabled={!file}>{upload.isPending ? "Tucking it away…" : "Save to your gallery ♡"}</button>
        </fieldset>
        {upload.error && <p role="alert">{upload.error.message}</p>}
      </form>
    </Modal>}
    {viewing && <Modal title={viewing.prompt || "A little saved doodle"} className="gallery-dialog doodle-dialog" onClose={() => { if (!remove.isPending) setViewId(null); }}>
      <img src={viewing.url} alt={viewing.prompt || "A saved doodle"} />
      <p>{groupArtworksByDate([viewing])[0].label}</p>
      <div className="doodle-viewer-actions">
        <button className="doodle-link" disabled={remove.isPending || artworks.length < 2} onClick={() => { setViewId(artworks[(index + artworks.length - 1) % artworks.length].id); setPin.reset(); setDownloadError(""); }}>← Previous</button>
        <button className="doodle-link" onClick={download}>Download image ↗</button>
        <button className="doodle-link" disabled={remove.isPending || artworks.length < 2} onClick={() => { setViewId(artworks[(index + 1) % artworks.length].id); setPin.reset(); setDownloadError(""); }}>Next →</button>
      </div>
      <button className="doodle-link doodle-pin-toggle" aria-pressed={pinned.has(viewing.id)} disabled={setPin.isPending || !prefs.data} onClick={() => setPin.mutate({ id: viewing.id, pinned: !pinned.has(viewing.id) })}>
        {setPin.isPending ? "Pinning…" : pinned.has(viewing.id) ? "📌 Pinned to your public profile · unpin" : "📌 Pin to your public profile"}
      </button>
      <button className="doodle-link" disabled={remove.isPending} onClick={() => { if (window.confirm("Delete this saved artwork? This cannot be undone.")) remove.mutate(viewing.id); }}>{remove.isPending ? "Removing…" : "Delete saved artwork"}</button>
      {(remove.error || setPin.error || downloadError) && <p role="alert">{remove.error?.message || setPin.error?.message || downloadError}</p>}
    </Modal>}
  </div>;
}
