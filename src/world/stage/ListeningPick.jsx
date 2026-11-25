import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { usePublicProfile } from "../../lib/profile.js";
import { MusicObject, useMusic } from "../../shared/music/MusicRoom.jsx";
import { usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import "./ListeningPick.css";

// The songs chosen for her (featured first), then her public profile song. The daily music feed
// was retired on 2026-11-24, so nothing here is a recommendation from outside any more.
export default function ListeningPick({ compact = false }) {
  const library = useQuery({ queryKey: ["me", "songs"], queryFn: () => api("/me/songs") });
  const profile = usePublicProfile();
  const music = useMusic();
  const { moving } = usePlayful();
  const ref = useRef(null);
  // Starts on the featured song: the one picked for her comes first, every visit.
  const [index, setIndex] = useState(0);
  const choices = [
    ...(library.data?.songs ?? []).map((song) => ({ song })),
    { song: profile.data?.song },
  ].filter((choice) => choice.song?.url).filter((choice, i, list) => list.findIndex((other) => other.song?.url === choice.song.url) === i);
  const count = choices.length;
  const position = count ? ((index % count) + count) % count : 0;
  const choice = choices[position];
  useEffect(() => {
    if (count < 2 || !moving || music.song) return;
    const timer = setInterval(() => {
      const el = ref.current;
      const rect = el?.getBoundingClientRect();
      if (!document.hidden && rect?.bottom > 0 && rect.top < innerHeight && !el.matches(":hover") && !el.contains(document.activeElement)) setIndex((value) => value + 1);
    }, 60_000);
    return () => clearInterval(timer);
  }, [count, moving, music.song]);
  return <div ref={ref} className={`listening-pick ${compact ? "listening-pick--compact" : ""}`} aria-label="A song for you">
    {choice ? <MusicObject song={choice.song} compact={compact} />
      : <div className="listening-pick__empty"><strong>{library.isPending ? "Finding a little soundtrack…" : "A song for you goes here ♫"}</strong><p>{library.isError ? "The song couldn’t load just now." : "One is on its way."}</p></div>}
    {count > 1 && <div className="listening-pick__controls">
      <button type="button" aria-label="Previous song" onClick={() => setIndex((value) => value - 1)}>←</button>
      <span>{compact ? "a little soundtrack" : "Try a little something else"} · {position + 1}/{count}</span>
      <button type="button" aria-label="Next song" onClick={() => setIndex((value) => value + 1)}>→</button>
    </div>}
  </div>;
}
