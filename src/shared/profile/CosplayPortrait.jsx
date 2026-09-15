import { useEffect, useState } from "react";
import { displayRotation } from "./displayRotation.js";
import "./CosplayPortrait.css";

export default function CosplayPortrait({ className = "", avatarUrl }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      const time = Date.now();
      setNow(time);
      timer = setTimeout(refresh, Math.min(displayRotation(time).nextAt - time + 250, 86_400_000));
    };
    const wake = () => { if (!document.hidden) refresh(); };
    refresh();
    document.addEventListener("visibilitychange", wake);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", wake); };
  }, []);
  const { photo, praise } = displayRotation(now, avatarUrl);
  return <figure className={`portrait-frame cosplay-portrait ${className}`} data-motion-region data-photo={photo.id}>
    <div className="portrait-frame__mat" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
      <img key={photo.id} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} fetchPriority="high" decoding="async"/>
    </div>
    <figcaption>
      <span key={praise.id} className="handwritten cosplay-portrait__praise" data-praise={praise.id}>{praise.text}</span>
      <span className="cosplay-portrait__signature">kiriya <span aria-hidden="true">♡</span></span>
    </figcaption>
  </figure>;
}
