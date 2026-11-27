import GameShell from "../_kit/GameShell.jsx";
import { withArt } from "../_kit/stickers.jsx";
import { createEngine } from "./engine.js";
import { rewardsFor } from "./logic.js";
import STICKERS from "./stickers.js";

const HUD = [
  { name: "score", label: "petals", initial: "0" },
  { name: "lives", kind: "hearts", initial: "3" },
  { name: "streak" },
];

const rewards = (result) => withArt(rewardsFor(result), STICKERS);

export default function Game({ onExit, onReward }) {
  return (
    <GameShell
      id="petal-catch"
      title="petal catch"
      kicker="quick fingers"
      howTo={
        <>
          <p>slide anywhere to move the basket and catch the falling petals.</p>
          <p>dodge the thorns: three bumps and the round is over. stars are worth five ♡</p>
        </>
      }
      hud={HUD}
      createEngine={createEngine}
      rewardsFor={rewards}
      overTitle={(result) => `${result.score} ${result.score === 1 ? "petal" : "petals"}`}
      overLine={(result) =>
        result.bestStreak >= 10 ? `your longest streak was ${result.bestStreak}. so steady ♡` : "the meadow says thank you for tidying up ♡"
      }
      bestLabel={(best) => `best ${best}`}
      onExit={onExit}
      onReward={onReward}
    />
  );
}
