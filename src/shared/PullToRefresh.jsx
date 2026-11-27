import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { haptic } from "../lib/native.js";

const THRESHOLD = 72;

/**
 * Inside the iPhone app: pull down at the very top of a page to refresh everything on it, with a
 * little tick when it's far enough. Only on the tabs where it makes sense (WorldShell passes
 * `enabled`); the chat scrolls on its own and is left alone.
 */
export default function PullToRefresh({ enabled = true }) {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const down = (event) => {
      if (window.scrollY > 0 || document.body.dataset.page === "chat" || event.touches.length !== 1) return;
      // Nothing behind an open sheet refreshes: not its panel, and not the dimmed area around it.
      if (document.documentElement.classList.contains("edit-sheet-open")) return;
      if (event.target.closest?.("input, textarea, [contenteditable], canvas, .native-lock, [role=dialog], .edit-sheet, .game-sheet, .app-tabs")) return;
      start.current = event.touches[0].clientY;
      armed.current = false;
    };
    const move = (event) => {
      if (start.current === null) return;
      const distance = event.touches[0].clientY - start.current;
      if (distance <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      const eased = Math.min(110, distance * 0.5);
      setPull(eased);
      if (eased >= THRESHOLD && !armed.current) {
        armed.current = true;
        haptic("light");
      } else if (eased < THRESHOLD) armed.current = false;
    };
    const up = async () => {
      if (start.current === null) return;
      start.current = null;
      const go = armed.current;
      armed.current = false;
      setPull(0);
      if (!go) return;
      setBusy(true);
      await queryClient.invalidateQueries({ queryKey: ["me"] }).catch(() => {});
      setBusy(false);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
      start.current = null;
      setPull(0);
    };
  }, [queryClient, enabled]);

  if (!pull && !busy) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div className="pull-refresh" style={{ "--pull": `${busy ? THRESHOLD : pull}px` }} role="status" aria-live="polite">
      <span className={busy ? "pull-refresh__dot pull-refresh__dot--spin" : "pull-refresh__dot"} style={{ "--turn": `${pull * 3}deg` }}>
        ✦
      </span>
      <span className="sr-only">{busy ? "refreshing" : ready ? "let go to refresh" : ""}</span>
    </div>
  );
}
