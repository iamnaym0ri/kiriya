import ClassicGame from "../../ClassicGame.jsx";
import { HerbSequence } from "../../../MoreMaomaoGames.jsx";
import "../../../MaomaoGames.css";

export default function Game({ onReward }) {
  return (
    <ClassicGame>
      <HerbSequence onReward={onReward} />
    </ClassicGame>
  );
}
