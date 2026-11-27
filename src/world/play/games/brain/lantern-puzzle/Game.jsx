import ClassicGame from "../../ClassicGame.jsx";
import { LanternPuzzle } from "../../../MoreMaomaoGames.jsx";
import "../../../MaomaoGames.css";

export default function Game({ onReward }) {
  return (
    <ClassicGame>
      <LanternPuzzle onReward={onReward} />
    </ClassicGame>
  );
}
