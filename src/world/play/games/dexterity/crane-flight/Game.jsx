import GameShell from "../_kit/GameShell.jsx";
import { withArt } from "../_kit/stickers.jsx";
import { createEngine } from "./engine.js";
import { rewardsFor } from "./logic.js";
import STICKERS from "./stickers.js";

const HUD = [
  { name: "score", label: "score", initial: "0" },
  { name: "lives", kind: "hearts", initial: "3" },
];

const rewards = (result) => withArt(rewardsFor(result), STICKERS);

export default function Game({ onExit, onReward }) {
  return (
    <GameShell
      id="crane-flight"
      title="paper-crane flight"
      kicker="quick fingers"
      howTo={
        <>
          <p>tap anywhere to flap. guide the little crane through the gaps between the wisteria and the clouds.</p>
          <p>a bump costs a heart, not the whole flight. stars are a bonus ♡</p>
        </>
      }
      hud={HUD}
      createEngine={createEngine}
      rewardsFor={rewards}
      overTitle={(result) => `${result.gaps} ${result.gaps === 1 ? "gap" : "gaps"}`}
      overLine={(result) =>
        result.stars > 0 ? `and ${result.stars} ${result.stars === 1 ? "star" : "stars"} on the way. what a lovely flight ♡` : "what a lovely little flight ♡"
      }
      onExit={onExit}
      onReward={onReward}
    />
  );
}
