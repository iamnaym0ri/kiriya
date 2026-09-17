import { useCallback, useEffect, useRef, useState } from "react";
import { siInstagram, siTiktok } from "simple-icons";
import { Modal } from "../shared/WorldPrimitives.jsx";
import { useMusic } from "../shared/music/MusicRoom.jsx";
import SongArtwork from "../shared/music/SongArtwork.jsx";
import "./PublicStatus.css";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function updatedLabel(iso) {
  if (!iso) return null;
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "updated just now";
  if (Math.abs(minutes) < 60) return `updated ${relative.format(minutes, "minute")}`;
  if (Math.abs(minutes) < 60 * 24) return `updated ${relative.format(Math.round(minutes / 60), "hour")}`;
  return `updated ${relative.format(Math.round(minutes / (60 * 24)), "day")}`;
}

function BatteryMeter({ item }) {
  const percent = (item.level + 1) * 20;
  return (
    <div className="battery-meter" data-level={item.level}>
      <div className="battery-meter__head">
        <span className="profile-today__label">{item.label}</span>
        <span className="battery-meter__face" aria-hidden="true">{item.face}</span>
      </div>
      <div
        className="battery-meter__body"
        role="meter"
        aria-label={item.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${item.value}, ${percent}%`}
      >
        <span className="battery-meter__fill" style={{ "--charge": `${percent}%` }} />
        <span className="battery-meter__percent" aria-hidden="true">{percent}%</span>
      </div>
      <strong className="battery-meter__value">{item.value}</strong>
      {item.note && <small>“{item.note}”</small>}
    </div>
  );
}

/** How she is right now, only the parts she chose to share. Every label arrives with the data. */
export function TodayCard({ today, name = "kiriya" }) {
  if (!today?.items?.length) return null;
  const find = (key) => today.items.find((item) => item.key === key);
  const presentation = find("presentation");
  const feeling = find("feeling");
  const address = find("address");
  const energy = find("energy");
  return (
    <section className="profile-today" aria-labelledby="profile-today-title" data-motion-region>
      <h2 id="profile-today-title" className="profile-today__title">
        <span className="profile-today__live" aria-hidden="true" />
        {name} right now
        <span aria-hidden="true"> ✦</span>
      </h2>
      {(presentation || feeling) && (
        <div className="profile-today__heroes">
          {presentation && (
            <div className="profile-today__hero" data-tone={presentation.tone}>
              <span className="profile-today__label">{presentation.label}</span>
              <span className="profile-today__big" aria-hidden="true">{presentation.face}</span>
              <strong>{presentation.value}</strong>
              {address && <span className="profile-today__pill">{address.value}</span>}
            </div>
          )}
          {feeling && (
            <div className="profile-today__hero" data-tone={feeling.tone}>
              <span className="profile-today__label">{feeling.label}</span>
              <span className="profile-today__big profile-today__emoji" aria-hidden="true">{feeling.emoji}</span>
              <strong>{feeling.value}</strong>
              {feeling.note && <small>“{feeling.note}”</small>}
            </div>
          )}
        </div>
      )}
      {address && !presentation && (
        <p className="profile-today__pronouns">
          <span className="profile-today__label">{address.label}</span>
          <span className="profile-today__pill">{address.value}</span>
        </p>
      )}
      {energy && <BatteryMeter item={energy} />}
      {today.updatedAt && <p className="profile-today__updated">{updatedLabel(today.updatedAt)}</p>}
    </section>
  );
}

/** Her own words, right under her name. */
export function ProfileBio({ lines }) {
  if (!lines?.length) return null;
  return (
    <div className="profile-bio">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
}

function BrandIcon({ icon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-links__icon">
      <path d={icon.path} />
    </svg>
  );
}

/** TikTok on the left, Instagram on the right; each opens her profile there. */
export function ProfileLinks({ socials }) {
  const links = [
    socials?.tiktok && { key: "tiktok", name: "TikTok", icon: siTiktok, ...socials.tiktok },
    socials?.instagram && { key: "instagram", name: "Instagram", icon: siInstagram, ...socials.instagram },
  ].filter(Boolean);
  if (!links.length) return null;
  return (
    <div className="profile-links" data-count={links.length}>
      {links.map((link) => (
        <a key={link.key} className="profile-links__link" data-site={link.key} href={link.url} target="_blank" rel="noreferrer">
          <BrandIcon icon={link.icon} />
          <span>
            <small>{link.name}</small>
            <strong>@{link.handle}</strong>
          </span>
        </a>
      ))}
    </div>
  );
}

/** The things she loves, in the little paper box. */
export function ProfileLoves({ loves, name = "kiriya" }) {
  if (!loves?.length) return null;
  return (
    <aside className="profile-dedication profile-loves" aria-label={`Things ${name} loves`}>
      <span className="micro-label">THINGS {name.toUpperCase()} LOVES ♡</span>
      <ul>
        {loves.map((love) => (
          <li key={love}>{love}</li>
        ))}
      </ul>
      <span className="profile-dedication__heart" aria-hidden="true">♡</span>
    </aside>
  );
}

/** The eye and number in the top right corner. */
export function ViewCount({ count }) {
  if (count === null || count === undefined) return null;
  return (
    <span className="public-views" title="Profile views">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>{Number(count).toLocaleString("en")}</span>
      <span className="sr-only"> profile views</span>
    </span>
  );
}

/**
 * Her intro song. Browsers only allow sound after a tap, so uploaded audio starts inside the tap on
 * the entry screen; links open their own player, which some phones start with one more tap.
 */
export function useIntroSong(song) {
  const music = useMusic();
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const isAudio = song?.provider === "audio";
  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
      setPlaying(false);
    },
    [song?.url],
  );
  const play = useCallback(() => {
    if (!song) return;
    if (!isAudio) return music.play(song);
    if (!audio.current) {
      const element = new Audio(song.embedId);
      element.loop = true;
      element.volume = 0.8;
      element.addEventListener("play", () => setPlaying(true));
      element.addEventListener("pause", () => setPlaying(false));
      audio.current = element;
    }
    audio.current.play().catch(() => setPlaying(false));
  }, [song, isAudio, music]);
  const toggle = useCallback(() => {
    if (isAudio && audio.current && !audio.current.paused) audio.current.pause();
    else play();
  }, [isAudio, play]);
  return { play, toggle, isAudio, playing: isAudio ? playing : undefined };
}

/** guns.lol-style entry: one tap lets the intro song start with the page. */
export function IntroSplash({ song, name = "kiriya", onEnter, onQuiet }) {
  const button = useRef(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <div className="intro-splash" role="dialog" aria-modal="true" aria-label={`Enter ${name}’s page`}>
      <div className="intro-splash__sky" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ "--i": i }}>{["✧", "♡", "✦", "❀"][i % 4]}</span>
        ))}
      </div>
      <button ref={button} type="button" className="intro-splash__enter" onClick={onEnter}>
        <span className="intro-splash__record" aria-hidden="true">
          <SongArtwork song={song} eager />
        </span>
        <span className="intro-splash__name">{name}</span>
        <span className="intro-splash__hint">♡ tap to enter</span>
        <span className="intro-splash__song">
          ♪ {song.title}
          {song.artist ? ` · ${song.artist}` : ""}
        </span>
      </button>
      <button type="button" className="intro-splash__quiet" onClick={onQuiet}>
        enter without music
      </button>
    </div>
  );
}

/** Artwork she pinned for visitors, like polaroids on a corkboard. */
export function PinBoard({ pins, name = "kiriya" }) {
  const [open, setOpen] = useState(null);
  if (!pins?.length) return null;
  const viewing = pins.find((pin) => pin.id === open);
  return (
    <section className="profile-pins" aria-labelledby="profile-pins-title">
      <header>
        <span className="micro-label">PINNED BY {name.toUpperCase()} ♡</span>
        <h2 id="profile-pins-title">a few little masterpieces</h2>
      </header>
      <ul>
        {pins.map((pin, index) => (
          <li key={pin.id} style={{ "--tilt": `${[-3, 2, -1.5, 3, -2, 1][index % 6]}deg` }}>
            <button type="button" onClick={() => setOpen(pin.id)} aria-label={`Open ${pin.caption || "a pinned doodle"}`}>
              <span className="profile-pins__pin" aria-hidden="true" />
              <img
                src={pin.url}
                alt={pin.caption || "A doodle pinned to the board"}
                loading="lazy"
                decoding="async"
                width={pin.width ?? undefined}
                height={pin.height ?? undefined}
              />
              {pin.caption && <span className="profile-pins__caption">{pin.caption}</span>}
            </button>
          </li>
        ))}
      </ul>
      {viewing && (
        <Modal title={viewing.caption || "A pinned doodle"} onClose={() => setOpen(null)} className="gallery-dialog profile-pins__dialog">
          <img src={viewing.url} alt={viewing.caption || "A pinned doodle"} />
        </Modal>
      )}
    </section>
  );
}
