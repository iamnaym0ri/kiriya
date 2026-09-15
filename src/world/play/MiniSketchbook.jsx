import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DrawingCanvas from "../studio/DrawingCanvas.jsx";
import { useSketchPages } from "../studio/SketchbookState.jsx";
import { uploadFile } from "../../lib/uploads.js";
import { api } from "../../lib/api.js";
import { Bow, usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import { celebrate } from "../../shared/effects.js";
import "./PlayDesk.css";
const INKS = ["#674c87", "#d185ad", "#39968e", "#493653", "#edba69"];
export default function MiniSketchbook() {
  const pages = useSketchPages();
  const initial = useRef(pages.current.mini).current;
  const canvas = useRef(null);
  const [ink, setInk] = useState(initial?.ink ?? INKS[0]);
  const [history, setHistory] = useState({
    count: initial?.drawing?.strokes?.length ?? 0,
    canUndo: Boolean(initial?.drawing?.strokes?.length),
  });
  const [kept, setKept] = useState(initial?.kept ?? false);
  const client = useQueryClient();
  const { moving } = usePlayful();
  const save = useMutation({
    mutationFn: async () => {
      const { file, width, height } = await canvas.current.export(1000);
      const stored = await uploadFile(file, { folder: "art" });
      return api("/me/artworks", {
        method: "POST",
        body: { ...stored, width, height, prompt: "A little birthday doodle" },
      });
    },
    onSuccess: () => {
      setKept(true);
      if (pages.current.mini) pages.current.mini.kept = true;
      client.invalidateQueries({ queryKey: ["me", "artworks"] });
      if (moving) celebrate({ x: 0.7, y: 0.55 }, 0.3);
    },
  });
  return (
    <section
      className="mini-sketchbook"
      aria-labelledby="doodle-title"
      data-motion-region
    >
      <Bow />
      <span className="pixel-label">ONE LITTLE PAGE, JUST FOR YOU</span>
      <h2 id="doodle-title">
        Leave a little <em>doodle.</em>
      </h2>
      <p>A flower? A tiny cat? Whatever’s in your head. 🎨</p>
      <div
        className="doodle-paper"
        aria-busy={save.isPending}
        style={save.isPending ? { pointerEvents: "none" } : undefined}
      >
        <div className="notebook-rings" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <DrawingCanvas
          ref={canvas}
          initialDrawing={initial?.drawing}
          color={ink}
          size={10}
          tool="pen"
          paper="white"
          aspect={1}
          label="Birthday doodle canvas"
          onChange={(h) => {
            setHistory(h);
            setKept(false);
            pages.current.mini = {
              ink,
              drawing: canvas.current.snapshot(),
              kept: false,
            };
            if (!save.isPending) save.reset();
          }}
        />
        {!history.count && (
          <span className="doodle-invitation" aria-hidden="true">
            your tiny masterpiece
            <br />
            <b>goes here ↓</b>
          </span>
        )}
      </div>
      <div className="doodle-tools">
        <div aria-label="Doodle colours">
          {INKS.map((c) => (
            <button
              key={c}
              style={{ "--ink": c }}
              aria-label={`Doodle in ${c}`}
              aria-pressed={c === ink}
              onClick={() => setInk(c)}
            />
          ))}
        </div>
        <button
          className="quiet-button"
          disabled={!history.canUndo || save.isPending}
          onClick={() =>
            kept ? canvas.current.clear() : canvas.current.undo()
          }
        >
          {kept ? "New page ↗" : "Undo ↶"}
        </button>
      </div>
      <div className="doodle-actions">
        <button
          className="button-plum"
          disabled={!history.count || save.isPending || kept}
          onClick={() => save.mutate()}
        >
          {save.isPending
            ? "Keeping it…"
            : kept
              ? "Kept in your sketchbook ♡"
              : "Keep this doodle ♡"}
        </button>
        <Link className="text-link" to="/world/studio">
          Open sketchbook ↗
        </Link>
      </div>
      <span className="sr-only" role="status">
        {kept ? "Your doodle is saved in your private sketchbook." : ""}
      </span>
      {save.error && <p role="alert">{save.error.message}</p>}
    </section>
  );
}
