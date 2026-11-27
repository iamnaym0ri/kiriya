import { useEffect, useMemo, useRef, useState } from "react";
import BrainGame from "../common/BrainGame.jsx";
import Hearts from "../common/Hearts.jsx";
import MaomaoSays from "../common/MaomaoSays.jsx";
import { feel } from "../common/feel.js";
import { readStore, usePageVisible, useReducedMotion, useShowWhen, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { GameSymbol, SYMBOL_NAMES } from "../../../GamePieces.jsx";
import "./herb-sequence.css";

// Herb sequence: Maomao writes a note of herbs, she studies it as long as she likes, folds it, and
// taps the herbs back in the same order. Each copied note is one herb longer (three to start; six
// kinds of herb from six on). Three hearts for the run, one peek per note, her longest note kept.

const GAME = "herb-sequence";
const SAVE = "kiriya:brain:herb-sequence";
const BEST = "kiriya:brain:herb-sequence:best";
const HEARTS = 3;
const FOUR = ["leaf", "flower", "mushroom", "bottle"];
const SIX = [...FOUR, "scroll", "cup"];

const LINES = {
  study: ["My labels have an order. Study it before you fold the note.", "Group the pictures in your head. Pairs are easier than singles.", "A longer note. Say them to yourself, in order."],
  recall: ["The note is folded. Start with the first one.", "Now, from memory. Take your time.", "No peeking at my sleeve. That's where I keep the notes."],
  pick: ["One entry down. What followed it?", "Keep the order in mind. A collection isn't a sequence.", "Continue. I'll compare the whole note at the end."],
  undo: ["A correction before submission. Sensible.", "Cross that one out, then."],
  peek: ["Here. Compare it carefully. I'll fold it again when you're ready.", "Another look costs nothing. Once."],
  wrong: ["Not quite. Look at the note again; don't throw away what you remembered.", "Right ingredients, perhaps. Wrong arrangement. Study it in smaller groups."],
  copied: ["Exactly the order I wrote. The next note is a little longer.", "A faithful record. Good."],
  over: ["That's enough copying for today. You did well; my notes are long.", "We'll stop there. My handwriting is to blame, naturally."],
};

function newNote(level, random = Math.random) {
  const length = 2 + level;
  const kinds = length >= 6 ? SIX : FOUR;
  const pattern = [];
  for (let i = 0; i < length; i++) {
    // No herb twice in a row on the short notes; the long ones may repeat (that's the trick).
    const choices = length >= 5 ? kinds : kinds.filter((k) => k !== pattern.at(-1));
    pattern.push(choices[Math.floor(random() * choices.length)]);
  }
  return { level, pattern, kinds, entered: [], phase: "study", peeked: false, wrongAt: null };
}

function newRun() {
  return { level: 1, hearts: HEARTS, note: newNote(1), event: "study", talk: 0 };
}

function restore() {
  const saved = readStore(SAVE, null);
  if (saved?.note?.pattern?.length && saved.note.phase !== "over" && Number.isInteger(saved.level)) {
    // Coming back mid-recall shows the note again: it's only fair after time away.
    const phase = saved.note.phase === "copied" ? "copied" : "study";
    return { ...saved, note: { ...saved.note, phase, entered: phase === "study" ? [] : saved.note.entered, wrongAt: null }, event: "study" };
  }
  return newRun();
}

export default function HerbSequence({ onReward }) {
  const [run, setRun] = useState(restore);
  const [best, setBest] = useState(() => readStore(BEST, 0));
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const doneCard = useRef(null);
  const { level, hearts, note } = run;
  const { pattern, entered, phase } = note;
  const over = phase === "over";
  useShowWhen(doneCard, over);

  useEffect(() => writeStore(SAVE, run), [run]);

  // A copied note makes way for the next one on its own (not while the app is in the background).
  useEffect(() => {
    if (phase !== "copied" || !visible) return undefined;
    const timer = setTimeout(() => setRun((r) => ({ ...r, level: r.level + 1, note: newNote(r.level + 1), event: "study", talk: r.talk + 1 })), reduced ? 900 : 1300);
    return () => clearTimeout(timer);
  }, [phase, visible, reduced]);

  const set = (change, event) => setRun((r) => ({ ...r, ...change(r), event, talk: r.talk + 1 }));

  const fold = () => {
    feel("tap");
    set((r) => ({ note: { ...r.note, phase: "recall", entered: [], wrongAt: null } }), "recall");
  };

  const peek = () => {
    if (note.peeked || phase !== "recall") return;
    feel("tap");
    set((r) => ({ note: { ...r.note, phase: "study", entered: [], peeked: true } }), "peek");
  };

  const undo = () => {
    if (phase !== "recall" || !entered.length) return;
    feel("tap");
    set((r) => ({ note: { ...r.note, entered: r.note.entered.slice(0, -1) } }), "undo");
  };

  const choose = (kind) => {
    if (phase !== "recall") return;
    const at = entered.length;
    const next = [...entered, kind];
    if (pattern[at] !== kind) {
      const left = hearts - 1;
      feel("oops");
      set((r) => ({ hearts: left, note: { ...r.note, entered: next, phase: left <= 0 ? "over" : "wrong", wrongAt: at } }), left <= 0 ? "over" : "wrong");
      return;
    }
    if (next.length === pattern.length) {
      feel("win");
      const length = pattern.length;
      if (length > best) {
        setBest(length);
        writeStore(BEST, length);
      }
      if (level >= 3) rewardOnce(onReward, { sticker: "st-sprig", game: GAME, reason: "three notes copied" });
      set((r) => ({ note: { ...r.note, entered: next, phase: "copied" } }), "copied");
      return;
    }
    feel("place");
    set((r) => ({ note: { ...r.note, entered: next } }), "pick");
  };

  // After a slip, the same note opens again so she can study it (the heart is already spent).
  const tryAgain = () => {
    feel("tap");
    set((r) => ({ note: { ...r.note, phase: "study", entered: [], wrongAt: null } }), "study");
  };

  const again = () => {
    feel("tap");
    setRun((r) => ({ ...newRun(), talk: r.talk + 1 }));
  };

  const line = useMemo(() => {
    const list = LINES[run.event] ?? LINES.study;
    return run.event === "study" ? list[Math.min(level - 1, list.length - 1) % list.length] : list[run.talk % list.length];
  }, [run.event, run.talk, level]);
  const expression = phase === "copied" ? "pleased" : over ? "deadpan" : phase === "study" ? "writing" : phase === "wrong" ? "thinking" : "curious";
  const showNote = phase === "study" || phase === "wrong" || over;

  return (
    <BrainGame
      id={GAME}
      className="hs-game"
      status={
        <>
          note {level}
          <Hearts left={hearts} of={HEARTS} />
        </>
      }
      howToTitle="herb sequence"
      howTo={
        <ul>
          <li>
            Maomao writes a little note of herbs. <b>study it</b> as long as you like.
          </li>
          <li>
            fold it, then tap the herbs <b>in the same order</b>.
          </li>
          <li>
            every copied note is one herb longer. a slip costs a <b>heart</b>; you have three.
          </li>
          <li>one peek per note, if you need it ♡</li>
        </ul>
      }
    >
      <div className="hs" data-phase={phase} style={{ "--len": pattern.length }}>
        <MaomaoSays expression={expression} talk={run.talk}>
          {line}
        </MaomaoSays>
        <section className="hs-note" aria-label={showNote ? "Maomao’s note" : "your copy"}>
          <p className="hs-note__label">
            {phase === "study" ? `maomao’s note · ${pattern.length} herbs` : phase === "copied" ? "a perfect copy ✧" : showNote ? "the note, and your copy" : "your copy · from the left"}
          </p>
          <ol className="hs-slots">
            {pattern.map((kind, i) => {
              const mine = entered[i];
              const showing = showNote ? kind : mine;
              return (
                <li
                  key={`${level}-${i}`}
                  className="hs-slot"
                  style={{ "--n": i }}
                  data-filled={showing ? true : undefined}
                  data-wrong={note.wrongAt === i || undefined}
                  data-right={phase === "copied" || (showNote && phase !== "study" && i < (note.wrongAt ?? 0)) || undefined}
                  aria-label={`${i + 1}: ${showing ? SYMBOL_NAMES[showing] : "empty"}`}
                >
                  {showing ? <GameSymbol kind={showing} /> : <span className="hs-slot__q" aria-hidden="true">?</span>}
                  {note.wrongAt === i && mine && (
                    <span className="hs-slot__mine" aria-label={`you picked ${SYMBOL_NAMES[mine]}`}>
                      <GameSymbol kind={mine} />
                    </span>
                  )}
                  <small aria-hidden="true">{i + 1}</small>
                </li>
              );
            })}
          </ol>
        </section>

        {over ? (
          <div className="brain-done hs-done" ref={doneCard}>
            <h3>{level > 1 ? `${level - 1} ${level === 2 ? "note" : "notes"} copied` : "a tricky first note"}</h3>
            <p>
              {best >= 3 ? `your longest note: ${best} herbs. ` : ""}
              the note is above, with the slip marked.
            </p>
            <div className="brain-done__actions">
              <button type="button" className="brain-btn" onClick={again}>
                start a new note ↺
              </button>
            </div>
          </div>
        ) : phase === "study" ? (
          <div className="hs-foot">
            <button type="button" className="brain-btn" onClick={fold}>
              fold the note · i’m ready
            </button>
          </div>
        ) : phase === "wrong" ? (
          <div className="hs-foot">
            <p className="hs-tip">the pink one slipped. you still have {hearts} {hearts === 1 ? "heart" : "hearts"} ♡</p>
            <button type="button" className="brain-btn" onClick={tryAgain}>
              study it again
            </button>
          </div>
        ) : (
          <div className="hs-foot">
            <div className="hs-choices" data-six={note.kinds.length === 6 || undefined} role="group" aria-label="pick the next herb">
              {note.kinds.map((kind) => (
                <button key={kind} type="button" className="hs-choice" disabled={phase !== "recall"} onClick={() => choose(kind)} aria-label={SYMBOL_NAMES[kind]}>
                  <GameSymbol kind={kind} />
                  <small aria-hidden="true">{SYMBOL_NAMES[kind]}</small>
                </button>
              ))}
            </div>
            <div className="brain-actions">
              <button type="button" className="brain-action" onClick={undo} disabled={phase !== "recall" || !entered.length}>
                ↺ undo
              </button>
              <button type="button" className="brain-action" onClick={peek} disabled={phase !== "recall" || note.peeked}>
                {note.peeked ? "peeked ✓" : "✧ one peek"}
              </button>
            </div>
          </div>
        )}
      </div>
    </BrainGame>
  );
}
