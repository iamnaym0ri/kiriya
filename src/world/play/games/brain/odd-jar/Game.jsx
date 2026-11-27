import ClassicGame from "../../ClassicGame.jsx";
import { OddJar } from "../../../MaomaoGames.jsx";
import "../../../MaomaoGames.css";

export default function Game({ onReward }) {
  return (
    <ClassicGame>
      <OddJar onReward={onReward} />
    </ClassicGame>
  );
}
