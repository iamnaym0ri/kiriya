import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { availableCompanions } from "./registry.js";
import Stage, { loadCharacter } from "./engine/Stage.jsx";
import { clearStay } from "./engine/stay.js";
import "./lab.css";

// Dev-only companion lab: /world/companion-lab?c=<id>&v=<visitor> (docs/refactor/RENOVATION.md).
// The real engine running a character (and a visitor) over a stand-in home, with controls for the
// levels, the speed, forcing poses, behaviours and visits, and a frame-time readout. The "poses" tab
// shows every pose and every platform state side by side. Also on window.__companionStage for scripts.
//
// Query options (handy for screenshots): levels=2..6, speed=0.25..3, quiet=1|0, debug=1, bg=home|text|plain,
// open=1 (panel open), tab=stage|poses, scale=0.7..1.2, ride=1|0 (try riding or trailing clouds),
// stay=1|0 (start told to stay, or wandering; leave it out to keep what this phone remembers).

const HomeBackdrop = lazy(() => import("../home/HomeSection.jsx"));

const SPEEDS = [0.25, 0.5, 1, 2, 3];
const LEVELS = ["auto", 2, 3, 4, 5, 6];
const SCALES = ["auto", 0.7, 0.8, 0.9, 1, 1.1, 1.2];

function TextBackdrop() {
  return (
    <div className="clab-text">
      {Array.from({ length: 8 }, (_, i) => (
        <section key={i} className="clab-card">
          <h2>a little card {i + 1}</h2>
          <p>Some words she might want to read, so the characters should try not to stand on them. A button sits below.</p>
          <button type="button">a button</button>
        </section>
      ))}
    </div>
  );
}

function Readout({ sim }) {
  const [stats, setStats] = useState(null);
  const [staying, setStaying] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setStats(sim.current?.ticker.stats() ?? null);
      setStaying(Boolean(sim.current?.host?.staying));
    }, 500);
    return () => clearInterval(t);
  }, [sim]);
  if (!stats) return <span className="clab-readout">paused</span>;
  return (
    <span className="clab-readout" data-bad={stats.long > 0 || stats.p95 > 20 ? "" : undefined}>
      {staying ? "📍 " : ""}
      {stats.avg.toFixed(1)}ms · p95 {stats.p95.toFixed(1)} · max {stats.max.toFixed(0)} · long {stats.long} · js {stats.cost.toFixed(2)}
    </span>
  );
}

function Gallery({ character }) {
  if (!character) return <p className="clab-note">loading…</p>;
  const { Body, Platform, size, movement, platformSurface } = character;
  const scale = 0.9;
  const w = size.width * scale;
  const h = size.height * scale;
  const pw = movement.platformWidth * scale;
  return (
    <div className="clab-gallery">
      {character.poses.map((pose) => (
        <figure key={pose} className="clab-pose">
          <div className="clab-pose__stage" style={{ width: Math.max(w, pw) + 16, height: h + 40 }}>
            <div className="clab-pose__tile" style={{ width: pw, left: `calc(50% - ${pw / 2}px)`, top: h + 8 - platformSurface * scale }}>
              <Platform width={pw} state="steady" facing={1} riding={false} playing />
            </div>
            <div className="clab-pose__body" style={{ width: w, height: h, left: `calc(50% - ${w / 2}px)`, top: 8 }}>
              <Body pose={pose} facing={1} playing frame={null} talking={false} />
            </div>
            <i className="clab-pose__feet" style={{ top: h + 8 }} />
          </div>
          <figcaption>{pose}</figcaption>
        </figure>
      ))}
      {(character.action?.steps ?? []).map((step, i) => (
        <figure key={`action-${i}`} className="clab-pose">
          <div className="clab-pose__stage" style={{ width: Math.max(w, pw) + 16, height: h + 40 }}>
            <div className="clab-pose__tile" style={{ width: pw, left: `calc(50% - ${pw / 2}px)`, top: h + 8 - platformSurface * scale }}>
              <Platform width={pw} state="steady" facing={1} riding={false} playing />
            </div>
            <div className="clab-pose__body" style={{ width: w, height: h, left: `calc(50% - ${w / 2}px)`, top: 8 }}>
              <Body pose={character.resolvePose(step.pose)} expression={step.expression} prop={step.prop} facing={1} playing frame={null} talking={false} />
            </div>
            <i className="clab-pose__feet" style={{ top: h + 8 }} />
          </div>
          <figcaption>
            {character.action.label} {i + 1}: {step.pose}
            {step.prop ? ` + ${step.prop}` : ""}
          </figcaption>
        </figure>
      ))}
      {character.behaviours
        .filter((b) => b.prop || b.steps?.some((step) => step.prop))
        .flatMap((b) => (b.steps ?? [b]).filter((step) => step.prop).map((step, i) => ({ b, step, i })))
        .map(({ b, step, i }) => (
          <figure key={`b-${b.id}-${i}`} className="clab-pose">
            <div className="clab-pose__stage" style={{ width: Math.max(w, pw) + 16, height: h + 40 }}>
              <div className="clab-pose__tile" style={{ width: pw, left: `calc(50% - ${pw / 2}px)`, top: h + 8 - platformSurface * scale }}>
                <Platform width={pw} state="steady" facing={1} riding={false} playing />
              </div>
              <div className="clab-pose__body" style={{ width: w, height: h, left: `calc(50% - ${w / 2}px)`, top: 8 }}>
                <Body pose={character.resolvePose(step.pose)} expression={step.expression} prop={step.prop} facing={1} playing frame={null} talking={false} />
              </div>
              <i className="clab-pose__feet" style={{ top: h + 8 }} />
            </div>
            <figcaption>
              {b.id}: {step.pose} + {step.prop}
            </figcaption>
          </figure>
        ))}
      {["forming", "steady", "fading"].map((state) => (
        <figure key={state} className="clab-pose">
          <div className="clab-pose__stage" style={{ width: pw + 16, height: 60 }}>
            <div className="clab-pose__tile" data-state={state} style={{ width: pw, left: `calc(50% - ${pw / 2}px)`, top: 20 }}>
              <Platform width={pw} state={state} facing={1} riding={false} playing />
            </div>
          </div>
          <figcaption>platform: {state}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function CompanionLab() {
  const [params, setParams] = useSearchParams();
  const ids = availableCompanions();
  const id = params.get("c") ?? ids.find((each) => !each.startsWith("_")) ?? ids[0];
  const visitorId = params.get("v") ?? "";
  const tab = params.get("tab") ?? "stage";
  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value == null) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { replace: true });
  };
  const [open, setOpen] = useState(params.get("open") === "1");
  const [character, setCharacter] = useState(null);
  const sim = useRef(null);

  const levels = params.get("levels") ? Number(params.get("levels")) : null;
  const speed = Number(params.get("speed") ?? 1);
  const scale = params.get("scale") ? Number(params.get("scale")) : null;
  const quietParam = params.get("quiet");
  const quiet = quietParam === "1" ? true : quietParam === "0" ? false : undefined;
  const debug = params.get("debug") === "1";
  const avoidText = params.get("avoid") !== "0";
  const bg = params.get("bg") ?? "home";
  const ride = params.get("ride");
  const stayParam = params.get("stay");
  // stay=1 / stay=0 in the address: start staying (at the middle of the bottom level) or wandering.
  const stayPrimed = useRef(false);
  if (!stayPrimed.current && stayParam != null && typeof window !== "undefined") {
    stayPrimed.current = true;
    if (stayParam === "0") clearStay(id);
    else if (stayParam === "1") {
      try {
        const all = JSON.parse(localStorage.getItem("kiriya:companion-stay") || "{}");
        all[id] ??= { x: 0.5, level: 0 };
        localStorage.setItem("kiriya:companion-stay", JSON.stringify(all));
      } catch {
        // Private mode: the stay button still works.
      }
    }
  }
  const options = useMemo(
    () => ({
      levels,
      speed,
      scale,
      quiet,
      debug,
      avoidText,
      visits: { enabled: false },
      movement: ride === "1" ? { platform: "ride", walkPose: "sit", restPose: "sit" } : ride === "0" ? { platform: "trail" } : undefined,
    }),
    [levels, speed, scale, quiet, debug, avoidText, ride],
  );

  // stay=… is a one-shot: drop it from the address so a reload keeps what the phone remembers.
  useEffect(() => {
    if (stayParam != null) set({ stay: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let live = true;
    setCharacter(null);
    loadCharacter(id).then((loaded) => live && setCharacter(loaded));
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => {
    window.__companionStage = sim.current;
    return () => {
      delete window.__companionStage;
    };
  });

  if (!import.meta.env.DEV) return null;
  const host = () => sim.current?.host;
  const visit = () => sim.current?.startVisit(visitorId || undefined);
  const force = (steps) => host()?.interrupt(steps);
  const holdPose = (pose) => pose && force([{ type: "wait", pose, seconds: [9999, 9999] }]);
  const behave = (bid) => {
    const b = character?.behaviours.find((each) => each.id === bid);
    if (b) force([{ type: "behave", b }]);
  };
  const jump = () => {
    const h = host();
    if (!h || h.level == null) return;
    const levelsNow = sim.current.levels;
    const target = h.level + 1 < levelsNow.length ? h.level + 1 : h.level - 1;
    if (target < 0) return;
    const level = levelsNow[target];
    const x = Math.min(level.x1, Math.max(level.x0, h.x + (h.facing * 90)));
    force([...h.pathTo(target, x), { type: "rest" }]);
  };
  const walkEdge = () => {
    const h = host();
    const level = h && sim.current.levels[h.level];
    if (!level) return;
    force([{ type: "walk", to: h.x < (level.x0 + level.x1) / 2 ? level.x1 : level.x0 }, { type: "rest" }]);
  };
  const topics = character ? Object.keys(character.lines) : [];

  return (
    <div className="clab" data-bg={bg}>
      {tab === "stage" && bg === "home" && (
        <Suspense fallback={null}>
          <HomeBackdrop />
        </Suspense>
      )}
      {tab === "stage" && bg === "text" && <TextBackdrop />}
      {tab === "poses" && <Gallery character={character} />}

      <div className="clab-panel" data-open={open ? "" : undefined} data-companion-edge={open ? undefined : "top"}>
        <div className="clab-bar">
          <button type="button" className="clab-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
            lab {open ? "▴" : "▾"}
          </button>
          <Readout sim={sim} />
        </div>
        {open && (
          <div className="clab-controls">
            <label>
              character
              <select value={id} onChange={(e) => set({ c: e.target.value })}>
                {ids.map((each) => (
                  <option key={each}>{each}</option>
                ))}
              </select>
            </label>
            <label>
              visitor
              <select value={visitorId} onChange={(e) => set({ v: e.target.value })}>
                <option value="">random</option>
                {ids.filter((each) => each !== id).map((each) => (
                  <option key={each}>{each}</option>
                ))}
              </select>
            </label>
            <label>
              view
              <select value={tab} onChange={(e) => set({ tab: e.target.value })}>
                <option value="stage">stage</option>
                <option value="poses">poses</option>
              </select>
            </label>
            <label>
              behind
              <select value={bg} onChange={(e) => set({ bg: e.target.value })}>
                <option value="home">home</option>
                <option value="text">text cards</option>
                <option value="plain">plain</option>
              </select>
            </label>
            <label>
              levels
              <select value={levels ?? "auto"} onChange={(e) => set({ levels: e.target.value === "auto" ? "" : e.target.value })}>
                {LEVELS.map((each) => (
                  <option key={each}>{each}</option>
                ))}
              </select>
            </label>
            <label>
              speed
              <select value={speed} onChange={(e) => set({ speed: e.target.value === "1" ? "" : e.target.value })}>
                {SPEEDS.map((each) => (
                  <option key={each} value={each}>
                    {each}×
                  </option>
                ))}
              </select>
            </label>
            <label>
              scale
              <select value={scale ?? "auto"} onChange={(e) => set({ scale: e.target.value === "auto" ? "" : e.target.value })}>
                {SCALES.map((each) => (
                  <option key={each}>{each}</option>
                ))}
              </select>
            </label>
            <label>
              motion
              <select value={quietParam ?? ""} onChange={(e) => set({ quiet: e.target.value })}>
                <option value="">as her setting</option>
                <option value="0">lively</option>
                <option value="1">quiet</option>
              </select>
            </label>
            <label>
              cloud
              <select value={ride ?? ""} onChange={(e) => set({ ride: e.target.value })}>
                <option value="">its own</option>
                <option value="0">trail</option>
                <option value="1">ride (sitting)</option>
              </select>
            </label>
            <label className="clab-check">
              <input type="checkbox" checked={debug} onChange={(e) => set({ debug: e.target.checked ? 1 : "" })} /> show levels
            </label>
            <label className="clab-check">
              <input type="checkbox" checked={avoidText} onChange={(e) => set({ avoid: e.target.checked ? "" : 0 })} /> avoid text
            </label>
            <label>
              hold pose
              <select value="" onChange={(e) => holdPose(e.target.value)}>
                <option value="">choose…</option>
                {(character?.poses ?? []).map((each) => (
                  <option key={each}>{each}</option>
                ))}
              </select>
            </label>
            <label>
              behaviour
              <select value="" onChange={(e) => behave(e.target.value)}>
                <option value="">choose…</option>
                {(character?.behaviours ?? []).map((each) => (
                  <option key={each.id}>{each.id}</option>
                ))}
              </select>
            </label>
            <label>
              say
              <select value="" onChange={(e) => e.target.value && host()?.say([e.target.value])}>
                <option value="">topic…</option>
                {topics.map((each) => (
                  <option key={each}>{each}</option>
                ))}
              </select>
            </label>
            <div className="clab-actions">
              <button type="button" onClick={visit}>visit now</button>
              <button type="button" onClick={() => sim.current?.endVisit()}>end visit</button>
              <button type="button" onClick={jump}>jump</button>
              <button type="button" onClick={walkEdge}>walk to edge</button>
              <button type="button" onClick={() => host()?.tap()}>tap (menu)</button>
              <button type="button" onClick={() => host()?.runAction()} disabled={!character?.action}>
                {character?.action ? `${typeof character.action.icon === "string" ? character.action.icon : "✦"} ${character.action.label}` : "no action"}
              </button>
              <button type="button" onClick={() => host()?.setStay(true, { say: true })}>📍 stay</button>
              <button type="button" onClick={() => host()?.setStay(false, { say: true })}>🌸 wander</button>
              <button type="button" onClick={() => host()?.closeMenu("outside")}>close menu</button>
              <button type="button" onClick={() => force([])}>let go</button>
              <button type="button" onClick={() => sim.current?.setHost(null) || setTimeout(() => loadCharacter(id).then((c) => sim.current?.setHost(c, { entrance: "drop" })), 300)}>drop in</button>
              <button type="button" onClick={() => sim.current?.ticker.resetStats()}>reset stats</button>
            </div>
          </div>
        )}
      </div>

      {tab === "stage" && <Stage hostId={id} options={options} controlRef={sim} name="kiriya" />}
    </div>
  );
}
