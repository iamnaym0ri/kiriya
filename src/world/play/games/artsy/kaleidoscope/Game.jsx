import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { haptic } from "../../../../../lib/native.js";
import { useCalm, useElementSize, usePageVisible, useSavedState, useToast } from "../_kit/hooks.js";
import { rewardOnce } from "../_kit/rewards.js";
import { canvasFile, useArtShare } from "../_kit/share.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import { BRUSHES, PALETTES, PAPERS, SIZE, SIZES, nearestCheckpoint, nextFold, symmetry, tidyPoints } from "./logic.js";
import { paintDrawing, paintStroke } from "./render.js";
import "../_kit/kit.css";
import "./kaleidoscope.css";

const START = { strokes: [], undone: [], palette: "dusk", paper: "night", n: 8, mirror: true, brush: "glow", size: 1, colour: 0, turns: false };
const CHECKPOINT_EVERY = 20;

export default function Kaleidoscope({ onReward }) {
  const [draft, setDraft] = useSavedState("kaleidoscope", START);
  const settings = { ...START, ...draft };
  const set = (change) => setDraft((old) => ({ ...START, ...old, ...change }));
  const palette = PALETTES.find((each) => each.id === settings.palette) ?? PALETTES[0];
  const paper = PAPERS.find((each) => each.id === settings.paper) ?? PAPERS[0];
  const calm = useCalm();
  const visible = usePageVisible();

  const stageRef = useRef(null), inkRef = useRef(null), liveRef = useRef(null);
  const stage = useElementSize(stageRef);
  const side = Math.max(120, Math.floor(Math.min(stage.width - 24, stage.height - 16)));
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const strokes = useRef(settings.strokes);
  const undone = useRef(settings.undone);
  const checkpoints = useRef(new Map());
  const active = useRef(null);
  const frame = useRef(0);
  const [, rerender] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [sharing, setSharing] = useState(false);

  const scale = () => (inkRef.current?.width ?? side * dpr) / SIZE;

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
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const canvas = liveRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (active.current) paintStroke(ctx, active.current, canvas.width / SIZE, false);
    });
  };
  function down(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (spinning) setSpinning(false);
    if (pointer.current !== null) {
      // A second finger: that's not drawing. Let the first stroke go.
      active.current = null;
      pointer.current = -1;
      paintLive();
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = event.pointerId;
    const colour = settings.turns ? palette.colors[strokes.current.filter((s) => s.tool !== "clear").length % palette.colors.length] : palette.colors[settings.colour] ?? palette.colors[0];
    active.current = { tool: settings.brush, color: colour, size: SIZES[settings.size] ?? SIZES[1], n: settings.n, mirror: settings.mirror, points: [toDrawing(event)] };
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
    paintStroke(inkRef.current.getContext("2d"), stroke, scale());
    remember();
    save();
    haptic("light");
  }
  function fresh() {
    if (!strokes.current.length || strokes.current.at(-1).tool === "clear") return;
    strokes.current = [...strokes.current, { tool: "clear" }];
    undone.current = [];
    redraw();
    save();
    rerender((n) => n + 1);
  }
  const blank = !strokes.current.length || strokes.current.at(-1).tool === "clear";

  // Spinning rests while the app is in the background, and never runs for less motion.
  useEffect(() => {
    if (calm) setSpinning(false);
  }, [calm]);

  return (
    <div className="artsy kal" data-paper={paper.id}>
      <div className="artsy-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="undo" disabled={!strokes.current.length} onClick={undo}>
          <UndoIcon />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="redo" disabled={!undone.current.length} onClick={redo}>
          <UndoIcon flip />
        </button>
        <div className="artsy-bar__grow" />
        {!calm && (
          <button type="button" className="artsy-chip" aria-pressed={spinning} disabled={blank} onClick={() => setSpinning((on) => !on)}>
            {spinning ? "stop" : "spin ✧"}
          </button>
        )}
        <button type="button" className="artsy-chip artsy-chip--primary" disabled={blank} onClick={() => setSharing(true)}>
          keep ♡
        </button>
      </div>
      <div className="kal-stage" ref={stageRef}>
        <div className="kal-plate" data-spin={spinning && visible} style={{ width: side, height: side, background: paper.fill }}>
          <canvas ref={inkRef} className="kal-canvas" aria-hidden="true" />
          <Guides n={settings.n} mirror={settings.mirror} colour={paper.guide} />
          <canvas
            ref={liveRef}
            className="kal-canvas kal-canvas--live"
            role="img"
            aria-label={`kaleidoscope drawing, ${settings.n} ${settings.mirror ? "mirrored " : ""}slices`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={(event) => event.pointerId === pointer.current && up(event)}
          />
          {blank && <p className="kal-hello artsy-hand">draw one little stroke ✧</p>}
        </div>
      </div>
      <div className="artsy-tray kal-tray">
        <div className="artsy-scroller kal-colours" role="radiogroup" aria-label="colours">
          <button type="button" className="artsy-chip kal-palette" onClick={() => set({ palette: PALETTES[(PALETTES.indexOf(palette) + 1) % PALETTES.length].id, colour: settings.colour })}>
            {palette.name} ↻
          </button>
          {palette.colors.map((colour, i) => (
            <button
              key={colour}
              type="button"
              role="radio"
              className="artsy-swatch"
              aria-checked={!settings.turns && settings.colour === i && settings.brush !== "eraser"}
              aria-pressed={!settings.turns && settings.colour === i && settings.brush !== "eraser"}
              aria-label={`colour ${i + 1}`}
              style={{ "--swatch": colour }}
              onClick={() => set({ colour: i, turns: false, brush: settings.brush === "eraser" ? "ink" : settings.brush })}
            />
          ))}
          <button type="button" className="artsy-chip" aria-pressed={settings.turns} onClick={() => set({ turns: !settings.turns, brush: settings.brush === "eraser" ? "ink" : settings.brush })}>
            ✧ take turns
          </button>
        </div>
        <div className="artsy-scroller kal-tools">
          <div className="kal-brushes" role="radiogroup" aria-label="brush">
            {BRUSHES.map((brush) => (
              <button key={brush.id} type="button" role="radio" aria-checked={settings.brush === brush.id} aria-label={brush.name} className="kal-brush" onClick={() => set({ brush: brush.id })}>
                <BrushIcon id={brush.id} />
              </button>
            ))}
          </div>
          <button type="button" className="artsy-chip" aria-label={`brush size ${["small", "medium", "big"][settings.size]}`} onClick={() => set({ size: (settings.size + 1) % SIZES.length })}>
            <span className="kal-size" style={{ "--d": `${6 + settings.size * 5}px` }} />
          </button>
          <button type="button" className="artsy-chip" aria-label={`${settings.n} slices`} onClick={() => set({ n: nextFold(settings.n) })}>
            ✿ {settings.n}
          </button>
          <button type="button" className="artsy-chip" aria-pressed={settings.mirror} onClick={() => set({ mirror: !settings.mirror })}>
            mirror
          </button>
          <button type="button" className="artsy-chip" aria-label={`paper: ${paper.name}`} onClick={() => set({ paper: PAPERS[(PAPERS.indexOf(paper) + 1) % PAPERS.length].id })}>
            <span className="kal-paper" style={{ background: paper.fill }} /> {paper.name}
          </button>
        </div>
      </div>
      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        make={() => paintDrawing(visibleStrokes(strokes.current), paper)}
        onShared={() => rewardOnce(onReward, "kaleidoscope", "first")}
        onFresh={() => {
          fresh();
          setSharing(false);
        }}
      />
    </div>
  );
}

/** Only what's on the page now (after the last "fresh page"). */
const visibleStrokes = (all) => all.slice(all.findLastIndex((stroke) => stroke.tool === "clear") + 1);

function ShareSheet({ open, onClose, make, onShared, onFresh }) {
  const { partner, toChat, toDoodles } = useArtShare();
  const [toast, showToast] = useToast();
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
  const error = toChat.error || toDoodles.error;
  return (
    <Sheet open={open} title="a little kaleidoscope" onClose={onClose}>
      <div className="kal-share">
        <div className="kal-share__preview">{preview ? <img src={preview} alt="your kaleidoscope" /> : <span className="artsy-hand">turning it into a picture…</span>}</div>
        <div className="kal-share__buttons">
          <button
            type="button"
            className="artsy-primary"
            disabled={toChat.isPending || toChat.isSuccess}
            onClick={() => toChat.mutate({ make: file, alt: "a kaleidoscope drawing" }, { onSuccess: () => { showToast(`sent to ${partner} ♡`); onShared(); } })}
          >
            {toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner} ♡`}
          </button>
          <button
            type="button"
            className="artsy-secondary"
            disabled={toDoodles.isPending || toDoodles.isSuccess}
            onClick={() => toDoodles.mutate({ make: file, title: "a little kaleidoscope" }, { onSuccess: () => { showToast("tucked into your doodles ♡"); onShared(); } })}
          >
            {toDoodles.isPending ? "keeping…" : toDoodles.isSuccess ? "in your doodles ✓" : "keep in my doodles"}
          </button>
        </div>
        {error && <p className="artsy-error" role="alert">{error.message || "That didn’t go through. Try again?"}</p>}
        <button type="button" className="artsy-chip kal-share__fresh" onClick={onFresh}>
          start a fresh one <small>(undo brings this back)</small>
        </button>
      </div>
      <Toast text={toast} />
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

const UndoIcon = ({ flip }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" />
  </svg>
);

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
