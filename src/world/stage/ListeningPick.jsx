import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { usePublicProfile } from "../../lib/profile.js";
import { useFeed, useFeedEntries, useMarkSeen, youtubeSong } from "../../lib/feeds.js";
import { MusicObject, useMusic } from "../../shared/music/MusicRoom.jsx";
import { usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import "./ListeningPick.css";

// Private recommendations never become a public-profile query or public song selection.
export default function ListeningPick({ compact = false }) {
  const feed = useFeed("music");
  const entries = useFeedEntries(feed.data);
  const seen = useMarkSeen("music", feed.data?.revision);
  const library = useQuery({ queryKey: ["me", "songs"], queryFn: () => api("/me/songs") });
  const profile = usePublicProfile();
  const music = useMusic();
  const { moving } = usePlayful();
  const ref = useRef(null);
  const [index, setIndex] = useState(() => Math.floor(Date.now() / 3_600_000));
  const choices = [
    ...entries.filter((entry) => entry.type === "song").map((entry) => ({ song: youtubeSong(entry.primary), ids: entry.ids })),
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
  return <div ref={ref} className={`listening-pick ${compact ? "listening-pick--compact" : ""}`} aria-label="Music recommendations">
    {choice ? <MusicObject song={choice.song} compact={compact} onPlay={() => choice.ids && seen(choice.ids)} />
      : <div className="listening-pick__empty"><strong>{feed.isPending || library.isPending ? "Finding a little soundtrack…" : "Your next favourite goes here ♫"}</strong><p>{feed.isError ? "The music drop couldn’t load just now." : "Add a song to start your listening shelf."}</p><Link className="text-link" to="/world/stage">Open your music shelf →</Link></div>}
    {count > 1 && <div className="listening-pick__controls">
      <button type="button" aria-label="Previous song recommendation" onClick={() => setIndex((value) => value - 1)}>←</button>
      <span>{compact ? "a little soundtrack" : "Try a little something else"} · {position + 1}/{count}</span>
      <button type="button" aria-label="Next song recommendation" onClick={() => setIndex((value) => value + 1)}>→</button>
    </div>}
  </div>;
}
