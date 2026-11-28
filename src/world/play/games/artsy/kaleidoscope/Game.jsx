import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { haptic } from "../../../../../lib/native.js";
import { burst } from "../_kit/confetti.js";
import { useCalm, useElementSize, usePageVisible, useSavedState, useToast } from "../_kit/hooks.js";
import { countMade, rewardOnce } from "../_kit/rewards.js";
import { canvasFile, useArtShare, useOpenGallery } from "../_kit/share.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import { BRUSHES, PALETTES, PAPERS, SIZE, SIZES, SIZE_NAMES, SLICE_CHOICES, isBlank, nearestCheckpoint, strokeColour, symmetry, tidyPoints, visibleStrokes } from "./logic.js";
import { paintDrawing, paintStroke } from "./render.js";
import "../_kit/kit.css";
import "./kaleidoscope.css";
import { useIsAdmin } from "../../../../../lib/session.js";

// The kaleidoscope: one stroke inside the round plate is turned and mirrored into a flower.
// Layout, top to bottom: undo / redo / clear and spin / save; the plate (a coach mark until her
// first stroke); colours; a dock of labelled tools (brush, size, slices, mirror, paper). Her plate
// is kept on the phone as she draws, so leaving the game never loses it.

const START = { strokes: [], undone: [], palette: "dusk", paper: "night", n: 8, mirror: true, brush: "glow", size: 1, colour: 0, turns: false, hinted: false };
const CHECKPOINT_EVERY = 20;

export default function Kaleidoscope({ onReward }) {
  // Written in her pauses (each stroke pushes it back), and at once when the app goes to the background.
  const [draft, setDraft] = useSavedState("kaleidoscope", START, 2000);
  const settings = { ...START, ...draft };
  const set = (change) => setDraft((old) => ({ ...START, ...old, ...change }));
  const palette = PALETTES.find((each) => each.id === settings.palette) ?? PALETTES[0];
  const paper = PAPERS.find((each) => each.id === settings.paper) ?? PAPERS[0];
  const brush = BRUSHES.find((each) => each.id === settings.brush) ?? BRUSHES[0];
  const calm = useCalm();
  const visible = usePageVisible();

  const stageRef = useRef(null), inkRef = useRef(null), liveRef = useRef(null), confettiRef = useRef(null);
  const stage = useElementSize(stageRef);
  const side = Math.max(120, Math.floor(Math.min(stage.width - 24, stage.height - 20)));
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const strokes = useRef(settings.strokes);
  const undone = useRef(settings.undone);
  const checkpoints = useRef(new Map());
  const active = useRef(null);
  const frame = useRef(0);
  const [, rerender] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pop, setPop] = useState(null); // "brush" | "slices" | "palette"
  const [coachLeaving, setCoachLeaving] = useState(false);
  const [toast, showToast] = useToast();

  const scale = () => (inkRef.current?.width ?? side * dpr) / SIZE;
  const blank = isBlank(strokes.current);
  const showCoach = (!settings.hinted && blank) || coachLeaving;

  // ---------- drawing what's there ----------
  const redraw = useCallback((count = strokes.current.length) => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const start = nearestCheckpoint(checkpoints.current, count);
    if (start) ctx.drawImage(checkpoints.current.get(start), 0, 0);
    for (let i = start; i < count; i++) paintStroke(ctx, strokes.current[i], canvas.width / SIZE);
  }, []);
  const remember = () => {
    const count = strokes.current.length;
    if (!count || count % CHECKPOINT_EVERY) return;
    const copy = document.createElement("canvas");
    copy.width = inkRef.current.width;
    copy.height = inkRef.current.height;
    copy.getContext("2d").drawImage(inkRef.current, 0, 0);
    checkpoints.current.set(count, copy);
    if (checkpoints.current.size > 6) checkpoints.current.delete(Math.min(...checkpoints.current.keys()));
  };
  useLayoutEffect(() => {
    if (!stage.width) return;
    for (const canvas of [inkRef.current, liveRef.current]) canvas.width = canvas.height = Math.round(side * dpr);
    checkpoints.current.clear();
    redraw();
  }, [side, dpr, stage.width, redraw]);

  const save = () => set({ strokes: strokes.current, undone: undone.current });

  // ---------- her finger ----------
  const pointer = useRef(null);
  const toDrawing = (event) => {
    const rect = liveRef.current.getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * SIZE, ((event.clientY - rect.top) / rect.height) * SIZE, event.pointerType === "pen" ? Math.max(0.1, event.pressure) : 0.5];
  };
  const paintLive = () => {
    if (frame.current) return; // one paint per frame, however many moves arrive
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const canvas = liveRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (active.current) paintStroke(ctx, active.current, canvas.width / SIZE, false);
    });
  };
  function down(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    if (pop) setPop(null);
    if (spinning) setSpinning(false);
    if (pointer.current !== null) {
      // A second finger: that's not drawing. Let the first stroke go.
      active.current = null;
      pointer.current = -1;
      setDrawing(false);
      paintLive();
      return;
    }
    if (!settings.hinted) {
      set({ hinted: true });
      setCoachLeaving(true);
      setTimeout(() => setCoachLeaving(false), 360);
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = event.pointerId;
    const colour = strokeColour(settings, palette, strokes.current);
    active.current = { tool: settings.brush, color: colour, size: SIZES[settings.size] ?? SIZES[1], n: settings.n, mirror: settings.mirror, points: [toDrawing(event)] };
    setDrawing(true);
    paintLive();
  }
  function move(event) {
    if (!active.current || event.pointerId !== pointer.current) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const each of events.length ? events : [event.nativeEvent]) active.current.points.push(toDrawing(each));
    paintLive();
  }
  function up(event) {
    if (pointer.current === -1) {
      if (event.isPrimary || event.type === "pointercancel") pointer.current = null;
      return;
    }
    if (event.pointerId !== pointer.current) return;
    pointer.current = null;
    const stroke = active.current;
    active.current = null;
    setDrawing(false);
    paintLive();
    if (!stroke || event.type === "pointercancel") return;
    stroke.points = tidyPoints(stroke.points);
    for (const at of [...checkpoints.current.keys()]) if (at > strokes.current.length) checkpoints.current.delete(at);
    strokes.current = [...strokes.current, stroke];
    undone.current = [];
    paintStroke(inkRef.current.getContext("2d"), stroke, scale());
    remember();
    save();
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function undo() {
    if (!strokes.current.length) return;
    undone.current = [...undone.current, strokes.current.at(-1)];
    strokes.current = strokes.current.slice(0, -1);
    redraw();
    save();
    haptic("light");
  }
  function redo() {
    if (!undone.current.length) return;
    const stroke = undone.current.at(-1);
    undone.current = undone.current.slice(0, -1);
    strokes.current = [...strokes.current, stroke];
    if (stroke.tool === "clear") redraw();
    else paintStroke(inkRef.current.getContext("2d"), stroke, scale());
    remember();
    save();
    haptic("light");
  }
  /** A fresh plate. It's one more step in the history, so undo brings the drawing back. */
  function fresh({ quiet = false } = {}) {
    if (isBlank(strokes.current)) return;
    strokes.current = [...strokes.current, { tool: "clear" }];
    undone.current = [];
    setSpinning(false);
    redraw();
    save();
    rerender((n) => n + 1);
    haptic("medium");
    if (!quiet) showToast("a fresh plate · undo brings it back");
  }

  // Spinning rests while the app is in the background, and never runs for less motion.
  useEffect(() => {
    if (calm) setSpinning(false);
  }, [calm]);

  const togglePop = (name) => setPop((open) => (open === name ? null : name));

  return (
    <div className="artsy kal" data-paper={paper.id}>
      <div className="artsy-bar kal-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="undo" disabled={!strokes.current.length} onClick={undo}>
          <UndoIcon />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="redo" disabled={!undone.current.length} onClick={redo}>
          <UndoIcon flip />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="clear the plate" disabled={blank} onClick={() => fresh()}>
          <TrashIcon />
        </button>
        <div className="artsy-bar__grow" />
        {!calm && (
          <button type="button" className="artsy-chip kal-spin" aria-pressed={spinning} disabled={blank} onClick={() => setSpinning((on) => !on)}>
            <SpinIcon />
            {spinning ? "stop" : "spin"}
          </button>
        )}
        <button type="button" className="artsy-chip artsy-chip--primary" disabled={blank} onClick={() => { setSpinning(false); setPop(null); setSharing(true); }}>
          <HeartIcon />
          save
        </button>
      </div>

      <div className="kal-stage" ref={stageRef}>
        <div className="kal-well" style={{ width: side, height: side }} data-blank={blank || undefined} data-calm={calm || undefined}>
          <span className="kal-halo" aria-hidden="true" />
          <div className="kal-plate" data-spin={spinning && visible} data-drawing={drawing || undefined} style={{ background: paper.fill }}>
            <canvas ref={inkRef} className="kal-canvas" aria-hidden="true" />
            <Guides n={settings.n} mirror={settings.mirror} colour={paper.guide} />
            <canvas
              ref={liveRef}
              className="kal-canvas kal-canvas--live"
              role="img"
              aria-label={`kaleidoscope plate, ${settings.n} ${settings.mirror ? "mirrored " : ""}slices. draw with one finger.`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onLostPointerCapture={(event) => event.pointerId === pointer.current && up(event)}
              onContextMenu={(event) => event.preventDefault()}
            />
            {showCoach && <Coach n={settings.n} mirror={settings.mirror} calm={calm} leaving={coachLeaving} night={paper.id === "night"} />}
            {!showCoach && blank && <p className="kal-hello artsy-hand">draw here ♡</p>}
          </div>
        </div>
      </div>

      {pop && <button type="button" className="kal-pop-backdrop" aria-label="close" tabIndex={-1} onClick={() => setPop(null)} />}
      <div className="artsy-tray kal-tray">
        {pop === "brush" && (
          <Pop title="brush">
            <div className="kal-pop__grid kal-pop__grid--brushes" role="radiogroup" aria-label="brush">
              {BRUSHES.map((each) => (
                <button key={each.id} type="button" role="radio" aria-checked={settings.brush === each.id} className="kal-option" onClick={() => { set({ brush: each.id }); setPop(null); haptic("light"); }}>
                  <BrushIcon id={each.id} />
                  <strong>{each.name}</strong>
                  <small>{each.line}</small>
                </button>
              ))}
            </div>
          </Pop>
        )}
        {pop === "slices" && (
          <Pop title="slices">
            <div className="kal-pop__slices" role="radiogroup" aria-label="slices">
              {SLICE_CHOICES.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={settings.n === n} aria-label={`${n} slices`} className="kal-slice" onClick={() => { set({ n }); setPop(null); haptic("light"); }}>
                  <SliceIcon n={n} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          </Pop>
        )}
        {pop === "palette" && (
          <Pop title="colours">
            <div className="kal-pop__grid" role="radiogroup" aria-label="palette">
              {PALETTES.map((each) => (
                <button key={each.id} type="button" role="radio" aria-checked={palette.id === each.id} className="kal-palette-option" onClick={() => { set({ palette: each.id }); setPop(null); haptic("light"); }}>
                  <span className="kal-palette-option__dots" aria-hidden="true">
                    {each.colors.map((colour) => <i key={colour} style={{ background: colour }} />)}
                  </span>
                  <span>{each.name}</span>
                </button>
              ))}
            </div>
          </Pop>
        )}

        <div className="kal-colours" role="radiogroup" aria-label={`colours, ${palette.name}`}>
          <button type="button" className="kal-swatch kal-swatch--palette" aria-label={`change colours (now ${palette.name})`} aria-expanded={pop === "palette"} onClick={() => togglePop("palette")}>
            <PaletteIcon colours={palette.colors} />
          </button>
          {palette.colors.map((colour, i) => {
            const on = !settings.turns && settings.colour === i && settings.brush !== "eraser";
            return (
              <button
                key={`${palette.id}${i}`}
                type="button"
                role="radio"
                className="kal-swatch"
                aria-checked={on}
                aria-label={`colour ${i + 1}`}
                style={{ "--swatch": colour }}
                onClick={() => { set({ colour: i, turns: false, brush: settings.brush === "eraser" ? "ink" : settings.brush }); haptic("light"); }}
              />
            );
          })}
          <button
            type="button"
            role="radio"
            className="kal-swatch kal-swatch--rainbow"
            aria-checked={settings.turns && settings.brush !== "eraser"}
            aria-label="rainbow: each stroke takes the next colour"
            style={{ "--swatch": `conic-gradient(${palette.colors.join(", ")}, ${palette.colors[0]})` }}
            onClick={() => { set({ turns: true, brush: settings.brush === "eraser" ? "ink" : settings.brush }); haptic("light"); }}
          />
        </div>

        <div className="kal-dock" role="toolbar" aria-label="tools">
          <DockButton label={brush.name} hint="brush" expanded={pop === "brush"} onClick={() => togglePop("brush")}>
            <BrushIcon id={brush.id} />
          </DockButton>
          <DockButton label={SIZE_NAMES[settings.size] ?? "medium"} hint="brush size" onClick={() => { set({ size: (settings.size + 1) % SIZES.length }); haptic("light"); }}>
            <span className="kal-size" style={{ "--d": `${6 + settings.size * 6}px` }} />
          </DockButton>
          <DockButton label={`${settings.n} slices`} hint="slices" expanded={pop === "slices"} onClick={() => togglePop("slices")}>
            <SliceIcon n={settings.n} />
          </DockButton>
          <DockButton label={settings.mirror ? "mirror" : "no mirror"} hint="mirror each slice" pressed={settings.mirror} onClick={() => { set({ mirror: !settings.mirror }); haptic("light"); }}>
            <MirrorIcon on={settings.mirror} />
          </DockButton>
          <DockButton label={paper.name} hint="paper" onClick={() => { set({ paper: PAPERS[(PAPERS.indexOf(paper) + 1) % PAPERS.length].id }); haptic("light"); }}>
            <span className="kal-paper" style={{ background: paper.fill }} />
          </DockButton>
        </div>
      </div>

      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        make={() => paintDrawing(visibleStrokes(strokes.current), paper)}
        onSent={() => rewardOnce(onReward, "kaleidoscope", "first")}
        onKept={() => {
          if (!calm) burst(confettiRef.current, { y: 0.45, power: 1.2 });
          rewardOnce(onReward, "kaleidoscope", "first");
          if (countMade("kaleidoscope") >= 5) rewardOnce(onReward, "kaleidoscope", "five");
        }}
        onFresh={() => {
          fresh({ quiet: true });
          setSharing(false);
          showToast("a fresh plate · undo brings the last one back");
        }}
      />
      <canvas ref={confettiRef} className="kal-confetti" aria-hidden="true" />
      <Toast text={toast} />
    </div>
  );
}

function DockButton({ label, hint, expanded, pressed, onClick, children }) {
  return (
    <button
      type="button"
      className="kal-dock__button"
      aria-label={`${hint}: ${label}`}
      aria-expanded={expanded}
      aria-pressed={pressed}
      data-on={expanded || pressed || undefined}
      onClick={onClick}
    >
      <span className="kal-dock__icon" aria-hidden="true">
        {children}
      </span>
      <span className="kal-dock__label" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}

function Pop({ title, children }) {
  return (
    <section className="kal-pop" aria-label={title}>
      <h3 className="kal-pop__title">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The first-time hint: a fingertip draws one little curve in the top slice while its copies bloom
 * around the plate. It fades away with her first touch and doesn't come back.
 */
function Coach({ n, mirror, calm, leaving, night }) {
  const d = "M500 452C482 404 548 384 532 330S470 262 510 214";
  const copies = symmetry(n, mirror);
  return (
    <div className="kal-coach" data-leaving={leaving || undefined} data-night={night || undefined} aria-hidden="true">
      <svg viewBox="0 0 1000 1000">
        {copies.map(({ angle, flip }, i) => (
          <path
            key={i}
            d={d}
            pathLength="100"
            className="kal-coach__stroke"
            data-main={i === 0 || undefined}
            strokeDasharray={calm ? undefined : "100 100"}
            transform={`translate(500 500) rotate(${(angle * 180) / Math.PI})${flip ? " scale(1 -1)" : ""} translate(-500 -500)`}
          >
            {!calm && <animate attributeName="stroke-dashoffset" values="100;0;0" keyTimes="0;0.72;1" dur="2.8s" repeatCount="indefinite" />}
          </path>
        ))}
        <g className="kal-coach__finger">
          <circle r="30" />
          <circle r="11" className="kal-coach__tip" />
          {calm ? <animateMotion dur="0.01s" fill="freeze" path={d} keyPoints="1;1" keyTimes="0;1" /> : <animateMotion dur="2.8s" repeatCount="indefinite" path={d} keyPoints="0;1;1" keyTimes="0;0.72;1" calcMode="linear" />}
        </g>
      </svg>
      <p className="kal-coach__words artsy-hand">
        draw inside the circle
        <br />
        <b>every stroke blooms ♡</b>
      </p>
    </div>
  );
}

function ShareSheet({ open, onClose, make, onSent, onKept, onFresh }) {
  // On Josh's phone a keep is only a try: her gallery holds her pieces alone.
  const admin = useIsAdmin();
  const { partner, toChat, toDoodles } = useArtShare();
  const openGallery = useOpenGallery();
  const [preview, setPreview] = useState(null);
  const canvas = useRef(null);
  useEffect(() => {
    if (!open) return;
    toChat.reset();
    toDoodles.reset();
    canvas.current = make();
    let url = null;
    canvas.current.toBlob((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
    }, "image/png");
    return () => {
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const file = () => canvasFile(canvas.current, "kaleidoscope");
  const kept = toDoodles.data ?? null;
  const error = toChat.error || toDoodles.error;
  const keep = () => toDoodles.mutate({ make: file, title: "a little kaleidoscope" }, { onSuccess: onKept });
  const send = () => toChat.mutate({ make: file, alt: "a kaleidoscope drawing" }, { onSuccess: onSent });
  const sendLabel = toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner}`;
  return (
    <Sheet open={open} title={kept ? "kept, just for you ♡" : "save your kaleidoscope"} onClose={onClose}>
      <div className="kal-share" data-kept={kept ? "true" : undefined}>
        <div className="kal-share__frame">
          <div className="kal-share__preview">{preview ? <img src={preview} alt="your kaleidoscope" /> : <span className="artsy-hand">turning it into a picture…</span>}</div>
          {kept && <span className="kal-share__stamp artsy-hand">{admin ? "a try ♡ only hers go in her gallery" : "in your gallery ♡"}</span>}
        </div>
        {kept ? (
          <div className="kal-share__buttons">
            <button type="button" className="artsy-primary" onClick={() => openGallery(kept.id)}>
              see it in my gallery
            </button>
            <button type="button" className="artsy-secondary" onClick={onClose}>
              keep drawing
            </button>
          </div>
        ) : (
          <div className="kal-share__buttons">
            <button type="button" className="artsy-primary" disabled={toDoodles.isPending || !preview} onClick={keep}>
              {toDoodles.isPending ? "keeping…" : "keep in my gallery ♡"}
            </button>
            <button type="button" className="artsy-secondary" disabled={toChat.isPending || toChat.isSuccess || !preview} onClick={send}>
              {sendLabel}
            </button>
          </div>
        )}
        {kept && (
          <button type="button" className="artsy-chip kal-share__also" disabled={toChat.isPending || toChat.isSuccess} onClick={send}>
            {toChat.isSuccess ? sendLabel : `also ${sendLabel} ♡`}
          </button>
        )}
        {error && (
          <p className="artsy-error" role="alert">
            {error.message || "That didn’t go through. Try again?"}
          </p>
        )}
        <button type="button" className="artsy-chip kal-share__fresh" onClick={onFresh}>
          start a fresh plate
        </button>
      </div>
    </Sheet>
  );
}

function Guides({ n, mirror, colour }) {
  const lines = symmetry(mirror ? n * 2 : n, false).map(({ angle }) => angle);
  return (
    <svg className="kal-guides" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {lines.map((angle) => (
        <line key={angle} x1={SIZE / 2} y1={SIZE / 2} x2={SIZE / 2 + Math.cos(angle - Math.PI / 2) * SIZE} y2={SIZE / 2 + Math.sin(angle - Math.PI / 2) * SIZE} stroke={colour} strokeWidth="2" strokeDasharray="6 10" />
      ))}
      <circle cx={SIZE / 2} cy={SIZE / 2} r="6" fill={colour} />
    </svg>
  );
}

// ---------- icons (24 × 24, drawn in the tool's colour) ----------
const line = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };

const UndoIcon = ({ flip }) => (
  <svg viewBox="0 0 24 24" {...line} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
    <path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <path d="M4.5 7h15M9.5 7V4.8c0-.5.4-.8.8-.8h3.4c.5 0 .8.4.8.8V7M6.5 7l.9 12.2c.1.9.8 1.6 1.7 1.6h5.8c.9 0 1.6-.7 1.7-1.6L17.5 7M10.2 11v6M13.8 11v6" />
  </svg>
);
const SpinIcon = () => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" />
    <path d="M12 9.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" fill="currentColor" stroke="none" />
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20.2C8.1 17.4 3.6 14 3.6 9.6 3.6 7 5.6 5 8 5c1.7 0 3.1.9 4 2.3C12.9 5.9 14.3 5 16 5c2.4 0 4.4 2 4.4 4.6 0 4.4-4.5 7.8-8.4 10.6Z" fill="currentColor" />
  </svg>
);
function PaletteIcon({ colours }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="12.5" r="7" fill={colours[0]} stroke="#fff" strokeWidth="1.6" />
      <circle cx="20.5" cy="13" r="7" fill={colours[1]} stroke="#fff" strokeWidth="1.6" />
      <circle cx="16" cy="20.5" r="7" fill={colours[2]} stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}
function SliceIcon({ n }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} cx="16" cy={n > 8 ? 9 : 8.5} rx={n > 8 ? 2.4 : n > 5 ? 3.2 : 4} ry="6.5" transform={`rotate(${(360 / n) * i} 16 16)`} fill="currentColor" opacity={i % 2 ? 0.55 : 0.9} />
      ))}
      <circle cx="16" cy="16" r="2.6" fill="#fff4cf" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function MirrorIcon({ on }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M14 7C8 8 5 14 7 22c3-1 5-4 7-6Z" fill="currentColor" opacity="0.9" />
      <path d="M18 7c6 1 9 7 7 15-3-1-5-4-7-6Z" fill="currentColor" opacity={on ? 0.9 : 0.22} />
      <path d="M16 4v24" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2.6" strokeLinecap="round" />
    </svg>
  );
}
function BrushIcon({ id }) {
  if (id === "beads")
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        {[6, 12, 18, 24].map((x, i) => (
          <circle key={x} cx={x + 1} cy={22 - i * 4} r="3" fill="currentColor" />
        ))}
      </svg>
    );
  if (id === "eraser")
    return (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 20 17 9l8 8-9 9h-6Z" />
        <path d="M12 14l8 8M10 26h16" />
      </svg>
    );
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {id === "glow" && <path d="M5 23C11 9 19 25 27 9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="9" fill="none" strokeLinecap="round" />}
      <path d="M5 23C11 9 19 25 27 9" stroke="currentColor" strokeWidth={id === "glow" ? 3.4 : 4} fill="none" strokeLinecap="round" />
    </svg>
  );
}
