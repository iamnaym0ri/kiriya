import { useEffect, useRef, useState } from "react";
import "./LyricTheater.css";

// TextAlive (AIST) animates lyrics in sync with Vocaloid songs. It needs a free app token
// (VITE_TEXTALIVE_TOKEN); without one this section stays hidden.
const TOKEN = import.meta.env.VITE_TEXTALIVE_TOKEN;

// Magical Mirai 2026 programming-contest songs, with their pinned timing data.
const SONGS = [
  { code: "6W2N", ts: "20251215164617", title: "こたえて", artist: "imie", video: { beatId: 4827293, chordId: 2963754, repetitiveSegmentId: 3086261, lyricId: 126519, lyricDiffId: 28645 } },
  { code: "zoqO", ts: "20251214200738", title: "アフター・ザ・カーテン", artist: "Rulmry", video: { beatId: 4827294, chordId: 2963755, repetitiveSegmentId: 3086262, lyricId: 126591, lyricDiffId: 28627 } },
  { code: "PNpQ", ts: "20251209170719", title: "シャッターチャンス", artist: "夜未アガリ", video: { beatId: 4827295, chordId: 2963756, repetitiveSegmentId: 3086263, lyricId: 126542, lyricDiffId: 28628 } },
  { code: "B3yJ", ts: "20251215061727", title: "世界最後の音楽隊", artist: "夏山よつぎ × ど～ぱみん", video: { beatId: 4827296, chordId: 2963757, repetitiveSegmentId: 3086264, lyricId: 126594, lyricDiffId: 28629 } },
  { code: "QBdL", ts: "20251215094303", title: "トリツクロジー", artist: "鶴三", video: { beatId: 4827297, chordId: 2963758, repetitiveSegmentId: 3086265, lyricId: 126593, lyricDiffId: 28630 } },
  { code: "E2i3", ts: "20251215092113", title: "TAKEOVER", artist: "Twinfield", video: { beatId: 4827298, chordId: 2963759, repetitiveSegmentId: 3086266, lyricId: 126533, lyricDiffId: 28631 } },
];

export const lyricTheaterAvailable = Boolean(TOKEN);

export default function LyricTheater() {
  const mediaRef = useRef(null);
  const playerRef = useRef(null);
  const [songIndex, setSongIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [phrase, setPhrase] = useState([]);
  const [beat, setBeat] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!TOKEN) return;
    let disposed = false;
    let raf = 0;
    setReady(false);
    setPhrase([]);

    import("textalive-app-api")
      .then(({ Player }) => {
        if (disposed) return;
        const song = SONGS[songIndex];
        const player = new Player({ app: { token: TOKEN }, mediaElement: mediaRef.current, mediaBannerPosition: "bottom right" });
        playerRef.current = player;
        player.addListener({
          onAppReady: (app) => {
            if (!app.songUrl) player.createFromSongUrl(`https://piapro.jp/t/${song.code}/${song.ts}`, { video: song.video });
          },
          onTimerReady: () => setReady(true),
          onPlay: () => setPlaying(true),
          onPause: () => setPlaying(false),
          onStop: () => setPlaying(false),
        });

        let lastSignature = "";
        const tick = () => {
          const time = player.timer?.position ?? 0;
          const current = player.video?.findPhrase(time);
          if (current) {
            const chars = current.children.flatMap((word) => word.children);
            const shownCount = chars.filter((char) => char.startTime <= time).length;
            const signature = `${current.startTime}:${shownCount}`;
            // Only re-render when a character actually appears, not on every frame.
            if (signature !== lastSignature) {
              lastSignature = signature;
              setPhrase(chars.map((char) => ({ text: char.text, shown: char.startTime <= time, key: char.startTime })));
            }
          }
          const b = player.findBeat(time);
          if (b) setBeat(b.index);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((e) => setError(e.message));

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, [songIndex]);

  if (!TOKEN) return null;

  const song = SONGS[songIndex];
  return (
    <section className="lyrics" aria-labelledby="lyrics-title">
      <h2 id="lyrics-title" className="lyrics__title">
        Lyric theatre
      </h2>
      <p className="lyrics__hint">Magical Mirai 2026 contest songs, with lyrics animated in time.</p>
      <select className="field lyrics__pick" value={songIndex} onChange={(e) => setSongIndex(Number(e.target.value))}>
        {SONGS.map((s, i) => (
          <option key={s.code} value={i}>
            {s.title}, {s.artist}
          </option>
        ))}
      </select>
      <div className="lyrics__stage" data-beat={beat % 2} lang="ja">
        <p className="lyrics__phrase" aria-live="off">
          {phrase.map((char) => (
            <span key={char.key} data-shown={char.shown}>
              {char.text}
            </span>
          ))}
        </p>
      </div>
      <div className="lyrics__media" ref={mediaRef} />
      <div className="lyrics__controls">
        <button type="button" className="btn btn--primary btn--small" disabled={!ready} onClick={() => (playing ? playerRef.current.requestPause() : playerRef.current.requestPlay())}>
          {!ready ? "Loading song…" : playing ? "Pause" : `Play ${song.title}`}
        </button>
      </div>
      {error && <p className="lyrics__error">The lyric player didn't load: {error}</p>}
      <p className="lyrics__credit">
        Lyrics synced by{" "}
        <a href="https://developer.textalive.jp/" target="_blank" rel="noreferrer">
          TextAlive App API
        </a>
        .
      </p>
    </section>
  );
}
