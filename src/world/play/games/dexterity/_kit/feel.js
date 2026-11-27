import { haptic } from "../../../../../lib/native.js";
import { prefersLessMotion } from "../../../../../shared/effects.js";
import { readFlag, writeFlag } from "./storage.js";

// Haptics: a gentle tick on most things, never more than one every 45 ms so a busy moment doesn't
// turn into a buzz. On the website haptic() does nothing.
let lastBuzz = 0;
export function buzz(kind = "light") {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  if (kind === "light" && now - lastBuzz < 45) return;
  lastBuzz = now;
  haptic(kind);
}

/** Calm mode: slower, gentler, no shaking. On by default when she has asked for less motion. */
export const calmByDefault = () => readFlag("calm", prefersLessMotion());
export const rememberCalm = (on) => writeFlag("calm", on);
