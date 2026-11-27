// The chat's look (round 3): whole-chat themes, bubble designs and backgrounds, each person's own
// (saved in their chat prefs, server/lib/chat.js). Plain data and functions only, so tests can
// read it (scripts/test-chat-themes.mjs); ./index.js adds the stylesheets.
import { WALLPAPERS, wallpaperUrl } from "../wallpapers.js";

/** Whole-chat themes: [key, name, what it's like, three colours for its chip]. */
export const THEMES = [
  { key: "lilac", label: "lilac", note: "the original", swatch: ["#f3eaf7", "#82559f", "#fffaff"] },
  { key: "white", label: "pure white", note: "clean & bright", swatch: ["#ffffff", "#6e46a0", "#f1f0f4"] },
  { key: "cream", label: "cream", note: "warm paper", swatch: ["#faf3e6", "#ecd5b5", "#95583a"] },
  { key: "dark", label: "dark", note: "easy at night", swatch: ["#15121a", "#6a478c", "#27222f"] },
  { key: "love", label: "love", note: "all heart", swatch: ["#fff0f4", "#c42a60", "#ffd9e5"] },
  { key: "miku", label: "miku", note: "teal & a little pink", swatch: ["#edf9f8", "#0d7770", "#ffd6ea"] },
  { key: "herbal", label: "apothecary", note: "sage & parchment", swatch: ["#f1efe3", "#55744a", "#efe4cc"] },
  { key: "sky", label: "cloudy sky", note: "soft blue", swatch: ["#eef4fd", "#376aae", "#ffffff"] },
];

/** Bubble designs (the names she already knows). */
export const BUBBLES = [
  { key: "lilac", label: "soft & round" },
  { key: "paper", label: "paper notes" },
  { key: "pixel", label: "pixel retro" },
  { key: "kawaii", label: "sparkly kawaii" },
  { key: "cat", label: "kitty" },
  { key: "flowers", label: "flowers" },
  { key: "fairy", label: "fairy dust" },
  { key: "gothic", label: "dark & gothic" },
  { key: "lovey", label: "lovey-dovey" },
];

/** Backgrounds. "theme" follows whichever theme is on. */
export const BACKGROUNDS = [
  { key: "theme", label: "the theme's own" },
  { key: "plain", label: "plain" },
  { key: "petals", label: "lilac petals" },
  { key: "hearts", label: "little hearts" },
  { key: "clouds", label: "clouds" },
  { key: "notebook", label: "notebook" },
  { key: "night", label: "night sky" },
  ...Object.entries(WALLPAPERS).map(([key, wallpaper]) => ({ key, label: wallpaper.label, wallpaper: true })),
];

export const TYPING = [
  { key: "hearts", label: "hearts" },
  { key: "maomao", label: "maomao grinding" },
  { key: "pencil", label: "pencil scribble" },
  { key: "dots", label: "classic dots" },
];

export const PHOTO_DEFAULTS = { x: 50, y: 50, zoom: 1, dim: 0.35, blur: 0 };
const known = (list, key, fallback) => (list.some((item) => item.key === key) ? key : fallback);

/** The photo's placement, clamped to what the sliders allow. */
export function photoSettings(prefs) {
  const photo = { ...PHOTO_DEFAULTS, ...(prefs?.photo ?? {}) };
  const clamp = (value, min, max, fallback) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
  return {
    x: clamp(photo.x, 0, 100, 50),
    y: clamp(photo.y, 0, 100, 50),
    zoom: clamp(photo.zoom, 1, 3, 1),
    dim: clamp(photo.dim, 0, 0.85, 0.35),
    blur: clamp(photo.blur, 0, 16, 0),
  };
}

/**
 * What the .chat root (or a preview of it) carries for someone's prefs: data-theme, data-bubble,
 * data-background and the background's variables. Spread it onto the element.
 */
export function chatLook(prefs = {}) {
  const theme = known(THEMES, prefs.theme, "lilac");
  const bubble = known(BUBBLES, prefs.bubble, "lilac");
  const background = prefs.background === "photo" ? (prefs.backgroundUrl ? "photo" : "theme") : known(BACKGROUNDS, prefs.background, "theme");
  const style = {};
  if (background === "photo") {
    const photo = photoSettings(prefs);
    style["--chat-photo"] = `url("${prefs.backgroundUrl}")`;
    style["--photo-x"] = `${photo.x}%`;
    style["--photo-y"] = `${photo.y}%`;
    style["--photo-zoom"] = String(photo.zoom);
    style["--photo-dim"] = String(photo.dim);
    style["--photo-blur"] = `${photo.blur}px`;
  }
  if (WALLPAPERS[background]) style["--chat-wallpaper"] = `url("${wallpaperUrl(background, prefs)}")`;
  return { "data-theme": theme, "data-bubble": bubble, "data-background": background, style };
}
