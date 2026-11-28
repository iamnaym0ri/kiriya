import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api.js";
import { chatPrefsKey } from "../../../lib/chat.js";
import { sealHistory, useChatKeys } from "../../../lib/chatCrypto.js";
import { setNativePrivacy } from "../../../lib/chatCrypto/native.js";
import { useViewingAs } from "../../../lib/session.js";
import { useChatLook } from "../theme/useChatLook.js";
import "../theme/index.js";
import "./lock.css";
import { KeyScreen, LockScreen } from "./LockScreen.jsx";
import { PassphraseForm } from "./PassphraseForm.jsx";
import { lockPrefs, markBack, markLeft, markUnlocked, relock, rememberLockLocally, stillOpen } from "./lockState.js";

/**
 * "Seal our messages": a slim bar tucked under the header (the message list starts below it, so it
 * never covers a message). It opens into the passphrase form in place; "later" hides it until the
 * chat is opened again.
 */
function SetUpNudge({ onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chat-nudge" data-open={open || undefined}>
      {open ? (
        <>
          <p>type your passphrase once and your messages get sealed end to end, on both your phones ♡</p>
          <PassphraseForm submitLabel="seal our messages" autoFocus onDone={onClose} />
          <button type="button" className="look-pill" data-quiet onClick={() => setOpen(false)}>
            not now
          </button>
        </>
      ) : (
        <>
          <button type="button" className="chat-nudge__open" onClick={() => setOpen(true)}>
            <span aria-hidden="true">🔒</span> seal our messages
          </button>
          <button type="button" className="chat-nudge__later" onClick={onClose} aria-label="Hide for now">
            later
          </button>
        </>
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
  // The theme and background are theirs together: a change on the other phone arrives live (Ably's
  // "look" event, src/lib/chat.js); without Ably, the look is read again every little while.
  useQuery({ queryKey: chatPrefsKey, queryFn: () => api("/me/chat/prefs"), refetchInterval: 20_000, refetchOnWindowFocus: true, staleTime: 10_000 });
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
  // Round 4: each person's bubbles are drawn their way on both phones, and "typing…" in the style
  // the person typing chose.
  const designs = { mine: prefs?.bubble ?? "lilac", theirs: prefs?.theirs?.bubble ?? "lilac" };
  const theirTyping = prefs?.theirs?.typing ?? "hearts";
  return { look, screen, overlay, designs, theirTyping, lock: relock };
}
