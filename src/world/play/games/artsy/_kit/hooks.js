import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersLessMotion } from "../../../../../shared/effects.js";
import { readJson, writeJson } from "./store.js";

/** State that is read from the phone once and written back a moment after every change. */
export function useSavedState(key, initial) {
  const [value, setValue] = useState(() => readJson(key, typeof initial === "function" ? initial() : initial));
  useAutosave(key, value);
  return [value, setValue];
}

/** Writes `value` shortly after it changes, and straight away when the app goes to the background. */
export function useAutosave(key, value, delay = 450) {
  const latest = useRef(value);
  const dirty = useRef(false);
  const timer = useRef(0);
  useEffect(() => {
    if (latest.current === value) return;
    latest.current = value;
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      writeJson(key, latest.current);
    }, delay);
  }, [key, value, delay]);
  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      if (!dirty.current) return;
      dirty.current = false;
      writeJson(key, latest.current);
    };
    const hidden = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [key]);
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(listener) {
  const query = matchMedia(motionQuery);
  query.addEventListener("change", listener);
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-little-motion"] });
  return () => {
    query.removeEventListener("change", listener);
    observer.disconnect();
  };
}
/** True when she asked for less motion (the phone's setting or the site's own). */
export const useCalm = () => useSyncExternalStore(subscribeMotion, prefersLessMotion, () => false);

/** False while the app is in the background, so loops and timers can rest. */
export function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** The element's content box, kept current as the sheet or the phone turns and resizes. */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((old) => (Math.abs(old.width - width) < 0.5 && Math.abs(old.height - height) < 0.5 ? old : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** A short-lived message ("sent ♡"); returns [text, show]. */
export function useToast(ms = 2600) {
  const [text, setText] = useState("");
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (next) => {
    clearTimeout(timer.current);
    setText(next);
    timer.current = setTimeout(() => setText(""), ms);
  };
  return [text, show];
}
