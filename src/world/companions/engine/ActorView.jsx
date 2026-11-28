import { Component, createRef, memo, useCallback, useEffect, useLayoutEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { BLEND_MS } from "./blend.js";
import { blendChanges, watch } from "./ghost.js";

// One character's DOM: its clouds, its body and its speech bubble. The actor (actor.js) moves these
// nodes itself every frame; React only re-renders when the pose, expression, clouds or words change.

const BodySlot = memo(function BodySlot({ Body, pose, expression, facing, playing, frame, talking, prop }) {
  return <Body pose={pose} expression={expression} facing={facing} playing={playing} frame={frame} talking={talking} prop={prop} />;
});

/**
 * The body, and the cross-fade between its drawings (README.md, "Transitions"; ghost.js). Just
 * before React draws a new pose, expression or prop, a watch starts on the drawing; right after,
 * what React removed fades out where it was and what it added fades in, over `blendMs` (from the
 * actor, blend.js). `Body.blend === false` turns it off for a Body that blends its own poses.
 */
class PoseBlend extends Component {
  live = createRef();
  leaving = new Set();

  getSnapshotBeforeUpdate(prev) {
    const p = this.props;
    if (!p.blend) return null;
    const pose = prev.pose !== p.pose;
    if (!pose && prev.expression === p.expression && prev.prop === p.prop) return null;
    const watcher = watch(this.live.current?.firstElementChild);
    if (!watcher) return null;
    return { watcher, ms: pose ? p.blendMs : p.playing ? BLEND_MS.face : BLEND_MS.quiet, dip: pose && !p.playing };
  }

  componentDidUpdate(prevProps, prevState, info) {
    if (info) blendChanges(info.watcher, this.live.current, { ms: info.ms, leaving: this.leaving, dip: info.dip });
  }

  render() {
    const { Body, pose, expression, facing, playing, frame, talking, prop } = this.props;
    return (
      <div className="cs-pose" ref={this.live}>
        <BodySlot Body={Body} pose={pose} expression={expression} facing={facing} playing={playing} frame={frame} talking={talking} prop={prop} />
      </div>
    );
  }
}

const PlatformSlot = memo(function PlatformSlot({ Platform, width, state, facing, riding, playing }) {
  return <Platform width={width} state={state} facing={facing} riding={riding} playing={playing} />;
});

function Tile({ actor, tile, playing, facing }) {
  const { c, m, pw, surface } = actor;
  // How far its cloud reaches below its feet, measured once (levels keep that clear of the bars).
  const measure = useCallback(
    (el) => {
      if (!el || actor.cloudDepth != null) return;
      const depth = el.offsetHeight - surface;
      if (depth > 0) actor.cloudMeasured?.(depth);
    },
    [actor, surface],
  );
  return (
    <div
      ref={measure}
      className="cs-tile"
      data-state={tile.state}
      data-fx={m.platformFx}
      style={{
        width: pw,
        transform: `translate3d(${Math.round(tile.x - pw / 2)}px, ${Math.round(tile.y - surface)}px, 0)`,
        "--cs-form": `${m.platformForm}ms`,
        "--cs-fade": `${m.platformFade}ms`,
      }}
    >
      <PlatformSlot Platform={c.Platform} width={pw} state={tile.state} facing={facing} riding={false} playing={playing} />
    </div>
  );
}

/** An action's icon: one emoji, or a tiny component drawn at `size`. */
function ChipIcon({ icon }) {
  if (!icon) return null;
  if (typeof icon === "string") return <span className="cs-chip__icon" aria-hidden="true">{icon}</span>;
  const Icon = icon;
  return (
    <span className="cs-chip__icon" aria-hidden="true">
      <Icon size={22} />
    </span>
  );
}

// Stops the page underneath from starting pull-to-refresh or a swipe while a chip is pressed.
const stopTouch = (event) => event.stopPropagation();

/**
 * The tap menu (README.md, "The tap menu and stay"): its own action and stay (or wander), two 44 pt
 * chips beside it. actor.js places it every frame (transform only) and closes it; this closes it
 * on a tap anywhere else and on Escape, and measures it so it can be placed before it paints.
 */
function Menu({ actor, menu, staying }) {
  const ref = useRef(null);
  const attach = useCallback(
    (el) => {
      ref.current = el;
      actor.attach("menu", el);
    },
    [actor],
  );
  const action = actor.c.action;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure the chips at their natural widths (row), then let the actor choose the layout.
    el.dataset.layout = "row";
    const chips = [...el.querySelectorAll(".cs-chip")];
    const style = getComputedStyle(el);
    const pad = parseFloat(style.paddingLeft) || 0;
    const gap = parseFloat(style.columnGap || style.gap) || 0;
    const ws = chips.map((chip) => chip.offsetWidth);
    const hs = chips.map((chip) => chip.offsetHeight);
    const between = gap * Math.max(0, chips.length - 1);
    actor.menuSize = {
      row: { w: ws.reduce((a, b) => a + b, 0) + between + pad * 2, h: Math.max(...hs) + pad * 2 },
      column: { w: Math.max(...ws) + pad * 2, h: hs.reduce((a, b) => a + b, 0) + between + pad * 2 },
    };
    actor.lastMenu = null;
    actor.menuPlace = null;
    actor.placeMenu();
    if (menu.focus) chips[0]?.focus({ preventScroll: true });
  }, [actor, menu.id, menu.focus, staying]);

  // A tap anywhere but the menu and the body closes it, and so does Escape.
  useEffect(() => {
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || actor.els.hit?.contains(event.target)) return;
      actor.closeMenu("outside");
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      actor.closeMenu("escape");
      actor.els.hit?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    const el = ref.current;
    el?.addEventListener("touchstart", stopTouch, { passive: true });
    el?.addEventListener("touchmove", stopTouch, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      el?.removeEventListener("touchstart", stopTouch);
      el?.removeEventListener("touchmove", stopTouch);
    };
  }, [actor, menu.id]);

  return (
    <div ref={attach} className="cs-menu" role="group" aria-label={`${actor.c.name}: choose something`}>
      {action && (
        <button type="button" className="cs-chip" data-chip="action" onClick={() => actor.choose("action")}>
          <ChipIcon icon={action.icon} />
          <span className="cs-chip__label">{action.label}</span>
        </button>
      )}
      <button type="button" className="cs-chip" data-chip={staying ? "wander" : "stay"} aria-pressed={staying} onClick={() => actor.choose(staying ? "wander" : "stay")}>
        <span className="cs-chip__icon" aria-hidden="true">{staying ? "🌸" : "📍"}</span>
        <span className="cs-chip__label">{staying ? "wander" : "stay"}</span>
      </button>
    </div>
  );
}

export default function ActorView({ actor, playing }) {
  const view = useSyncExternalStore(actor.view.subscribe, actor.view.get, actor.view.get);
  const { c, m } = actor;
  const { w, h, pw, surface } = actor;
  const bubbleRef = useRef(null);
  // A line that has just ended stays a moment while it fades (data-leaving), then hides.
  const lastBubble = useRef(null);
  const [, bubbleGone] = useReducer((n) => n + 1, 0);
  if (view.bubble) lastBubble.current = view.bubble;
  const shownBubble = view.bubble ?? lastBubble.current;
  const leaving = !view.bubble && Boolean(shownBubble);
  // If its fade never runs (animations off), it still goes.
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => {
      if (actor.view.get().bubble) return;
      lastBubble.current = null;
      bubbleGone();
    }, 400);
    return () => clearTimeout(timer);
  }, [leaving, actor]);

  const root = useCallback((el) => actor.attach("root", el), [actor]);
  const sway = useCallback((el) => actor.attach("sway", el), [actor]);
  const squash = useCallback((el) => actor.attach("squash", el), [actor]);
  const bubble = useCallback(
    (el) => {
      bubbleRef.current = el;
      actor.attach("bubble", el);
    },
    [actor],
  );

  // Measure the bubble when its words change, so the actor can keep it on screen.
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el || !view.bubble) return;
    actor.bubbleSize = { w: el.offsetWidth, h: el.offsetHeight };
    actor.lastBubble = null;
    actor.placeBubble();
  }, [actor, view.bubble]);

  // Touch: pointer events on the body only. Native touchstart is stopped here so dragging a
  // character never starts the page's pull-to-refresh.
  const hitRef = useRef(null);
  const hit = useCallback(
    (el) => {
      hitRef.current = el;
      actor.attach("hit", el);
    },
    [actor],
  );
  useEffect(() => {
    const el = hitRef.current;
    if (!el) return undefined;
    const stop = (event) => event.stopPropagation();
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("touchmove", stop, { passive: true });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);

  const onPointerDown = (event) => {
    if (event.button > 0) return;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: dragging still follows the body.
    }
    actor.pointerDown(event);
  };
  const onPointerMove = (event) => actor.pointerMove(event);
  const onPointerUp = (event) => actor.pointerUp(event);
  const onKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      actor.tap({ keyboard: true });
    }
  };

  return (
    <>
      {view.tiles.map((tile) => (
        <Tile key={tile.id} actor={actor} tile={tile} playing={playing} facing={view.facing} />
      ))}
      <div className="cs-actor" ref={root} data-role={actor.role} data-held={view.held ? "" : undefined} data-staying={view.staying ? "" : undefined}>
        {view.ride && (
          <div
            className="cs-tile cs-tile--ride"
            data-state={view.ride.state}
            data-fx={m.platformFx}
            style={{ width: pw, transform: `translate3d(${-pw / 2}px, ${-surface}px, 0)`, "--cs-form": `${m.platformForm}ms`, "--cs-fade": `${m.platformFade}ms` }}
          >
            <PlatformSlot Platform={c.Platform} width={pw} state={view.ride.state} facing={view.facing} riding playing={playing} />
          </div>
        )}
        <div className="cs-sway" ref={sway} style={{ transformOrigin: `0px ${-h * m.heldAt}px` }}>
          <div className="cs-squash" ref={squash}>
            <div
              ref={hit}
              className="cs-body"
              style={{ width: w, height: h, transform: `translate3d(${-w / 2}px, ${-h}px, 0)` }}
              role="button"
              tabIndex={0}
              aria-label={actor.role === "host" ? `${c.name}${view.staying ? ", staying put" : ""}: tap for choices, or hold and drag to carry` : `${c.name}: tap to say hi`}
              aria-haspopup={actor.role === "host" ? "true" : undefined}
              aria-expanded={actor.role === "host" ? Boolean(view.menu) : undefined}
              data-pose={view.pose}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              onContextMenu={(event) => event.preventDefault()}
            >
              <PoseBlend
                Body={c.Body}
                pose={view.pose}
                expression={view.expression}
                facing={view.facing}
                playing={playing}
                frame={actor.frame}
                talking={view.talking}
                prop={view.prop}
                blend={actor.stage.options?.blend !== false && c.Body.blend !== false}
                blendMs={view.blend}
              />
            </div>
          </div>
        </div>
      </div>
      <p
        ref={bubble}
        className="cs-bubble"
        hidden={!shownBubble}
        data-aside={shownBubble?.aside ? "" : undefined}
        data-leaving={leaving ? "" : undefined}
        aria-live={shownBubble?.aside ? "off" : "polite"}
        onAnimationEnd={(event) => {
          if (event.animationName !== "cs-unsay" || view.bubble) return;
          lastBubble.current = null;
          bubbleGone();
        }}
      >
        {shownBubble?.text}
      </p>
      {view.menu && <Menu key={view.menu.id} actor={actor} menu={view.menu} staying={view.staying} />}
    </>
  );
}
