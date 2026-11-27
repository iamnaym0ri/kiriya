import { Suspense, lazy, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { GAMES, gameById } from "./registry.js";
import GameSheet from "./GameSheet.jsx";

// Dev-only game lab: /world/game-lab?g=<id> opens one game in the very sheet the play hub uses
// (GameSheet.jsx: full screen above everything, portalled to <body>, safe areas padded, a 44 pt bar
// with "‹ play" and the title, the game filling .game-sheet__stage). Rewards are logged, and shown
// at the bottom of the lab list, instead of being saved.
export default function GameLab() {
  const [params, setParams] = useSearchParams();
  const game = gameById(params.get("g"));
  const Game = useMemo(() => (game ? lazy(game.load) : null), [game]);
  const [rewards, setRewards] = useState([]);
  if (!import.meta.env.DEV) return null;
  const exit = () => setParams({});
  const reward = (value) => {
    console.info("reward", value);
    setRewards((list) => [...list, { ...value, game: value?.game ?? game?.id }]);
  };
  return (
    <>
      <div style={{ padding: 16, display: "grid", gap: 8 }}>
        <h1>games</h1>
        {GAMES.map((each) => (
          <button key={each.id} type="button" onClick={() => setParams({ g: each.id })}>{each.shelf} · {each.title}</button>
        ))}
        {rewards.length > 0 && <pre data-testid="lab-rewards">{JSON.stringify(rewards, null, 1)}</pre>}
      </div>
      <GameSheet open={Boolean(Game)} title={game?.title ?? ""} onClose={exit}>
        {Game && (
          <Suspense fallback={<p style={{ padding: 16 }}>loading…</p>}>
            <Game onExit={exit} onReward={reward} />
          </Suspense>
        )}
      </GameSheet>
    </>
  );
}
