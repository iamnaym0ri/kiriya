// Official wallpapers for the Miku and Maomao chat backgrounds (owner, 2026-11-24: real official art,
// no generated images; served only after login from server/assets/wallpapers). Credits are shown
// in the look picker, on the chat while a wallpaper is on, and in Art & credits.
export const MIKU_CREDIT = "「初音ミク」はクリプトン・フューチャー・メディア株式会社の著作物です。 © Crypton Future Media, INC. www.piapro.net";
export const MAOMAO_CREDIT = "©日向夏・イマジカインフォス／「薬屋のひとりごと」製作委員会";
export const WALLPAPERS = {
  miku: { label: "miku", url: "/api/uploads/wallpapers/miku?v=1", credit: MIKU_CREDIT },
  maomao: { label: "maomao", url: "/api/uploads/wallpapers/maomao?v=1", credit: MAOMAO_CREDIT },
};
/** The link to show: the server's copy when it sent one (signed inside the iPhone app), else ours. */
export const wallpaperUrl = (key, prefs) => prefs?.wallpapers?.[key] ?? WALLPAPERS[key]?.url;
