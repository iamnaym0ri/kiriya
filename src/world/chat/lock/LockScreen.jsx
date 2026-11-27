import { useEffect, useRef, useState } from "react";

/**
 * A cover over the whole chat, in the top layer (a modal <dialog> opened last), so it sits above
 * anything that was open (a menu, the design sheet) and nothing behind it can be reached.
 */
function Cover({ labelledBy, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="chat-lock" aria-labelledby={labelledBy} onCancel={(event) => event.preventDefault()}>
      <div className="chat-lock__backdrop" aria-hidden="true" />
      {children}
    </dialog>
  );
}
import { checkFaceId, faceIdAvailable } from "./faceId.js";
import { PassphraseForm } from "./PassphraseForm.jsx";

function LockHeart() {
  return (
    <svg className="chat-lock__icon" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="27" width="40" height="30" rx="10" fill="var(--chat-accent)" />
      <path d="M21 27v-6a11 11 0 0 1 22 0v6" fill="none" stroke="var(--chat-accent)" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 50s-8-5-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 10-8 10Z" fill="var(--chat-accent-ink)" />
    </svg>
  );
}

/**
 * The chat with its lock on: a soft cover in her theme that hides every message until Face ID (in
 * the app) or her passphrase opens it. Face ID is asked for straight away, once.
 */
export function LockScreen({ onOpen, keyLocked }) {
  const [faceId, setFaceId] = useState(null); // null = checking, true/false
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [note, setNote] = useState("");
  const asked = useRef(false);
  async function tryFaceId() {
    setNote("");
    try {
      await checkFaceId();
      onOpen();
    } catch {
      setNote("that didn’t open it. try again, or use your passphrase.");
    }
  }
  useEffect(() => {
    let alive = true;
    faceIdAvailable().then((available) => {
      if (!alive) return;
      setFaceId(available);
      // The passphrase is needed anyway when this device hasn't opened the chat's key yet.
      if (available && !keyLocked && !asked.current) {
        asked.current = true;
        tryFaceId();
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showPassphrase = keyLocked || faceId === false || usePassphrase;
  return (
    <Cover labelledBy="chat-lock-title">
      <div className="chat-lock__card">
        <LockHeart />
        <h1 id="chat-lock-title">our chat is tucked away</h1>
        <p>{showPassphrase ? "type your passphrase to open it ♡" : "just you, and your face ♡"}</p>
        {showPassphrase ? (
          <PassphraseForm onDone={onOpen} submitLabel="open our chat" autoFocus={!faceId} checkOnly={!keyLocked} />
        ) : (
          <>
            <button type="button" className="look-pill look-pill--strong chat-lock__main" onClick={tryFaceId}>
              open with Face ID
            </button>
            <button type="button" className="look-pill" onClick={() => setUsePassphrase(true)}>
              use my passphrase
            </button>
          </>
        )}
        {note && (
          <p className="chat-lock__note" role="status">
            {note}
          </p>
        )}
      </div>
    </Cover>
  );
}

/** This device hasn't opened the chat's key yet: her passphrase, once. */
export function KeyScreen() {
  return (
    <Cover labelledBy="chat-key-title">
      <div className="chat-lock__card">
        <LockHeart />
        <h1 id="chat-key-title">open your messages here</h1>
        <p>your messages are sealed so only your phones can read them. type your passphrase once and this device can too ♡</p>
        <PassphraseForm submitLabel="open my messages" autoFocus />
      </div>
    </Cover>
  );
}
