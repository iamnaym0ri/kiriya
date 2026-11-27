import MaomaoMascot from "../../../../mascot/MaomaoMascot.jsx";

// Maomao beside a speech bubble: the running commentary of the brain shelf's Maomao games (memory
// drawer, odd jar, herb sequence, lantern corridor). `talk` changes whenever she says something new,
// so the bubble and her pose replay. Compact enough to sit above a board on a 375 pt phone.
export default function MaomaoSays({ children, expression = "thinking", talk = 0, size = 64 }) {
  return (
    <div className="brain-mao">
      <MaomaoMascot size={size} expression={expression} reactionKey={talk} />
      <p className="brain-mao__bubble" role="status" key={talk}>
        {children}
      </p>
    </div>
  );
}
