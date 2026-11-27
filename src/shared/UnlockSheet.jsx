import { useEffect, useId, useRef, useState } from "react";
import { useUnlock } from "../lib/session.js";
import { isAppShell } from "../lib/native.js";
import { Modal, Icon } from "./WorldPrimitives.jsx";
import AppSignIn, { unlockErrorMessage } from "./opening/AppSignIn.jsx";

/** The passphrase sign-in: a dialog on the website; in the app, the app's own sign-in screen. */
export default function UnlockSheet(props) {
  if (isAppShell()) return props.open ? <AppSignIn onUnlocked={props.onUnlocked} /> : null;
  return <WebUnlockSheet {...props} />;
}

function WebUnlockSheet({
  open,
  onClose,
  onUnlocked,
  title = "This part is just for Kiriya",
}) {
  const [passphrase, setPassphrase] = useState("");
  const unlock = useUnlock();
  const inputRef = useRef(null);
  const titleId = useId();
  const errorId = useId();
  useEffect(() => {
    if (!open) return;
    setPassphrase("");
    unlock.reset();
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);
  function submit(event) {
    event.preventDefault();
    if (!passphrase.trim() || unlock.isPending) return;
    unlock.mutate(passphrase, {
      onSuccess: (data) => onUnlocked?.(data),
      onError: (error) => {
        if (error.code === "wrong_passphrase") {
          inputRef.current?.focus({ preventScroll: true });
          inputRef.current?.select();
        }
      },
    });
  }
  const error = unlockErrorMessage(unlock.error);
  const wrongPassphrase = unlock.error?.code === "wrong_passphrase";
  if (!open) return null;
  return (
    <Modal title={title} onClose={onClose} className="unlock-dialog">
      <form onSubmit={submit} className="unlock-form">
        <div className="unlock-door-icon">
          <Icon name="lock" size={30} />
        </div>
        <p className="handwritten">A key to your little world.</p>
        <label htmlFor={`${titleId}-input`}>Passphrase</label>
        <input
          id={`${titleId}-input`}
          ref={inputRef}
          className="field"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          value={passphrase}
          onChange={(e) => {
            setPassphrase(e.target.value);
            if (unlock.isError) unlock.reset();
          }}
          aria-invalid={wrongPassphrase}
          aria-describedby={error ? errorId : undefined}
          placeholder="Your passphrase"
        />
        <p id={errorId} role="alert" aria-atomic="true" className="unlock-error">
          {error ?? ""}
        </p>
        <button
          className="button-plum"
          disabled={!passphrase.trim() || unlock.isPending}
        >
          {unlock.isPending ? "Opening…" : "Open your world"}
          <Icon name="arrow" size={18} />
        </button>
      </form>
    </Modal>
  );
}
