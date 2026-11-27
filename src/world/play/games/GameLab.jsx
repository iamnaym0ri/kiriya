import { Suspense, lazy, useMemo } from "react";
import { useSearchParams } from "react-router";
import { GAMES, gameById } from "./registry.js";

// Dev-only game lab: /world/game-lab?g=<id> opens one game full screen, the way the play hub will.
// The frame agent's hub replaces this for real use; game agents test with it until then.
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
  return (
    <Suspense fallback={<p style={{ padding: 16 }}>loading…</p>}>
      <Game onExit={() => setParams({})} onReward={(reward) => console.info("reward", reward)} />
    </Suspense>
  );
}
