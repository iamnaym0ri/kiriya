import { useId, useRef, useState } from "react";
import { api } from "../../../lib/api.js";
import { chatKeyState, unlockChatKeys } from "../../../lib/chatCrypto.js";

const messageFor = (error) =>
  error?.status === 401 ? "that passphrase didn’t match. try it again?"
  : error?.status === 429 ? "too many tries. wait a little, then try again."
  : !error?.status ? "couldn’t check it just now. are you online?"
  : "that didn’t work. try again?";

/**
 * Her passphrase, typed once: checks it, and opens this device's chat key with it when the key
 * isn't here yet. The words go to the check and the key, then the field is cleared.
 */
export function PassphraseForm({ onDone, submitLabel = "open", autoFocus = false, checkOnly = false }) {
  const id = useId();
  const field = useRef(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError("");
    const passphrase = value;
    try {
      const needsKey = !checkOnly && chatKeyState().status !== "ready";
      if (needsKey) await unlockChatKeys(passphrase);
      else await api("/me/passphrase/check", { method: "POST", body: { passphrase } });
      setValue("");
      onDone?.();
    } catch (failure) {
      setError(messageFor(failure));
      field.current?.select();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="chat-passphrase" onSubmit={submit}>
      <label htmlFor={id} className="chat-passphrase__label">
        your passphrase
      </label>
      <input
        id={id}
        ref={field}
        type="password"
        autoComplete="current-password"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <p id={`${id}-error`} className="chat-passphrase__error" role="alert">
        {error}
      </p>
      <button type="submit" className="look-pill look-pill--strong" disabled={!value.trim() || busy}>
        {busy ? "opening…" : submitLabel}
      </button>
    </form>
  );
}
