import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { uploadFile } from "../../lib/uploads.js";
import { useMusic } from "../../shared/music/MusicRoom.jsx";
import "./SongShelf.css";

export default function SongShelf() {
  const queryClient = useQueryClient();
  const songs = useQuery({
    queryKey: ["me", "songs"],
    queryFn: () => api("/me/songs"),
  });
  const [link, setLink] = useState("");
  const music = useMusic();
  const [upload, setUpload] = useState({ file: null, title: "", artist: "" });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["me", "songs"] });
    queryClient.invalidateQueries({ queryKey: ["public-profile"] });
  };

  const addLink = useMutation({
    mutationFn: () => api("/me/songs", { method: "POST", body: { url: link } }),
    onSuccess: () => {
      setLink("");
      refresh();
    },
  });
  const addUpload = useMutation({
    mutationFn: async () => {
      const stored = await uploadFile(upload.file, { folder: "songs" });
      return api("/me/songs", {
        method: "POST",
        body: {
          upload: {
            url: stored.url,
            title: upload.title,
            artist: upload.artist,
          },
        },
      });
    },
    onSuccess: () => {
      setUpload({ file: null, title: "", artist: "" });
      refresh();
    },
  });
  const feature = useMutation({
    mutationFn: (id) =>
      api(`/me/songs/${id}`, { method: "PATCH", body: { featured: true } }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/me/songs/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const list = songs.data?.songs ?? [];

  return (
    <section className="shelf" aria-labelledby="shelf-title">
      <h2 id="shelf-title" className="stage__section-title">
        Your songs
      </h2>
      <p className="shelf__hint">
        The starred song plays on your public profile.
      </p>

      <form
        className="shelf__add"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) addLink.mutate();
        }}
      >
        <input
          className="field"
          aria-label="Song link"
          type="url"
          inputMode="url"
          placeholder="Paste a YouTube, Spotify, SoundCloud or niconico link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn--primary btn--small"
          disabled={!link.trim() || addLink.isPending}
        >
          {addLink.isPending ? "Adding…" : "Add"}
        </button>
      </form>
      {addLink.error && <p className="shelf__error">{addLink.error.message}</p>}

      <details className="shelf__upload">
        <summary>Upload a recording (like a cover you sang)</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (upload.file && upload.title.trim()) addUpload.mutate();
          }}
        >
          <input
            className="field"
            aria-label="Audio recording"
            type="file"
            accept="audio/*"
            onChange={(e) =>
              setUpload({
                ...upload,
                file: e.target.files?.[0] ?? null,
                title:
                  upload.title ||
                  (e.target.files?.[0]?.name.replace(/\.\w+$/, "") ?? ""),
              })
            }
          />
          <input
            className="field"
            aria-label="Recording title"
            placeholder="Title"
            value={upload.title}
            onChange={(e) => setUpload({ ...upload, title: e.target.value })}
          />
          <input
            className="field"
            aria-label="Recording artist"
            placeholder="Artist or credit (optional)"
            value={upload.artist}
            onChange={(e) => setUpload({ ...upload, artist: e.target.value })}
          />
          <button
            type="submit"
            className="btn btn--soft btn--small"
            disabled={
              !upload.file || !upload.title.trim() || addUpload.isPending
            }
          >
            {addUpload.isPending ? "Uploading…" : "Upload"}
          </button>
          {addUpload.error && (
            <p className="shelf__error">{addUpload.error.message}</p>
          )}
        </form>
      </details>

      {list.length === 0 ? (
        <p className="shelf__empty">
          No songs yet. Until you add one, your profile plays Senbonzakura.
        </p>
      ) : (
        <ul className="shelf__list">
          {list.map((song) => (
            <li
              key={song.id}
              className="shelf__song"
              data-featured={song.featured}
            >
              <div className="shelf__row">
                <button
                  type="button"
                  className="shelf__art"
                  onClick={() => music.play(song)}
                  aria-label={`Play ${song.title}`}
                >
                  {song.thumbnail ? (
                    <img src={song.thumbnail} alt="" />
                  ) : (
                    <span aria-hidden="true">♪</span>
                  )}
                </button>
                <div className="shelf__meta">
                  <p className="shelf__title">{song.title}</p>
                  <p className="shelf__artist">
                    {song.artist ?? song.provider}
                  </p>
                </div>
                <button
                  type="button"
                  className="shelf__star"
                  aria-pressed={song.featured}
                  aria-label={
                    song.featured ? "On your profile" : "Put on your profile"
                  }
                  onClick={() => !song.featured && feature.mutate(song.id)}
                >
                  {song.featured ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  className="shelf__remove"
                  onClick={() => remove.mutate(song.id)}
                  aria-label={`Remove ${song.title}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
