import "./ClassicGame.css";

// The five games from before the library (Maomao's colour club, memory drawer, odd jar, herb
// sequence and lantern puzzle) keep their own look inside the game sheet: their card scrolls in the
// stage, with room around it. Owner: the frame agent.
export default function ClassicGame({ children }) {
  return <div className="classic-game">{children}</div>;
}
