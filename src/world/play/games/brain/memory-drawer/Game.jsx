import { useEffect, useMemo, useRef, useState } from "react";
import BrainGame from "../common/BrainGame.jsx";
import MaomaoSays from "../common/MaomaoSays.jsx";
import { feel } from "../common/feel.js";
import { readStore, shuffle, usePageVisible, useReducedMotion, useShowWhen, writeStore } from "../common/hooks.js";
import { rewardOnce } from "../common/rewards.js";
import { GameSymbol, SYMBOL_NAMES } from "../../../GamePieces.jsx";
import "./memory-drawer.css";

// Maomao's memory drawer: her apothecary cabinet, every drawer holding one of a pair. Three sizes
// (4, 6 and 8 pairs), the fewest tries kept for each, and a mismatched pair closes by itself after a
// moment (or the instant she opens another drawer). A cabinet in progress survives leaving the game.

const GAME = "memory-drawer";
const SAVE = "kiriya:brain:memory-drawer";
const SIZES = {
  cosy: { pairs: 4, label: "cosy", hint: "4 pairs" },
  gentle: { pairs: 6, label: "gentle", hint: "6 pairs" },
  tricky: { pairs: 8, label: "tricky", hint: "8 pairs" },
};
const KINDS = ["leaf", "flower", "bottle", "mushroom", "scroll", "cup", "mortar", "lantern"];
const NAMES = { ...SYMBOL_NAMES, mortar: "mortar and pestle", lantern: "paper lantern" };
const PEEK_MS = 900;

const LINES = {
  welcome: ["More drawers today. I expect the herbs back in the correct places.", "Remember the labels. An unlabelled drawer is a nuisance."],
  first: ["One observation. Rather early for a conclusion.", "Hm. Set that detail aside. We may need it.", "Remember where that one was."],
  match: ["Same contents. They belong together.", "That agrees with what we saw earlier. Good.", "A pair. Keep the labels facing outward."],
  miss: ["Different contents. Remember where they were; that wasn't a useless observation.", "A reasonable guess. The evidence disagrees.", "Not a pair. Don't mix them just because the drawers look alike."],
  done: ["Every pair accounted for. Now I can find my herbs without opening every drawer.", "A tidy cabinet. I may let you near the poison shelf next."],
  herbFirst: ["Oh, the herb drawer! Look at the leaves… right. We're finding pairs."],
  herbMatch: ["Both herb bundles! Excellent. I'll just examine these a little longer."],
  bottleFirst: ["A specimen bottle…! There should be another with the same label."],
  bottleMatch: ["Matching specimen labels. May I keep these on my shelf?"],
};

function Extra({ kind }) {
  // Two more drawers' worth of things for the big cabinet, in GameSymbol's style.
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="game-symbol">
      {kind === "mortar" ? (
        <>
          <path d="M28 8l9-4" stroke="#a29076" strokeWidth="4" strokeLinecap="round" />
          <path d="M26 10l3 14" stroke="#c9b48f" strokeWidth="5" strokeLinecap="round" />
          <path d="M7 24h34q-2 15-17 15T7 24Z" fill="#e7e0cf" stroke="#8e9b8b" strokeWidth="2" />
          <ellipse cx="24" cy="24" rx="17" ry="4" fill="#bec9ab" stroke="#8e9b8b" strokeWidth="1.6" />
          <path d="M18 40h12" stroke="#8e9b8b" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M24 4v5M19 9h10M19 39h10M24 39v6" stroke="#9b6f8f" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M18 11q-11 5-9 17 2 8 9 10h12q7-2 9-10 2-12-9-17Z" fill="#f6b3c6" stroke="#b9677f" strokeWidth="2" />
          <path d="M20 12q-6 13 0 26m8-26q6 13 0 26M10 22h28M10 30h28" stroke="#d98aa0" strokeWidth="1.2" fill="none" />
        </>
      )}
    </svg>
  );
}
const Picture = ({ kind }) => (kind === "mortar" || kind === "lantern" ? <Extra kind={kind} /> : <GameSymbol kind={kind} />);

function newCabinet(size) {
  const kinds = shuffle(KINDS).slice(0, SIZES[size].pairs);
  return { size, cards: shuffle([...kinds, ...kinds]), open: [], found: [], tries: 0, event: "welcome", talk: 0, last: null };
}

function restore() {
  const saved = readStore(SAVE, null);
  const size = SIZES[saved?.cabinet?.size] ? saved.cabinet.size : "cosy";
  const cabinet = saved?.cabinet?.cards?.length === SIZES[size].pairs * 2 ? { ...saved.cabinet, open: [] } : newCabinet(size);
  return { cabinet, best: saved?.best ?? {} };
}

export default function MemoryDrawer({ onReward }) {
  const [state, setState] = useState(restore);
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const closing = useRef(null);
  const { cabinet, best } = state;
  const { size, cards, open, found, tries } = cabinet;
  const pairs = SIZES[size].pairs;
  const done = found.length === cards.length;
  const missed = open.length === 2 && cards[open[0]] !== cards[open[1]];
  const doneCard = useRef(null);
  useShowWhen(doneCard, done);

  useEffect(() => writeStore(SAVE, { ...state, cabinet: { ...state.cabinet, open: [] } }), [state]);

  // A mismatched pair closes by itself after a moment (not while the app is in the background).
  useEffect(() => {
    if (!missed || !visible) return undefined;
    closing.current = setTimeout(() => setState((s) => ({ ...s, cabinet: { ...s.cabinet, open: [] } })), reduced ? PEEK_MS + 300 : PEEK_MS);
    return () => clearTimeout(closing.current);
  }, [missed, visible, reduced]);

  const flip = (index) => {
    if (done || found.includes(index) || open.includes(index)) return;
    // Opening a third drawer closes a mismatched pair at once: no waiting for her quick fingers.
    const already = missed ? [] : open;
    const next = already.length === 2 ? [index] : [...already, index];
    let { found: nextFound, tries: nextTries } = cabinet;
    let event = "first";
    if (next.length === 2) {
      nextTries += 1;
      if (cards[next[0]] === cards[next[1]]) {
        nextFound = [...nextFound, ...next];
        event = nextFound.length === cards.length ? "done" : "match";
      } else event = "miss";
    }
    feel(event === "done" ? "win" : event === "match" ? "good" : event === "miss" ? "oops" : "tap");
    const nextOpen = event === "match" || event === "done" ? [] : next;
    setState((s) => {
      const finished = event === "done";
      const previous = s.best[size];
      return {
        ...s,
        best: finished ? { ...s.best, [size]: previous ? Math.min(previous, nextTries) : nextTries } : s.best,
        cabinet: { ...s.cabinet, open: nextOpen, found: nextFound, tries: nextTries, event, last: cards[index], talk: s.cabinet.talk + 1 },
      };
    });
    if (event === "done") {
      if (pairs === 4) rewardOnce(onReward, { sticker: "st-bottle", game: GAME, reason: "four pairs found" });
      if (pairs >= 6) rewardOnce(onReward, { sticker: "st-mirror", game: GAME, reason: "six pairs found" });
    }
  };

  const restart = (nextSize = size) => {
    feel("tap");
    clearTimeout(closing.current);
    setState((s) => ({ ...s, cabinet: { ...newCabinet(nextSize), talk: s.cabinet.talk + 1 } }));
  };

  const line = useMemo(() => {
    const { event, last, talk } = cabinet;
    const special = (event === "first" || event === "match") && (last === "leaf" ? "herb" : last === "bottle" ? "bottle" : null);
    const list = special ? LINES[`${special}${event === "first" ? "First" : "Match"}`] : LINES[event] ?? LINES.welcome;
    return list[talk % list.length];
  }, [cabinet]);
  const studying = cabinet.event === "first" || cabinet.event === "match";
  const expression =
    studying && cabinet.last === "leaf" ? "herb" : studying && cabinet.last === "bottle" ? "poison" : done || cabinet.event === "match" ? "pleased" : "thinking";
  const rows = (pairs * 2) / 4;

  return (
    <BrainGame
      id={GAME}
      className="md-game"
      status={
        <>
          {found.length / 2} of {pairs} pairs
          <small>
            {tries} {tries === 1 ? "try" : "tries"}
            {best[size] ? ` · best ${best[size]}` : ""}
          </small>
        </>
      }
      howToTitle="memory drawer"
      howTo={
        <ul>
          <li>
            every drawer in Maomao’s cabinet has <b>a twin</b>. open two at a time to find the pairs.
          </li>
          <li>a pair stays open. two that don’t match close again, so remember what was where.</li>
          <li>
            find them all in as few <b>tries</b> as you can. bigger cabinets above ✿
          </li>
        </ul>
      }
    >
      <div className="md" data-done={done || undefined} style={{ "--rows": rows }}>
        <div className="brain-choice md-sizes" role="group" aria-label="cabinet size">
          {Object.entries(SIZES).map(([id, each]) => (
            <button key={id} type="button" aria-pressed={id === size} onClick={() => id !== size && restart(id)}>
              {each.label}
              <small>{each.hint}</small>
            </button>
          ))}
        </div>
        <MaomaoSays expression={expression} talk={cabinet.talk}>
          {line}
        </MaomaoSays>
        <div className="md-board" role="grid" aria-label={`${cards.length} drawers`}>
          {cards.map((kind, index) => {
            const isFound = found.includes(index);
            const shown = isFound || open.includes(index);
            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                className="md-card"
                data-open={shown || undefined}
                data-found={isFound || undefined}
                data-miss={missed && open.includes(index) ? true : undefined}
                aria-label={`drawer ${index + 1}: ${shown ? NAMES[kind] : "closed"}${isFound ? ", paired" : ""}`}
                disabled={isFound || done}
                onClick={() => flip(index)}
              >
                <span className="md-card__inner">
                  <span className="md-card__front" aria-hidden="true">
                    <span className="md-card__handle" />
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </span>
                  <span className="md-card__back" aria-hidden="true">
                    <Picture kind={kind} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {done ? (
          <div className="brain-done md-done" ref={doneCard}>
            <h3>every drawer sorted ♡</h3>
            <p>
              {pairs} pairs in {tries} {tries === 1 ? "try" : "tries"}
              {best[size] === tries ? " · your best yet" : best[size] ? ` · best ${best[size]}` : ""}
            </p>
            <div className="brain-done__actions">
              <button type="button" className="brain-btn" onClick={() => restart()}>
                mix them again ✿
              </button>
              {size !== "tricky" && (
                <button type="button" className="brain-btn brain-btn--soft" onClick={() => restart(size === "cosy" ? "gentle" : "tricky")}>
                  a bigger cabinet
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="brain-actions md-foot">
            <button type="button" className="brain-action" onClick={() => restart()} disabled={!tries && !open.length}>
              ↺ mix the drawers
            </button>
          </div>
        )}
      </div>
    </BrainGame>
  );
}
