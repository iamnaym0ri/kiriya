import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../../lib/api.js";
import { useIsAdmin } from "../../../../../lib/session.js";
import { AdminEdit } from "../../../../../shared/admin/AdminEdit.jsx";
import BrainGame from "../common/BrainGame.jsx";
import { feel } from "../common/feel.js";
import { readStore, useReducedMotion, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { MAX_TRIES, WORD_LENGTH, WORD_TIN, letterStates, scoreGuess, singaporeDay, solvedStreak, tinWord, wordStatus } from "./words.js";
import "./secret-word.css";

const WordAdmin = lazy(() => import("./WordAdmin.jsx"));

const GAME = "secret-word";
const SAVE = "kiriya:brain:secret-word";
const HISTORY = "kiriya:brain:secret-word:history";
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MARK = { hit: "♥", near: "•" };
const SAY = { hit: "in the right place", near: "in the word, somewhere else", miss: "not in the word" };
const PRAISE = ["first try?! that’s magic.", "two tries. who told you?", "three tries. lovely.", "four tries. found it ♡", "five tries. got there!", "phew, the very last try!"];

// The guess dictionary is ~22 kB, so it arrives just after the board is on screen.
let dictionary = null;
const loadDictionary = () =>
  import("./dictionary.js").then((module) => {
    dictionary ??= new Set([...module.default.split(" "), ...WORD_TIN]);
    return dictionary;
  });

const dayLabel = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).toLowerCase();

function usePuzzle() {
  const query = useQuery({
    queryKey: ["games", GAME],
    queryFn: () => api(`/me/games/${GAME}`),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const today = singaporeDay();
  const fresh = query.data && query.data.day >= today ? query.data : null;
  // Offline, or the server is having a moment: the tin always has a word for today.
  if (fresh) return { puzzle: fresh, ready: true };
  if (query.isError || (!query.isFetching && !fresh))
    return { puzzle: { day: today, word: tinWord(today), by: "tin", note: null, play: null, streak: null }, ready: true, offline: true };
  return { puzzle: null, ready: false };
}

function startingGuesses(puzzle) {
  const saved = readStore(SAVE, null);
  const local = saved?.day === puzzle.day && saved.word === puzzle.word ? saved.guesses : [];
  const remote = puzzle.play?.guesses ?? [];
  // Whichever copy got further (this phone, or another device she played on).
  return remote.length > local.length ? remote : local;
}

function Tile({ letter, state, index, reveal, row }) {
  return (
    <span
      className="sw-tile"
      data-state={state ?? (letter ? "typed" : "empty")}
      data-reveal={reveal || undefined}
      style={{ "--i": index }}
      role="img"
      aria-label={letter ? `${letter}${state ? `, ${SAY[state]}` : ""}` : `row ${row + 1}, empty`}
    >
      <b>{letter}</b>
      {state && MARK[state] && <i aria-hidden="true">{MARK[state]}</i>}
    </span>
  );
}

function Board({ guesses, current, answer, shake, revealRow }) {
  return (
    <div className="sw-board" role="group" aria-label="your guesses">
      {Array.from({ length: MAX_TRIES }, (_, row) => {
        const guess = guesses[row];
        const typing = row === guesses.length ? current : "";
        const states = guess ? scoreGuess(guess, answer) : null;
        const letters = (guess ?? typing).padEnd(WORD_LENGTH, " ");
        return (
          <div key={row} className="sw-row" data-shake={shake && row === guesses.length ? shake : undefined} aria-label={guess ? `guess ${row + 1}: ${guess}` : undefined}>
            {[...letters].map((letter, i) => (
              <Tile key={i} index={i} row={row} letter={letter.trim()} state={states?.[i]} reveal={revealRow === row} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Keyboard({ states, onKey, disabled }) {
  return (
    <div className="sw-keys" aria-label="keyboard">
      {ROWS.map((row, r) => (
        <div key={row} className="sw-keys__row">
          {r === 2 && (
            <button type="button" className="sw-key sw-key--wide" disabled={disabled} onClick={() => onKey("enter")} aria-label="try this word">
              try ♡
            </button>
          )}
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              className="sw-key"
              data-state={states[letter]}
              disabled={disabled}
              onClick={() => onKey(letter)}
              aria-label={`${letter}${states[letter] ? `, ${SAY[states[letter]]}` : ""}`}
            >
              {letter}
            </button>
          ))}
          {r === 2 && (
            <button type="button" className="sw-key sw-key--wide" disabled={disabled} onClick={() => onKey("back")} aria-label="delete a letter">
              <svg viewBox="0 0 28 20" width="26" height="19" aria-hidden="true">
                <path d="M9 2.5h15q2 0 2 2v11q0 2-2 2H9l-7-7.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="m13 7 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Spread({ history }) {
  const counts = Array.from({ length: MAX_TRIES }, (_, i) => Object.values(history).filter((r) => r.status === "won" && r.tries === i + 1).length);
  const most = Math.max(1, ...counts);
  return (
    <div className="sw-spread" aria-label="how many tries your words took">
      {counts.map((count, i) => (
        <div key={i} className="sw-spread__bar">
          <span>{i + 1}</span>
          <i style={{ "--w": `${Math.max(8, (count / most) * 100)}%` }} data-empty={count === 0 || undefined}>
            {count}
          </i>
        </div>
      ))}
    </div>
  );
}

function Play({ puzzle, onReward, offline }) {
  const reduced = useReducedMotion();
  const [guesses, setGuesses] = useState(() => startingGuesses(puzzle));
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState(null);
  const [shake, setShake] = useState(0);
  const [revealRow, setRevealRow] = useState(null);
  const [history, setHistory] = useState(() => readStore(HISTORY, {}));
  const busy = useRef(false);
  const answer = puzzle.word;
  const status = wordStatus(guesses, answer);
  const states = useMemo(() => letterStates(guesses, answer), [guesses, answer]);

  useEffect(() => {
    loadDictionary().catch(() => {});
  }, []);

  // A finished game shown again on another day's visit still counts in her history.
  useEffect(() => {
    if (status === "playing" || history[puzzle.day]) return;
    const next = { ...history, [puzzle.day]: { status, tries: guesses.length } };
    setHistory(next);
    writeStore(HISTORY, next);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = useCallback((text) => setMessage({ text, key: Date.now() }), []);

  const submit = useCallback(async () => {
    if (busy.current) return;
    if (current.length < WORD_LENGTH) {
      setShake((n) => n + 1);
      feel("oops");
      say("five letters, please ♡");
      return;
    }
    busy.current = true;
    const words = dictionary ?? (await loadDictionary().catch(() => null));
    busy.current = false;
    if (words && current !== answer && !words.has(current)) {
      setShake((n) => n + 1);
      feel("oops");
      say("hm, that one isn’t in my little dictionary");
      return;
    }
    const next = [...guesses, current];
    const result = wordStatus(next, answer);
    setGuesses(next);
    setCurrent("");
    setMessage(null);
    setRevealRow(next.length - 1);
    writeStore(SAVE, { day: puzzle.day, word: answer, guesses: next });
    api(`/me/games/${GAME}/play`, { method: "PUT", body: { day: puzzle.day, guesses: next } }).catch(() => {});
    const settle = reduced ? 0 : 5 * 110 + 260;
    if (result === "won") {
      setTimeout(() => feel("win"), settle);
      const past = { ...readStore(HISTORY, {}), [puzzle.day]: { status: "won", tries: next.length } };
      rewardOnce(onReward, { sticker: "st-letter-seal", game: GAME, reason: "first secret word found" });
      if (next.length <= 2) rewardOnce(onReward, { sticker: "st-star", game: GAME, reason: "found in two tries" });
      if (solvedStreak(past, puzzle.day) >= 7) rewardOnce(onReward, { sticker: "st-bow", game: GAME, reason: "seven days in a row" });
    } else if (result === "lost") setTimeout(() => feel("oops"), settle);
    else feel(scoreGuess(current, answer).includes("hit") ? "good" : "place");
  }, [current, guesses, answer, puzzle.day, onReward, reduced, say]);

  const onKey = useCallback(
    (key) => {
      if (status !== "playing") return;
      if (key === "enter") return submit();
      if (key === "back") {
        if (current) feel("tap");
        return setCurrent((word) => word.slice(0, -1));
      }
      if (/^[a-z]$/.test(key) && current.length < WORD_LENGTH) {
        feel("tap");
        setCurrent((word) => (word.length < WORD_LENGTH ? word + key : word));
      }
    },
    [status, submit, current],
  );

  // A hardware keyboard works too (handy on a computer, and for accessibility).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.("input, textarea, [contenteditable='true']")) return;
      const key = event.key === "Enter" ? "enter" : event.key === "Backspace" ? "back" : event.key.toLowerCase();
      if (key === "enter" || key === "back" || /^[a-z]$/.test(key)) {
        event.preventDefault();
        onKey(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKey]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(timer);
  }, [message]);

  const done = status !== "playing";
  const streak = offline || puzzle.streak === null ? solvedStreak(history, puzzle.day) : puzzle.play?.status === "won" ? puzzle.streak : puzzle.streak + (status === "won" ? 1 : 0);

  return (
    <div className="sw-play" data-done={done || undefined}>
      <Board guesses={guesses} current={current} answer={answer} shake={shake} revealRow={revealRow} />
      <p className="sw-message" role="status" key={message?.key}>
        {message?.text ?? (status === "playing" && guesses.length === 0 ? (puzzle.by === "josh" ? "josh picked this one for you ♡" : "a word from the little tin") : "")}
      </p>
      {done ? (
        <div className="brain-done sw-done" data-status={status}>
          {status === "won" ? (
            <>
              <h3>{PRAISE[guesses.length - 1]}</h3>
              <p>
                it was <b className="sw-answer">{answer}</b>
                {streak > 1 && <> · {streak} days in a row</>}
              </p>
            </>
          ) : (
            <>
              <h3>so close, lovely</h3>
              <p>
                today’s word was <b className="sw-answer">{answer}</b>. a new one tomorrow ♡
              </p>
            </>
          )}
          {puzzle.by === "josh" && puzzle.note && (
            <p className="sw-note">
              <span>josh’s note</span>
              {puzzle.note}
            </p>
          )}
          <Spread history={history} />
          <p className="sw-tomorrow">a new secret word every day at midnight ✧</p>
        </div>
      ) : (
        <Keyboard states={states} onKey={onKey} />
      )}
    </div>
  );
}

export default function SecretWord({ onReward }) {
  const { puzzle, ready, offline } = usePuzzle();
  const admin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  return (
    <BrainGame
      id={GAME}
      className="sw-game"
      status={
        puzzle ? (
          <>
            {dayLabel(puzzle.day)}
            <small>{puzzle.by === "josh" ? "picked by josh ♡" : "from the word tin"}</small>
          </>
        ) : (
          "today’s word"
        )
      }
      tools={<AdminEdit compact label="the secret words" onClick={() => setEditing(true)} className="sw-admin" />}
      howToTitle="the secret word"
      howTo={
        <ul>
          <li>
            there’s one <b>five-letter word</b> a day. you have <b>six tries</b> to find it.
          </li>
          <li>
            <span className="sw-legend" data-state="hit">
              a<i>♥</i>
            </span>{" "}
            a plum letter with a heart is in the <b>right place</b>.
          </li>
          <li>
            <span className="sw-legend" data-state="near">
              e<i>•</i>
            </span>{" "}
            a pink letter with a dot is in the word, <b>somewhere else</b>.
          </li>
          <li>
            <span className="sw-legend" data-state="miss">
              s
            </span>{" "}
            a pale letter isn’t in the word at all.
          </li>
          <li>some days josh picks the word himself, with a little note for when you find it.</li>
        </ul>
      }
    >
      {ready ? <Play key={`${puzzle.day}:${puzzle.word}`} puzzle={puzzle} onReward={onReward} offline={offline} /> : <p className="sw-loading">opening today’s word…</p>}
      {admin && editing && (
        <Suspense fallback={null}>
          <WordAdmin open={editing} onClose={() => setEditing(false)} loadDictionary={loadDictionary} />
        </Suspense>
      )}
    </BrainGame>
  );
}
