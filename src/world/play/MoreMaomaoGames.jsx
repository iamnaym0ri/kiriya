import { useState } from "react";
import { GameFrame, GameSymbol, MaomaoComment, SYMBOL_NAMES } from "./GamePieces.jsx";
import { LANTERNS_LIT, SEQUENCE_SYMBOLS, lanternNeighbors, lanternTurn, newLanternGame, newSequenceGame, sequenceTurn } from "./littleGames.js";

const SEQUENCE_COMMENTS = {
  welcome: ["My labels have an order. Study it before you put the note away.", "Four ingredients to recognize. The order is what matters here.", "A longer note. Group the pictures in your head before you start."],
  ready: ["The note is folded. Start with the first label.", "Now, from memory. You can still take your time.", "No peeking at my sleeve. That's where I keep the notes."],
  pick: ["One entry down. What followed it?", "Keep the order in mind. A collection isn't quite the same as a sequence.", "Hm. Continue. I'll compare the whole note when you're finished.", "Write what you remember first. We can examine it afterward."],
  undo: ["A correction before submission. Sensible.", "Cross that one out, then. The rest of your notes are intact."],
  peek: ["Here. Compare it carefully. I'll fold it again when you're ready.", "Another look costs nothing. Notice the pair in the middle.", "You asked for the record instead of inventing it. Good."],
  retry: ["The order differs. Look at the note again; don't throw away what you remembered.", "Right ingredients, perhaps. Wrong arrangement. Compare the positions.", "Hm. Study it in smaller groups this time. That often helps."],
  match: ["Exactly the order I wrote down. You may handle the next note.", "A faithful record. Good. The next one is slightly longer."],
  done: ["Three notes, correctly copied. I'll trust you with the labels now.", "All in order. You've saved me a surprising amount of work."],
};

export function HerbSequence() {
  const [game, setGame] = useState(() => newSequenceGame());
  const study = game.phase === "study";
  const solved = game.phase === "solved";
  const done = solved && game.round === 2;
  const lines = SEQUENCE_COMMENTS[game.event];
  const expression = solved ? "pleased" : game.event === "pick" || study ? "writing" : game.phase === "retry" ? "thinking" : "curious";
  const act = action => setGame(current => sequenceTurn(current, action));
  return <GameFrame id="sequence-title" bar="✿ the folded herb note" kicker="A LITTLE MEMORY, IN THE RIGHT ORDER" title="Herb" accent="sequence!">
    <p className="little-game__intro">Study the pictures, hide the note, then tap them in the same order. Three pictures grow to five. No timer.</p>
    <p className="little-game__progress">Note {game.round + 1} of 3 <span>{game.pattern.length} pictures</span></p>
    <div className="sequence-note" data-phase={game.phase}>
      <span className="pixel-label">{study ? "MAOMAO’S NOTE · TAKE A GOOD LOOK" : solved ? "A PERFECT COPY" : "YOUR COPY · START FROM THE LEFT"}</span>
      <ol className="sequence-slots" aria-label={study ? "Sequence to remember" : "Your sequence"}>
        {game.pattern.map((kind, index) => {
          const picture = study ? kind : game.entered[index];
          return <li key={index} data-correct={game.phase === "retry" ? picture === kind : undefined}
            aria-label={`Position ${index + 1}, ${picture ? SYMBOL_NAMES[picture] : "empty"}`}>
            {picture ? <GameSymbol kind={picture} /> : <span className="sequence-empty" aria-hidden="true">?</span>}
            <small>{index + 1}</small>
          </li>;
        })}
      </ol>
      {study && <button className="button-plum" onClick={() => act({ type: "hide" })}>Hide the note · I’m ready</button>}
    </div>
    <div className="sequence-choices" aria-label="Choose the next picture">
      {SEQUENCE_SYMBOLS.map(kind => <button key={kind} disabled={game.phase !== "recall"} onClick={() => act({ type: "pick", kind })} aria-label={`Add ${SYMBOL_NAMES[kind]}`}>
        <GameSymbol kind={kind} /><small>{SYMBOL_NAMES[kind]}</small>
      </button>)}
    </div>
    <div className="little-game__actions">
      {solved ? <button className="button-plum" onClick={() => setGame(newSequenceGame(done ? 0 : game.round + 1))}>{done ? "Another set of notes ↺" : "Next sequence →"}</button>
        : <>
          <button className="quiet-button" disabled={study} onClick={() => act({ type: "peek" })}>{game.phase === "retry" ? "Read the note & retry ↺" : "Peek at the note"}</button>
          <button className="quiet-button" disabled={game.phase !== "recall" || !game.entered.length} onClick={() => act({ type: "undo" })}>Undo last picture</button>
        </>}
    </div>
    {game.phase === "retry" && <p className="little-game__aside">The shaded slots need another look. Read the note, then try again.</p>}
    <MaomaoComment expression={expression} revision={game.turns}>{game.event === "welcome" ? lines[game.round] : lines[game.turns % lines.length]}</MaomaoComment>
  </GameFrame>;
}

const LANTERN_COMMENTS = {
  welcome: ["Nine lanterns. One rule. Each switch changes its neighbours as well.", "A slightly longer puzzle. Watch the whole cross around each lantern.", "Five careful taps can solve this one from the start. Careful is the useful word."],
  tap: ["That changed more than one light. Keep track of the neighbours.", "Look at the pattern now. Which dark lanterns share a neighbour?", "A change is an observation. You can undo it if it doesn't help.", "Think about what a switch touches, not just the lantern beneath it.", "Hm. The corners affect fewer lights than the middle."],
  hint: ["I've marked one useful move. Try it, then compare the new pattern.", "This lantern is part of a shortest route from here. Observe its neighbours."],
  undo: ["Back to the previous arrangement. We haven't lost the record.", "A useful experiment. Now you know what that switch does."],
  solved: ["All lit. Now I can read the labels at the end of the corridor.", "There. A plan worked better than switching everything at random."],
  done: ["Three corridors lit. Excellent. I can finally get back to the storeroom.", "Every lantern accounted for. You have earned a quiet nod of approval."],
};

export function LanternPuzzle() {
  const [game, setGame] = useState(() => newLanternGame());
  const [hovered, setHovered] = useState(null);
  const solved = game.board === LANTERNS_LIT;
  const done = solved && game.round === 2;
  const affected = hovered === null ? [] : lanternNeighbors(hovered);
  const lines = LANTERN_COMMENTS[game.event];
  const act = action => setGame(current => lanternTurn(current, action));
  return <GameFrame id="lantern-title" bar="✧ light the palace corridor" kicker="ONE TAP CAN CHANGE THE WHOLE PATTERN" title="Lantern" accent="puzzle!">
    <p className="little-game__intro" id="lantern-rule">Light all nine. A tap switches that lantern and its neighbors above, below, left and right. Tap again to reverse it.</p>
    <p className="little-game__progress">Corridor {game.round + 1} of 3 <span>{game.history.length} taps</span></p>
    <div className="lantern-grid" aria-label="Nine lanterns" aria-describedby="lantern-rule" onPointerLeave={() => setHovered(null)}>
      {Array.from({ length: 9 }, (_, index) => {
        const lit = !!(game.board & (1 << index));
        return <button key={index} className="lantern-cell" data-lit={lit} data-affected={affected.includes(index)} data-hint={game.hint === index}
          disabled={solved} aria-pressed={lit} aria-label={`Lantern ${index + 1}, ${lit ? "lit" : "unlit"}${game.hint === index ? ", Maomao’s suggestion" : ""}`}
          onPointerEnter={() => setHovered(index)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => act({ type: "tap", index })}>
          <svg viewBox="0 0 64 76" aria-hidden="true">
            <path d="M32 3v9M24 12h16M24 61h16m-8 0v10m-5-3v6m10-6v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M22 15q-16 8-13 28 2 12 13 15h20q11-3 13-15 3-20-13-28Z" className="lantern-paper" stroke="currentColor" strokeWidth="2" />
            <path d="M24 16q-10 21 0 42m16-42q10 21 0 42M10 31h44M10 43h44" stroke="currentColor" strokeWidth="1" opacity=".45" fill="none" />
            {lit && <path className="lantern-glow" d="m32 27 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#fff9df" />}
          </svg>
          <small>{index + 1} · {lit ? "lit" : "dark"}</small>
        </button>;
      })}
    </div>
    <div className="little-game__actions">
      {solved ? <button className="button-plum" onClick={() => { setGame(newLanternGame(done ? 0 : game.round + 1)); setHovered(null); }}>{done ? "Light another path ↺" : "Next corridor →"}</button>
        : <button className="button-plum" onClick={() => act({ type: "hint" })}>A little nudge?</button>}
      <button className="quiet-button" disabled={!game.history.length} onClick={() => act({ type: "undo" })}>Undo last tap</button>
    </div>
    {game.hint !== null && <p className="palette-clue">Try lantern {game.hint + 1}, outlined above. Then look at what changed.</p>}
    <MaomaoComment expression={solved ? "pleased" : game.event === "hint" ? "curious" : game.event === "undo" ? "writing" : "thinking"} revision={game.turns}>
      {game.event === "welcome" ? lines[game.round] : lines[game.turns % lines.length]}
    </MaomaoComment>
  </GameFrame>;
}
