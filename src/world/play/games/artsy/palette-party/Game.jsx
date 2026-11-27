import ClassicGame from "../../ClassicGame.jsx";
import PaletteParty from "../../../PaletteParty.jsx";

export default function Game({ onReward }) {
  return (
    <ClassicGame>
      <PaletteParty onReward={onReward} />
    </ClassicGame>
  );
}
