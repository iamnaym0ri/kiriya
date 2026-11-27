import GameShell from "../_kit/GameShell.jsx";
import { withArt } from "../_kit/stickers.jsx";
import { createEngine } from "./engine.js";
import { rewardsFor } from "./logic.js";
import STICKERS from "./stickers.js";

const HUD = [
  { name: "score", label: "points", initial: "0" },
  { name: "time", initial: "0:45" },
  { name: "combo" },
];

const rewards = (result) => withArt(rewardsFor(result), STICKERS);

export default function Game({ onExit, onReward }) {
  return (
    <GameShell
      id="boop-the-cats"
      title="boop the cats"
      kicker="quick fingers"
      howTo={
        <>
          <p>kittens pop out of the boxes. tap one to boop its nose before it ducks back down.</p>
          <p>chonky ones need two boops. let the sleepy ones nap ♡</p>
        </>
      }
      hud={HUD}
      createEngine={createEngine}
      rewardsFor={rewards}
      overTitle={(result) => `${result.score} ${result.score === 1 ? "point" : "points"}`}
      overLine={(result) =>
        `${result.boops} ${result.boops === 1 ? "boop" : "boops"}${result.woke ? `, ${result.woke} grumpy napper${result.woke === 1 ? "" : "s"}` : ""}. ${
          result.missed === 0 && result.boops > 0 ? "not one kitten left unbooped ♡" : "every kitten felt loved ♡"
        }`
      }
      onExit={onExit}
      onReward={onReward}
    />
  );
}
