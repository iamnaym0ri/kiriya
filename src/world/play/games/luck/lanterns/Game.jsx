import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ConfettiCanvas, LuckStage, Sparkle, StatusBar } from "../_kit/parts.jsx";
import { haptic, useLuck, useLuckAction, usePageVisible, useReducedMotion, useStageSize } from "../_kit/hooks.js";
import { play } from "../_kit/sound.js";
import { celebrate } from "../_kit/celebrate.js";
import { GOLDEN_CHANCE, PICKS_PER_SKY, lanternAt, newSky } from "./logic.js";
import "./lanterns.css";

const HELP = {
  game: "lanterns",
  steps: [
    ["lantern", "tap a lantern to catch the wish it carries"],
    ["3", "catch three and keep their wishes"],
    ["coin", "a golden one sometimes carries a spare capsule coin"],
  ],
};
const TINTS = {
  peach: ["#ffe2c2", "#ffb98a"],
  rose: ["#ffe0ec", "#ff9fc6"],
  lilac: ["#efe2ff", "#c9a8f5"],
  sky: ["#e6f2ff", "#9cc9f5"],
  golden: ["#fff6cf", "#ffc33d"],
};
const LANTERN_W = 58;
const LANTERN_H = 80;

function LanternArt({ tint, id }) {
  const [light, deep] = TINTS[tint] ?? TINTS.peach;
  return (
    <svg viewBox="0 0 58 80" aria-hidden="true" className="lantern-art">
      <defs>
        <radialGradient id={`lantern-${id}`} cx="50%" cy="58%" r="60%">
          <stop offset="0" stopColor="#fffdf2" />
          <stop offset=".45" stopColor={light} />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
        <radialGradient id={`lantern-glow-${id}`}>
          <stop offset="0" stopColor={light} stopOpacity=".9" />
          <stop offset=".55" stopColor={deep} stopOpacity=".35" />
          <stop offset="1" stopColor={deep} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="29" cy="40" rx="34" ry="38" fill={`url(#lantern-glow-${id})`} className="lantern-art__halo" />
      <rect x="20" y="6" width="18" height="6" rx="3" fill="#7e5a92" stroke="#4a2f57" strokeWidth="2" />
      <path d="M12 26c0-9 7-14 17-14s17 5 17 14v18c0 10-7 18-17 18S12 54 12 44z" fill={`url(#lantern-${id})`} stroke="#4a2f57" strokeWidth="2.4" />
      <path d="M29 13v49M20 15c-4 10-4 34 0 45M38 15c4 10 4 34 0 45" stroke={deep} strokeWidth="1.6" fill="none" opacity=".9" />
      <rect x="21" y="61" width="16" height="6" rx="3" fill="#7e5a92" stroke="#4a2f57" strokeWidth="2" />
      <path d="M29 67v8" stroke="#4a2f57" strokeWidth="2" strokeLinecap="round" />
      <circle cx="29" cy="76" r="2.6" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="1.4" />
      <path d="M18 28c1-5 4-8 8-10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".85" />
      {tint === "golden" && (
        <g fill="#fff">
          <path d="M46 10l1.4 3.6 3.6 1.4-3.6 1.4L46 20l-1.4-3.6L41 15l3.6-1.4z" />
          <path d="M9 50l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
        </g>
      )}
    </svg>
  );
}

function Hills() {
  return (
    <svg className="lanterns-hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 70c60-30 120-34 180-14s130 10 220-26v90H0z" fill="#8d6aa8" />
      <path d="M0 92c80-24 150-20 220-4s120 8 180-10v42H0z" fill="#6f4f8c" />
      <path d="M0 108h400v12H0z" fill="#5e4179" />
      <path d="M40 112h60M160 114h90M290 111h50" stroke="#ffd9a8" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export default function LanternsGame({ onReward }) {
  const luck = useLuck();
  const claimCoin = useLuckAction("lantern-coin");
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const skyRef = useRef(null);
  const confettiRef = useRef(null);
  const sky = useStageSize(skyRef);
  const nodes = useRef(new Map());
  const clock = useRef({ t: 0, last: 0 });
  const frame = useRef(0);

  const coinToday = luck.data?.lanterns?.coinToday ?? true;
  const [round, setRound] = useState(0);
  const [used, setUsed] = useState([]);
  const lanterns = useMemo(
    () => newSky(Math.random, { count: 7, golden: !coinToday && Math.random() < GOLDEN_CHANCE, usedWishes: used }),
    // A sky is made once per round; later changes to `used` or the coin wait for the next sky.
    [round, luck.isSuccess], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [caught, setCaught] = useState([]); // lantern ids caught this sky
  const [picks, setPicks] = useState([]); // { text, kind }
  const [card, setCard] = useState(null);
  const done = picks.length >= PICKS_PER_SKY && !card;

  const place = useCallback(() => {
    const { width, height } = sky;
    if (!width) return;
    lanterns.forEach((lantern, index) => {
      const node = nodes.current.get(lantern.id);
      if (!node) return;
      // Reduced motion: the lanterns hang still, spread down the sky above the hills.
      const at = reduced
        ? { x: lantern.x, y: 0.12 + ((index * 3) % lanterns.length) / lanterns.length * 0.6, swayX: 0, tilt: 0 }
        : lanternAt(lantern, clock.current.t);
      const x = at.x * (width - LANTERN_W) + at.swayX;
      const y = at.y * height - LANTERN_H / 2;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${at.tilt.toFixed(1)}deg) scale(${lantern.size.toFixed(2)})`;
    });
  }, [lanterns, sky, reduced]);

  useLayoutEffect(() => {
    place();
    if (reduced || !visible || done) return undefined;
    clock.current.last = performance.now();
    const tick = (now) => {
      clock.current.t += Math.min(0.05, (now - clock.current.last) / 1000);
      clock.current.last = now;
      place();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [place, reduced, visible, done]);

  const catchLantern = async (lantern) => {
    if (card || done || caught.includes(lantern.id)) return;
    setCaught((list) => [...list, lantern.id]);
    play(lantern.kind === "golden" ? "sparkle" : "chime");
    haptic(lantern.kind === "golden" ? "success" : "light");
    if (lantern.kind === "golden") {
      setCard({ kind: "loading", text: "" });
      try {
        const data = await claimCoin.mutateAsync({});
        if (data.granted) {
          setCard({ kind: "coin", text: "it carried a spare capsule coin: one more turn at charm capsules today ✦" });
          celebrate(confettiRef.current, { y: 0.4 });
          play("fanfare");
          if (data.coins === 1) onReward?.({ sticker: "st-lantern", game: "lanterns", reason: "first golden lantern" });
          return;
        }
      } catch {
        // No coin this time; the golden lantern still carries a wish.
      }
      setCard({ kind: "golden", text: lantern.wish });
      return;
    }
    setCard({ kind: "wish", text: lantern.wish });
  };

  const keep = () => {
    if (!card || card.kind === "loading") return;
    setPicks((list) => [...list, card]);
    if (card.kind !== "coin") setUsed((list) => [...list, card.text].slice(-20));
    setCard(null);
    play("tick");
  };

  const again = () => {
    setPicks([]);
    setCaught([]);
    clock.current.t = 0;
    setRound((n) => n + 1);
    play("whoosh");
  };

  return (
    <LuckStage className="lanterns-game" aria-label="wishing lanterns">
      <StatusBar help={HELP}>
        <span className="luck-chip lanterns-count" aria-label={`${picks.length} of ${PICKS_PER_SKY} lanterns caught`}>
          {Array.from({ length: PICKS_PER_SKY }, (_, i) => (
            <span key={i} data-on={i < picks.length} aria-hidden="true" />
          ))}
          {done ? "all caught" : `catch ${PICKS_PER_SKY - picks.length}`}
        </span>
        {luck.data?.lanterns?.coinToday && <span className="luck-chip"><Sparkle size={11} /> coin found</span>}
      </StatusBar>

      <div className="lanterns-sky" ref={skyRef}>
        <div className="lanterns-stars" aria-hidden="true" />
        <Hills />
        {!done && lanterns.map((lantern) => (
          <button
            key={`${round}-${lantern.id}`}
            ref={(node) => {
              if (node) nodes.current.set(lantern.id, node);
              else nodes.current.delete(lantern.id);
            }}
            type="button"
            className="lantern"
            data-caught={caught.includes(lantern.id)}
            data-kind={lantern.kind}
            disabled={Boolean(card) || caught.includes(lantern.id)}
            aria-label={lantern.kind === "golden" ? "a golden lantern" : "a lantern"}
            onClick={() => catchLantern(lantern)}
          >
            <LanternArt tint={lantern.kind === "golden" ? "golden" : lantern.tint} id={`${round}-${lantern.id}`} />
          </button>
        ))}
        {!done && !card && picks.length === 0 && (
          <p className="lanterns-hint luck-hand">tap a lantern to catch its wish</p>
        )}
      </div>

      {card && (
        <div className="lanterns-card" role="dialog" aria-modal="true" aria-labelledby="lanterns-card-title" data-kind={card.kind}>
          <div className="lanterns-card__paper">
            <span className="luck-pixel" id="lanterns-card-title">
              {card.kind === "coin" ? "a golden lantern!" : card.kind === "golden" ? "a golden wish" : "a wish for you"}
            </span>
            {card.kind === "loading" ? (
              <p className="lanterns-card__text">…</p>
            ) : (
              <p className="lanterns-card__text">{card.text}</p>
            )}
            <button type="button" className="luck-btn" onClick={keep} disabled={card.kind === "loading"} autoFocus>keep it ♡</button>
          </div>
        </div>
      )}

      {done && (
        <div className="lanterns-done">
          <h2 className="luck-hand">tonight's wishes</h2>
          <ul>
            {picks.map((pick, i) => (
              <li key={i} data-kind={pick.kind}>{pick.text}</li>
            ))}
          </ul>
          <button type="button" className="luck-btn" onClick={again}>release another sky <Sparkle size={13} /></button>
        </div>
      )}
      <ConfettiCanvas ref={confettiRef} />
    </LuckStage>
  );
}
