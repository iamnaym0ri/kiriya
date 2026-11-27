// Photos, videos and GIFs inside messages (round 3). Every picture is shown through useMediaUrl
// (src/lib/chatCrypto.js), never from media.url directly, and every tile reserves its space from the
// stored width and height, so nothing jumps while it loads.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMediaUrl } from "../../lib/chatCrypto.js";
import { ChatIcon } from "./parts.jsx";

export const clock = (seconds = 0) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Discord's multi-image arrangement: one, two side by side, a big one beside two stacked, a 2 × 2
 * grid, then rows of three with whatever doesn't fit a row of three on top (one wide, or two).
 * Returns rows as tile counts; "feature" is the 3-photo layout.
 */
export function mosaic(count) {
  switch (count) {
    case 0:
      return [];
    case 1:
      return [1];
    case 2:
      return [2];
    case 3:
      return "feature";
    case 4:
      return [2, 2];
    default: {
      const top = count % 3;
      return [...(top ? [top] : []), ...Array.from({ length: Math.floor(count / 3) }, () => 3)];
    }
  }
}

/** A finished picture fades in over its reserved space (and over this phone's own preview). */
function useLoaded(src) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);
  return [loaded, () => setLoaded(true)];
}

function Progress({ value }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span className="tile__progress" aria-label={`uploading, ${Math.round(value)}%`}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={r} />
        <circle cx="18" cy="18" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.04, value / 100))} />
      </svg>
    </span>
  );
}

/** One photo or video in a message. `onOpen(index, element, urls)` opens the viewer. */
function Tile({ item, index, solo, onOpen, register }) {
  const isVideo = item.type === "video";
  const src = useMediaUrl(item);
  const posterEntry = useMemo(() => (isVideo && item.poster ? item.poster : null), [isVideo, item.poster]);
  const poster = useMediaUrl(posterEntry);
  const shown = isVideo ? poster : src;
  const [loaded, onLoad] = useLoaded(shown);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const box = useRef(null);
  const video = useRef(null);
  const local = isVideo ? item.poster?.localUrl : item.localUrl;
  const uploading = typeof item.progress === "number" && item.progress < 100;

  useEffect(() => {
    register?.(index, { src, poster, element: box.current });
  }, [register, index, src, poster]);

  // A solo video plays right in the bubble; one in a grid opens full screen.
  function tap(event) {
    if (uploading) return;
    if (isVideo && solo && src) {
      event.stopPropagation();
      if (!playing) {
        setPlaying(true);
        requestAnimationFrame(() => video.current?.play?.()?.catch?.(() => setPlaying(false)));
      } else if (video.current?.paused) video.current.play().catch(() => {});
      else video.current?.pause();
      return;
    }
    onOpen?.(index, box.current);
  }

  return (
    <span
      ref={box}
      className="tile"
      data-type={item.type}
      data-loaded={loaded || undefined}
      data-playing={playing || undefined}
      role="button"
      tabIndex={0}
      aria-label={isVideo ? `a video, ${clock(item.duration)}` : (item.alt ?? "a photo")}
      onClick={tap}
      onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && tap(event)}
    >
      {local && !loaded && <img className="tile__local" src={local} alt="" aria-hidden="true" draggable="false" />}
      {shown && <img className="tile__img" src={shown} alt="" draggable="false" decoding="async" loading="lazy" onLoad={onLoad} onError={onLoad} />}
      {isVideo && playing && src && (
        <video
          ref={video}
          className="tile__video"
          src={src}
          playsInline
          preload="auto"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setTime(0);
          }}
        />
      )}
      {isVideo && (
        <>
          {!playing && (
            <span className="tile__play" aria-hidden="true">
              <ChatIcon name="play" size={solo ? 26 : 20} />
            </span>
          )}
          <span className="tile__duration" aria-hidden="true">
            {playing ? `${clock(time)} / ${clock(item.duration)}` : clock(item.duration)}
          </span>
          {solo && playing && (
            <button
              type="button"
              className="tile__expand"
              aria-label="Watch full screen"
              onClick={(event) => {
                event.stopPropagation();
                video.current?.pause();
                setPlaying(false);
                onOpen?.(index, box.current);
              }}
            >
              <ChatIcon name="expand" size={18} />
            </button>
          )}
        </>
      )}
      {uploading && <Progress value={item.progress} />}
    </span>
  );
}

/**
 * The photos and videos of one message: a single one at the bubble's full width and its own shape
 * (very tall or very wide ones are gently capped), several in Discord's mosaic.
 */
export function Album({ items, onOpen }) {
  const urls = useRef([]);
  const register = useMemo(() => (index, value) => (urls.current[index] = value), []);
  const open = (index) =>
    onOpen?.(
      items.map((item, i) => ({
        type: item.type,
        src: urls.current[i]?.src ?? null,
        poster: urls.current[i]?.poster ?? null,
        thumb: item.type === "video" ? urls.current[i]?.poster : urls.current[i]?.src,
        width: item.width,
        height: item.height,
        alt: item.alt,
        element: urls.current[i]?.element,
      })),
      index,
    );
  const layout = mosaic(items.length);
  if (items.length === 1) {
    const [item] = items;
    const ratio = item.width && item.height ? Math.min(3, Math.max(0.42, item.width / item.height)) : 1;
    return (
      <div className="album album--solo" style={{ "--ar": ratio }}>
        <Tile item={item} index={0} solo onOpen={open} register={register} />
      </div>
    );
  }
  if (layout === "feature")
    return (
      <div className="album album--feature">
        {items.map((item, i) => (
          <Tile key={i} item={item} index={i} onOpen={open} register={register} />
        ))}
      </div>
    );
  let at = 0;
  return (
    <div className="album">
      {layout.map((count, row) => {
        const start = at;
        at += count;
        return (
          <div key={row} className="album__row" data-count={count}>
            {items.slice(start, start + count).map((item, i) => (
              <Tile key={start + i} item={item} index={start + i} onOpen={open} register={register} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Plays only while on screen, so a long history of GIFs and videos costs nothing off screen. */
function useOnScreen(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

/**
 * A GIF: GIPHY's full-size MP4 played as a muted, looping video (sharp and light), with a still as
 * its poster. Older messages only stored a small GIF; their GIPHY id still finds the better one.
 */
export function GifMedia({ media }) {
  const box = useRef(null);
  const onScreen = useOnScreen(box);
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [paused, setPaused] = useState(reduced);
  const mp4Entry = useMemo(() => {
    const url = media.mp4 ?? (media.giphyId && /^[A-Za-z0-9]+$/.test(media.giphyId) ? `https://media.giphy.com/media/${media.giphyId}/giphy.mp4` : null);
    return url ? { url } : null;
  }, [media.mp4, media.giphyId]);
  const stillEntry = useMemo(() => (media.still ? { url: media.still } : null), [media.still]);
  const mp4 = useMediaUrl(mp4Entry);
  const still = useMediaUrl(stillEntry);
  const image = useMediaUrl(media);
  const [failed, setFailed] = useState(false);
  const video = useRef(null);
  const ratio = media.width && media.height ? Math.min(2.4, Math.max(0.5, media.width / media.height)) : 4 / 3;
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (onScreen && !paused) node.play?.()?.catch?.(() => {});
    else node.pause?.();
  }, [onScreen, paused, mp4]);
  return (
    <div ref={box} className="gif" style={{ "--ar": ratio }} onClick={() => reduced && setPaused((p) => !p)}>
      {mp4 && !failed ? (
        <video ref={video} src={onScreen || video.current ? mp4 : undefined} poster={still ?? undefined} muted loop playsInline preload="metadata" aria-label={media.alt ?? "a GIF"} onError={() => setFailed(true)} />
      ) : (
        (image || still) && <img src={image ?? still} alt={media.alt ?? "a GIF"} loading="lazy" decoding="async" />
      )}
      <span className="gif__badge" aria-hidden="true">
        GIF
      </span>
      {reduced && paused && (
        <span className="tile__play" aria-hidden="true">
          <ChatIcon name="play" size={20} />
        </span>
      )}
    </div>
  );
}

/** An old sticker message (stickers are now the iPhone's own; old ones keep showing). */
export function StickerMedia({ media }) {
  const src = useMediaUrl(media);
  return <div className="msg__sticker">{src && <img src={src} alt={media.alt ?? "a sticker"} loading="lazy" decoding="async" />}</div>;
}

/** The tiny picture beside a quoted reply (its first photo, the video's poster or the GIF's still). */
export function QuoteThumb({ media, kind }) {
  const entry = useMemo(() => {
    if (!media) return null;
    if (kind === "image") {
      const first = media.items?.[0] ?? media;
      return first?.type === "video" ? (first.poster ?? null) : first;
    }
    if (kind === "gif") return media.still ? { url: media.still } : media;
    if (kind === "sticker") return media;
    return null;
  }, [media, kind]);
  const src = useMediaUrl(entry);
  if (!src) return null;
  return <img className="quote__thumb" src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" />;
}
