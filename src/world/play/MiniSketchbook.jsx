import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DrawingCanvas from "../studio/DrawingCanvas.jsx";
import { BRUSHES, SHAPES, PAPERS, drawingHistory, downloadBlob } from "../studio/drawingTools.js";
import { useSketchPages } from "../studio/SketchbookState.jsx";
import { uploadFile } from "../../lib/uploads.js";
import { api } from "../../lib/api.js";
import { Bow, usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import { celebrate } from "../../shared/effects.js";
import { Discovery } from "../collection/Collections.jsx";
import DoodleGallery from "./DoodleGallery.jsx";
import "./PlayDesk.css";
import "./DoodleStudio.css";
const PaintMixer = lazy(() => import("../studio/PaintMixer.jsx"));
const INKS = ["#674c87", "#d185ad", "#39968e", "#493653", "#edba69"];
const PALETTE = [...INKS, "#ffffff", "#f6b6cf", "#a7bf7c", "#995cf7", "#365dd7", "#e96675", "#6f6879"];
function ToolMark({ tool }) {
  return <svg viewBox="0 0 52 28" aria-hidden="true">
    {tool === "heart" ? <path d="M26 25C21 19 7 13 14 6q6-6 12 3 6-9 12-3c7 7-7 13-12 19Z" fill="currentColor" />
      : tool === "star" ? <path d="m26 2 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="currentColor" />
      : tool === "sparkle" ? <path d="m26 2 4 10 12 2-12 3-4 10-4-10-12-3 12-2Z" fill="currentColor" />
      : tool === "rectangle" ? <rect x="13" y="5" width="26" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      : tool === "ellipse" ? <ellipse cx="26" cy="14" rx="13" ry="10" fill="none" stroke="currentColor" strokeWidth="2" />
      : <path d={tool === "line" ? "m10 22 32-16" : "M7 20Q16 3 25 14T45 7"} fill="none" stroke="currentColor" strokeWidth={tool === "pencil" ? 1.3 : tool === "marker" ? 9 : tool === "crayon" ? 5 : 4} strokeLinecap="round" opacity={tool === "marker" ? .4 : 1} strokeDasharray={tool === "crayon" ? "2 2" : undefined} />}
  </svg>;
}
export default function MiniSketchbook() {
  const pages = useSketchPages(), [search] = useSearchParams();
  const initial = useRef(pages.current.doodle ?? pages.current.mini ?? pages.current.full ?? {}).current;
  const canvas = useRef(null), root = useRef(null), drawing = useRef(initial.drawing);
  const revision = useRef(initial.revision ?? 0), savedRevision = useRef(initial.savedRevision ?? (initial.kept ? 0 : -1));
  const [ink, setInk] = useState(initial.ink ?? initial.color ?? INKS[0]);
  const [custom, setCustom] = useState(initial.custom ?? []);
  const [size, setSize] = useState(initial.size ?? 10), [tool, setTool] = useState(initial.tool ?? "pen");
  const [paper, setPaper] = useState(initial.paper ?? "dots"), [opacity, setOpacity] = useState(initial.opacity ?? 1);
  const [mirror, setMirror] = useState(initial.mirror ?? false), [fill, setFill] = useState(initial.fill ?? true);
  const [title, setTitle] = useState(initial.title ?? ""), [history, setHistory] = useState(drawingHistory(initial.drawing?.strokes, initial.drawing?.undone));
  const [gallery, setGallery] = useState(search.get("gallery") === "1"), [mixing, setMixing] = useState(false);
  const [status, setStatus] = useState(""), [kept, setKept] = useState(initial.kept ?? false), [more, setMore] = useState(false);
  const [paletteMessage, setPaletteMessage] = useState(false);
  const client = useQueryClient(), { moving } = usePlayful();
  // A previous full-page draft keeps its original proportions when first brought here.
  const aspect = useRef(initial.aspect ?? (initial === pages.current.full ? 1.25 : 1)).current;
  const paint = search.get("paint") ?? "";
  const appliedPaint = useRef("");
  useEffect(() => {
    const colors = paint.split(",").filter(color => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 3);
    if (!colors.length || appliedPaint.current === paint) return;
    appliedPaint.current = paint;
    setCustom(old => [...new Set([...colors, ...old])].slice(0, 18)); setInk(colors[0]); setTool("pen");
    setPaletteMessage(true); setMore(true);
    root.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [paint]);
  useEffect(() => { if (search.get("gallery") === "1") setGallery(true); }, [search]);
  useEffect(() => {
    pages.current.doodle = { drawing: drawing.current, ink, custom, size, tool, paper, opacity, mirror, fill, title, aspect, kept,
      revision: revision.current, savedRevision: savedRevision.current };
  }, [pages, ink, custom, size, tool, paper, opacity, mirror, fill, title, aspect, kept, history]);
  function dirty() { revision.current += 1; setKept(false); setStatus(""); if (!save.isPending) save.reset(); }
  const save = useMutation({
    mutationFn: async () => {
      const version = revision.current;
      const { file, width, height } = await canvas.current.export(1600);
      const stored = await uploadFile(file, { folder: "art" });
      await api("/me/artworks", { method: "POST", body: { ...stored, width, height, prompt: title.trim() || "A little birthday doodle" } });
      return version;
    },
    onSuccess: version => {
      savedRevision.current = version;
      const unchanged = revision.current === version;
      setKept(unchanged); setGallery(true);
      if (pages.current.doodle?.revision === version) Object.assign(pages.current.doodle, { savedRevision: version, kept: true });
      setStatus(unchanged ? "Tucked into your gallery, just for you ♡" : "Saved. Your newest changes are ready to keep, too.");
      client.invalidateQueries({ queryKey: ["me", "artworks"] });
      if (moving) celebrate({ x: .35, y: .55 }, .3);
    },
  });
  async function share() {
    try {
      const { file } = await canvas.current.export(1600);
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: title || "A little doodle" });
      else downloadBlob(file, file.name);
    } catch (error) { if (error.name !== "AbortError") setStatus(`That image couldn't be shared: ${error.message}`); }
  }
  function fresh() {
    if (history.count && revision.current !== savedRevision.current && !window.confirm("This page has unsaved marks. Start a fresh page anyway?")) return;
    canvas.current.reset(); setTitle(""); setStatus("A fresh page. What shall we make?");
  }
  function chooseInk(color) { setInk(color); if (tool === "eraser") setTool("pen"); }
  const swatches = [...new Set([...PALETTE, ...custom])];
  return <section ref={root} className="mini-sketchbook doodle-studio" id="lets-doodle" aria-labelledby="doodle-title" data-motion-region>
    <Bow /><span className="pixel-label">ONE LITTLE PAGE, ENDLESS LITTLE IDEAS</span>
    <h2 id="doodle-title">lets <em>doodle&lt;3</em></h2>
    <p>A flower? A tiny cat? Whatever’s in your head. 🎨</p>
    {paletteMessage && <p className="doodle-palette-note" role="status">Your colour-club paints are here ♡</p>}
    <div className="doodle-paper" aria-busy={save.isPending}>
      <div className="notebook-rings" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div>
      <DrawingCanvas ref={canvas} initialDrawing={initial.drawing} color={ink} size={size} tool={tool} paper={paper} opacity={opacity} mirror={mirror} fill={fill} aspect={aspect}
        label="Birthday doodle canvas" disabled={save.isPending}
        onChange={next => { drawing.current = canvas.current.snapshot(); setHistory(next); dirty(); }} />
      {!history.count && <span className="doodle-invitation" aria-hidden="true">your tiny masterpiece<br /><b>goes here ↓</b></span>}
    </div>
    <fieldset className="doodle-controls" disabled={save.isPending} aria-label="Doodle tools">
      <div className="doodle-quick-colours" role="group" aria-label="Doodle colours">
        {[...new Set([...INKS, ink])].map(color => <button className="doodle-swatch" key={color} style={{ "--ink": color }} aria-label={`Doodle in ${color}`} aria-pressed={color === ink && tool !== "eraser"} onClick={() => chooseInk(color)} />)}
        <label className="doodle-custom-colour" title="Pick any colour"><span aria-hidden="true">+</span><input type="color" value={ink} aria-label="Pick any colour" onChange={event => { chooseInk(event.target.value); }} /></label>
      </div>
      <div className="doodle-basic-tools" role="group" aria-label="Quick drawing tools">
        <button aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>Brush</button>
        <button aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>Eraser</button>
        <button disabled={!history.canUndo} onClick={() => canvas.current.undo()}>Undo ↶</button>
        <button disabled={!history.canRedo} onClick={() => canvas.current.redo()}>Redo ↷</button>
      </div>
      <details className="doodle-fold" open={more} onToggle={event => setMore(event.currentTarget.open)}>
        <summary>More art toys <span aria-hidden="true">✧</span></summary>
        <div className="doodle-art-tray">
          <span className="pixel-label">PICK YOUR STROKE</span>
          <div className="doodle-brushes" role="group" aria-label="Brush styles">{BRUSHES.map(brush => <button key={brush.id} aria-pressed={tool === brush.id} onClick={() => setTool(brush.id)}><ToolMark tool={brush.id} />{brush.label}</button>)}</div>
          <div className="doodle-sliders">
            <label>Size <output>{size}</output><input aria-label="Brush size" type="range" min="2" max="48" value={size} onChange={event => setSize(Number(event.target.value))} /></label>
            <label>Opacity <output>{Math.round(opacity * 100)}%</output><input aria-label="Ink opacity" type="range" min="20" max="100" value={Math.round(opacity * 100)} onChange={event => setOpacity(Number(event.target.value) / 100)} /></label>
          </div>
          <span className="pixel-label">LITTLE SHAPES · TAP OR DRAG</span>
          <div className="doodle-shapes" role="group" aria-label="Shapes and stamps">{SHAPES.map(shape => <button key={shape.id} aria-pressed={tool === shape.id} onClick={() => setTool(shape.id)}><ToolMark tool={shape.id} />{shape.label}</button>)}</div>
          <div className="doodle-toggles"><label><input type="checkbox" checked={fill} onChange={event => setFill(event.target.checked)} />Fill shapes</label><label><input type="checkbox" checked={mirror} onChange={event => setMirror(event.target.checked)} />Mirror drawing ♡</label></div>
          <span className="pixel-label">A FEW MORE COLOURS</span>
          <div className="doodle-all-colours" role="group" aria-label="All paint colours">{swatches.map(color => <button key={color} className="doodle-swatch" style={{ "--ink": color }} aria-pressed={ink === color && tool !== "eraser"} aria-label={`Paint in ${color}`} onClick={() => chooseInk(color)} />)}</div>
          <span className="pixel-label">YOUR PAPER</span>
          <div className="doodle-papers" role="group" aria-label="Paper choices">{Object.entries(PAPERS).map(([key, value]) => <button key={key} style={{ "--paper": value.fill }} aria-pressed={paper === key} onClick={() => { if (paper !== key) { setPaper(key); dirty(); } }}><i />{value.label}</button>)}</div>
          <button className="doodle-link" disabled={!history.count} onClick={() => canvas.current.clear()}>Clear the page ↺ <small>(you can undo this)</small></button>
        </div>
      </details>
      <details className="doodle-fold" onToggle={event => setMixing(event.currentTarget.open)}>
        <summary>Mix a new colour <span aria-hidden="true">🎨</span></summary>
        {mixing && <Suspense fallback={<p>Opening the paint box…</p>}><PaintMixer palette={swatches} onUse={mixed => { setCustom(old => [mixed, ...old.filter(color => color !== mixed)].slice(0, 18)); chooseInk(mixed); setStatus("Your new paint is on the brush. Make a little mark ♡"); }} /></Suspense>}
      </details>
      <details className="doodle-fold doodle-idea"><summary>A little idea, if you need one <span aria-hidden="true">✿</span></summary><Discovery kind="art" label="A PROMPT, IF YOU FEEL LIKE IT" another /></details>
      <label className="doodle-title-input"><span className="sr-only">Name your doodle</span><input value={title} maxLength={300} placeholder="name your little masterpiece (optional)" onChange={event => { setTitle(event.target.value); dirty(); }} /></label>
      <div className="doodle-save-actions">
        <button className="button-plum" disabled={!history.count || kept} onClick={() => save.mutate()}>{save.isPending ? "Keeping it…" : kept ? "Kept in your gallery ♡" : "Keep this doodle ♡"}</button>
        <button className="doodle-link" disabled={!history.count} onClick={share}>Share / download ↗</button>
      </div>
      <button className="doodle-link doodle-new-page" onClick={fresh}>A fresh page ↗</button>
    </fieldset>
    <p className="doodle-status" role="status">{status}</p>
    {save.error && <p className="doodle-error" role="alert">{save.error.message} You can try keeping it again.</p>}
    <DoodleGallery open={gallery} onToggle={setGallery} />
  </section>;
}
