import "./ClassicGame.css";

// A game from before the library that keeps its website look inside the game sheet (today: Maomao's
// colour club on the artsy shelf; the four brain-shelf classics have their own app versions now).
// Its card scrolls in the stage, with room around it.
export default function ClassicGame({ children }) {
  return <div className="classic-game">{children}</div>;
}
