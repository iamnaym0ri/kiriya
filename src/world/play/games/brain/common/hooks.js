// Small shared helpers for the brain-power shelf: saved progress, pausing when the app goes to the
// background, reduced motion, and the size of the stage the game is drawn in.
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";

/** Saved game state on this phone. Every read and write survives storage being unavailable. */
export function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
export function writeStore(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the game still plays, it just won't remember.
  }
}

const subscribeVisibility = (listener) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
/** False while the app is in the background or the phone is locked. */
export const usePageVisible = () =>
  useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => true);

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (listener) => {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
export const useReducedMotion = () => useSyncExternalStore(subscribeReduced, () => matchMedia(REDUCED).matches, () => false);

/**
 * A seconds counter that only runs while `running` and the app is in front, so a puzzle left
 * open overnight doesn't come back showing nine hours.
 */
export function useElapsed(running, initial = 0) {
  const visible = usePageVisible();
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    if (!running || !visible) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, visible]);
  return [seconds, setSeconds];
}

export const clock = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/** The content box of an element, kept current with a ResizeObserver (the sheet, not the window). */
export function useBoxSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      setSize((old) => (Math.abs(old.width - width) < 0.5 && Math.abs(old.height - height) < 0.5 ? old : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** A tiny seeded random (mulberry32), so a saved puzzle can be rebuilt and tests can repeat. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * When a round ends, brings its result card into view if the board pushed it below the fold (a
 * small phone, a big board): the game column scrolls on its own, never the page.
 */
export function useShowWhen(ref, show) {
  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(() => {
      const reduced = matchMedia(REDUCED).matches;
      ref.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }, 450);
    return () => clearTimeout(timer);
  }, [show, ref]);
}
