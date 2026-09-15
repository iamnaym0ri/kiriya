import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { PAPERS, SIZES, drawingHistory, isShape, renderInk, renderPaper } from "./drawingTools.js";
import "./DrawingCanvas.css";

/** Keeps editable strokes in logical coordinates, independent of display/export size. */
export default function DrawingCanvas({ color, size, tool, paper, ref, onChange, initialDrawing,
  opacity = 1, mirror = false, fill = true, disabled = false, aspect = 1.25, label = "Drawing canvas" }) {
  const wrapRef = useRef(null), inkRef = useRef(null), paperRef = useRef(null);
  const strokes = useRef([...(initialDrawing?.strokes ?? [])]);
  const undone = useRef([...(initialDrawing?.undone ?? [])]);
  const active = useRef(null), pointer = useRef(null), frame = useRef(0);
  const redraw = useCallback(() => {
    const ink = inkRef.current, page = paperRef.current;
    if (!ink?.width) return;
    renderPaper(page.getContext("2d"), paper, page.width, page.height);
    renderInk(ink.getContext("2d"), active.current ? [...strokes.current, active.current] : strokes.current, ink.width, ink.height);
  }, [paper]);
  const schedule = useCallback(() => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(redraw); }, [redraw]);
  useEffect(() => {
    let disposed = false;
    const observer = new ResizeObserver(([entry]) => {
      if (disposed || !inkRef.current || !paperRef.current) return;
      const width = Math.max(1, Math.round(entry.contentRect.width * Math.min(window.devicePixelRatio || 1, 2.5)));
      for (const canvas of [inkRef.current, paperRef.current]) { canvas.width = width; canvas.height = Math.round(width * aspect); }
      schedule();
    });
    observer.observe(wrapRef.current);
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, [aspect, schedule]);
  const change = () => { schedule(); onChange?.(drawingHistory(strokes.current, undone.current)); };
  const point = event => {
    const rect = inkRef.current.getBoundingClientRect();
    return [(event.clientX - rect.left) / rect.width * 800, (event.clientY - rect.top) / rect.height * 800 * aspect,
      event.pointerType === "pen" ? Math.max(.05, event.pressure) : .5];
  };
  function down(event) {
    if (disabled || active.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId;
    active.current = { points: [point(event)], color, size, tool, opacity, mirror, fill, pen: event.pointerType === "pen", done: false };
    schedule();
  }
  function move(event) {
    if (!active.current || event.pointerId !== pointer.current) return;
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = (coalesced.length ? coalesced : [event.nativeEvent]).map(point);
    active.current.points = isShape(active.current.tool) ? [active.current.points[0], points.at(-1)] : [...active.current.points, ...points];
    schedule();
  }
  function up(event) {
    if (!active.current || event.pointerId !== pointer.current) return;
    active.current.done = true;
    strokes.current = [...strokes.current, active.current]; undone.current = [];
    active.current = null; pointer.current = null; change();
  }
  function cancel(event) {
    if (event.pointerId !== pointer.current) return;
    active.current = null; pointer.current = null; schedule();
  }
  function undo() {
    if (disabled || active.current || !strokes.current.length) return;
    undone.current.push(strokes.current.at(-1)); strokes.current = strokes.current.slice(0, -1); change();
  }
  function redo() {
    if (disabled || active.current || !undone.current.length) return;
    strokes.current = [...strokes.current, undone.current.pop()]; change();
  }
  useImperativeHandle(ref, () => ({
    snapshot: () => ({ strokes: strokes.current.slice(), undone: undone.current.slice() }), undo, redo,
    clear() { if (disabled) return; strokes.current = [...strokes.current, { tool: "clear" }]; undone.current = []; change(); },
    reset() { if (disabled) return; strokes.current = []; undone.current = []; change(); },
    async export(maxWidth = 1600) {
      const width = maxWidth, height = Math.round(width * aspect);
      const out = document.createElement("canvas"), ink = document.createElement("canvas");
      out.width = ink.width = width; out.height = ink.height = height;
      renderInk(ink.getContext("2d"), strokes.current, width, height);
      const ctx = out.getContext("2d"); renderPaper(ctx, paper, width, height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ink, 0, 0);
      const blob = await new Promise(resolve => out.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The image couldn't be made. Please try again.");
      return { file: new File([blob], `kiriya-doodle-${Date.now()}.png`, { type: "image/png" }), width, height };
    },
  }));
  return <div className="canvas-wrap" ref={wrapRef} data-paper={paper} data-mirror={mirror} style={{ aspectRatio: `1 / ${aspect}`, background: PAPERS[paper]?.fill }}>
    <canvas ref={paperRef} className="canvas-paper" aria-hidden="true" />
    <canvas ref={inkRef} className="canvas-ink" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={up}
      onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) { event.preventDefault(); event.shiftKey || event.key.toLowerCase() === "y" ? redo() : undo(); } }}
      aria-label={label} aria-description="Draw with your finger, mouse or stylus. Control or Command Z undoes a mark; Shift Z redoes it." aria-disabled={disabled} tabIndex={0} role="img" />
    {mirror && <span className="canvas-mirror-guide" aria-hidden="true" />}
  </div>;
}
export { PAPERS, SIZES };
