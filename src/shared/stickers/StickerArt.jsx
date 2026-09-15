// Collectible sticker art for the daily drawer. Die-cut look: soft white edge, gentle outline.
const line = { stroke: "#2b1b35", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" };

const ART = {
  kitten: (
    <>
      <path d="M14 30l2-18 12 9c3-1 5-1 8 0l12-9 2 18c2 4 3 8 2 12-2 10-10 14-20 14s-18-4-20-14c-1-4 0-8 2-12z" fill="#fffaf4" {...line} />
      <path d="M17 17l5 4M47 17l-5 4" stroke="#f1a46c" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 22c4-3 8-2 10 2-4 2-8 2-10-2z" fill="#2b1b35" />
      <ellipse cx="24" cy="36" rx="2.2" ry="3" fill="#2b1b35" />
      <ellipse cx="40" cy="36" rx="2.2" ry="3" fill="#2b1b35" />
      <path d="M30.5 41h3l-1.5 1.5z" fill="#f96cab" />
      <ellipse cx="19" cy="42" rx="3.4" ry="2" fill="#ffa4c9" />
      <ellipse cx="45" cy="42" rx="3.4" ry="2" fill="#ffa4c9" />
      <path d="M22 50q10 5 20 0" stroke="#7e39df" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </>
  ),
  sprig: (
    <>
      <path d="M32 58V20" {...line} fill="none" />
      <path d="M32 40c-12-1-19-9-19-19 11 1 19 8 19 19zM32 30c10-1 16-8 16-17-10 1-16 7-16 17zM32 50c-9-1-14-6-14-13 8 1 14 5 14 13z" fill="#9fd08f" {...line} />
      <circle cx="46" cy="44" r="4" fill="#f96cab" {...line} />
    </>
  ),
  leek: (
    <>
      <path d="M14 54l26-28" stroke="#2b1b35" strokeWidth="13" strokeLinecap="round" />
      <path d="M14 54l26-28" stroke="#fffaf4" strokeWidth="8" strokeLinecap="round" />
      <path d="M40 26c-2-10 2-18 10-21 0 8-4 15-10 21zM40 26c7-6 15-7 21-3-5 5-13 6-21 3zM40 26c-5-7-5-15 0-21 3 7 3 14 0 21z" fill="#6fcf97" {...line} />
      <path d="M12 56l4-4" stroke="#39c5bb" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  pointe: (
    <>
      <path d="M10 44c0-10 7-22 18-22 8 0 13 6 16 13l5 11c1 4-1 7-5 7H16c-4 0-6-3-6-9z" fill="#ffcce0" {...line} />
      <path d="M44 35c3 1 6 4 6 8" {...line} fill="none" />
      <path d="M22 24l-6-16M30 23l8-15M14 9c8 3 16 3 26-1" stroke="#e52f8c" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),
  bow: (
    <>
      <path d="M32 30C23 16 6 13 6 26s17 11 26 5zM32 30c9-14 26-17 26-4s-17 11-26 5z" fill="#1f1030" {...line} />
      <path d="M29 33L21 57l7-4 4 6 1-25zM35 33l8 24-7-4-4 6-1-25z" fill="#1f1030" {...line} />
      <rect x="26" y="24" width="12" height="13" rx="5" fill="#e52f8c" {...line} />
      <path d="M13 22c2-3 5-4 8-3M43 19c3-1 6 0 8 3" stroke="#b589ff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),
  brush: (
    <>
      <path d="M40 8l16 16-22 22-9 2 2-9z" fill="#cfb4ff" {...line} />
      <path d="M27 39l-12 12c-4 4-8 3-9 7 5 0 9-1 13-5l12-12z" fill="#e52f8c" {...line} />
      <path d="M36 16l12 12" {...line} />
    </>
  ),
  star: (
    <>
      <path d="M32 5l7.6 17.4L58 24.6 44 37.4l4 18.6L32 46.6 16 56l4-18.6L6 24.6l18.4-2.2z" fill="#ffd166" {...line} />
      <path d="M22 28l5-1" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  bottle: (
    <>
      <rect x="25" y="6" width="14" height="8" rx="2" fill="#a36a4a" {...line} />
      <path d="M26 14h12v6c8 3 12 10 12 18 0 11-8 20-18 20s-18-9-18-20c0-8 4-15 12-18z" fill="#e3d4ff" {...line} />
      <path d="M16 40c5 4 27 4 32 0 0 10-7 16-16 16s-16-6-16-16z" fill="#995cf7" />
      <rect x="22" y="28" width="20" height="9" rx="2" fill="#fff" {...line} strokeWidth="1.8" />
      <path d="M26 32.5h12" stroke="#2b1b35" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  mirror: (
    <>
      <ellipse cx="32" cy="26" rx="18" ry="21" fill="#fff3a6" {...line} />
      <ellipse cx="32" cy="26" rx="12" ry="15" fill="#e3f7ff" {...line} strokeWidth="1.8" />
      <path d="M26 18l6-4M24 26l12-8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 47v12M26 59h12" {...line} />
    </>
  ),
  cake: (
    <>
      <rect x="10" y="30" width="44" height="24" rx="5" fill="#ffcce0" {...line} />
      <path d="M10 36c4 4 7 4 11 0 4 4 7 4 11 0 4 4 7 4 11 0 4 4 7 4 11 0" fill="none" stroke="#e52f8c" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 30V18" {...line} />
      <path d="M32 7c3 4 4 6 2 9-1 1-3 1-4 0-2-3-1-5 2-9z" fill="#ffd166" {...line} strokeWidth="1.8" />
      <circle cx="20" cy="46" r="2" fill="#7e39df" />
      <circle cx="44" cy="46" r="2" fill="#7e39df" />
      <circle cx="32" cy="48" r="2" fill="#2b1b35" />
    </>
  ),
};

export const STICKER_ARTS = Object.keys(ART);

export default function StickerArt({ art, size = 64, className = "" }) {
  return (
    <svg className={`sticker-art ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {ART[art] ?? ART.star}
    </svg>
  );
}
