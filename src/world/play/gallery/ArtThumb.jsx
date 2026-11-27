import { useEffect, useRef, useState } from "react";
import { thumbFailed, thumbFor, thumbNow } from "./thumbs.js";

/**
 * A gallery tile's picture: its small copy (thumbs.js) rather than the full-size file. In the long
 * grid it is only drawn while the tile is within a couple of screens of where she is, so the phone
 * never holds every picture at once; `eager` draws it straight away (the play section's short strip).
 */
export default function ArtThumb({ art, eager = false }) {
  const box = useRef(null);
  const [near, setNear] = useState(eager);
  const [src, setSrc] = useState(() => thumbNow(art.id));
  const [full, setFull] = useState(() => thumbFailed(art.id));

  useEffect(() => {
    if (eager) return undefined;
    const element = box.current;
    if (!element || typeof IntersectionObserver !== "function") {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "1400px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!near || src || full) return undefined;
    let live = true;
    thumbFor(art).then((url) => {
      if (!live) return;
      if (url) setSrc(url);
      else setFull(true);
    });
    return () => {
      live = false;
    };
  }, [near, art.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = full ? art.url : src;
  return (
    <span ref={box} className="art-thumb" aria-hidden="true">
      {near && shown && <img src={shown} alt="" decoding="async" draggable={false} />}
    </span>
  );
}
