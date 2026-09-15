import { useEffect, useImperativeHandle, useRef, useState } from "react";
import "./SongPlayer.css";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Plays a song from any supported source. Links become the provider's own embedded player
// (YouTube, Spotify, SoundCloud and niconico require their visible player); uploaded audio gets a
// custom player. `ref.start()` starts playback from inside a tap handler.
export default function SongPlayer({
  song,
  tone = "night",
  ref,
  autoStart = false,
}) {
  const [started, setStarted] = useState(autoStart);
  const [playError, setPlayError] = useState(null);
  const audioRef = useRef(null);
  const [audioState, setAudioState] = useState({
    playing: false,
    time: 0,
    duration: 0,
  });

  useImperativeHandle(ref, () => ({
    start() {
      setStarted(true);
      if (song?.provider === "audio" && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    },
  }));

  useEffect(() => setStarted(autoStart), [song?.url, autoStart]);

  useEffect(() => {
    setPlayError(null);
    if (song?.provider === "audio" && autoStart)
      audioRef.current
        ?.play()
        .catch(() =>
          setPlayError("Playback didn’t start. Tap play to try again."),
        );
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [song?.url, autoStart]);

  if (!song) return null;

  if (song.provider === "audio") {
    const toggle = () => {
      const audio = audioRef.current;
      if (audio.paused) {
        setPlayError(null);
        audio
          .play()
          .catch(() =>
            setPlayError("Playback didn’t start. Try opening the original."),
          );
      } else audio.pause();
    };
    const progress = audioState.duration
      ? (audioState.time / audioState.duration) * 100
      : 0;
    return (
      <div className={`song-audio song-audio--${tone}`}>
        <audio
          ref={audioRef}
          src={song.embedId}
          preload="metadata"
          loop
          onError={() =>
            setPlayError(
              "This recording couldn’t load. Try again or open the original.",
            )
          }
          onPlay={() => setAudioState((s) => ({ ...s, playing: true }))}
          onPause={() => setAudioState((s) => ({ ...s, playing: false }))}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            setAudioState((s) => ({ ...s, time }));
          }}
          onLoadedMetadata={(e) => {
            const duration = e.currentTarget.duration;
            setAudioState((s) => ({ ...s, duration }));
          }}
        />
        <button
          type="button"
          className="song-audio__toggle"
          onClick={toggle}
          aria-label={audioState.playing ? "Pause" : "Play"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {audioState.playing ? (
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            ) : (
              <path d="M8 5.5v13l10.5-6.5z" />
            )}
          </svg>
        </button>
        {playError && (
          <p className="song-audio__error" role="status">
            {playError}
          </p>
        )}
        <div className="song-audio__track">
          <input
            type="range"
            min="0"
            max={audioState.duration || 0}
            step="0.1"
            value={audioState.time}
            aria-label="Seek"
            style={{ "--progress": `${progress}%` }}
            onChange={(e) => {
              audioRef.current.currentTime = Number(e.target.value);
            }}
          />
          <span className="song-audio__time">
            {formatTime(audioState.time)} / {formatTime(audioState.duration)}
          </span>
        </div>
      </div>
    );
  }

  const embeds = {
    youtube: {
      src: `https://www.youtube-nocookie.com/embed/${song.embedId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      ratio: "16 / 9",
    },
    niconico: {
      src: `https://embed.nicovideo.jp/watch/${song.embedId}?autoplay=1`,
      ratio: "16 / 9",
    },
    spotify: {
      src: `https://open.spotify.com/embed/${song.embedId}?utm_source=iloveukiriya&theme=0`,
      height: 152,
    },
    soundcloud: {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(song.embedId)}&color=%237e39df&auto_play=true&visual=false&show_comments=false`,
      height: 166,
    },
  };
  const embed = embeds[song.provider];
  if (!embed) return null;

  // Spotify and SoundCloud players are compact and cheap: show them straight away.
  const lazy = song.provider === "youtube" || song.provider === "niconico";

  if (lazy && !started) {
    return (
      <button
        type="button"
        className="song-poster"
        onClick={() => setStarted(true)}
        style={{ aspectRatio: embed.ratio }}
      >
        {song.thumbnail && <img src={song.thumbnail} alt="" loading="lazy" />}
        <span className="song-poster__play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
        </span>
        <span className="sr-only">Play {song.title ?? "the song"}</span>
      </button>
    );
  }

  return (
    <iframe
      className="song-embed"
      title={song.title ? `${song.title} player` : "Song player"}
      src={embed.src}
      style={
        embed.ratio ? { aspectRatio: embed.ratio } : { height: embed.height }
      }
      allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
      allowFullScreen
      loading="lazy"
    />
  );
}
