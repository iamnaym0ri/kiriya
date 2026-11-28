import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useIsAdmin, useSession } from "../../lib/session.js";
import { useSurprises } from "../../lib/surprises.js";
import { APP_ICONS, appIconState, chooseAppIcon, enrolledDevice, haptic, isNativeApp, saveWidgetKey } from "../../lib/native.js";
import { Address, PublicProfile, Sharing } from "../settings/SettingsPage.jsx";
import MyFaves from "../settings/MyFaves.jsx";
import SongShelf from "../stage/SongShelf.jsx";
import { Group, HersOnly, Note, Row, Screen, SwitchRow } from "./parts.jsx";
import { rewrapForPassphraseChange } from "../../lib/chatCrypto.js";

// Her settings, one pushed screen each. The bigger forms (public page, songs, faves, sharing,
// address) are the website's own settings pieces, dressed for the app by MeSection.css.

/* ---------- app icon ---------- */

export function IconScreen() {
  const [state, setState] = useState({ available: false, current: null, loaded: false });
  const [message, setMessage] = useState(null);
  useEffect(() => {
    appIconState().then(
      (next) => setState({ ...next, loaded: true }),
      () => setState((s) => ({ ...s, loaded: true })),
    );
  }, []);

  async function pick(name) {
    if (!state.available) {
      setMessage("this one changes inside the app on your iPhone ♡");
      return;
    }
    if (name === state.current) return;
    try {
      await chooseAppIcon(name);
      haptic("success");
      setState((s) => ({ ...s, current: name }));
      setMessage("done ♡ your Home Screen has the new one");
    } catch {
      setMessage("that icon couldn’t be set just now. try again?");
    }
  }

  return (
    <Screen title="app icon" subtitle="the one on your Home Screen. your iPhone shows a little note when it changes.">
      <div className="app-card me-icons" role="radiogroup" aria-label="App icon">
        {APP_ICONS.map((icon) => {
          const checked = state.available ? (state.current ?? null) === icon.name : icon.name === null;
          return (
            <button key={icon.label} type="button" role="radio" aria-checked={checked} className="me-icons__choice" onClick={() => pick(icon.name)}>
              <img src={icon.preview} alt="" width="64" height="64" />
              <span>{icon.label}</span>
            </button>
          );
        })}
      </div>
      <Note>{message}</Note>
    </Screen>
  );
}

/* ---------- notifications ---------- */

const UNAVAILABLE = {
  install: "on iPhone, notifications work once kiriya lives on your Home Screen (Safari → Share → Add to Home Screen).",
  "update-ios": "notifications need iOS 16.4 or newer.",
  unsupported: "this browser can’t get notifications. your world works without them.",
  "not-configured": "notifications aren’t set up on the server yet.",
};

function HourSelect({ label, value, hours, onChange }) {
  const id = useId();
  return (
    <li className="app-row me-row">
      <label className="app-row__text" htmlFor={id}>
        <span className="me-row__label">{label}</span>
      </label>
      <select id={id} className="me-select" value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h === 12 ? "12 noon" : h > 12 ? `${h - 12} pm` : `${h} am`}
          </option>
        ))}
      </select>
    </li>
  );
}

export function NotificationsScreen() {
  const admin = useIsAdmin();
  const surprises = useSurprises();
  const { support, state, settings, ownsSettings, saveSettings, message, setMessage, busy } = surprises;
  const test = useMutation({
    mutationFn: () => api("/push/test", { method: "POST", body: {} }),
    onSuccess: () => setMessage("sent ♡ it should arrive in a few seconds."),
    onError: (error) => setMessage(error.message),
  });
  const on = state === "on";
  const save = (patch) => saveSettings.mutate({ ...settings, ...patch });

  return (
    <Screen
      title={admin ? "notifications on this phone" : "notifications"}
      short="notifications"
      subtitle={admin ? "yours, on this phone: what she sends you, and the tests you try." : "little notes, letters, the jar in the morning and his taps. every one also waits in the app, so nothing gets lost."}
    >
      {support !== "ok" ? (
        <div className="app-card">
          <p className="me-card-text">{UNAVAILABLE[support] ?? "notifications aren’t available here."}</p>
        </div>
      ) : state === "denied" ? (
        <div className="app-card">
          <p className="me-card-text">
            notifications are turned off for kiriya.love in your iPhone’s Settings. open <strong>Settings → Notifications → kiriya.love</strong>, switch on
            Allow Notifications, then come back.
          </p>
        </div>
      ) : (
        <Group note={on && !ownsSettings ? "this is a test phone: it gets the test notes, never hers. her hours stay hers." : null}>
          <SwitchRow
            icon="bell"
            tone="pink"
            label="notifications on this phone"
            hint={state === "checking" ? "checking…" : on ? "on ♡" : "off"}
            checked={on}
            disabled={busy || state === "checking"}
            onChange={(next) => (next ? surprises.turnOn() : surprises.turnOff())}
          />
          {on && (
            <Row onClick={() => test.mutate()} icon="ring" tone="lilac" label={test.isPending ? "sending…" : "send me a test"} />
          )}
        </Group>
      )}

      {on && ownsSettings && settings && (
        <Group title="little surprises" note="surprises are the extra little finds. notes and letters from him always come straight away.">
          <li className="app-row me-row">
            <span className="app-row__text">
              <span className="me-row__label">a day</span>
            </span>
            <span className="me-segments" role="radiogroup" aria-label="Surprises a day">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={settings.perDay === n} onClick={() => save({ perDay: n })}>
                  {n}
                </button>
              ))}
            </span>
          </li>
          <HourSelect label="not before" value={settings.startHour} hours={[7, 8, 9, 10, 11, 12]} onChange={(startHour) => save({ startHour })} />
          <HourSelect label="not after" value={settings.endHour} hours={[18, 19, 20, 21, 22, 23]} onChange={(endHour) => save({ endHour })} />
        </Group>
      )}
      <Note tone={saveSettings.error ? "error" : "soft"}>{saveSettings.error?.message ?? message}</Note>
    </Screen>
  );
}

/* ---------- passphrase ---------- */

/** Change the passphrase of whoever is signed in. Shared with Josh's passphrases screen. */
export function PassphraseForm() {
  const queryClient = useQueryClient();
  const role = useSession().data?.role ?? "kiriya";
  const status = useQuery({ queryKey: ["me", "passphrase"], queryFn: () => api("/me/passphrase") });
  const empty = { current: "", next: "", confirm: "", signOutOthers: true };
  const [draft, setDraft] = useState(empty);
  const change = useMutation({
    mutationFn: async () =>
      api("/me/passphrase", {
        method: "PUT",
        // The chat's key goes with it, wrapped under the new passphrase (src/lib/chatCrypto/keyring.js).
        body: { current: draft.current, next: draft.next, signOutOthers: draft.signOutOthers, keepDevice: enrolledDevice(), chatKey: await rewrapForPassphraseChange(draft.current, draft.next) },
      }),
    onSuccess: async (data) => {
      setDraft(empty);
      haptic("success");
      // This phone stays set up: its widgets get the fresh key that replaces the old one.
      if (data?.widgetKey) await saveWidgetKey(data.widgetKey, data.role).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["me", "passphrase"] });
    },
  });
  const minLength = status.data?.minLength ?? 8;
  const mismatch = draft.confirm && draft.next !== draft.confirm;
  const short = draft.next && draft.next.trim().length < minLength;
  const set = (key) => (event) => {
    setDraft({ ...draft, [key]: event.target.value });
    change.reset();
  };
  const ready = draft.current && draft.next && draft.confirm && !mismatch && !short;
  const field = (key, label, autoComplete) => (
    <li className="app-row me-row me-field">
      <label className="me-field__label" htmlFor={`pp-${key}`}>
        {label}
      </label>
      <input
        id={`pp-${key}`}
        className="me-field__input"
        type="password"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={200}
        value={draft[key]}
        onChange={set(key)}
        aria-invalid={key === "confirm" ? Boolean(mismatch) : key === "next" ? Boolean(short) : undefined}
        required
      />
    </li>
  );
  const changedOn = status.data?.custom
    ? new Date(status.data.changedAt).toLocaleDateString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <form
      className="me-passphrase"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) change.mutate();
      }}
    >
      <input type="text" name="username" autoComplete="username" value={role} readOnly hidden />
      <Group note={`${changedOn ? `you chose this one on ${changedOn}. ` : ""}at least ${minLength} characters. a few words together works well. capitals and extra spaces don’t matter.`}>
        {field("current", "current", "current-password")}
        {field("next", "new", "new-password")}
        {field("confirm", "new again", "new-password")}
      </Group>
      <Group>
        <SwitchRow
          label="sign out my other devices"
          hint="they’ll ask for the new one. this phone stays open."
          checked={draft.signOutOthers}
          onChange={(value) => setDraft({ ...draft, signOutOthers: value })}
        />
      </Group>
      {mismatch && <Note tone="error">the two new ones don’t match yet.</Note>}
      {short && !mismatch && <Note tone="soft">a little longer: at least {minLength} characters.</Note>}
      {change.error && <Note tone="error">{change.error.message}</Note>}
      {change.isSuccess && (
        <Note>
          changed ♡ this phone stays open{change.data.signedOutOthers ? "; your other devices will ask for the new one." : "."}
        </Note>
      )}
      <button type="submit" className="me-button" disabled={change.isPending || !ready}>
        {change.isPending ? "changing…" : "change passphrase"}
      </button>
    </form>
  );
}

export function PassphraseScreen() {
  const admin = useIsAdmin();
  return (
    <Screen title="your passphrase" subtitle={admin ? "yours, not hers: it opens the app as you." : isNativeApp() ? "the key to your little world. Face ID keeps opening it on this phone." : "the key to your little world."}>
      <PassphraseForm />
    </Screen>
  );
}

/* ---------- the website's own settings pieces, in a pushed screen ---------- */

export function PageScreen() {
  const hers = useIsAdmin();
  return (
    <Screen title={hers ? "her public page" : "your public page"} short="public page" className="me-screen--legacy">
      <HersOnly>
        <PublicProfile />
      </HersOnly>
    </Screen>
  );
}

export function SharingScreen() {
  return (
    <Screen title="what friends can see" short="friends can see" className="me-screen--legacy">
      <HersOnly>
        <Sharing />
      </HersOnly>
    </Screen>
  );
}

export function SongsScreen() {
  const hers = useIsAdmin();
  return (
    <Screen title={hers ? "her songs" : "your songs"} className="me-screen--legacy">
      <HersOnly line="her own song shelf: only she changes it. songs you send her go on home ♡">
        <div className="music-page settings-songs">
          <SongShelf />
        </div>
      </HersOnly>
    </Screen>
  );
}

export function FavesScreen() {
  const hers = useIsAdmin();
  return (
    <Screen title={hers ? "her faves" : "my faves"} className="me-screen--legacy">
      <HersOnly>
        <MyFaves />
      </HersOnly>
    </Screen>
  );
}

export function TalkScreen() {
  const hers = useIsAdmin();
  return (
    <Screen title={hers ? "how the app talks about her" : "how the app talks about you"} short="how it talks" className="me-screen--legacy">
      <HersOnly>
        <Address />
      </HersOnly>
    </Screen>
  );
}
