// The app's opening (round 3, Josh: "a small library of 10 cute and brief animations whenever
// opening the app, before everything loads in"). In the first chunk on purpose: main.jsx starts it
// before React renders anything, so its first frame is up as early as the page can paint.
//
// - Its first frame is the native splash to the point (the same lilac, the same "kiriya" and sparkle,
//   drawn aspect-fill from the same 2732 square), and the native splash is hidden only once that
//   frame is painted: no flash, no jump.
// - One of ten little scenes (scenes.js), picked at random and never the same one twice in a row,
//   plays for about a second and a bit. Transform and opacity only, through the Web Animations API, so
//   it runs on the compositor while the app loads behind it, and no CSS rule can cut it short.
// - It leaves once its scene is done and the first screen is ready (home with its photo, the sign-in
//   screen, or wherever a notification asked to go). Face ID holds it while the prompt is up
//   (holdOpening). Capped, so a slow network never keeps her waiting: the app shows its own loaders.
// - Reduce Motion, or her "still" animations: the splash frame, then a soft fade.
// - Inside the app only; in local development with ?opening=1 (or ?opening=<scene id>).
import { isNativeApp } from "../../lib/native.js";
import { SCENES, sceneMarkup, backdropMarkup } from "./scenes.js";
import "./opening.css";

const LAST = "kiriya:opening-last";
const QUIET = "kiriya:quiet-motion"; // PlayfulWorld's "still" choice, read before React is up
const SCREEN_CAP_MS = 1800; // after the scene: how long a slow first screen may keep it up
const HOLD_CAP_MS = 9000; // Face ID's own prompt: never longer than this from the start
const EXIT_MS = 420;

let opening = null;
const beatWaiters = [];

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private storage: any scene will do */
    }
  },
};

function devChoice() {
  if (!import.meta.env.DEV) return null;
  try {
    return new URLSearchParams(window.location.search).get("opening");
  } catch {
    return null;
  }
}

function pickScene(asked) {
  const named = SCENES.find((scene) => scene.id === asked);
  if (named) return named;
  const last = store.get(LAST);
  const choices = SCENES.filter((scene) => scene.id !== last);
  return choices[Math.floor(Math.random() * choices.length)] ?? SCENES[0];
}

/** Is the first screen there yet? (Anything still loading marks itself with data-opening-wait.) */
function screenReady() {
  if (document.querySelector("[data-opening-wait]")) return false;
  const lock = document.querySelector(".native-lock");
  if (lock) return lock.dataset.ready === "true";
  const main = document.getElementById("world-main");
  if (main) return main.childElementCount > 0 && !main.querySelector(":scope > .page-loader");
  // (The blank lilac stand-in isn't a screen: NativeApp is about to cover it.)
  return Boolean(document.querySelector(".app-signin:not(.app-signin--blank), .public-scene, .admin, .closed-page"));
}

function hideNativeSplash() {
  if (!isNativeApp()) return;
  import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 120 }))
    .catch(() => {});
}

/**
 * Starts the opening, once, if this launch should have one. Safe to call anywhere; it does nothing
 * on the website.
 */
export function startOpening() {
  if (opening || typeof document === "undefined") return;
  const asked = devChoice();
  const native = isNativeApp();
  if (!native && !asked) return;
  // Launched in the background (a notification action): nothing to show her.
  if (document.hidden && native) {
    hideNativeSplash();
    return;
  }
  const quiet =
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) || store.get(QUIET) === "yes";
  const scene = quiet ? null : pickScene(asked);
  if (scene && !SCENES.some((s) => s.id === asked)) store.set(LAST, scene.id);

  const root = document.createElement("div");
  root.className = "opening";
  root.setAttribute("aria-hidden", "true");
  root.dataset.scene = scene?.id ?? "still";
  root.innerHTML = `<div class="opening__stage">${backdropMarkup()}${sceneMarkup(scene)}</div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add("opening-active");

  const animations = scene ? scene.play(root) : [];
  // Hold every animation on its first frame until that frame is on screen.
  animations.forEach((animation) => animation.pause());
  // Development: ?opening=<id>&opening-at=<ms> freezes that moment (for screenshots).
  const frozen = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("opening-at") : null;
  if (frozen !== null) {
    animations.forEach((animation) => (animation.currentTime = Number(frozen) || 0));
    opening = { root, scene, animations, holds: new Set(["frozen"]), start: performance.now(), beatDone: true, leaving: false };
    window.__opening = opening;
    return;
  }
  const start = performance.now();
  opening = { root, scene, animations, holds: new Set(), start, beatDone: !scene, leaving: false };
  if (import.meta.env.DEV) window.__opening = opening;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      hideNativeSplash();
      if (!opening) return;
      animations.forEach((animation) => animation.play());
      const beat = scene ? scene.beat : 0;
      setTimeout(() => {
        if (!opening) return;
        opening.beatDone = true;
        opening.beatAt = performance.now();
        beatWaiters.splice(0).forEach((resolve) => resolve());
        watch();
      }, beat);
    }),
  );
  // Whatever happens, never longer than this.
  setTimeout(() => leave(), HOLD_CAP_MS);
}

function watch() {
  if (!opening || opening.leaving) return;
  const now = performance.now();
  const held = opening.holds.size > 0;
  const screenCapped = now - opening.beatAt > SCREEN_CAP_MS;
  // Ready on two looks in a row, so a screen that's only passing through doesn't count.
  const ready = !held && screenReady();
  if ((ready && opening.readyOnce) || (!held && screenCapped)) {
    leave();
    return;
  }
  opening.readyOnce = ready;
  setTimeout(watch, 70);
}

function leave() {
  if (!opening || opening.leaving) return;
  opening.leaving = true;
  const { root } = opening;
  document.documentElement.classList.remove("opening-active");
  beatWaiters.splice(0).forEach((resolve) => resolve());
  const stage = root.querySelector(".opening__stage");
  const done = () => {
    root.remove();
    opening = null;
  };
  try {
    const fade = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" });
    if (opening.scene) stage.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }], { duration: EXIT_MS, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards" });
    fade.finished.then(done, done);
  } catch {
    done();
  }
}

/**
 * Keeps the opening up while something she'll see first is still being decided (Face ID). Returns
 * the release. Does nothing when there's no opening.
 */
export function holdOpening(reason = "hold") {
  if (!opening || opening.leaving) return () => {};
  const token = { reason };
  opening.holds.add(token);
  return () => opening?.holds.delete(token);
}

/** Resolves once the scene has played (straight away when there's no opening, or it's leaving). */
export function afterOpeningBeat() {
  if (!opening || opening.beatDone || opening.leaving) return Promise.resolve();
  return new Promise((resolve) => beatWaiters.push(resolve));
}

/** True while the opening covers the screen. */
export const openingShown = () => Boolean(opening && !opening.leaving);
