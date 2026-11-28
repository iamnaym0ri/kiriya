import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { chatPrefsKey, useChatPrefs } from "../../lib/chat.js";
import { sealFile, sealPrivate, useChatKeys } from "../../lib/chatCrypto.js";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { haptic, isNativeApp } from "../../lib/native.js";
import { useViewingAs } from "../../lib/session.js";
import { TypingIndicator } from "./theme/Typing.jsx";
import { WALLPAPERS } from "./wallpapers.js";
import Sheet from "./theme/Sheet.jsx";
import { BackdropThumb, LivePreview, MiniBubbles } from "./theme/Preview.jsx";
import { BACKGROUNDS, BUBBLES, PHOTO_DEFAULTS, THEMES, TYPING, photoSettings } from "./theme/index.js";
import { LockSettings } from "./lock/LockSettings.jsx";
import "./theme/sheet.css";

export { BUBBLES };

// Round 4: the theme and background are theirs together; bubbles, typing and the lock are each person's own.
const TABS = [
  ["theme", "theme", "ours"],
  ["background", "background", "ours"],
  ["bubbles", "bubbles", "yours"],
  ["privacy", "privacy", "yours"],
];

/** Says plainly whose choice this is. */
function Who({ ours, children }) {
  return (
    <p className="look-who" data-who={ours ? "ours" : "yours"}>
      <span className="look-who__tag">{ours ? "♡ ours" : "just yours"}</span>
      <span>{children}</span>
    </p>
  );
}
const labelOf = (list, key) => list.find((item) => item.key === key)?.label ?? key;

/**
 * Saves a change to her look at once on this screen (and the chat behind the sheet), and on the
 * server right away, or a moment later while a slider or a drag is still moving.
 */
function usePrefsSaver(onError) {
  const queryClient = useQueryClient();
  const pending = useRef({});
  const timer = useRef(null);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    api("/me/chat/prefs", { method: "PUT", body }).then(
      (saved) => queryClient.setQueryData(chatPrefsKey, (current) => ({ ...current, wallpapers: saved.wallpapers ?? current?.wallpapers })),
      (error) => onError(error?.code === "preview" ? "just peeking at her side ♡ nothing changes." : "that look couldn’t be saved. try again?"),
    );
  }, [queryClient, onError]);
  useEffect(() => () => flush(), [flush]);
  return useCallback(
    (change, { soon = false } = {}) => {
      queryClient.setQueryData(chatPrefsKey, (current) => ({ ...current, ...change }));
      pending.current = { ...pending.current, ...change };
      clearTimeout(timer.current);
      if (soon) timer.current = setTimeout(flush, 400);
      else flush();
    },
    [queryClient, flush],
  );
}

function Check() {
  return (
    <span className="look-check" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12 5 5 9-10" />
      </svg>
    </span>
  );
}

function ThemePicker({ prefs, set }) {
  return (
    <div className="look-grid look-grid--themes" role="radiogroup" aria-label="Theme">
      {THEMES.map((theme) => {
        const on = (prefs.theme ?? "lilac") === theme.key;
        return (
          <button key={theme.key} type="button" role="radio" aria-checked={on} className="look-card look-card--theme" onClick={() => (haptic("light"), set({ theme: theme.key }))}>
            <MiniBubbles theme={theme.key} bubble="lilac" background="theme" words={["hi ♡", "hiii"]} />
            <span className="look-card__text">
              <strong>{theme.label}</strong>
              <small>{theme.note}</small>
            </span>
            {on && <Check />}
          </button>
        );
      })}
    </div>
  );
}

function BubblePicker({ prefs, set, name }) {
  const theirs = prefs.theirs ?? {};
  return (
    <>
      <Who>
        your messages wear your bubbles on both phones; {name}’s wear {name}’s ({labelOf(BUBBLES, theirs.bubble ?? "lilac")}).
      </Who>
      <div className="look-grid look-grid--bubbles" role="radiogroup" aria-label="Your bubbles">
        {BUBBLES.map((bubble) => {
          const on = (prefs.bubble ?? "lilac") === bubble.key;
          return (
            <button key={bubble.key} type="button" role="radio" aria-checked={on} className="look-card look-card--bubble" onClick={() => (haptic("light"), set({ bubble: bubble.key }))}>
              <MiniBubbles theme={prefs.theme ?? "lilac"} bubble={bubble.key} background="plain" />
              <span className="look-card__label">{bubble.label}</span>
              {bubble.fresh && !on && <span className="look-new">new</span>}
              {on && <Check />}
            </button>
          );
        })}
      </div>
      <h3 className="look-heading">when you’re typing, {name} sees…</h3>
      <Who>
        you pick how your “typing…” looks to {name}; {name} picks theirs ({labelOf(TYPING, theirs.typing ?? "hearts")}).
      </Who>
      <div className="look-grid look-grid--typing" role="radiogroup" aria-label="How your typing looks">
        {TYPING.map((typing) => {
          const on = (prefs.typing ?? "hearts") === typing.key;
          return (
            <button key={typing.key} type="button" role="radio" aria-checked={on} className="look-card look-card--typing" onClick={() => set({ typing: typing.key })}>
              <TypingIndicator style={typing.key} name="you" />
              <span className="look-card__label">{typing.label}</span>
              {typing.fresh && !on && <span className="look-new">new</span>}
              {on && <Check />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <label className="look-slider">
      <span className="look-slider__label">
        {label}
        <output>{format(value)}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function PhotoControls({ prefs, set, onChange, onRemove, busy }) {
  const photo = photoSettings(prefs);
  const move = (change) => set({ photo: { ...photo, ...change } }, { soon: true });
  return (
    <div className="look-photo">
      <Slider label="zoom" value={photo.zoom} min={1} max={3} step={0.05} format={(v) => `${v.toFixed(1)}×`} onChange={(zoom) => move({ zoom })} />
      <Slider label="soften" value={photo.dim} min={0} max={0.85} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(dim) => move({ dim })} />
      <Slider label="blur" value={photo.blur} min={0} max={16} step={1} format={(v) => (v ? `${v}px` : "none")} onChange={(blur) => move({ blur })} />
      <div className="look-photo__actions">
        <button type="button" className="look-pill" onClick={onChange} disabled={busy}>
          change photo
        </button>
        <button type="button" className="look-pill" onClick={() => move({ ...PHOTO_DEFAULTS })}>
          start over
        </button>
        <button type="button" className="look-pill" data-quiet onClick={onRemove}>
          remove
        </button>
      </div>
    </div>
  );
}

function BackgroundPicker({ prefs, set, onError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const keys = useChatKeys();
  async function choose(file) {
    setBusy("putting your photo in…");
    try {
      const ready = await shrinkImage(file, 2200);
      // Sealed end to end once the chat is: her own photo is as private as her messages.
      const sealed = keys.status === "ready" ? await sealFile(ready) : { blob: ready, sealed: null };
      const stored = await uploadFile(sealed.blob, { folder: sealed.sealed ? "chat" : "backgrounds" });
      const backgroundKey = sealed.sealed ? await sealPrivate("background", sealed.sealed) : null;
      set({ background: "photo", backgroundUrl: stored.url, backgroundKey, photo: { ...PHOTO_DEFAULTS } });
      haptic("success");
    } catch (failure) {
      onError(failure?.message ?? "That photo couldn’t be used.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }
  const current = prefs.background === "photo" && prefs.backgroundUrl ? "photo" : (prefs.background ?? "theme");
  const wallpaper = WALLPAPERS[current];
  return (
    <>
      <div className="look-grid look-grid--backgrounds" role="radiogroup" aria-label="Background">
        <button type="button" role="radio" aria-checked={current === "photo"} className="look-card look-card--backdrop" data-photo onClick={() => (prefs.backgroundUrl && current !== "photo" ? set({ background: "photo" }) : input.current?.click())} aria-busy={Boolean(busy)}>
          {prefs.backgroundUrl ? (
            <BackdropThumb prefs={prefs} background="photo" />
          ) : (
            <span className="look-card__add" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 17 5-5 4 4 2-2 5 4" />
                <circle cx="15.5" cy="9.5" r="1.5" />
              </svg>
            </span>
          )}
          <span className="look-card__label">{busy ? "adding…" : prefs.backgroundUrl ? "your photo" : "add a photo"}</span>
          {current === "photo" && <Check />}
        </button>
        {BACKGROUNDS.map((background) => (
          <button key={background.key} type="button" role="radio" aria-checked={current === background.key} className="look-card look-card--backdrop" onClick={() => (haptic("light"), set({ background: background.key }))}>
            <BackdropThumb prefs={prefs} background={background.key} />
            <span className="look-card__label">{background.label}</span>
            {current === background.key && <Check />}
          </button>
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(event) => event.target.files?.[0] && choose(event.target.files[0])} />
      {busy && (
        <p className="look-note" role="status">
          {busy}
        </p>
      )}
      {current === "photo" && (
        <PhotoControls
          prefs={prefs}
          set={set}
          busy={Boolean(busy)}
          onChange={() => input.current?.click()}
          onRemove={() => set({ background: "theme", backgroundUrl: null, backgroundKey: null })}
        />
      )}
      {wallpaper && <p className="look-credit">{wallpaper.label === "miku" ? `Miku art: ${wallpaper.credit}` : `Maomao wallpaper: official art, ${wallpaper.credit}`}</p>}
    </>
  );
}

/**
 * The chat's look and privacy. The theme and background are theirs together (either of them
 * changes it for both); the bubbles, the typing indicator and the lock are each person's own.
 */
export default function ChatLook({ prefs: initial, name, onClose }) {
  const prefs = useChatPrefs().data ?? initial ?? {};
  const [tab, setTab] = useState("theme");
  const [error, setError] = useState("");
  const viewing = useViewingAs();
  const set = usePrefsSaver(setError);
  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(""), 3200);
    return () => clearTimeout(timer);
  }, [error]);
  const preview = (
    <div className="look-top">
      <LivePreview prefs={prefs} name={name} onMovePhoto={tab === "background" ? (change, options) => set({ photo: { ...photoSettings(prefs), ...change } }, options) : null} />
      <div className="look-tabs" role="tablist" aria-label="What to change">
        {TABS.map(([key, label, whose]) => (
          <button key={key} type="button" role="tab" id={`look-tab-${key}`} aria-selected={tab === key} aria-controls="look-panel" data-whose={whose} onClick={() => setTab(key)}>
            <span>{label}</span>
            <small>{whose === "ours" ? "♡ ours" : "yours"}</small>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Sheet title="make it yours ♡" onClose={onClose} className="chat-look-sheet" header={preview}>
      <div id="look-panel" role="tabpanel" aria-labelledby={`look-tab-${tab}`} className="look-panel">
        {viewing && <p className="look-note">just peeking at her side ♡ this is how her chat looks.</p>}
        {tab === "theme" && (
          <>
            <Who ours>change it and it changes for {name} too, right away.</Who>
            <ThemePicker prefs={prefs} set={set} />
          </>
        )}
        {tab === "bubbles" && <BubblePicker prefs={prefs} set={set} name={name} />}
        {tab === "background" && (
          <>
            <Who ours>one background for both of you: {name} sees what you pick.</Who>
            <BackgroundPicker prefs={prefs} set={set} onError={setError} />
          </>
        )}
        {tab === "privacy" && <LockSettings prefs={prefs} set={set} name={name} faceId={isNativeApp()} />}
      </div>
      {error && (
        <p className="look-toast" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
