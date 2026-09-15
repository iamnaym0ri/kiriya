import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getStroke } from "perfect-freehand";
import "./DrawingCanvas.css";

const PAPERS = {
  white: { label: "Paper", fill: "#ffffff" },
  lavender: { label: "Lavender", fill: "#f1e8ff" },
  night: { label: "Night", fill: "#19083a" },
};
const SIZES = [4, 10, 24];

// perfect-freehand gives an outline polygon; this turns it into a smooth SVG path for Path2D.
function outlineToPath(points) {
  if (points.length < 4) return "";
  const avg = (a, b) => (a + b) / 2;
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)} Q${points[1][0].toFixed(2)},${points[1][1].toFixed(2)} ${avg(points[1][0], points[2][0]).toFixed(2)},${avg(points[1][1], points[2][1]).toFixed(2)} T`;
  for (let i = 2; i < points.length - 1; i++) {
    d += `${avg(points[i][0], points[i + 1][0]).toFixed(2)},${avg(points[i][1], points[i + 1][1]).toFixed(2)} `;
  }
  return `${d}Z`;
}

function strokePath(stroke, logicalSize) {
  const outline = getStroke(stroke.points, {
    size: stroke.size * (logicalSize / 800),
    thinning: stroke.pen ? 0.7 : 0.5,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: !stroke.pen,
    last: stroke.done,
  });
  return new Path2D(outlineToPath(outline));
}

/**
 * A pressure-aware canvas: Apple Pencil pressure when there is one, simulated pressure for fingers.
 * Strokes are kept as data, so undo/redo and redraws stay crisp at any screen density.
 */
export default function DrawingCanvas({
  color,
  size,
  tool,
  paper,
  ref,
  onChange,
  initialDrawing,
  aspect = 1.25,
  label = "Drawing canvas",
}) {
  const wrapRef = useRef(null);
  const inkRef = useRef(null);
  const strokes = useRef(initialDrawing?.strokes ?? []);
  const undone = useRef(initialDrawing?.undone ?? []);
  const active = useRef(null);
  const frame = useRef(0);
  const [logical, setLogical] = useState(800);

  const redraw = useCallback(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const scale = canvas.width / logical;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const all = active.current
      ? [...strokes.current, active.current]
      : strokes.current;
    for (const stroke of all) {
      ctx.globalCompositeOperation =
        stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.fillStyle = stroke.tool === "eraser" ? "#000" : stroke.color;
      ctx.fill(strokePath(stroke, logical));
    }
    ctx.globalCompositeOperation = "source-over";
  }, [logical]);

  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(redraw);
  }, [redraw]);

  // Size the backing store to the element and the screen density (capped for memory on phones).
  useEffect(() => {
    const canvas = inkRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(width * aspect * dpr);
      setLogical(800);
      scheduleRedraw();
    });
    observer.observe(wrapRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [scheduleRedraw, aspect]);

  const toLogical = (event) => {
    const rect = inkRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * logical;
    const y = ((event.clientY - rect.top) / rect.height) * logical * aspect;
    const pressure =
      event.pointerType === "pen" ? Math.max(0.05, event.pressure) : 0.5;
    return [x, y, pressure];
  };

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = {
      points: [toLogical(event)],
      color,
      size,
      tool,
      pen: event.pointerType === "pen",
      done: false,
    };
    undone.current = [];
    scheduleRedraw();
  }

  function onPointerMove(event) {
    if (!active.current) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const list = events.length ? events : [event.nativeEvent];
    for (const e of list) active.current.points.push(toLogical(e));
    scheduleRedraw();
  }

  function onPointerUp() {
    if (!active.current) return;
    active.current.done = true;
    strokes.current = [...strokes.current, active.current];
    active.current = null;
    scheduleRedraw();
    onChange?.({
      count: strokes.current.length,
      canUndo: true,
      canRedo: false,
    });
  }

  useImperativeHandle(ref, () => ({
    snapshot() {
      return {
        strokes: strokes.current.slice(),
        undone: undone.current.slice(),
      };
    },
    undo() {
      if (!strokes.current.length) return;
      undone.current.push(strokes.current.at(-1));
      strokes.current = strokes.current.slice(0, -1);
      scheduleRedraw();
      onChange?.({
        count: strokes.current.length,
        canUndo: strokes.current.length > 0,
        canRedo: true,
      });
    },
    redo() {
      const stroke = undone.current.pop();
      if (!stroke) return;
      strokes.current = [...strokes.current, stroke];
      scheduleRedraw();
      onChange?.({
        count: strokes.current.length,
        canUndo: true,
        canRedo: undone.current.length > 0,
      });
    },
    clear() {
      undone.current = [...strokes.current].reverse();
      strokes.current = [];
      scheduleRedraw();
      onChange?.({
        count: 0,
        canUndo: false,
        canRedo: undone.current.length > 0,
      });
    },
    /** Paper plus ink, flattened into a PNG file. */
    async export(maxWidth = 1600) {
      const ink = inkRef.current;
      const width = Math.min(maxWidth, ink.width);
      const height = Math.round(width * aspect);
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const ctx = out.getContext("2d");
      ctx.fillStyle = PAPERS[paper].fill;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(ink, 0, 0, width, height);
      const blob = await new Promise((resolve) =>
        out.toBlob(resolve, "image/png"),
      );
      return {
        file: new File([blob], `kiriya-drawing-${Date.now()}.png`, {
          type: "image/png",
        }),
        width,
        height,
      };
    },
  }));

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      data-paper={paper}
      style={{ aspectRatio: `1 / ${aspect}` }}
    >
      <canvas
        ref={inkRef}
        className="canvas-ink"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={label}
        role="img"
      />
    </div>
  );
}

export { PAPERS, SIZES };
