import { useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { haptic } from "../../../../../lib/native.js";
import { useCalm, useSavedState, useToast } from "../_kit/hooks.js";
import { rewardOnce } from "../_kit/rewards.js";
import { newId } from "../_kit/store.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import Doll from "./Doll.jsx";
import { BACKDROPS, DollHead, EYES, HAIR, HAIR_COLOURS, ITEMS, SKINS, itemById } from "./wardrobe.jsx";
import { DEFAULT_LOOK, addLook, isWearing, lookName, removeLook, surprise, takeOff, wear } from "./logic.js";
import "../_kit/kit.css";
import "./paper-doll.css";

const START = { look: DEFAULT_LOOK, backdrop: "room", looks: [] };
const TABS = [
  { id: "hair", name: "hair" },
  { id: "top", name: "tops" },
  { id: "bottom", name: "skirts" },
  { id: "dress", name: "dresses" },
  { id: "shoes", name: "shoes" },
  { id: "socks", name: "socks" },
  { id: "head", name: "hats & bows" },
  { id: "neck", name: "necklaces" },
  { id: "hand", name: "to hold" },
  { id: "back", name: "wings" },
  { id: "doll", name: "her" },
];

export default function PaperDoll({ onReward }) {
  const [saved, setSaved] = useSavedState("paper-doll", START);
  const look = saved.look ?? DEFAULT_LOOK;
  const backdrop = saved.backdrop ?? "room";
  const looks = saved.looks ?? [];
  const setLook = (next) => setSaved((old) => ({ ...START, ...old, look: typeof next === "function" ? next(old.look ?? DEFAULT_LOOK) : next }));
  const [tab, setTab] = useState("top");
  const [book, setBook] = useState(false);
  const [toast, showToast] = useToast();
  const [bounce, setBounce] = useState(0);
  const [ghost, setGhost] = useState(null); // { item, c, x, y, from: "tray" | "doll" }
  const rootRef = useRef(null), stageRef = useRef(null), trayRef = useRef(null);
  const calm = useCalm();

  const slotOfTab = tab === "hair" || tab === "doll" ? null : tab;
  const worn = slotOfTab ? look.outfit?.[slotOfTab] : null;
  const wornItem = worn && itemById(worn.id);

  function putOn(item, c = 0) {
    setLook((old) => wear(old, item, old.outfit?.[item.slot]?.id === item.id ? old.outfit[item.slot].c : c));
    setBounce((n) => n + 1);
    haptic("light");
  }
  function toggle(item) {
    if (isWearing(look, item)) {
      setLook((old) => takeOff(old, item.slot));
      haptic("light");
    } else putOn(item);
  }
  function saveLook() {
    setSaved((old) => ({ ...START, ...old, looks: addLook(old.looks ?? [], old.look ?? DEFAULT_LOOK, old.backdrop ?? "room", newId("look")) }));
    showToast("saved to your lookbook ♡");
    haptic("success");
    rewardOnce(onReward, "paper-doll", "first");
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
            setLook((old) => takeOff(old, memo.slot));
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

  return (
    <div className="artsy pd" ref={rootRef}>
      <div className="artsy-bar">
        <button type="button" className="artsy-chip" onClick={() => setBook(true)}>
          lookbook{looks.length ? <small> {looks.length}</small> : null}
        </button>
        <div className="artsy-bar__grow" />
        <button type="button" className="artsy-chip" onClick={() => { setLook((old) => surprise(old, ITEMS, HAIR, HAIR_COLOURS.length)); setBounce((n) => n + 1); haptic("medium"); }}>
          surprise ✧
        </button>
        <button type="button" className="artsy-chip artsy-chip--primary" onClick={saveLook}>
          save ♡
        </button>
      </div>
      <div className="pd-stage" ref={stageRef} data-target={ghost ? (ghost.from === "tray" ? (ghost.over ? "yes" : "near") : ghost.over ? "near" : "off") : undefined}>
        <div className="pd-doll" key={calm ? "doll" : bounce}>
          <Doll look={dressing} backdrop={backdrop} className="pd-doll__svg" />
        </div>
      </div>
      <div className="artsy-tray pd-tray" ref={trayRef}>
        <div className="artsy-tabs" role="tablist" aria-label="wardrobe">
          {TABS.map((each) => (
            <button key={each.id} type="button" role="tab" className="artsy-tab" aria-selected={tab === each.id} onClick={() => setTab(each.id)}>
              {each.name}
              {each.id !== "hair" && each.id !== "doll" && look.outfit?.[each.id] ? <i className="pd-dot" aria-label=" (wearing)" /> : null}
            </button>
          ))}
        </div>
        {tab === "hair" ? (
          <>
            <Swatches label="hair colour" colours={HAIR_COLOURS} value={look.hair?.c ?? 0} onPick={(c) => setLook((old) => ({ ...old, hair: { ...old.hair, c } }))} />
            <div className="artsy-scroller pd-shelf" role="tabpanel">
              {HAIR.map((hair) => (
                <button key={hair.id} type="button" className="pd-tile" aria-pressed={look.hair?.id === hair.id} aria-label={hair.name} onClick={() => { setLook((old) => ({ ...old, hair: { id: hair.id, c: old.hair?.c ?? 0 } })); setBounce((n) => n + 1); haptic("light"); }}>
                  <HairThumb hair={hair} c={look.hair?.c ?? 0} skin={SKINS[look.skin] ?? SKINS[0]} eyes={EYES[look.eyes] ?? EYES[0]} />
                </button>
              ))}
            </div>
          </>
        ) : tab === "doll" ? (
          <div className="pd-her">
            <Swatches label="skin" colours={SKINS} value={look.skin ?? 0} onPick={(skin) => setLook((old) => ({ ...old, skin }))} />
            <Swatches label="eyes" colours={EYES} value={look.eyes ?? 0} onPick={(eyes) => setLook((old) => ({ ...old, eyes }))} />
            <div className="artsy-scroller">
              {BACKDROPS.map((each) => (
                <button key={each.id} type="button" className="artsy-chip" aria-pressed={backdrop === each.id} onClick={() => setSaved((old) => ({ ...START, ...old, backdrop: each.id }))}>
                  {each.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {wornItem ? (
              <Swatches label={`${wornItem.name} colour`} colours={wornItem.colors.map(([c]) => c)} value={worn.c} onPick={(c) => setLook((old) => wear(old, wornItem, c))} />
            ) : (
              <p className="pd-hint">tap or drag one onto her ♡</p>
            )}
            <div className="artsy-scroller pd-shelf" role="tabpanel">
              {ITEMS.filter((item) => item.slot === slotOfTab).map((item) => {
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
          </>
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
          setSaved((old) => ({ ...START, ...old, look: entry.look, backdrop: entry.backdrop ?? old.backdrop }));
          setBook(false);
          setBounce((n) => n + 1);
          haptic("light");
        }}
        onRemove={(id) => setSaved((old) => ({ ...START, ...old, looks: removeLook(old.looks ?? [], id) }))}
      />
      <Toast text={toast} />
    </div>
  );
}

function Swatches({ label, colours, value, onPick }) {
  return (
    <div className="artsy-scroller pd-swatches" role="radiogroup" aria-label={label}>
      {colours.map((colour, i) => (
        <button key={`${colour}${i}`} type="button" role="radio" aria-checked={value === i} aria-pressed={value === i} aria-label={`${label} ${i + 1}`} className="artsy-swatch" style={{ "--swatch": colour }} onClick={() => onPick(i)} />
      ))}
    </div>
  );
}

function ItemThumb({ item, c }) {
  const [main, accent] = item.colors[c] ?? item.colors[0];
  const [x, y, w, h] = item.thumb;
  const pad = Math.max(w, h) * 0.08;
  const side = Math.max(w, h) + pad * 2;
  return (
    <svg viewBox={`${x + w / 2 - side / 2} ${y + h / 2 - side / 2} ${side} ${side}`} aria-hidden="true">
      <item.draw c={main} a={accent} />
    </svg>
  );
}

function HairThumb({ hair, c, skin, eyes }) {
  const colour = HAIR_COLOURS[c] ?? HAIR_COLOURS[0];
  return (
    <svg viewBox="40 14 160 160" aria-hidden="true">
      {hair.back(colour, "#f6a9c7")}
      <DollHead skin={skin} eyes={eyes} />
      {hair.front(colour, "#f6a9c7")}
    </svg>
  );
}

function Lookbook({ open, looks, onClose, onWear, onRemove }) {
  const [confirm, setConfirm] = useState(null);
  return (
    <Sheet open={open} title="your lookbook" onClose={onClose}>
      {looks.length === 0 ? (
        <p className="pd-empty artsy-hand">save a look and it lives here, like a little closet diary ✿</p>
      ) : (
        <div className="pd-looks">
          {looks.map((entry) => (
            <div key={entry.id} className="pd-look">
              <button type="button" className="pd-look__wear" onClick={() => onWear(entry)} aria-label={`wear ${lookName(entry.look, itemById)}`}>
                <Doll look={entry.look} backdrop={entry.backdrop} label={lookName(entry.look, itemById)} />
                <span>{lookName(entry.look, itemById)}</span>
              </button>
              <button type="button" className="pd-look__remove" aria-label={confirm === entry.id ? "sure? remove it" : "remove this look"} onClick={() => (confirm === entry.id ? (onRemove(entry.id), setConfirm(null)) : setConfirm(entry.id))}>
                {confirm === entry.id ? "sure?" : "×"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
