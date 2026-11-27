import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, appToken, isBundledApp } from "../lib/api.js";
import { checkForUpdate, markAppReady } from "../lib/appUpdates.js";
import { sessionKey, useSession } from "../lib/session.js";
import { appPath } from "../lib/appLinks.js";
import {
  biometryAvailable,
  canOpenWithoutFaceId,
  enrolledDevice,
  ensureWidgetKey,
  haptic,
  isFaceIdMiss,
  listenForDeepLinks,
  listenForNotifications,
  opensWithFaceId,
  refreshWidgets,
  registerForPush,
  setBadge,
  setUpThisPhone,
  setupQuickActions,
  signInToApp,
  tapFeedback,
  trackKeyboard,
} from "../lib/native.js";
import { afterOpeningBeat, holdOpening } from "./opening/index.js";
import AppSignIn, { FaceIdGlyph } from "./opening/AppSignIn.jsx";
import "./NativeApp.css";

// After this long in the background, the app asks for Face ID again.
const RELOCK_AFTER_MS = 5 * 60 * 1000;
// Queries whose changes can move the icon badge or what the widgets show.
const WATCHED = new Set(["chat", "notes", "note-jar", "letters"]);


/**
 * Runs only inside the kiriya.love iPhone app (loaded lazily from main.jsx). It:
 * - opens with Face ID first: on launch (right after the opening animation) and after five minutes
 *   away, Face ID asks by itself and goes straight in; cancelled or not matched, the passphrase
 *   screen appears with a "try Face ID again" button. With "open with Face ID" off in her tab, it
 *   signs in straight away with no prompt,
 * - asks once, after the first passphrase on a phone, how the app should open (Face ID or straight
 *   away), then asks for notifications,
 * - opens the right page from a notification, a widget (kiriyalove:// links) or an icon shortcut,
 * - keeps the icon's red badge and the Home Screen widgets in step while the app is open,
 * - tells the live updater this version started fine, and looks for a newer one on each return.
 */
export default function NativeApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = useSession();
  // This phone's own pieces (widget key, badges) follow who really signed in, even in the preview.
  const role = session.data?.realRole ?? session.data?.role ?? null;
  // The bundled app keeps its token for the life of the app (an in-app update reloads the page
  // without closing it), so only a fresh start needs Face ID.
  const [locked, setLocked] = useState(() => Boolean(enrolledDevice()) && !(isBundledApp && appToken()));
  const [status, setStatus] = useState("idle"); // idle | checking | failed
  const [miss, setMiss] = useState(null); // why the last try didn't open it: "cancelled" | "failed" | "offline"
  const [choosing, setChoosing] = useState(false); // the first-run "how should it open?" card
  const away = useRef(null);
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
          // With "open with Face ID" off in her tab, coming back never asks.
          if (enrolledDevice() && opensWithFaceId() && away.current && Date.now() - away.current > RELOCK_AFTER_MS) {
            setStatus("idle");
            setLocked(true);
          }
          checkForUpdate();
        }).then((listener) => () => listener.remove()),
      ),
    );
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);

  const unlock = useCallback(async () => {
    setStatus("checking");
    setMiss(null);
    try {
      // Face ID, or straight in when she switched it off (lib/native.js signInToApp).
      const data = await signInToApp();
      queryClient.setQueryData(sessionKey, { role: data.role });
      tapFeedback();
      setStatus("idle");
      setLocked(false);
    } catch (error) {
      // 401: the phone was forgotten (or her passphrase changed): the plain passphrase screen.
      if (error?.status === 401 || !enrolledDevice()) {
        setStatus("idle");
        setLocked(false);
        return;
      }
      setMiss(isFaceIdMiss(error) ? error.faceId : "offline");
      setStatus("failed");
    }
  }, [queryClient]);

  // Face ID asks by itself: once the opening's little scene has played (its prompt would cover the
  // scene; with no opening up, at once). Without Face ID it signs in during the scene.
  useEffect(() => {
    if (!locked || status !== "idle") return undefined;
    let live = true;
    (opensWithFaceId() ? afterOpeningBeat() : Promise.resolve()).then(() => live && unlock());
    return () => {
      live = false;
    };
  }, [locked, status, unlock]);

  // The opening stays up while Face ID (or the quiet sign-in) is deciding, so she goes from the
  // opening straight into her world, or to the passphrase screen if it didn't work.
  useEffect(() => (locked && status !== "failed" ? holdOpening("face-id") : undefined), [locked, status]);

  // The two-day session ran out while the app was open: Face ID (or, with it switched off, the
  // stored secret, silently) instead of the passphrase.
  useEffect(() => {
    if (session.isSuccess && !role && enrolledDevice()) setLocked(true);
  }, [session.isSuccess, role]);

  // Opened with the passphrase on a phone that isn't set up (first run, or after "lock kiriya on
  // this phone"): ask how it should open from now on (Face ID or straight away; "not now" asks
  // again at the next passphrase). Then notifications (re-registered every launch, because Apple
  // can change the token), and make sure the widgets have their key.
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    (async () => {
      if (!enrolledDevice()) {
        const face = await biometryAvailable().catch(() => false);
        if (!live) return;
        if (face || canOpenWithoutFaceId()) {
          setChoosing(true);
          return;
        }
      }
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

  async function chooseOpening(faceId) {
    try {
      if (faceId !== null) await setUpThisPhone({ faceId });
    } catch (error) {
      // She cancelled the scan: the choice stays up.
      if (isFaceIdMiss(error) || /cancel/i.test(String(error?.message))) return false;
      throw error;
    }
    setChoosing(false);
    haptic("success");
    if (enrolledDevice()) {
      await registerForPush({ ask: true }).catch(() => {});
      await ensureWidgetKey(role).catch(() => {});
    }
    return true;
  }

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
    // Old website paths land on the right tab (lib/appLinks.js).
    if (next.to) {
      navigate(appPath(next.to));
      return;
    }
    if (next.action === "chat") navigate("/world/chat");
    else if (next.action === "pull-note") navigate(appPath("/world#note-jar"));
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

  // The first-run choice, once she's in.
  const choice = choosing && open ? <OpenChoice onChoose={chooseOpening} /> : null;
  if (!locked) return choice;
  const quiet = !opensWithFaceId();
  if (status === "failed") {
    const line =
      miss === "offline"
        ? "couldn’t reach your little world. check the internet, then try again."
        : quiet
          ? "that didn’t quite work. try again?"
          : "Face ID didn’t open it this time.";
    return (
      <div className="native-lock" role="dialog" aria-modal="true" aria-label="Open your little world" data-ready="true">
        <AppSignIn
          line={line}
          faceId={{ label: quiet ? "try again" : "try Face ID again", onPress: () => unlock(), busy: false, quiet }}
          onUnlocked={() => {
            setStatus("idle");
            setLocked(false);
          }}
        />
      </div>
    );
  }
  // Face ID (or the quiet sign-in) at work: the opening usually covers this.
  return (
    <div className="native-lock" role="dialog" aria-modal="true" aria-labelledby="native-lock-title" data-ready="false">
      <div className="native-lock__card">
        <p className="native-lock__word" id="native-lock-title">
          kiriya<span aria-hidden="true">✦</span>
        </p>
        <p className="native-lock__line" role="status">
          opening your little world…
        </p>
      </div>
    </div>
  );
}

/**
 * Asked once on a phone, right after the first passphrase: how should the app open from now on?
 * Face ID first (recommended), or straight into her world. Either can be changed later in her
 * tab, under privacy → "open with Face ID".
 */
function OpenChoice({ onChoose }) {
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [face, setFace] = useState(null);
  useEffect(() => {
    biometryAvailable()
      .then(setFace)
      .catch(() => setFace(false));
  }, []);
  const pick = async (value) => {
    setBusy(value === null ? "later" : value ? "face" : "straight");
    setProblem(null);
    try {
      const done = await onChoose(value);
      if (!done) setBusy(null);
    } catch (error) {
      setBusy(null);
      setProblem(error?.message || "that didn’t work. try again?");
    }
  };
  return (
    <div className="native-choice" role="dialog" aria-modal="true" aria-labelledby="native-choice-title">
      <div className="native-choice__card">
        <p className="native-choice__label">one little thing</p>
        <h2 id="native-choice-title">how should kiriya open on this phone?</h2>
        <div className="native-choice__options">
          {face !== false && (
            <button type="button" className="native-choice__option native-choice__option--main" onClick={() => pick(true)} disabled={Boolean(busy) || face === null}>
              <FaceIdGlyph size={28} />
              <span>
                <strong>{busy === "face" ? "setting it up…" : "with Face ID"}</strong>
                <small>only your face opens it. it asks by itself.</small>
              </span>
            </button>
          )}
          {canOpenWithoutFaceId() && (
            <button type="button" className="native-choice__option" onClick={() => pick(false)} disabled={Boolean(busy)}>
              <span className="native-choice__heart" aria-hidden="true">♡</span>
              <span>
                <strong>{busy === "straight" ? "setting it up…" : "straight away"}</strong>
                <small>no Face ID: it opens right into your world.</small>
              </span>
            </button>
          )}
        </div>
        {problem && (
          <p className="native-choice__problem" role="alert">
            {problem}
          </p>
        )}
        <p className="native-choice__note">you can change this any time in your tab, under privacy.</p>
        <button type="button" className="native-choice__later" onClick={() => pick(null)} disabled={Boolean(busy)}>
          not now (ask for the passphrase)
        </button>
      </div>
    </div>
  );
}
