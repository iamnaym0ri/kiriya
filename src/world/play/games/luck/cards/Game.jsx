import { useEffect, useRef, useState } from "react";
import { ConfettiCanvas, LuckStage, StatusBar } from "../_kit/parts.jsx";
import { haptic, useLuck, useSaveBest, useReducedMotion } from "../_kit/hooks.js";
import { play } from "../_kit/sound.js";
import { celebrate } from "../_kit/celebrate.js";
import { MILESTONES, guessTurn, newGame } from "./logic.js";
import "./cards.css";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const HELP = {
  game: "cards",
  steps: [
    ["updown", "will the next card be higher or lower? pick one"],
    ["same", "the same number counts as right, too"],
    ["5", "keep the streak going: 5 and 10 in a row earn a sticker"],
  ],
};
const SUIT_NAMES = { heart: "hearts", star: "stars", moon: "moons", flower: "flowers" };
const RIGHT = ["yes!", "lucky you ♡", "spot on", "you read that card's mind", "ooh, nice"];
const WRONG = ["aw, not that one. a fresh streak starts now ✿", "the cards were cheeky. new streak, same lovely you", "so close. let's go again ♡"];

export function SuitMark({ suit, size = 24 }) {
  const paths = {
    heart: <path d="M16 28C6 21 2 16 2 10.5 2 6.4 5.2 3.5 9 3.5c3 0 5.4 1.7 7 4.2 1.6-2.5 4-4.2 7-4.2 3.8 0 7 2.9 7 7 0 5.5-4 10.5-14 17.5z" fill="#ff8fbd" />,
    star: <path d="M16 2.5l4.1 8.6 9.4 1.2-6.9 6.5 1.8 9.3L16 23.6l-8.4 4.5 1.8-9.3-6.9-6.5 9.4-1.2z" fill="#ffd166" />,
    moon: <path d="M20 3a13 13 0 1 0 9 21A11 11 0 0 1 20 3z" fill="#c9a8f5" />,
    flower: (
      <>
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} cx="16" cy="8.5" rx="5.4" ry="7" transform={`rotate(${angle} 16 16)`} fill="#97dcc8" />
        ))}
        <circle cx="16" cy="16" r="4.6" fill="#ffdc7d" />
      </>
    ),
  };
  return (
    <svg className="card-suit" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <g stroke="#4a2f57" strokeWidth="2.2" strokeLinejoin="round">{paths[suit]}</g>
    </svg>
  );
}

function CardFace({ card }) {
  return (
    <div className="lilac-card lilac-card--face" data-suit={card.suit}>
      <span className="lilac-card__corner"><b>{card.rank}</b><SuitMark suit={card.suit} size={16} /></span>
      <span className="lilac-card__middle">
        <b>{card.rank}</b>
        <SuitMark suit={card.suit} size={58} />
      </span>
      <span className="lilac-card__corner lilac-card__corner--end"><b>{card.rank}</b><SuitMark suit={card.suit} size={16} /></span>
    </div>
  );
}

function CardBack() {
  return (
    <div className="lilac-card lilac-card--back" aria-hidden="true">
      <span className="lilac-card__emblem">
        <svg viewBox="0 0 40 40" width="46" height="46">
          <circle cx="20" cy="20" r="17" fill="#fffaf3" stroke="#4a2f57" strokeWidth="2.2" />
          <path d="M20 29c-6-4-9-7-9-10.5 0-2.4 1.9-4.2 4.2-4.2 2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 2.3 0 4.2 1.8 4.2 4.2 0 3.5-3 6.5-9 10.5z" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="2" strokeLinejoin="round" />
          <path d="M29 9l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#ffd166" />
        </svg>
      </span>
    </div>
  );
}

export default function CardsGame({ onReward }) {
  const luck = useLuck();
  const saveBest = useSaveBest();
  const reduced = useReducedMotion();
  const confettiRef = useRef(null);
  const [game, setGame] = useState(() => newGame());
  const [pending, setPending] = useState(null);
  const [phase, setPhase] = useState("guess"); // guess | flip | result
  const [line, setLine] = useState("will the next card be higher or lower?");
  const [arrived, setArrived] = useState(0);
  const best = luck.data?.best?.cards ?? 0;
  const knownBest = useRef(0);
  knownBest.current = Math.max(knownBest.current, best);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const record = async (value) => {
    if (value <= knownBest.current) return;
    knownBest.current = value;
    try {
      const data = await saveBest.mutateAsync({ game: "cards", streak: value });
      for (const milestone of MILESTONES) {
        if (data.previous < milestone.streak && data.best >= milestone.streak) {
          onReward?.({ sticker: milestone.sticker, game: "cards", reason: milestone.reason });
          celebrate(confettiRef.current, { y: 0.45, big: milestone.streak >= 10 });
        }
      }
    } catch {
      // Saved next time she beats it.
    }
  };

  const guess = async (choice) => {
    if (phase !== "guess") return;
    const next = guessTurn(game, choice);
    setPending(next);
    setPhase("flip");
    setLine("");
    play("flip");
    haptic("light");
    await wait(reduced ? 60 : 420);
    if (!alive.current) return;
    setPhase("result");
    const { result } = next.last;
    if (result === "wrong") {
      play("soft");
      haptic("warning");
      setLine(WRONG[next.turns % WRONG.length]);
      record(next.last.streakBefore);
    } else {
      play(next.streak % 5 === 0 ? "yay" : "chime");
      haptic(next.streak % 5 === 0 ? "success" : "light");
      setLine(result === "same" ? "the same number! that counts ♡" : RIGHT[next.turns % RIGHT.length]);
      if (next.streak >= 5) record(next.streak);
    }
    await wait(reduced ? 500 : 900);
    if (!alive.current) return;
    setGame(next);
    setPending(null);
    setArrived((n) => n + 1);
    setPhase("guess");
    if (next.fresh) setLine("a fresh deck, shuffled just for you ✿");
  };

  const showing = phase === "guess" ? null : pending?.last;
  const left = game.deck.length;

  return (
    <LuckStage className="cards-game" aria-label="lilac cards, higher or lower">
      <StatusBar help={HELP}>
        <span className="luck-chip cards-streak" data-hot={game.streak >= 3} aria-label={`streak ${phase === "result" && pending ? pending.streak : game.streak}`}>
          <span aria-hidden="true">♡</span> streak {phase === "result" && pending ? pending.streak : game.streak}
        </span>
        <span className="luck-chip"><small>BEST</small> {Math.max(best, knownBest.current)}</span>
      </StatusBar>

      <div className="cards-table">
        <div className="cards-slot">
          <span className="luck-pixel cards-slot__label">this card</span>
          <div className="cards-current" key={arrived} data-arrive={arrived > 0 && !reduced}>
            <CardFace card={game.current} />
          </div>
        </div>
        <div className="cards-slot">
          <span className="luck-pixel cards-slot__label">{left ? `next · ${left} left` : "next · new deck"}</span>
          <div className="cards-deck" data-phase={phase}>
            <span className="cards-deck__under" aria-hidden="true" />
            <span className="cards-deck__under cards-deck__under--2" aria-hidden="true" />
            {showing ? (
              <div className="cards-flip" data-result={phase === "result" ? showing.result : undefined}>
                <div className="cards-flip__back"><CardBack /></div>
                <div className="cards-flip__face"><CardFace card={showing.card} /></div>
                {phase === "result" && (
                  <span className="cards-badge" data-result={showing.result} aria-hidden="true">
                    {showing.result === "wrong" ? "✕" : showing.result === "same" ? "=" : "✓"}
                  </span>
                )}
              </div>
            ) : (
              <CardBack />
            )}
          </div>
        </div>
      </div>

      <p className="cards-line luck-hand" role="status" aria-live="polite">
        {showing && phase === "result" ? (
          <span className="luck-sr">{`${showing.card.rank} of ${SUIT_NAMES[showing.card.suit]}. `}</span>
        ) : null}
        {line || " "}
      </p>

      <div className="cards-actions">
        <button type="button" className="luck-btn cards-btn" onClick={() => guess("higher")} disabled={phase !== "guess"}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          higher
        </button>
        <button type="button" className="luck-btn cards-btn" onClick={() => guess("lower")} disabled={phase !== "guess"}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          lower
        </button>
      </div>
      <ConfettiCanvas ref={confettiRef} />
    </LuckStage>
  );
}
