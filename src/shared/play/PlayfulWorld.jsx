import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicProfile } from "../../lib/profile.js";
import { celebrate } from "../effects.js";
import MaomaoMascot from "../../world/mascot/MaomaoMascot.jsx";
import "./PlayfulWorld.css";

const PlayContext = createContext({ moving: true });
export const usePlayful = () => useContext(PlayContext);

export function PlayfulProvider({ children }) {
  const queryClient = useQueryClient();
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem("kiriya:quiet-motion") === "yes";
    } catch {
      return false;
    }
  });
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [visible, setVisible] = useState(!document.hidden);
  const location = useLocation();
  const moving = !paused && !reduced && visible;
  useEffect(() => {
    // A page left open overnight should still know which day it is in Singapore.
    const dayMs = 86_400_000,
      offset = 8 * 60 * 60 * 1000;
    let day = Math.floor((Date.now() + offset) / dayMs),
      timer;
    const refresh = () => {
      clearTimeout(timer);
      const nextDay = Math.floor((Date.now() + offset) / dayMs);
      if (nextDay !== day) {
        day = nextDay;
        queryClient.invalidateQueries({ queryKey: ["public-profile"] });
        queryClient.invalidateQueries({ queryKey: ["me", "today"] });
      }
      timer = setTimeout(
        refresh,
        (day + 1) * dayMs - offset - Date.now() + 500,
      );
    };
    const wake = () => {
      if (!document.hidden) refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [queryClient]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    const visibility = () => setVisible(!document.hidden);
    query.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      query.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.littleMotion = moving ? "on" : "off";
    try {
      localStorage.setItem("kiriya:quiet-motion", paused ? "yes" : "no");
    } catch {
      /* private browsing can disable storage */
    }
  }, [moving, paused]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target, isIntersecting }) => {
          target.dataset.inView = isIntersecting ? "yes" : "no";
        }),
      { rootMargin: "50px" },
    );
    const observe = () =>
      document
        .querySelectorAll("[data-motion-region]")
        .forEach((el) => observer.observe(el));
    observe();
    const mutations = new MutationObserver(observe);
    mutations.observe(document.getElementById("root"), {
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [location.pathname]);
  return (
    <PlayContext.Provider
      value={{ moving, paused, reduced, toggle: () => setPaused((p) => !p) }}
    >
      {children}
      <div className="ambient-charms" aria-hidden="true">
        {["✧", "♡", "✦", "❀", "✧", "♡", "✦"].map((s, i) => (
          <span key={i} style={{ "--i": i }}>
            {s}
          </span>
        ))}
      </div>
      <CursorSparkles enabled={moving} />
    </PlayContext.Provider>
  );
}

function CursorSparkles({ enabled }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!enabled || !matchMedia("(pointer: fine)").matches) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let frame = 0,
      particles = [],
      last = 0,
      width,
      height;
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const paint = (time) => {
      ctx.clearRect(0, 0, width, height);
      particles = particles.filter((p) => time - p.born < 700);
      for (const p of particles) {
        const age = (time - p.born) / 700;
        ctx.globalAlpha = (1 - age) * 0.8;
        ctx.font = `${p.size}px Georgia`;
        ctx.fillStyle = p.color;
        ctx.fillText(p.glyph, p.x + p.dx * age, p.y - age * 24);
      }
      ctx.globalAlpha = 1;
      frame = particles.length ? requestAnimationFrame(paint) : 0;
    };
    const move = (event) => {
      if (
        event.pointerType === "touch" ||
        event.target.closest("input,textarea,select,dialog,.canvas-wrap")
      )
        return;
      const time = performance.now();
      if (time - last < 32) return;
      last = time;
      particles.push({
        x: event.clientX + 8,
        y: event.clientY + 9,
        born: time,
        dx: (Math.random() - 0.5) * 24,
        size: 12 + Math.random() * 9,
        color: Math.random() > 0.5 ? "#b15e99" : "#8264ae",
        glyph: Math.random() > 0.45 ? "✧" : "♡",
      });
      particles = particles.slice(-24);
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [enabled]);
  return <canvas ref={ref} className="cursor-sparkles" aria-hidden="true" />;
}

export function MotionToggle() {
  const { paused, reduced, toggle } = usePlayful();
  return (
    <button
      type="button"
      className="motion-toggle"
      onClick={toggle}
      disabled={reduced}
      aria-pressed={paused || reduced}
      aria-label={
        reduced
          ? "Reduced motion is on"
          : paused
            ? "Resume little animations"
            : "Pause little animations"
      }
      title={
        reduced
          ? "Following your reduced-motion preference"
          : "Settle or wake the little animations"
      }
    >
      <span aria-hidden="true">{paused || reduced ? "☾" : "✧"}</span>
      <span>{paused || reduced ? "still" : "alive"}</span>
    </button>
  );
}

export function BirthdayRibbon() {
  const { data } = usePublicProfile();
  const birthday = data?.birthday?.isBirthday;
  return (
    <div
      className="birthday-ribbon"
      data-motion-region
      aria-label={
        birthday
          ? "September 15 · Happy birthday, Kiriya!"
          : "Kiriya’s birthday scrapbook"
      }
    >
      <div className="birthday-ribbon__track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <span key={copy}>
            {[0, 1, 2].map((i) => (
              <span key={i}>
                🎀{" "}
                {birthday
                  ? "happy birthday, kiriya!"
                  : "a little world for kiriya"}
                <b>✧</b>15 SEPTEMBER<b>♡</b>made with love<b>✧</b>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

const BUDDY_LINES = [
  "Birthday rule: cake before chores. 🎂",
  "A tiny doodle? I’ll supervise. ( = ⩊ = )",
  "Your colour palette has my approval. ✧",
  "One more song. I won’t tell. ♡",
];
export function MaomaoBuddy({ compact = false, birthday = false }) {
  const { moving } = usePlayful();
  const [pokes, setPokes] = useState(0);
  const [happy, setHappy] = useState(false);
  const ref = useRef(null);
  const timeout = useRef(null);
  useEffect(() => () => clearTimeout(timeout.current), []);
  useEffect(() => {
    if (!moving || !matchMedia("(pointer:fine)").matches) return;
    let frame = 0;
    const gaze = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.bottom >= 0 && r.top <= innerHeight) {
          el.style.setProperty(
            "--gaze-x",
            `${Math.max(-3, Math.min(3, (e.clientX - r.left - r.width / 2) / 100))}px`,
          );
          el.style.setProperty(
            "--gaze-y",
            `${Math.max(-2, Math.min(2, (e.clientY - r.top - r.height / 2) / 150))}px`,
          );
        }
        frame = 0;
      });
    };
    window.addEventListener("pointermove", gaze, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", gaze);
    };
  }, [moving]);
  return (
    <div
      ref={ref}
      className={`maomao-buddy ${compact ? "maomao-buddy--compact" : ""}`}
      data-motion-region
    >
      <div className="buddy-bubble" role="status">
        {pokes
          ? BUDDY_LINES[(pokes - 1) % BUDDY_LINES.length]
          : birthday
            ? "Psst… it’s your day! 🎂"
            : "I’m keeping an eye on your doodles. ♡"}
      </div>
      <MaomaoMascot
        expression={happy ? "sparkle" : birthday ? "party" : "smug"}
        size={compact ? 108 : 162}
        onPoke={(e) => {
          setPokes((p) => p + 1);
          setHappy(true);
          clearTimeout(timeout.current);
          timeout.current = setTimeout(() => setHappy(false), 2200);
          if (moving) {
            const r = e.currentTarget.getBoundingClientRect();
            celebrate(
              {
                x: (r.left + r.width / 2) / innerWidth,
                y: (r.top + r.height / 2) / innerHeight,
              },
              0.22,
            );
          }
        }}
      />
      <span className="buddy-name">猫猫 · tap for a little company</span>
    </div>
  );
}

export function Bow({ className = "" }) {
  return (
    <svg
      className={`ribbon-bow ${className}`}
      viewBox="0 0 100 76"
      aria-hidden="true"
    >
      <path
        d="M45 31C31 7 4 3 8 24S29 43 44 37L24 65l17-4 7-22 12 34 10-12-17-25C70 49 98 33 92 16S64 16 54 31Z"
        fill="#c48daf"
        stroke="#815571"
        strokeWidth="1.5"
      />
      <path
        d="m20 20 25 14m35-13-26 13M36 48l9-11m17 16L53 38"
        fill="none"
        stroke="#e8c2d8"
        strokeWidth="3"
      />
      <ellipse
        cx="49"
        cy="35"
        rx="9"
        ry="10"
        fill="#b77aa0"
        stroke="#815571"
        strokeWidth="1.5"
      />
    </svg>
  );
}
