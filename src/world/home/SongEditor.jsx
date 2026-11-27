import { useEffect, useId, useRef, useState } from "react";
import { EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { api, apiUrl, authHeaders, isBundledApp } from "../../lib/api.js";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { formatTime } from "../../shared/music/audioEngine.js";
import { audioFile, measureDuration, readSongTags, titleFromName } from "../../shared/music/songTags.js";
import { youtubeId, youtubePlayerUrl, useYoutubeEvents } from "../../shared/music/youtube.js";
import { useSongEdit } from "./useHome.js";
import HomeIcon from "./icons.jsx";

const MAX_BYTES = 15 * 1024 * 1024;

/** A picture from our own API (the cover lookup), as a File, signed in the way this client is. */
async function fetchImage(path, name = "cover.jpg") {
  const response = await fetch(apiUrl(path), { credentials: isBundledApp ? "omit" : "same-origin", headers: authHeaders() });
  if (!response.ok) throw new Error("That picture couldn’t load.");
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/** A local preview link for a File, tidied away when it changes. */
function usePreview(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/**
 * Josh's song shelf for her, in one sheet: the list (with whether she has heard each one), adding
 * a song file or a YouTube link, and fixing a song's details.
 */
export function SongsSheet({ open, onClose, songs }) {
  const [view, setView] = useState({ kind: "list" });
  const fileId = useId();
  useEffect(() => {
    if (open) setView({ kind: "list" });
  }, [open]);
  const back = () => setView({ kind: "list" });

  if (view.kind === "file") return <FileSongSheet open={open} file={view.file} onDone={back} onClose={back} />;
  if (view.kind === "youtube") return <YoutubeSongSheet open={open} onDone={back} onClose={back} />;
  if (view.kind === "edit") return <EditSongSheet open={open} song={view.song} onDone={back} onClose={back} />;

  return (
    <EditSheet open={open} onClose={onClose} title="songs for her" subtitle="each time she opens the app, one she hasn’t heard yet waits on top">
      <div className="home-edit__add-pair">
        <label className="home-edit__add" htmlFor={fileId}>
          <HomeIcon name="upload" />
          <span>upload a song file</span>
          <input
            id={fileId}
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.wav"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setView({ kind: "file", file });
            }}
          />
        </label>
        <button type="button" className="home-edit__add" onClick={() => setView({ kind: "youtube" })}>
          <HomeIcon name="link" />
          <span>add a YouTube link</span>
        </button>
      </div>
      <p className="home-edit__note">Files keep playing when her phone is locked. YouTube plays in its own little player, in the card.</p>
      {songs.length ? (
        <ul className="app-list home-edit__songs">
          {songs.map((song) => (
            <li key={song.id} className="app-row app-row--more">
              <button type="button" onClick={() => setView({ kind: "edit", song })}>
                <span className="home-edit__song-cover">{song.thumbnail ? <img src={song.thumbnail} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">♫</span>}</span>
                <span className="app-row__text">
                  <span className="home-edit__song-title">{song.title}</span>
                  <small>
                    {[song.artist, song.duration ? formatTime(song.duration) : null, song.provider === "youtube" ? "YouTube" : null].filter(Boolean).join(" · ")}
                  </small>
                </span>
                <span className="home-edit__status" data-heard={song.heardByHer || undefined}>
                  {song.heardByHer ? "heard ♡" : "new for her"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="app-empty">
          <strong>no songs yet</strong>
          <span>upload one from your phone, or paste a YouTube link.</span>
        </div>
      )}
    </EditSheet>
  );
}

// ---------- the cover picker (a song file without a picture, or a new picture for any song) ----------

function CoverPicker({ cover, onCover, query, autoLookup }) {
  const [state, setState] = useState({ status: "idle", covers: [] });
  const [thumbs, setThumbs] = useState({});
  const ownId = useId();
  const preview = usePreview(cover?.file ?? null);
  const shown = preview ?? cover?.url ?? null;
  const started = useRef(false);

  async function lookup() {
    setState({ status: "loading", covers: [] });
    try {
      const params = new URLSearchParams({ title: query.title ?? "", artist: query.artist ?? "", album: query.album ?? "" });
      const { covers } = await api(`/me/home/covers?${params}`);
      setState({ status: "done", covers });
      // Small previews, one at a time (the archive serves them; no rush).
      for (const item of covers) {
        try {
          const file = await fetchImage(`/me/home/covers/${item.id}?size=250`);
          setThumbs((old) => ({ ...old, [item.id]: URL.createObjectURL(file) }));
        } catch {
          setThumbs((old) => ({ ...old, [item.id]: false }));
        }
      }
    } catch {
      setState({ status: "error", covers: [] });
    }
  }

  useEffect(() => {
    if (autoLookup && !started.current && (query.title || query.album)) {
      started.current = true;
      lookup();
    }
  }, [autoLookup]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(thumbs).forEach((url) => url && URL.revokeObjectURL(url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (item) => {
    onCover({ loading: true, source: "lookup", id: item.id });
    try {
      const file = await fetchImage(`/me/home/covers/${item.id}`, `${item.id}.jpg`);
      onCover({ file, source: "lookup", id: item.id });
    } catch {
      onCover(null);
    }
  };
  const found = state.covers.filter((item) => thumbs[item.id] !== false);

  return (
    <div className="home-edit__cover">
      <div className="home-edit__cover-now">
        <span className="home-edit__cover-art" data-loading={cover?.loading || undefined}>
          {shown ? <img src={shown} alt="" /> : <span aria-hidden="true">♫</span>}
        </span>
        <span className="home-edit__cover-says">
          <strong>{cover?.loading ? "fetching that picture…" : shown ? "the cover" : "no cover yet"}</strong>
          <small>
            {cover?.source === "tags" ? "from inside the file" : cover?.source === "lookup" ? "from the Cover Art Archive" : cover?.source === "own" ? "your own picture" : shown ? "" : "pick one below, or leave it plain"}
          </small>
        </span>
      </div>
      <div className="home-edit__cover-actions">
        <label className="home-edit__chip" htmlFor={ownId}>
          choose my own picture
          <input
            id={ownId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onCover({ file, source: "own" });
            }}
          />
        </label>
        {state.status !== "loading" && (query.title || query.album) && (
          <button type="button" className="home-edit__chip" onClick={lookup}>
            {state.status === "idle" ? "look it up" : "look again"}
          </button>
        )}
        {shown && (
          <button type="button" className="home-edit__chip" onClick={() => onCover(null)}>
            no picture
          </button>
        )}
      </div>
      {state.status === "loading" && <p className="home-edit__note" role="status">looking for the album cover…</p>}
      {state.status === "error" && <p className="home-edit__note" role="status">The lookup didn’t answer. Try again, or choose your own.</p>}
      {state.status === "done" && !found.length && <p className="home-edit__note" role="status">No cover found for this one. Choose your own, or leave it plain.</p>}
      {found.length > 0 && (
        <ul className="home-edit__cover-grid" aria-label="Covers found">
          {found.map((item) => (
            <li key={item.id}>
              <button type="button" aria-pressed={cover?.id === item.id} onClick={() => choose(item)}>
                <span className="home-edit__cover-thumb">{thumbs[item.id] ? <img src={thumbs[item.id]} alt="" /> : <span className="home-edit__spinner" aria-hidden="true" />}</span>
                <small>
                  {item.title}
                  {item.year ? ` · ${item.year}` : ""}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uploads the chosen cover (shrunk on the phone first). */
async function uploadCover(cover) {
  if (!cover?.file) return null;
  const file = await shrinkImage(cover.file, 900, 0.88);
  return (await uploadFile(file, { folder: "songs" })).url;
}

// ---------- a song file ----------

function FileSongSheet({ open, file: picked, onDone, onClose }) {
  const { add } = useSongEdit();
  const [state, setState] = useState({ status: "reading" });
  const [fields, setFields] = useState({ title: "", artist: "", album: "" });
  const [cover, setCover] = useState(null);
  const [progress, setProgress] = useState(null);
  const file = useRef(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const usable = audioFile(picked);
      if (!usable) return setState({ status: "error", message: "That kind of file can’t play here. Use an mp3, m4a, aac or wav." });
      if (usable.size > MAX_BYTES) return setState({ status: "error", message: "Songs can be up to 15 MB. Try a smaller copy (an m4a or a 256k mp3)." });
      file.current = usable;
      let tags = { title: null, artist: null, album: null, duration: null, cover: null };
      try {
        tags = await readSongTags(usable);
      } catch {
        // No readable tags: the name of the file and the phone's own measure will do.
      }
      const duration = tags.duration ?? (await measureDuration(usable));
      if (!live) return;
      setFields({ title: tags.title ?? titleFromName(usable.name), artist: tags.artist ?? "", album: tags.album ?? "" });
      if (tags.cover) setCover({ file: tags.cover, source: "tags" });
      setState({ status: "ready", duration, hadCover: Boolean(tags.cover), tagged: Boolean(tags.title) });
    })();
    return () => {
      live = false;
    };
  }, [picked]);

  async function save() {
    setProgress(0);
    try {
      const thumbnail = await uploadCover(cover);
      const { url } = await uploadFile(file.current, { folder: "songs", onProgress: setProgress });
      await add.mutateAsync({
        upload: {
          url,
          title: fields.title.trim(),
          artist: fields.artist.trim(),
          album: fields.album.trim(),
          ...(state.duration ? { duration: state.duration } : {}),
          ...(thumbnail ? { thumbnail, art: cover.source } : {}),
        },
      });
      onDone();
      return false;
    } finally {
      setProgress(null);
    }
  }

  const ready = state.status === "ready";
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="a new song"
      subtitle={picked.name}
      dirty={ready}
      saveLabel="Add"
      saveDisabled={!ready || !fields.title.trim() || cover?.loading}
      onSave={save}
    >
      {state.status === "reading" && <p className="home-edit__note" role="status">reading the song’s details…</p>}
      {state.status === "error" && (
        <p className="home-edit__problem" role="alert">
          {state.message}
        </p>
      )}
      {ready && (
        <>
          <CoverPicker cover={cover} onCover={setCover} query={fields} autoLookup={!state.hadCover} />
          <EditField label="title" hint={state.tagged ? "from the file’s tags" : "from the file’s name"}>
            <input className="home-edit__input" value={fields.title} maxLength={120} onChange={(event) => setFields({ ...fields, title: event.target.value })} />
          </EditField>
          <EditField label="artist">
            <input className="home-edit__input" value={fields.artist} maxLength={120} onChange={(event) => setFields({ ...fields, artist: event.target.value })} />
          </EditField>
          <EditField label="album">
            <input className="home-edit__input" value={fields.album} maxLength={120} onChange={(event) => setFields({ ...fields, album: event.target.value })} />
          </EditField>
          <p className="home-edit__facts">
            <span>length {state.duration ? formatTime(state.duration) : "unknown"}</span>
            <span>{(file.current.size / 1024 / 1024).toFixed(1)} MB</span>
          </p>
          {progress !== null && (
            <p className="home-edit__uploading" role="status">
              uploading… {progress ? `${Math.round(progress)}%` : ""}
            </p>
          )}
        </>
      )}
    </EditSheet>
  );
}

// ---------- a YouTube link ----------

function ProbePlayer({ id, onDuration }) {
  const frame = useRef(null);
  const player = useYoutubeEvents(frame, id);
  useEffect(() => {
    if (player.duration) onDuration(player.duration);
  }, [player.duration]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="home-song__player home-edit__player">
      <iframe ref={frame} title="YouTube preview" src={youtubePlayerUrl(id, { probe: true })} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

function YoutubeSongSheet({ open, onDone, onClose }) {
  const { add } = useSongEdit();
  const [link, setLink] = useState("");
  const [found, setFound] = useState(null);
  const [problem, setProblem] = useState(null);
  const [fields, setFields] = useState({ title: "", artist: "" });
  const [duration, setDuration] = useState(null);
  const id = youtubeId(link);

  useEffect(() => {
    setFound(null);
    setDuration(null);
    setProblem(null);
    if (!id) return undefined;
    let live = true;
    api(`/me/home/youtube?url=${encodeURIComponent(link.trim())}`)
      .then((data) => {
        if (!live) return;
        setFound(data);
        setFields({ title: data.title ?? "", artist: data.artist ?? "" });
      })
      .catch((error) => live && setProblem(error.message));
    return () => {
      live = false;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="a YouTube song"
      dirty={Boolean(link)}
      saveLabel="Add"
      saveDisabled={!found || !fields.title.trim()}
      error={problem}
      onSave={async () => {
        await add.mutateAsync({ url: found.url, title: fields.title.trim(), artist: fields.artist.trim(), ...(duration ? { duration } : {}) });
        onDone();
        return false;
      }}
    >
      <EditField label="link" hint="paste it from the YouTube app (Share → Copy link)">
        <input
          className="home-edit__input"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          value={link}
          placeholder="https://youtu.be/…"
          onChange={(event) => setLink(event.target.value)}
        />
      </EditField>
      {link && !id && <p className="home-edit__note">That doesn’t look like a YouTube video link yet.</p>}
      {id && <ProbePlayer id={id} onDuration={setDuration} />}
      {found && (
        <>
          <EditField label="title" hint="YouTube titles can be long; trim it to the song’s name">
            <input className="home-edit__input" value={fields.title} maxLength={120} onChange={(event) => setFields({ ...fields, title: event.target.value })} />
          </EditField>
          <EditField label="artist">
            <input className="home-edit__input" value={fields.artist} maxLength={120} onChange={(event) => setFields({ ...fields, artist: event.target.value })} />
          </EditField>
          <p className="home-edit__facts">
            <span>length {duration ? formatTime(duration) : "reading it from the player…"}</span>
          </p>
        </>
      )}
    </EditSheet>
  );
}

// ---------- fixing a song ----------

function EditSongSheet({ open, song, onDone, onClose }) {
  const { update, remove } = useSongEdit();
  const [fields, setFields] = useState({ title: song.title ?? "", artist: song.artist ?? "", album: song.album ?? "" });
  const [cover, setCover] = useState(song.thumbnail ? { url: song.thumbnail, source: "current" } : null);
  const [duration, setDuration] = useState(song.duration ?? null);
  const changedCover = (cover?.url ?? null) !== (song.thumbnail ?? null) || Boolean(cover?.file);
  const dirty =
    fields.title !== (song.title ?? "") || fields.artist !== (song.artist ?? "") || fields.album !== (song.album ?? "") || changedCover || duration !== (song.duration ?? null);
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="this song"
      subtitle={song.heardByHer ? "she’s heard it ♡" : "she hasn’t heard it yet"}
      dirty={dirty}
      saveDisabled={!dirty || !fields.title.trim() || cover?.loading}
      onSave={async () => {
        const body = { id: song.id, title: fields.title.trim(), artist: fields.artist.trim() };
        if (song.provider === "audio") body.album = fields.album.trim();
        if (duration !== (song.duration ?? null)) body.duration = duration;
        if (changedCover) body.thumbnail = cover?.file ? await uploadCover(cover) : (cover?.url ?? null);
        await update.mutateAsync(body);
        onDone();
        return false;
      }}
      onDelete={async () => {
        await remove.mutateAsync(song.id);
        onDone();
        return false;
      }}
      deleteLabel="Remove this song"
    >
      <CoverPicker cover={cover} onCover={setCover} query={fields} autoLookup={false} />
      <EditField label="title">
        <input className="home-edit__input" value={fields.title} maxLength={120} onChange={(event) => setFields({ ...fields, title: event.target.value })} />
      </EditField>
      <EditField label="artist">
        <input className="home-edit__input" value={fields.artist} maxLength={120} onChange={(event) => setFields({ ...fields, artist: event.target.value })} />
      </EditField>
      {song.provider === "audio" && (
        <EditField label="album">
          <input className="home-edit__input" value={fields.album} maxLength={120} onChange={(event) => setFields({ ...fields, album: event.target.value })} />
        </EditField>
      )}
      <p className="home-edit__facts">
        <span>length {duration ? formatTime(duration) : "unknown"}</span>
        <span>{song.provider === "youtube" ? "YouTube" : "song file"}</span>
      </p>
      {song.provider === "youtube" && !song.duration && <ProbePlayer id={song.embedId} onDuration={setDuration} />}
    </EditSheet>
  );
}
