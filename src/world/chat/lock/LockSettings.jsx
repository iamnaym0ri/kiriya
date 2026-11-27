import { useState } from "react";
import { useChatKeys } from "../../../lib/chatCrypto.js";
import { useViewingAs } from "../../../lib/session.js";
import { haptic } from "../../../lib/native.js";
import { DEFAULT_LOCK, lockPrefs, markUnlocked, rememberLockLocally } from "./lockState.js";
import { PassphraseForm } from "./PassphraseForm.jsx";

const AFTER = [
  [0, "right away"],
  [60, "after a minute"],
  [300, "after 5 minutes"],
];

function Switch({ on, onChange, label, detail, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="look-switch" onClick={() => onChange(!on)} disabled={disabled}>
      <span className="look-switch__text">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className="look-switch__track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

const when = (iso) => new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "long", timeZone: "Asia/Singapore" });

function SealedStatus({ name }) {
  const keys = useChatKeys();
  const [asking, setAsking] = useState(false);
  if (keys.status === "ready")
    return (
      <>
        <p className="look-sealed">
          <span aria-hidden="true">🔒</span> sealed end to end. your messages, photos, videos and voice notes are scrambled on your phones before they go, so only the two of you can read them.
        </p>
        {keys.safety && (
          <div className="look-safety">
            <span className="look-safety__code" aria-label={`your safety code: ${keys.safety}`}>
              {keys.safety}
            </span>
            <small>the same little code on {name}’s phone means nobody is in between ♡</small>
          </div>
        )}
        {keys.partnerChangedAt && <p className="look-note">{name}’s lock was renewed on {when(keys.partnerChangedAt)}. a passphrase reset does that, so the code changed too.</p>}
      </>
    );
  if (keys.status === "locked" || (keys.status === "plain" && !keys.setUp))
    return (
      <>
        <p className="look-sealed">
          <span aria-hidden="true">🔑</span>{" "}
          {keys.status === "locked" ? "this device needs your passphrase once to open your messages." : "type your passphrase once to seal your messages on this device."}
        </p>
        {asking ? <PassphraseForm onDone={() => setAsking(false)} /> : (
          <button type="button" className="look-pill" onClick={() => setAsking(true)}>
            type my passphrase
          </button>
        )}
      </>
    );
  if (keys.status === "plain")
    return (
      <p className="look-sealed">
        <span aria-hidden="true">🔒</span> your messages will be sealed end to end as soon as {name} opens the app with their passphrase. everything sent before then gets sealed too.
      </p>
    );
  return <p className="look-note">checking the lock…</p>;
}

/** The design sheet's privacy part: the chat lock, and how sealed the messages are. */
export function LockSettings({ prefs, set, name, faceId }) {
  const viewing = useViewingAs();
  const lock = lockPrefs(prefs);
  const change = (next) => {
    const value = { ...DEFAULT_LOCK, ...lock, ...next };
    haptic("light");
    rememberLockLocally(value);
    // She's looking at the chat as she turns it on: it stays open until she leaves.
    if (value.on && !lock.on) markUnlocked();
    set({ lock: value });
  };
  return (
    <div className="look-privacy">
      <section className="look-box">
        <Switch
          on={lock.on}
          onChange={(on) => change({ on })}
          disabled={Boolean(viewing)}
          label="lock our chat"
          detail={faceId ? "ask for Face ID before it opens (your passphrase works too)" : "ask for your passphrase before it opens"}
        />
        {lock.on && (
          <>
            <p className="look-box__label">lock again</p>
            <div className="look-chips" role="radiogroup" aria-label="Lock again">
              {AFTER.map(([seconds, label]) => (
                <button key={seconds} type="button" role="radio" aria-checked={lock.after === seconds} onClick={() => change({ after: seconds })}>
                  {label}
                </button>
              ))}
            </div>
            <Switch on={lock.previews} onChange={(previews) => change({ previews })} label="show words in notifications" detail={lock.previews ? "notifications show what was said" : "notifications just say “a new message ♡”"} />
          </>
        )}
      </section>
      <section className="look-box">
        <SealedStatus name={name} />
      </section>
    </div>
  );
}
