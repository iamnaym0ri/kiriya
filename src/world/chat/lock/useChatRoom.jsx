import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sealHistory, useChatKeys } from "../../../lib/chatCrypto.js";
import { setNativePrivacy } from "../../../lib/chatCrypto/native.js";
import { useViewingAs } from "../../../lib/session.js";
import { useChatLook } from "../theme/useChatLook.js";
import "../theme/index.js";
import "./lock.css";
import { KeyScreen, LockScreen } from "./LockScreen.jsx";
import { PassphraseForm } from "./PassphraseForm.jsx";
import { lockPrefs, markBack, markLeft, markUnlocked, relock, rememberLockLocally, stillOpen } from "./lockState.js";

function SetUpNudge({ onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chat-nudge" data-open={open || undefined}>
      {open ? (
        <>
          <p>type your passphrase once and your messages get sealed end to end, on both your phones ♡</p>
          <PassphraseForm submitLabel="seal our messages" autoFocus onDone={onClose} />
          <button type="button" className="look-pill" data-quiet onClick={onClose}>
            later
          </button>
        </>
      ) : (
        <button type="button" className="chat-nudge__pill" onClick={() => setOpen(true)}>
          <span aria-hidden="true">🔒</span> seal our messages
        </button>
      )}
    </div>
  );
}

/**
 * Everything the chat room adds around the chat (round 3, chat-room): its look, the Face ID lock,
 * the passphrase a fresh device needs once, sealing old messages in place, and the app-switcher
 * cover. ChatPage spreads `look` onto the .chat root (with `data-locked` while `screen` is set)
 * and renders `screen ?? overlay` inside it: `screen` covers the chat, `overlay` is the nudge.
 */
export function useChatRoom(prefs) {
  const queryClient = useQueryClient();
  const viewing = useViewingAs();
  const keys = useChatKeys();
  const look = useChatLook(prefs);
  const lock = lockPrefs(prefs);
  const lockOn = lock.on && !viewing;
  const [open, setOpen] = useState(() => !lockOn || stillOpen(lock.after));
  const [nudgeGone, setNudgeGone] = useState(false);

  // Her prefs arrived saying the lock is on (a new device, or she turned it on elsewhere): lock
  // now. Turning it on in the design sheet counts as opened (lockState.turnedOnHere).
  useEffect(() => {
    if (prefs?.lock) rememberLockLocally(prefs.lock);
    if (lockOn && open && !stillOpen(lock.after)) setOpen(false);
  }, [lockOn, open, lock.after, prefs?.lock]);

  // Leaving the chat, or the app, starts the clock; coming back checks it.
  useEffect(() => {
    if (!lockOn) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        markLeft();
        if (lock.after === 0) setOpen(false);
      } else if (!markBack(lock.after)) setOpen(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      markLeft();
    };
  }, [lockOn, lock.after]);

  // The app switcher's snapshot shows a soft cover instead of messages, and notification previews
  // stay hidden, while the lock is on.
  useEffect(() => {
    setNativePrivacy({ cover: lockOn, hidePreviews: lockOn && !lock.previews });
    return () => {
      if (lockOn) setNativePrivacy({ cover: false, hidePreviews: !lock.previews });
    };
  }, [lockOn, lock.previews]);

  // Keys arriving (the passphrase typed, Josh's key appearing) re-open what showed as locked.
  const lastStatus = useRef(keys.status);
  useEffect(() => {
    if (lastStatus.current !== "ready" && keys.status === "ready" && lastStatus.current !== "idle") {
      queryClient.invalidateQueries({ queryKey: ["me", "chat"] });
      queryClient.invalidateQueries({ queryKey: ["me", "memories"] });
    }
    lastStatus.current = keys.status;
  }, [keys.status, queryClient]);

  // Once this device can seal, whatever is still plain (or on a retired key) is sealed in place.
  useEffect(() => {
    if (keys.status !== "ready" || viewing) return;
    sealHistory()
      .then((result) => {
        if (result?.sealed) {
          queryClient.invalidateQueries({ queryKey: ["me", "chat"] });
          queryClient.invalidateQueries({ queryKey: ["me", "memories"] });
        }
      })
      .catch(() => {});
  }, [keys.status, keys.current, viewing, queryClient]);

  const unlock = () => {
    markUnlocked();
    setOpen(true);
  };

  let screen = null;
  if (lockOn && !open) screen = <LockScreen onOpen={unlock} keyLocked={keys.status === "locked"} />;
  else if (keys.status === "locked") screen = <KeyScreen />;
  const overlay = keys.status === "plain" && !keys.setUp && !viewing && !nudgeGone ? <SetUpNudge onClose={() => setNudgeGone(true)} /> : null;
  return { look, screen, overlay, lock: relock };
}
