import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useLock, useSession } from "../lib/session.js";
import { shrinkImage, uploadFile } from "../lib/uploads.js";
import PageLoader from "../shared/PageLoader.jsx";
import UnlockSheet from "../shared/UnlockSheet.jsx";
import Wordmark from "../shared/Wordmark.jsx";
import "./Admin.css";
import FeedPanel from "./FeedPanel.jsx";

const SERVICE_LABELS = {
  database: "Database",
  passphrases: "Passphrases set",
  sessions: "Private sessions",
  collection: "Content collection",
  scheduler: "Optional surprise scheduler (QStash)",
  cronSecret: "Optional daily backstop",
  push: "Optional push notifications",
  fileStorage: "File storage (Vercel Blob)",
};

function Status() {
  const status = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => api("/admin/status"),
  });
  if (!status.data) return <PageLoader />;
  const { services, devices, today, day } = status.data;
  return (
    <section className="admin-card">
      <h2>How everything is running</h2>
      <ul className="admin-status">
        {Object.entries(services).map(([key, value]) => (
          <li key={key} data-ok={value === true || typeof value === "string"}>
            <span>{SERVICE_LABELS[key]}</span>
            <strong>
              {typeof value === "string"
                ? value
                : value
                  ? "ready"
                  : "not set up"}
            </strong>
          </li>
        ))}
      </ul>
      <p className="admin-muted">
        Today ({day}):{" "}
        {today
          ? `${today.cards} selected notes, collection v${today.collectionVersion ?? "legacy (refresh today)"}`
          : "not generated yet"}
        .
      </p>
      <p className="admin-muted">
        Kiriya's devices with surprises on:{" "}
        {devices.filter((d) => d.role === "kiriya").length}
      </p>
    </section>
  );
}

function Daily() {
  const queryClient = useQueryClient();
  const pushes = useQuery({
    queryKey: ["admin", "pushes"],
    queryFn: () => api("/admin/pushes"),
  });
  const run = useMutation({
    mutationFn: (options) =>
      api("/admin/daily/run", { method: "POST", body: options }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["me", "today"] });
    },
  });
  const sendNow = useMutation({
    mutationFn: (id) =>
      api(`/admin/pushes/${id}/send-now`, { method: "POST", body: {} }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "pushes"] }),
  });

  return (
    <section className="admin-card">
      <h2>Today's content and surprises</h2>
      <div className="admin-row">
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => run.mutate({})}
          disabled={run.isPending}
        >
          {run.isPending ? "Running…" : "Run the daily job"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => run.mutate({ force: true })}
          disabled={run.isPending}
        >
          Rebuild today from scratch
        </button>
      </div>
      {run.data && (
        <pre className="admin-log">
          {JSON.stringify(
            {
              notes: run.data.finds,
              song: run.data.song,
              pushes: run.data.pushes,
            },
            null,
            2,
          )}
        </pre>
      )}
      {run.error && <p className="admin-error">{run.error.message}</p>}

      <h3>Planned pushes</h3>
      <ul className="admin-list">
        {(pushes.data ?? []).map((push) => (
          <li key={push.id}>
            <div>
              <strong>{push.payload?.title}</strong>
              <p>{push.payload?.body}</p>
              <p className="admin-muted">
                {new Date(push.sendAt).toLocaleString("en-SG", {
                  timeZone: "Asia/Singapore",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                , {push.kind}, {push.status}
              </p>
            </div>
            {push.status === "planned" && (
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={() => sendNow.mutate(push.id)}
              >
                Send now
              </button>
            )}
          </li>
        ))}
      </ul>

    </section>
  );
}

const sgTime = (value) =>
  new Date(value).toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" });

function noteOutcome(note) {
  if (note.status === "scheduled") return `scheduled for ${sgTime(note.sendAt)}`;
  if (note.status === "canceled") return "canceled";
  if (note.status === "sending") return "sending…";
  const push = note.pushResult ?? {};
  const phone = push.skipped
    ? `in their world (${push.skipped})`
    : push.error
      ? `in their world; notification failed: ${push.error}`
      : push.targets === 0
        ? "in their world; no phone has notifications on"
        : `notified ${push.sent} of ${push.targets} device(s)`;
  return `${sgTime(note.sentAt ?? note.sendAt)} · ${phone}${note.openedAt ? ` · read ${sgTime(note.openedAt)} ♡` : " · not read yet"}`;
}

const EMPTY_NOTE = { recipient: "kiriya", kind: "note", title: "", body: "", mode: "now", at: "" };

function LoveNotes() {
  const queryClient = useQueryClient();
  const notes = useQuery({ queryKey: ["admin", "love-notes"], queryFn: () => api("/admin/love-notes") });
  const [draft, setDraft] = useState(EMPTY_NOTE);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "love-notes"] });
  const send = useMutation({
    mutationFn: () =>
      api("/admin/love-notes", {
        method: "POST",
        body: {
          recipient: draft.recipient,
          kind: draft.kind,
          title: draft.title,
          body: draft.body,
          when:
            draft.mode === "at"
              ? { mode: "at", at: new Date(`${draft.at}:00+08:00`).toISOString() }
              : { mode: draft.mode },
        },
      }),
    onSuccess: () => {
      setDraft({ ...EMPTY_NOTE, recipient: draft.recipient });
      refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: (id) => api(`/admin/love-notes/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const data = notes.data;
  const hour = draft.mode === "at" && draft.at ? Number(draft.at.slice(11, 13)) : null;
  const outsideWindow = data && hour !== null && (hour < data.window.startHour || hour >= data.window.endHour);
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  return (
    <section className="admin-card">
      <h2>Little notes to her phone</h2>
      <p className="admin-muted">
        Each note lands in her world’s “notes for you” page at its time and buzzes every phone where she turned on
        notifications. Send one to “my test devices” to try it on your own iPhone without touching hers.
      </p>
      {data && (
        <p className="admin-muted">
          Kiriya’s phones with notifications: {data.devices.kiriya} · your test devices: {data.devices.admin} · her
          window: {data.window.startHour}:00–{data.window.endHour}:00
          {!data.push && " · push keys aren’t configured here"}
          {!data.scheduler && " · no scheduler here: timed notes go out with the daily backstop"}
        </p>
      )}
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <div className="admin-row">
          <select className="field" value={draft.recipient} onChange={set("recipient")} aria-label="Send to">
            <option value="kiriya">To Kiriya</option>
            <option value="admin">To my test devices</option>
          </select>
          <select className="field" value={draft.kind} onChange={set("kind")} aria-label="Kind of note">
            <option value="note">💌 A little note</option>
            <option value="surprise">🎁 A surprise</option>
            <option value="update">✦ An update</option>
          </select>
        </div>
        <input className="field" placeholder="Title (shows on her lock screen)" maxLength={60} value={draft.title} onChange={set("title")} />
        <textarea
          className="field admin-textarea admin-textarea--short"
          rows={4}
          maxLength={1000}
          placeholder="The note. The first line or two shows in the notification; all of it waits in her world."
          value={draft.body}
          onChange={set("body")}
        />
        <div className="admin-row">
          <select className="field" value={draft.mode} onChange={set("mode")} aria-label="When">
            <option value="now">Send now</option>
            <option value="at">At a time (Singapore)</option>
            <option value="surprise">Surprise me: a random time in her window</option>
          </select>
          {draft.mode === "at" && (
            <input className="field" type="datetime-local" value={draft.at} onChange={set("at")} aria-label="Send at, Singapore time" required />
          )}
          <button type="submit" className="btn btn--primary btn--small" disabled={!draft.title.trim() || !draft.body.trim() || send.isPending}>
            {send.isPending ? "Sending…" : draft.mode === "now" ? "Send" : "Schedule"}
          </button>
        </div>
        {outsideWindow && <p className="admin-error">That’s outside her notification hours; it will still arrive then.</p>}
        {send.isSuccess && <p className="admin-muted">{noteOutcome(send.data.note)}{send.data.schedule?.error ? ` · ${send.data.schedule.error}` : ""}</p>}
        {send.error && <p className="admin-error">{send.error.message}</p>}
      </form>
      <ul className="admin-list">
        {(data?.notes ?? []).map((note) => (
          <li key={note.id}>
            <div>
              <strong>
                {note.recipient === "admin" ? "[test] " : ""}
                {note.title}
              </strong>
              <p>{note.body}</p>
              <p className="admin-muted">{noteOutcome(note)}</p>
            </div>
            {note.status === "scheduled" && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => cancel.mutate(note.id)}>
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
      {cancel.error && <p className="admin-error">{cancel.error.message}</p>}
    </section>
  );
}

function Passphrases() {
  const queryClient = useQueryClient();
  const credentials = useQuery({ queryKey: ["admin", "credentials"], queryFn: () => api("/admin/credentials") });
  const reset = useMutation({
    mutationFn: () => api("/admin/credentials/kiriya/reset", { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "credentials"] }),
  });
  const kiriya = credentials.data?.kiriya;
  return (
    <section className="admin-card">
      <h2>Passphrases</h2>
      <p className="admin-muted">
        Kiriya can change her passphrase in Settings, and you can change yours there too.{" "}
        {kiriya?.custom
          ? `She chose her own on ${sgTime(kiriya.changedAt)}.`
          : "She is using the passphrase configured in Vercel."}
      </p>
      {kiriya?.custom && (
        <div className="admin-row">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={reset.isPending}
            onClick={() => {
              if (window.confirm("Reset Kiriya to the passphrase configured in Vercel? Her devices will be signed out.")) reset.mutate();
            }}
          >
            {reset.isPending ? "Resetting…" : "She forgot it: reset to the Vercel passphrase"}
          </button>
        </div>
      )}
      {reset.isSuccess && <p className="admin-muted">Reset. Her devices will ask for the original passphrase.</p>}
      {reset.error && <p className="admin-error">{reset.error.message}</p>}
    </section>
  );
}

const EMPTY_LETTER = {
  kind: "birthday",
  title: "",
  body: "",
  openWhen: "",
  unlockAt: "",
  notify: true,
};

function Letters() {
  const queryClient = useQueryClient();
  const letters = useQuery({
    queryKey: ["admin", "letters"],
    queryFn: () => api("/admin/letters"),
  });
  const [draft, setDraft] = useState(EMPTY_LETTER);
  const [editing, setEditing] = useState(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "letters"] });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        kind: draft.kind,
        title: draft.title,
        body: draft.body,
        openWhen: draft.openWhen || null,
        unlockAt: draft.unlockAt
          ? new Date(`${draft.unlockAt}T00:00:00+08:00`).toISOString()
          : null,
        ...(editing ? {} : { notify: draft.notify }),
      };
      return editing
        ? api(`/admin/letters/${editing}`, { method: "PUT", body })
        : api("/admin/letters", { method: "POST", body });
    },
    onSuccess: () => {
      setDraft(EMPTY_LETTER);
      setEditing(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/admin/letters/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  // Sends only the notification to the admin's phone; no letter is saved, so she sees nothing.
  const tryNotification = useMutation({
    mutationFn: () =>
      api("/admin/letters/test-announcement", { method: "POST", body: { title: draft.title } }),
  });

  return (
    <section className="admin-card">
      <h2>Letters</h2>
      <p className="admin-muted">
        Kiriya reads these on the Letters page. Leave a blank line between
        paragraphs.
      </p>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="admin-row">
          <select
            className="field"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          >
            <option value="birthday">Birthday letter</option>
            <option value="open_when">Open when…</option>
            <option value="note">Just a note</option>
          </select>
          <input
            className="field"
            type="date"
            value={draft.unlockAt}
            onChange={(e) => setDraft({ ...draft, unlockAt: e.target.value })}
            aria-label="Unlocks on (optional)"
          />
        </div>
        {draft.kind === "open_when" && (
          <input
            className="field"
            placeholder="Open when… (e.g. you can't sleep)"
            value={draft.openWhen}
            onChange={(e) => setDraft({ ...draft, openWhen: e.target.value })}
          />
        )}
        <input
          className="field"
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="field admin-textarea"
          rows={10}
          placeholder="Dear Kiriya…"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        {!editing && (
          <label className="admin-row">
            <input
              type="checkbox"
              checked={draft.notify}
              onChange={(e) => setDraft({ ...draft, notify: e.target.checked })}
            />
            Tell her phone{draft.unlockAt ? " when it unlocks" : ""}
          </label>
        )}
        {!editing && (
          <div className="admin-row">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={!draft.title.trim() || tryNotification.isPending}
              onClick={() => tryNotification.mutate()}
            >
              {tryNotification.isPending ? "Sending…" : "Try this notification on my phone first"}
            </button>
            {tryNotification.isSuccess && (
              <span className="admin-muted">{noteOutcome(tryNotification.data.note)}</span>
            )}
            {tryNotification.error && (
              <span className="admin-error">{tryNotification.error.message}</span>
            )}
          </div>
        )}
        <div className="admin-row">
          <button
            type="submit"
            className="btn btn--primary btn--small"
            disabled={
              !draft.title.trim() || !draft.body.trim() || save.isPending
            }
          >
            {editing ? "Save changes" : "Seal the letter"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                setEditing(null);
                setDraft(EMPTY_LETTER);
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {save.error && <p className="admin-error">{save.error.message}</p>}
      </form>
      <ul className="admin-list">
        {(letters.data ?? []).map((letter) => (
          <li key={letter.id}>
            <div>
              <strong>{letter.title}</strong>
              <p className="admin-muted">
                {letter.kind.replace("_", " ")}
                {letter.unlockAt
                  ? `, opens ${new Date(letter.unlockAt).toLocaleDateString("en-SG")}`
                  : ""}
                {letter.openedAt ? ", read ♡" : ", not read yet"}
              </p>
            </div>
            <div className="admin-row">
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={() => {
                  setEditing(letter.id);
                  setDraft({
                    notify: false,
                    kind: letter.kind,
                    title: letter.title,
                    body: letter.body,
                    openWhen: letter.openWhen ?? "",
                    unlockAt: letter.unlockAt
                      ? new Date(letter.unlockAt).toLocaleDateString("en-CA", {
                          timeZone: "Asia/Singapore",
                        })
                      : "",
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => remove.mutate(letter.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Notes() {
  const queryClient = useQueryClient();
  const notes = useQuery({
    queryKey: ["admin", "notes"],
    queryFn: () => api("/admin/notes"),
  });
  const [text, setText] = useState("");
  const save = useMutation({
    mutationFn: (list) =>
      api("/admin/notes", { method: "PUT", body: { notes: list } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "notes"] }),
  });
  const list = notes.data?.notes ?? [];

  return (
    <section className="admin-card">
      <h2>Little notes</h2>
      <p className="admin-muted">
        Short notes that show up on some days in place of the "why you're you"
        card, with a push saying you left one.
      </p>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          save.mutate([...list, { text }], { onSuccess: () => setText("") });
        }}
      >
        <textarea
          className="field admin-textarea admin-textarea--short"
          rows={3}
          maxLength={280}
          placeholder="I hope practice went well today…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn--primary btn--small"
          disabled={!text.trim() || save.isPending}
        >
          Add note
        </button>
      </form>
      <ul className="admin-list">
        {list.map((note) => (
          <li key={note.id}>
            <p>{note.text}</p>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => save.mutate(list.filter((n) => n.id !== note.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfileMedia() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: () => api("/admin/profile"),
  });
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(null);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "profile"] });
    queryClient.invalidateQueries({ queryKey: ["public-profile"] });
  };
  const saveSignature = useMutation({
    mutationFn: () =>
      api("/admin/signature", { method: "PUT", body: { signature } }),
    onSuccess: refresh,
  });
  const saveMedia = useMutation({
    mutationFn: (body) => api("/admin/profile/media", { method: "PUT", body }),
    onSuccess: refresh,
  });

  useEffect(() => {
    if (profile.data && !signature) setSignature(profile.data.signature);
  }, [profile.data, signature]);

  if (!profile.data) return null;

  async function uploadTo(folder, file) {
    const shrunk = await shrinkImage(file, folder === "avatar" ? 800 : 1400);
    return (await uploadFile(shrunk, { folder })).url;
  }

  return (
    <section className="admin-card">
      <h2>Signature and profile photos</h2>
      <form
        className="admin-row"
        onSubmit={(e) => {
          e.preventDefault();
          saveSignature.mutate();
        }}
      >
        <input
          className="field"
          value={signature}
          maxLength={40}
          onChange={(e) => setSignature(e.target.value)}
          aria-label="Signature"
        />
        <button
          type="submit"
          className="btn btn--primary btn--small"
          disabled={saveSignature.isPending}
        >
          Save signature
        </button>
      </form>

      <div className="admin-media">
        <div className="admin-media__item">
          <span className="admin-media__thumb admin-media__thumb--round">
            {profile.data.avatarUrl ? (
              <img src={profile.data.avatarUrl} alt="" />
            ) : (
              "k"
            )}
          </span>
          <label className="btn btn--soft btn--small admin-file">
            {busy === "avatar" ? "Uploading…" : "Profile picture"}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy("avatar");
                try {
                  saveMedia.mutate({
                    avatarUrl: await uploadTo("avatar", file),
                  });
                } finally {
                  setBusy(null);
                }
              }}
            />
          </label>
        </div>
        {profile.data.cosplays.map((cosplay, i) => (
          <div key={cosplay.character} className="admin-media__item">
            <span className="admin-media__thumb">
              {cosplay.photoUrl ? <img src={cosplay.photoUrl} alt="" /> : "✦"}
            </span>
            <label className="btn btn--soft btn--small admin-file">
              {busy === cosplay.character ? "Uploading…" : cosplay.character}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(cosplay.character);
                  try {
                    const url = await uploadTo("cosplay", file);
                    const cosplays = profile.data.cosplays.map((c, j) =>
                      j === i ? { ...c, photoUrl: url } : c,
                    );
                    saveMedia.mutate({ cosplays });
                  } finally {
                    setBusy(null);
                  }
                }}
              />
            </label>
          </div>
        ))}
      </div>
      {saveMedia.error && (
        <p className="admin-error">{saveMedia.error.message}</p>
      )}
    </section>
  );
}

export default function Admin() {
  const session = useSession();
  const navigate = useNavigate();
  const lock = useLock();

  useEffect(() => {
    document.title = "admin desk ♡ kiriya";
  }, []);

  if (session.isPending) return <PageLoader />;
  if (session.data?.role !== "admin") {
    return (
      <div className="world-locked">
        <UnlockSheet
          open
          title="Admin desk"
          onClose={() => navigate("/")}
          onUnlocked={(data) => data.role !== "admin" && navigate("/world")}
        />
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin__head">
        <Wordmark as="span" size="sm" />
        <div className="admin-row">
          <Link to="/world" className="btn btn--soft btn--small">
            Preview Kiriya’s world
          </Link>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() =>
              lock.mutate(undefined, { onSuccess: () => navigate("/") })
            }
          >
            Lock
          </button>
        </div>
      </header>
      <h1 className="admin__title">Admin desk</h1>
      <Status />
      <LoveNotes />
      <FeedPanel />
      <Letters />
      <Notes />
      <ProfileMedia />
      <Passphrases />
      <Daily />
    </div>
  );
}
