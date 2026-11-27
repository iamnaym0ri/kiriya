import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { haptic } from "../../lib/native.js";
import DrawingCanvas from "./DrawingCanvas.jsx";
import ToolMark from "./ToolMark.jsx";
import { BRUSHES, INKS, PALETTE, PAPERS, SHAPES, drawingHistory, isShape } from "./drawingTools.js";
import { useSketchPages } from "./SketchbookState.jsx";
import { useAutosave, useElementSize, useToast } from "../play/games/artsy/_kit/hooks.js";
import { readJson, roundPoint } from "../play/games/artsy/_kit/store.js";
import { useArtShare, useOpenGallery } from "../play/games/artsy/_kit/share.js";
import { Sheet, Toast } from "../play/games/artsy/_kit/Sheet.jsx";
import "../play/games/artsy/_kit/kit.css";
import "./AppSketchbook.css";

const PaintMixer = lazy(() => import("./PaintMixer.jsx"));

// The sketchbook in the iPhone app: a page that fills the screen, the tools under it (colours, then
// a dock: brush, size, shapes, mirror, paper, more), and "keep" up top, which keeps it in her
// gallery or sends it to Josh, like the artsy games. The page is the same draft the website's
// sketchbook uses, and it's also kept on the phone as she draws, so the app going to the background
// (or iOS closing it) never loses a drawing.

const SAVE_KEY = "sketchbook";
const BRUSH_IDS = BRUSHES.map((brush) => brush.id);
const SIZE_STEPS = [4, 10, 18, 30];
const sizeName = (size) => (size <= 6 ? "fine" : size <= 13 ? "medium" : size <= 24 ? "bold" : "chunky");
const lower = (text) => String(text).toLowerCase();

/** The draft as it's written to the phone: rounded points, and history only back to the last fresh page but one. */
function stored(drawing) {
  const strokes = drawing?.strokes ?? [];
  const undone = drawing?.undone ?? [];
  let cut = 0;
  for (let i = strokes.length - 1, seen = 0; i >= 0; i--) {
    if (strokes[i].tool === "clear" && ++seen === 2) {
      cut = i;
      break;
    }
  }
  const tidy = (stroke) => (stroke.points ? { ...stroke, points: stroke.points.map(roundPoint) } : stroke);
  return { strokes: strokes.slice(cut).map(tidy), undone: undone.slice(-30).map(tidy) };
}

export default function AppSketchbook() {
  const pages = useSketchPages();
  const [search, setSearch] = useSearchParams();
  const initial = useRef(pages.current.doodle ?? readJson(SAVE_KEY, null) ?? pages.current.mini ?? pages.current.full ?? {}).current;
  // A new page is a portrait sketchbook page (it fills the phone better); a draft keeps its shape.
  const aspect = useRef(initial.aspect ?? 1.25).current;
  const canvas = useRef(null);
  const drawing = useRef(initial.drawing ?? { strokes: [], undone: [] });
  const revision = useRef(initial.revision ?? 0);
  const savedRevision = useRef(initial.savedRevision ?? (initial.kept ? 0 : -1));
  const [ink, setInk] = useState(initial.ink ?? initial.color ?? INKS[0]);
  const [custom, setCustom] = useState(initial.custom ?? []);
  const [size, setSize] = useState(initial.size ?? 10);
  const [tool, setTool] = useState(initial.tool ?? "pen");
  const [brush, setBrush] = useState(BRUSH_IDS.includes(initial.tool) ? initial.tool : "pen");
  const [paper, setPaper] = useState(PAPERS[initial.paper] ? initial.paper : "dots");
  const [opacity, setOpacity] = useState(initial.opacity ?? 1);
  const [mirror, setMirror] = useState(initial.mirror ?? false);
  const [fill, setFill] = useState(initial.fill ?? true);
  const [title, setTitle] = useState(initial.title ?? "");
  const [history, setHistory] = useState(() => drawingHistory(initial.drawing?.strokes, initial.drawing?.undone));
  const [kept, setKept] = useState(initial.kept ?? false);
  const [savedId, setSavedId] = useState(initial.savedId ?? null);
  const [pop, setPop] = useState(null); // "brush" | "size" | "shapes" | "paper" | "colours" | "more"
  const [sheet, setSheet] = useState(null); // "keep" | "mix" | "idea"
  const [toast, showToast] = useToast();

  // ---------- the page's size: as big as the stage allows, its own shape ----------
  const stageRef = useRef(null);
  const stage = useElementSize(stageRef);
  const RINGS = 14;
  const pageWidth = Math.max(160, Math.floor(Math.min(stage.width - 28 - RINGS, (stage.height - 20) / aspect)));

  // ---------- the draft: shared with the website's sketchbook, and kept on the phone ----------
  useEffect(() => {
    pages.current.doodle = { drawing: drawing.current, ink, custom, size, tool, paper, opacity, mirror, fill, title, aspect, kept, savedId, revision: revision.current, savedRevision: savedRevision.current };
  }, [pages, ink, custom, size, tool, paper, opacity, mirror, fill, title, aspect, kept, savedId, history]);
  const onPhone = useMemo(
    () => ({
      // Worked out only when it's written (a moment after a change, or as the app leaves).
      toJSON: () => ({ drawing: stored(drawing.current), ink, custom, size, tool, paper, opacity, mirror, fill, title, aspect, kept, savedId, revision: revision.current, savedRevision: savedRevision.current }),
    }),
    [ink, custom, size, tool, paper, opacity, mirror, fill, title, aspect, kept, savedId, history],
  );
  // Written when she pauses (every new stroke pushes it back, so a big page is never written while
  // she's mid-drawing), and at once when the app goes to the background.
  useAutosave(SAVE_KEY, onPhone, 2500);

  function dirty() {
    revision.current += 1;
    setKept(false);
  }

  // Colour-club paints (?paint=#…,#…) land on the brush, once.
  const paint = search.get("paint") ?? "";
  useEffect(() => {
    const colors = paint.split(",").filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 3);
    if (!colors.length) return;
    setCustom((old) => [...new Set([...colors, ...old])].slice(0, 18));
    setInk(colors[0]);
    setTool(brush);
    showToast("your colour-club paints are here ♡");
    setSearch(
      (next) => {
        next.delete("paint");
        return next;
      },
      { replace: true },
    );
  }, [paint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- tools ----------
  const erasing = tool === "eraser";
  const shaping = isShape(tool);
  function chooseInk(colour) {
    setInk(colour);
    if (erasing) setTool(brush);
    haptic("light");
  }
  function chooseBrush(id) {
    if (id !== "eraser") setBrush(id);
    setTool(id);
    setPop(null);
    haptic("light");
  }
  const togglePop = (name) => setPop((open) => (open === name ? null : name));
  const quick = [...new Set([...INKS, ...custom.slice(0, 2), ink, ...PALETTE])].slice(0, 7);
  const allColours = [...new Set([...PALETTE, ...custom])];

  function fresh() {
    if (!history.count) return;
    canvas.current.clear();
    haptic("medium");
    showToast("a fresh page · undo brings it back");
  }

  const toolLabel = erasing ? "eraser" : shaping ? lower(SHAPES.find((each) => each.id === tool)?.label ?? "shape") : lower(BRUSHES.find((each) => each.id === tool)?.label ?? "brush");

  return (
    <div className="artsy sk">
      <div className="artsy-bar sk-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="undo" disabled={!history.canUndo} onClick={() => { canvas.current.undo(); haptic("light"); }}>
          <UndoIcon />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="redo" disabled={!history.canRedo} onClick={() => { canvas.current.redo(); haptic("light"); }}>
          <UndoIcon flip />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="a fresh page" disabled={!history.count} onClick={fresh}>
          <TrashIcon />
        </button>
        <div className="artsy-bar__grow" />
        <button type="button" className="artsy-chip artsy-chip--primary" disabled={!history.count} aria-pressed={kept} onClick={() => { setPop(null); setSheet("keep"); }}>
          <HeartIcon />
          {kept ? "kept" : "keep"}
        </button>
      </div>

      <div className="sk-stage" ref={stageRef}>
        {stage.width > 0 && (
          <div className="sk-page" style={{ width: pageWidth + RINGS }}>
            <div className="sk-rings" aria-hidden="true">
              {Array.from({ length: Math.max(4, Math.round((pageWidth * aspect) / 62)) }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <div className="sk-sheet" style={{ width: pageWidth }}>
              <DrawingCanvas
                ref={canvas}
                initialDrawing={initial.drawing}
                color={ink}
                size={size}
                tool={tool}
                paper={paper}
                opacity={opacity}
                mirror={mirror}
                fill={fill}
                aspect={aspect}
                label="your sketchbook page. draw with one finger."
                onChange={(next) => {
                  drawing.current = canvas.current.snapshot();
                  setHistory(next);
                  dirty();
                  if (pop) setPop(null);
                }}
              />
              {!history.count && (
                <span className="sk-hello artsy-hand" aria-hidden="true">
                  your tiny masterpiece
                  <br />
                  <b>goes here ♡</b>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {pop && <button type="button" className="sk-pop-backdrop" aria-label="close" tabIndex={-1} onClick={() => setPop(null)} />}
      <div className="artsy-tray sk-tray">
        {pop === "brush" && (
          <Pop title="brushes">
            <div className="sk-pop__grid sk-pop__grid--five" role="radiogroup" aria-label="brush">
              {[...BRUSHES, { id: "eraser", label: "eraser" }].map((each) => (
                <button key={each.id} type="button" role="radio" aria-checked={tool === each.id} className="sk-option" onClick={() => chooseBrush(each.id)}>
                  <ToolMark tool={each.id} />
                  <span>{lower(each.label)}</span>
                </button>
              ))}
            </div>
          </Pop>
        )}
        {pop === "size" && (
          <Pop title="size">
            <div className="sk-sizes" role="radiogroup" aria-label="brush size">
              {SIZE_STEPS.map((each) => (
                <button key={each} type="button" role="radio" aria-checked={size === each} aria-label={sizeName(each)} className="sk-size-option" onClick={() => { setSize(each); haptic("light"); }}>
                  <span style={{ "--d": `${Math.min(30, 4 + each)}px`, "--ink": erasing ? "#b9a3c8" : ink }} />
                </button>
              ))}
            </div>
            <label className="sk-slider">
              <span>
                size <output>{size}</output>
              </span>
              <input type="range" min="2" max="48" value={size} onChange={(event) => setSize(Number(event.target.value))} />
            </label>
            <label className="sk-slider">
              <span>
                see-through <output>{Math.round(opacity * 100)}%</output>
              </span>
              <input type="range" min="20" max="100" value={Math.round(opacity * 100)} onChange={(event) => setOpacity(Number(event.target.value) / 100)} />
            </label>
          </Pop>
        )}
        {pop === "shapes" && (
          <Pop title="little shapes · tap or drag">
            <div className="sk-pop__grid sk-pop__grid--three" role="radiogroup" aria-label="shapes">
              {SHAPES.map((each) => (
                <button key={each.id} type="button" role="radio" aria-checked={tool === each.id} className="sk-option" onClick={() => { setTool(each.id); setPop(null); haptic("light"); }}>
                  <ToolMark tool={each.id} />
                  <span>{lower(each.label)}</span>
                </button>
              ))}
            </div>
            <button type="button" className="artsy-chip sk-pop__toggle" aria-pressed={fill} onClick={() => setFill((on) => !on)}>
              {fill ? "filled in ♡" : "outlines only"}
            </button>
          </Pop>
        )}
        {pop === "paper" && (
          <Pop title="paper">
            <div className="sk-pop__grid sk-pop__grid--three" role="radiogroup" aria-label="paper">
              {Object.entries(PAPERS).map(([key, value]) => (
                <button key={key} type="button" role="radio" aria-checked={paper === key} className="sk-option" onClick={() => { if (paper !== key) { setPaper(key); dirty(); } setPop(null); haptic("light"); }}>
                  <i className="sk-paper" data-paper={key} style={{ background: value.fill }} />
                  <span>{lower(value.label)}</span>
                </button>
              ))}
            </div>
          </Pop>
        )}
        {pop === "colours" && (
          <Pop title="every paint">
            <div className="sk-all-colours" role="radiogroup" aria-label="paints">
              {allColours.map((colour) => (
                <button key={colour} type="button" role="radio" aria-checked={ink === colour && !erasing} aria-label={`paint ${colour}`} className="sk-swatch" style={{ "--swatch": colour }} onClick={() => { chooseInk(colour); setPop(null); }} />
              ))}
              <label className="sk-swatch sk-swatch--any" aria-label="any colour">
                <span aria-hidden="true">+</span>
                <input type="color" value={ink} onChange={(event) => chooseInk(event.target.value)} />
              </label>
            </div>
            <button type="button" className="artsy-chip sk-pop__toggle" onClick={() => { setPop(null); setSheet("mix"); }}>
              <PaletteIcon /> mix a new colour
            </button>
          </Pop>
        )}
        {pop === "more" && (
          <Pop title="a little more">
            <div className="sk-more">
              <button type="button" className="sk-more__row" onClick={() => { setPop(null); setSheet("mix"); }}>
                <PaletteIcon />
                <span>
                  mix a new colour
                  <small>blue and yellow make green, like real paint</small>
                </span>
              </button>
              <button type="button" className="sk-more__row" onClick={() => { setPop(null); setSheet("idea"); }}>
                <BulbIcon />
                <span>
                  a little idea
                  <small>if you’d like something to draw</small>
                </span>
              </button>
            </div>
          </Pop>
        )}

        <div className="sk-colours" role="radiogroup" aria-label="colours">
          <button type="button" className="sk-swatch sk-swatch--box" aria-label="every paint" aria-expanded={pop === "colours"} onClick={() => togglePop("colours")}>
            <PaletteIcon />
          </button>
          {quick.map((colour) => (
            <button key={colour} type="button" role="radio" aria-checked={ink === colour && !erasing} aria-label={`paint ${colour}`} className="sk-swatch" style={{ "--swatch": colour }} onClick={() => chooseInk(colour)} />
          ))}
        </div>

        <div className="sk-dock" role="toolbar" aria-label="tools">
          <Dock label={shaping ? lower(BRUSHES.find((each) => each.id === brush)?.label) : toolLabel} hint="brush" on={pop === "brush" || erasing} expanded={pop === "brush"} onClick={() => togglePop("brush")}>
            <ToolMark tool={shaping ? brush : tool} />
          </Dock>
          <Dock label={sizeName(size)} hint="size" expanded={pop === "size"} on={pop === "size"} onClick={() => togglePop("size")}>
            <span className="sk-dot" style={{ "--d": `${Math.min(22, 4 + size * 0.6)}px`, opacity }} />
          </Dock>
          <Dock label={shaping ? toolLabel : "shapes"} hint="shapes" expanded={pop === "shapes"} on={pop === "shapes" || shaping} onClick={() => togglePop("shapes")}>
            <ToolMark tool={shaping ? tool : "heart"} />
          </Dock>
          <Dock label="mirror" hint="mirror the other half" pressed={mirror} on={mirror} onClick={() => { setMirror((on) => !on); haptic("light"); }}>
            <MirrorIcon on={mirror} />
          </Dock>
          <Dock label={lower(PAPERS[paper]?.label ?? "paper")} hint="paper" expanded={pop === "paper"} on={pop === "paper"} onClick={() => togglePop("paper")}>
            <i className="sk-paper sk-paper--small" style={{ background: PAPERS[paper]?.fill }} />
          </Dock>
          <Dock label="more" hint="more" expanded={pop === "more"} on={pop === "more"} onClick={() => togglePop("more")}>
            <MoreIcon />
          </Dock>
        </div>
      </div>

      <KeepSheet
        open={sheet === "keep"}
        onClose={() => setSheet(null)}
        canvas={canvas}
        revision={revision}
        kept={kept}
        savedId={savedId}
        title={title}
        onTitle={(next) => {
          setTitle(next);
          dirty();
        }}
        onKept={({ version, id }) => {
          savedRevision.current = version;
          setSavedId(id);
          if (revision.current === version) setKept(true);
        }}
        onFresh={() => {
          setSheet(null);
          canvas.current.reset();
          setTitle("");
          showToast("a fresh page. what shall we make?");
        }}
      />
      <Sheet open={sheet === "mix"} title="mix a new colour" onClose={() => setSheet(null)} className="sk-mix">
        <Suspense fallback={<p className="artsy-hand sk-wait">opening the paint box…</p>}>
          {sheet === "mix" && (
            <PaintMixer
              palette={allColours}
              onUse={(mixed) => {
                setCustom((old) => [mixed, ...old.filter((colour) => colour !== mixed)].slice(0, 18));
                chooseInk(mixed);
                setSheet(null);
                showToast("your new paint is on the brush ♡");
              }}
            />
          )}
        </Suspense>
      </Sheet>
      <IdeaSheet open={sheet === "idea"} onClose={() => setSheet(null)} />
      <Toast text={toast} />
    </div>
  );
}

function Dock({ label, hint, expanded, pressed, on, onClick, children }) {
  return (
    <button type="button" className="sk-dock__button" aria-label={`${hint}: ${label}`} aria-expanded={expanded} aria-pressed={pressed} data-on={on || undefined} onClick={onClick}>
      <span className="sk-dock__icon" aria-hidden="true">
        {children}
      </span>
      <span className="sk-dock__label" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}

function Pop({ title, children }) {
  return (
    <section className="sk-pop" aria-label={title}>
      <h3 className="sk-pop__title">{title}</h3>
      {children}
    </section>
  );
}

/** Keep it in her gallery (with a name, if she likes), send it to Josh, or start a fresh page. */
function KeepSheet({ open, onClose, canvas, revision, kept, savedId, title, onTitle, onKept, onFresh }) {
  const { partner, toChat, toDoodles } = useArtShare();
  const openGallery = useOpenGallery();
  const [preview, setPreview] = useState(null);
  const made = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    toChat.reset();
    toDoodles.reset();
    let url = null, gone = false;
    const picture = canvas.current.export(1600);
    made.current = picture;
    picture
      .then(({ file }) => {
        if (gone) return;
        url = URL.createObjectURL(file);
        setPreview(url);
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const make = () => made.current;
  const keptNow = toDoodles.data ?? null;
  const inGallery = keptNow || (kept && savedId);
  const error = toChat.error || toDoodles.error;
  // The page can't change while this sheet is open; its name can, and it's kept with the picture.
  const keep = () => {
    const version = revision.current;
    toDoodles.mutate({ make, title: title.trim() || "a little doodle" }, { onSuccess: (art) => onKept({ version, id: art?.id ?? null }) });
  };
  const send = () => toChat.mutate({ make, alt: title.trim() ? `a doodle: ${title.trim()}` : "a doodle", caption: "" });
  const sendLabel = toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner}`;
  return (
    <Sheet open={open} title={inGallery ? "in your gallery ♡" : "keep your doodle"} onClose={onClose}>
      <div className="sk-keep">
        <div className="sk-keep__frame">{preview ? <img src={preview} alt="your doodle" /> : <span className="artsy-hand">turning it into a picture…</span>}</div>
        {!inGallery && (
          <label className="sk-keep__name">
            <span>a name, if you like</span>
            <input value={title} maxLength={120} placeholder="my little masterpiece" onChange={(event) => onTitle(event.target.value)} enterKeyHint="done" onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} />
          </label>
        )}
        {inGallery ? (
          <div className="sk-keep__buttons">
            <button type="button" className="artsy-primary" onClick={() => openGallery(keptNow?.id ?? savedId)}>
              see it in my gallery
            </button>
            <button type="button" className="artsy-secondary" onClick={onClose}>
              keep drawing
            </button>
          </div>
        ) : (
          <div className="sk-keep__buttons">
            <button type="button" className="artsy-primary" disabled={!preview || toDoodles.isPending} onClick={keep}>
              {toDoodles.isPending ? "keeping…" : "keep in my gallery ♡"}
            </button>
            <button type="button" className="artsy-secondary" disabled={!preview || toChat.isPending || toChat.isSuccess} onClick={send}>
              {sendLabel}
            </button>
          </div>
        )}
        {inGallery && (
          <button type="button" className="artsy-chip sk-keep__also" disabled={!preview || toChat.isPending || toChat.isSuccess} onClick={send}>
            {toChat.isSuccess ? sendLabel : `also ${sendLabel} ♡`}
          </button>
        )}
        {error && (
          <p className="artsy-error" role="alert">
            {error.message || "That didn’t go through. Try again?"}
          </p>
        )}
        {inGallery && (
          <button type="button" className="artsy-chip sk-keep__fresh" onClick={onFresh}>
            start a fresh page
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** A drawing prompt from her collection, and another one if that one doesn't spark anything. */
function IdeaSheet({ open, onClose }) {
  const ideas = useQuery({ queryKey: ["me", "discoveries", "art"], queryFn: () => api("/me/discoveries?kind=art"), enabled: open, staleTime: Infinity });
  const items = ideas.data?.items ?? [];
  const [at, setAt] = useState(() => Math.floor(Math.random() * 1000));
  const idea = items.length ? items[at % items.length] : null;
  return (
    <Sheet open={open} title="a little idea" onClose={onClose}>
      <div className="sk-idea">
        <p className="sk-idea__words artsy-hand">{idea ? idea.body : ideas.isError ? "the ideas didn’t open just now. try again in a moment?" : "finding one for you…"}</p>
        {items.length > 1 && (
          <button type="button" className="artsy-chip" onClick={() => { setAt((n) => n + 1); haptic("light"); }}>
            another one
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ---------- icons (24 × 24, in the tool's colour) ----------
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
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20.2C8.1 17.4 3.6 14 3.6 9.6 3.6 7 5.6 5 8 5c1.7 0 3.1.9 4 2.3C12.9 5.9 14.3 5 16 5c2.4 0 4.4 2 4.4 4.6 0 4.4-4.5 7.8-8.4 10.6Z" fill="currentColor" />
  </svg>
);
const PaletteIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 4C9 4 4 9 4 15c0 6 4.5 10 9.5 10 2.2 0 2.8-1.4 2.8-2.8 0-1.8 1.3-2.8 3.2-2.8h2.6C25.4 19.4 28 17 28 13.8 28 8.2 22.6 4 16 4Z" fill="#fff7ec" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="10" cy="14" r="2.6" fill="#dba1bf" />
    <circle cx="14.5" cy="9" r="2.6" fill="#c0a5d9" />
    <circle cx="21" cy="10" r="2.6" fill="#efcf88" />
    <circle cx="11.5" cy="20" r="2.4" fill="#94b888" />
  </svg>
);
const MirrorIcon = ({ on }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M14 7C8 8 5 14 7 22c3-1 5-4 7-6Z" fill="currentColor" opacity="0.9" />
    <path d="M18 7c6 1 9 7 7 15-3-1-5-4-7-6Z" fill="currentColor" opacity={on ? 0.9 : 0.22} />
    <path d="M16 4v24" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2.6" strokeLinecap="round" />
  </svg>
);
const MoreIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="16" cy="9.2" rx="3.6" ry="5.6" transform={`rotate(${a} 16 16)`} fill="currentColor" opacity={a % 144 ? 0.5 : 0.9} />
    ))}
    <circle cx="16" cy="16" r="3" fill="#fff4cf" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21c0-3-4-5-4-10a8 8 0 0 1 16 0c0 5-4 7-4 10Z" fill="#fff4cf" />
    <path d="M12.5 25h7M14 28.5h4M16 3V1.5M25 6l1.2-1.2M7 6 5.8 4.8" />
  </svg>
);
