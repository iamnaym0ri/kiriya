import { useState } from "react";
import { Link } from "react-router";
import { usePlayful, Bow } from "../../shared/play/PlayfulWorld.jsx";
import { celebrate } from "../../shared/effects.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import { PALETTE_ROUNDS, blendColour, matchScore } from "./palette.js";
import "./PlayDesk.css";
export default function PaletteParty() {
  const [round, setRound] = useState(0);
  const [amount, setAmount] = useState(50);
  const [checked, setChecked] = useState(null);
  const [won, setWon] = useState([]);
  const [clue, setClue] = useState(false);
  const { moving } = usePlayful();
  const done = round === PALETTE_ROUNDS.length;
  const current = PALETTE_ROUNDS[Math.min(round, 2)];
  const colour = blendColour(current.a, current.b, amount);
  const matched = checked !== null && checked >= 92;
  function check() {
    const score = matchScore(amount, current.target);
    setChecked(score);
    if (score >= 92 && moving) celebrate({ x: 0.4, y: 0.55 }, 0.25);
  }
  function next() {
    setWon((w) => [...w, blendColour(current.a, current.b, current.target)]);
    setRound((r) => r + 1);
    setAmount(50);
    setChecked(null);
    setClue(false);
  }
  return (
    <section
      className="palette-party play-window"
      id="palette-party"
      aria-labelledby="palette-title"
      data-motion-region
    >
      <div className="play-window__bar">
        <span>✿ the little colour club</span>
        <span aria-hidden="true">♡ ✧ ♡</span>
      </div>
      <div className="palette-party__inside">
        <div className="palette-heading">
          <div>
            <span className="pixel-label">
              A TINY GAME FOR YOUR ARTIST BRAIN
            </span>
            <h2 id="palette-title">
              Maomao’s <em>colour club!</em>
            </h2>
          </div>
          <Bow />
        </div>
        {done ? (
          <div className="palette-complete" role="status">
            <MaomaoMascot size={125} expression="party" />
            <div>
              <h3>Your birthday palette! 🎂</h3>
              <p>Three little colours, made by you. Maomao approves.</p>
              <div className="won-palette">
                {won.map((c) => (
                  <span key={c} style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
            <Link
              className="button-plum"
              to={`/world/studio?paint=${encodeURIComponent(won.join(","))}`}
            >
              Take these to your sketchbook ↗
            </Link>
            <button
              className="text-link"
              onClick={() => {
                setRound(0);
                setWon([]);
                setChecked(null);
                setAmount(50);
              }}
            >
              Play again ↺
            </button>
          </div>
        ) : (
          <>
            <p className="palette-party__intro">
              Can you mix her little colour swatch? Slide, look, and trust your
              eye. No timer, just vibes. ♡
            </p>
            <div
              className="palette-progress"
              aria-label={`Colour ${round + 1} of 3`}
            >
              {PALETTE_ROUNDS.map((r, i) => (
                <span
                  key={r.name}
                  data-done={i < round}
                  data-current={i === round}
                >
                  {i < round ? "✓" : r.emoji}
                  <small>{i + 1}</small>
                </span>
              ))}
              <b>{current.name}</b>
            </div>
            <div className="palette-match">
              <div>
                <div
                  className="paint-blob paint-blob--target"
                  style={{
                    background: blendColour(
                      current.a,
                      current.b,
                      current.target,
                    ),
                  }}
                />
                <span>match this!</span>
              </div>
              <span className="palette-match__arrow" aria-hidden="true">
                ↝
              </span>
              <div>
                <div className="paint-blob" style={{ background: colour }} />
                <span>your little mix</span>
              </div>
            </div>
            <div className="paint-slider">
              <span style={{ background: current.a }} aria-hidden="true" />
              <input
                type="range"
                min="0"
                max="100"
                value={amount}
                aria-label="Mix of the second colour"
                aria-valuetext={`${amount}% of the second colour`}
                disabled={matched}
                onChange={(e) => {
                  setAmount(Number(e.target.value));
                  setChecked(null);
                }}
              />
              <span style={{ background: current.b }} aria-hidden="true" />
            </div>
            <div className="palette-actions">
              <button className="button-plum" onClick={matched ? next : check}>
                {matched
                  ? round === 2
                    ? "Keep my birthday palette ♡"
                    : "Next little colour →"
                  : "How close am I? ✧"}
              </button>
              <button
                className="quiet-button"
                onClick={() => setClue(!clue)}
                aria-expanded={clue}
              >
                A little hint?
              </button>
            </div>
            {clue && (
              <p className="palette-clue">
                {current.hint} Try {current.target}% of the second colour.
              </p>
            )}
            <div className="palette-verdict" role="status">
              <MaomaoMascot
                expression={
                  matched ? "sparkle" : checked !== null ? "smug" : "deadpan"
                }
                size={58}
              />
              <p>
                {matched
                  ? `${checked}% match! A tiny masterpiece. ♡`
                  : checked !== null
                    ? `${checked}% match. A little more mixing? You’ve got this.`
                    : "“I’ll know a good colour when I see one.”"}
                <small>your very unofficial art supervisor</small>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
