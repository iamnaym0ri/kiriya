import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { usePublicProfile } from "../../lib/profile.js";
import { usePlayful } from "../../shared/play/PlayfulContext.js";
import {
  addressRemark,
  createRemarkPicker,
  PLACE_TOPIC,
} from "../../shared/play/maomaoDialogue.js";
import MaomaoMascot from "./MaomaoMascot.jsx";
import CompanionScene from "./CompanionScene.jsx";
import CompanionShelf from "./CompanionShelf.jsx";
import "./MaomaoCompanion.css";

/**
 * Maomao as a desktop mate: she lives in the world rather than sitting on one page.
 *
 * She has two places. The nav bar is her shelf — she sits on its edge with her legs over the side
 * and works there, which is where she spends most of her time. The rest of the time she is down on
 * the floor of the page, walking a path that fades in behind her and stopping to do apothecary
 * things at her bench.
 *
 * You can pick her up. She hangs from the scruff like a kitten, complains about it, and when you
 * put her down she lands, picks herself up and goes back to whatever she was doing.
 *
 * She assumes the person talking to her is Kiriya, because this is Kiriya's site.
 *
 * Quiet mode and reduced motion stop her MOVING — no walking, no running animations — but she still
 * changes task and still thinks out loud, just more slowly. Less motion is not a statue.
 */

/** What she does when left alone: a pose, its workbench, and the pool her thought comes from. */
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
// On her shelf. She still works up here — the mortar, the notebook, a specimen — she just does it
// sitting with her legs over the edge, at whatever angle suits her.
const PERCH_ACTIVITIES = [
  {
    id: "sit-grind",
    scene: "grind",
    expression: "focused",
    topic: "working",
    hold: [9000, 14000],
  },
  {
    id: "sit-brew",
    scene: "brew",
    expression: "focused",
    topic: "working",
    hold: [9000, 15000],
  },
  {
    id: "sit-notes",
    scene: "notes",
    expression: "writing",
    topic: "notes",
    hold: [9000, 15000],
  },
  {
    id: "sit-specimen",
    scene: "inspect",
    expression: "poison",
    topic: "poison",
    hold: [8000, 13000],
  },
  {
    id: "sit-think",
    scene: "conjecture",
    expression: "thinking",
    topic: "musing",
    hold: [8000, 14000],
  },
  {
    id: "sit-content",
    scene: "rest",
    expression: "pleased",
    topic: "idle",
    hold: [8000, 13000],
  },
  {
    id: "sit-watch",
    scene: null,
    expression: "curious",
    topic: "deduction",
    hold: [7000, 12000],
  },
  {
    id: "sit-doze",
    scene: null,
    expression: "sleepy",
    topic: "idle",
    hold: [9000, 15000],
  },
  {
    id: "sit-amused",
    scene: null,
    expression: "amused",
    topic: "idle",
    hold: [7000, 11000],
  },
];
const TRAVELLING = {
  id: "walk",
  scene: null,
  expression: "deadpan",
  topic: "musing",
  hold: [0, 0],
};

const FLOOR_GAP = 96; // clears "your little corner", which is fixed bottom-left.
/** The nav bar's live bottom edge — the shelf she sits on. Measured, never assumed. */
const shelfEdge = () =>
  document.querySelector(".world-mast")?.getBoundingClientRect().bottom ?? 86;
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

function hourMood(now = new Date()) {
  const h = now.getHours();
  if (h < 5 || h >= 22) return "late";
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/**
 * How far along a rail she may wander. Up on the nav bar she keeps clear of the wordmark, so she is
 * never sitting on Kiriya's name.
 */
function roam(rail, width = 112) {
  const right = Math.max(40, window.innerWidth - width - 8);
  if (rail !== "ledge") {
    // "your little corner" is fixed bottom-left; she walks to the right of it, not through it.
    const corner = document
      .querySelector(".daily-style-corner")
      ?.getBoundingClientRect();
    return [Math.min(right - 8, (corner?.right ?? 0) + 12), right];
  }
  const mark = document
    .querySelector(".world-mast > a, .world-mast > *")
    ?.getBoundingClientRect();
  // Never give away more than the left third of the bar, and if what is left is too cramped to
  // walk in, take the whole width instead — she can always be carried aside if she is in the way.
  const clearOfName = Math.min((mark?.right ?? 0) + 14, window.innerWidth * 0.34);
  return right - clearOfName < 200 ? [8, right] : [clearOfName, right];
}

/**
 * Where a rail sits, in viewport coordinates, for a body of this height. `height` is HER height —
 * not the column that also holds her speech bubble, which changes size every time she speaks and
 * would otherwise shunt her up and down the screen.
 */
function railY(rail, height) {
  // On the bar she sits INSIDE it, feet just above its lower edge, not overhanging onto the ribbon.
  if (rail === "ledge") return Math.max(2, shelfEdge() - height - 3);
  return window.innerHeight - FLOOR_GAP - height;
}
/** She scales down to fit the bar, and stands full height on the floor. */
const bodyWidth = (rail) =>
  rail === "ledge" ? Math.min(78, shelfEdge() - 26) : 112;

export default function MaomaoCompanion() {
  const { moving } = usePlayful();
  const reduced = useReducedMotion();
  const profile = usePublicProfile();
  const { pathname } = useLocation();
  const name = profile.data?.name || "";
  const lively = moving && !reduced;

  const figureRef = useRef(null);
  const picker = useRef(null);
  if (!picker.current) picker.current = createRemarkPicker();
  const pokes = useRef(0);
  const lastPoke = useRef(-Infinity);
  const size = useRef({ w: 112, h: 150 });

  const x = useMotionValue(260);
  const y = useMotionValue(0);

  const [rail, setRail] = useState("ledge");
  const [facing, setFacing] = useState(1);
  const [activity, setActivity] = useState(PERCH_ACTIVITIES[0]);
  const [pose, setPose] = useState("sit");
  const [said, setSaid] = useState(null);
  const [tray, setTray] = useState(false);
  const [reaction, setReaction] = useState(0);
  const [held, setHeld] = useState(false);
  const [prints, setPrints] = useState([]);
  const holdRef = useRef(false);
  const railRef = useRef("ledge");
  // Set while she is part-way between rails, so a staged hop keeps its destination.
  const descending = useRef(null);
  railRef.current = rail;
  holdRef.current = held;

  const speak = useCallback((topic, { announce = true } = {}) => {
    const remark = picker.current(topic);
    setSaid({ ...remark, announce, at: Date.now() });
    setReaction((n) => n + 1);
    return remark;
  }, []);

  // Measure her, and keep both rails correct through resizes and orientation changes.
  useEffect(() => {
    const place = () => {
      // Measure the mascot itself; the bubble and tray float free of the layout for this reason.
      const box = figureRef.current
        ?.querySelector(".companion__stage")
        ?.getBoundingClientRect();
      if (box?.height) size.current = { w: box.width, h: box.height };
      x.set(clamp(x.get(), ...roam(railRef.current, size.current.w)));
      if (!holdRef.current) y.set(railY(railRef.current, size.current.h));
    };
    place();
    const t = setTimeout(place, 400);
    window.addEventListener("resize", place);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", place);
    };
  }, [x, y]);

  useEffect(() => {
    const mood = hourMood();
    speak(mood === "late" || mood === "morning" ? "hour" : "kiriya", {
      announce: false,
    });
  }, [speak]);

  const place = pathname.split("/").filter(Boolean).at(-1);
  useEffect(() => {
    const topic = PLACE_TOPIC[place];
    if (!topic) return;
    const t = setTimeout(() => speak(topic, { announce: false }), 1400);
    return () => clearTimeout(t);
  }, [place, speak]);

  // Her day: settle somewhere, work a while, then move — along a rail, or between the shelf and
  // the floor. Being carried or spoken to suspends it; putting her down resumes it.
  useEffect(() => {
    if (held || tray) return undefined;
    let cancelled = false;
    let timer = 0;
    let aside = 0;
    let stride = 0;

    const work = () => {
      const onLedge = railRef.current === "ledge";
      const next = pickOne(onLedge ? PERCH_ACTIVITIES : ACTIVITIES);
      setActivity(next);
      setPose(onLedge ? "sit" : "stand");
      setReaction((n) => n + 1);
      if (Math.random() < 0.55)
        aside = setTimeout(
          () => !cancelled && speak(next.topic, { announce: false }),
          900,
        );
      timer = setTimeout(move, between(next.hold) * (lively ? 1 : 1.4));
    };

    const move = () => {
      if (cancelled) return;
      // Standing still: she just turns to the next task in her own time.
      if (!lively) {
        timer = setTimeout(work, 2000 + Math.random() * 3000);
        return;
      }
      // Roughly a third of the time she changes shelf; otherwise she walks where she already is.
      // Part-way between rails she is already committed; otherwise she decides afresh.
      const swapRail = descending.current !== null || Math.random() < 0.34;
      const nextRail =
        descending.current ??
        (swapRail
          ? railRef.current === "ledge"
            ? "floor"
            : "ledge"
          : railRef.current);
      const from = x.get();
      const span = 90 + Math.random() * 260;
      const target = clamp(
        from + (Math.random() < 0.5 ? -span : span),
        ...roam(nextRail, size.current.w),
      );
      setFacing(target >= from ? 1 : -1);
      setActivity(TRAVELLING);
      setPose("walk");
      const distance = Math.abs(target - from);
      const duration = clamp(distance / 90, 0.9, 4.2);

      // Footprints only make sense where there is a floor to leave them on.
      if (nextRail === "floor" && railRef.current === "floor") {
        stride = setInterval(() => {
          if (cancelled) return;
          const at = x.get() + size.current.w / 2;
          setPrints((list) => [
            ...list.slice(-7),
            { id: `${Date.now()}-${at.toFixed(0)}`, x: at },
          ]);
        }, 360);
      }

      // Changing shelf is a hop, not a slide: crouch, push off, arc across, land and straighten up.
      if (swapRail) {
        clearInterval(stride);
        const full = railY(nextRail, size.current.h);
        const from = y.get();
        // She never leaps the whole screen in one go. A long drop is taken in stages, with a
        // breath between each, so it reads as hopping down rather than falling off a building.
        const MAX_HOP = 190;
        const staged = Math.abs(full - from) > MAX_HOP;
        descending.current = staged ? nextRail : null;
        const hopTo = staged ? from + Math.sign(full - from) * MAX_HOP : full;
        const apex = Math.min(from, hopTo) - (full > from ? 22 : 48);
        setPose("crouch");
        timer = setTimeout(() => {
          if (cancelled) return;
          setPose("hop");
          const across = animate(x, target, {
            duration: 0.72,
            ease: [0.3, 0, 0.5, 1],
          });
          // Up to the apex quickly, then fall away from it — a real arc rather than a straight line.
          const up = animate(y, apex, {
            duration: 0.3,
            ease: [0.16, 0.7, 0.4, 1],
          });
          up.finished
            .then(() =>
              cancelled
                ? null
                : animate(y, hopTo, { duration: 0.42, ease: [0.5, 0, 0.85, 1] })
                    .finished,
            )
            .then(() => across.finished)
            .then(() => {
              if (cancelled) return;
              setPose("land");
              if (staged) {
                // Landed on the way down; gather herself, then take the next hop.
                timer = setTimeout(() => !cancelled && move(), 520);
                return;
              }
              setRail(nextRail);
              railRef.current = nextRail;
              timer = setTimeout(work, 420);
            })
            .catch(() => {});
        }, 260);
        return;
      }

      const walk = animate(x, target, { duration, ease: "linear" });
      walk.finished
        .then(() => {
          if (cancelled) return;
          clearInterval(stride);
          work();
        })
        .catch(() => {});
    };

    timer = setTimeout(work, 1800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(aside);
      clearInterval(stride);
    };
  }, [held, tray, lively, speak, x, y]);

  // Footprints fade on their own; drop them once they have.
  useEffect(() => {
    if (!prints.length) return undefined;
    const t = setTimeout(() => setPrints((list) => list.slice(1)), 1600);
    return () => clearTimeout(t);
  }, [prints]);

  useEffect(() => {
    if (!said || tray) return undefined;
    const t = setTimeout(() => setSaid(null), 7000);
    return () => clearTimeout(t);
  }, [said, tray]);

  useEffect(() => {
    if (!tray) return undefined;
    const t = setTimeout(() => setTray(false), 14000);
    return () => clearTimeout(t);
  }, [tray, said]);

  const poke = () => {
    if (held) return;
    pokes.current += 1;
    const now = performance.now();
    const rapid = now - lastPoke.current < 700;
    lastPoke.current = now;
    speak(rapid && pokes.current % 3 === 0 ? "pester" : "poke");
    setTray(true);
  };

  const onPickUp = () => {
    setHeld(true);
    setTray(false);
    setPose("held");
    setPrints([]);
    speak("carried");
  };

  // Put down: she falls to whichever shelf is nearer, lands, picks herself up and carries on.
  const onPutDown = () => {
    const landing = y.get() < window.innerHeight / 2 ? "ledge" : "floor";
    const target = railY(landing, size.current.h);
    setRail(landing);
    railRef.current = landing;
    x.set(
      clamp(x.get(), 8, Math.max(12, window.innerWidth - size.current.w - 8)),
    );
    const settle = () => {
      setPose(landing === "ledge" ? "sit" : "stand");
      setHeld(false);
      speak("landed");
    };
    // Quiet mode: she is simply there, without the drop.
    if (!lively) {
      y.set(target);
      settle();
      return;
    }
    setPose("land");
    animate(y, target, {
      type: "spring",
      stiffness: 260,
      damping: 26,
      restDelta: 0.5,
    })
      .finished.then(settle)
      .catch(() => setHeld(false));
  };

  const offer = (topic) => speak(topic);

  const expression = held
    ? (said?.expression ?? "alarmed")
    : (said?.expression ?? activity.expression);
  const bubble = useMemo(
    () => (said ? addressRemark(said.text, name) : null),
    [said, name],
  );
  const onFloor = rail === "floor" && !held;

  return (
    <div
      className="companion"
      data-rail={rail}
      data-activity={activity.id}
      data-held={held ? "" : undefined}
      // The floor height is owned here so the path is drawn exactly where she stands.
      style={{ "--companion-floor": `${FLOOR_GAP}px` }}
      data-motion-region
    >
      {/* The path she walks on, so she is never treading on nothing. */}
      {onFloor && (
        <div className="companion__path" aria-hidden="true">
          {prints.map((print) => (
            <span
              key={print.id}
              className="companion__print"
              style={{ left: print.x }}
            />
          ))}
        </div>
      )}
      <motion.div
        ref={figureRef}
        className="companion__figure"
        style={{ x, y }}
        drag
        dragMomentum={false}
        dragElastic={0.14}
        onDragStart={onPickUp}
        onDragEnd={onPutDown}
        whileDrag={{ cursor: "grabbing", zIndex: 60 }}
      >
        {/* Her body is the only thing in flow: it alone decides where she is anchored. */}
        <span
          className="companion__stage"
          style={{ "--companion-facing": facing }}
        >
          {rail === "ledge" && !held && <CompanionShelf />}
          <CompanionScene activity={held ? null : activity.scene} />
          <MaomaoMascot
            expression={expression}
            reactionKey={reaction}
            size={bodyWidth(rail)}
            pose={pose}
            onPoke={poke}
          />
        </span>
        <div className="companion__talk">
          {bubble && (
            <p
              className="companion__bubble"
              data-aside={said?.announce ? undefined : ""}
              aria-live={said?.announce ? "polite" : "off"}
            >
              {bubble}
            </p>
          )}
          {tray && !held && (
            <div
              className="companion__offers"
              role="group"
              aria-label="Show Maomao something"
            >
              <button
                type="button"
                className="companion__offer"
                aria-label="Show her an herb"
                title="show her an herb"
                onClick={() => offer("herb")}
              >
                <svg viewBox="0 0 34 34" aria-hidden="true">
                  <path
                    d="M17 27V13"
                    stroke="#527653"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17 14C6 12 7 3 7 3c10 0 13 6 10 11ZM17 16c11-2 10-9 10-9-9 0-12 4-10 9Z"
                    fill="#8eb45e"
                    stroke="#527653"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="companion__offer"
                aria-label="Show her a curious vial"
                title="a curious vial"
                onClick={() => offer("vial")}
              >
                <svg viewBox="0 0 34 34" aria-hidden="true">
                  <rect
                    x="12"
                    y="4"
                    width="10"
                    height="5"
                    rx="1.6"
                    fill="#ba9c72"
                  />
                  <path
                    d="M13 9h8v16a4 4 0 0 1-8 0Z"
                    fill="#b3a3c6"
                    stroke="#6d6486"
                    strokeWidth="1.6"
                  />
                  <path d="M13 19h8v6a4 4 0 0 1-8 0Z" fill="#8fb7a8" />
                  <circle cx="16" cy="22" r="1.3" fill="#ffffff" opacity=".7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
