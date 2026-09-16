// Feed pieces, built from the world's existing cards (note-slip, lookbook-photo, record-sleeve,
// Modal). None of these render anything when their feed is empty, so the existing sections look
// exactly as before until an edition is published.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.js";
import {
  approxSgd,
  creditLine,
  daysUntil,
  originalPrice,
  sgDate,
  sgTime,
  useFeed,
  useFeedEntries,
  useHide,
  useKeep,
  useKept,
  useMarkSeen,
  useReportGone,
  useSeenOnView,
  youtubeSong,
} from "../../lib/feeds.js";
import { usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import { Icon, Modal, Picture } from "../../shared/WorldPrimitives.jsx";
import { useMusic } from "../../shared/music/MusicRoom.jsx";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import "./FeedPieces.css";

const SIGNATURE = "✦ kiriya.love";

/** A visible chapter boundary, shared by every daily drop and its smaller shelves. */
export function FeedSection({ title, subtitle, symbol = "✧", tone = "lilac", level = 3, className = "", children }) {
  const id = useId();
  const Heading = `h${level}`;
  return <section className={`feed-drop ${className}`} data-tone={tone} aria-labelledby={id}>
    <header className="feed-drop__heading">
      <span className="feed-drop__symbol" aria-hidden="true">{symbol}</span>
      <div>
        <Heading id={id}>{title}</Heading>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
    <div className="feed-drop__body">{children}</div>
  </section>;
}

// Keep vertical clips vertical and landscape videos wide; the enclosing phone grid gives
// video cards an entire row. Stills use the same dimensions as their playable media.
export function feedMediaLayout(item) {
  const media = item?.media?.[0];
  const video = ["mp4", "hls", "youtube", "gif"].includes(media?.type);
  return {
    "data-media-kind": video ? "video" : "image",
    style: { "--feed-media-ratio": media?.width > 0 && media?.height > 0 ? `${media.width} / ${media.height}` : "16 / 9" },
  };
}
// The same four the lore carousel uses for text-only notes. Chosen from the item id so a card keeps
// the same expression between renders instead of flickering on every re-render.
const CARD_MASCOTS = ["curious", "smug", "thinking", "sparkle"];
const cardMascot = (id) => {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return CARD_MASCOTS[hash % CARD_MASCOTS.length];
};
const LINK_ORDER = [
  "listen",
  "watch",
  "official",
  "tickets",
  "retailer",
  "sg_search",
  "taobao_search",
  "source",
];

/** One section's feed, with a stable display order and a seen marker bound to its revision. */
export function useSectionFeed(section, options) {
  const feed = useFeed(section, options);
  const entries = useFeedEntries(feed.data);
  const markSeen = useMarkSeen(section, feed.data?.revision);
  return {
    feed,
    data: feed.data,
    entries,
    markSeen,
    live: Boolean(feed.data?.revision),
  };
}

const supportsNativeHls = () => {
  try {
    return (
      document
        .createElement("video")
        .canPlayType("application/vnd.apple.mpegurl") !== ""
    );
  } catch {
    return false;
  }
};

/**
 * A feed picture or clip. Inline, motion runs only on the active, on-screen card while motion is
 * allowed; otherwise a still poster shows. The viewer (opened by a tap) plays on request.
 */
export function FeedMedia({
  item,
  media = item.media?.[0],
  active = true,
  viewer = false,
  onGone,
}) {
  const { moving: motionAllowed } = usePlayful();
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const hls = useMemo(supportsNativeHls, []);
  const alt = media?.alt || item.title;
  const size =
    media?.width && media?.height
      ? { width: media.width, height: media.height }
      : {};
  const gone = () => onGone?.(item.id);
  const video =
    media && (media.type === "mp4" || (media.type === "hls" && hls));
  // Tumblr's API terms rule out continuous autoplay of GIF sequences: stills inline, play on tap.
  const moving =
    motionAllowed && !String(item.source ?? "").startsWith("tumblr");
  useEffect(() => {
    const node = ref.current;
    if (
      !video ||
      viewer ||
      !node ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [video, viewer]);
  useEffect(() => {
    const node = ref.current;
    if (!video || viewer || !node) return;
    if (active && inView && moving) node.play().catch(() => {});
    else node.pause();
  }, [video, viewer, active, inView, moving]);
  if (!media) return null;
  const picture = (src) => (
    <img
      className="feed-media"
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={viewer ? "eager" : "lazy"}
      decoding="async"
      {...size}
      onError={gone}
    />
  );
  const still = (label) =>
    media.poster ? (
      <span className="feed-media__still">
        {picture(media.poster)}
        <span className="feed-media__badge">
          <Icon name="play" size={12} /> {label}
        </span>
      </span>
    ) : (
      <span className="feed-media__placeholder">
        <Icon name="play" size={18} /> {label}
      </span>
    );
  if (media.type === "image") return picture(media.url);
  if (media.type === "gif")
    return viewer || moving ? picture(media.url) : still("tap to play");
  if (media.type === "youtube") return still("listen");
  if (video)
    return (
      <video
        ref={ref}
        className="feed-media"
        src={media.url}
        poster={media.poster ?? undefined}
        muted
        loop
        playsInline
        controls={viewer}
        autoPlay={viewer && moving}
        preload="metadata"
        aria-label={alt}
        {...size}
        onError={gone}
      />
    );
  // Browsers without native HLS: a still, and the clip opens at its source.
  return viewer ? (
    <>
      {still("plays at the source")}
      <a
        className="text-link"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Watch on {item.credit?.platform ?? "the source"}{" "}
        <Icon name="diagonal" size={13} />
      </a>
    </>
  ) : (
    still("tap to watch")
  );
}

export function FeedByline({ item, onOpen }) {
  return (
    <div className="note-slip__source feed-byline">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
      >
        {creditLine(item) || "the source"} ↗
      </a>
      <span className="handwritten">{item.signature ?? SIGNATURE}</span>
    </div>
  );
}

export function FeedLinks({ item, onOpen, limit = 4 }) {
  const links = [...(item.facts?.links ?? [])]
    .sort((a, b) => LINK_ORDER.indexOf(a.kind) - LINK_ORDER.indexOf(b.kind))
    .slice(0, limit);
  if (!links.length) return null;
  const taobao = links.some((l) => l.kind === "taobao_search");
  return (
    <div className="feed-links">
      {links.map((link) => (
        <a
          key={link.url}
          className="text-link"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
        >
          {link.label} <Icon name="diagonal" size={12} />
        </a>
      ))}
      {taobao && (
        <small className="feed-note">
          look for 正版 (official) listings, bestie.
        </small>
      )}
    </div>
  );
}

export function FeedFacts({ item }) {
  const f = item.facts ?? {};
  const bits = [];
  const price = approxSgd(f);
  if (price)
    bits.push(`${price}${originalPrice(f) ? ` (${originalPrice(f)})` : ""}`);
  if (f.preorderUntil) bits.push(`preorder until ${sgDate(f.preorderUntil)}`);
  else if (f.releaseAt)
    bits.push(
      `release ${sgDate(f.releaseAt, f.releasePrecision === "month" ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" })}`,
    );
  if (f.eventAt) {
    const start = sgDate(f.eventAt);
    const end =
      f.eventEndAt && sgDate(f.eventEndAt) !== start
        ? `–${sgDate(f.eventEndAt)}`
        : "";
    bits.push(`${start}${end}${f.venue ? ` · ${f.venue}` : ""}`);
  }
  if (f.airingAt)
    bits.push(
      `${sgDate(f.airingAt, { weekday: "short", day: "numeric", month: "short" })}, ${sgTime(f.airingAt)}`,
    );
  if (!bits.length) return null;
  return <p className="feed-facts">{bits.join(" · ")}</p>;
}

/** Keep (a private save) and "not for me" (hidden for good). The owner's preview changes nothing. */
export function FeedActions({ item, onSeen }) {
  const session = useSession();
  const keep = useKeep();
  const hide = useHide();
  const kept = useKept(item.id);
  const preview = session.data?.role !== "kiriya";
  return (
    <div className="feed-actions">
      <button
        type="button"
        className="quiet-button"
        aria-pressed={kept}
        disabled={keep.isPending || kept}
        onClick={() => {
          onSeen?.();
          keep.mutate(item.id);
        }}
      >
        <Icon name="heart" size={15} />
        {kept
          ? "kept ♡"
          : keep.data?.preview
            ? "preview only"
            : keep.isPending
              ? "keeping…"
              : "keep"}
      </button>
      <button
        type="button"
        className="quiet-button"
        disabled={hide.isPending}
        onClick={() => {
          if (preview) return hide.mutate(item.id);
          if (window.confirm("Hide this from your feeds for good?"))
            hide.mutate(item.id);
        }}
      >
        {hide.data?.preview ? "preview only" : "not for me"}
      </button>
      {(keep.error || hide.error) && (
        <small role="status" className="feed-note">
          {keep.error
            ? "couldn’t keep that one. try again in a bit."
            : "couldn’t hide that one. try again in a bit."}
        </small>
      )}
    </div>
  );
}

/** A closer look at one entry: its media (playable), words, credit and actions. */
export function FeedViewer({ entry, onClose, onSeen }) {
  const item = entry.primary;
  const reportGone = useReportGone();
  const music = useMusic();
  const song = youtubeSong(item);
  const note = entry.companions?.[0];
  return (
    <Modal
      title={item.blurb?.headline || item.title}
      onClose={onClose}
      className="gallery-dialog feed-viewer"
    >
      {song ? (
        <button
          className="button-plum"
          onClick={() => {
            onSeen?.();
            music.play(song);
            onClose();
          }}
        >
          <Icon name="play" size={14} /> Listen to {item.title}
        </button>
      ) : (
        <FeedMedia
          item={item}
          viewer
          onGone={(id) => (reportGone(id), onClose())}
        />
      )}
      <p>{item.blurb?.text}</p>
      <FeedFacts item={item} />
      {note && (
        <aside className="note-slip feed-companion">
          <strong className="feed-card__headline">
            {note.blurb?.headline}
          </strong>
          <p>{note.blurb?.text}</p>
          <FeedByline item={note} />
        </aside>
      )}
      <FeedLinks item={item} onOpen={onSeen} />
      <FeedByline item={item} onOpen={onSeen} />
      <div className="gallery-dialog__actions">
        <FeedActions item={item} onSeen={onSeen} />
      </div>
    </Modal>
  );
}

/** A note-slip card for any entry (notes, news, SEKAI, events, process posts, extras, memes). */
export function FeedCard({ entry, label, onSeen, showMedia = true, children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const reportGone = useReportGone();
  const item = entry.primary;
  const seen = () => onSeen?.(entry.ids);
  useSeenOnView(ref, seen);
  return (
    <article
      ref={ref}
      className="note-slip feed-card"
      {...feedMediaLayout(item)}
      data-seen={entry.seen ? "" : undefined}
    >
      <span className="micro-label">
        {label}
        {entry.seen ? " · SEEN EARLIER" : ""}
      </span>
      {showMedia &&
        (item.media?.length > 0 ? (
          <button
            type="button"
            className="feed-card__media"
            aria-label={`A closer look: ${item.title}`}
            onClick={() => {
              seen();
              setOpen(true);
            }}
          >
            <FeedMedia item={item} onGone={reportGone} />
          </button>
        ) : (
          // News, lore and events carry no picture of their own: their sources give no display
          // permission for one (docs/feeds/SOURCE-VERIFICATION.md), so the card borrows the chibi
          // the lore carousel already uses rather than going out as a wall of text.
          <span className="feed-card__mascot" aria-hidden="true">
            <MaomaoMascot expression={cardMascot(item.id)} size={132} />
          </span>
        ))}
      {item.blurb?.headline && (
        <strong className="feed-card__headline">{item.blurb.headline}</strong>
      )}
      <p>{item.blurb?.text}</p>
      <FeedFacts item={item} />
      {children}
      <FeedLinks item={item} onOpen={seen} />
      <FeedByline item={item} onOpen={seen} />
      <FeedActions item={item} onSeen={seen} />
      {open && (
        <FeedViewer
          entry={entry}
          onClose={() => setOpen(false)}
          onSeen={seen}
        />
      )}
    </article>
  );
}

/** A lookbook-photo card for a picture entry (today's three, visuals strip, meme). */
export function FeedPhoto({ entry, index, title, caption, onSeen }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const reportGone = useReportGone();
  const item = entry.primary;
  const seen = () => onSeen?.(entry.ids);
  useSeenOnView(ref, seen);
  if (!item.media?.length)
    return <FeedCard entry={entry} label={title} onSeen={onSeen} />;
  return (
    <div ref={ref} className="feed-photo" {...feedMediaLayout(item)}>
      <button
        type="button"
        className={`lookbook-photo lookbook-photo--${index % 3}`}
        onClick={() => {
          seen();
          setOpen(true);
        }}
      >
        <FeedMedia item={item} onGone={reportGone} />
        <span className="lookbook-photo__caption">
          <span>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{title}</strong>
          </span>
          <Icon name="diagonal" size={19} />
        </span>
        <span className="lookbook-photo__credit">
          {caption ?? item.blurb?.headline} · {creditLine(item)}
        </span>
      </button>
      <FeedActions item={item} onSeen={seen} />
      {open && (
        <FeedViewer
          entry={entry}
          onClose={() => setOpen(false)}
          onSeen={seen}
        />
      )}
    </div>
  );
}

/** A record sleeve for a feed song: plays in the listening room, or opens at its source. */
export function FeedSleeve({ entry, onSeen }) {
  const ref = useRef(null);
  const music = useMusic();
  const item = entry.primary;
  const song = youtubeSong(item);
  const seen = () => onSeen?.(entry.ids);
  useSeenOnView(ref, seen);
  const cover = item.media?.find((m) => m.poster || m.type === "image");
  const image =
    cover?.poster ??
    (cover?.type === "image" ? cover.url : null) ??
    song?.thumbnail;
  const inside = (
    <>
      <span className="record-sleeve__image">
        {image ? (
          <img
            src={image}
            alt={`${item.title} cover`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/images/miku.webp";
              e.currentTarget.onerror = null;
            }}
          />
        ) : (
          <Picture name="miku" alt="" />
        )}
        <span className="record-play">
          <Icon name={song ? "play" : "diagonal"} size={20} />
        </span>
      </span>
      <strong>{item.title}</strong>
      <small>{creditLine(item)}</small>
      <span className="record-sleeve__label">
        {entry.seen ? "SEEN EARLIER" : "TODAY’S DROP"}
      </span>
    </>
  );
  return (
    <div ref={ref} className="feed-sleeve">
      {song ? (
        <button
          type="button"
          className="record-sleeve"
          onClick={() => {
            seen();
            music.play(song);
          }}
        >
          {inside}
        </button>
      ) : (
        <a
          className="record-sleeve"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={seen}
        >
          {inside}
        </a>
      )}
      {item.blurb?.text && <p className="feed-note">{item.blurb.text}</p>}
      <FeedActions item={item} onSeen={seen} />
    </div>
  );
}

/** Her own least-recently-shown cosplay photo beside today's three. Private; never a feed item. */
export function PersonalPhoto({ personal, index }) {
  const [open, setOpen] = useState(false);
  if (!personal?.coverUrl) return null;
  const alt = `${personal.character} cosplay photograph`;
  const caption = `ur ${personal.character.toLowerCase()} era, never forget`;
  return (
    <div className="feed-photo">
      <button
        type="button"
        className={`lookbook-photo lookbook-photo--${index % 3}`}
        onClick={() => setOpen(true)}
      >
        <img src={personal.coverUrl} alt={alt} loading="lazy" />
        <span className="lookbook-photo__caption">
          <span>
            <small>♡</small>
            <strong>one of urs</strong>
          </span>
          <Icon name="diagonal" size={19} />
        </span>
        <span className="lookbook-photo__credit">{caption}</span>
      </button>
      {open && (
        <Modal
          title={personal.character}
          onClose={() => setOpen(false)}
          className="gallery-dialog"
        >
          <img src={personal.coverUrl} alt={alt} />
          <p>{personal.note || personal.series || caption}</p>
        </Modal>
      )}
    </div>
  );
}

/** Episode day: "ep N tonight" with a gentle countdown, then the morning-after reactions line. */
export function EpisodeBanner({ episode }) {
  const [now, setNow] = useState(() => Date.now());
  const airing = episode?.mode === "airing_today";
  useEffect(() => {
    if (!airing) return;
    const tick = () => !document.hidden && setNow(Date.now());
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [airing]);
  if (!episode?.airingAt || !Number.isInteger(episode.episode)) return null;
  const left = new Date(episode.airingAt).getTime() - now;
  let line;
  if (!airing)
    line = `ep ${episode.episode} reactions are in ♡ the first slides are all about it.`;
  else if (left > 0) {
    const hours = Math.floor(left / 3_600_000);
    const minutes = Math.floor((left % 3_600_000) / 60_000);
    line = `ep ${episode.episode} tonight, ${sgTime(episode.airingAt)} · in ${hours ? `${hours}h ` : ""}${minutes}m`;
  } else line = `ep ${episode.episode} is out. go go go`;
  return (
    <aside className="note-slip feed-episode">
      <span className="micro-label">
        {airing ? "EPISODE DAY" : "THE MORNING AFTER"}
      </span>
      <p>{line}</p>
    </aside>
  );
}

/** "8 new · 4 seen earlier", and the closing card once everything has been seen. */
export function FeedProgress({ data, label = "TODAY’S DROP" }) {
  if (!data?.revision) return null;
  const { counts } = data;
  return (
    <>
      <p className="collection-label feed-progress">
        <span />
        {label}
        <span className="collection-label__detail">
          {counts.new} new
          {counts.seenEarlier ? ` · ${counts.seenEarlier} seen earlier` : ""}
        </span>
      </p>
      {data.closing && (
        <aside className="note-slip feed-closing">
          <span className="micro-label">THAT’S THE DROP</span>
          <p>{data.closing}</p>
          <div className="note-slip__source">
            <Link to="/world/saves">ur saves ♡</Link>
            <span className="handwritten">{SIGNATURE}</span>
          </div>
        </aside>
      )}
    </>
  );
}

/** "· 5 new" beside a section link, once that section has a published edition. */
export function NewCount({ section }) {
  const { data } = useFeed(section);
  if (!data?.revision || !data.counts?.new) return null;
  return <span className="feed-new-count"> · {data.counts.new} new</span>;
}

/** A clearly separated merch pick, with a link to the whole shelf. */
export function MerchLine({ entry, onSeen }) {
  const ref = useRef(null);
  useSeenOnView(ref, () => entry && onSeen?.(entry.ids), {
    enabled: Boolean(entry),
  });
  if (!entry) return null;
  const item = entry.primary;
  const shop = (item.facts?.links ?? []).find((l) =>
    ["retailer", "official", "sg_search"].includes(l.kind),
  );
  return (
    <FeedSection title="Merch for your shelf" subtitle="A little find for your collection." symbol="♡" tone="rose" level={4}>
    <div ref={ref} className="note-slip feed-merch-line">
      <p>
        <strong>{item.title}</strong>{" "}
        {item.blurb?.text ? `· ${item.blurb.text}` : ""}
      </p>
      <FeedFacts item={item} />
      <div className="note-slip__source">
        {shop ? (
          <a
            href={shop.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSeen?.(entry.ids)}
          >
            {shop.label} ↗
          </a>
        ) : (
          <FeedByline item={item} onOpen={() => onSeen?.(entry.ids)} />
        )}
        <Link to="/world/merch">the whole merch shelf →</Link>
      </div>
      <FeedActions item={item} onSeen={() => onSeen?.(entry.ids)} />
    </div>
    </FeedSection>
  );
}

/** Home: one meme, with five more behind "one more". */
/**
 * A browsable meme carousel. Owner decision (2026-09-16, second pass): memes are something she can
 * scroll through whenever she likes, not one a day, so this pages through the whole published set
 * instead of showing a single pick. Every meme carries an image or video and is checked for
 * relevance before it reaches here, and hiding one teaches the next edition (see dislikeSignals).
 */
export function MemeOfTheDay() {
  const { data, entries, markSeen, live } = useSectionFeed("meme");
  const [index, setIndex] = useState(0);
  if (!live || !entries.length) return null;
  const count = entries.length;
  const position = ((index % count) + count) % count;
  const entry = entries[position];
  const go = (next) => {
    markSeen(entry.ids);
    setIndex(next);
  };
  return (
    <FeedSection title="Memes for u" subtitle="A very important break for unserious things." symbol="(¬‿¬)" tone="rose" level={2} className="editorial-section feed-meme">
      <div className="feed-meme__inner">
        <FeedPhoto
          key={entry.key}
          entry={entry}
          index={position}
          title="memes for u"
          caption={entry.primary.blurb?.headline}
          onSeen={markSeen}
        />
        <aside className="note-slip">
          <span className="micro-label">
            {entry.seen ? "SEEN EARLIER" : "A LITTLE LAUGH"}
          </span>
          <p>{entry.primary.blurb?.text}</p>
          <FeedByline item={entry.primary} onOpen={() => markSeen(entry.ids)} />
          {count > 1 && (
            <div className="lore-pagination">
              <button aria-label="Previous meme" onClick={() => go(index - 1)}>
                ←
              </button>
              <span aria-label={`Meme ${position + 1} of ${count}`}>
                {String(position + 1).padStart(2, "0")}{" "}
                <i>/ {String(count).padStart(2, "0")}</i>
              </span>
              <button aria-label="Next meme" onClick={() => go(index + 1)}>
                →
              </button>
            </div>
          )}
          {data.closing && <p className="feed-note">{data.closing}</p>}
        </aside>
      </div>
    </FeedSection>
  );
}

function countdownLabel(days) {
  if (days === null) return null;
  if (days === 0) return "today!!";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  return "on now";
}

/** Upcoming events with countdowns and TBC tags (her picks first). */
export function EventsStrip({ limit = 6 }) {
  const events = useQuery({
    queryKey: ["me", "events"],
    queryFn: () => api("/me/events"),
    retry: false,
    staleTime: 10 * 60_000,
  });
  const list = (events.data?.events ?? [])
    .filter((e) => !e.endsOn || daysUntil(e.endsOn) >= 0)
    .sort(
      (a, b) =>
        Number(b.hers) - Number(a.hers) ||
        String(a.startsOn ?? "9999").localeCompare(
          String(b.startsOn ?? "9999"),
        ),
    )
    .slice(0, limit);
  if (!list.length) return null;
  return (
    <FeedSection title="Events coming up" subtitle="Dates and little plans for your calendar." symbol="☆" tone="mint" level={4} className="feed-events">
      <ul>
        {list.map((event) => {
          const days = event.tbc ? null : daysUntil(event.startsOn);
          return (
            <li key={event.id} className="note-slip">
              <span className="micro-label">
                {event.hers ? "UR PICK · " : ""}
                {event.tier === "sg"
                  ? "SINGAPORE"
                  : (event.city ?? "REGIONAL").toUpperCase()}
                {event.tbc ? " · TBC" : ""}
              </span>
              <strong className="feed-card__headline">{event.name}</strong>
              <p className="feed-facts">
                {event.tbc
                  ? "dates to be confirmed"
                  : `${sgDate(event.startsOn)}${event.endsOn && event.endsOn !== event.startsOn ? `–${sgDate(event.endsOn)}` : ""}${event.venue ? ` · ${event.venue}` : ""}`}
              </p>
              <div className="note-slip__source">
                <a href={event.url} target="_blank" rel="noopener noreferrer">
                  event page ↗
                </a>
                {countdownLabel(days) && (
                  <span className="handwritten">{countdownLabel(days)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </FeedSection>
  );
}

export function FeedPlaces() {
  return (
    <div className="feed-places">
      <Link className="text-link" to="/world/saves">
        ur saves <Icon name="heart" size={14} />
      </Link>
      <Link className="text-link" to="/world/merch">
        the merch shelf <Icon name="arrow" size={14} />
      </Link>
    </div>
  );
}
