import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useIsAdmin, useLock } from "../../lib/session.js";
import { usePrefs } from "../../lib/prefs.js";
import { useSurprises } from "../../lib/surprises.js";
import {
  APP_ICONS,
  appIconState,
  enrolledDevice,
  faceIdGateState,
  haptic,
  isAppShell,
  isNativeApp,
  saveWidgetKey,
  setOpenWithFaceId,
} from "../../lib/native.js";
import { usePlayful } from "../../shared/play/PlayfulWorld.jsx";
import { Credits } from "../../shared/WorldPrimitives.jsx";
import { EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import ProfileCard from "./ProfileCard.jsx";
import { StickerBook } from "../play/Stickers.jsx";
import { usePlayState } from "../play/playState.js";
import MeetCard from "./MeetCard.jsx";
import AdminDesk from "./AdminDesk.jsx";
import { companionLabel } from "./CharacterScreen.jsx";
import { Group, Note, Row, SwitchRow, useTabName } from "./parts.jsx";

/* global __APP_BUNDLE_VERSION__ */
const VERSION = typeof __APP_BUNDLE_VERSION__ === "string" ? __APP_BUNDLE_VERSION__ : "dev";

// Old settings links (/world/settings#passphrase, now /world/me#passphrase) open their screen.
const ANCHORS = {
  passphrase: "passphrase",
  songs: "songs",
  "public-profile": "page",
  sharing: "sharing",
  surprises: "notifications",
  "app-icon": "icon",
  widget: "widgets",
  faves: "faves",
};

function useIconName() {
  const [name, setName] = useState(null);
  useEffect(() => {
    let live = true;
    appIconState()
      .then((state) => live && state.available && setName(APP_ICONS.find((icon) => icon.name === (state.current ?? null))?.label ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return name;
}

const NOTIFY_DETAIL = { on: "on", off: "off", denied: "off", checking: "", unavailable: "" };

/** "Sign out my other devices": every other phone and browser asks again; this one stays. */
function SignOutOthersSheet({ open, onClose }) {
  const [done, setDone] = useState(false);
  const run = useMutation({
    mutationFn: () => api("/me/passphrase/sign-out-others", { method: "POST", body: { keepDevice: enrolledDevice() } }),
    onSuccess: async (data) => {
      if (data?.widgetKey) await saveWidgetKey(data.widgetKey, data.role).catch(() => {});
      setDone(true);
    },
  });
  useEffect(() => {
    if (open) setDone(false);
  }, [open]);
  return (
    <EditSheet
      open={open}
      title="other devices"
      onClose={onClose}
      onSave={done ? undefined : () => run.mutateAsync().then(() => false)}
      saveLabel="Sign out"
    >
      {done ? (
        <p className="me-sheet-text" role="status">
          done ♡ every other phone and browser will ask for your passphrase again. this one stays open.
        </p>
      ) : (
        <p className="me-sheet-text">
          every other phone, tablet or browser that’s open to your world will ask for your passphrase again. this
          phone stays open, and its widgets keep working.
        </p>
      )}
    </EditSheet>
  );
}

const cancelled = (error) => /cancel/i.test(error?.message ?? "") || error?.code === "16";

/**
 * "Open with Face ID", on this phone only (Josh, 2026-11-27: "she can just open the app"). Off: the
 * app opens straight into her world. Switching it off is confirmed once with Face ID, or with her
 * passphrase where Face ID isn't there; on, it checks Face ID works first (lib/native.js).
 */
function FaceIdRow() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [asking, setAsking] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  useEffect(() => {
    faceIdGateState()
      .then(setState)
      .catch(() => setState({ available: false, on: true }));
  }, []);
  if (!isAppShell()) return null;

  const done = async (on) => {
    haptic("success");
    setState(await faceIdGateState());
    setMessage(on ? "Face ID opens it again ♡" : "it opens straight into your world now ♡");
  };
  async function change(on) {
    setBusy(true);
    setMessage(null);
    try {
      await setOpenWithFaceId(on);
      await done(on);
    } catch (error) {
      if (error?.code === "needs_passphrase") {
        setPassphrase("");
        setAsking(true);
      } else if (!cancelled(error)) setMessage(error?.message ?? "that didn’t work. try again?");
    } finally {
      setBusy(false);
    }
  }

  const available = Boolean(state?.available);
  const on = state?.on ?? true;
  const hint = !state
    ? ""
    : !available
      ? isNativeApp()
        ? "needs the newest version of the app"
        : "works inside the app on your iPhone"
      : on
        ? "Face ID opens the app on this phone"
        : "this phone opens straight into your world";
  return (
    <>
      <SwitchRow
        icon="faceid"
        tone="mint"
        label="open with Face ID"
        hint={hint}
        checked={on}
        disabled={!available || busy || (!on && !state.biometry)}
        onChange={change}
      />
      {message && (
        <li className="app-row me-row me-row--note">
          <span className="app-row__text">
            <small role="status">{message}</small>
          </span>
        </li>
      )}
      <EditSheet
        open={asking}
        title="open without Face ID"
        onClose={() => setAsking(false)}
        saveLabel="Confirm"
        saveDisabled={!passphrase}
        onSave={async () => {
          await setOpenWithFaceId(false, { passphrase });
          await done(false);
        }}
      >
        <p className="me-sheet-text">Face ID isn’t set up on this phone, so your passphrase confirms it’s you. after this the app opens straight away.</p>
        <EditField label="your passphrase">
          <input type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
        </EditField>
      </EditSheet>
    </>
  );
}

function LockSheet({ open, onClose }) {
  const lock = useLock();
  const navigate = useNavigate();
  return (
    <EditSheet
      open={open}
      title="lock it"
      onClose={onClose}
      saveLabel="Lock"
      onSave={() => lock.mutateAsync().then(() => navigate("/"))}
    >
      <p className="me-sheet-text">
        {isNativeApp()
          ? "your world closes on this phone. next time your passphrase opens it, and you can choose Face ID again."
          : "your world closes on this device until your passphrase opens it again."}
      </p>
    </EditSheet>
  );
}

/** Her settings, grouped like the iPhone's own, in lilac. Josh sees the same (as his test copy). */
function HerSettings({ admin }) {
  const prefs = usePrefs();
  const surprises = useSurprises();
  const { paused, reduced, toggle } = usePlayful();
  const icon = useIconName();
  const [sheet, setSheet] = useState(null);
  const [credits, setCredits] = useState(false);
  const companion = prefs.data ? companionLabel(prefs.data.companion) : "";
  // Her sticker book (games and the little drawer give them out): it lives here since play's header
  // lost its button.
  const play = usePlayState();
  const stickers = play.data?.collected?.length ?? 0;

  return (
    <>
      <Group title={admin ? "her app · your test copy" : "your app"} note={admin ? "these change your own phone and your own copy, so you can try everything she can. she picks hers on her phone." : null}>
        <Row to="/world/me/icon" icon="icon" tone="lilac" label="app icon" detail={icon ?? ""} />
        <Row to="/world/me/companion" icon="friend" tone="mint" label="your companion" detail={companion} />
        <Row to="/world/me/notifications" icon="bell" tone="pink" label="notifications" detail={NOTIFY_DETAIL[surprises.state] ?? ""} />
        <SwitchRow
          icon="sparkle"
          tone="butter"
          label="little animations"
          hint={reduced ? "your iPhone has reduce motion on" : paused ? "everything’s resting" : "the ribbon and little things drift about"}
          checked={!paused && !reduced}
          disabled={reduced}
          onChange={() => toggle()}
        />
        <Row to="/world/me/widgets" icon="widgets" tone="sky" label="home screen widgets" />
      </Group>

      <Group title={admin ? "her page · your test copy" : "your page"}>
        <Row to="/world/me/page" icon="page" tone="lilac" label="your public page" hint="bio, socials, intro song" />
        <Row to="/world/me/sharing" icon="eye" tone="sky" label="what friends can see" />
        <Row to="/world/me/songs" icon="music" tone="pink" label="your songs" />
        <Row to="/world/me/faves" icon="heart" tone="peach" label="my faves" />
        <Row to="/world/me/talk" icon="speech" tone="mint" label="how the app talks about you" />
      </Group>

      <Group title={admin ? "her things" : "your things"}>
        <Row to="/world/letters" icon="letter" tone="pink" label="letters & your birthday gift" />
        <Row to="/world/memories" icon="photo" tone="peach" label="our memories" />
        <Row onClick={() => setSheet("stickers")} icon="sticker" tone="mint" label="sticker book" detail={stickers ? String(stickers) : ""} />
        <Row to="/world/saves" icon="bookmark" tone="lilac" label="your saves" />
        <Row to="/world/merch" icon="bag" tone="butter" label="the merch shelf" />
        <Row to="/?view=public" icon="eye" tone="sky" label="see your page like friends do" />
      </Group>

      <Group title="privacy">
        <FaceIdRow />
        <Row to="/world/me/passphrase" icon="key" tone="lilac" label={admin ? "your passphrase" : "change your passphrase"} />
        <Row onClick={() => setSheet("others")} icon="phones" tone="sky" label="sign out my other devices" />
      </Group>

      <Group>
        <Row onClick={() => setCredits(true)} icon="palette" tone="peach" label="art & credits" more />
        <Row onClick={() => setSheet("lock")} icon="lock" tone="plum" label={`lock kiriya${isNativeApp() ? " on this phone" : ""}`} danger />
      </Group>

      <footer className="me-foot">
        <span className="me-foot__line">a little world, entirely yours.</span>
        <span>made with love ♡ · {VERSION}</span>
      </footer>

      <SignOutOthersSheet open={sheet === "others"} onClose={() => setSheet(null)} />
      <LockSheet open={sheet === "lock"} onClose={() => setSheet(null)} />
      <StickerBook open={sheet === "stickers"} onClose={() => setSheet(null)} state={play.data} admin={admin} />
      {credits && <Credits onClose={() => setCredits(false)} />}
    </>
  );
}

export default function MeHome() {
  const admin = useIsAdmin();
  const name = useTabName();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const screen = ANCHORS[location.hash.slice(1)];
    if (screen) navigate(`/world/me/${screen}`, { replace: true });
  }, [location.hash, navigate]);

  // Josh's tab reads her jar's waiting count for its row (cheap, and refreshed on focus).
  const jar = useQuery({ queryKey: ["admin", "note-jar"], queryFn: () => api("/admin/note-jar"), enabled: admin, staleTime: 30_000 });

  return (
    <div className="app-section app-section--me me-home">
      <header className="app-section__head">
        <h1 className="app-section__title">{name}</h1>
        {admin && <p className="app-section__subtitle">her app as she sees it, plus your desk ♡</p>}
      </header>
      <div className="app-section__body">
        <ProfileCard />
        <MeetCard />
        {admin && <AdminDesk jar={jar.data} />}
        <HerSettings admin={admin} />
      </div>
    </div>
  );
}
