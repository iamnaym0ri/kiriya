import { useEffect, useRef, useState } from "react";
import MaomaoMascot from "../../../../mascot/MaomaoMascot.jsx";
import BrainGame from "../common/BrainGame.jsx";
import { feel } from "../common/feel.js";
import { readStore, usePageVisible, useReducedMotion, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { lineFor } from "./lines.js";
import { LEVELS, describeMove, emptyBoard, maomaoMove, outcome, winner } from "./logic.js";
import "./three-in-a-row.css";

const GAME = "three-in-a-row";
const SAVE = "kiriya:brain:three-in-a-row";
const LEVEL_NAMES = { sleepy: ["sleepy", "she’s tired"], thoughtful: ["thoughtful", "a fair match"], focused: ["focused", "her very best"] };
const NOTABLE = new Set(["threat", "block", "fork"]);
const blankTally = () => ({ you: 0, mao: 0, draw: 0 });

function startLine(level, starter, n) {
  if (level === "sleepy") return lineFor("start-sleepy", n);
  if (level === "focused" && n % 2) return lineFor("start-focused", n);
  return lineFor(starter === "you" ? "start-you" : "start-mao", n);
}

function newRound(level, games, tally) {
  const starter = games % 2 === 0 ? "you" : "mao";
  return { level, board: emptyBoard(), starter, turn: starter, games, tally, comment: startLine(level, starter, games), last: null, talk: games };
}

function restore() {
  const saved = readStore(SAVE, null);
  if (saved?.board?.length === 9 && LEVELS.includes(saved.level)) return { ...saved, last: null };
  return newRound("thoughtful", 0, Object.fromEntries(LEVELS.map((level) => [level, blankTally()])));
}

// Her blossom and Maomao's herb sprig, drawn a little differently in each square so the board
// looks placed by hand.
function Blossom({ tilt }) {
  return (
    <svg viewBox="-50 -50 100 100" className="ttt-piece ttt-piece--you" style={{ "--tilt": `${tilt}deg` }} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="0" cy="-21" rx="15" ry="21" transform={`rotate(${angle})`} fill="#f4b6d2" stroke="#c2668f" strokeWidth="3.2" />
      ))}
      <circle r="11" fill="#ffe08f" stroke="#d39a4a" strokeWidth="3" />
      <circle cx="-3" cy="-3" r="3" fill="#fff6d5" />
    </svg>
  );
}
function Sprig({ tilt }) {
  return (
    <svg viewBox="-50 -50 100 100" className="ttt-piece ttt-piece--mao" style={{ "--tilt": `${tilt}deg` }} aria-hidden="true">
      <path d="M-4 40Q-2 0 6-40" fill="none" stroke="#4f7a57" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M-2 14C-26 16-30-2-30-2-12-4-1 2-2 14ZM2-6C24-6 29-24 29-24 11-26 0-20 2-6ZM4-26C-12-30-12-44-12-44 1-42 7-36 4-26ZM0 30C18 30 22 16 22 16 9 14 1 19 0 30Z" fill="#9cc78a" stroke="#4f7a57" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-2 14-18 2M2-6 18-18" stroke="#d6e8b8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
const TILTS = [-8, 5, -3, 7, -6, 3, -4, 8, -2];

function Board({ board, onPlay, disabled, won, last }) {
  const line = won?.line;
  const centre = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
  return (
    <div className="ttt-board" role="grid" aria-label="the board">
      <svg viewBox="0 0 300 300" className="ttt-grid" aria-hidden="true">
        <path d="M101 12Q97 150 102 288M199 10Q203 152 198 289M11 100Q150 96 289 102M12 201Q152 205 288 198" fill="none" stroke="#b896c9" strokeWidth="5" strokeLinecap="round" />
        {line && (
          <path
            className="ttt-strike"
            pathLength="1"
            d={`M${centre(line[0]).join(" ")}Q${(centre(line[0])[0] + centre(line[2])[0]) / 2 + 6} ${(centre(line[0])[1] + centre(line[2])[1]) / 2 - 6} ${centre(line[2]).join(" ")}`}
            fill="none"
            stroke={won.who === "you" ? "#c2668f" : "#4f7a57"}
            strokeWidth="9"
            strokeLinecap="round"
          />
        )}
      </svg>
      {[0, 1, 2].map((row) => (
        <div key={row} role="row" className="ttt-row">
          {[0, 1, 2].map((col) => {
            const i = row * 3 + col;
            const cell = board[i];
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                className="ttt-cell"
                data-last={last === i || undefined}
                data-in-line={line?.includes(i) || undefined}
                disabled={disabled || Boolean(cell)}
                aria-label={`row ${row + 1}, column ${col + 1}: ${cell === "you" ? "your blossom" : cell === "mao" ? "Maomao’s sprig" : "empty"}`}
                onClick={() => onPlay(i)}
              >
                {cell === "you" && <Blossom tilt={TILTS[i]} />}
                {cell === "mao" && <Sprig tilt={-TILTS[i]} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ThreeInARow({ onReward }) {
  const [game, setGame] = useState(restore);
  const [thinking, setThinking] = useState(false);
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const pace = useRef(650);
  const { level, board, turn, tally } = game;
  const result = outcome(board);
  const won = winner(board);
  const score = tally[level] ?? blankTally();

  useEffect(() => writeStore(SAVE, { ...game, last: null }), [game]);

  function finish(state, next, event) {
    const ended = outcome(next);
    if (!ended) return null;
    const counts = { ...state.tally, [state.level]: { ...(state.tally[state.level] ?? blankTally()), [ended]: (state.tally[state.level]?.[ended] ?? 0) + 1 } };
    const key = ended === "draw" ? (state.level === "focused" ? "draw-focused" : "draw") : ended === "you" ? (state.level === "sleepy" ? "you-win-sleepy" : "you-win") : "mao-win";
    return { tally: counts, comment: lineFor(key, state.talk + 1), event };
  }

  function play(i) {
    if (turn !== "you" || result || board[i]) return;
    const next = [...board];
    next[i] = "you";
    const event = describeMove(board, next, "you");
    const ended = finish(game, next, event);
    if (ended) {
      setGame({ ...game, board: next, last: i, turn: null, tally: ended.tally, comment: ended.comment, talk: game.talk + 1 });
      if (outcome(next) === "you") {
        feel("win");
        if (level === "thoughtful") rewardOnce(onReward, { sticker: "st-teacup", game: GAME, reason: "first win against thoughtful maomao" });
      } else feel("good");
      if (outcome(next) === "draw" && level === "focused") rewardOnce(onReward, { sticker: "st-sprig", game: GAME, reason: "a draw against focused maomao" });
      return;
    }
    feel("place");
    pace.current = NOTABLE.has(event) ? 1300 : 650;
    setGame({ ...game, board: next, last: i, turn: "mao", comment: lineFor(NOTABLE.has(event) ? `you-${event}` : "think", game.talk + 1), talk: game.talk + 1 });
  }

  // Maomao's turn: a moment to think (longer after a move worth commenting on), and never while
  // the app is in the background.
  useEffect(() => {
    if (turn !== "mao" || result || !visible) return undefined;
    setThinking(true);
    const timer = setTimeout(() => {
      setThinking(false);
      setGame((state) => {
        if (state.turn !== "mao" || outcome(state.board)) return state;
        const i = maomaoMove(state.board, state.level);
        const next = [...state.board];
        next[i] = "mao";
        const event = describeMove(state.board, next, "mao");
        const ended = finish(state, next, event);
        if (ended) {
          feel(outcome(next) === "mao" ? "oops" : "good");
          return { ...state, board: next, last: i, turn: null, tally: ended.tally, comment: ended.comment, talk: state.talk + 1 };
        }
        feel("tap");
        return { ...state, board: next, last: i, turn: "you", comment: lineFor(`mao-${event}`, state.talk + 1), talk: state.talk + 1 };
      });
    }, reduced ? Math.min(pace.current, 500) : pace.current);
    return () => {
      clearTimeout(timer);
      setThinking(false);
    };
  }, [turn, result, visible, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const again = (nextLevel = level) => {
    feel("tap");
    setGame((state) => newRound(nextLevel, state.games + 1, state.tally));
  };
  const poke = () => {
    if (thinking) return;
    setGame((state) => ({ ...state, comment: lineFor("poke", state.talk + 1), talk: state.talk + 1 }));
  };

  const comment = game.comment;
  const expression = thinking ? "thinking" : comment.expression;
  const banner = result === "you" ? "you win ♡" : result === "mao" ? "maomao wins" : result === "draw" ? "a draw" : null;

  return (
    <BrainGame
      id={GAME}
      className="ttt-game"
      status={
        <span className="ttt-score" aria-label={`you ${score.you}, Maomao ${score.mao}, draws ${score.draw}`}>
          you {score.you} <i>·</i> maomao {score.mao} <i>·</i> <small>draws {score.draw}</small>
        </span>
      }
      howToTitle="three in a row"
      howTo={
        <ul>
          <li>
            you’re the <b>blossoms</b>, Maomao is the <b>herb sprigs</b>. take turns placing one.
          </li>
          <li>
            three of yours in a <b>row, column or diagonal</b> wins.
          </li>
          <li>you take turns going first. pick her mood below: sleepy, thoughtful, or focused (her very best).</li>
        </ul>
      }
    >
      <div className="ttt">
        <div className="ttt-maomao">
          <MaomaoMascot size={88} expression={expression} reactionKey={game.talk} onPoke={poke} />
          <p className="ttt-bubble" role="status" key={game.talk} data-thinking={thinking || undefined}>
            {comment.text}
          </p>
        </div>
        <div className="ttt-board-wrap">
          <Board board={board} onPlay={play} disabled={turn !== "you" || Boolean(result)} won={won} last={game.last} />
        </div>
        <div className="ttt-foot">
          {banner ? (
            <div className="ttt-result" data-result={result}>
              <b>{banner}</b>
              <button type="button" className="brain-btn" onClick={() => again()}>
                again ↺
              </button>
            </div>
          ) : (
            <p className="ttt-turn">{turn === "you" ? "your turn ✿" : "maomao is thinking…"}</p>
          )}
          <div className="brain-choice ttt-levels" role="group" aria-label="Maomao’s mood">
            {LEVELS.map((each) => (
              <button key={each} type="button" aria-pressed={each === level} onClick={() => each !== level && again(each)}>
                {LEVEL_NAMES[each][0]}
                <small>{LEVEL_NAMES[each][1]}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </BrainGame>
  );
}
