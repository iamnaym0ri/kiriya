import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, appToken, isBundledApp } from "../lib/api.js";
import { checkForUpdate, markAppReady } from "../lib/appUpdates.js";
import { forgetSession, sessionKey, useSession } from "../lib/session.js";
import {
  enrolledDevice,
  enrollThisPhone,
  ensureWidgetKey,
  haptic,
  listenForDeepLinks,
  listenForNotifications,
  refreshWidgets,
  registerForPush,
  setBadge,
  setupQuickActions,
  signInWithFaceId,
  tapFeedback,
  trackKeyboard,
} from "../lib/native.js";
import "./NativeApp.css";

// After this long in the background, the app asks for Face ID again.
const RELOCK_AFTER_MS = 5 * 60 * 1000;
// Queries whose changes can move the icon badge or what the widgets show.
const WATCHED = new Set(["chat", "notes", "note-jar", "letters"]);

/**
 * Runs only inside the kiriya.love iPhone app (loaded lazily from main.jsx). It:
 * - covers everything with a Face ID screen on launch and after five minutes away,
 * - sets Face ID up the first time the passphrase opens the app, then asks for notifications,
 * - opens the right page from a notification, a widget (kiriyalove:// links) or an icon shortcut,
 * - keeps the icon's red badge and the Home Screen widgets in step while the app is open,
 * - tells the live updater this version started fine, and looks for a newer one on each return.
 */
export default function NativeApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = useSession();
  const role = session.data?.role ?? null;
  // The bundled app keeps its token for the life of the app (an in-app update reloads the page
  // without closing it), so only a fresh start needs Face ID.
  const [locked, setLocked] = useState(() => Boolean(enrolledDevice()) && !(isBundledApp && appToken()));
  const [status, setStatus] = useState("idle"); // idle | checking | failed
  const away = useRef(null);
  const passphraseChosen = useRef(false);
  // Where a notification, widget or shortcut asked to go, held until the app is open.
  const [pending, setPending] = useState(null);
  const open = role && !locked;

  useEffect(() => {
    markAppReady();
    const cleanups = [];
    const keep = (promise) => promise.then((cleanup) => cleanups.push(cleanup)).catch(() => {});
    listenForNotifications((to) => setPending({ to })).catch(() => {});
    keep(listenForDeepLinks((to) => setPending({ to })));
    keep(setupQuickActions((id) => setPending({ action: id })));
    keep(trackKeyboard());
    keep(
      import("@capacitor/app").then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) {
            away.current = Date.now();
            return;
          }
          if (enrolledDevice() && away.current && Date.now() - away.current > RELOCK_AFTER_MS) setLocked(true);
          checkForUpdate();
        }).then((listener) => () => listener.remove()),
      ),
    );
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);

  const unlock = useCallback(async () => {
    setStatus("checking");
    try {
      const data = await signInWithFaceId();
      queryClient.setQueryData(sessionKey, { role: data.role });
      tapFeedback();
      setStatus("idle");
      setLocked(false);
    } catch (error) {
      // 401: the phone was forgotten (or her passphrase changed): back to the passphrase.
      if (error?.status === 401 || !enrolledDevice()) {
        setStatus("idle");
        setLocked(false);
      } else setStatus("failed");
    }
  }, [queryClient]);

  useEffect(() => {
    if (locked && status === "idle") unlock();
  }, [locked, status, unlock]);

  // The two-day session ran out while the app was open: Face ID instead of the passphrase.
  useEffect(() => {
    if (session.isSuccess && !role && enrolledDevice() && !passphraseChosen.current) setLocked(true);
    if (role) passphraseChosen.current = false;
  }, [session.isSuccess, role]);

  // Opened with the passphrase: set up Face ID once, then notifications (re-registered every launch,
  // because Apple can change the token), and make sure the widgets have their key.
  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      if (!enrolledDevice()) await enrollThisPhone().catch(() => false);
      if (live && enrolledDevice()) {
        await registerForPush({ ask: true }).catch(() => {});
        await ensureWidgetKey(role).catch(() => {});
      }
    })();
    checkForUpdate();
    return () => {
      live = false;
    };
  }, [open, role]);

  // The red badge and the widgets follow what's unread: on opening, on every return, and whenever
  // chat, notes or the jar change on screen.
  useEffect(() => {
    if (!open) return;
    let timer;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        api("/app/unread")
          .then((totals) => setBadge(totals.total))
          .catch(() => {});
        refreshWidgets();
      }, 1200);
    };
    sync();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (event.type === "updated" && event.action?.type === "success" && key[0] === "me" && WATCHED.has(key[1])) sync();
    });
    let listener;
    import("@capacitor/app")
      // Leaving the app refreshes the widgets at once (a note just opened shows open on the Home Screen).
      .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => (isActive ? sync() : refreshWidgets({ force: true }))))
      .then((handle) => (listener = handle))
      .catch(() => {});
    return () => {
      clearTimeout(timer);
      unsubscribe();
      listener?.remove();
    };
  }, [open, queryClient]);

  // Follow the notification, widget or shortcut once the app is open.
  // On a cold start the app begins on the front page, which sends a signed-in visitor to /world in
  // the same moment Face ID opens the app; wait for that, or it would win over the notification's page.
  // (Admin previewing the public page stays there, so that case goes ahead.)
  const onFrontPage = location.pathname === "/" && new URLSearchParams(location.search).get("view") !== "public";
  useEffect(() => {
    if (!open || !pending || onFrontPage) return;
    const next = pending;
    setPending(null);
    if (next.to) {
      navigate(next.to);
      return;
    }
    if (next.action === "chat") navigate("/world/chat");
    else if (next.action === "pull-note") navigate("/world#note-jar");
    else if (next.action === "heart") {
      const clientId = `q-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      api("/me/chat/messages", { method: "POST", body: { clientId, kind: "tap", body: "thinking" } })
        .then(() => {
          haptic("success");
          queryClient.invalidateQueries({ queryKey: ["me", "chat"] });
        })
        .catch(() => haptic("warning"));
      navigate("/world/chat");
    }
  }, [open, pending, onFrontPage, navigate, queryClient]);

  async function usePassphrase() {
    passphraseChosen.current = true;
    await api("/session/lock", { method: "POST", body: {} }).catch(() => {});
    await forgetSession(queryClient);
    setStatus("idle");
    setLocked(false);
  }

  if (!locked) return null;
  return (
    <div className="native-lock" role="dialog" aria-modal="true" aria-labelledby="native-lock-title">
      <div className="native-lock__card">
        <p className="native-lock__word" id="native-lock-title">
          kiriya<span aria-hidden="true">✦</span>
        </p>
        <p className="native-lock__line">
          {status === "checking" ? "opening your little world…" : status === "failed" ? "that didn’t quite work. try again?" : "your little world is right here ♡"}
        </p>
        <button className="button-plum native-lock__face" onClick={() => unlock()} disabled={status === "checking"}>
          {status === "checking" ? "checking…" : "Open with Face ID"}
        </button>
        <button className="text-link native-lock__other" onClick={usePassphrase}>
          use the passphrase instead
        </button>
      </div>
    </div>
  );
}
