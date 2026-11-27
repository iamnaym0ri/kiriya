import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { haptic } from "../../../../../lib/native.js";
import { burst } from "../_kit/confetti.js";
import { useCalm, useSavedState, useToast } from "../_kit/hooks.js";
import { rewardOnce } from "../_kit/rewards.js";
import { canvasFile, drawSvg, useArtShare, useOpenGallery } from "../_kit/share.js";
import { newId } from "../_kit/store.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import Doll from "./Doll.jsx";
import { DollHead, browOf } from "./body.jsx";
import { tieFor } from "./hair.jsx";
import { BACKDROPS, Backdrop, DRAWERS, EYE_COLOURS, EYE_STYLES, HAIR, HAIR_COLOURS, ITEMS, MOUTHS, SETS, SKINS, hairById, itemById } from "./wardrobe.jsx";
import { DEFAULT_LOOK, addLook, inSet, isWearing, lookName, pushHistory, removeLook, surprise, takeOff, tidyLook, wear, wearSet } from "./logic.js";
import "../_kit/kit.css";
import "./paper-doll.css";

// The paper doll: a chibi doll, a big wardrobe in drawers, themed sets, her look (hair, eyes, face)
// and the scene behind her. Tap or drag a piece onto her, drag one off to take it off, undo and redo
// any change, and save the look to her lookbook, her gallery, or Josh's chat.

const START = { look: DEFAULT_LOOK, backdrop: "room", looks: [], tried: [] };
const TABS = [{ id: "sets", name: "sets", Icon: Sparkle }, { id: "hair", name: "hair" }, ...DRAWERS, { id: "her", name: "her face" }, { id: "scene", name: "scene" }];
const LOOK_RULES = {
  itemById,
  hairById,
  hairColours: HAIR_COLOURS.length,
  skins: SKINS.length,
  eyeColours: EYE_COLOURS.length,
  eyeStyles: EYE_STYLES.map((each) => each.id),
  mouths: MOUTHS.map((each) => each.id),
};

export default function PaperDoll({ onReward }) {
  const [saved, setSaved] = useSavedState("paper-doll", START);
  const look = useMemo(() => tidyLook(saved.look, LOOK_RULES), [saved.look]);
  const backdrop = BACKDROPS.some((each) => each.id === saved.backdrop) ? saved.backdrop : "room";
  const looks = saved.looks ?? [];
  const [tab, setTab] = useState("sets");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [book, setBook] = useState(false);
  const [keeping, setKeeping] = useState(null); // the look being kept: { look, backdrop, name }
  const [toast, showToast] = useToast();
  const [bounce, setBounce] = useState(0);
  const [ghost, setGhost] = useState(null);
  const rootRef = useRef(null), stageRef = useRef(null), trayRef = useRef(null), dollRef = useRef(null), confettiRef = useRef(null);
  const calm = useCalm();

  /** Every change to her look goes through here, so undo can step back through it. */
  function change(next, { pop = true } = {}) {
    const after = typeof next === "function" ? next(look) : next;
    if (!after || after === look) return;
    setPast((list) => pushHistory(list, look));
    setFuture([]);
    setSaved((old) => ({ ...START, ...old, look: after }));
    if (pop) setBounce((n) => n + 1);
  }
  function undo() {
    if (!past.length) return;
    const previous = past.at(-1);
    setPast((list) => list.slice(0, -1));
    setFuture((list) => [...list, look]);
    setSaved((old) => ({ ...START, ...old, look: previous }));
    setBounce((n) => n + 1);
    haptic("light");
  }
  function redo() {
    if (!future.length) return;
    const next = future.at(-1);
    setFuture((list) => list.slice(0, -1));
    setPast((list) => pushHistory(list, look));
    setSaved((old) => ({ ...START, ...old, look: next }));
    setBounce((n) => n + 1);
    haptic("light");
  }

  // The chosen tab scrolls into view (tapping a piece on her can pick a tab that's off screen).
  useEffect(() => {
    const strip = trayRef.current?.querySelector(".artsy-tabs");
    const chosen = strip?.querySelector('[aria-selected="true"]');
    if (!strip || !chosen) return;
    const left = chosen.offsetLeft - strip.offsetLeft, right = left + chosen.offsetWidth;
    if (left < strip.scrollLeft + 12 || right > strip.scrollLeft + strip.clientWidth - 12)
      strip.scrollTo({ left: Math.max(0, left - (strip.clientWidth - chosen.offsetWidth) / 2), behavior: calm ? "auto" : "smooth" });
  }, [tab, calm]);

  const drawer = DRAWERS.some((each) => each.id === tab) ? tab : null;
  const worn = drawer ? look.outfit?.[drawer] : null;
  const wornItem = worn && itemById(worn.id);

  function putOn(item, c = 0) {
    change((old) => wear(old, item, old.outfit?.[item.slot]?.id === item.id ? old.outfit[item.slot].c : c));
    haptic("light");
  }
  function toggle(item) {
    if (isWearing(look, item)) {
      change((old) => takeOff(old, item.slot));
      haptic("light");
    } else putOn(item);
  }
  function chooseSet(set) {
    change((old) => wearSet(old, set));
    const tried = [...new Set([...(saved.tried ?? []), set.id])];
    setSaved((old) => ({ ...START, ...old, backdrop: set.backdrop, tried }));
    haptic("medium");
    if (SETS.every((each) => tried.includes(each.id)) && rewardOnce(onReward, "paper-doll", "sets")) showToast("every outfit tried on · what a wardrobe ♡");
  }
  function saveLook() {
    const name = lookName(look, itemById, SETS);
    setSaved((old) => ({ ...START, ...old, looks: addLook(old.looks ?? [], look, backdrop, newId("look")) }));
    haptic("success");
    if (!calm) burst(confettiRef.current, { y: 0.4, power: 0.8 });
    rewardOnce(onReward, "paper-doll", "first");
    setKeeping({ look, backdrop, name });
  }

  // ---------- dragging clothes on and off ----------
  const local = (x, y) => {
    const rect = rootRef.current.getBoundingClientRect();
    return [x - rect.left, y - rect.top];
  };
  const overDoll = (x, y) => {
    const rect = stageRef.current.getBoundingClientRect();
    const inside = x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
    return inside && Math.abs(x - (rect.left + rect.width / 2)) < Math.min(rect.width, rect.height * 0.75) * 0.36;
  };
  useGesture(
    {
      onDrag: ({ first, last, tap, xy: [x, y], movement: [mx, my], event, cancel, memo }) => {
        if (tap) return;
        if (first) {
          const tile = event.target.closest?.("[data-wear]");
          if (!tile || Math.abs(mx) > Math.abs(my)) return cancel();
          const item = itemById(tile.dataset.wear);
          if (!item) return cancel();
          memo = { item, c: Number(tile.dataset.c ?? 0) };
        }
        if (!memo) return;
        const [lx, ly] = local(x, y);
        setGhost({ ...memo, x: lx, y: ly, over: overDoll(x, y), from: "tray" });
        if (last) {
          if (overDoll(x, y)) putOn(memo.item, memo.c);
          setGhost(null);
        }
        return memo;
      },
    },
    { target: trayRef, eventOptions: { passive: false }, drag: { filterTaps: true, threshold: 8, pointer: { capture: false } } },
  );
  useGesture(
    {
      onDrag: ({ first, last, tap, xy: [x, y], event, cancel, memo }) => {
        if (tap) {
          const slot = event.target.closest?.("[data-slot]")?.dataset.slot;
          if (slot) setTab(slot);
          else if (event.target.closest?.("[data-hair]")) setTab("hair");
          return;
        }
        if (first) {
          const slot = event.target.closest?.("[data-slot]")?.dataset.slot;
          const wornNow = slot && look.outfit?.[slot];
          if (!wornNow) return cancel();
          memo = { item: itemById(wornNow.id), c: wornNow.c, slot };
        }
        if (!memo) return;
        const [lx, ly] = local(x, y);
        const off = !overDoll(x, y);
        setGhost({ ...memo, x: lx, y: ly, over: !off, from: "doll" });
        if (last) {
          if (off) {
            change((old) => takeOff(old, memo.slot));
            haptic("light");
          }
          setGhost(null);
        }
        return memo;
      },
    },
    { target: stageRef, eventOptions: { passive: false }, drag: { filterTaps: true, threshold: 6 } },
  );
  const dressing = ghost?.from === "doll" ? { ...look, outfit: Object.fromEntries(Object.entries(look.outfit ?? {}).filter(([slot]) => slot !== ghost.slot)) } : look;
  const setOn = SETS.find((set) => inSet(look, set));

  return (
    <div className="artsy pd" ref={rootRef}>
      <div className="artsy-bar pd-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="undo" disabled={!past.length} onClick={undo}>
          <UndoIcon />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="redo" disabled={!future.length} onClick={redo}>
          <UndoIcon flip />
        </button>
        <button type="button" className="artsy-chip artsy-chip--icon pd-book-button" aria-label={`your lookbook, ${looks.length} looks`} onClick={() => setBook(true)}>
          <BookIcon />
          {looks.length > 0 && <span className="pd-count">{looks.length}</span>}
        </button>
        <div className="artsy-bar__grow" />
        <button
          type="button"
          className="artsy-chip"
          onClick={() => {
            change((old) => surprise(old, ITEMS, HAIR, HAIR_COLOURS.length));
            haptic("medium");
          }}
        >
          <DiceIcon />
          surprise
        </button>
        <button type="button" className="artsy-chip artsy-chip--primary" onClick={saveLook}>
          <HeartIcon />
          save
        </button>
      </div>

      <div className="pd-stage" ref={stageRef} data-target={ghost ? (ghost.from === "tray" ? (ghost.over ? "yes" : "near") : ghost.over ? "near" : "off") : undefined}>
        <div className="pd-doll" key={calm ? "doll" : bounce}>
          <Doll look={dressing} backdrop={backdrop} svgRef={dollRef} className="pd-doll__svg" label={`your paper doll: ${lookName(look, itemById, SETS)}`} />
        </div>
        {setOn && (
          <span className="pd-set-badge artsy-hand">
            <Sparkle />
            {setOn.name}
          </span>
        )}
      </div>

      <div className="artsy-tray pd-tray" ref={trayRef}>
        <div className="artsy-tabs" role="tablist" aria-label="wardrobe">
          {TABS.map((each) => (
            <button key={each.id} type="button" role="tab" className="artsy-tab" aria-selected={tab === each.id} onClick={() => setTab(each.id)}>
              {each.Icon && <each.Icon />}
              {each.name}
              {DRAWERS.some((d) => d.id === each.id) && look.outfit?.[each.id] ? <i className="pd-dot" aria-label=" (wearing)" /> : null}
            </button>
          ))}
        </div>

        {tab === "sets" ? (
          <div className="artsy-scroller pd-shelf" role="tabpanel" aria-label="themed sets">
            {SETS.map((set) => (
              <SetCard key={set.id} set={set} base={look} on={setOn?.id === set.id} tried={(saved.tried ?? []).includes(set.id)} onWear={chooseSet} />
            ))}
          </div>
        ) : tab === "hair" ? (
          <div role="tabpanel">
            <Swatches label="hair colour" colours={HAIR_COLOURS} value={look.hair?.c ?? 0} onPick={(c) => change((old) => ({ ...old, hair: { ...old.hair, c } }), { pop: false })} />
            <div className="artsy-scroller pd-shelf" aria-label="hairstyles">
              {HAIR.map((hair) => (
                <button key={hair.id} type="button" className="pd-tile" aria-pressed={look.hair?.id === hair.id} aria-label={hair.name} onClick={() => { change((old) => ({ ...old, hair: { id: hair.id, c: old.hair?.c ?? 0 } })); haptic("light"); }}>
                  <HairThumb hair={hair} c={look.hair?.c ?? 0} skin={look.skin} eyes={look.eyes} />
                  <span>{hair.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : tab === "her" ? (
          <div className="pd-her" role="tabpanel">
            <Swatches label="skin" colours={SKINS} value={look.skin ?? 0} onPick={(skin) => change((old) => ({ ...old, skin }), { pop: false })} />
            <Swatches label="eye colour" colours={EYE_COLOURS} value={look.eyes ?? 0} onPick={(eyes) => change((old) => ({ ...old, eyes }), { pop: false })} />
            <div className="artsy-scroller" aria-label="eyes and mouth">
              {EYE_STYLES.map((each) => (
                <button key={each.id} type="button" className="artsy-chip" aria-pressed={look.eyeStyle === each.id} onClick={() => change((old) => ({ ...old, eyeStyle: each.id }), { pop: false })}>
                  {each.name} eyes
                </button>
              ))}
              {MOUTHS.map((each) => (
                <button key={each.id} type="button" className="artsy-chip" aria-pressed={look.mouth === each.id} onClick={() => change((old) => ({ ...old, mouth: each.id }), { pop: false })}>
                  {each.name}
                </button>
              ))}
            </div>
          </div>
        ) : tab === "scene" ? (
          <div className="artsy-scroller pd-shelf" role="tabpanel" aria-label="scenes">
            {BACKDROPS.map((each) => (
              <button key={each.id} type="button" className="pd-tile pd-tile--scene" aria-pressed={backdrop === each.id} onClick={() => { setSaved((old) => ({ ...START, ...old, backdrop: each.id })); haptic("light"); }}>
                <SceneThumb id={each.id} />
                <span>{each.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div role="tabpanel">
            {wornItem ? (
              <Swatches label={`${wornItem.name} colour`} colours={wornItem.colors.map(([c, a]) => (wornItem.pattern ? `linear-gradient(135deg, ${c} 50%, ${a} 50%)` : c))} value={worn.c} onPick={(c) => change((old) => wear(old, wornItem, c), { pop: false })} />
            ) : (
              <p className="pd-hint artsy-hand">tap or drag one onto her ♡</p>
            )}
            <div className="artsy-scroller pd-shelf">
              {worn && (
                <button type="button" className="pd-tile pd-tile--off" onClick={() => { change((old) => takeOff(old, drawer)); haptic("light"); }}>
                  <span className="pd-off" aria-hidden="true">×</span>
                  <span>take off</span>
                </button>
              )}
              {ITEMS.filter((item) => item.slot === drawer).map((item) => {
                const on = isWearing(look, item);
                const c = on ? look.outfit[item.slot].c : 0;
                return (
                  <button key={item.id} type="button" className="pd-tile" data-wear={item.id} data-c={c} aria-pressed={on} aria-label={`${item.name}${on ? ", wearing (tap to take off)" : ""}`} onClick={() => toggle(item)}>
                    <ItemThumb item={item} c={c} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {ghost && (
        <div className="pd-ghost" data-over={ghost.over} style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }} aria-hidden="true">
          <ItemThumb item={ghost.item} c={ghost.c} />
        </div>
      )}
      <Lookbook
        open={book}
        looks={looks}
        onClose={() => setBook(false)}
        onWear={(entry) => {
          change(tidyLook(entry.look, LOOK_RULES));
          setSaved((old) => ({ ...START, ...old, backdrop: entry.backdrop ?? old.backdrop }));
          setBook(false);
          haptic("light");
        }}
        onKeep={(entry) => {
          setBook(false);
          setKeeping({ look: tidyLook(entry.look, LOOK_RULES), backdrop: entry.backdrop, name: lookName(tidyLook(entry.look, LOOK_RULES), itemById, SETS), fromBook: true });
        }}
        onRemove={(id) => setSaved((old) => ({ ...START, ...old, looks: removeLook(old.looks ?? [], id) }))}
      />
      <KeepSheet keeping={keeping} onClose={() => setKeeping(null)} />
      <canvas ref={confettiRef} className="pd-confetti" aria-hidden="true" />
      <Toast text={toast} />
    </div>
  );
}

// ---------------------------------------------------------------- tray pieces
function Swatches({ label, colours, value, onPick }) {
  return (
    <div className="artsy-scroller pd-swatches" role="radiogroup" aria-label={label}>
      {colours.map((colour, i) => (
        <button key={`${colour}${i}`} type="button" role="radio" aria-checked={value === i} aria-pressed={value === i} aria-label={`${label} ${i + 1}`} className="artsy-swatch" style={{ "--swatch": colour }} onClick={() => onPick(i)} />
      ))}
    </div>
  );
}

// A thumbnail frames its item: drawn once in doll space, then the view is fitted to the drawing's
// own bounds (remembered per item, so the tray scrolls smoothly afterwards).
const boxes = new Map();
const ItemThumb = memo(function ItemThumb({ item, c }) {
  const group = useRef(null);
  const [box, setBox] = useState(() => boxes.get(item.id) ?? null);
  useLayoutEffect(() => {
    if (boxes.has(item.id) || !group.current) return;
    try {
      const b = group.current.getBBox();
      if (!b.width || !b.height) return;
      const side = Math.max(b.width, b.height) * 1.12 + 6;
      const next = [b.x + b.width / 2 - side / 2, b.y + b.height / 2 - side / 2, side, side];
      boxes.set(item.id, next);
      setBox(next);
    } catch {
      // not laid out yet (a hidden tray): the whole doll space shows instead
    }
  }, [item.id]);
  const [main, accent] = item.colors[c] ?? item.colors[0];
  const Draw = item.draw, Sleeves = item.sleeves;
  return (
    <svg viewBox={box ? box.map((v) => v.toFixed(1)).join(" ") : "0 0 240 400"} aria-hidden="true">
      <g ref={group}>
        <Draw c={main} a={accent} />
        {Sleeves && <Sleeves c={main} a={accent} />}
      </g>
    </svg>
  );
});

const HairThumb = memo(function HairThumb({ hair, c, skin = 0, eyes = 0 }) {
  const colour = HAIR_COLOURS[c] ?? HAIR_COLOURS[0];
  return (
    <svg viewBox="30 0 180 180" aria-hidden="true">
      {hair.back(colour, tieFor(colour))}
      <DollHead skin={SKINS[skin] ?? SKINS[0]} eyes={EYE_COLOURS[eyes] ?? EYE_COLOURS[0]} brow={browOf(colour)} />
      {hair.front(colour, tieFor(colour))}
    </svg>
  );
});

const SceneThumb = memo(function SceneThumb({ id }) {
  return (
    <svg viewBox="-30 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Backdrop id={id} />
    </svg>
  );
});

const SetCard = memo(function SetCard({ set, base, on, tried, onWear }) {
  const look = useMemo(() => wearSet(base, set), [base.skin, base.eyes, set]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" className="pd-set" aria-pressed={on} onClick={() => onWear(set)} aria-label={`wear the ${set.name} set${tried ? "" : ", new"}`}>
      <Doll look={look} backdrop={set.backdrop} className="pd-set__doll" label="" viewBox="20 20 200 220" />
      <span>{set.name}</span>
      {!tried && <i className="pd-set__new">new</i>}
    </button>
  );
});

// ---------------------------------------------------------------- sheets
function Lookbook({ open, looks, onClose, onWear, onKeep, onRemove }) {
  const [confirm, setConfirm] = useState(null);
  return (
    <Sheet open={open} title="your lookbook" onClose={onClose}>
      {looks.length === 0 ? (
        <p className="pd-empty artsy-hand">save a look and it lives here, like a little closet diary ♡</p>
      ) : (
        <div className="pd-looks">
          {looks.map((entry) => {
            const name = lookName(tidyLook(entry.look, LOOK_RULES), itemById, SETS);
            return (
              <div key={entry.id} className="pd-look">
                <button type="button" className="pd-look__wear" onClick={() => onWear(entry)} aria-label={`wear ${name}`}>
                  <Doll look={tidyLook(entry.look, LOOK_RULES)} backdrop={entry.backdrop} label={name} />
                  <span>{name}</span>
                </button>
                <div className="pd-look__actions">
                  <button type="button" aria-label={`keep ${name} in your gallery`} onClick={() => onKeep(entry)}>
                    <HeartIcon />
                  </button>
                  <button type="button" aria-label={confirm === entry.id ? "sure? remove it" : "remove this look"} onClick={() => (confirm === entry.id ? (onRemove(entry.id), setConfirm(null)) : setConfirm(entry.id))}>
                    {confirm === entry.id ? "sure?" : "×"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/** "Saved to your lookbook ♡", and the look as a picture for her gallery or Josh's chat. */
function KeepSheet({ keeping, onClose }) {
  const { partner, toChat, toDoodles } = useArtShare();
  const openGallery = useOpenGallery();
  const svgRef = useRef(null);
  const canvas = useRef(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!keeping) return undefined;
    toChat.reset();
    toDoodles.reset();
    let url = null, gone = false;
    const timer = setTimeout(async () => {
      try {
        const made = document.createElement("canvas");
        made.width = 900;
        made.height = 1200;
        await drawSvg(made.getContext("2d"), svgRef.current, 0, 0, 900, 1200);
        if (gone) return;
        canvas.current = made;
        made.toBlob((blob) => {
          if (!blob || gone) return;
          url = URL.createObjectURL(blob);
          setPreview(url);
        }, "image/png");
      } catch {
        // the preview stays a drawing; keeping still works once it's made
      }
    }, 60);
    return () => {
      gone = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [keeping]); // eslint-disable-line react-hooks/exhaustive-deps
  const file = () => canvasFile(canvas.current, "paper-doll");
  const kept = toDoodles.data ?? null;
  const error = toChat.error || toDoodles.error;
  const sendLabel = toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner}`;
  return (
    <Sheet open={Boolean(keeping)} title={kept ? "in your gallery ♡" : keeping?.fromBook ? "a look from your lookbook" : "saved to your lookbook ♡"} onClose={onClose}>
      {keeping && (
        <div className="pd-keep">
          <div className="pd-keep__card">
            <div className="pd-keep__picture">{preview ? <img src={preview} alt={keeping.name} /> : <Doll look={keeping.look} backdrop={keeping.backdrop} svgRef={svgRef} label={keeping.name} />}</div>
            <p className="pd-keep__name artsy-hand">{keeping.name}</p>
          </div>
          {kept ? (
            <div className="pd-keep__buttons">
              <button type="button" className="artsy-primary" onClick={() => openGallery(kept.id)}>
                see it in my gallery
              </button>
              <button type="button" className="artsy-secondary" onClick={onClose}>
                keep dressing up
              </button>
            </div>
          ) : (
            <div className="pd-keep__buttons">
              <button type="button" className="artsy-primary" disabled={!preview || toDoodles.isPending} onClick={() => toDoodles.mutate({ make: file, title: `paper doll · ${keeping.name}` })}>
                {toDoodles.isPending ? "keeping…" : "keep in my gallery ♡"}
              </button>
              <button type="button" className="artsy-secondary" disabled={!preview || toChat.isPending || toChat.isSuccess} onClick={() => toChat.mutate({ make: file, alt: `a paper doll look: ${keeping.name}` })}>
                {sendLabel}
              </button>
            </div>
          )}
          {kept && (
            <button type="button" className="artsy-chip pd-keep__also" disabled={toChat.isPending || toChat.isSuccess} onClick={() => toChat.mutate({ make: file, alt: `a paper doll look: ${keeping.name}` })}>
              {toChat.isSuccess ? sendLabel : `also ${sendLabel} ♡`}
            </button>
          )}
          {error && (
            <p className="artsy-error" role="alert">
              {error.message || "That didn’t go through. Try again?"}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- icons
/** A four-point sparkle (themed sets). Drawn, because iOS has no glyph for ✦ in these fonts. */
function Sparkle() {
  return (
    <svg className="pd-sparkle" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1.5c.5 3.2 1.3 4 4.5 4.5-3.2.5-4 1.3-4.5 4.5-.5-3.2-1.3-4-4.5-4.5 3.2-.5 4-1.3 4.5-4.5Zm4.6 7.8c.2 1.3.6 1.7 1.9 1.9-1.3.2-1.7.6-1.9 1.9-.2-1.3-.6-1.7-1.9-1.9 1.3-.2 1.7-.6 1.9-1.9Z" fill="currentColor" />
    </svg>
  );
}
const line = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const UndoIcon = ({ flip }) => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2.2" style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
    <path d="M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3" />
  </svg>
);
const BookIcon = () => (
  <svg viewBox="0 0 24 24" {...line} aria-hidden="true">
    <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Z" />
    <path d="M5 16.5a3 3 0 0 1 3-3h11M12 7.5c-1.4-1.6-4-.6-3 1.4.6 1.2 3 2.6 3 2.6s2.4-1.4 3-2.6c1-2-1.6-3-3-1.4Z" />
  </svg>
);
const DiceIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Zm6 10 .9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9Z" fill="currentColor" />
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20.2C8.1 17.4 3.6 14 3.6 9.6 3.6 7 5.6 5 8 5c1.7 0 3.1.9 4 2.3C12.9 5.9 14.3 5 16 5c2.4 0 4.4 2 4.4 4.6 0 4.4-4.5 7.8-8.4 10.6Z" fill="currentColor" />
  </svg>
);
