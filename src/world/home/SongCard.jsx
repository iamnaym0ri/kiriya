import { useEffect, useRef, useState } from "react";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import { useIsAdmin } from "../../lib/session.js";
import { engine, formatTime, useAudioEngine } from "../../shared/music/audioEngine.js";
import { youtubePlayerUrl, useYoutubeEvents } from "../../shared/music/youtube.js";
import { useMarkSeen } from "./useHome.js";
import { SongsSheet } from "./SongEditor.jsx";
import HomeIcon from "./icons.jsx";

/**
 * The first song she hasn't heard yet, in the order Josh added them; once she has heard them all,
 * the newest. Songs arrive newest first.
 */
export function featuredSong(songs) {
  return [...songs].reverse().find((song) => !song.heard) ?? songs[0] ?? null;
}

/**
 * A song for her: cover, title, artist and length, and a play button. A file plays in our own player
 * (and keeps going with the phone locked); a YouTube link opens YouTube's own player in the card.
 * Each visit features one she hasn't heard yet; she can flip through the rest.
 */
export default function SongCard({ home, fresh = true }) {
  const admin = useIsAdmin();
  const songs = home?.songs ?? [];
  const audio = useAudioEngine();
  const markSeen = useMarkSeen();
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState(null);
  const [open, setOpen] = useState(false);

  // Which song this visit features is decided once, when the songs first arrive (or a song that is
  // already playing, when she comes back to home).
  useEffect(() => {
    // Wait for this visit's own answer, not the copy kept from last time.
    if (pick || !songs.length || !fresh) return;
    const playing = audio.song && songs.find((song) => song.id === audio.song.id);
    setPick((playing ?? featuredSong(songs)).id);
  }, [songs, pick, audio.song, fresh]);

  const index = Math.max(0, songs.findIndex((song) => song.id === pick));
  const song = pick ? (songs[index] ?? null) : null;
  const flip = (step) => {
    if (songs.length < 2) return;
    setOpen(false);
    setPick(songs[(index + step + songs.length) % songs.length].id);
  };

  // The Lock Screen's skip buttons move through the uploaded songs (YouTube can't play there).
  useEffect(() => {
    const files = songs.filter((item) => item.provider === "audio");
    if (files.length < 2) {
      engine.setQueue({});
      return;
    }
    const step = (by) => () => {
      const at = files.findIndex((item) => item.id === engine.current()?.id);
      const next = files[(Math.max(0, at) + by + files.length) % files.length];
      setPick(next.id);
      engine.play(next);
    };
    engine.setQueue({ next: step(1), previous: step(-1) });
  }, [songs]);

  // A song Josh just fixed (title, cover) updates on the Lock Screen too.
  useEffect(() => {
    if (song && audio.song?.id === song.id) engine.refresh(song);
  }, [song, audio.song?.id]);

  const heard = (target) => {
    if (target && !target.heard) markSeen.mutate({ songs: [target.id] });
  };

  return (
    <section className="app-card home-song" id="home-song" aria-labelledby="home-song-title" data-companion-avoid>
      <header className="app-card__head">
        <h2 id="home-song-title" className="app-card__title">
          a song for you <span aria-hidden="true">♫</span>
        </h2>
        <div className="app-card__action">
          {song && !song.heard && <span className="home-song__new">new for you ♫</span>}
          <AdminEdit compact label="songs" onClick={() => setEditing(true)} />
        </div>
      </header>
      {song ? (
        song.provider === "audio" ? (
          <AudioSong key={song.id} song={song} audio={audio} onPlay={() => heard(song)} />
        ) : (
          <YoutubeSong key={song.id} song={song} open={open} onOpen={(value) => {
            setOpen(value);
            if (value) {
              engine.pause();
              heard(song);
            }
          }} />
        )
      ) : songs.length ? (
        <div className="home-song__waiting" aria-hidden="true">
          <span className="home-song__sleeve"><span className="home-song__blank">♫</span></span>
          <span className="home-song__info"><span className="home-song__bar" /><span className="home-song__bar home-song__bar--short" /></span>
        </div>
      ) : (
        <div className="app-empty home-song__empty">
          <strong>a song is on its way ♫</strong>
          <span>{admin ? "add the first one with the pencil above." : "one will be waiting here soon."}</span>
        </div>
      )}
      {songs.length > 1 && song && (
        <div className="home-song__flip">
          <button type="button" aria-label="Previous song" onClick={() => flip(-1)}>
            <HomeIcon name="prev" />
          </button>
          <span>
            {index + 1} of {songs.length}
            {songs.some((item) => !item.heard) && !admin ? ` · ${songs.filter((item) => !item.heard).length} new` : ""}
          </span>
          <button type="button" aria-label="Next song" onClick={() => flip(1)}>
            <HomeIcon name="next" />
          </button>
        </div>
      )}
      <SongsSheet open={editing} onClose={() => setEditing(false)} songs={songs} />
    </section>
  );
}

// YouTube's large thumbnail carries letterbox bars; its medium one is a clean 16:9 frame.
const coverOf = (song) => song.thumbnail?.replace(/^(https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/)hqdefault\.jpg$/, "$1mqdefault.jpg") ?? null;

function Sleeve({ song, spinning }) {
  const [failed, setFailed] = useState(false);
  const src = coverOf(song);
  return (
    <span className="home-song__sleeve" data-spinning={spinning || undefined}>
      <span className="home-song__disc" aria-hidden="true">
        <span />
      </span>
      {src && !failed ? (
        <img src={src} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span className="home-song__blank" aria-hidden="true">
          ♫
        </span>
      )}
    </span>
  );
}

function Details({ song, length }) {
  return (
    <span className="home-song__info">
      <strong className="home-song__title">{song.title || "a song for you"}</strong>
      {(song.artist || song.album) && <span className="home-song__artist">{[song.artist, song.album].filter(Boolean).join(" · ")}</span>}
      <span className="home-song__length">
        {song.provider === "youtube" && <span className="home-song__yt">YouTube</span>}
        {length ? formatTime(length) : song.provider === "youtube" ? "" : "—"}
      </span>
    </span>
  );
}

function AudioSong({ song, audio, onPlay }) {
  const mine = audio.song?.id === song.id;
  const playing = mine && audio.playing;
  const duration = (mine && audio.duration) || song.duration || 0;
  const time = mine ? audio.time : 0;
  const [scrub, setScrub] = useState(null);
  const shown = scrub ?? time;
  return (
    <div className="home-song__body">
      <div className="home-song__main">
        <Sleeve song={song} spinning={playing} />
        <Details song={song} length={duration} />
        <button
          type="button"
          className="home-song__play"
          data-playing={playing || undefined}
          aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
          onClick={() => {
            engine.toggle(song);
            if (!playing) onPlay();
          }}
        >
          {mine && audio.loading && audio.playing ? <span className="home-song__spinner" aria-hidden="true" /> : <HomeIcon name={playing ? "pause" : "play"} filled size={26} />}
        </button>
      </div>
      <div className="home-song__scrub">
        <span className="home-song__time">{formatTime(shown)}</span>
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={Math.min(shown, duration || 1)}
          disabled={!duration}
          aria-label="Position in the song"
          aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
          style={{ "--progress": `${duration ? (Math.min(shown, duration) / duration) * 100 : 0}%` }}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (mine) {
              setScrub(value);
              engine.seek(value);
            }
          }}
          onPointerUp={() => setScrub(null)}
          onTouchEnd={() => setScrub(null)}
          onBlur={() => setScrub(null)}
        />
        <span className="home-song__time home-song__time--left">-{formatTime(Math.max(0, duration - shown))}</span>
        <button
          type="button"
          className="home-song__repeat"
          aria-pressed={audio.repeat}
          aria-label="Repeat this song"
          onClick={() => engine.setRepeat(!audio.repeat)}
        >
          <HomeIcon name="repeat" size={18} />
        </button>
      </div>
      {mine && audio.error && (
        <p className="home-song__error" role="status">
          {audio.error}
        </p>
      )}
    </div>
  );
}

function YoutubeSong({ song, open, onOpen }) {
  const frame = useRef(null);
  const player = useYoutubeEvents(frame, song.embedId);
  const length = song.duration || player.duration;
  return (
    <div className="home-song__body">
      <div className="home-song__main">
        <Sleeve song={song} spinning={open && player.playing} />
        <Details song={song} length={length} />
        <button
          type="button"
          className="home-song__play"
          data-open={open || undefined}
          aria-label={open ? "Close the player" : `Play ${song.title}`}
          aria-expanded={open}
          onClick={() => onOpen(!open)}
        >
          <HomeIcon name={open ? "close" : "play"} filled={!open} size={open ? 22 : 26} />
        </button>
      </div>
      {open && (
        <div className="home-song__player">
          <iframe
            ref={frame}
            title={`${song.title} on YouTube`}
            src={youtubePlayerUrl(song.embedId, { autoplay: true })}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      {open && player.error && (
        <p className="home-song__error" role="status">
          YouTube won’t play this one here. <a href={song.url} target="_blank" rel="noreferrer">Open it on YouTube ↗</a>
        </p>
      )}
    </div>
  );
}
