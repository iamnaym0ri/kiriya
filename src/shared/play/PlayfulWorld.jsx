import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { usePrefs, useSetPrefs } from "../../lib/prefs.js";
import { celebrate } from "../effects.js";
import MaomaoMascot from "../../world/mascot/MaomaoMascot.jsx";
import { useMusic } from "../music/MusicRoom.jsx";
import { createRemarkPicker, remarkTopic } from "./maomaoDialogue.js";
import { useDailyStyle } from "../DailyStyle.jsx";
import "./PlayfulWorld.css";
import { PlayContext, usePlayful } from "./PlayfulContext.js";
import { ribbonMoment } from "./dailyRibbon.js";

export { usePlayful } from "./PlayfulContext.js";
export { default as BirthdayRibbon } from "./DailyRibbon.jsx";

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
  // Once she has chosen while unlocked, the choice follows her to every device and the Home
  // Screen app; visitors (and devices before that choice) keep this browser's own setting.
  const prefs = usePrefs();
  const setPrefs = useSetPrefs();
  const savedMotion = prefs.data?.motion;
  useEffect(() => {
    if (savedMotion) setPaused(savedMotion === "quiet");
  }, [savedMotion]);
  const [ribbonTime, setRibbonTime] = useState(() => ribbonMoment());
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
      const moment = ribbonMoment();
      setRibbonTime(previous => previous.nextAt === moment.nextAt ? previous : moment);
      const nextDay = Math.floor((Date.now() + offset) / dayMs);
      if (nextDay !== day) {
        day = nextDay;
        queryClient.invalidateQueries({ queryKey: ["public-profile"] });
        queryClient.invalidateQueries({ queryKey: ["me", "today"] });
        queryClient.invalidateQueries({ queryKey: ["me", "mood"] });
      }
      timer = setTimeout(
        refresh,
        moment.nextAt - Date.now() + 500,
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
      value={{ moving, paused, reduced, day: ribbonTime.day, ribbonSlot: ribbonTime.slot, toggle: () => {
        const next = !paused;
        setPaused(next);
        if (prefs.data) setPrefs.mutate({ motion: next ? "quiet" : "lively" });
      } }}
    >
      {children}
      <div className="ambient-charms" aria-hidden="true">
        {["✧", "♡", "✦", "❀", "✧", "♡", "✦", "❀", "✧"].map((s, i) => (
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

export function MaomaoBuddy({ compact = false, birthday = false }) {
  const { copy } = useDailyStyle();
  const addressText = text => text.replace("miss apothecary", copy?.apothecary ?? "miss apothecary");
  const { moving } = usePlayful();
  const music = useMusic();
  const songUrl = music?.song?.url;
  const [remark, setRemark] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  const picker = useRef(null);
  const pokes = useRef(0);
  const lastPoke = useRef(-Infinity);
  const [reaction, setReaction] = useState(0);
  if (!picker.current) picker.current = createRemarkPicker();
  const current = remark ?? {
    text: birthday
      ? "Happy birthday. I've put my work aside for a moment. Yes, that is your present."
      : "Hm? Oh. You can stay. Just leave the labelled jars where they are.",
    expression: "deadpan",
  };
  const speak = (category, announce = false) => {
    const next = picker.current(category);
    setRemark(next);
    setReaction(n => n + 1);
    if (announce) setAnnouncement(next.text);
    return next;
  };
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.4),
      { threshold: 0.4 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (songUrl) {
      setRemark(picker.current("music"));
      setReaction(n => n + 1);
    }
  }, [songUrl]);
  useEffect(() => {
    if (!moving || !inView) return;
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        // Let her think quietly while someone types or draws.
        if (document.activeElement?.matches("input, textarea, canvas, [contenteditable=true]")) {
          schedule();
          return;
        }
        const category = remarkTopic({ mode: "idle", birthday, music: !!songUrl });
        setRemark(picker.current(category));
        setReaction(n => n + 1);
      }, 22000 + Math.random() * 18000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [moving, inView, remark, birthday, songUrl]);
  useEffect(() => {
    if (!moving || !matchMedia("(pointer:fine)").matches) {
      ref.current?.style.removeProperty("--gaze-x");
      ref.current?.style.removeProperty("--gaze-y");
      return;
    }
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
      <div className="buddy-bubble" aria-live="off">
        {addressText(current.text)}
      </div>
      <MaomaoMascot
        expression={current.expression}
        reactionKey={reaction}
        size={compact ? 96 : 142}
        onPoke={(e) => {
          pokes.current++;
          const now = performance.now();
          const category = remarkTopic({ mode: "tap", count: pokes.current, birthday,
            music: !!songUrl, rapid: now - lastPoke.current < 700 });
          lastPoke.current = now;
          const next = speak(category, true);
          if (moving && next.expression === "party") {
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
      <div className="buddy-offers" aria-label="Show Maomao something interesting">
        <button type="button" onClick={() => speak("herb", true)}><span aria-hidden="true">🌿</span> Show an herb</button>
        <button type="button" onClick={() => speak("vial", true)}><span aria-hidden="true">✧</span> A curious vial</button>
      </div>
      <span className="sr-only" role="status" aria-atomic="true">{addressText(announcement)}</span>
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
