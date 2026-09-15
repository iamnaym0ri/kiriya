import { useEffect, useState } from "react";
import SongPlayer from "../../shared/music/SongPlayer.jsx";
import InterestIcon from "../../shared/icons/InterestIcon.jsx";
import "./LiveBlocks.css";

const CATEGORY_LABEL = {
  apothecary: "Apothecary",
  vocaloid: "Vocaloid",
  cosplay: "Cosplay",
  ballet: "Ballet",
  art: "Art",
};
const CATEGORY_ICON = { apothecary: "apothecary", vocaloid: "vocaloid", cosplay: "cosplay", ballet: "ballet", art: "artist" };

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function until(ms, now) {
  const diff = ms - now;
  if (diff <= 0) return "now";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return `in 1 day, ${hours} h`;
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `in ${hours} h ${minutes} min`;
}

export function CountdownStrip({ apothecary, specials }) {
  const now = useNow();
  const items = [];
  const next = apothecary?.nextEpisode;
  if (next) items.push({ key: "ep", icon: "apothecary", title: `Apothecary Diaries S3, episode ${next.episode}`, when: until(next.airingAt, now) });
  for (const d of apothecary?.dates ?? []) {
    if (next && d.id === "s3") continue;
    items.push({ key: d.id, icon: "apothecary", title: d.title, when: d.approximate ? "coming April 2027" : until(Date.parse(d.at), now) });
  }
  for (const s of specials ?? []) items.push({ key: s.id, icon: "vocaloid", title: s.title, when: s.inDays === 0 ? "today!" : `in ${s.inDays} days` });
  if (!items.length) return null;

  return (
    <section className="countdowns" aria-label="Coming up">
      <ul className="countdowns__row">
        {items.slice(0, 4).map((item) => (
          <li key={item.key} className="countdown">
            <InterestIcon name={item.icon} size={18} />
            <span className="countdown__title">{item.title}</span>
            <span className="countdown__when">{item.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SongOfDay({ song }) {
  if (!song) return null;
  return (
    <section className="songday" aria-labelledby="songday-title">
      <header className="songday__head">
        <span className="songday__disc" aria-hidden="true" />
        <div className="songday__meta">
          <h2 id="songday-title" className="songday__title">
            {song.title}
          </h2>
          <p className="songday__artist">{song.artist}</p>
        </div>
      </header>
      {song.note && <p className="songday__note">{song.note}</p>}
      <SongPlayer song={song} />
      <p className="songday__credit">
        Song of the day from{" "}
        <a href={song.vocadbUrl} target="_blank" rel="noreferrer">
          VocaDB
        </a>
        {song.tags?.length ? `, tagged ${song.tags.slice(0, 3).join(", ")}` : ""}.
      </p>
    </section>
  );
}

export function FreshFinds({ finds }) {
  if (!finds?.length) return null;
  return (
    <section className="finds" aria-labelledby="finds-title">
      <h2 id="finds-title" className="today__section-title">
        Fresh from the internet
      </h2>
      <ul className="finds__list">
        {finds.map((find) => (
          <li key={find.id}>
            <a className="find" href={find.url} target="_blank" rel="noreferrer" data-category={find.category}>
              <span className="find__icon" aria-hidden="true">
                <InterestIcon name={CATEGORY_ICON[find.category] ?? "fashion"} size={20} />
              </span>
              <span className="find__text">
                <span className="find__headline">{find.headline}</span>
                {find.blurb && <span className="find__blurb">{find.blurb}</span>}
                <span className="find__source">
                  {CATEGORY_LABEL[find.category] ?? "Find"}, via {find.source}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ArtworkCard({ artwork }) {
  if (!artwork) return null;
  return (
    <section className="artwork" aria-labelledby="artwork-title">
      <a href={artwork.url} target="_blank" rel="noreferrer" className="artwork__frame">
        <img src={artwork.image} alt={`${artwork.title}, ${artwork.artist}`} loading="lazy" />
      </a>
      <div className="artwork__copy">
        <h2 id="artwork-title" className="artwork__title">
          {artwork.title}
        </h2>
        <p className="artwork__artist">
          {artwork.artist}
          {artwork.date ? `, ${artwork.date}` : ""}
        </p>
        {artwork.note && <p className="artwork__note">{artwork.note}</p>}
        <p className="artwork__credit">Public domain, from The Met's open collection.</p>
      </div>
    </section>
  );
}
