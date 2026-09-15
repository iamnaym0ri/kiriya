import { useState } from "react";
import { Link } from "react-router";
import { usePlayful, Bow } from "../../shared/play/PlayfulWorld.jsx";
import { celebrate } from "../../shared/effects.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import { PALETTE_PASS_SCORE, newPaletteRounds, blendColour, matchScore } from "./palette.js";
import "./PlayDesk.css";
export default function PaletteParty() {
  const [round, setRound] = useState(0);
  const [rounds, setRounds] = useState(() => newPaletteRounds());
  const [amount, setAmount] = useState(50);
  const [checked, setChecked] = useState(null);
  const [won, setWon] = useState([]);
  const [clue, setClue] = useState(false);
  const [remarks, setRemarks] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [exact, setExact] = useState(false);
  const { moving } = usePlayful();
  const done = round === rounds.length;
  const current = rounds[Math.min(round, rounds.length - 1)];
  const colour = blendColour(current.a, current.b, amount);
  const matched = checked !== null && checked >= PALETTE_PASS_SCORE;
  function check() {
    const score = matchScore(amount, current.target);
    setChecked(score);
    setRemarks((n) => n + 1);
    setAttempts(n => n + 1);
    if (score >= PALETTE_PASS_SCORE && moving) celebrate({ x: 0.4, y: 0.55 }, 0.25);
  }
  function next() {
    setWon((w) => [...w, blendColour(current.a, current.b, current.target)]);
    setRound((r) => r + 1);
    setAmount(50);
    setChecked(null);
    setClue(false);
    setExact(false);
    setAttempts(0);
    setRemarks((n) => n + 1);
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
            <MaomaoMascot size={125} expression="pleased" />
            <div>
              <h3>Your birthday palette! 🎂</h3>
              <p>“Three consistent mixtures. Good. Keep a record of the proportions.”</p>
              <div className="won-palette">
                {won.map((c) => (
                  <span key={c} style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
            <Link
              className="button-plum"
              to={`/world?paint=${encodeURIComponent(won.join(","))}#play-desk`}
            >
              Use these in lets doodle&lt;3 ↗
            </Link>
            <button
              className="text-link"
              onClick={() => {
                setRound(0);
                setRounds(newPaletteRounds());
                setWon([]);
                setChecked(null);
                setAmount(50);
                setClue(false);
                setExact(false);
                setAttempts(0);
                setRemarks((n) => n + 1);
              }}
            >
              Play again ↺
            </button>
          </div>
        ) : (
          <>
            <p className="palette-party__intro">
              Can you mix her little colour swatch? Slide, look, and trust your
              eye. Aim for a 95% match. A fresh mix each time, with no timer. ♡
            </p>
            <div
              className="palette-progress"
              aria-label={`Colour ${round + 1} of 3`}
            >
              {rounds.map((r, i) => (
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
                onClick={() => {
                  setClue(!clue);
                  setRemarks((n) => n + 1);
                }}
                aria-expanded={clue}
              >
                A little hint?
              </button>
            </div>
            {clue && (
              <p className="palette-clue">
                {exact ? `Try ${current.target}% of the second colour.`
                  : Math.abs(amount - current.target) <= 3 ? "The proportions look close. Try checking your mix."
                    : `Try a little ${amount < current.target ? "more" : "less"} of the second colour. Make a small change, then compare.`}
              </p>
            )}
            {clue && attempts >= 2 && !exact && !matched && <button className="text-link" onClick={() => { setExact(true); setRemarks(n => n + 1); }}>Show the exact mix</button>}
            <div className="palette-verdict" role="status">
              <MaomaoMascot
                expression={
                  matched ? "pleased" : exact ? "writing" : checked !== null ? "thinking" : "curious"
                }
                reactionKey={remarks}
                size={58}
              />
              <p>
                {matched
                  ? `${checked}% match. ${["That agrees with the sample. Keep those proportions.", "A consistent mixture. Good. Make a note of it.", "There it is. Observation does save a lot of guessing."][remarks % 3]}`
                  : checked !== null
                    ? `${checked}% match. ${["Compare it with the sample, then adjust one thing.", "The proportions are off. We have a record; use it.", "Another observation. Now we know what to change."][remarks % 3]}`
                    : clue
                      ? "The proportions are in the clue. Careful observation beats guessing."
                      : "“Measure, compare, adjust. Much like work at the mortar.”"}
                <small>your very unofficial art supervisor</small>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
