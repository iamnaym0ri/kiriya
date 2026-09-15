import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useLock } from "../../lib/session.js";
import { todayKey } from "../../lib/world.js";
import {
  currentSurpriseState,
  disableSurprises,
  enableSurprises,
  isIos,
  isStandalone,
  pushSupported,
} from "../../lib/pwa.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
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
        Open <strong>kiriya</strong> from your Home Screen, unlock it once, and
        come back to this page.
      </li>
    </ol>
  );
}

function Surprises() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["push", "status"],
    queryFn: () => api("/push/status"),
  });
  const [state, setState] = useState("checking");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    currentSurpriseState()
      .then(setState)
      .catch(() => setState("off"));
  }, []);

  const saveSettings = useMutation({
    mutationFn: (settings) =>
      api("/push/settings", { method: "PUT", body: settings }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["push", "status"] }),
  });
  const test = useMutation({
    mutationFn: () => api("/push/test", { method: "POST", body: {} }),
    onSuccess: () => setMessage("Sent. It should arrive in a few seconds."),
    onError: (error) => setMessage(error.message),
  });

  const needsInstall = isIos() && !isStandalone();
  const settings = status.data?.settings;

  async function turnOn() {
    setMessage(null);
    try {
      const result = await enableSurprises();
      setState(result.state);
      if (result.state === "on" && settings)
        await saveSettings.mutateAsync({ ...settings, enabled: true });
      if (result.state === "error")
        setMessage(`That didn't work: ${result.message}`);
      queryClient.invalidateQueries({ queryKey: ["push", "status"] });
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function turnOff() {
    setMessage(null);
    try {
      if (settings)
        await saveSettings.mutateAsync({ ...settings, enabled: false });
      const result = await disableSurprises();
      setState(result.state);
      queryClient.invalidateQueries({ queryKey: ["push", "status"] });
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="settings-card" aria-labelledby="surprises-title">
      <div className="settings-card__head">
        <MaomaoMascot
          expression={state === "on" ? "happy" : "sparkle"}
          size={64}
        />
        <div>
          <h2 id="surprises-title">Surprises on your phone</h2>
          <p className="settings-card__hint">
            Optional little discoveries from your Maomao, music, art and cosplay
            collections.
          </p>
        </div>
      </div>

      {needsInstall ? (
        <>
          <p className="settings-card__lead">
            On iPhone, notifications work once kiriya lives on your Home Screen:
          </p>
          <InstallGuide />
        </>
      ) : !pushSupported() ? (
        <p className="settings-card__lead">
          Notifications aren’t available here yet. Your world works without
          them.
        </p>
      ) : state === "denied" ? (
        <p className="settings-card__lead">
          Notifications are blocked for kiriya. Turn them back on in your
          phone's Settings → Notifications → kiriya, then reopen the app.
        </p>
      ) : state === "on" ? (
        <div className="settings-card__row">
          <span className="status-pill status-pill--on">Surprises are on</span>
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
            onClick={turnOff}
          >
            Turn off
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--primary"
          onClick={turnOn}
          disabled={state === "checking"}
        >
          Turn on surprises
        </button>
      )}
      {message && <p className="settings-card__message">{message}</p>}

      {settings && state === "on" && (
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

function PublicProfile() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => api("/me/profile"),
  });
  const [draft, setDraft] = useState(null);
  const save = useMutation({
    mutationFn: (body) => api("/me/profile", { method: "PUT", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      queryClient.invalidateQueries({ queryKey: ["me", "profile"] });
    },
  });

  useEffect(() => {
    if (profile.data && !draft)
      setDraft({ ...profile.data, bioText: profile.data.bioLines.join("\n") });
  }, [profile.data, draft]);

  if (!draft) return null;

  function submit(event) {
    event.preventDefault();
    save.mutate({
      bioLines: draft.bioText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      socials: {
        tiktok: { handle: draft.socials.tiktok.handle },
        discord: { username: draft.socials.discord.username },
      },
      showViews: draft.showViews,
    });
  }

  return (
    <form
      className="settings-card"
      aria-labelledby="profile-title"
      onSubmit={submit}
    >
      <h2 id="profile-title">Your public profile</h2>
      <p className="settings-card__hint">
        What everyone sees at iloveukiriya.com, before the passphrase.
      </p>
      <label className="settings-field">
        <span>Profile bio (one line each, up to 6)</span>
        <textarea
          className="field settings-textarea"
          rows={5}
          value={draft.bioText}
          onChange={(e) => setDraft({ ...draft, bioText: e.target.value })}
        />
      </label>
      <div className="settings-grid settings-grid--two">
        <label>
          <span>TikTok handle</span>
          <input
            className="field"
            placeholder="@yourname"
            value={draft.socials.tiktok.handle}
            onChange={(e) =>
              setDraft({
                ...draft,
                socials: {
                  ...draft.socials,
                  tiktok: { handle: e.target.value },
                },
              })
            }
          />
        </label>
        <label>
          <span>Discord username</span>
          <input
            className="field"
            placeholder="username"
            value={draft.socials.discord.username}
            onChange={(e) =>
              setDraft({
                ...draft,
                socials: {
                  ...draft.socials,
                  discord: { username: e.target.value },
                },
              })
            }
          />
        </label>
      </div>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={draft.showViews}
          onChange={(e) => setDraft({ ...draft, showViews: e.target.checked })}
        />
        Show the view counter
      </label>
      <div className="settings-card__row">
        <button
          type="submit"
          className="btn btn--primary btn--small"
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
        {save.isSuccess && (
          <span className="status-pill status-pill--on">Saved</span>
        )}
        {save.error && (
          <span className="settings-card__message">{save.error.message}</span>
        )}
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const lock = useLock();
  const navigate = useNavigate();
  return (
    <div className="settings">
      <h1 className="settings__title">Settings</h1>
      <Surprises />
      <Address />
      <PublicProfile />
      <section className="settings-card">
        <h2>This device</h2>
        <p className="settings-card__hint">
          Locking hides everything again until the passphrase is entered.
        </p>
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
