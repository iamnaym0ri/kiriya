import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ConfettiCanvas, LuckStage, Panel, Sparkle, StatusBar, untilTomorrow } from "../_kit/parts.jsx";
import { haptic, useLuck, useLuckAction, usePageVisible, useReducedMotion, useStageSize } from "../_kit/hooks.js";
import { play } from "../_kit/sound.js";
import { celebrate } from "../_kit/celebrate.js";
import { newRequestId } from "../_kit/random.js";
import { AnySticker } from "../stickers.jsx";
import { CharmArt, CharmShadow } from "./charms.jsx";
import { CapsuleShape, CapsuleSvg, ChuteFlap, Crank, CrankHint, DomeGlass, MACHINE, MachineBack } from "./art.jsx";
import { addCapsule, createDome, stepDome, stirDome, takeCapsule } from "./dome.js";
import "./capsule.css";

const TAU = Math.PI * 2;
const TRAY_KEY = "kiriya:luck-capsule-tray";
const HELP = {
  game: "capsule",
  steps: [
    ["crank", "turn the crank all the way round, or just tap it"],
    ["capsule", "open your capsule: a charm for your book, sometimes a sticker"],
    ["3", "three capsules a day; a golden lantern can bring one more"],
  ],
};
const RARITY_LABEL = { everyday: "everyday charm", rare: "rare charm", sparkle: "sparkle charm" };

const readTray = () => {
  try {
    return localStorage.getItem(TRAY_KEY);
  } catch {
    return null;
  }
};
const writeTray = (value) => {
  try {
    if (value) localStorage.setItem(TRAY_KEY, value);
    else localStorage.removeItem(TRAY_KEY);
  } catch {
    // The tray simply won't survive a reload.
  }
};
const wrap = (angle) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/** The capsules in the dome, moved by a little physics loop that rests when everything is still. */
function useDome({ reduced, visible }) {
  const dome = useMemo(() => createDome({ radius: MACHINE.dome.r - 2, ballRadius: 20, count: 15 }), []);
  const nodes = useRef(new Map());
  const frame = useRef(0);
  const [balls, setBalls] = useState(() => dome.balls.map((ball) => ({ id: ball.id, colour: ball.colour })));

  const paint = useCallback(() => {
    for (const ball of dome.balls) {
      nodes.current.get(ball.id)?.setAttribute("transform", `translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)}) rotate(${ball.angle.toFixed(1)})`);
    }
  }, [dome]);

  const run = useCallback(() => {
    if (frame.current || reduced || !visible) return;
    let last = performance.now();
    let carry = 0;
    const tick = (now) => {
      carry = Math.min(carry + (now - last) / 1000, 0.05);
      last = now;
      while (carry >= 1 / 60) {
        stepDome(dome, 1 / 60);
        carry -= 1 / 60;
      }
      paint();
      frame.current = dome.calm > 40 ? 0 : requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [dome, paint, reduced, visible]);

  useLayoutEffect(() => {
    paint();
    if (!visible || reduced) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [paint, visible, reduced, balls]);

  const sync = () => setBalls(dome.balls.map((ball) => ({ id: ball.id, colour: ball.colour })));
  return {
    balls,
    ref: (id) => (node) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    },
    stir(strength) {
      if (reduced) return;
      stirDome(dome, strength);
      run();
    },
    take(colour) {
      const ball = takeCapsule(dome);
      if (ball) ball.colour = colour;
      sync();
      run();
      return ball;
    },
    refill() {
      addCapsule(dome);
      sync();
      run();
    },
    paint,
  };
}

function TurnDots({ capsule }) {
  if (!capsule) return <span className="luck-chip"><small>LOADING…</small></span>;
  const total = capsule.perDay + capsule.bonus;
  return (
    <span className="luck-chip capsule-turns" aria-label={`${capsule.left} ${capsule.left === 1 ? "turn" : "turns"} left today`}>
      <span className="capsule-turns__dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-used={i >= capsule.left} data-bonus={i >= capsule.perDay} />
        ))}
      </span>
      {capsule.left ? `${capsule.left} left` : "all done"}
    </span>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" fill="currentColor" fillOpacity=".12" />
      <path d="M12 6v13.5" />
    </svg>
  );
}

function CharmBook({ open, onClose, capsule }) {
  const catalogue = capsule?.catalogue ?? [];
  const charms = capsule?.charms ?? {};
  const found = catalogue.filter((charm) => charms[charm.id]).length;
  return (
    <Panel open={open} onClose={onClose} title={`charm book · ${found} of ${catalogue.length}`}>
      {["everyday", "rare", "sparkle"].map((rarity) => (
        <section key={rarity} className="charm-book__group">
          <h3 className="luck-pixel">{rarity === "everyday" ? "everyday" : rarity === "rare" ? "rare ✦" : "sparkle ✦✦"}</h3>
          <ul className="charm-book">
            {catalogue.filter((charm) => charm.rarity === rarity).map((charm) => {
              const count = charms[charm.id] ?? 0;
              return (
                <li key={charm.id} className="charm-book__item" data-found={count > 0} data-rarity={rarity}>
                  {count ? <CharmArt id={charm.id} size={54} /> : <CharmShadow size={54} />}
                  <b>{count ? charm.name : "not yet"}</b>
                  {count > 1 && <small>×{count}</small>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {capsule?.stickers > 0 && (
        <p className="charm-book__note">and {capsule.stickers} {capsule.stickers === 1 ? "sticker" : "stickers"} for your sticker collection ✿</p>
      )}
      {found === catalogue.length && catalogue.length > 0 && <p className="charm-book__note">every single charm. the machine is very impressed.</p>}
    </Panel>
  );
}

function Reveal({ pull, count, onKeep, onBook }) {
  const sticker = pull.kind === "sticker";
  const item = sticker ? pull.sticker : pull.charm;
  const rarity = sticker ? "sticker" : pull.charm?.rarity;
  return (
    <div className="capsule-reveal" role="dialog" aria-modal="true" aria-labelledby="capsule-reveal-title" data-rarity={rarity}>
      <div className="capsule-reveal__glow" aria-hidden="true" />
      <div className="capsule-reveal__art">
        {sticker ? <AnySticker art={item?.art} size={116} /> : <CharmArt id={item?.id} size={124} />}
      </div>
      <p className="capsule-reveal__kind luck-pixel">
        {sticker ? "a sticker for your collection!" : RARITY_LABEL[rarity]}
        {rarity === "sparkle" && <Sparkle size={12} className="capsule-reveal__twinkle" />}
      </p>
      <h2 id="capsule-reveal-title">{item?.name?.toLowerCase()}</h2>
      <p className="capsule-reveal__line">{item?.line}</p>
      <p className="capsule-reveal__note">
        {sticker
          ? "it's in your sticker collection ♡"
          : pull.isNew ? <><b>new!</b> added to your charm book</> : <>you have {count} of these now ♡</>}
      </p>
      <div className="capsule-reveal__actions">
        <button type="button" className="luck-btn" onClick={onKeep} autoFocus>keep it ♡</button>
        {!sticker && <button type="button" className="capsule-link" onClick={onBook}>see my charm book</button>}
      </div>
    </div>
  );
}

export default function CapsuleGame({ onReward }) {
  const luck = useLuck();
  const pullAction = useLuckAction("capsule");
  const capsule = luck.data?.capsule;
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const dome = useDome({ reduced, visible });

  const stageRef = useRef(null);
  const areaRef = useRef(null);
  const crankRef = useRef(null);
  const trayRef = useRef(null);
  const confettiRef = useRef(null);
  const area = useStageSize(areaRef);

  const [phase, setPhase] = useState("idle"); // idle | turning | auto | dropping | tray | opening | reveal | error
  const [pull, setPull] = useState(null);
  const [message, setMessage] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [flapOpen, setFlapOpen] = useState(false);
  const rotation = useRef(0);
  const drag = useRef(null);
  const pullId = useRef(null);
  const rewarded = useRef(new Set());

  const scale = Math.max(0.1, Math.min((area.width - 24) / MACHINE.width, area.height / MACHINE.height, 1.35));
  const machineW = MACHINE.width * scale;
  const machineH = MACHINE.height * scale;
  const left = capsule?.left ?? 0;
  const napping = Boolean(capsule) && left === 0 && !["dropping", "tray", "opening", "reveal"].includes(phase);
  const busy = phase !== "idle" && phase !== "error";

  const setCrank = (angle) => {
    rotation.current = angle;
    crankRef.current?.setAttribute("transform", `rotate(${(angle * 180) / Math.PI} ${MACHINE.crank.cx} ${MACHINE.crank.cy})`);
  };

  // A capsule she turned out but never opened (the app closed mid-way) waits in the tray.
  useEffect(() => {
    if (!capsule || pull || phase !== "idle") return;
    const waiting = readTray();
    const recent = capsule.recent?.[0];
    if (waiting && recent && recent.id === waiting) {
      setPull(recent);
      setPhase("tray");
      setMessage("your capsule is still waiting for you ✿");
    } else if (waiting) writeTray(null);
  }, [capsule, pull, phase]);

  const quarter = useCallback((index) => {
    play("tick");
    haptic("light");
    dome.stir(0.9 + index * 0.15);
  }, [dome]);

  const rollOut = useCallback(async (result) => {
    setPhase("dropping");
    dome.take(result.capsule);
    play("clack");
    haptic("medium");
    setFlapOpen(true);
    await nextFrames();
    const node = trayRef.current;
    if (node && !reduced) {
      play("roll");
      await node.animate(
        [
          { transform: "translate(-50%, 6%) scale(.4) rotate(-120deg)", opacity: 0 },
          { transform: "translate(-50%, 0%) scale(.6) rotate(-60deg)", opacity: 1, offset: 0.2 },
          { transform: "translate(-50%, -40%) scale(.96) rotate(-12deg)", offset: 0.55 },
          { transform: "translate(-50%, 0%) scale(.86) rotate(8deg)", offset: 0.78 },
          { transform: "translate(-50%, -9%) scale(.86) rotate(-3deg)", offset: 0.9 },
          { transform: "translate(-50%, 0%) scale(.86) rotate(0deg)" },
        ],
        { duration: 820, easing: "ease-out" },
      ).finished.catch(() => {});
      play("clack");
      haptic("light");
    }
    setPhase("tray");
    setFlapOpen(false);
    setMessage(result.kind === "sticker" ? "ooh, a heart capsule! tap to open" : result.capsule === "gold" ? "a golden one…! tap to open" : "tap your capsule to open it");
  }, [dome, reduced]);

  const commit = useCallback(async (fromAngle) => {
    setPhase("auto");
    setMessage("");
    pullId.current ??= newRequestId();
    const request = pullAction.mutateAsync({ pullId: pullId.current });
    // The crank finishes its turn by itself once she's past halfway.
    const start = fromAngle;
    const duration = reduced ? 250 : 900 * (1 - start / TAU) + 200;
    const began = performance.now();
    let passed = Math.floor(start / (Math.PI / 2));
    await new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - began) / duration);
        const eased = 1 - (1 - t) ** 3;
        const angle = start + (TAU - start) * eased;
        setCrank(angle);
        const q = Math.floor(angle / (Math.PI / 2));
        if (q > passed && q < 4) quarter(q);
        passed = q;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    setCrank(0);
    try {
      const data = await request;
      pullId.current = null;
      writeTray(data.pull.id);
      setPull(data.pull);
      await rollOut(data.pull);
    } catch (error) {
      setPhase("error");
      if (error?.status === 429) {
        pullId.current = null;
        setMessage("the machine is napping until tomorrow ♡");
        setPhase("idle");
      } else {
        // Keep the same id: if the turn did reach the server, trying again returns that capsule.
        setMessage("the crank got stuck. try again?");
      }
      haptic("warning");
      play("soft");
    }
  }, [pullAction, quarter, reduced, rollOut]);

  const ready = Boolean(capsule) && left > 0 && (phase === "idle" || phase === "error");

  const onCrankDown = (event) => {
    if (!ready) {
      if (napping) {
        haptic("warning");
        play("soft");
        setMessage(`the machine is napping. new capsules ${untilTomorrow()} ♡`);
      }
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    drag.current = { cx, cy, last: Math.atan2(event.clientY - cy, event.clientX - cx), progress: 0, moved: 0, id: event.pointerId };
    setPhase("turning");
  };
  const onCrankMove = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const angle = Math.atan2(event.clientY - d.cy, event.clientX - d.cx);
    const delta = wrap(angle - d.last);
    d.last = angle;
    d.moved += Math.abs(delta);
    const before = Math.floor(d.progress / (Math.PI / 2));
    d.progress = Math.max(0, d.progress + delta);
    setCrank(d.progress);
    const after = Math.floor(d.progress / (Math.PI / 2));
    if (after > before) quarter(after);
    if (d.progress >= Math.PI) {
      drag.current = null;
      commit(d.progress);
    }
  };
  const onCrankUp = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (d.moved < 0.2) {
      // A tap turns the crank all the way round by itself.
      commit(d.progress);
      return;
    }
    // Let go too early: the crank eases back, and nothing is used up.
    const from = d.progress;
    const began = performance.now();
    const back = (now) => {
      const t = Math.min(1, (now - began) / 260);
      setCrank(from * (1 - t));
      if (t < 1) requestAnimationFrame(back);
    };
    requestAnimationFrame(back);
    setPhase("idle");
    setMessage("keep going, all the way round ↻");
  };
  // Keyboard and VoiceOver activate with a click that has no pointer behind it.
  const onCrankClick = (event) => {
    if (event.detail === 0 && ready) commit(0);
  };

  const open = async () => {
    if (phase !== "tray" || !pull) return;
    setPhase("opening");
    setMessage("");
    const node = trayRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    play("pop");
    haptic("success");
    if (node && stage && !reduced) {
      const box = node.getBoundingClientRect();
      const dx = stage.left + stage.width / 2 - (box.left + box.width / 2);
      const dy = stage.top + stage.height * 0.36 - (box.top + box.height / 2);
      const lift = node.animate(
        [{ transform: "translate(-50%, 0) scale(.86)" }, { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(1.7) rotate(-8deg)` }],
        { duration: 380, easing: "cubic-bezier(.3,.8,.3,1)", fill: "forwards" },
      );
      await lift.finished.catch(() => {});
      node.querySelector(".capsule-svg__top")?.animate(
        [{ transform: "none", opacity: 1 }, { transform: "translate(-26px, -70px) rotate(-50deg)", opacity: 0 }],
        { duration: 420, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" },
      );
      await node.querySelector(".capsule-svg__bottom")?.animate(
        [{ transform: "none", opacity: 1 }, { transform: "translate(18px, 60px) rotate(30deg)", opacity: 0 }],
        { duration: 420, easing: "cubic-bezier(.4,0,.8,.6)", fill: "forwards" },
      ).finished.catch(() => {});
    }
    writeTray(null);
    setPhase("reveal");
    const special = pull.kind === "sticker" || pull.capsule === "gold" || pull.isNew;
    play(pull.capsule === "gold" ? "fanfare" : special ? "yay" : "chime");
    if (special) celebrate(confettiRef.current, { y: 0.35, big: pull.capsule === "gold" });
    if (pull.kind === "sticker" && pull.sticker && !rewarded.current.has(pull.id)) {
      rewarded.current.add(pull.id);
      onReward?.({ sticker: pull.sticker.id, game: "capsule", reason: `capsule ${pull.id}`, saved: true });
    }
  };

  const keep = (thenBook = false) => {
    setPhase("idle");
    setPull(null);
    setMessage("");
    dome.refill();
    play("tick");
    if (thenBook) setBookOpen(true);
  };

  // A new day (or a spare coin) wakes the machine: yesterday's "napping" note goes. Only on that
  // change, so it never wipes another line (like "your capsule is still waiting").
  const leftBefore = useRef(left);
  useEffect(() => {
    if (leftBefore.current === 0 && left > 0) setMessage((line) => (line.includes("napping") ? "" : line));
    leftBefore.current = left;
  }, [left]);

  const found = capsule ? capsule.catalogue.filter((charm) => capsule.charms[charm.id]).length : 0;
  const hint = message || (luck.isError ? "the machine can't reach home right now. try again soon."
    : napping ? `all turned out for today. new capsules ${untilTomorrow()} ♡`
      : ready ? "turn the crank ↻" : "");

  return (
    <LuckStage ref={stageRef} className="capsule-game" aria-label="charm capsule machine">
      <StatusBar help={HELP}>
        <TurnDots capsule={capsule} />
        <button type="button" className="luck-chip" onClick={() => setBookOpen(true)} aria-label={`charm book, ${found} of ${capsule?.catalogue.length ?? 18} charms found`}>
          <BookIcon /> {found}/{capsule?.catalogue.length ?? 18}
        </button>
      </StatusBar>

      <div className="capsule-area" ref={areaRef}>
        <div className="capsule-machine" style={{ width: machineW, height: machineH }} data-napping={napping}>
          <svg viewBox={`0 ${MACHINE.top} ${MACHINE.width} ${MACHINE.height}`} width={machineW} height={machineH} aria-hidden="true">
            <MachineBack />
            <DomeGlass napping={napping}>
              {dome.balls.map((ball) => (
                <g key={ball.id} ref={dome.ref(ball.id)}>
                  <CapsuleShape colour={ball.colour} r={20} id={`dome-${ball.id}`} />
                </g>
              ))}
            </DomeGlass>
            <CrankHint show={ready && phase !== "turning"} />
            <g ref={crankRef}><Crank /></g>
            <ChuteFlap open={flapOpen} />
          </svg>
          <button
            type="button"
            className="capsule-crank"
            style={{
              left: (MACHINE.crank.cx / MACHINE.width) * 100 + "%",
              top: ((MACHINE.crank.cy - MACHINE.top) / MACHINE.height) * 100 + "%",
              width: Math.max(88, MACHINE.crank.r * 2.6 * scale),
              height: Math.max(88, MACHINE.crank.r * 2.6 * scale),
            }}
            aria-label={ready ? `turn the crank (${left} ${left === 1 ? "turn" : "turns"} left today)` : napping ? "the machine is napping until tomorrow" : "the crank"}
            aria-disabled={!ready}
            onPointerDown={onCrankDown}
            onPointerMove={onCrankMove}
            onPointerUp={onCrankUp}
            onPointerCancel={onCrankUp}
            onClick={onCrankClick}
            data-ready={ready}
          />
          {(phase === "dropping" || phase === "tray" || phase === "opening") && pull && (
            <button
              ref={trayRef}
              type="button"
              className="capsule-tray"
              data-colour={pull.capsule}
              style={{ top: ((MACHINE.chute.y - 32 - MACHINE.top) / MACHINE.height) * 100 + "%", width: 84 * scale, height: 84 * scale }}
              onClick={open}
              disabled={phase !== "tray"}
              aria-label="open your capsule"
            >
              <CapsuleSvg colour={pull.capsule} />
            </button>
          )}
        </div>
      </div>

      <p className="capsule-hint luck-hand" role="status" aria-live="polite">
        {hint}
        {napping && luck.data && !luck.data.lanterns?.coinToday && (
          <small>psst… a golden lantern sometimes carries a spare coin <Sparkle size={11} /></small>
        )}
        {phase === "error" && (
          <button type="button" className="luck-btn luck-btn--soft capsule-retry" onClick={() => commit(0)}>try again</button>
        )}
      </p>

      {phase === "reveal" && pull && (
        <Reveal
          pull={pull}
          count={pull.charm ? capsule?.charms?.[pull.charm.id] ?? 1 : 1}
          onKeep={() => keep(false)}
          onBook={() => keep(true)}
        />
      )}
      <ConfettiCanvas ref={confettiRef} />
      <CharmBook open={bookOpen} onClose={() => setBookOpen(false)} capsule={capsule} />
      {busy && <span className="luck-sr" aria-live="polite">{phase === "auto" ? "turning…" : ""}</span>}
    </LuckStage>
  );
}
