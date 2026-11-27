import { useEffect, useId, useRef, useState } from "react";
import { useUnlock } from "../../lib/session.js";
import "./AppSignIn.css";

/** What went wrong with a typed passphrase, in her words. */
export function unlockErrorMessage(error) {
  if (!error) return null;
  if (error.code === "wrong_passphrase") return "Wrong passphrase. Please check it and try again.";
  if (error.status === 429) return "Too many tries. Please wait 15 minutes, then try again.";
  if (!error.status) return "Couldn't connect. Check your internet connection and try again.";
  return "We couldn't check your passphrase right now. Please try again in a moment.";
}

/** A little face-scan glyph (original): corner brackets, two eyes, a smile. */
export function FaceIdGlyph({ size = 26 }) {
  return (
    <svg className="app-signin__glyph" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M3 9V6a3 3 0 0 1 3-3h3M19 3h3a3 3 0 0 1 3 3v3M25 19v3a3 3 0 0 1-3 3h-3M9 25H6a3 3 0 0 1-3-3v-3" />
      <path d="M10 10.5v2M18 10.5v2M14 11v4.5h-1.2M10 18.5q4 3 8 0" />
    </svg>
  );
}

/**
 * The app's sign-in screen (app only; the website keeps its passphrase dialog, UnlockSheet).
 *
 * - `faceId` ({ label, onPress, busy }): on a phone set up for Face ID it is the main button, and
 *   the passphrase is the fallback underneath it ("try Face ID again" after a cancelled scan).
 * - Without it, the passphrase is the whole screen, ready to type.
 * - Every typed passphrase goes through useUnlock (lib/session.js), which never keeps it.
 */
export default function AppSignIn({ faceId = null, onUnlocked, title, line }) {
  const unlock = useUnlock();
  const [passphrase, setPassphrase] = useState("");
  const input = useRef(null);
  const fieldId = useId();
  const errorId = useId();
  const typingFirst = !faceId;

  // Without Face ID on offer, the field is ready for her straight away.
  useEffect(() => {
    if (!typingFirst) return undefined;
    const timer = setTimeout(() => input.current?.focus({ preventScroll: true }), 150);
    return () => clearTimeout(timer);
  }, [typingFirst]);

  // Development only (the iOS Simulator can't type): `?dev-pass=<dev passphrase>` signs in.
  const devPass = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("dev-pass") : null;
  useEffect(() => {
    if (devPass) unlock.mutate(devPass, { onSuccess: (data) => onUnlocked?.(data) });
  }, [devPass]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(event) {
    event.preventDefault();
    const typed = passphrase;
    if (!typed.trim() || unlock.isPending) return;
    unlock.mutate(typed, {
      onSuccess: (data) => {
        setPassphrase("");
        onUnlocked?.(data);
      },
      onError: (error) => {
        if (error.code === "wrong_passphrase") {
          input.current?.focus({ preventScroll: true });
          input.current?.select();
        }
      },
    });
  }

  const error = unlockErrorMessage(unlock.error);
  return (
    <div className="app-signin" data-ready="true" data-face-id={faceId ? "true" : undefined}>
      <div className="app-signin__card">
        <p className="app-signin__word" aria-hidden="true">
          kiriya<span>✦</span>
        </p>
        <h1 className="app-signin__title">{title ?? (faceId ? "welcome back ♡" : "a key to your little world")}</h1>
        {line && <p className="app-signin__line">{line}</p>}
        {faceId && (
          <button type="button" className="app-signin__face" onClick={faceId.onPress} disabled={faceId.busy}>
            <FaceIdGlyph />
            <span>{faceId.busy ? "checking…" : faceId.label}</span>
          </button>
        )}
        {faceId && (
          <p className="app-signin__or" aria-hidden="true">
            <span>or your passphrase</span>
          </p>
        )}
        <form className="app-signin__form" onSubmit={submit}>
          <label className="sr-only" htmlFor={fieldId}>
            Passphrase
          </label>
          <input
            id={fieldId}
            ref={input}
            className="app-signin__field"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={passphrase}
            onChange={(event) => {
              setPassphrase(event.target.value);
              if (unlock.isError) unlock.reset();
            }}
            aria-invalid={unlock.error?.code === "wrong_passphrase"}
            aria-describedby={error ? errorId : undefined}
            placeholder="your passphrase"
          />
          <button type="submit" className="app-signin__go" disabled={!passphrase.trim() || unlock.isPending} aria-label={faceId ? "Open with the passphrase" : undefined}>
            {faceId ? (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            ) : unlock.isPending ? (
              "opening…"
            ) : (
              "open your world ♡"
            )}
          </button>
        </form>
        <p id={errorId} className="app-signin__error" role="alert" aria-atomic="true">
          {error ?? ""}
        </p>
      </div>
    </div>
  );
}
