import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { creditLine, useReportGone, youtubeSong } from "../../lib/feeds.js";
import { Bow, usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import { Icon, Modal } from "../../shared/WorldPrimitives.jsx";
import { useMusic } from "../../shared/music/MusicRoom.jsx";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import {
  FeedActions,
  FeedFacts,
  FeedLinks,
  FeedMedia,
  feedMediaLayout,
} from "../feeds/FeedPieces.jsx";
import "./LoreCarousel.css";

const NO_FEED = [];
const FEED_LABELS = {
  visual: "TODAY’S DROP",
  note: "A LITTLE NOTE",
  meme: "A LITTLE MEME",
  merch: "FOR THE SHELF",
};
const FEED_MASCOTS = ["curious", "smug", "thinking", "sparkle"];

// A feed entry in the shape the carousel already renders. Text-only notes borrow the chibi.
function feedSlide(entry, index) {
  const primary = entry.primary;
  const words = entry.companions?.[0] ?? primary;
  const media = primary.media?.[0];
  return {
    id: `feed:${entry.key}`,
    feed: entry,
    words,
    label: `${FEED_LABELS[entry.type] ?? "TODAY’S DROP"}${entry.seen ? " · SEEN EARLIER" : " · NEW"}`,
    title: words.blurb?.headline || words.title,
    body: words.blurb?.text,
    aside: words === primary ? primary.title : primary.blurb?.headline,
    source: words.url,
    sourceLabel: creditLine(words) || "the source",
    tag: words.signature ?? "✦ kiriya.love",
    song: youtubeSong(primary),
    mascot: media ? null : FEED_MASCOTS[index % FEED_MASCOTS.length],
    fit: ["meme", "merch"].includes(entry.type) ? "contain" : "cover",
    credit: creditLine(primary),
  };
}

export default function LoreCarousel({ kind, feed = NO_FEED, onSeen }) {
  const { moving } = usePlayful();
  const music = useMusic();
  const reportGone = useReportGone();
  const query = useQuery({
    queryKey: ["me", "curation", kind],
    queryFn: () => api(`/me/curation?kind=${kind}`),
    staleTime: Infinity,
  });
  const [active, setActive] = useState(0);
  const [rotating, setRotating] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const ref = useRef(null);
  const toggleIntent = useRef(null);
  const authored = query.data?.slides;
  // Today's feed slides lead; the hand-written slides stay as evergreen pages after them.
  const slides = useMemo(
    () => [...feed.map(feedSlide), ...(authored ?? [])],
    [feed, authored],
  );
  const current = slides.length ? Math.min(active, slides.length - 1) : 0;
  const playing =
    moving && rotating && !hovered && inView && !enlarged && slides.length > 1;
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      16000,
    );
    return () => clearInterval(timer);
  }, [playing, slides.length]);
  const slide = slides[current];
  const name = kind === "maomao" ? "Maomao" : "Miku";
  const feedIds = slide?.feed?.ids;
  const seen = () => feedIds && onSeen?.(feedIds);
  // A feed slide counts as seen after 1.5 s as the active slide, on screen, in a visible tab.
  useEffect(() => {
    if (!feedIds || !inView || !onSeen) return;
    let timer = null;
    const arm = () => {
      clearTimeout(timer);
      if (!document.hidden)
        timer = setTimeout(() => {
          if (!document.hidden) onSeen(feedIds);
        }, 1500);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
    // Re-arm per slide; the IDs are derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, inView, onSeen]);
  function go(index) {
    setRotating(false);
    setActive((index + slides.length) % slides.length);
  }
  return (
    <div
      ref={ref}
      className={`lore-carousel lore-carousel--${kind}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${name} picture & lore collection`}
      data-motion-region
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setRotating(false)}
      onPointerDownCapture={(e) => {
        if (e.pointerType === "touch" && !e.target.closest(".lore-rotation"))
          setRotating(false);
      }}
    >
      <div className="lore-carousel__top">
        <span className="pixel-label">
          {kind === "maomao"
            ? "🌿 THE MAOMAO FAN CLUB"
            : "🎧 MIKU, WITH A LITTLE LORE"}
        </span>
        <button
          className="lore-rotation"
          disabled={!moving || slides.length < 2}
          onPointerDown={() => {
            toggleIntent.current = !rotating;
          }}
          onPointerCancel={() => {
            toggleIntent.current = null;
          }}
          onClick={() => {
            setRotating(toggleIntent.current ?? !rotating);
            toggleIntent.current = null;
          }}
          aria-label={
            !moving
              ? `${name} slideshow motion paused`
              : `${rotating ? "Pause" : "Start"} ${name} slideshow`
          }
        >
          <Icon name={rotating && moving ? "pause" : "play"} size={12} />
          <span>
            {!moving
              ? "still pictures"
              : rotating
                ? "let’s linger · pause"
                : "let them wander · play"}
          </span>
        </button>
      </div>
      {slide ? (
        <>
          <div
            className="lore-carousel__spread"
            aria-live={playing ? "off" : "polite"}
            aria-atomic="true"
          >
            <div
              className="lore-slide"
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${current + 1} of ${slides.length}`}
            >
              <figure
                className={`lore-picture ${slide.mascot ? "lore-picture--chibi" : ""} ${kind === "miku" && !slide.song ? "lore-picture--character" : ""}${slide.feed ? " lore-picture--feed" : ""}`}
                {...(slide.feed ? feedMediaLayout(slide.feed.primary) : {})}
                data-fit={slide.feed ? slide.fit : undefined}
              >
                <Bow />
                <button
                  className="lore-picture__enlarge"
                  style={
                    !slide.mascot && !slide.feed && slide.image.aspect
                      ? { aspectRatio: slide.image.aspect }
                      : undefined
                  }
                  aria-label={`Enlarge ${name} ${slide.feed ? "picture" : "illustration"}`}
                  onClick={() => {
                    seen();
                    setEnlarged(true);
                  }}
                >
                  {slide.mascot ? (
                    <div className="lore-chibi">
                      <span aria-hidden="true">♡</span>
                      <MaomaoMascot expression={slide.mascot} size={220} />
                      <span className="handwritten">
                        猫猫 appreciation club
                      </span>
                    </div>
                  ) : slide.feed ? (
                    <FeedMedia
                      item={slide.feed.primary}
                      active={!enlarged}
                      onGone={reportGone}
                    />
                  ) : (
                    <img
                      src={slide.image.url}
                      alt={slide.image.alt}
                      loading="lazy"
                    />
                  )}
                  <span className="lore-zoom" aria-hidden="true">
                    <Icon name="diagonal" size={17} />
                  </span>
                </button>
                <figcaption>{slide.aside}</figcaption>
              </figure>
              <div className="lore-note">
                <span className="lore-stamp" aria-hidden="true">
                  {kind === "maomao" ? "猫猫" : "ミク"}
                  <small>♡</small>
                </span>
                <span className="pixel-label">{slide.label}</span>
                <h3>{slide.title}</h3>
                <p>{slide.body}</p>
                {slide.feed && <FeedFacts item={slide.words} />}
                {slide.song && (
                  <button
                    className="button-plum lore-song"
                    onClick={() => {
                      seen();
                      music.play(slide.song);
                    }}
                  >
                    <Icon name="play" size={14} />
                    Listen to {slide.song.title}
                  </button>
                )}
                <div className="lore-note__source">
                  <a
                    href={slide.source}
                    target="_blank"
                    rel="noreferrer"
                    onClick={seen}
                  >
                    {slide.sourceLabel} ↗
                  </a>
                  <span>{slide.tag}</span>
                </div>
                {slide.feed && (
                  <div className="lore-feed-actions">
                    <FeedLinks
                      item={slide.feed.primary}
                      onOpen={seen}
                      limit={3}
                    />
                    <FeedActions item={slide.feed.primary} onSeen={seen} />
                  </div>
                )}
                <span className="lore-note__doodle" aria-hidden="true">
                  {kind === "maomao" ? "( = ⩊ = )  ♡" : "♫  ♡  ♪"}
                </span>
              </div>
            </div>
          </div>
          <div className="lore-carousel__bottom">
            <small>
              {slide.feed
                ? slide.credit
                : slide.mascot
                  ? "A little fan-made chibi for this page"
                  : slide.image.credit}
            </small>
            <div className="lore-pagination">
              <button
                aria-label={`Previous ${name} slide`}
                onClick={() => go(current - 1)}
              >
                ←
              </button>
              <span aria-label={`Picture ${current + 1} of ${slides.length}`}>
                {String(current + 1).padStart(2, "0")}{" "}
                <i>/ {String(slides.length).padStart(2, "0")}</i>
              </span>
              <button
                aria-label={`Next ${name} slide`}
                onClick={() => go(current + 1)}
              >
                →
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="lore-loading">
          <span aria-hidden="true">♡</span>
          <p>
            {query.isError
              ? "This little collection couldn’t load."
              : "Opening a few favourite pages…"}
          </p>
          {query.isError && (
            <button className="text-link" onClick={() => query.refetch()}>
              Try again ↺
            </button>
          )}
        </div>
      )}
      {enlarged && slide && (
        <Modal
          title={slide.title}
          onClose={() => setEnlarged(false)}
          className="gallery-dialog"
        >
          {slide.mascot ? (
            <div className="lore-chibi">
              <MaomaoMascot expression={slide.mascot} size={260} />
            </div>
          ) : slide.feed ? (
            <FeedMedia
              item={slide.feed.primary}
              viewer
              onGone={(id) => {
                reportGone(id);
                setEnlarged(false);
              }}
            />
          ) : (
            <img src={slide.image.url} alt={slide.image.alt} />
          )}
          <p>
            {slide.feed
              ? slide.credit
              : slide.mascot
                ? "A little fan-made chibi for this page"
                : slide.image.credit}
          </p>
          <div className="gallery-dialog__actions">
            <button className="button-paper" onClick={() => go(current - 1)}>
              Previous
            </button>
            <button className="button-paper" onClick={() => go(current + 1)}>
              Next
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
