import GameShell from "../_kit/GameShell.jsx";
import { withArt } from "../_kit/stickers.jsx";
import { createEngine } from "./engine.js";
import { rewardsFor } from "./logic.js";
import STICKERS from "./stickers.js";

const HUD = [
  { name: "score", label: "tall", initial: "0" },
  { name: "lives", kind: "hearts", initial: "3" },
  { name: "combo" },
];

const rewards = (result) => withArt(rewardsFor(result), STICKERS);

export default function Game({ onExit, onReward }) {
  return (
    <GameShell
      id="mochi-tower"
      title="mochi tower"
      kicker="quick fingers"
      howTo={
        <>
          <p>tap anywhere to let the swinging mochi go. stack them as high as you can.</p>
          <p>land right in the middle for a perfect. three tumbles and the round is over ♡</p>
        </>
      }
      hud={HUD}
      createEngine={createEngine}
      rewardsFor={rewards}
      overTitle={(result) => `${result.floors} mochi tall`}
      overLine={(result) =>
        result.perfects > 0 ? `${result.perfects} perfect ${result.perfects === 1 ? "landing" : "landings"}. very squishy, very proud ♡` : "a cosy little tower ♡"
      }
      bestLabel={(best) => `tallest ${best}`}
      onExit={onExit}
      onReward={onReward}
    />
  );
}
