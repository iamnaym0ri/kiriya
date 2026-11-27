import { Suspense, lazy, useMemo } from "react";
import { useSearchParams } from "react-router";
import { GAMES, gameById } from "./registry.js";

// Dev-only game lab: /world/game-lab?g=<id> opens one game the way the play hub will
// (docs/refactor/RENOVATION.md, "Games"): a full-screen sheet above everything, safe areas padded,
// a top bar with "‹ play" and the game's title, and the game filling the rest. The frame agent's
// hub replaces this for real use; game agents test with it until then.
export default function GameLab() {
  const [params, setParams] = useSearchParams();
  const game = gameById(params.get("g"));
  const Game = useMemo(() => (game ? lazy(game.load) : null), [game]);
  if (!import.meta.env.DEV) return null;
  if (!Game) {
    return (
      <div style={{ padding: 16, display: "grid", gap: 8 }}>
        <h1>games</h1>
        {GAMES.map((each) => (
          <button key={each.id} type="button" onClick={() => setParams({ g: each.id })}>{each.shelf} · {each.title}</button>
        ))}
      </div>
    );
  }
  const exit = () => setParams({});
  return (
    <div className="game-sheet" style={{ position: "fixed", inset: 0, zIndex: 2147482500, display: "flex", flexDirection: "column", background: "var(--purple-50)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header style={{ flex: "none", height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
        <button type="button" onClick={exit} style={{ minHeight: 44, border: 0, background: "none", color: "var(--purple-700)", font: "500 16px var(--font-ui)" }}>‹ play</button>
        <strong style={{ font: "600 16px var(--font-ui)", color: "var(--purple-900)" }}>{game.title}</strong>
      </header>
      <div className="game-sheet__stage" style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <Suspense fallback={<p style={{ padding: 16 }}>loading…</p>}>
          <Game onExit={exit} onReward={(reward) => console.info("reward", reward)} />
        </Suspense>
      </div>
    </div>
  );
}
