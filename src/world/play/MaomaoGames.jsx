import { useId, useReducer, useState } from "react";
import { GameSymbol, MaomaoComment, SYMBOL_NAMES } from "./GamePieces.jsx";
import { HerbSequence, LanternPuzzle } from "./MoreMaomaoGames.jsx";
import PaletteParty from "./PaletteParty.jsx";
import { JAR_CLUES, inspectJar, memoryTurn, newJarRound, newMemoryGame } from "./littleGames.js";
import "./MaomaoGames.css";

const MEMORY_COMMENTS = {
  welcome: ["More drawers today. I expect the herbs back in the correct places."],
  first: ["Remember the label. An unlabelled drawer is a nuisance.", "One observation. Rather early for a conclusion.", "Hm. Set that detail aside. We may need it."],
  match: ["Same markings. They belong together.", "That agrees with what we saw earlier. Good.", "A pair. Keep the labels facing outward."],
  miss: ["Different contents. Remember where they were; that wasn't a useless observation.", "A reasonable guess. The evidence disagrees, though.", "Not a pair. Don't mix the contents just because the drawers look alike."],
  continue: ["Another look. The contents haven't changed.", "Start with what you know. Leave the guessing until you need it."],
  done: ["Every pair accounted for. Good. Now I can find my herbs without opening every drawer."],
};

function MemoryDrawer() {
  const [game, dispatch] = useReducer(memoryTurn, undefined, newMemoryGame);
  const choices = MEMORY_COMMENTS[game.event];
  const lastSymbol = game.cards[game.open.at(-1)];
  const studying = game.event === "first" || game.event === "match";
  const expression = studying && lastSymbol === "leaf" ? "herb"
    : studying && lastSymbol === "bottle" ? "poison"
      : game.event === "done" || game.event === "match" ? "pleased" : "thinking";
  const comment = studying && lastSymbol === "leaf"
    ? game.event === "first" ? "Oh, the herb drawer! Look at the leaves… right. We're finding pairs."
      : "Both herb bundles! Excellent. I'll just examine these a little longer."
    : studying && lastSymbol === "bottle"
      ? game.event === "first" ? "A specimen bottle…! Hm. There should be another with the same label."
        : "Matching specimen labels. Very good. May I keep these on my shelf?"
      : choices[game.moves % choices.length];
  const done = game.event === "done";
  return (
    <section className="little-game play-window" aria-labelledby="memory-title">
      <div className="play-window__bar"><span>✿ the memory drawer</span><span aria-hidden="true">♡ ✧ ♡</span></div>
      <div className="little-game__inside">
        <span className="pixel-label">A LITTLE EXERCISE IN NOTICING</span>
        <h2 id="memory-title">Maomao’s <em>memory drawer</em></h2>
        <p className="little-game__intro">Find all {game.pairs} pairs. Remember what each drawer holds; they stay put until you mix them.</p>
        <p className="little-game__progress">{game.found.length / 2} of {game.pairs} pairs tucked away <span aria-hidden="true">♡</span></p>
        <div className="memory-drawer" aria-label={`${game.cards.length} picture drawers`}>
          {game.cards.map((kind, index) => {
            const revealed = game.open.includes(index) || game.found.includes(index);
            const matched = game.found.includes(index);
            return (
              <button key={index} className="memory-card" data-revealed={revealed} data-matched={matched}
                disabled={revealed || game.event === "miss" || done}
                aria-label={`Drawer ${index + 1}, ${matched ? "matched " : ""}${revealed ? SYMBOL_NAMES[kind] : "closed"}`}
                onClick={() => dispatch({ type: "flip", index })}>
                {revealed ? <GameSymbol kind={kind} /> : <span className="memory-card__back" aria-hidden="true">✧</span>}
                <small>{matched ? "paired ♡" : String(index + 1).padStart(2, "0")}</small>
              </button>
            );
          })}
        </div>
        <div className="little-game__actions">
          {game.event === "miss" && <button className="button-plum" onClick={() => dispatch({ type: "close" })}>Turn them over ↺</button>}
          <button className={done ? "button-plum" : "quiet-button"} onClick={() => dispatch({ type: "restart", game: { ...newMemoryGame(Math.random, game.pairs), event: "continue" } })}>
            {done ? "Another little game ↺" : "Mix the drawers ↺"}
          </button>
        </div>
        {done && <button className="text-link memory-challenge" onClick={() => dispatch({ type: "restart", game: newMemoryGame(Math.random, game.pairs === 4 ? 6 : 4) })}>
          {game.pairs === 4 ? "Try six pairs →" : "Back to four pairs →"}
        </button>}
        <MaomaoComment expression={expression} revision={game.moves}>{comment}</MaomaoComment>
      </div>
    </section>
  );
}

function JarPicture({ kind, odd }) {
  return (
    <svg viewBox="0 0 72 94" aria-hidden="true" className="jar-picture">
      <path d="M23 17h26v15q13 7 13 19v29q0 8-9 8H19q-9 0-9-8V51q0-12 13-19Z" fill="#e8dcee" stroke="#9675af" strokeWidth="2.5" />
      <path d="M12 62h48v19q0 5-7 5H19q-7 0-7-5Z" fill="#c5aad6" />
      <rect x="22" y="8" width="28" height="15" rx="3" fill="#d6b58b" stroke="#ad8a66" strokeWidth="2" />
      <path d="M27 13h18" stroke="#9b7359" strokeWidth="2" strokeLinecap="round" />
      {kind === "cork" && odd && <path d="M27 18h18" stroke="#9b7359" strokeWidth="2" strokeLinecap="round" />}
      {kind === "seal" && (odd ? <path d="m36 27 6 6-6 6-6-6Z" fill="#ba86aa" /> : <circle cx="36" cy="33" r="5" fill="#ba86aa" />)}
      <rect x="20" y="42" width="32" height="30" rx="4" fill="#fff8ec" />
      {kind === "label" && odd ? <g fill="#c780a8"><circle cx="36" cy="52" r="5" /><circle cx="31" cy="58" r="5" /><circle cx="41" cy="58" r="5" /><circle cx="36" cy="63" r="5" /><circle cx="36" cy="57" r="3" fill="#edcf87" /></g> : <path transform={kind === "leaf" && odd ? "translate(72 0) scale(-1 1)" : undefined} d="M29 64Q28 49 43 49q0 14-14 15Zm0 1 12-13" fill="#9cba8d" stroke="#608567" strokeWidth="1.5" />}
      {Array.from({ length: kind === "dots" && odd ? 3 : 2 }, (_, i) => <circle key={i} cx={kind === "dots" && odd ? 27 + i * 9 : 31 + i * 10} cy="79" r="2.5" fill="#8a629b" />)}
      <path d="M17 43q0-5 5-7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function OddJar() {
  const [game, setGame] = useState(() => newJarRound());
  const clue = JAR_CLUES[game.clueIndex];
  const done = game.solved && game.round === JAR_CLUES.length - 1;
  const comments = {
    welcome: ["Someone has mixed up my jars. Let's see which detail they overlooked."],
    retry: ["That one agrees with its neighbours. Try a different theory.", "Compare the markings. A hunch needs something to support it.", "Not that one. A second look is cheaper than a wrong conclusion."],
    found: ["There. One detail the others don't share. That will do.", "Exactly. Small differences matter when you're sorting specimens."],
    done: ["Five little mysteries settled. And all the jars still sealed. Sensible work."],
    hint: ["Set the other details aside for a moment. Examine just the one in the clue."],
  };
  const lines = comments[game.event];
  return (
    <section className="little-game play-window" aria-labelledby="odd-jar-title">
      <div className="play-window__bar"><span>✧ a little deduction</span><span aria-hidden="true">♡ ✧ ♡</span></div>
      <div className="little-game__inside">
        <span className="pixel-label">SOMETHING ON THIS SHELF IS DIFFERENT</span>
        <h2 id="odd-jar-title">Find the <em>odd jar!</em></h2>
        <p className="little-game__intro">One jar breaks the pattern. Inspect the labels, corks and seals. The shelves get a little fuller as you go.</p>
        <p className="little-game__progress">Little mystery {game.round + 1} of {JAR_CLUES.length} <span aria-hidden="true">✧</span></p>
        <div className="jar-shelf" aria-label={`${game.count} jars to compare`}>
          {Array.from({ length: game.count }, (_, index) => (
            <button key={index} className="jar-choice" data-found={game.solved && index === game.odd} data-retry={!game.solved && game.picked === index}
              disabled={game.solved} aria-label={`Jar ${index + 1}, ${index === game.odd ? clue.odd : clue.normal}`}
              onClick={() => setGame(current => inspectJar(current, index))}>
              <JarPicture kind={clue.kind} odd={index === game.odd} />
              <small>{game.solved && index === game.odd ? "found ♡" : String(index + 1).padStart(2, "0")}</small>
            </button>
          ))}
        </div>
        <div className="little-game__actions">
          {game.solved ? <button className="button-plum" onClick={() => setGame(newJarRound(done ? 0 : game.round + 1, Math.random, done ? undefined : game.order))}>{done ? "Investigate again ↺" : "Next little mystery →"}</button>
            : <button className="quiet-button" aria-expanded={game.hint} onClick={() => setGame(current => ({ ...current, hint: !current.hint, event: "hint" }))}>A little clue?</button>}
          {!game.solved && <span className="little-game__aside">no hurry, detective</span>}
        </div>
        {game.hint && <p className="palette-clue">{clue.hint}</p>}
        <MaomaoComment expression={game.solved ? "pleased" : "curious"} revision={game.attempts}>{lines[game.attempts % lines.length]}</MaomaoComment>
      </div>
    </section>
  );
}

const GAMES = ["Colour club", "Memory drawer", "Odd jar", "Herb sequence", "Lantern puzzle"];
export default function MaomaoGames() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  return (
    <div className="maomao-games">
      <div className="maomao-games__tabs" role="tablist" aria-label="Choose a little game">
        {GAMES.map((name, index) => (
          <button key={name} id={`${id}-tab-${index}`} role="tab" aria-selected={selected === index}
            aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)} onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index + 1) % GAMES.length : event.key === "ArrowLeft" ? (index + GAMES.length - 1) % GAMES.length : event.key === "Home" ? 0 : event.key === "End" ? GAMES.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              setSelected(next);
              document.getElementById(`${id}-tab-${next}`).focus();
            }}>{name}</button>
        ))}
      </div>
      {[<PaletteParty />, <MemoryDrawer />, <OddJar />, <HerbSequence />, <LanternPuzzle />].map((game, index) => (
        <div key={GAMES[index]} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0} data-motion-region>
          {game}
        </div>
      ))}
    </div>
  );
}
