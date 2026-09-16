import { useState } from "react";
import "./SongArtwork.css";

export default function SongArtwork({ song, eager = false }) {
  const [failed, setFailed] = useState(null);
  const src = song?.thumbnail || (song?.provider === "youtube" && /^[\w-]{11}$/.test(song.embedId ?? "")
    ? `https://i.ytimg.com/vi/${song.embedId}/hqdefault.jpg` : null);
  return src && failed !== src ? <img className="song-artwork" src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
    : <span className="song-artwork song-artwork--empty" aria-hidden="true"><span>♫</span></span>;
}
