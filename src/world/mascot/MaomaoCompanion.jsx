import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useReducedMotion } from "motion/react";
import { usePublicProfile } from "../../lib/profile.js";
import { usePlayful } from "../../shared/play/PlayfulContext.js";
import {
  addressRemark,
  createRemarkPicker,
  PLACE_TOPIC,
} from "../../shared/play/maomaoDialogue.js";
import MaomaoMascot from "./MaomaoMascot.jsx";
import CompanionScene from "./CompanionScene.jsx";
import "./MaomaoCompanion.css";

/**
 * Maomao, living in the site rather than sitting at the top of one page.
 *
 * She keeps her own workbench along the foot of the world: walking a little, stopping to do
 * apothecary things, thinking half-finished thoughts to herself. Tapping her interrupts — she
 * always has something new to say — and opens the small tray of things you can show her.
 *
 * She assumes the person talking to her is Kiriya, because this is Kiriya's site.
 *
 * Quiet mode and reduced motion stop the walking and the idle chatter; she stays put and stays
 * tappable, so nothing is lost, it is only calmer.
 */

/**
 * What she does when left alone, each with the workbench that belongs to it and the pool her
 * thought comes from. These are all self-directed: she is talking to herself, not to anyone, so
 * they never draw from the pools that address Kiriya by name.
 */
const ACTIVITIES = [
  {
    id: "grind",
    scene: "grind",
    expression: "focused",
    topic: "working",
    hold: [8000, 13000],
  },
  {
    id: "brew",
    scene: "brew",
    expression: "focused",
    topic: "working",
    hold: [9000, 14000],
  },
  {
    id: "gather",
    scene: "gather",
    expression: "herb",
    topic: "herb",
    hold: [6000, 10000],
  },
  {
    id: "inspect",
    scene: "inspect",
    expression: "sniff",
    topic: "herb",
    hold: [6000, 10000],
  },
  {
    id: "notes",
    scene: "notes",
    expression: "writing",
    topic: "notes",
    hold: [7000, 12000],
  },
  {
    id: "sort",
    scene: "sort",
    expression: "thinking",
    topic: "musing",
    hold: [6000, 11000],
  },
  {
    id: "conjecture",
    scene: "conjecture",
    expression: "thinking",
    topic: "deduction",
    hold: [7000, 12000],
  },
  {
    id: "rest",
    scene: "rest",
    expression: "sleepy",
    topic: "idle",
    hold: [6000, 10000],
  },
  {
    id: "peer",
    scene: "sort",
    expression: "skeptical",
    topic: "musing",
    hold: [5000, 9000],
  },
  {
    id: "specimen",
    scene: "inspect",
    expression: "poison",
    topic: "poison",
    hold: [6000, 10000],
  },
];
const WALKING = {
  id: "walk",
  scene: null,
  expression: "deadpan",
  topic: "musing",
  hold: [0, 0],
};

const between = ([lo, hi]) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Morning / afternoon / evening / late, in her local reading of the clock. */
function hourMood(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "late";
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "late";
}

export default function MaomaoCompanion() {
  const { moving } = usePlayful();
  const reduced = useReducedMotion();
  const profile = usePublicProfile();
  const { pathname } = useLocation();
  const name = profile.data?.name || "";
  const lively = moving && !reduced;

  const picker = useRef(null);
  if (!picker.current) picker.current = createRemarkPicker();
  const pokes = useRef(0);
  const lastPoke = useRef(-Infinity);
  const where = useRef(12);

  const [pos, setPos] = useState(() => ({ x: 12, ms: 0 }));
  const [facing, setFacing] = useState(1);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [said, setSaid] = useState(null);
  const [tray, setTray] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [reaction, setReaction] = useState(0);
  const [tucked, setTucked] = useState(false);

  // A remark she says out loud, which replaces whatever she was thinking.
  const speak = useCallback((topic, { announce = true } = {}) => {
    const remark = picker.current(topic);
    setSaid({ ...remark, announce, at: Date.now() });
    setReaction((n) => n + 1);
    return remark;
  }, []);

  // Greet on arrival, once, in a way that fits the hour and knows whose house this is.
  useEffect(() => {
    const mood = hourMood();
    const topic = mood === "late" || mood === "morning" ? "hour" : "kiriya";
    speak(topic, { announce: false });
  }, [speak]);

  // Say something about where she now finds herself, when the route changes to a known place.
  const place = pathname.split("/").filter(Boolean).at(-1);
  useEffect(() => {
    const topic = PLACE_TOPIC[place];
    if (!topic || !lively) return;
    const t = setTimeout(() => speak(topic, { announce: false }), 1400);
    return () => clearTimeout(t);
  }, [place, lively, speak]);

  // The wander loop: walk somewhere, settle into a piece of work, occasionally think out loud.
  // Every timer is local to one run of the effect, and `where` holds her position outside React
  // state, so a StrictMode double-mount cannot orphan a chain or leave her standing still.
  useEffect(() => {
    if (!lively || tray || tucked) return undefined;
    let cancelled = false;
    let timer = 0;
    let aside = 0;
    const step = (phase) => {
      if (cancelled) return;
      if (phase === "walk") {
        // Always a real distance away, and on the far side often enough to use the whole width.
        const from = where.current;
        const span = 22 + Math.random() * 50;
        const target = clamp(
          from + (Math.random() < 0.5 ? -span : span),
          5,
          82,
        );
        where.current = target;
        setFacing(target >= from ? 1 : -1);
        // Roughly constant walking speed, so a longer stroll takes longer.
        setPos({ x: target, ms: 900 + Math.abs(target - from) * 70 });
        setActivity(WALKING);
        timer = setTimeout(() => step("work"), 1400 + Math.random() * 2400);
        return;
      }
      const next = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
      setActivity(next);
      setReaction((n) => n + 1);
      // She doesn't narrate every task — roughly half are done in silence, which is the point:
      // the workbench animation carries the moment and the talking is the exception.
      if (Math.random() < 0.55)
        aside = setTimeout(
          () => !cancelled && speak(next.topic, { announce: false }),
          900,
        );
      timer = setTimeout(() => step("walk"), between(next.hold));
    };
    timer = setTimeout(() => step("work"), 2200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(aside);
    };
  }, [lively, tray, tucked, speak]);

  // A said line fades back to her own thoughts; the tray keeps it up while it is open.
  useEffect(() => {
    if (!said || tray) return undefined;
    const t = setTimeout(() => setSaid(null), 7000);
    return () => clearTimeout(t);
  }, [said, tray]);

  // The tray closes itself if she is left alone with it open.
  useEffect(() => {
    if (!tray || asking) return undefined;
    const t = setTimeout(() => setTray(false), 14000);
    return () => clearTimeout(t);
  }, [tray, asking, said]);

  const poke = () => {
    pokes.current += 1;
    const now = performance.now();
    const rapid = now - lastPoke.current < 700;
    lastPoke.current = now;
    // Persistent prodding earns the irritated pool; otherwise she has plenty to say.
    speak(rapid && pokes.current % 3 === 0 ? "pester" : "poke");
    setTray(true);
  };

  const offer = (topic) => {
    setAsking(false);
    speak(topic);
  };

  const ask = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/me/maomao/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.text) {
        setSaid({
          expression: data.expression ?? "thinking",
          text: data.text,
          announce: true,
          at: Date.now(),
        });
        setReaction((n) => n + 1);
      } else speak("tap");
    } catch {
      // Offline, rate-limited or the budget is spent: she still answers, from her own library.
      speak("tap");
    } finally {
      setPending(false);
      setQuestion("");
      setAsking(false);
    }
  };

  const expression = said?.expression ?? activity.expression;
  const bubble = useMemo(
    () => (said ? addressRemark(said.text, name) : null),
    [said, name],
  );

  if (tucked)
    return (
      <div className="companion companion--tucked">
        <button
          type="button"
          className="companion__recall"
          onClick={() => setTucked(false)}
        >
          call her back ♡
        </button>
      </div>
    );

  return (
    <div
      className="companion"
      data-walking={activity.id === "walk" ? "" : undefined}
      data-motion-region
    >
      <div
        className="companion__figure"
        style={{
          "--companion-x": `${pos.x}vw`,
          "--companion-walk": `${pos.ms}ms`,
          "--companion-facing": facing,
        }}
      >
        {bubble && (
          <p
            className="companion__bubble"
            data-aside={said?.announce ? undefined : ""}
            aria-live={said?.announce ? "polite" : "off"}
          >
            {bubble}
          </p>
        )}
        {/* Her workbench is anchored to her feet, not to the whole column, so opening the tray
            never drags it out from under her. */}
        <span className="companion__stage">
          <CompanionScene activity={activity.scene} />
          <MaomaoMascot
            expression={expression}
            reactionKey={reaction}
            size={112}
            onPoke={poke}
          />
        </span>
        {tray && (
          <div
            className="companion__tray"
            role="group"
            aria-label="Show Maomao something"
          >
            {asking ? (
              <form className="companion__ask" onSubmit={ask}>
                <label className="sr-only" htmlFor="companion-question">
                  Ask Maomao something
                </label>
                <input
                  id="companion-question"
                  autoFocus
                  maxLength={160}
                  placeholder="ask her something…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button type="submit" disabled={pending || !question.trim()}>
                  {pending ? "…" : "ask"}
                </button>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setAsking(false)}
                >
                  never mind
                </button>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => offer("herb")}>
                  show her an herb
                </button>
                <button type="button" onClick={() => offer("vial")}>
                  a curious vial
                </button>
                <button type="button" onClick={() => setAsking(true)}>
                  ask her something
                </button>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setTucked(true)}
                >
                  let her work
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
