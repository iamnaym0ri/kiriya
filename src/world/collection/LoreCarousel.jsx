import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { Bow, usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import { Icon, Modal } from "../../shared/WorldPrimitives.jsx";
import { useMusic } from "../../shared/music/MusicRoom.jsx";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import "./LoreCarousel.css";

export default function LoreCarousel({ kind }) {
  const { moving } = usePlayful();
  const music = useMusic();
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
  const slides = query.data?.slides ?? [];
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
  const slide = slides[active];
  const name = kind === "maomao" ? "Maomao" : "Miku";
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
              aria-label={`${active + 1} of ${slides.length}`}
            >
              <figure
                className={`lore-picture ${slide.mascot ? "lore-picture--chibi" : ""} ${kind === "miku" && !slide.song ? "lore-picture--character" : ""}`}
              >
                <Bow />
                <button
                  className="lore-picture__enlarge"
                  style={
                    !slide.mascot && slide.image.aspect
                      ? { aspectRatio: slide.image.aspect }
                      : undefined
                  }
                  aria-label={`Enlarge ${name} illustration`}
                  onClick={() => setEnlarged(true)}
                >
                  {slide.mascot ? (
                    <div className="lore-chibi">
                      <span aria-hidden="true">♡</span>
                      <MaomaoMascot expression={slide.mascot} size={220} />
                      <span className="handwritten">
                        猫猫 appreciation club
                      </span>
                    </div>
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
                {slide.song && (
                  <button
                    className="button-plum lore-song"
                    onClick={() => music.play(slide.song)}
                  >
                    <Icon name="play" size={14} />
                    Listen to {slide.song.title}
                  </button>
                )}
                <div className="lore-note__source">
                  <a href={slide.source} target="_blank" rel="noreferrer">
                    {slide.sourceLabel} ↗
                  </a>
                  <span>{slide.tag}</span>
                </div>
                <span className="lore-note__doodle" aria-hidden="true">
                  {kind === "maomao" ? "( = ⩊ = )  ♡" : "♫  ♡  ♪"}
                </span>
              </div>
            </div>
          </div>
          <div className="lore-carousel__bottom">
            <small>
              {slide.mascot
                ? "A little fan-made chibi for this page"
                : slide.image.credit}
            </small>
            <div className="lore-pagination">
              <button
                aria-label={`Previous ${name} slide`}
                onClick={() => go(active - 1)}
              >
                ←
              </button>
              <span aria-label={`Picture ${active + 1} of ${slides.length}`}>
                {String(active + 1).padStart(2, "0")}{" "}
                <i>/ {String(slides.length).padStart(2, "0")}</i>
              </span>
              <button
                aria-label={`Next ${name} slide`}
                onClick={() => go(active + 1)}
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
          ) : (
            <img src={slide.image.url} alt={slide.image.alt} />
          )}
          <p>
            {slide.mascot
              ? "A little fan-made chibi for this page"
              : slide.image.credit}
          </p>
          <div className="gallery-dialog__actions">
            <button className="button-paper" onClick={() => go(active - 1)}>
              Previous
            </button>
            <button className="button-paper" onClick={() => go(active + 1)}>
              Next
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
