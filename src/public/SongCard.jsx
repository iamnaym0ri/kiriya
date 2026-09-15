import { siNiconico, siSoundcloud, siSpotify, siYoutube } from "simple-icons";
import SongPlayer from "../shared/music/SongPlayer.jsx";
import "./SongCard.css";

const PROVIDERS = {
  youtube: { icon: siYoutube, label: "YouTube" },
  spotify: { icon: siSpotify, label: "Spotify" },
  soundcloud: { icon: siSoundcloud, label: "SoundCloud" },
  niconico: { icon: siNiconico, label: "niconico" },
};

export default function SongCard({ song, playerRef }) {
  if (!song) return null;
  const provider = PROVIDERS[song.provider];

  return (
    <section className="songcard" aria-labelledby="songcard-title">
      <div className="songcard__head">
        <span className="songcard__disc" aria-hidden="true" />
        <div className="songcard__meta">
          <span className="sr-only">On repeat: </span>
          <h2 id="songcard-title" className="songcard__title">
            {song.title ?? "A favourite song"}
          </h2>
          {song.artist && <p className="songcard__artist">{song.artist}</p>}
        </div>
        {provider && (
          <a className="songcard__source" href={song.url} target="_blank" rel="noreferrer" aria-label={`Open on ${provider.label}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={provider.icon.path} />
            </svg>
          </a>
        )}
      </div>
      <SongPlayer song={song} ref={playerRef} />
    </section>
  );
}
