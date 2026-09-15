import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { sparkleBurst } from "../shared/effects.js";
import "./Kitten.css";

const SPEED = 170; // px per second
const SIZE = 64;
const NAP_AFTER_MS = 14_000;
const MEOWS = ["mrrp ♡", "prrr…", "mew!", "♡", "nya~"];

// A little calico kitten (in the series, a calico cat is literally named Maomao) that follows
// Kiriya around: the mouse on a computer, taps on a phone. Tap her for a purr.
export default function Kitten({ floor = 12 }) {
  const reduce = useReducedMotion();
  const rootRef = useRef(null);
  const state = useRef({ x: 24, y: 0, tx: 24, ty: 0, facing: 1, last: 0, raf: 0 });
  const [mode, setMode] = useState("sit"); // sit | walk | nap | happy
  const [bubble, setBubble] = useState(null);
  const napTimer = useRef(0);

  const place = useCallback(() => {
    const s = state.current;
    const el = rootRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${s.x - SIZE / 2}px, ${s.y - SIZE}px, 0)`;
    el.dataset.facing = s.facing > 0 ? "right" : "left";
  }, []);

  const scheduleNap = useCallback(() => {
    clearTimeout(napTimer.current);
    napTimer.current = setTimeout(() => setMode((m) => (m === "sit" ? "nap" : m)), NAP_AFTER_MS);
  }, []);

  const tick = useCallback(
    (now) => {
      const s = state.current;
      const dt = Math.min(0.05, (now - (s.last || now)) / 1000);
      s.last = now;
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        s.raf = 0;
        s.last = 0;
        setMode("sit");
        scheduleNap();
        return;
      }
      const step = Math.min(dist, SPEED * dt * (dist > 240 ? 1.8 : 1));
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
      if (Math.abs(dx) > 2) s.facing = dx > 0 ? 1 : -1;
      place();
      s.raf = requestAnimationFrame(tick);
    },
    [place, scheduleNap],
  );

  const walkTo = useCallback(
    (x, y) => {
      const s = state.current;
      const margin = SIZE / 2 + 8;
      s.tx = Math.max(margin, Math.min(window.innerWidth - margin, x));
      s.ty = Math.max(SIZE + 60, Math.min(window.innerHeight - floor, y));
      if (reduce) {
        s.x = s.tx;
        s.y = s.ty;
        place();
        return;
      }
      clearTimeout(napTimer.current);
      setMode("walk");
      if (!s.raf) s.raf = requestAnimationFrame(tick);
    },
    [floor, place, reduce, tick],
  );

  useEffect(() => {
    const s = state.current;
    // Start in the bottom-right corner, where left-aligned text is least likely to be covered.
    s.x = s.tx = window.innerWidth - 40;
    s.y = s.ty = window.innerHeight - floor - 4;
    s.facing = -1;
    place();
    scheduleNap();

    let lastMove = 0;
    const onPointerMove = (event) => {
      if (event.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - lastMove < 120) return;
      lastMove = now;
      // Sit a little beside the cursor rather than under it.
      walkTo(event.clientX - 46 * Math.sign(event.clientX - s.x || 1), event.clientY + 40);
    };
    const onPointerDown = (event) => {
      if (event.pointerType === "mouse") return;
      if (event.target.closest?.("button, a, input, textarea, select, iframe, [role='dialog'], .kitten")) return;
      walkTo(event.clientX, event.clientY + 30);
    };
    const onResize = () => walkTo(s.tx, s.ty);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      clearTimeout(napTimer.current);
    };
  }, [floor, place, scheduleNap, walkTo]);

  function pet(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    sparkleBurst({ x: rect.left + rect.width / 2, y: rect.top + 10 }, { count: 8, reach: 46 });
    setMode("happy");
    setBubble(MEOWS[Math.floor(Math.random() * MEOWS.length)]);
    setTimeout(() => {
      setBubble(null);
      setMode("sit");
      scheduleNap();
    }, 1600);
  }

  return (
    <div className="kitten" ref={rootRef} data-mode={mode} data-facing="right">
      {bubble && (
        <span className="kitten__bubble" aria-hidden="true">
          {bubble}
        </span>
      )}
      {mode === "nap" && (
        <span className="kitten__zzz" aria-hidden="true">
          z<span>z</span>
        </span>
      )}
      <button type="button" className="kitten__body" onClick={pet} aria-label="Pet the kitten">
        <svg viewBox="0 0 72 60" aria-hidden="true">
          <g className="kitten__tail">
            <path d="M16 40C5 37 3 22 11 15" className="kitten__outline-wide" />
            <path d="M16 40C5 37 3 22 11 15" className="kitten__tail-fur" />
            <path d="M11.4 15.4c-1.3 1.9-2 3.7-2.2 5.6" className="kitten__tail-tip" />
          </g>
          <g className="kitten__legs">
            <rect className="kitten__leg kitten__leg--a" x="19" y="42" width="7" height="12" rx="3.5" />
            <rect className="kitten__leg kitten__leg--b" x="27" y="42" width="7" height="12" rx="3.5" />
            <rect className="kitten__leg kitten__leg--b" x="41" y="42" width="7" height="12" rx="3.5" />
            <rect className="kitten__leg kitten__leg--a" x="49" y="42" width="7" height="12" rx="3.5" />
          </g>
          <g className="kitten__torso">
            <defs>
              <clipPath id="kitten-body-clip">
                <ellipse cx="34" cy="40" rx="20" ry="12" />
              </clipPath>
            </defs>
            <ellipse cx="34" cy="40" rx="20" ry="12" className="kitten__fur" />
            <g clipPath="url(#kitten-body-clip)">
              <path d="M13 30c6-4 14-3 17 3 2 5-4 9-11 9s-10-6-6-12z" className="kitten__ginger" />
              <path d="M36 28c5-1 9 2 9 6s-5 5-9 3-4-8 0-9z" className="kitten__black" />
            </g>
            <ellipse cx="34" cy="40" rx="20" ry="12" className="kitten__outline" />
          </g>
          <g className="kitten__head">
            <path d="M42 20l1-13 9 7z" className="kitten__ginger kitten__stroke" />
            <path d="M58 13l7-7 1 13z" className="kitten__black kitten__stroke" />
            <path d="M44.2 16.6l.6-6 4 3.4zM59.6 13.4l3.6-3.4.4 5.8z" className="kitten__inner-ear" />
            <circle cx="53" cy="26" r="14" className="kitten__fur kitten__stroke" />
            <path d="M45 16c3-2.6 7.5-3 10.5-1.6-1.8 3.4-6.6 4.6-10.5 1.6z" className="kitten__ginger" />
            <g className="kitten__eyes">
              <ellipse cx="48" cy="26" rx="2.1" ry="2.9" className="kitten__eye" />
              <ellipse cx="59" cy="26" rx="2.1" ry="2.9" className="kitten__eye" />
              <circle cx="48.7" cy="25" r="0.8" fill="#fff" />
              <circle cx="59.7" cy="25" r="0.8" fill="#fff" />
            </g>
            <path d="M46 26.5q2 1.6 4 0M57 26.5q2 1.6 4 0" className="kitten__sleepy-eyes" />
            <path d="M52.2 30.6h2.6l-1.3 1.3z" className="kitten__nose" />
            <path d="M53.5 32c-.6 1.3-2 1.6-3 .8M53.5 32c.6 1.3 2 1.6 3 .8" className="kitten__mouth" />
            <ellipse cx="45" cy="31" rx="2.6" ry="1.6" className="kitten__blush" />
            <ellipse cx="62" cy="31" rx="2.6" ry="1.6" className="kitten__blush" />
            <path d="M38 28.5l5 .8M38 32l5-.4M68 28.5l-5 .8M68 32l-5-.4" className="kitten__whisker" />
            <path d="M43.5 37.4q9.5 5.5 19 0" className="kitten__collar" />
            <circle cx="53" cy="40.6" r="2.2" className="kitten__bell" />
          </g>
        </svg>
      </button>
    </div>
  );
}
