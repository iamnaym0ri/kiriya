import { useEffect, useRef, useState } from "react";
import { ConfettiCanvas, LuckStage, StatusBar } from "../_kit/parts.jsx";
import { haptic, useLuck, useSaveBest, usePageVisible, useReducedMotion, useStageSize } from "../_kit/hooks.js";
import { play } from "../_kit/sound.js";
import { celebrate } from "../_kit/celebrate.js";
import { LIVES, MILESTONES, applySwaps, followCharm, planSwaps, roundSettings, swapDuration } from "./logic.js";
import "./cups.css";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CHEERS = ["there it is!", "sharp eyes ♡", "you followed it perfectly", "yay, found it!", "nothing gets past you"];
const MISSES = ["so close! it was this one ♡", "sneaky little star. it was here", "almost! it was hiding here"];

function Cup() {
  return (
    <svg className="cup-art" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M77 46c12-2 17 10 9 18-3 3-8 4-12 3" fill="none" stroke="#4a2f57" strokeWidth="4" strokeLinecap="round" />
      <path d="M14 88c0-36 12-62 36-62s36 26 36 62z" fill="#dcc8f1" stroke="#4a2f57" strokeWidth="4" strokeLinejoin="round" />
      <path d="M20 66c18 6 42 6 60 0" stroke="#ff9fc6" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M50 52c-3-5-10-4-9 1 0 3 9 7 9 7s9-4 9-7c1-5-6-6-9-1z" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="2" strokeLinejoin="round" />
      <path d="M25 70c0-14 4-28 12-36" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".8" />
      <rect x="34" y="16" width="32" height="12" rx="5" fill="#c9aeea" stroke="#4a2f57" strokeWidth="4" />
      <ellipse cx="50" cy="88" rx="38" ry="6" fill="#c9aeea" stroke="#4a2f57" strokeWidth="4" />
    </svg>
  );
}

function StarCharm() {
  return (
    <svg className="cup-charm" viewBox="0 0 60 60" aria-hidden="true">
      <ellipse cx="30" cy="54" rx="18" ry="4" fill="#5b3d6b" opacity=".18" />
      <path d="M30 6l7 15 16 2-12 11 3 16-14-8-14 8 3-16L7 23l16-2z" fill="#ffd166" stroke="#4a2f57" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="25" cy="29" r="2" fill="#4a2f57" />
      <circle cx="35" cy="29" r="2" fill="#4a2f57" />
      <path d="M27 34q3 2.4 6 0" stroke="#4a2f57" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="21" cy="33" rx="2.6" ry="1.6" fill="#ffa4c9" />
      <ellipse cx="39" cy="33" rx="2.6" ry="1.6" fill="#ffa4c9" />
    </svg>
  );
}

function Hearts({ lives }) {
  return (
    <span className="luck-chip cups-hearts" aria-label={`${lives} of ${LIVES} hearts left`}>
      {Array.from({ length: LIVES }, (_, i) => (
        <svg key={i} viewBox="0 0 24 22" width="18" height="17" aria-hidden="true" data-full={i < lives}>
          <path d="M12 20C5 14 1.5 10.5 1.5 6.5 1.5 3.7 3.7 1.5 6.5 1.5c2.2 0 4 1.2 5.5 3 1.5-1.8 3.3-3 5.5-3 2.8 0 5 2.2 5 5 0 4-3.5 7.5-10.5 13.5z" />
        </svg>
      ))}
    </span>
  );
}

export default function CupsGame({ onReward }) {
  const luck = useLuck();
  const saveBest = useSaveBest();
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const tableRef = useRef(null);
  const confettiRef = useRef(null);
  const table = useStageSize(tableRef);
  const cupNodes = useRef([]);
  const running = useRef([]);
  const alive = useRef(true);

  const [round, setRound] = useState(1);
  const [lives, setLives] = useState(LIVES);
  const settings = roundSettings(round);
  const [slotOf, setSlotOf] = useState(() => Array.from({ length: settings.cups }, (_, i) => i));
  const [charmCup, setCharmCup] = useState(1);
  const [phase, setPhase] = useState("ready"); // ready | hiding | shuffling | pick | lifted | over
  const [lifted, setLifted] = useState([]);
  const [line, setLine] = useState("watch the little star, then follow its cup");
  const [cleared, setCleared] = useState(0);
  const best = luck.data?.best?.cups ?? 0;
  const knownBest = useRef(0);
  knownBest.current = Math.max(knownBest.current, best);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Pause the shuffle while she's away; it carries on exactly where it was.
  useEffect(() => {
    for (const animation of running.current) {
      if (visible) animation.play();
      else animation.pause();
    }
  }, [visible]);

  const cups = slotOf.length;
  const width = table.width || 360;
  const cupSize = Math.min(104, (width - 24) / (cups + 0.5));
  const slotX = (slot) => (width * (slot + 1)) / (cups + 1) - cupSize / 2;

  const record = async (value) => {
    if (value <= knownBest.current) return;
    knownBest.current = value;
    try {
      const data = await saveBest.mutateAsync({ game: "cups", streak: value });
      for (const milestone of MILESTONES) {
        if (data.previous < milestone.round && data.best >= milestone.round) {
          onReward?.({ sticker: milestone.sticker, game: "cups", reason: milestone.reason });
        }
      }
    } catch {
      // A best that didn't save will be saved next time she beats it.
    }
  };

  const start = async () => {
    if (phase !== "ready") return;
    setLine("");
    setLifted([]);
    setPhase("hiding");
    play("lift");
    await wait(reduced ? 150 : 420);
    setPhase("shuffling");
    const charmSlot = slotOf[charmCup];
    const plan = planSwaps(settings, charmSlot, Math.random);
    let current = [...slotOf];
    for (const [a, b] of plan) {
      if (!alive.current) return;
      const ca = current.indexOf(a);
      const cb = current.indexOf(b);
      const duration = swapDuration(settings.swapMs, a, b);
      const nodeA = cupNodes.current[ca];
      const nodeB = cupNodes.current[cb];
      const xa = slotX(a);
      const xb = slotX(b);
      const lift = reduced ? 0 : 12 + Math.abs(a - b) * 6;
      play("tick");
      const front = nodeA?.animate(
        [
          { transform: `translateX(${xa}px)`, zIndex: 3 },
          { transform: `translateX(${(xa + xb) / 2}px) translateY(${lift}px) scale(${reduced ? 1 : 1.06})`, zIndex: 3 },
          { transform: `translateX(${xb}px)`, zIndex: 3 },
        ],
        { duration, easing: "ease-in-out" },
      );
      const back = nodeB?.animate(
        [
          { transform: `translateX(${xb}px)`, zIndex: 1 },
          { transform: `translateX(${(xa + xb) / 2}px) translateY(${-lift}px) scale(${reduced ? 1 : 0.94})`, zIndex: 1 },
          { transform: `translateX(${xa}px)`, zIndex: 1 },
        ],
        { duration, easing: "ease-in-out" },
      );
      running.current = [front, back].filter(Boolean);
      if (!visible) running.current.forEach((animation) => animation.pause());
      current = applySwaps(current, [[a, b]]);
      if (nodeA) nodeA.style.transform = `translateX(${xb}px)`;
      if (nodeB) nodeB.style.transform = `translateX(${xa}px)`;
      await Promise.all(running.current.map((animation) => animation.finished.catch(() => {})));
      running.current = [];
      await wait(40);
    }
    if (!alive.current) return;
    setSlotOf(current);
    if (followCharm(charmSlot, plan) !== current[charmCup]) console.warn("cups: lost track of the charm");
    setPhase("pick");
    setLine("where's the little star?");
    haptic("light");
  };

  const pick = async (cup) => {
    if (phase !== "pick") return;
    setPhase("lifted");
    setLifted([cup]);
    play("lift");
    if (cup === charmCup) {
      haptic("success");
      play("yay");
      setLine(CHEERS[(round - 1) % CHEERS.length]);
      setCleared(round);
      if (round % 5 === 0) celebrate(confettiRef.current, { y: 0.5, big: round % 10 === 0 });
      record(round);
      await wait(1100);
      if (!alive.current) return;
      const next = round + 1;
      const nextCups = roundSettings(next).cups;
      if (nextCups !== cups) {
        // A fourth cup joins: everyone moves over to make room.
        setSlotOf(Array.from({ length: nextCups }, (_, i) => i));
        setCharmCup(Math.floor(nextCups / 2));
      }
      setRound(next);
      setPhase("ready");
      setLine(nextCups !== cups ? "a fourth cup joins the table ✿" : `round ${next}: a little faster`);
    } else {
      haptic("warning");
      play("soft");
      await wait(450);
      if (!alive.current) return;
      setLifted([cup, charmCup]);
      setLine(MISSES[(round + lives) % MISSES.length]);
      const left = lives - 1;
      setLives(left);
      await wait(1300);
      if (!alive.current) return;
      if (left <= 0) {
        setPhase("over");
        record(cleared);
        setLine("");
      } else {
        setPhase("ready");
        setLine("same speed again, you've got this");
      }
    }
  };

  const restart = () => {
    setRound(1);
    setLives(LIVES);
    setCleared(0);
    setSlotOf([0, 1, 2]);
    setCharmCup(1);
    setLifted([]);
    setPhase("ready");
    setLine("watch the little star, then follow its cup");
  };

  // While she watches (ready) every cup is up, so she sees where the star starts.
  const isLifted = (cup) => phase === "ready" ? cup === charmCup : lifted.includes(cup);

  return (
    <LuckStage className="cups-game" aria-label="teacup shuffle">
      <StatusBar>
        <Hearts lives={lives} />
        <span className="luck-chip">round {round}</span>
        {best > 0 && <span className="luck-chip"><small>BEST</small> {best}</span>}
      </StatusBar>

      <div className="cups-table" ref={tableRef} style={{ "--cup": `${cupSize}px` }}>
        <div className="cups-cloth" aria-hidden="true" />
        <div className="cups-row" role="group" aria-label="teacups">
          {slotOf.map((slot, cup) => (
            <button
              key={`${cups}-${cup}`}
              ref={(node) => { cupNodes.current[cup] = node; }}
              type="button"
              className="cups-cup"
              style={{ transform: `translateX(${slotX(slot)}px)` }}
              data-lifted={isLifted(cup)}
              data-pickable={phase === "pick"}
              disabled={phase !== "pick"}
              aria-label={`cup ${slot + 1}`}
              onClick={() => pick(cup)}
            >
              {cup === charmCup && <StarCharm />}
              <span className="cups-cup__body"><Cup /></span>
            </button>
          ))}
        </div>
      </div>

      <div className="cups-foot" role="status" aria-live="polite">
        {phase === "over" ? (
          <>
            <p className="luck-hand cups-line">
              {cleared ? `you followed the star through ${cleared} ${cleared === 1 ? "round" : "rounds"} ♡` : "the star was extra sneaky today ♡"}
              <small>{cleared >= best && cleared > 0 ? "your best yet!" : `your best: ${Math.max(best, cleared)}`}</small>
            </p>
            <button type="button" className="luck-btn" onClick={restart}>play again</button>
          </>
        ) : (
          <>
            <p className="luck-hand cups-line">{line || " "}</p>
            {phase === "ready" && <button type="button" className="luck-btn" onClick={start}>{round === 1 && lives === LIVES ? "start shuffling" : "shuffle!"}</button>}
          </>
        )}
      </div>
      <ConfettiCanvas ref={confettiRef} />
    </LuckStage>
  );
}
