// Small duotone icons for her interests. Strokes follow `currentColor`; fills use --icon-fill.
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const fill = { fill: "var(--icon-fill, currentColor)" };

const ICONS = {
  vocaloid: (
    <>
      <path {...stroke} d="M8.5 18V6.2l11-2.4v11.6" />
      <path {...stroke} d="M8.5 9.4l11-2.4" />
      <circle {...fill} cx="6" cy="18" r="2.6" />
      <circle {...fill} cx="17" cy="15.6" r="2.6" />
      <circle {...stroke} cx="6" cy="18" r="2.6" />
      <circle {...stroke} cx="17" cy="15.6" r="2.6" />
    </>
  ),
  apothecary: (
    <>
      <path {...fill} d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" />
      <path {...stroke} d="M3.5 12h17a8.5 8.5 0 0 1-17 0zM8.5 21h7" />
      <path {...stroke} d="M14.5 12l5-8.5" />
      <path {...stroke} d="M7 10c-.2-3 1.6-5.2 4.8-5.6.2 3.1-1.6 5.3-4.8 5.6zM7 10l2.6-3" />
    </>
  ),
  artist: (
    <>
      <path {...fill} d="M14.3 5.7l4 4-8.6 8.6-4.5.5.5-4.5z" />
      <path {...stroke} d="M14.3 5.7l4 4-8.6 8.6-4.5.5.5-4.5zM16.3 3.7a2.8 2.8 0 0 1 4 4l-2 2-4-4z" />
      <path {...stroke} d="M4 21h5" />
    </>
  ),
  cosplay: (
    <>
      <rect {...fill} x="7" y="7" width="10" height="10" rx="1" />
      <path {...stroke} d="M5 4.5h14M5 19.5h14M7 4.5v15M17 4.5v15" />
      <path {...stroke} d="M7 10.5c3.2-1.6 6.8 1.6 10 0M7 14c3.2-1.6 6.8 1.6 10 0" />
      <path {...stroke} d="M20.5 2.5l-3 5" />
    </>
  ),
  ballet: (
    <>
      <path {...fill} d="M4 17.2c0-3.8 2.6-8.4 6.6-8.4 3.2 0 5.3 2.6 6.2 5.3l1.7 4.3c.5 1.3-.4 2.6-1.8 2.6H6.4C5 21 4 19.8 4 17.2z" />
      <path {...stroke} d="M4 17.2c0-3.8 2.6-8.4 6.6-8.4 3.2 0 5.3 2.6 6.2 5.3l1.7 4.3c.5 1.3-.4 2.6-1.8 2.6H6.4C5 21 4 19.8 4 17.2z" />
      <path {...stroke} d="M9 9.2L6.5 3M12.4 9.3l3.8-5.8M7 3.4c3 1.4 6 1.4 9.2.1" />
    </>
  ),
  fashion: (
    <>
      <path {...fill} d="M12 11.5C9.2 8.4 3.8 6.4 3.8 10.4s5.4 4.1 8.2 1.1zM12 11.5c2.8-3.1 8.2-5.1 8.2-1.1s-5.4 4.1-8.2 1.1z" />
      <path {...stroke} d="M12 11.5C9.2 8.4 3.8 6.4 3.8 10.4s5.4 4.1 8.2 1.1zm0 0c2.8-3.1 8.2-5.1 8.2-1.1s-5.4 4.1-8.2 1.1z" />
      <path {...stroke} d="M11 12.6L8.6 20l2-1.2 1.4 1.8M13 12.6l2.4 7.4-2-1.2-1.4 1.8" />
    </>
  ),
  birthday: (
    <>
      <rect {...fill} x="4" y="12" width="16" height="8.5" rx="2" />
      <path {...stroke} d="M4 14.5c1.6 1.4 3.2 1.4 4 0 .8 1.4 3.2 1.4 4 0 .8 1.4 3.2 1.4 4 0 .8 1.4 2.4 1.4 4 0" />
      <rect {...stroke} x="4" y="12" width="16" height="8.5" rx="2" />
      <path {...stroke} d="M12 12V8" />
      <path {...fill} d="M12 3.2c1.2 1.6 1.6 2.6.9 3.5-.4.5-1.4.5-1.8 0-.7-.9-.3-1.9.9-3.5z" />
    </>
  ),
};

export const INTEREST_LABELS = {
  vocaloid: "Vocaloid lover",
  apothecary: "Apothecary apprentice",
  artist: "Artist",
  cosplay: "Cosplayer",
  ballet: "Ballet dancer",
  fashion: "Fashion",
  birthday: "Birthday week",
  art: "Artist",
};

export default function InterestIcon({ name, size = 24, className = "" }) {
  const key = name === "art" ? "artist" : name;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[key] ?? ICONS.fashion}
    </svg>
  );
}
