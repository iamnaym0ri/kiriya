import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { haptic } from "../../../../../lib/native.js";
import { useCalm, useElementSize, useSavedState, useToast } from "../_kit/hooks.js";
import { rewardOnce } from "../_kit/rewards.js";
import { canvasFile, useArtShare } from "../_kit/share.js";
import { burst } from "../_kit/confetti.js";
import { Sheet, Toast } from "../_kit/Sheet.jsx";
import { PICTURES, pictureById } from "./pictures.js";
import PictureArt, { paintPicture, regionSpots } from "./PictureArt.jsx";
import { MAX_ZOOM, canFill, decodeIds, hintRegion, labelSpots, nextColour, progress, toPicture, viewBox, zoomAround } from "./logic.js";
import "../_kit/kit.css";
import "./colour-by-number.css";
import { useIsAdmin } from "../../../../../lib/session.js";

const EMPTY = { current: null, fills: {}, finished: {} };

export default function ColourByNumber({ onReward }) {
  const [saved, setSaved] = useSavedState("colour-by-number", EMPTY);
  const [openId, setOpenId] = useState(null);
  const picture = openId ? pictureById(openId) : null;
  const fills = (id) => saved.fills?.[id] ?? [];

  function paint(id, regions) {
    setSaved((old) => ({ ...old, current: id, fills: { ...old.fills, [id]: [...new Set([...(old.fills?.[id] ?? []), ...regions])] } }));
  }
  function finish(id) {
    const at = new Date().toISOString();
    let firstEver = false;
    setSaved((old) => {
      firstEver = !Object.keys(old.finished ?? {}).length;
      return { ...old, current: null, finished: { ...old.finished, [id]: [...(old.finished?.[id] ?? []), at] } };
    });
    return firstEver;
  }
  function again(id) {
    setSaved((old) => ({ ...old, current: id, fills: { ...old.fills, [id]: [] } }));
    setOpenId(id);
  }

  return (
    <div className="artsy cbn">
      {picture ? (
        <Easel
          key={picture.id}
          picture={picture}
          filled={fills(picture.id)}
          finishedBefore={Boolean(saved.finished?.[picture.id]?.length)}
          onPaint={(regions) => paint(picture.id, regions)}
          onFinish={() => {
            finish(picture.id);
            rewardOnce(onReward, "colour-by-number", "first");
            const finishedIds = new Set([...Object.keys(saved.finished ?? {}), picture.id]);
            if (PICTURES.every((each) => finishedIds.has(each.id))) rewardOnce(onReward, "colour-by-number", "all");
          }}
          onAgain={() => again(picture.id)}
          onClose={() => setOpenId(null)}
        />
      ) : (
        <Picker saved={saved} onOpen={setOpenId} onAgain={again} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- choosing a picture

function Picker({ saved, onOpen, onAgain }) {
  const [tab, setTab] = useState("colour");
  const [viewing, setViewing] = useState(null);
  const finished = PICTURES.filter((picture) => saved.finished?.[picture.id]?.length);
  const list = tab === "colour" ? PICTURES : finished;
  return (
    <>
      <div className="artsy-bar cbn-picker__bar">
        <div className="artsy-tabs cbn-picker__tabs" role="tablist" aria-label="pictures">
          <button type="button" role="tab" className="artsy-tab" aria-selected={tab === "colour"} onClick={() => setTab("colour")}>
            to colour
          </button>
          <button type="button" role="tab" className="artsy-tab" aria-selected={tab === "finished"} onClick={() => setTab("finished")}>
            finished ♡ {finished.length ? <small>{finished.length}</small> : null}
          </button>
        </div>
      </div>
      <div className="cbn-picker" role="tabpanel">
        {tab === "colour" && <p className="cbn-picker__hello artsy-hand">pick a picture, then tap the numbers ♡</p>}
        {list.length === 0 ? (
          <p className="cbn-picker__empty artsy-hand">your finished pictures will hang here, like a little gallery ✿</p>
        ) : (
          <div className="artsy-grid">
            {list.map((picture) => {
              const filled = saved.fills?.[picture.id] ?? [];
              const state = progress(picture, filled);
              const times = saved.finished?.[picture.id]?.length ?? 0;
              const showAll = tab === "finished";
              return (
                <button key={picture.id} type="button" className="artsy-card" onClick={() => (showAll ? setViewing(picture) : onOpen(picture.id))}>
                  <span className="artsy-card__art">
                    <PictureArt picture={picture} filled={showAll ? picture.regions.map((_, i) => i) : filled} strokeWidth={1} uid={`card-${picture.id}`} label={picture.name} />
                  </span>
                  <span className="artsy-card__name">{picture.name}</span>
                  <span className="artsy-card__meta">
                    {showAll
                      ? finishedOn(saved.finished[picture.id].at(-1))
                      : state.complete
                        ? "finished ♡ tap to see it"
                        : state.done
                          ? `${state.done} of ${state.total} painted`
                          : `${state.total} little shapes · ${picture.blurb}`}
                  </span>
                  {!showAll && times > 0 && <span className="artsy-badge">♡{times > 1 ? ` ×${times}` : ""}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <FinishedSheet picture={viewing} saved={saved} onClose={() => setViewing(null)} onAgain={(id) => { setViewing(null); onAgain(id); }} />
    </>
  );
}

const finishedOn = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "finished ♡" : `finished ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ♡`;
};

function FinishedSheet({ picture, saved, onClose, onAgain }) {
  const { partner, toChat, toDoodles } = useArtShare();
  const [toast, showToast] = useToast();
  useEffect(() => {
    toChat.reset();
    toDoodles.reset();
  }, [picture?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!picture) return null;
  const make = () => canvasFile(paintPicture(picture), `colour-by-number-${picture.id}`);
  return (
    <Sheet open title={picture.name} onClose={onClose}>
      <div className="cbn-finished">
        <div className="cbn-finished__art">
          <PictureArt picture={picture} filled={picture.regions.map((_, i) => i)} strokeWidth={1.4} uid={`done-${picture.id}`} />
        </div>
        <p className="cbn-finished__when artsy-hand">{finishedOn(saved.finished?.[picture.id]?.at(-1))}</p>
        <ShareButtons
          partner={partner}
          toChat={toChat}
          toDoodles={toDoodles}
          onChat={() => toChat.mutate({ make, alt: `a coloured-in picture: ${picture.name}` }, { onSuccess: () => showToast(`sent to ${partner} ♡`) })}
          onKeep={() => toDoodles.mutate({ make, title: `colour by number: ${picture.name}` }, { onSuccess: () => showToast("tucked into your gallery ♡") })}
        />
        <button type="button" className="artsy-secondary cbn-finished__again" onClick={() => onAgain(picture.id)}>
          colour it again ↺
        </button>
      </div>
      <Toast text={toast} />
    </Sheet>
  );
}

function ShareButtons({ partner, toChat, toDoodles, onChat, onKeep }) {
  // On Josh's phone a keep is only a try: her gallery holds her pieces alone.
  const admin = useIsAdmin();
  const error = toChat.error || toDoodles.error;
  return (
    <>
      <div className="cbn-share">
        <button type="button" className="artsy-primary" disabled={toChat.isPending || toChat.isSuccess} onClick={onChat}>
          {toChat.isPending ? "sending…" : toChat.isSuccess ? `sent to ${partner} ♡` : `send to ${partner} ♡`}
        </button>
        <button type="button" className="artsy-secondary" disabled={toDoodles.isPending || toDoodles.isSuccess} onClick={onKeep}>
          {toDoodles.isPending ? "keeping…" : toDoodles.isSuccess ? (admin ? "a try ✓ (only hers go in her gallery)" : "in your gallery ✓") : admin ? "keep (a try)" : "keep in my gallery"}
        </button>
      </div>
      {error && <p className="artsy-error" role="alert">{error.message || "That didn’t go through. Try again?"}</p>}
    </>
  );
}

// ---------------------------------------------------------------- painting

function Easel({ picture, filled, finishedBefore, onPaint, onFinish, onAgain, onClose }) {
  const calm = useCalm();
  const [paintedBefore] = useState(finishedBefore);
  const stageRef = useRef(null), svgRef = useRef(null), confettiRef = useRef(null), paletteRef = useRef(null);
  const stage = useElementSize(stageRef);
  const done = useMemo(() => new Set(filled), [filled]);
  const state = progress(picture, done);
  const [selected, setSelected] = useState(() => Math.max(0, nextColour(picture, done)));
  const [spots, setSpots] = useState(null);
  const [blooms, setBlooms] = useState({});
  const [pulse, setPulse] = useState(-1);
  const [nudge, setNudge] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [celebrating, setCelebrating] = useState(false);
  const view = useRef({ z: 1, cx: picture.width / 2, cy: picture.height / 2 });
  const tween = useRef(0);
  const lastTap = useRef(null);
  const wasComplete = useRef(state.complete);

  // Where each number sits (once per picture). A shape too small to ever tap counts as painted.
  useEffect(() => {
    let live = true;
    regionSpots(picture, labelSpots, decodeIds).then((found) => {
      if (!live) return;
      setSpots(found);
      const hidden = found.map((spot, i) => (spot.area < 6 ? i : -1)).filter((i) => i >= 0 && !done.has(i));
      if (hidden.length) onPaint(hidden);
    });
    return () => {
      live = false;
    };
  }, [picture]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- the view ----------
  const apply = useCallback(
    (next) => {
      if (!stage.width) return;
      const box = viewBox(next, stage, picture);
      view.current = { z: box.z, cx: box.cx, cy: box.cy };
      svgRef.current?.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
      return box;
    },
    [stage, picture],
  );
  useEffect(() => {
    apply(view.current);
  }, [apply]);
  const settle = () => setZoom(view.current.z);
  const animateTo = (target) => {
    cancelAnimationFrame(tween.current);
    const from = { ...view.current };
    if (calm) {
      apply(target);
      settle();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 320);
      const e = 1 - (1 - t) ** 3;
      apply({ z: from.z + (target.z - from.z) * e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e });
      if (t < 1) tween.current = requestAnimationFrame(step);
      else settle();
    };
    tween.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(tween.current), []);
  const box = () => viewBox(view.current, stage, picture);
  const stagePoint = (clientX, clientY) => {
    const rect = stageRef.current.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  };

  // ---------- painting a shape ----------
  function tapAt(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY)?.closest?.("[data-i]");
    const i = target && stageRef.current.contains(target) ? Number(target.dataset.i) : -1;
    const [sx, sy] = stagePoint(clientX, clientY);
    const [px, py] = toPicture(box(), sx, sy);
    const now = performance.now();
    const previous = lastTap.current;
    lastTap.current = { at: now, sx, sy };
    if (i >= 0 && canFill(picture, done, i, selected)) {
      lastTap.current = null;
      fill(i, px, py);
      return;
    }
    // A second quick tap that didn't paint anything zooms in (or back out).
    if (previous && now - previous.at < 340 && Math.hypot(previous.sx - sx, previous.sy - sy) < 30) {
      lastTap.current = null;
      if (view.current.z < 2.2) animateTo(zoomTarget(3, px, py, sx, sy));
      else animateTo({ z: 1, cx: picture.width / 2, cy: picture.height / 2 });
      return;
    }
    if (i >= 0 && !done.has(i)) {
      // Wrong number: the right paint pot gives a little wiggle.
      const c = picture.regions[i].c;
      setNudge({ c, key: now });
      paletteRef.current?.querySelector(`[data-c="${c}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: calm ? "instant" : "smooth" });
      haptic("light");
    }
  }
  const zoomTarget = (z, px, py, sx, sy) => {
    const box = zoomAround(z, px, py, sx, sy, stage, picture);
    return { z: box.z, cx: box.cx, cy: box.cy };
  };

  function fill(i, px, py) {
    haptic("light");
    if (!calm) {
      const region = picture.regions[i];
      const r = spots?.[i] ? Math.sqrt(spots[i].area) * 1.6 + 40 : 260;
      setBlooms((old) => ({ ...old, [i]: { x: px, y: py, r, key: region.d.length } }));
      setTimeout(() => setBlooms((old) => {
        const next = { ...old };
        delete next[i];
        return next;
      }), 420);
    }
    onPaint([i]);
    const after = new Set(done).add(i);
    const now = progress(picture, after);
    if (now.complete) return;
    if (now.colours[selected].done === now.colours[selected].total) {
      haptic("success");
      const next = nextColour(picture, after, selected);
      setTimeout(() => setSelected(next), calm ? 0 : 380);
    }
  }

  // Finishing: confetti, the reward, and the share card.
  useEffect(() => {
    if (state.complete && !wasComplete.current) {
      wasComplete.current = true;
      onFinish();
      haptic("success");
      animateTo({ z: 1, cx: picture.width / 2, cy: picture.height / 2 });
      setTimeout(() => {
        setCelebrating(true);
        burst(confettiRef.current, { y: 0.45, power: 1.2 });
      }, calm ? 0 : 450);
    }
  }, [state.complete]); // eslint-disable-line react-hooks/exhaustive-deps

  function hint() {
    const i = hintRegion(picture, done, selected, spots);
    if (i < 0 || !spots) return;
    const spot = spots[i];
    // Close enough that its number reads at about 22 px, never further out than she already is.
    const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
    const size = Math.min(16, Math.max(3.4, spot.r * 0.95));
    const z = Math.min(6, Math.max(1.6, 22 / (size * fit)));
    animateTo({ z, cx: spot.x, cy: spot.y });
    setPulse(-1);
    requestAnimationFrame(() => setPulse(i));
    haptic("light");
  }
  useEffect(() => {
    if (pulse < 0) return;
    const timer = setTimeout(() => setPulse(-1), 1600);
    return () => clearTimeout(timer);
  }, [pulse]);

  // ---------- touch: one finger paints or pans, two fingers zoom ----------
  useGesture(
    {
      onDrag: ({ tap, pinching, cancel, delta: [dx, dy], xy: [x, y], first, last, event }) => {
        if (pinching) return cancel();
        if (first) cancelAnimationFrame(tween.current);
        if (tap) {
          if (event?.pointerType === "mouse" && event.button !== 0) return;
          tapAt(x, y);
          return;
        }
        const b = box();
        apply({ z: view.current.z, cx: view.current.cx - dx / b.scale, cy: view.current.cy - dy / b.scale });
        if (last) settle();
      },
      onPinch: ({ origin: [ox, oy], offset: [z], first, last, memo }) => {
        if (first) cancelAnimationFrame(tween.current);
        const [sx, sy] = stagePoint(ox, oy);
        const anchor = memo ?? toPicture(box(), sx, sy);
        const next = zoomAround(z, anchor[0], anchor[1], sx, sy, stage, picture);
        apply({ z: next.z, cx: next.cx, cy: next.cy });
        if (last) settle();
        return anchor;
      },
      onWheel: ({ event, delta: [, dy], ctrlKey }) => {
        if (!ctrlKey && Math.abs(dy) < 1) return;
        event.preventDefault();
        const [sx, sy] = stagePoint(event.clientX, event.clientY);
        const [px, py] = toPicture(box(), sx, sy);
        const next = zoomAround(view.current.z * Math.exp(-dy / 300), px, py, sx, sy, stage, picture);
        apply({ z: next.z, cx: next.cx, cy: next.cy });
        settle();
      },
    },
    {
      target: stageRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true, tapsThreshold: 8, pointer: { buttons: [1, 2, 4] } },
      pinch: { scaleBounds: { min: 1, max: MAX_ZOOM }, from: () => [view.current.z, 0], rubberband: false },
    },
  );

  const scale = (stage.width ? Math.min(stage.width / picture.width, stage.height / picture.height) : 1) * zoom;
  const colourDone = (c) => state.colours[c].done === state.colours[c].total;

  return (
    <>
      <div className="artsy-bar">
        <button type="button" className="artsy-chip artsy-chip--icon" aria-label="all pictures" onClick={onClose}>
          <GridIcon />
        </button>
        <div className="artsy-bar__grow">
          <div className="artsy-bar__label">{picture.name}</div>
          <div className="cbn-meter" aria-label={`${state.done} of ${state.total} painted`}>
            <span style={{ transform: `scaleX(${state.total ? state.done / state.total : 0})` }} />
          </div>
        </div>
        {zoom > 1.05 && (
          <button type="button" className="artsy-chip artsy-chip--icon" aria-label="see the whole picture" onClick={() => animateTo({ z: 1, cx: picture.width / 2, cy: picture.height / 2 })}>
            <FitIcon />
          </button>
        )}
        <button type="button" className="artsy-chip" disabled={state.complete || !spots} onClick={hint}>
          <SparkIcon /> find
        </button>
      </div>
      <div className="cbn-stage" ref={stageRef} data-complete={state.complete}>
        <PictureArt
          svgRef={svgRef}
          className="cbn-art"
          picture={picture}
          filled={done}
          selected={state.complete ? -1 : selected}
          spots={spots}
          labelScale={scale}
          blooms={blooms}
          pulse={pulse}
          soft={state.complete}
          uid={`cbn-${picture.id}`}
          viewBox={(() => {
            if (!stage.width) return undefined;
            const b = viewBox(view.current, stage, picture);
            return `${b.x} ${b.y} ${b.w} ${b.h}`;
          })()}
          label={`${picture.name}: ${state.done} of ${state.total} shapes painted`}
        />
        {!spots && <p className="cbn-stage__loading artsy-hand">setting out the paints…</p>}
        <canvas ref={confettiRef} className="cbn-confetti" aria-hidden="true" />
      </div>
      {celebrating || state.complete ? (
        <Finished picture={picture} again={paintedBefore} onAgain={onAgain} onClose={onClose} showing={celebrating} />
      ) : (
        <div className="artsy-tray cbn-tray">
          <div className="artsy-scroller cbn-palette" ref={paletteRef} role="radiogroup" aria-label="paint pots">
            {picture.palette.map((paint, c) => {
              const { done: n, total } = state.colours[c];
              return (
                <button
                  key={nudge?.c === c ? `${c}-${nudge.key}` : c}
                  type="button"
                  role="radio"
                  data-c={c}
                  aria-checked={selected === c}
                  aria-label={`${c + 1}, ${paint.name}${colourDone(c) ? ", all painted" : `, ${total - n} left`}`}
                  className="cbn-pot"
                  data-done={colourDone(c)}
                  data-nudge={nudge?.c === c ? "yes" : undefined}
                  onClick={() => {
                    setSelected(c);
                    haptic("light");
                  }}
                  style={{ "--paint": paint.hex }}
                >
                  <svg viewBox="0 0 56 56" aria-hidden="true">
                    <circle cx="28" cy="28" r="25" className="cbn-pot__track" />
                    {n > 0 && <circle cx="28" cy="28" r="25" className="cbn-pot__ring" pathLength="100" strokeDasharray={`${(n / total) * 100} 100`} />}
                  </svg>
                  <span className="cbn-pot__blob" style={{ color: readableOn(paint.hex) }}>
                    {colourDone(c) ? "✓" : c + 1}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="cbn-tray__hint">
            {picture.palette[selected]?.name} ·{" "}
            {colourDone(selected) ? "all done ✓" : `${state.colours[selected].total - state.colours[selected].done} left`}
            <span aria-hidden="true"> · pinch to zoom</span>
          </p>
        </div>
      )}
    </>
  );
}

function Finished({ picture, again, onAgain, onClose, showing }) {
  const { partner, toChat, toDoodles } = useArtShare();
  const [toast, showToast] = useToast();
  const make = () => canvasFile(paintPicture(picture), `colour-by-number-${picture.id}`);
  return (
    <div className="artsy-tray cbn-done" data-show={showing}>
      <p className="cbn-done__title artsy-hand">{again ? "finished again, so pretty ♡" : "all painted, so lovely ♡"}</p>
      <ShareButtons
        partner={partner}
        toChat={toChat}
        toDoodles={toDoodles}
        onChat={() => toChat.mutate({ make, alt: `a coloured-in picture: ${picture.name}` }, { onSuccess: () => showToast(`sent to ${partner} ♡`) })}
        onKeep={() => toDoodles.mutate({ make, title: `colour by number: ${picture.name}` }, { onSuccess: () => showToast("tucked into your gallery ♡") })}
      />
      <div className="cbn-done__more">
        <button type="button" className="artsy-chip" onClick={onClose}>
          another picture →
        </button>
        <button type="button" className="artsy-chip" onClick={onAgain}>
          colour again ↺
        </button>
      </div>
      <Toast text={toast} />
    </div>
  );
}

/** Dark numbers on light paint, light on dark. */
function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#3d2850" : "#fffaff";
}

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </svg>
);
const FitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
);
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l1.9 6.1 6.1 1.9-6.1 1.9L12 18.5l-1.9-6.1L4 10.5l6.1-1.9z" />
    <circle cx="19" cy="19" r="1.6" />
  </svg>
);
