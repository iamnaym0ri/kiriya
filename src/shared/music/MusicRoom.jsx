import { createContext, useContext, useState, useEffect } from "react";
import { Icon } from "../WorldPrimitives.jsx";
import SongArtwork from "./SongArtwork.jsx";
import SongPlayer from "./SongPlayer.jsx";
const MusicContext = createContext(null);
export const useMusic = () => useContext(MusicContext);
export function MusicProvider({ children }) {
  const [song, setSong] = useState(null);
  useEffect(() => {
    const stop = () => setSong(null);
    window.addEventListener("kiriya:locked", stop);
    return () => window.removeEventListener("kiriya:locked", stop);
  }, []);
  return (
    <MusicContext.Provider
      value={{ song, play: setSong, stop: () => setSong(null) }}
    >
      {children}
      {song && (
        <aside className="listening-room" aria-label="Music player">
          <header>
            <div>
              <span className="micro-label">THE LISTENING ROOM</span>
              <strong>{song.title}</strong>
              <small>{song.artist}</small>
            </div>
            <button
              className="icon-button"
              onClick={() => setSong(null)}
              aria-label="Close music player and stop playback"
            >
              <Icon name="close" />
            </button>
          </header>
          <SongPlayer key={song.url} song={song} tone="light" autoStart />
          <a href={song.url} target="_blank" rel="noreferrer">
            Open original · {song.provider} <Icon name="diagonal" size={13} />
          </a>
        </aside>
      )}
    </MusicContext.Provider>
  );
}
export function MusicObject({ song, compact = false, onPlay }) {
  const music = useMusic();
  return (
    <button
      className={`music-object ${compact ? "music-object--compact" : ""}`}
      onClick={() => { if (song) { onPlay?.(); music.play(song); } }}
      disabled={!song}
      aria-label={song ? `Play ${song.title}` : "No song selected"}
    >
      <span className="music-object__sleeve">
        <SongArtwork song={song} eager />
        <span className="music-object__disc" aria-hidden="true">
          <span />
        </span>
      </span>
      <span className="music-object__copy">
        <span className="micro-label">A LITTLE MUSIC FOR YOUR STAY</span>
        <strong>{song?.title ?? "Your music, here"}</strong>
        <small>{song?.artist ?? "Choose a song in your music shelf"}</small>
        <span className="music-object__listen">
          {song && music.song?.url === song.url
            ? "Player open"
            : "Press play, stay awhile"}{" "}
          <Icon name="play" size={13} />
        </span>
      </span>
    </button>
  );
}
