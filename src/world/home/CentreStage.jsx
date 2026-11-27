import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BirthdayName from "../../shared/BirthdayName.jsx";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import { captionFor, DEFAULT_GREETING, firstPhoto, nextCaptionAt, stageOf } from "./stage.js";
import { CaptionsSheet, GreetingSheet, PhotosSheet } from "./StageEditors.jsx";

/** Re-renders when the caption rotation ticks over (every two hours), and on return to the app. */
function useCaptionClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      const time = Date.now();
      setNow(time);
      timer = setTimeout(schedule, Math.min(nextCaptionAt(time) - time + 250, 86_400_000));
    };
    const wake = () => !document.hidden && schedule();
    schedule();
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
  return now;
}

/**
 * Her, centre stage: the greeting, her name, the photos Josh chose (swipe between them) and a
 * caption under each. On Josh's phone each part has a pencil.
 */
export default function CentreStage({ home, name = "kiriya", birthday = false, avatarUrl }) {
  const now = useCaptionClock();
  const stage = stageOf(home, avatarUrl);
  const { photos, captions, pinned } = stage;
  const [editing, setEditing] = useState(null);
  const [index, setIndex] = useState(() => firstPhoto(photos.length, now));
  const current = Math.min(index, photos.length - 1);
  const photo = photos[current];
  const caption = captionFor({ photo, index: current, captions, pinned, now });
  const greeting = birthday ? "happy birthday," : home?.greeting || DEFAULT_GREETING;

  return (
    <section className="home-stage" aria-labelledby="home-title" data-motion-region>
      {/* The first thing she sees on home: companions keep off it (the dateline above is their perch). */}
      <div className="home-stage__hello" data-companion-avoid>
        <p className="handwritten world-welcome__greeting home-stage__greeting">
          <span>{greeting}</span>
          <AdminEdit compact label="the greeting" className="home-stage__pencil" onClick={() => setEditing("greeting")} />
        </p>
        <h1 id="home-title" className="world-welcome__name home-stage__name">
          <BirthdayName>{name}</BirthdayName>
        </h1>
      </div>

      <figure className="home-stage__frame">
        <PhotoCarousel photos={photos} index={current} onIndex={setIndex} />
        <AdminEdit compact label="the photos" className="home-stage__pencil home-stage__pencil--photos" onClick={() => setEditing("photos")} />
        <figcaption className="home-stage__caption" data-companion-avoid>
          <span key={`${photo?.id}:${caption?.id}`} className="handwritten home-stage__praise" aria-live="polite">
            {caption?.text}
          </span>
          <span className="home-stage__sign">
            <AdminEdit compact label="the captions" className="home-stage__pencil" onClick={() => setEditing("captions")} />
            <span>
              {name} <span aria-hidden="true">♡</span>
            </span>
          </span>
        </figcaption>
      </figure>

      <GreetingSheet open={editing === "greeting"} onClose={() => setEditing(null)} greeting={home?.greeting ?? null} />
      <PhotosSheet open={editing === "photos"} onClose={() => setEditing(null)} stage={stage} />
      <CaptionsSheet open={editing === "captions"} onClose={() => setEditing(null)} stage={stage} currentPhoto={photo} />
    </section>
  );
}

/** Photos side by side; she swipes between them (native scroll snapping). */
function PhotoCarousel({ photos, index, onIndex }) {
  const strip = useRef(null);
  const settled = useRef(false);
  const many = photos.length > 1;

  // Open on today's photo without an animation.
  useLayoutEffect(() => {
    const node = strip.current;
    if (!node || settled.current) return;
    node.scrollLeft = index * node.clientWidth;
    settled.current = true;
  }, [index]);

  // The photo list changed (Josh edited it): stay within it.
  useEffect(() => {
    if (index > photos.length - 1) onIndex(Math.max(0, photos.length - 1));
  }, [photos.length, index, onIndex]);

  useEffect(() => {
    const node = strip.current;
    if (!node || !many) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.round(node.scrollLeft / Math.max(1, node.clientWidth));
        onIndex(Math.max(0, Math.min(photos.length - 1, next)));
      });
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
    };
  }, [many, photos.length, onIndex]);

  const go = (to) => {
    const node = strip.current;
    if (!node) return;
    const target = (to + photos.length) % photos.length;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo({ left: target * node.clientWidth, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div className="home-stage__photos" data-companion-avoid aria-roledescription={many ? "carousel" : undefined} aria-label={many ? "Photos of you" : undefined}>
      <div
        ref={strip}
        className="home-stage__strip"
        tabIndex={many ? 0 : -1}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(index + 1);
          if (event.key === "ArrowLeft") go(index - 1);
        }}
      >
        {photos.map((item, i) => (
          <div
            key={item.id}
            className="home-stage__slide"
            role={many ? "group" : undefined}
            aria-roledescription={many ? "slide" : undefined}
            aria-label={many ? `${i + 1} of ${photos.length}` : undefined}
          >
            <img
              src={item.src}
              alt={item.alt || "Kiriya"}
              width={item.width}
              height={item.height}
              style={{ objectPosition: `50% ${item.focus === "top" ? "18%" : item.focus === "bottom" ? "82%" : "50%"}` }}
              loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
              fetchPriority={i === index ? "high" : "auto"}
              decoding="async"
              draggable="false"
            />
          </div>
        ))}
      </div>
      {many && (
        <div className="home-stage__dots" aria-hidden="true">
          {photos.map((item, i) => (
            <span key={item.id} data-on={i === index || undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
