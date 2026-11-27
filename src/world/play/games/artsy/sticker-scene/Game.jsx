import { memo, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGesture } from "@use-gesture/react";
import { api } from "../../../../../lib/api.js";
import { haptic } from "../../../../../lib/native.js";
import StickerArt, { STICKER_ARTS } from "../../../../../shared/stickers/StickerArt.jsx";
import { STICKER_PACKS } from "../../../../../../shared/stickers.js";
import { useElementSize, useSavedState, useToast } from "../_kit/hooks.js";
import { rewardOnce } from "../_kit/rewards.js";
import { canvasFile, drawSvg, loadImage, useArtShare } from "../_kit/share.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import { SCENES, SceneArt } from "./scenes.jsx";
import { ASPECT, MAX_STICKERS, bringToFront, duplicate, handleTo, moveTo, pinchTo, placeNew, placement, pushHistory, removeItem, updateItem } from "./logic.js";
import "../_kit/kit.css";
import "./sticker-scene.css";

const START = { scene: "sky", items: [] };
const WORDS = ["ily ♡", "miss u", "hi cutie", "good morning", "sweet dreams", "proud of u", "soon ✈", "us ♡"];
const FLUENT = STICKER_PACKS.flatMap((pack) => pack.stickers);
const TABS = [
  { id: "cute", name: "cute" },
  { id: "collected", name: "collected" },
  { id: "yours", name: "yours" },
  { id: "words", name: "words" },
  { id: "scenes", name: "scenes" },
];

export default function StickerScene({ onReward }) {
  const [draft, setDraft] = useSavedState("sticker-scene", START);
  const scene = draft.scene ?? "sky";
  const items = draft.items ?? [];
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("cute");
  const [history, setHistory] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [toast, showToast] = useToast();
  const [word, setWord] = useState("");
  const areaRef = useRef(null), sceneRef = useRef(null), sceneSvg = useRef(null);
  const area = useElementSize(areaRef);
  const width = Math.max(100, Math.floor(Math.min(area.width - 24, (area.height - 12) / ASPECT)));
  const height = Math.round(width * ASPECT);

  const collected = useQuery({ queryKey: ["me", "stickers"], queryFn: () => api("/me/stickers"), staleTime: 60_000 });
  const own = useQuery({ queryKey: ["me", "chat", "stickers"], queryFn: () => api("/me/chat/stickers"), staleTime: 5 * 60_000 });
  const have = new Set((collected.data?.collected ?? []).map((each) => String(each.id).replace(/^st-/, "")));

  function change(next, { keepHistory = true } = {}) {
    if (keepHistory) setHistory((old) => pushHistory(old, items));
    setDraft((old) => ({ ...START, ...old, items: typeof next === "function" ? next(old.items ?? []) : next }));
  }
  function add(kind, ref) {
    if (items.length >= MAX_STICKERS) return showToast("that’s a full scene ♡ send it, or tidy a few away");
    const item = placeNew(items, { kind, ref });
    change([...items, item]);
    setSelected(item.id);
    haptic("light");
  }
  function undo() {
    if (!history.length) return;
    const previous = history.at(-1);
    setHistory((old) => old.slice(0, -1));
    setDraft((old) => ({ ...old, items: previous }));
    if (!previous.some((item) => item.id === selected)) setSelected(null);
  }

  // ---------- touch: drag a sticker, pinch to size and turn, or use the corner handle ----------
  const elements = useRef(new Map());
  const live = useRef(null); // { id, start, item }
  const show = (item) => {
    const el = elements.current.get(item.id);
    if (!el) return;
    const style = placement(item, width);
    el.style.width = style.width;
    el.style.transform = style.transform;
  };
  const pointInScene = (x, y) => {
    const rect = sceneRef.current.getBoundingClientRect();
    return [x - rect.left, y - rect.top];
  };
  useGesture(
    {
      onDragStart: ({ event }) => {
        const handle = event.target.closest?.("[data-handle]");
        const target = event.target.closest?.("[data-sticker]");
        const id = handle?.dataset.handle ?? target?.dataset.sticker ?? null;
        const item = items.find((each) => each.id === id);
        live.current = item ? { id, start: item, item, handle: Boolean(handle) } : null;
        if (item && id !== selected) setSelected(id);
      },
      onDrag: ({ tap, movement: [mx, my], initial, xy, pinching, cancel, last, event }) => {
        if (pinching) return cancel();
        const current = live.current;
        if (tap) {
          const id = event?.target?.closest?.("[data-sticker]")?.dataset.sticker ?? event?.target?.closest?.("[data-handle]")?.dataset.handle ?? null;
          setSelected(id);
          if (id) haptic("light");
          live.current = null;
          return;
        }
        if (!current) return;
        let next;
        if (current.handle) {
          const s = current.start;
          const centre = [s.x * width, s.y * height];
          next = handleTo(s, centre, pointInScene(...initial), pointInScene(...xy));
        } else {
          next = moveTo(current.start, current.start.x + mx / width, current.start.y + my / height);
        }
        current.item = next;
        show(next);
        if (last) {
          change((old) => updateItem(old, next.id, next));
          live.current = null;
        }
      },
      onPinchStart: ({ origin }) => {
        const under = document.elementFromPoint(...origin)?.closest?.("[data-sticker]")?.dataset.sticker;
        const id = selected ?? under ?? null;
        const item = items.find((each) => each.id === id);
        live.current = item ? { id, start: item, item } : null;
        if (item && id !== selected) setSelected(id);
      },
      onPinch: ({ movement: [ratio, turn], last }) => {
        const current = live.current;
        if (!current) return;
        const next = pinchTo(current.start, ratio, turn);
        current.item = next;
        show(next);
        if (last) {
          change((old) => updateItem(old, next.id, next));
          live.current = null;
        }
      },
    },
    {
      target: sceneRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true, tapsThreshold: 6 },
      pinch: { scaleBounds: { min: 0.2, max: 6 }, rubberband: false },
    },
  );

  const chosen = items.find((item) => item.id === selected) ?? null;
  const act = (fn) => {
    change(fn);
    haptic("light");
  };

  return (
    <div className="artsy ss">
      <div className="artsy-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="undo" disabled={!history.length} onClick={undo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" /></svg>
        </button>
        {chosen ? (
          <div className="ss-selbar" role="toolbar" aria-label="this sticker">
            <button type="button" className="artsy-chip" onClick={() => act((old) => updateItem(old, chosen.id, { flip: !chosen.flip }))}>flip</button>
            <button type="button" className="artsy-chip" onClick={() => act((old) => bringToFront(old, chosen.id))}>front</button>
            <button type="button" className="artsy-chip" disabled={items.length >= MAX_STICKERS} onClick={() => act((old) => duplicate(old, chosen.id, `${chosen.id}c${Date.now().toString(36)}`))}>copy</button>
            <button type="button" className="artsy-chip artsy-chip--icon" aria-label="remove sticker" onClick={() => { act((old) => removeItem(old, chosen.id)); setSelected(null); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div className="artsy-bar__grow">
              <span className="artsy-bar__label">{items.length ? `${items.length} sticker${items.length === 1 ? "" : "s"}` : "tap a sticker below ✿"}</span>
            </div>
            <button type="button" className="artsy-chip artsy-chip--primary" disabled={!items.length} onClick={() => { setSelected(null); setSharing(true); }}>
              send ♡
            </button>
          </>
        )}
      </div>
      <div className="ss-area" ref={areaRef}>
        <div className="ss-scene" ref={sceneRef} style={{ width, height }}>
          <SceneArt id={scene} className="ss-scene__art" svgRef={sceneSvg} />
          {items.map((item) => (
            <Placed key={item.id} item={item} width={width} selected={item.id === selected} register={(el) => (el ? elements.current.set(item.id, el) : elements.current.delete(item.id))} />
          ))}
        </div>
      </div>
      <div className="artsy-tray ss-tray">
        <div className="artsy-tabs" role="tablist" aria-label="stickers">
          {TABS.map((each) => (
            <button key={each.id} type="button" role="tab" className="artsy-tab" aria-selected={tab === each.id} onClick={() => setTab(each.id)}>
              {each.name}
            </button>
          ))}
        </div>
        <div className="artsy-scroller ss-shelf" role="tabpanel">
          {tab === "cute" &&
            FLUENT.map((sticker) => (
              <button key={sticker.id} type="button" className="ss-tile" aria-label={`add ${sticker.label}`} onClick={() => add("pack", sticker.url)}>
                <img src={sticker.url} alt="" loading="lazy" draggable="false" />
              </button>
            ))}
          {tab === "collected" &&
            STICKER_ARTS.map((art) => {
              const mine = have.has(art);
              return (
                <button key={art} type="button" className="ss-tile" data-locked={!mine} aria-label={mine ? `add ${art}` : `${art}, not collected yet`} onClick={() => (mine ? add("collect", art) : showToast("not in your collection yet ✿ the daily drawer and games give these"))}>
                  <StickerArt art={art} size={52} />
                </button>
              );
            })}
          {tab === "yours" &&
            ((own.data?.stickers ?? []).length ? (
              own.data.stickers.map((sticker) => (
                <button key={sticker.id} type="button" className="ss-tile" aria-label={`add ${sticker.label || "your sticker"}`} onClick={() => add("own", sticker.url)}>
                  <img src={sticker.url} alt="" loading="lazy" draggable="false" />
                </button>
              ))
            ) : (
              <p className="ss-empty">{own.isPending ? "opening your stickers…" : "stickers you add in the chat show up here ♡"}</p>
            ))}
          {tab === "words" && (
            <>
              <form className="ss-word" onSubmit={(event) => { event.preventDefault(); if (word.trim()) { add("word", word.trim().slice(0, 24)); setWord(""); } }}>
                <input value={word} maxLength={24} placeholder="your words…" aria-label="your own words" onChange={(event) => setWord(event.target.value)} />
                <button type="submit" className="artsy-chip" disabled={!word.trim()}>add</button>
              </form>
              {WORDS.map((text) => (
                <button key={text} type="button" className="ss-tile ss-tile--word" onClick={() => add("word", text)}>
                  <WordArt text={text} />
                </button>
              ))}
            </>
          )}
          {tab === "scenes" &&
            SCENES.map((each) => (
              <button key={each.id} type="button" className="ss-scene-tile" aria-pressed={each.id === scene} aria-label={each.name} onClick={() => setDraft((old) => ({ ...START, ...old, scene: each.id }))}>
                <SceneArt id={each.id} />
                <span>{each.name}</span>
              </button>
            ))}
        </div>
      </div>
      <ShareSheet open={sharing} onClose={() => setSharing(false)} make={() => paintScene(sceneSvg.current, sceneRef.current, items)} onShared={() => rewardOnce(onReward, "sticker-scene", "first")} onFresh={() => { change([]); setSharing(false); }} />
      <Toast text={toast} />
    </div>
  );
}

const Placed = memo(function Placed({ item, width, selected, register }) {
  return (
    <div ref={register} className="ss-sticker" data-sticker={item.id} data-selected={selected} style={placement(item, width)}>
      {item.kind === "collect" ? (
        <StickerArt art={item.ref} size={64} className="ss-sticker__svg" />
      ) : item.kind === "word" ? (
        <WordArt text={item.ref} />
      ) : (
        <img src={item.ref} alt="" draggable="false" />
      )}
      {selected && <span className="ss-handle" data-handle={item.id} aria-hidden="true" />}
    </div>
  );
});

function WordArt({ text }) {
  const w = Math.max(80, 26 + [...text].length * 15);
  return (
    <svg viewBox={`0 0 ${w} 52`} className="ss-word-art" aria-label={text}>
      <rect x="3" y="3" width={w - 6} height="46" rx="23" fill="#fffafd" stroke="#b79be0" strokeWidth="3" />
      <text x={w / 2} y="34" textAnchor="middle" fontSize="27" fill="#5d3f78" fontFamily="Gaegu, cursive" fontWeight="700">
        {text}
      </text>
    </svg>
  );
}

/** The scene and its stickers as one picture (1080 × 1350), drawn the way she sees it. */
async function paintScene(sceneSvg, sceneEl, items) {
  const W = 1080, H = Math.round(W * ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  await drawSvg(ctx, sceneSvg, 0, 0, W, H);
  await document.fonts?.ready;
  for (const item of items) {
    const el = sceneEl.querySelector(`[data-sticker="${CSS.escape(item.id)}"]`);
    const w = item.s * W;
    ctx.save();
    ctx.translate(item.x * W, item.y * H);
    ctx.rotate((item.r * Math.PI) / 180);
    if (item.flip) ctx.scale(-1, 1);
    try {
      if (item.kind === "word") {
        const text = item.ref;
        const box = el?.querySelector("svg")?.viewBox.baseVal;
        const k = w / (box?.width || 120);
        const h = 52 * k;
        ctx.fillStyle = "#fffafd";
        ctx.strokeStyle = "#b79be0";
        ctx.lineWidth = 3 * k;
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 3 * k, -h / 2 + 3 * k, w - 6 * k, h - 6 * k, 23 * k);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#5d3f78";
        ctx.font = `700 ${27 * k}px Gaegu, cursive`;
        ctx.textAlign = "center";
        ctx.fillText(text, 0, -h / 2 + 34 * k);
      } else if (item.kind === "collect") {
        const svg = el?.querySelector("svg");
        if (svg) await drawSvg(ctx, svg, -w / 2, -w / 2, w, w);
      } else {
        const image = await loadImage(item.ref);
        const h = (w * image.naturalHeight) / (image.naturalWidth || 1);
        ctx.drawImage(image, -w / 2, -h / 2, w, h);
      }
    } finally {
      ctx.restore();
    }
  }
  return canvas;
}

function ShareSheet({ open, onClose, make, onShared, onFresh }) {
  const { partner, toChat, toDoodles } = useArtShare();
  const [toast, showToast] = useToast();
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState("");
  const canvas = useRef(null);
  useEffect(() => {
    if (!open) return;
    toChat.reset();
    toDoodles.reset();
    setFailed("");
    let url = null, live = true;
    make()
      .then((made) => {
        canvas.current = made;
        made.toBlob((blob) => {
          if (!blob || !live) return;
          url = URL.createObjectURL(blob);
          setPreview(url);
        }, "image/png");
      })
      .catch(() => live && setFailed("This scene couldn’t be turned into a picture. Try again?"));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const file = () => canvasFile(canvas.current, "sticker-scene");
  const error = failed || (toChat.error || toDoodles.error)?.message;
  return (
    <Sheet open={open} title="your little scene" onClose={onClose}>
      <div className="ss-share">
        <div className="ss-share__preview">{preview ? <img src={preview} alt="your sticker scene" /> : <span className="artsy-hand">{failed ? "oh no" : "putting it together…"}</span>}</div>
        <div className="ss-share__buttons">
          <button type="button" className="artsy-primary" disabled={!preview || toChat.isPending || toChat.isSuccess} onClick={() => toChat.mutate({ make: file, alt: "a sticker scene" }, { onSuccess: () => { showToast(`sent to ${partner} ♡`); onShared(); } })}>
            {toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner} ♡`}
          </button>
          <button type="button" className="artsy-secondary" disabled={!preview || toDoodles.isPending || toDoodles.isSuccess} onClick={() => toDoodles.mutate({ make: file, title: "a sticker scene" }, { onSuccess: () => { showToast("tucked into your doodles ♡"); onShared(); } })}>
            {toDoodles.isPending ? "keeping…" : toDoodles.isSuccess ? "in your doodles ✓" : "keep in my doodles"}
          </button>
        </div>
        {error && <p className="artsy-error" role="alert">{error}</p>}
        <button type="button" className="artsy-chip ss-share__fresh" onClick={onFresh}>
          clear the scene <small>(undo brings it back)</small>
        </button>
      </div>
      <Toast text={toast} />
    </Sheet>
  );
}
