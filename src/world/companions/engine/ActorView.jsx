import { memo, useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

// One character's DOM: its clouds, its body and its speech bubble. The actor (actor.js) moves these
// nodes itself every frame; React only re-renders when the pose, expression, clouds or words change.

const BodySlot = memo(function BodySlot({ Body, pose, expression, facing, playing, frame, talking }) {
  return <Body pose={pose} expression={expression} facing={facing} playing={playing} frame={frame} talking={talking} />;
});

const PlatformSlot = memo(function PlatformSlot({ Platform, width, state, facing, riding, playing }) {
  return <Platform width={width} state={state} facing={facing} riding={riding} playing={playing} />;
});

function Tile({ actor, tile, playing, facing }) {
  const { c, m, pw, surface } = actor;
  return (
    <div
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

export default function ActorView({ actor, playing }) {
  const view = useSyncExternalStore(actor.view.subscribe, actor.view.get, actor.view.get);
  const { c, m } = actor;
  const { w, h, pw, surface } = actor;
  const bubbleRef = useRef(null);

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
    event.currentTarget.setPointerCapture?.(event.pointerId);
    actor.pointerDown(event);
  };
  const onPointerMove = (event) => actor.pointerMove(event);
  const onPointerUp = (event) => actor.pointerUp(event);
  const onKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      actor.tap();
    }
  };

  return (
    <>
      {view.tiles.map((tile) => (
        <Tile key={tile.id} actor={actor} tile={tile} playing={playing} facing={view.facing} />
      ))}
      <div className="cs-actor" ref={root} data-role={actor.role} data-held={view.held ? "" : undefined}>
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
              ref={hitRef}
              className="cs-body"
              style={{ width: w, height: h, transform: `translate3d(${-w / 2}px, ${-h}px, 0)` }}
              role="button"
              tabIndex={0}
              aria-label={`${c.name}: tap to say hi, or hold and drag to carry`}
              data-pose={view.pose}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              onContextMenu={(event) => event.preventDefault()}
            >
              <BodySlot
                Body={c.Body}
                pose={view.pose}
                expression={view.expression}
                facing={view.facing}
                playing={playing}
                frame={actor.frame}
                talking={view.talking}
              />
            </div>
          </div>
        </div>
      </div>
      <p
        ref={bubble}
        className="cs-bubble"
        hidden={!view.bubble}
        data-aside={view.bubble?.aside ? "" : undefined}
        aria-live={view.bubble?.aside ? "off" : "polite"}
      >
        {view.bubble?.text}
      </p>
    </>
  );
}
