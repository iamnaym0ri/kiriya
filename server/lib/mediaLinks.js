import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

// The bundled iPhone app runs on capacitor://localhost and signs in with a bearer token, which an
// <img>, <audio> or CSS url() can't send. So for bearer requests the API swaps every private media
// link in its JSON for an absolute one carrying a signature for that one file, and swaps them back
// in what the app sends, so the database only ever holds the plain relative links the website uses.
// Signatures don't expire (the files' names are unguessable and the links are stable, so the phone's
// HTTP cache keeps them); rotating SESSION_SECRET retires them all.

const LINK = /(?<=["'(\s])\/api\/uploads\/(?:media\?path=([A-Za-z0-9%._~-]+)|file\/([A-Za-z0-9._-]+)|wallpapers\/([a-z]+)(?:\?v=\d+)?)/g;

const resource = { media: (path) => `media:${path}`, file: (name) => `file:${name}`, wallpaper: (key) => `wallpaper:${key}` };

export function mediaSignature(of) {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", env.sessionSecret).update(`kw-media-v1|${of}`).digest("base64url").slice(0, 22);
}

function signatureOk(of, signature) {
  if (typeof signature !== "string" || signature.length !== 22) return false;
  const expected = Buffer.from(mediaSignature(of));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const mediaSignatureOk = {
  media: (path, s) => signatureOk(resource.media(path), s),
  file: (name, s) => signatureOk(resource.file(name), s),
  wallpaper: (key, s) => signatureOk(resource.wallpaper(key), s),
};

/** Relative private-media links → absolute, signed links on `origin`. */
export function signMediaLinks(text, origin) {
  return text.replace(LINK, (link, encodedPath, file, wallpaper) => {
    let of;
    if (encodedPath) {
      try {
        of = resource.media(decodeURIComponent(encodedPath));
      } catch {
        return link;
      }
    } else of = file ? resource.file(file) : resource.wallpaper(wallpaper);
    return `${origin}${link}${link.includes("?") ? "&" : "?"}s=${mediaSignature(of)}`;
  });
}

/** The reverse, for what the bundled app sends back: absolute signed links → the stored relative form. */
export function unsignMediaLinks(text, origin) {
  const escaped = origin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return text.replace(new RegExp(`${escaped}(\\/api\\/uploads\\/[A-Za-z0-9%._~?=&/-]*?)[?&]s=[A-Za-z0-9_-]{22}`, "g"), "$1");
}
