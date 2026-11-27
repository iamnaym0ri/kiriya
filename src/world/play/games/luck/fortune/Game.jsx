import { useEffect, useRef, useState } from "react";
import { ConfettiCanvas, LuckStage, Panel, Sparkle, StatusBar, untilTomorrow } from "../_kit/parts.jsx";
import { haptic, useLuck, useLuckAction, useReducedMotion, useStageSize } from "../_kit/hooks.js";
import { play } from "../_kit/sound.js";
import { celebrate } from "../_kit/celebrate.js";
import "./fortune.css";

const SWATCHES = {
  lilac: "#c9a8f5", "butter yellow": "#ffdc7d", "strawberry-milk pink": "#ffb3cf", mint: "#97dcc8", "cloud white": "#fbf8ff",
  plum: "#8e4f8f", "sky blue": "#9cc9f5", peach: "#ffc29f", "lavender grey": "#b9abc9", "sakura pink": "#ffd0de",
  "matcha green": "#a9c98a", "midnight blue": "#3b4a8c",
};
const HELP = {
  game: "fortune",
  steps: [
    ["✦", "shake the tin for today's little slip (one a day)"],
    ["♡", "untie the ribbon to unfold it"],
    ["✿", "every slip is kept in your keepsakes"],
  ],
};
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const stamp = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} · ${MONTHS[m - 1]} · ${y}`;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Tin({ shaking, onShake, disabled }) {
  return (
    <button type="button" className="fortune-tin" data-shaking={shaking} onClick={onShake} disabled={disabled} aria-label="shake the fortune tin for today's slip">
      <svg viewBox="0 0 160 200" aria-hidden="true">
        <ellipse cx="80" cy="190" rx="58" ry="7" fill="#5b3d6b" opacity=".12" />
        <path d="M30 40h100l10 140c0 6-4 10-10 10H30c-6 0-10-4-10-10z" fill="#dcc8f1" stroke="#4a2f57" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M55 40h50l6 150H49z" fill="#e9dcf6" />
        <path d="M30 40h100l10 140c0 6-4 10-10 10H30c-6 0-10-4-10-10z" fill="none" stroke="#4a2f57" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M55 40l-6 150M105 40l6 150" stroke="#b79bd0" strokeWidth="2" />
        <ellipse cx="80" cy="40" rx="50" ry="12" fill="#c9aeea" stroke="#4a2f57" strokeWidth="3" />
        <ellipse cx="80" cy="38" rx="7" ry="3.4" fill="#3d2649" />
        <rect x="50" y="88" width="60" height="64" rx="8" fill="#fff9fd" stroke="#4a2f57" strokeWidth="2.6" />
        <text x="80" y="110" textAnchor="middle" fontSize="11" fill="#6b4a7a" fontFamily="DotGothic16, monospace" letterSpacing="1">LITTLE</text>
        <text x="80" y="127" textAnchor="middle" fontSize="11" fill="#6b4a7a" fontFamily="DotGothic16, monospace" letterSpacing="1">LUCK</text>
        <path d="M80 147c-3-4-9-3-8 1 0 3 8 6 8 6s8-3 8-6c1-4-5-5-8-1z" transform="translate(0 -8)" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="1.6" />
        <g transform="rotate(12 80 38)">
          <rect x="76" y="6" width="10" height="34" rx="2" fill="#fffaf3" stroke="#4a2f57" strokeWidth="2.2" />
          <path d="M78.5 12h5M78.5 17h5" stroke="#c9a8f5" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <ellipse cx="80" cy="40" rx="50" ry="12" fill="none" stroke="#4a2f57" strokeWidth="3" />
        <path d="M34 60c2-6 6-10 12-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".85" />
        {[[38, 160], [124, 70], [128, 160]].map(([x, y]) => (
          <path key={x + y} transform={`translate(${x} ${y})`} d="M0-5c.6 3 1.8 4.4 5 5-3.2.6-4.4 2-5 5-.6-3-1.8-4.4-5-5 3.2-.6 4.4-2 5-5z" fill="#fff" />
        ))}
      </svg>
    </button>
  );
}

function Swatch({ colour }) {
  return <span className="fortune-swatch" style={{ background: SWATCHES[colour] ?? "#c9a8f5" }} aria-hidden="true" />;
}

/** The slip itself: three panels that fold over each other, tied with a ribbon until she opens it. */
function Slip({ fortune, number, state, onOpen }) {
  const folded = state === "folded" || state === "landing";
  return (
    <div className="fortune-slip" data-state={state}>
      <div className="fortune-slip__panel fortune-slip__panel--top">
        <div className="fortune-slip__face">
          <div className="fortune-slip__meta">
            <span className="luck-pixel">fortune no. {number}</span>
            <span className="luck-pixel">{stamp(fortune.day)}</span>
          </div>
          <div className="fortune-slip__level">
            <span className="fortune-seal" lang="ja">{fortune.level.kanji}</span>
            <span className="fortune-slip__label">{fortune.level.label}</span>
          </div>
        </div>
        <div className="fortune-slip__back" aria-hidden="true">
          <span className="fortune-slip__back-note">for you ♡<small>{stamp(fortune.day)}</small></span>
        </div>
      </div>
      <div className="fortune-slip__panel fortune-slip__panel--middle">
        <div className="fortune-slip__face">
          <p className="fortune-slip__text">{fortune.text}</p>
        </div>
      </div>
      <div className="fortune-slip__panel fortune-slip__panel--bottom">
        <div className="fortune-slip__face">
          <dl className="fortune-slip__lucky">
            <div><dt>lucky colour</dt><dd><Swatch colour={fortune.colour} />{fortune.colour}</dd></div>
            <div><dt>lucky little thing</dt><dd>{fortune.thing}</dd></div>
          </dl>
          <span className="fortune-slip__wax" aria-hidden="true">♡</span>
        </div>
        <div className="fortune-slip__back" aria-hidden="true" />
      </div>
      {(folded || state === "unfolding") && (
        <button type="button" className="fortune-slip__ribbon" onClick={onOpen} disabled={!folded} aria-label="untie the ribbon and unfold your slip">
          <svg viewBox="0 0 120 60" aria-hidden="true">
            <path d="M60 30C48 12 24 10 26 26c2 12 24 8 34 4zM60 30c12-18 36-20 34-4-2 12-24 8-34 4z" fill="#c9a8f5" stroke="#4a2f57" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M56 33l-12 22 8-3 4 7 6-24M64 33l12 22-8-3-4 7-6-24" fill="#b48de8" stroke="#4a2f57" strokeWidth="2.4" strokeLinejoin="round" />
            <rect x="52" y="22" width="16" height="16" rx="6" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="2.4" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Keepsakes({ open, onClose, history }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <Panel open={open} onClose={onClose} title={`keepsakes · ${history.length}`}>
      {history.length === 0 && <p className="fortune-keep__empty">your slips will be kept here, one for every day ♡</p>}
      <ul className="fortune-keep">
        {history.map((entry, index) => {
          const isOpen = expanded === entry.day;
          return (
            <li key={entry.day} data-open={isOpen}>
              <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : entry.day)}>
                <span className="fortune-keep__seal" lang="ja">{entry.level.kanji}</span>
                <span className="fortune-keep__head">
                  <span className="luck-pixel">{stamp(entry.day)} · no. {history.length - index}</span>
                  <span className="fortune-keep__text">{entry.text}</span>
                </span>
              </button>
              {isOpen && (
                <div className="fortune-keep__more">
                  <span><Swatch colour={entry.colour} /> {entry.colour}</span>
                  <span>✿ {entry.thing}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default function FortuneGame({ onReward }) {
  const luck = useLuck();
  const draw = useLuckAction("fortune");
  const reduced = useReducedMotion();
  const stageRef = useRef(null);
  const areaRef = useRef(null);
  const confettiRef = useRef(null);
  const area = useStageSize(areaRef);
  const [state, setState] = useState("tin"); // tin | shaking | landing | folded | unfolding | open
  const stateRef = useRef(state);
  stateRef.current = state;
  const [drawn, setDrawn] = useState(null);
  const [message, setMessage] = useState("");
  const [keepOpen, setKeepOpen] = useState(false);
  const rewarded = useRef(new Set());

  const today = luck.data?.fortune?.today ?? null;
  const history = luck.data?.fortune?.history ?? [];
  const count = luck.data?.fortune?.count ?? 0;
  const fortune = drawn ?? today;

  // Already drawn today (on this phone or another): the slip lies open, ready to reread.
  useEffect(() => {
    if (today && state === "tin") setState("open");
  }, [today, state]);

  const slipH = Math.max(300, Math.min(450, area.height - 24));
  const slipW = Math.max(250, Math.min(330, area.width - 44));

  const reward = (sticker, reason) => {
    if (rewarded.current.has(reason)) return;
    rewarded.current.add(reason);
    onReward?.({ sticker, game: "fortune", reason });
  };

  const shake = async () => {
    if (state !== "tin") return;
    setMessage("");
    setState("shaking");
    haptic("light");
    play("paper");
    const request = draw.mutateAsync({});
    if (!reduced) {
      for (let i = 0; i < 3; i++) {
        await wait(220);
        haptic("light");
        play("tick");
      }
    }
    try {
      const data = await request;
      setDrawn(data.fortune);
      play("whoosh");
      setState("landing");
      await wait(reduced ? 0 : 650);
      // She may already have tapped the ribbon while the slip was landing: then it's unfolding.
      setState((now) => (now === "landing" ? "folded" : now));
    } catch {
      setState("tin");
      setMessage("the tin is stuck. try again in a moment?");
      haptic("warning");
    }
  };

  const unfold = async () => {
    // A tap as the slip lands counts too (the ribbon is already there to tap).
    if (stateRef.current !== "folded" && stateRef.current !== "landing") return;
    stateRef.current = "unfolding";
    setMessage("");
    play("pop");
    haptic("light");
    setState("unfolding");
    if (!reduced) {
      await wait(380);
      play("paper");
      await wait(520);
      play("paper");
      await wait(560);
    }
    setState("open");
    play("chime");
    haptic("success");
    const total = luck.data?.fortune?.count ?? 1;
    if (total === 1) {
      celebrate(confettiRef.current, { y: 0.4 });
      reward("st-fortune", "first fortune slip");
    } else if (total === 7) {
      celebrate(confettiRef.current, { y: 0.4, big: true });
      reward("st-clover", "seven fortunes kept");
    }
  };

  const index = fortune ? history.findIndex((entry) => entry.day === fortune.day) : -1;
  const number = index === -1 ? Math.max(1, count) : count - index;
  const showSlip = fortune && state !== "tin" && state !== "shaking";

  return (
    <LuckStage ref={stageRef} className="fortune-game" aria-label="fortune slip">
      <StatusBar help={HELP}>
        <button type="button" className="luck-chip" onClick={() => setKeepOpen(true)} aria-label={`keepsakes, ${count} slips kept`}>
          <span aria-hidden="true">✿</span> keepsakes {count}
        </button>
      </StatusBar>

      <div className="fortune-area" ref={areaRef} style={{ "--slip-h": `${slipH}px`, "--slip-w": `${slipW}px` }}>
        {!showSlip && (
          <div className="fortune-tin-wrap">
            <Tin shaking={state === "shaking"} onShake={shake} disabled={state !== "tin" || luck.isPending} />
          </div>
        )}
        {showSlip && <Slip fortune={fortune} number={number} state={state} onOpen={unfold} />}
      </div>

      <div className="fortune-foot" role="status" aria-live="polite">
        {state === "tin" && !luck.isPending && (
          <>
            <p className="luck-hand fortune-foot__line">{message || "one little slip a day, just for you"}</p>
            <button type="button" className="luck-btn" onClick={shake}>shake the tin <Sparkle size={13} /></button>
          </>
        )}
        {state === "shaking" && <p className="luck-hand fortune-foot__line">shake, shake…</p>}
        {(state === "folded" || state === "landing") && <p className="luck-hand fortune-foot__line">{state === "folded" ? "tap the ribbon to unfold it" : " "}</p>}
        {state === "open" && (
          <p className="luck-hand fortune-foot__line">
            a new slip {untilTomorrow()} ♡
            <small>{count > 1 ? `you've kept ${count} slips so far` : "your first keepsake ✿"}</small>
          </p>
        )}
      </div>

      <ConfettiCanvas ref={confettiRef} />
      <Keepsakes open={keepOpen} onClose={() => setKeepOpen(false)} history={history} />
    </LuckStage>
  );
}
