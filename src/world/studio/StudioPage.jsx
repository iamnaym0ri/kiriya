import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { GalleryViewer } from "../collection/Collections.jsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useToday } from "../../lib/world.js";
import { uploadFile } from "../../lib/uploads.js";
import { celebrate, prefersLessMotion } from "../../shared/effects.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import DrawingCanvas, { PAPERS, SIZES } from "./DrawingCanvas.jsx";
import PaintMixer from "./PaintMixer.jsx";
import { useSketchPages } from "./SketchbookState.jsx";
import "./StudioPage.css";

const PALETTE = [
  "#19083a",
  "#ffffff",
  "#632bb5",
  "#995cf7",
  "#cfb4ff",
  "#c2006f",
  "#e52f8c",
  "#ffa4c9",
  "#ffd166",
  "#39c5bb",
  "#6f6879",
  "#79b06b",
];

function Gallery() {
  const gallery = useQuery({
    queryKey: ["me", "artworks"],
    queryFn: () => api("/me/artworks"),
  });
  const [viewing, setViewing] = useState(null);
  const artworks = gallery.data?.artworks ?? [];

  return (
    <section className="gallery" aria-labelledby="gallery-title">
      <h2 id="gallery-title" className="studio__section-title">
        Your gallery
      </h2>
      {artworks.length === 0 ? (
        <p className="gallery__empty">
          Nothing framed yet. Save a drawing and it'll hang here.
        </p>
      ) : (
        <ul className="gallery__grid">
          {artworks.map((art) => (
            <li key={art.id}>
              <button
                type="button"
                className="gallery__item"
                onClick={() => setViewing(art)}
              >
                <img
                  src={art.url}
                  alt={art.prompt ? `Drawing: ${art.prompt}` : "A drawing"}
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {viewing && (
        <GalleryViewer
          items={artworks.map((a) => ({
            ...a,
            title: "Saved sketch",
            caption: a.prompt,
          }))}
          index={artworks.findIndex((a) => a.id === viewing.id)}
          onChange={(i) => setViewing(artworks[i])}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

export default function StudioPage() {
  const pages = useSketchPages();
  const initial = useRef(pages.current.full).current;
  const [search] = useSearchParams();
  const wonPalette = (search.get("paint") ?? "")
    .split(",")
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c))
    .slice(0, 3);
  const today = useToday();
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);
  const [color, setColor] = useState(
    wonPalette[0] ?? initial?.color ?? PALETTE[2],
  );
  const [custom, setCustom] = useState([
    ...new Set([...wonPalette, ...(initial?.custom ?? [])]),
  ]);
  const [pageNumber, setPageNumber] = useState(1);
  const revision = useRef(initial?.revision ?? 0);
  const savedRevision = useRef(initial?.savedRevision ?? 0);
  const [size, setSize] = useState(initial?.size ?? SIZES[1]);
  const [tool, setTool] = useState(initial?.tool ?? "pen");
  const [paper, setPaper] = useState(initial?.paper ?? "white");
  const [history, setHistory] = useState({
    count: initial?.drawing?.strokes?.length ?? 0,
    canUndo: Boolean(initial?.drawing?.strokes?.length),
    canRedo: Boolean(initial?.drawing?.undone?.length),
  });
  const [status, setStatus] = useState(null);

  const prompt = today.data?.cards.find((c) => c.kind === "art");

  useEffect(() => {
    document.title = "a little sketchbook ♡ kiriya";
  }, []);
  useEffect(() => {
    pages.current.full = {
      ...pages.current.full,
      color,
      custom,
      size,
      tool,
      paper,
    };
  }, [color, custom, size, tool, paper, pages, pageNumber]);

  const save = useMutation({
    mutationFn: async () => {
      const version = revision.current;
      const { file, width, height } = await canvasRef.current.export();
      const uploaded = await uploadFile(file, { folder: "art" });
      await api("/me/artworks", {
        method: "POST",
        body: { ...uploaded, prompt: prompt?.body ?? null, width, height },
      });
      return version;
    },
    onSuccess: (version) => {
      savedRevision.current = version;
      if (pages.current.full) pages.current.full.savedRevision = version;
      setStatus({
        tone: "happy",
        text:
          revision.current === version
            ? "Kept in your sketchbook. Maomao approves. ♡"
            : "Page saved. Your newest marks are still waiting to be kept.",
      });
      celebrate({ x: 0.5, y: 0.4 }, 0.8);
      queryClient.invalidateQueries({ queryKey: ["me", "artworks"] });
    },
    onError: (error) =>
      setStatus({ tone: "ew", text: `That didn't save: ${error.message}` }),
  });

  async function share() {
    const { file } = await canvasRef.current.export();
    if (navigator.canShare?.({ files: [file] })) {
      await navigator
        .share({ files: [file], title: "A drawing" })
        .catch(() => {});
    } else {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }

  const swatches = [...new Set([...PALETTE, ...custom])];

  function newPage() {
    if (
      history.count &&
      revision.current !== savedRevision.current &&
      !window.confirm("This page has unsaved marks. Start a fresh page anyway?")
    )
      return;
    setPageNumber((n) => n + 1);
    setHistory({ count: 0, canUndo: false, canRedo: false });
    revision.current = 0;
    savedRevision.current = 0;
    pages.current.full = {
      color,
      custom,
      size,
      tool,
      paper,
      revision: 0,
      savedRevision: 0,
    };
    setStatus(null);
  }

  return (
    <div className="studio">
      <Link className="text-link" to="/world/art">
        ← Back to your sketchbook
      </Link>
      <header className="studio__head">
        <MaomaoMascot expression={status?.tone ?? "smug"} size={72} />
        <div>
          <h1 className="studio__title">Your little sketchbook.</h1>
          {prompt ? (
            <p className="studio__prompt">{prompt.body}</p>
          ) : (
            <p className="studio__prompt">
              Draw whatever the day left in your head.
            </p>
          )}
        </div>
      </header>

      <div className="notebook-toolbar">
        <span>
          {wonPalette.length
            ? "YOUR COLOUR-CLUB PALETTE IS HERE ♡"
            : `A FRESH PAGE · ${String(pageNumber).padStart(2, "0")}`}
        </span>
        <button
          className="quiet-button"
          onClick={newPage}
          disabled={save.isPending}
        >
          New page ↗
        </button>
      </div>

      <DrawingCanvas
        key={pageNumber}
        initialDrawing={pageNumber === 1 ? initial?.drawing : undefined}
        ref={canvasRef}
        color={color}
        size={size}
        tool={tool}
        paper={paper}
        onChange={(h) => {
          setHistory(h);
          revision.current += 1;
          setStatus(null);
          pages.current.full = {
            ...pages.current.full,
            drawing: canvasRef.current.snapshot(),
            revision: revision.current,
            savedRevision: savedRevision.current,
          };
        }}
      />

      <div className="toolbar" role="toolbar" aria-label="Drawing tools">
        <div className="toolbar__group">
          <button
            type="button"
            className="tool"
            aria-pressed={tool === "pen"}
            onClick={() => setTool("pen")}
          >
            Brush
          </button>
          <button
            type="button"
            className="tool"
            aria-pressed={tool === "eraser"}
            onClick={() => setTool("eraser")}
          >
            Eraser
          </button>
        </div>
        <div className="toolbar__group">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className="tool tool--size"
              aria-pressed={size === s}
              onClick={() => setSize(s)}
              aria-label={`Size ${s}`}
            >
              <span style={{ width: s / 1.4 + 4, height: s / 1.4 + 4 }} />
            </button>
          ))}
        </div>
        <div className="toolbar__group">
          <button
            type="button"
            className="tool"
            onClick={() => canvasRef.current.undo()}
            disabled={!history.canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="tool"
            onClick={() => canvasRef.current.redo()}
            disabled={!history.canRedo}
          >
            Redo
          </button>
        </div>
      </div>

      <div className="swatches" role="radiogroup" aria-label="Colour">
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            role="radio"
            aria-checked={color === swatch && tool === "pen"}
            aria-label={swatch}
            className="swatch"
            style={{ background: swatch }}
            onClick={() => {
              setColor(swatch);
              setTool("pen");
            }}
          />
        ))}
      </div>

      <div className="toolbar toolbar--papers">
        {Object.entries(PAPERS).map(([key, value]) => (
          <button
            key={key}
            type="button"
            className="tool"
            aria-pressed={paper === key}
            onClick={() => setPaper(key)}
          >
            {value.label}
          </button>
        ))}
        <button
          type="button"
          className="tool"
          onClick={() => canvasRef.current.clear()}
          disabled={history.count === 0}
        >
          Clear
        </button>
      </div>

      <div className="studio__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => save.mutate()}
          disabled={save.isPending || history.count === 0}
        >
          {save.isPending ? "Framing…" : "Save to gallery"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={share}
          disabled={history.count === 0}
        >
          Share or save image
        </button>
      </div>
      {status && <p className="studio__status">{status.text}</p>}

      <PaintMixer
        palette={PALETTE.filter((p) => p !== "#ffffff")}
        onUse={(mixed) => {
          setCustom((list) =>
            [mixed, ...list.filter((c) => c !== mixed)].slice(0, 6),
          );
          setColor(mixed);
          setTool("pen");
          window.scrollTo({
            top: 0,
            behavior: prefersLessMotion() ? "instant" : "smooth",
          });
        }}
      />

      <Gallery />
    </div>
  );
}
