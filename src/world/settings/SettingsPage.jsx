import { useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useLock, useSession } from "../../lib/session.js";
import { usePrefs, useSetPrefs } from "../../lib/prefs.js";
import { todayKey } from "../../lib/world.js";
import { useSurprises } from "../../lib/surprises.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import MyFaves from "./MyFaves.jsx";
import "./SettingsPage.css";

function InstallGuide() {
  return (
    <ol className="install">
      <li>
        <span className="install__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
            <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
          </svg>
        </span>
        Open this page in Safari and tap the <strong>Share</strong> button.
      </li>
      <li>
        <span className="install__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </span>
        Scroll down and choose <strong>Add to Home Screen</strong>. Keep “Open
        as Web App” switched on.
      </li>
      <li>
        <span className="install__icon install__icon--app" aria-hidden="true">
          <img src="/icons/icon-192.png" alt="" />
        </span>
        Open <strong>kiriya</strong> from your Home Screen, unlock it, and
        come back to this page.
      </li>
    </ol>
  );
}

function Sharing() {
  const prefs = usePrefs();
  const setPrefs = useSetPrefs();
  const role = useSession().data?.role;
  // Switches answer the tap straight away; the saved value takes over once it's back.
  const [pending, setPending] = useState({});
  const data = prefs.data;
  if (!data) return null;
  const isOn = (key) => pending[key] ?? data.sharing[key];
  const shown = data.sharingLabels.filter((item) => isOn(item.key));
  return (
    <section className="settings-card" id="sharing" aria-labelledby="sharing-title">
      <div className="settings-card__head">
        <MaomaoMascot expression={shown.length ? "happy" : "deadpan"} size={64} />
        <div>
          <h2 id="sharing-title">What your friends can see</h2>
          <p className="settings-card__hint">
            Your public profile can show how you are right now. Everything else in your world stays
            behind your passphrase.{role === "admin" ? " (Admin: these are your test choices, not Kiriya’s.)" : ""}
          </p>
        </div>
      </div>
      <div className="settings-toggles">
        {data.sharingLabels.map((item) => (
          <label key={item.key} className="settings-toggle">
            <input
              type="checkbox"
              role="switch"
              checked={isOn(item.key)}
              onChange={(e) => {
                const value = e.target.checked;
                setPending((current) => ({ ...current, [item.key]: value }));
                setPrefs.mutate(
                  { sharing: { [item.key]: value } },
                  { onSettled: () => setPending(({ [item.key]: _done, ...rest }) => rest) },
                );
              }}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="settings-card__hint">
        {shown.length
          ? `Visitors see ${shown.map((item) => item.label.replace(/^Your /, "your ").replace(/^How /, "how ")).join(", ")}, and it updates whenever you change your little corner.`
          : "Right now visitors only see your usual profile."}{" "}
        Pinned doodles: {data.pins.length} of {data.maxPins}. Pin one from your gallery.
      </p>
      <div className="settings-card__row">
        <Link className="btn btn--soft btn--small" to="/?view=public">
          See it like your friends do
        </Link>
        {setPrefs.error && <span className="settings-card__message">{setPrefs.error.message}</span>}
      </div>
    </section>
  );
}

function Passphrase() {
  const queryClient = useQueryClient();
  const role = useSession().data?.role ?? "kiriya";
  const id = useId();
  const status = useQuery({ queryKey: ["me", "passphrase"], queryFn: () => api("/me/passphrase") });
  const [draft, setDraft] = useState({ current: "", next: "", confirm: "", signOutOthers: true });
  const change = useMutation({
    mutationFn: () =>
      api("/me/passphrase", {
        method: "PUT",
        body: { current: draft.current, next: draft.next, signOutOthers: draft.signOutOthers },
      }),
    onSuccess: () => {
      setDraft({ current: "", next: "", confirm: "", signOutOthers: true });
      queryClient.invalidateQueries({ queryKey: ["me", "passphrase"] });
    },
  });
  const signOutOthers = useMutation({
    mutationFn: () => api("/me/passphrase/sign-out-others", { method: "POST", body: {} }),
  });
  const minLength = status.data?.minLength ?? 8;
  const mismatch = draft.confirm && draft.next !== draft.confirm;
  const set = (key) => (e) => {
    setDraft({ ...draft, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
    change.reset();
  };
  return (
    <form
      className="settings-card"
      id="passphrase"
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) change.mutate();
      }}
    >
      <h2 id={`${id}-title`}>Your passphrase</h2>
      <p className="settings-card__hint">
        {status.data?.custom
          ? `You chose this one on ${new Date(status.data.changedAt).toLocaleDateString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "long", year: "numeric" })}.`
          : "The key to your little world. Change it whenever you like."}{" "}
        Capitals and extra spaces don’t matter.
      </p>
      <input type="text" name="username" autoComplete="username" value={role} readOnly hidden />
      <div className="settings-grid settings-grid--one">
        <label>
          <span>Current passphrase</span>
          <input className="field" type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false} maxLength={200} value={draft.current} onChange={set("current")} required />
        </label>
        <label>
          <span>New passphrase (at least {minLength} characters)</span>
          <input className="field" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} minLength={minLength} maxLength={200} value={draft.next} onChange={set("next")} required />
        </label>
        <label>
          <span>New passphrase again</span>
          <input className="field" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={200} value={draft.confirm} onChange={set("confirm")} aria-invalid={Boolean(mismatch)} required />
        </label>
      </div>
      <label className="settings-check">
        <input type="checkbox" checked={draft.signOutOthers} onChange={set("signOutOthers")} />
        Sign out my other devices too
      </label>
      {mismatch && <p className="settings-card__message" role="alert">The two new passphrases don’t match yet.</p>}
      {change.error && <p className="settings-card__message" role="alert">{change.error.message}</p>}
      {change.isSuccess && (
        <p className="status-pill status-pill--on" role="status">
          Changed. This device stays unlocked{change.data.signedOutOthers ? "; other devices will ask for the new one." : "."}
        </p>
      )}
      <div className="settings-card__row">
        <button type="submit" className="btn btn--primary btn--small" disabled={change.isPending || !draft.current || !draft.next || Boolean(mismatch)}>
          {change.isPending ? "Changing…" : "Change passphrase"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={signOutOthers.isPending}
          onClick={() => {
            if (window.confirm("Sign out every other device? They’ll need your passphrase again.")) signOutOthers.mutate();
          }}
        >
          {signOutOthers.isPending ? "Signing out…" : signOutOthers.isSuccess ? "Other devices signed out ♡" : "Sign out my other devices"}
        </button>
      </div>
      {signOutOthers.error && <p className="settings-card__message">{signOutOthers.error.message}</p>}
    </form>
  );
}

function copyText(text) {
  return navigator.clipboard?.writeText(text) ?? Promise.reject(new Error("Copying isn’t available here."));
}

function Steps({ items }) {
  return (
    <ol className="widget-steps">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function PhoneWidget() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ["me", "device-keys"], queryFn: () => api("/me/device-keys") });
  // Loaded ahead of the tap: Safari only allows copying straight from the tap, not after a request.
  const script = useQuery({ queryKey: ["me", "widget-script"], queryFn: () => api("/me/widget-script"), staleTime: Infinity });
  const [label, setLabel] = useState("my iPhone");
  const [made, setMade] = useState(null);
  const [copied, setCopied] = useState(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["me", "device-keys"] });
  const make = useMutation({
    mutationFn: () => api("/me/device-keys", { method: "POST", body: { label } }),
    onSuccess: (data) => {
      setMade(data);
      setCopied(null);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (id) => api(`/me/device-keys/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      if (made?.id === id) setMade(null);
      refresh();
    },
  });
  const site = (keys.data?.site ?? "https://kiriya.love").replace(/\/$/, "");
  const header = <>a header named <code>Authorization</code> whose value is <code>Bearer</code>, a space, then your key</>;

  async function copy(kind) {
    try {
      if (kind === "key") await copyText(made.key);
      else if (!script.data) throw new Error("The widget script is still loading.");
      else await copyText(script.data.script.replace(script.data.placeholder, made.key));
      setCopied(kind);
    } catch (error) {
      setCopied(`error:${error.message}`);
    }
  }

  return (
    <section className="settings-card" id="widget" aria-labelledby="widget-title">
      <div className="settings-card__head">
        <MaomaoMascot expression="conspiratorial" size={64} />
        <div>
          <h2 id="widget-title">Widget & one-tap buttons</h2>
          <p className="settings-card__hint">
            iPhones don’t let websites make widgets, so these borrow two apps: <strong>Shortcuts</strong> (already on
            your phone) for one-tap mood and battery buttons, and <strong>Scriptable</strong> (free) for a widget
            showing how you are and your newest note. Both use a private key instead of your passphrase.
          </p>
        </div>
      </div>

      {made ? (
        <div className="widget-key" role="status">
          <p className="settings-card__lead">Your key for “{made.label}”. Copy it now; it won’t be shown again.</p>
          <code className="widget-key__value">{made.key}</code>
          <div className="settings-card__row">
            <button type="button" className="btn btn--primary btn--small" onClick={() => copy("script")}>
              {copied === "script" ? "Widget script copied ♡" : "Copy widget script"}
            </button>
            <button type="button" className="btn btn--soft btn--small" onClick={() => copy("key")}>
              {copied === "key" ? "Key copied ♡" : "Copy key"}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setMade(null)}>
              Done
            </button>
          </div>
          {copied?.startsWith("error:") && <p className="settings-card__message">{copied.slice(6)} Press and hold the key to copy it.</p>}
        </div>
      ) : (
        <form
          className="settings-card__row"
          onSubmit={(e) => {
            e.preventDefault();
            make.mutate();
          }}
        >
          <input className="field widget-key__label" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} aria-label="Name this key" />
          <button type="submit" className="btn btn--primary btn--small" disabled={!label.trim() || make.isPending}>
            {make.isPending ? "Making…" : "Make a widget key"}
          </button>
        </form>
      )}
      {make.error && <p className="settings-card__message">{make.error.message}</p>}

      {keys.data?.keys.length > 0 && (
        <ul className="widget-keys">
          {keys.data.keys.map((key) => (
            <li key={key.id}>
              <span>
                <strong>{key.label}</strong>
                <small>
                  {key.lastUsedAt
                    ? `last used ${new Date(key.lastUsedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" })}`
                    : "not used yet"}
                </small>
              </span>
              <button type="button" className="btn btn--ghost btn--small" disabled={revoke.isPending} onClick={() => revoke.mutate(key.id)}>
                Turn off
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="widget-guide">
        <summary>One-tap buttons with Shortcuts</summary>
        <Steps
          items={[
            <>Open <strong>Shortcuts</strong>, tap <strong>+</strong> and name it “my little status”.</>,
            <>Add <strong>Get Contents of URL</strong> with <code>{site}/api/widget/menu</code>. Under Headers, add {header}.</>,
            <>Add <strong>Get Dictionary Value</strong> for the key <code>choices</code>, then <strong>Choose from List</strong>.</>,
            <>Add <strong>Get Contents of URL</strong> with <code>{site}/api/widget/status</code>. Method <strong>PUT</strong>, the same header, Request Body <strong>JSON</strong> with a text field <code>pick</code> set to <strong>Chosen Item</strong>.</>,
            <>Add <strong>Get Dictionary Value</strong> for <code>message</code>, then <strong>Show Notification</strong>.</>,
            <>Hold your Home Screen → Edit → Add Widget → <strong>Shortcuts</strong>, and choose it. It can also live in Control Center or on your Lock Screen.</>,
            <>For your newest note: a shortcut with <strong>Get Contents of URL</strong> <code>{site}/api/widget/note</code> (same header), <strong>Get Dictionary Value</strong> <code>text</code>, then <strong>Show Result</strong>.</>,
          ]}
        />
      </details>
      <details className="widget-guide">
        <summary>A widget with Scriptable</summary>
        <Steps
          items={[
            <>Install <strong>Scriptable</strong> from the App Store (it’s free).</>,
            <>Make a key above, tap <strong>Copy widget script</strong>, then in Scriptable tap <strong>+</strong>, paste, and name it “kiriya”.</>,
            <>Hold your Home Screen → Edit → Add Widget → <strong>Scriptable</strong>. Pick a size, tap the new widget and set Script to <strong>kiriya</strong>.</>,
            <>On the Lock Screen: Customize → add a Scriptable widget → Script <strong>kiriya</strong>.</>,
            <>It refreshes on its own every so often (iOS decides exactly when). Tapping it opens Safari, not the Home Screen app.</>,
          ]}
        />
      </details>
      {keys.error && <p className="settings-card__message">{keys.error.message}</p>}
    </section>
  );
}

const UNAVAILABLE = {
  "update-ios": "Notifications need iOS 16.4 or newer. Update your iPhone in Settings → General → Software Update, then open kiriya from your Home Screen again.",
  unsupported: "This browser can’t receive notifications. Your world works without them.",
  "not-configured": "Notifications aren’t set up on the server yet. Your world works without them.",
};

function Surprises() {
  const surprises = useSurprises();
  const { support, state, settings, ownsSettings, saveSettings, message, setMessage, busy } = surprises;
  const test = useMutation({
    mutationFn: () => api("/push/test", { method: "POST", body: {} }),
    onSuccess: () => setMessage("Sent. It should arrive in a few seconds."),
    onError: (error) => setMessage(error.message),
  });

  return (
    <section className="settings-card" id="surprises" aria-labelledby="surprises-title">
      <div className="settings-card__head">
        <MaomaoMascot
          expression={state === "on" ? "happy" : "sparkle"}
          size={64}
        />
        <div>
          <h2 id="surprises-title">Notes & surprises on your phone</h2>
          <p className="settings-card__hint">
            Little notes, new letters and discoveries from your collections. Every
            note also waits in your world, so nothing gets lost.
          </p>
        </div>
      </div>

      {support === "install" ? (
        <>
          <p className="settings-card__lead">
            On iPhone, notifications work once kiriya lives on your Home Screen:
          </p>
          <InstallGuide />
        </>
      ) : UNAVAILABLE[support] ? (
        <p className="settings-card__lead">{UNAVAILABLE[support]}</p>
      ) : state === "denied" ? (
        <p className="settings-card__lead">
          Notifications are blocked for kiriya. Turn them back on in your
          iPhone’s Settings → Notifications → kiriya, then reopen the app.
        </p>
      ) : state === "on" ? (
        <div className="settings-card__row">
          <span className="status-pill status-pill--on">On for this phone</span>
          <button
            type="button"
            className="btn btn--soft btn--small"
            onClick={() => test.mutate()}
            disabled={test.isPending}
          >
            {test.isPending ? "Sending…" : "Send a test"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={surprises.turnOff}
            disabled={busy}
          >
            Turn off
          </button>
        </div>
      ) : (
        <>
          <p className="settings-card__lead">
            Tap below, then choose <strong>Allow</strong>. Your iPhone only lists kiriya
            under Settings → Notifications after this.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={surprises.turnOn}
            disabled={busy}
          >
            {busy ? "Asking your phone…" : "Turn on notifications"}
          </button>
        </>
      )}
      {message && <p className="settings-card__message" role="alert">{message}</p>}

      {state === "on" && !ownsSettings && (
        <p className="settings-card__hint">
          This is a test phone: it gets notes sent to “my test devices”, never Kiriya’s.
          Her notification hours stay hers. (Unlocked with her passphrase, this phone would
          become one of hers.)
        </p>
      )}
      {state === "on" && ownsSettings && (
        <p className="settings-card__hint">This phone gets your notes, new letters and surprises.</p>
      )}
      {settings && state === "on" && ownsSettings && (
        <div className="settings-grid">
          <label>
            <span>Surprises a day</span>
            <select
              className="field"
              value={settings.perDay}
              onChange={(e) =>
                saveSettings.mutate({
                  ...settings,
                  perDay: Number(e.target.value),
                })
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            <span>Not before</span>
            <select
              className="field"
              value={settings.startHour}
              onChange={(e) =>
                saveSettings.mutate({
                  ...settings,
                  startHour: Number(e.target.value),
                })
              }
            >
              {[7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Not after</span>
            <select
              className="field"
              value={settings.endHour}
              onChange={(e) =>
                saveSettings.mutate({
                  ...settings,
                  endHour: Number(e.target.value),
                })
              }
            >
              {[18, 19, 20, 21, 22, 23].map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {saveSettings.error && (
        <p className="settings-card__message">{saveSettings.error.message}</p>
      )}
    </section>
  );
}

function Address() {
  const queryClient = useQueryClient();
  const address = useQuery({
    queryKey: ["me", "address"],
    queryFn: () => api("/me/address"),
  });
  const save = useMutation({
    mutationFn: (body) => api("/me/address", { method: "PUT", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "address"] });
      queryClient.invalidateQueries({ queryKey: ["me", "mood"] });
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });
  if (!address.data) return null;
  return (
    <section className="settings-card" aria-labelledby="address-title">
      <h2 id="address-title">How the site talks about you</h2>
      <p className="settings-card__hint">
        Your saved address preferences. Only you see these.
      </p>
      <div className="settings-grid settings-grid--two">
        {address.data.moods.map((mood) => (
          <label key={mood.key}>
            <span>{mood.label}</span>
            <select
              className="field"
              value={mood.current}
              onChange={(e) =>
                save.mutate({ mood: mood.key, address: e.target.value })
              }
            >
              {address.data.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

const lines = (text) => text.split("\n").map((line) => line.trim()).filter(Boolean);

function PublicProfile() {
  const queryClient = useQueryClient();
  const role = useSession().data?.role;
  const profile = useQuery({ queryKey: ["me", "profile"], queryFn: () => api("/me/profile") });
  const songs = useQuery({ queryKey: ["me", "songs"], queryFn: () => api("/me/songs") });
  const [draft, setDraft] = useState(null);
  const save = useMutation({
    mutationFn: (body) => api("/me/profile", { method: "PUT", body }),
    onSuccess: (data) => {
      queryClient.setQueryData(["me", "profile"], data);
      queryClient.invalidateQueries({ queryKey: ["me", "public-preview"] });
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    },
  });

  useEffect(() => {
    if (profile.data && !draft)
      setDraft({
        bio: profile.data.bioLines.join("\n"),
        tiktok: profile.data.socials.tiktok,
        instagram: profile.data.socials.instagram,
        loves: profile.data.loves.join("\n"),
        introSong: profile.data.introSong,
        showViews: profile.data.showViews,
      });
  }, [profile.data, draft]);

  if (!draft) return null;
  const limits = profile.data.limits;
  const update = (key) => (e) => {
    setDraft({ ...draft, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
    save.reset();
  };
  const shelf = songs.data?.songs ?? [];
  const featured = shelf.find((song) => song.featured);
  const chosen = draft.introSong === "featured" ? featured : shelf.find((song) => song.id === draft.introSong);

  function submit(event) {
    event.preventDefault();
    save.mutate({
      bioLines: lines(draft.bio),
      socials: { tiktok: draft.tiktok, instagram: draft.instagram },
      loves: lines(draft.loves),
      introSong: draft.introSong,
      showViews: draft.showViews,
    });
  }

  return (
    <form className="settings-card" id="public-profile" aria-labelledby="profile-title" onSubmit={submit}>
      <h2 id="profile-title">Your public page</h2>
      <p className="settings-card__hint">
        this is what anyone sees at kiriya.love before the passphrase. change anything here, then tap
        save ♡{role === "admin" ? " (Admin: these are your test choices, not Kiriya’s.)" : ""}
      </p>

      <label className="settings-field">
        <span>Your bio</span>
        <small className="settings-help">
          a few little lines about u. they show right under ur name. one line per row, up to{" "}
          {limits.bioLines}.
        </small>
        <textarea className="field settings-textarea" rows={4} value={draft.bio} onChange={update("bio")} placeholder={"maomao’s no. 1 apprentice\ndrawing way past bedtime"} />
      </label>

      <fieldset className="settings-fieldset">
        <legend>Your socials</legend>
        <small className="settings-help">
          add ur socials which will show up on ur public page here, just drop ur handle :) tapping
          them takes people straight to ur profile on that app.
        </small>
        <div className="settings-grid settings-grid--two">
          <label>
            <span>TikTok</span>
            <input className="field" placeholder="@yourname" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={draft.tiktok} onChange={update("tiktok")} />
          </label>
          <label>
            <span>Instagram</span>
            <input className="field" placeholder="@yourname" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={draft.instagram} onChange={update("instagram")} />
          </label>
        </div>
      </fieldset>

      <label className="settings-field">
        <span>Things you love</span>
        <small className="settings-help">
          these show up in the little box on ur public page. one per row, up to {limits.loves} (like
          vocaloid, cosplay or drawing).
        </small>
        <textarea className="field settings-textarea" rows={4} value={draft.loves} onChange={update("loves")} placeholder={"vocaloid\nthe apothecary diaries\ncosplay"} />
      </label>

      <label className="settings-field">
        <span>Your intro song</span>
        <small className="settings-help">
          plays when someone taps into ur public page, like guns.lol. pick one from ur music shelf.
        </small>
        <select className="field settings-select" value={draft.introSong} onChange={update("introSong")}>
          <option value="featured">
            {featured ? `My featured song (${featured.title})` : "My featured song"}
          </option>
          {shelf.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title}
              {song.artist ? ` · ${song.artist}` : ""}
            </option>
          ))}
          <option value="none">No intro song</option>
        </select>
        <small className="settings-help">
          {draft.introSong === "none"
            ? "no music, and no “tap to enter” screen."
            : !chosen
              ? "ur music shelf doesn’t have a featured song yet, so there’s no intro song for now."
              : chosen.provider === "audio"
                ? "✓ this one starts playing the moment someone taps in."
                : "this is a link, so it opens its own little player. on iPhones people might need one more tap. songs u upload start right away."}{" "}
          <Link to="/world/stage">add songs to ur music shelf ↗</Link>
        </small>
      </label>

      <label className="settings-check">
        <input type="checkbox" checked={draft.showViews} onChange={update("showViews")} />
        <span>
          Show how many people viewed ur page
          <small className="settings-help">a little eye with the number sits in the top right corner.</small>
        </span>
      </label>

      <div className="settings-card__row">
        <button type="submit" className="btn btn--primary btn--small" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <Link className="btn btn--soft btn--small" to="/?view=public">
          See it like your friends do
        </Link>
        {save.isSuccess && <span className="status-pill status-pill--on">Saved ♡</span>}
      </div>
      {save.error && <p className="settings-card__message" role="alert">{save.error.message}</p>}
    </form>
  );
}

export default function SettingsPage() {
  const lock = useLock();
  const role = useSession().data?.role;
  const navigate = useNavigate();
  const location = useLocation();
  // Links like /world/settings#sharing land after this lazy page has rendered.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);
  return (
    <div className="settings">
      <h1 className="settings__title">Settings</h1>
      <PublicProfile />
      <Sharing />
      <Surprises />
      <PhoneWidget />
      <Address />
      <MyFaves />
      <Passphrase />
      <section className="settings-card">
        <h2>This device</h2>
        <p className="settings-card__hint">
          Each device asks for your passphrase again every two days. Locking
          hides everything right away.
        </p>
        {role === "admin" && (
          <Link className="btn btn--soft btn--small" to="/admin">
            Open the admin desk
          </Link>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            lock.mutate(undefined, { onSuccess: () => navigate("/") })
          }
        >
          Lock kiriya on this device
        </button>
      </section>
    </div>
  );
}
