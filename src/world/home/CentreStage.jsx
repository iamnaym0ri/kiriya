import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BirthdayName from "../../shared/BirthdayName.jsx";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import { Star } from "../../shared/WorldPrimitives.jsx";
import { Bow } from "../../shared/play/PlayfulWorld.jsx";
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

let inkCanvas = null;
/** Where a line's ink starts and ends, in px from where its text starts (drawn once, then scanned). */
function inkExtent(text, font) {
  inkCanvas ??= document.createElement("canvas");
  const ctx = inkCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = font;
  const advance = ctx.measureText(text).width;
  const size = parseFloat(font.match(/([\d.]+)px/)?.[1] ?? "30");
  const pad = Math.ceil(size * 0.6);
  const width = Math.ceil(advance + pad * 2);
  const height = Math.ceil(size * 2);
  if (!(advance > 0) || width > 4000) return null;
  inkCanvas.width = width;
  inkCanvas.height = height;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, pad, height / 2);
  const { data } = ctx.getImageData(0, 0, width, height);
  const inked = (x) => {
    for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 40) return true;
    return false;
  };
  let left = 0;
  while (left < width && !inked(left)) left++;
  let right = width - 1;
  while (right > left && !inked(right)) right--;
  if (left >= width) return null;
  return { advance, left: left - pad, right: right + 1 - pad };
}

/**
 * Centres a line by its ink rather than its box. A glyph's ink rarely fills its advance exactly:
 * Parisienne's "k" swings 9 pt left of where the word's box starts, and Gaegu's "." leaves a few
 * points of empty advance after it, so a box centred on the screen leaves the letters a little to
 * the left. The line is drawn once in the same font on a small canvas to find where its ink really
 * starts and ends; the difference becomes `--ink-shift` (a `translate` in home.css). Measured again
 * when the text or its size changes.
 */
function useInkCentre(target, text, source = target) {
  useLayoutEffect(() => {
    const node = target.current;
    const textNode = typeof source === "string" ? node?.querySelector(source) : source.current;
    if (!node || !textNode || typeof ResizeObserver === "undefined") return undefined;
    let live = true;
    let frame = 0;
    let retry = 0;
    let tries = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!live) return;
        const style = getComputedStyle(textNode);
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const words = textNode.textContent.trim();
        if (!words) return;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const laidOut = range.getBoundingClientRect().width;
        const draw = () => {
          if (!live) return;
          const ink = inkExtent(words, font);
          if (!ink) return;
          // The canvas must have drawn the same font as the page (same advance): if the web font
          // wasn't ready for it yet, look again shortly rather than shift by a fallback's shape.
          if (laidOut > 0 && Math.abs(ink.advance - laidOut) / laidOut > 0.02) {
            if (tries++ < 8) retry = setTimeout(measure, 250);
            return;
          }
          const shift = ink.advance / 2 - (ink.left + ink.right) / 2;
          // A broken measurement must never throw the line across the screen.
          if (Number.isFinite(shift) && Math.abs(shift) < 24) node.style.setProperty("--ink-shift", `${shift.toFixed(1)}px`);
          // The line's own width, for anything that sits beside it (Josh's pencil).
          node.style.setProperty("--line-w", `${Math.round(textNode.getBoundingClientRect().width)}px`);
        };
        if (document.fonts?.load) document.fonts.load(font, words).then(draw, draw);
        else draw();
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(textNode);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      clearTimeout(retry);
      observer.disconnect();
    };
  }, [target, source, text]);
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
  const greetLine = useRef(null);
  const greetText = useRef(null);
  const nameLine = useRef(null);
  useInkCentre(greetLine, greeting, greetText);
  // Only the letters count, not the charms around them.
  useInkCentre(nameLine, name, ".birthday-name__ink");

  return (
    <section className="home-stage" aria-labelledby="home-title" data-motion-region>
      {/* The first thing she sees on home: companions keep off it (the dateline above is their perch). */}
      <div className="home-stage__hello" data-companion-avoid data-companion-never>
        {/* The greeting is centred on its own: Josh's pencil hangs off its right end, out of the flow,
            so it never pushes the words off the middle. */}
        <p ref={greetLine} className="handwritten world-welcome__greeting home-stage__greeting">
          <span ref={greetText} className="home-stage__greeting-line">
            {greeting}
          </span>
          <AdminEdit compact label="the greeting" className="home-stage__pencil home-stage__pencil--greeting" onClick={() => setEditing("greeting")} />
        </p>
        <h1 ref={nameLine} id="home-title" className="world-welcome__name home-stage__name">
          <BirthdayName>{name}</BirthdayName>
        </h1>
      </div>

      <figure className="home-stage__frame">
        <FrameDecor />
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

/**
 * The display's decorations: a bow tied on the top-left corner, a star (and a little sparkle) on
 * the top-right one, a heart sticker on the bottom-left, and a stitched line inside the frame
 * (home.css). Drawn once; the bow sways and the star twinkles on their own layers, both still with
 * Reduce Motion or "still" animations.
 */
function FrameDecor() {
  return (
    <span className="home-stage__decor" aria-hidden="true">
      <span className="home-stage__bow">
        <Bow />
      </span>
      <span className="home-stage__star">
        <Star width="40" height="40" />
      </span>
      <span className="home-stage__spark">
        <Star width="15" height="15" />
      </span>
      <span className="home-stage__heart">
        <svg viewBox="0 0 40 36" width="34" height="31">
          <path d="M20 33C8 25 3 18.5 3 12 3 6.8 7 3 11.8 3c3.5 0 6.4 2 8.2 5 1.8-3 4.7-5 8.2-5C33 3 37 6.8 37 12c0 6.5-5 13-17 21Z" />
          <path className="home-stage__heart-shine" d="M9.5 10.5c.6-2.3 2.4-3.6 4.6-3.6" />
        </svg>
      </span>
    </span>
  );
}

/** Photos side by side; she swipes between them (native scroll snapping). */
function PhotoCarousel({ photos, index, onIndex }) {
  const strip = useRef(null);
  const settled = useRef(false);
  const many = photos.length > 1;
  // The first photo she sees: the app's opening waits for it (data-opening-wait, capped there).
  const [shown, setShown] = useState(false);
  const firstPhoto = useRef(null);
  useEffect(() => {
    const img = firstPhoto.current;
    if (!img || (img.complete && img.naturalWidth > 0)) setShown(true);
  }, []);

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
    <div
      className="home-stage__photos"
      data-companion-avoid
      data-opening-wait={(!shown && photos.length > 0) || undefined}
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={many ? "Photos of you" : undefined}
    >
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
              ref={i === index ? firstPhoto : undefined}
              onLoad={i === index ? () => setShown(true) : undefined}
              onError={i === index ? () => setShown(true) : undefined}
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
