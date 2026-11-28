import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { haptic } from "../../../../../lib/native.js";
import { burst } from "../_kit/confetti.js";
import { useCalm, useElementSize, useSavedState, useToast } from "../_kit/hooks.js";
import { countMade, rewardOnce } from "../_kit/rewards.js";
import { canvasFile, loadImage, useArtShare, useOpenGallery } from "../_kit/share.js";
import { newId } from "../_kit/store.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import Bouquet from "./Bouquet.jsx";
import { FLOWERS, flowerById, nameOf, roleOf } from "./flowers.jsx";
import { CARD_BOX, RIBBONS, Ribbon, WRAPS, WrapBack, WrapFront } from "./wraps.jsx";
import { CARD_MAX, CARD_PRESETS, H, MAX_FLOWERS, W, addFlower, arrange, bouquetName, duplicate, handleTo, headTransform, moveTo, pinchTo, placeNew, pushHistory, removeItem, shelve, stemPath, surprise, tidyCard, toBack, toFront, turnOf, unshelve, updateItem } from "./logic.js";
import "../_kit/kit.css";
import "./bouquet.css";
import { useIsAdmin } from "../../../../../lib/session.js";

// The bouquet maker: tap flowers into a fan (they land where they look nice), drag to move, pinch or
// the little handle to size and turn, pick a wrap, a ribbon and a card, then tie it up: it goes on
// her vase shelf (on the phone), and she can keep it in her gallery or send it to Josh.

const START = { items: [], wrap: { id: "tissue", c: 0 }, ribbon: { id: "satin", c: 0 }, card: "", shelf: [], editing: null, colours: {} };
const TABS = [
  { id: "bloom", name: "blooms" },
  { id: "little", name: "little ones" },
  { id: "green", name: "greenery" },
  { id: "extra", name: "extras" },
  { id: "wrap", name: "wrap" },
  { id: "ribbon", name: "ribbon" },
  { id: "card", name: "card" },
];
const CATALOGUE = { flowers: FLOWERS, wraps: WRAPS, ribbons: RIBBONS };
const pick = (draft) => ({ items: draft.items, wrap: draft.wrap, ribbon: draft.ribbon, card: draft.card });

export default function BouquetMaker({ onReward }) {
  const [saved, setSaved] = useSavedState("bouquet", START);
  const draft = { ...START, ...saved };
  const bouquet = pick(draft);
  const [tab, setTab] = useState("bloom");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [finished, setFinished] = useState(null); // the shelf entry she just tied up
  const [tying, setTying] = useState(false);
  const [toast, showToast] = useToast();
  const calm = useCalm();
  const stageRef = useRef(null), canvasRef = useRef(null), svgRef = useRef(null), ringRef = useRef(null), confettiRef = useRef(null);
  const stage = useElementSize(stageRef);
  const width = Math.max(150, Math.floor(Math.min(stage.width - 16, (stage.height - 8) * 0.75)));
  const height = Math.round((width * H) / W);
  const chosen = draft.items.find((item) => item.id === selected) ?? null;

  /** Every change goes through here, so undo can step back through it. */
  function change(patch, { keep = true } = {}) {
    if (keep) setHistory((old) => pushHistory(old, pick({ ...START, ...saved })));
    setSaved((old) => {
      const base = { ...START, ...old };
      return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
    });
  }
  function undo() {
    if (!history.length) return;
    const previous = history.at(-1);
    setHistory((old) => old.slice(0, -1));
    setSaved((old) => ({ ...START, ...old, ...previous }));
    if (!previous.items.some((item) => item.id === selected)) setSelected(null);
    haptic("light");
  }
  function addKind(flower) {
    if (draft.items.length >= MAX_FLOWERS) return showToast("a very full bouquet ♡ tie it up, or take a few out");
    const item = placeNew(draft.items, { kind: flower.id, c: draft.colours?.[flower.id] ?? 0, role: flower.role });
    change((old) => ({ items: addFlower(old.items, item, flower.role) }));
    setSelected(item.id);
    haptic("light");
  }
  function recolour(item, c) {
    change((old) => ({ items: updateItem(old.items, item.id, { c }), colours: { ...old.colours, [item.kind]: c } }));
    haptic("light");
  }
  function fresh() {
    change({ items: [], card: "", editing: null });
    setSelected(null);
  }

  // ---------- moving flowers: refs, so a drag never re-renders the whole bouquet ----------
  const nodes = useRef(new Map());
  const register = useCallback((id, part, el) => {
    const key = `${id}:${part}`;
    if (el) nodes.current.set(key, el);
    else nodes.current.delete(key);
  }, []);
  const placeRing = (item) => {
    const ring = ringRef.current;
    if (!ring || !item) return;
    const r = 30 * (item.s ?? 1);
    const a = ((turnOf(item) + 45) * Math.PI) / 180;
    ring.setAttribute("transform", `translate(${item.x} ${item.y})`);
    ring.querySelector("[data-ring]")?.setAttribute("r", String(r));
    ring.querySelector("[data-handle]")?.setAttribute("transform", `translate(${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)})`);
  };
  const show = (item) => {
    const flower = flowerById(item.kind);
    nodes.current.get(`${item.id}:head`)?.setAttribute("transform", headTransform(item));
    const stem = nodes.current.get(`${item.id}:stem`);
    if (stem && flower) for (const path of stem.children) path.setAttribute("d", stemPath(item, flower.base));
    placeRing(item);
  };
  useEffect(() => placeRing(chosen));

  // One finger moves a flower (or turns it by its handle); two fingers size and turn it. They keep
  // separate notes, so a pinch that starts while the first finger is already dragging never loses
  // its flower to the drag.
  const live = useRef(null);
  const pinchLive = useRef(null);
  const toBouquet = (x, y) => {
    const rect = svgRef.current.getBoundingClientRect();
    return [((x - rect.left) / rect.width) * W, ((y - rect.top) / rect.height) * H];
  };
  /** The flower a pinch is about: the chosen one when the fingers are around it, else the one under them. */
  const pinchTarget = ([x, y]) => {
    const current = draft.items.find((each) => each.id === selected);
    if (current && svgRef.current) {
      const [bx, by] = toBouquet(x, y);
      if (Math.hypot(bx - current.x, by - current.y) < 30 * (current.s ?? 1) + 34) return current;
    }
    const under = document.elementFromPoint(x, y)?.closest?.("[data-flower]")?.dataset.flower;
    return draft.items.find((each) => each.id === under) ?? current ?? null;
  };
  useGesture(
    {
      onDragStart: ({ event, pinching, touches }) => {
        if (pinching || touches > 1) {
          live.current = null;
          return;
        }
        const handle = event.target.closest?.("[data-handle]");
        const id = handle ? selected : event.target.closest?.("[data-flower]")?.dataset.flower ?? null;
        const item = draft.items.find((each) => each.id === id);
        live.current = item ? { start: item, item, handle: Boolean(handle) } : null;
        if (item && id !== selected) setSelected(id);
      },
      onDrag: ({ tap, movement: [mx, my], initial, xy, pinching, touches, canceled, cancel, last, event }) => {
        if (pinching || touches > 1 || canceled) {
          live.current = null;
          return pinching && !canceled ? cancel() : undefined;
        }
        if (tap) {
          const handle = event?.target?.closest?.("[data-handle]");
          const id = handle ? selected : event?.target?.closest?.("[data-flower]")?.dataset.flower ?? null;
          setSelected(id);
          if (id) haptic("light");
          live.current = null;
          return;
        }
        const current = live.current;
        if (!current || !svgRef.current) return;
        const per = W / svgRef.current.getBoundingClientRect().width;
        const next = current.handle ? handleTo(current.start, toBouquet(...initial), toBouquet(...xy)) : moveTo(current.start, current.start.x + mx * per, current.start.y + my * per);
        current.item = next;
        show(next);
        if (last) {
          change((old) => ({ items: updateItem(old.items, next.id, next) }));
          live.current = null;
        }
      },
      onPinchStart: ({ origin }) => {
        // A drag the first finger had begun stops here; its flower snaps back under the pinch.
        const dragged = live.current;
        live.current = null;
        if (dragged) show(dragged.start);
        const item = pinchTarget(origin);
        pinchLive.current = item ? { start: item, item } : null;
        if (item && item.id !== selected) setSelected(item.id);
      },
      onPinch: ({ movement: [ratio, turn], last }) => {
        const current = pinchLive.current;
        if (!current) return;
        const next = pinchTo(current.start, ratio, turn);
        current.item = next;
        show(next);
        if (last) {
          change((old) => ({ items: updateItem(old.items, next.id, next) }));
          pinchLive.current = null;
        }
      },
    },
    {
      target: canvasRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true, tapsThreshold: 6 },
      // Every pinch measures from 1 (not from where the last one ended), so sizing never gets stuck.
      pinch: { from: () => [1, 0], scaleBounds: { min: 0.2, max: 6 }, rubberband: false },
    },
  );

  // ---------- tying it up ----------
  function tieUp() {
    if (!draft.items.length) return;
    setSelected(null);
    const name = bouquetName(draft.items, nameOf);
    const result = shelve(draft.shelf ?? [], bouquet, { id: newId("bq"), name, editing: draft.editing });
    setSaved((old) => ({ ...START, ...old, shelf: result.shelf, editing: result.entry.id }));
    haptic("success");
    if (!calm) burst(confettiRef.current, { y: 0.42, power: 1.1 });
    rewardOnce(onReward, "bouquet", "first");
    if (result.added && countMade("bouquet") >= 5) rewardOnce(onReward, "bouquet", "five");
    setTying(true);
    setTimeout(() => {
      setTying(false);
      setFinished(result.entry);
    }, calm ? 0 : 750);
  }

  const used = draft.items.length;
  return (
    <div className="artsy bq">
      <div className="artsy-bar bq-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="undo" disabled={!history.length} onClick={undo}>
          <UndoIcon />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon bq-shelf-button" onClick={() => { setSelected(null); setShelfOpen(true); }} aria-label={`your vase shelf, ${draft.shelf?.length ?? 0} bouquets`}>
          <VaseIcon />
          {draft.shelf?.length > 0 && <span className="bq-count">{draft.shelf.length}</span>}
        </button>
        <div className="artsy-bar__grow" />
        <button
          type="button"
          className="artsy-chip"
          onClick={() => {
            const next = surprise(CATALOGUE);
            change({ ...next, editing: null });
            setSelected(null);
            haptic("medium");
          }}
        >
          <SparkIcon />
          surprise
        </button>
        <button type="button" className="artsy-chip artsy-chip--primary" disabled={!used || tying} onClick={tieUp}>
          <BowIcon />
          tie it
        </button>
      </div>

      <div className="bq-stage" ref={stageRef}>
        <div className="bq-canvas" ref={canvasRef} data-tying={tying || undefined} style={{ width, height }}>
          <Bouquet bouquet={bouquet} svgRef={svgRef} register={register} className="bq-svg" label={used ? `your bouquet: ${bouquetName(draft.items, nameOf)}` : "an empty wrap, waiting for flowers"} />
          <svg className="bq-overlay" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {chosen && (
              <g ref={ringRef}>
                <circle data-ring r="30" fill="none" stroke="#9a6cc8" strokeWidth="1.6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                <g data-handle>
                  <circle r="17" fill="transparent" />
                  <circle r="9" fill="#fffafd" stroke="#9a6cc8" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <path d="M-3.5 1.5A4 4 0 1 0-1 -3.8M-1-3.8l-.4-2.6M-1-3.8l2.4-.6" fill="none" stroke="#5d3f78" strokeWidth="1.4" strokeLinecap="round" />
                </g>
              </g>
            )}
          </svg>
        </div>
        {!used && (
          <div className="bq-hello" aria-hidden="true">
            <p className="artsy-hand">
              tap a flower below
              <br />
              <b>and it lands just right ♡</b>
            </p>
          </div>
        )}
        {used >= 3 && !chosen && (
          <button type="button" className="artsy-chip bq-tidy" onClick={() => { change((old) => ({ items: arrange(old.items, roleOf) })); haptic("medium"); }}>
            <FluffIcon />
            fluff
          </button>
        )}
        {chosen && (
          <Selection
            item={chosen}
            full={used >= MAX_FLOWERS}
            onColour={(c) => recolour(chosen, c)}
            onFront={() => { change((old) => ({ items: toFront(old.items, chosen.id) })); haptic("light"); }}
            onBack={() => { change((old) => ({ items: toBack(old.items, chosen.id) })); haptic("light"); }}
            onCopy={() => { const id = newId("f"); change((old) => ({ items: duplicate(old.items, chosen.id, id) })); setSelected(id); haptic("light"); }}
            onRemove={() => { change((old) => ({ items: removeItem(old.items, chosen.id) })); setSelected(null); haptic("light"); }}
            onDone={() => setSelected(null)}
          />
        )}
      </div>

      <div className="artsy-tray bq-tray">
        <div className="artsy-tabs" role="tablist" aria-label="what to add">
          {TABS.map((each) => (
            <button key={each.id} type="button" role="tab" className="artsy-tab" aria-selected={tab === each.id} onClick={() => setTab(each.id)}>
              {each.name}
            </button>
          ))}
        </div>
        {tab === "wrap" ? (
          <Choices
            label="wrap"
            options={WRAPS}
            value={draft.wrap}
            onPick={(wrap) => { change({ wrap }); haptic("light"); }}
            Thumb={WrapThumb}
          />
        ) : tab === "ribbon" ? (
          <Choices
            label="ribbon"
            options={RIBBONS}
            value={draft.ribbon}
            onPick={(ribbon) => { change({ ribbon }); haptic("light"); }}
            Thumb={RibbonThumb}
            swatch={(colour) => colour}
          />
        ) : tab === "card" ? (
          <CardPicker value={draft.card} onChange={(card) => change({ card: tidyCard(card) })} />
        ) : (
          <div className="artsy-scroller bq-shelf-row" role="tabpanel">
            {FLOWERS.filter((flower) => flower.role === tab).map((flower) => (
              <FlowerTile key={flower.id} flower={flower} c={draft.colours?.[flower.id] ?? 0} onAdd={addKind} />
            ))}
          </div>
        )}
      </div>

      <ShelfSheet
        open={shelfOpen}
        shelf={draft.shelf ?? []}
        onClose={() => setShelfOpen(false)}
        onOpen={(entry) => {
          change({ items: entry.items, wrap: entry.wrap, ribbon: entry.ribbon, card: entry.card ?? "", editing: entry.id });
          setShelfOpen(false);
          setSelected(null);
        }}
        onRemove={(id) => setSaved((old) => ({ ...START, ...old, shelf: unshelve(old.shelf ?? [], id), editing: old.editing === id ? null : old.editing }))}
      />
      <FinishedSheet
        entry={finished}
        svgRef={svgRef}
        onClose={() => setFinished(null)}
        onAnother={() => {
          fresh();
          setFinished(null);
          showToast("a fresh wrap · undo brings the last one back");
        }}
      />
      <canvas ref={confettiRef} className="bq-confetti" aria-hidden="true" />
      <Toast text={toast} />
    </div>
  );
}

// ---------------------------------------------------------------- the tray
const FlowerTile = memo(function FlowerTile({ flower, c, onAdd }) {
  const [x, y, w, h] = flower.box;
  const side = Math.max(w, h);
  return (
    <button type="button" className="bq-tile" onClick={() => onAdd(flower)} aria-label={`add ${flower.name}`}>
      <svg viewBox={`${x + w / 2 - side / 2} ${y + h / 2 - side / 2} ${side} ${side}`} aria-hidden="true">
        <flower.Draw c={flower.colors[c] ?? flower.colors[0]} />
      </svg>
      <span>{flower.name}</span>
    </button>
  );
});

function Choices({ label, options, value, onPick, Thumb, swatch = (colour) => colour[0] }) {
  const current = options.find((each) => each.id === value?.id) ?? options[0];
  return (
    <div className="bq-choices" role="tabpanel">
      <div className="artsy-scroller bq-swatches" role="radiogroup" aria-label={`${current.name} colour`}>
        {current.colors.map((colour, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={(value?.c ?? 0) === i}
            aria-pressed={(value?.c ?? 0) === i}
            aria-label={`${current.name} colour ${i + 1}`}
            className="artsy-swatch"
            style={{ "--swatch": swatch(colour) }}
            onClick={() => onPick({ id: current.id, c: i })}
          />
        ))}
      </div>
      <div className="artsy-scroller bq-shelf-row" role="radiogroup" aria-label={label}>
        {options.map((each) => (
          <button key={each.id} type="button" role="radio" aria-checked={current.id === each.id} className="bq-tile" onClick={() => onPick({ id: each.id, c: current.id === each.id ? value?.c ?? 0 : 0 })}>
            <Thumb value={{ id: each.id, c: current.id === each.id ? value?.c ?? 0 : 0 }} />
            <span>{each.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const WrapThumb = memo(function WrapThumb({ value }) {
  return (
    <svg viewBox="14 46 272 354" aria-hidden="true">
      <WrapBack wrap={value} />
      <WrapFront wrap={value} />
    </svg>
  );
});
const RibbonThumb = memo(function RibbonThumb({ value }) {
  return (
    <svg viewBox="96 270 108 108" aria-hidden="true">
      <rect x="96" y="270" width="108" height="108" fill="#f8f1fb" />
      <path d="M126 270H174L170 378H130Z" fill="#efe4f6" />
      <Ribbon ribbon={value} />
    </svg>
  );
});

function CardPicker({ value, onChange }) {
  return (
    <div className="bq-card" role="tabpanel">
      <div className="artsy-scroller">
        <button type="button" className="artsy-chip" aria-pressed={!value} onClick={() => onChange("")}>
          no card
        </button>
        {CARD_PRESETS.map((text) => (
          <button key={text} type="button" className="artsy-chip" aria-pressed={value === text} onClick={() => onChange(text)}>
            {text}
          </button>
        ))}
      </div>
      <label className="bq-card__write">
        <span>or write your own</span>
        <input value={value} maxLength={CARD_MAX} placeholder="a few little words" onChange={(event) => onChange(event.target.value)} enterKeyHint="done" onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} />
      </label>
    </div>
  );
}

function Selection({ item, full, onColour, onFront, onBack, onCopy, onRemove, onDone }) {
  const flower = flowerById(item.kind);
  if (!flower) return null;
  return (
    <div className="bq-sel" role="toolbar" aria-label={`this ${flower.name}`}>
      <div className="bq-sel__top">
        <strong>{flower.name}</strong>
        <div className="bq-sel__swatches" role="radiogroup" aria-label={`${flower.name} colour`}>
          {flower.colors.map((colour, i) => (
            <button key={colour} type="button" role="radio" aria-checked={item.c === i} aria-pressed={item.c === i} aria-label={`${flower.name} colour ${i + 1}`} className="artsy-swatch bq-sel__swatch" style={{ "--swatch": colour }} onClick={() => onColour(i)} />
          ))}
        </div>
      </div>
      <div className="bq-sel__actions">
        <button type="button" onClick={onFront}>
          <LayerIcon up />
          front
        </button>
        <button type="button" onClick={onBack}>
          <LayerIcon />
          back
        </button>
        <button type="button" disabled={full} onClick={onCopy}>
          <CopyIcon />
          copy
        </button>
        <button type="button" onClick={onRemove}>
          <BinIcon />
          remove
        </button>
        <button type="button" className="bq-sel__done" onClick={onDone}>
          done
        </button>
      </div>
      <p className="bq-sel__hint">drag to move · pinch or the little handle to size and turn</p>
    </div>
  );
}

// ---------------------------------------------------------------- sheets
function ShelfSheet({ open, shelf, onClose, onOpen, onRemove }) {
  const [asking, setAsking] = useState(null);
  return (
    <Sheet open={open} title="your vase shelf" onClose={onClose}>
      {shelf.length === 0 ? (
        <p className="bq-empty artsy-hand">tie up a bouquet and it stands here, fresh forever ♡</p>
      ) : (
        <div className="bq-vases">
          {shelf.map((entry) => (
            <div key={entry.id} className="bq-vase">
              <button type="button" className="bq-vase__open" onClick={() => onOpen(entry)} aria-label={`open ${entry.name} to change it`}>
                <Bouquet bouquet={entry} label={entry.name} />
                <span>{entry.name}</span>
              </button>
              <button type="button" className="bq-vase__remove" aria-label={asking === entry.id ? "sure? remove it" : `remove ${entry.name}`} onClick={() => (asking === entry.id ? (onRemove(entry.id), setAsking(null)) : setAsking(entry.id))}>
                {asking === entry.id ? "sure?" : "×"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function FinishedSheet({ entry, svgRef, onClose, onAnother }) {
  // On Josh's phone a keep is only a try: her gallery holds her pieces alone.
  const admin = useIsAdmin();
  const { partner, toChat, toDoodles } = useArtShare();
  const openGallery = useOpenGallery();
  const [preview, setPreview] = useState(null);
  const canvas = useRef(null);
  useEffect(() => {
    if (!entry) return undefined;
    toChat.reset();
    toDoodles.reset();
    let url = null, gone = false;
    paintBouquet(svgRef.current, entry.card)
      .then((made) => {
        if (gone) return;
        canvas.current = made;
        made.toBlob((blob) => {
          if (!blob || gone) return;
          url = URL.createObjectURL(blob);
          setPreview(url);
        }, "image/png");
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [entry?.id, entry?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const file = () => canvasFile(canvas.current, "bouquet");
  const kept = toDoodles.data ?? null;
  const error = toChat.error || toDoodles.error;
  const sendLabel = toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner}`;
  return (
    <Sheet open={Boolean(entry)} title={kept ? (admin ? "a try ♡ only hers go in her gallery" : "in your gallery ♡") : "tied with a bow ♡"} onClose={onClose} className="bq-done">
      {entry && (
        <div className="bq-finish">
          <div className="bq-finish__card">
            <div className="bq-finish__picture">{preview ? <img src={preview} alt={entry.name} /> : <span className="artsy-hand">wrapping it up…</span>}</div>
            <p className="bq-finish__name artsy-hand">{entry.name}</p>
            <p className="bq-finish__line">on your vase shelf ♡</p>
          </div>
          {kept ? (
            <div className="bq-finish__buttons">
              <button type="button" className="artsy-primary" onClick={() => openGallery(kept.id)}>
                see it in my gallery
              </button>
              <button type="button" className="artsy-secondary" onClick={onAnother}>
                make another
              </button>
            </div>
          ) : (
            <div className="bq-finish__buttons">
              <button type="button" className="artsy-primary" disabled={!preview || toDoodles.isPending} onClick={() => toDoodles.mutate({ make: file, title: `bouquet · ${entry.name}` })}>
                {toDoodles.isPending ? "keeping…" : "keep in my gallery ♡"}
              </button>
              <button type="button" className="artsy-secondary" disabled={!preview || toChat.isPending || toChat.isSuccess} onClick={() => toChat.mutate({ make: file, alt: `a bouquet of ${entry.name}`, caption: entry.card || "" })}>
                {sendLabel}
              </button>
            </div>
          )}
          {kept && (
            <button type="button" className="artsy-chip bq-finish__also" disabled={toChat.isPending || toChat.isSuccess} onClick={() => toChat.mutate({ make: file, alt: `a bouquet of ${entry.name}`, caption: entry.card || "" })}>
              {toChat.isSuccess ? sendLabel : `also ${sendLabel} ♡`}
            </button>
          )}
          {error && (
            <p className="artsy-error" role="alert">
              {error.message || "That didn’t go through. Try again?"}
            </p>
          )}
          {!kept && (
            <div className="bq-finish__more">
              <button type="button" className="artsy-chip" onClick={onClose}>
                keep fussing with it
              </button>
              <button type="button" className="artsy-chip" onClick={onAnother}>
                make another
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** The bouquet as a 900 × 1200 picture on soft lilac paper, its card written in her handwriting font. */
async function paintBouquet(svg, card) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  const glow = ctx.createRadialGradient(450, 420, 80, 450, 560, 820);
  glow.addColorStop(0, "#fffbfe");
  glow.addColorStop(1, "#efe2f8");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 900, 1200);
  const clone = svg.cloneNode(true);
  clone.querySelectorAll("[data-card-text]").forEach((node) => node.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "900");
  clone.setAttribute("height", "1200");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    ctx.drawImage(await loadImage(url), 0, 0, 900, 1200);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (card) {
    const font = getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim() || "cursive";
    const size = card.length > 12 ? 11 : 13;
    try {
      await document.fonts?.load(`700 ${size * 3}px ${font}`);
    } catch {
      // the card is written in the fallback font then
    }
    const { x, y, w, h, turn } = CARD_BOX;
    ctx.save();
    ctx.scale(3, 3);
    ctx.translate(x, y);
    ctx.rotate((turn * Math.PI) / 180);
    ctx.font = `700 ${size}px ${font}`;
    ctx.fillStyle = "#5d3f78";
    ctx.textAlign = "center";
    ctx.fillText(card, w / 2 + 4, h / 2 + 5, w - 10);
    ctx.restore();
  }
  return canvas;
}

// ---------------------------------------------------------------- icons
const line = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const UndoIcon = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2.2" aria-hidden="true">
    <path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" />
  </svg>
);
const VaseIcon = () => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <path d="M9 9h6c0 2 2.5 3.2 2.5 6.6 0 3.2-2.4 5-5.5 5s-5.5-1.8-5.5-5C6.5 12.2 9 11 9 9Z" />
    <path d="M12 9V5.5M12 6c-1.2-2-3.2-2.4-4.2-1.4 1 1.6 2.6 1.8 4.2 1.4Zm0-.5c1-1.8 3-2.4 4.2-1.6-.8 1.6-2.6 2-4.2 1.6Z" />
  </svg>
);
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Zm6 10 .9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9Z" fill="currentColor" />
  </svg>
);
const BowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 11c-2.6-3.6-7-4.6-7.6-2.2-.6 2.4 3.6 4.2 7.6 2.2Zm0 0c2.6-3.6 7-4.6 7.6-2.2.6 2.4-3.6 4.2-7.6 2.2Zm-1.2.6-2.6 7 2.4-.8 1 2 .8-7.4Zm2.4 0 2.6 7-2.4-.8-1 2-.8-7.4Z" fill="currentColor" />
  </svg>
);
const FluffIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="12" cy="6.6" rx="2.8" ry="4.4" transform={`rotate(${a} 12 12)`} fill="currentColor" opacity={a % 144 ? 0.55 : 0.95} />)}
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
  </svg>
);
const LayerIcon = ({ up }) => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <path d="M4 12l8 4.5 8-4.5M4 16l8 4.5 8-4.5" opacity="0.5" />
    {up ? <path d="M12 3v9M8.5 6.5 12 3l3.5 3.5" /> : <path d="M12 3v9M8.5 8.5 12 12l3.5-3.5" />}
  </svg>
);
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </svg>
);
const BinIcon = () => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <path d="M4.5 7h15M9.5 7V4.8c0-.5.4-.8.8-.8h3.4c.5 0 .8.4.8.8V7M6.5 7l.9 12.2c.1.9.8 1.6 1.7 1.6h5.8c.9 0 1.6-.7 1.7-1.6L17.5 7" />
  </svg>
);
