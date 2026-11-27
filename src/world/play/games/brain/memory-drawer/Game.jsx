import ClassicGame from "../../ClassicGame.jsx";
import { MemoryDrawer } from "../../../MaomaoGames.jsx";
import "../../../MaomaoGames.css";

export default function Game({ onReward }) {
  return (
    <ClassicGame>
      <MemoryDrawer onReward={onReward} />
    </ClassicGame>
  );
}
