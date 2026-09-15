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
  const [custom, setCustom] = useState({ title: "", body: "" });
  const sendCustom = useMutation({
    mutationFn: () =>
      api("/admin/pushes/custom", { method: "POST", body: custom }),
    onSuccess: () => setCustom({ title: "", body: "" }),
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

      <h3>Send Kiriya a surprise right now</h3>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          sendCustom.mutate();
        }}
      >
        <input
          className="field"
          placeholder="Title (up to 40)"
          maxLength={40}
          value={custom.title}
          onChange={(e) => setCustom({ ...custom, title: e.target.value })}
        />
        <input
          className="field"
          placeholder="Message (up to 110)"
          maxLength={110}
          value={custom.body}
          onChange={(e) => setCustom({ ...custom, body: e.target.value })}
        />
        <button
          type="submit"
          className="btn btn--primary btn--small"
          disabled={!custom.title || !custom.body || sendCustom.isPending}
        >
          Send
        </button>
        {sendCustom.isSuccess && (
          <p className="admin-muted">
            Sent to {sendCustom.data.sent} device(s).
          </p>
        )}
        {sendCustom.error && (
          <p className="admin-error">{sendCustom.error.message}</p>
        )}
      </form>
    </section>
  );
}

const EMPTY_LETTER = {
  kind: "birthday",
  title: "",
  body: "",
  openWhen: "",
  unlockAt: "",
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

  return (
    <section className="admin-card">
      <h2>Letters</h2>
      <p className="admin-muted">
        Kiriya reads these in her Letters page. Leave a blank line between
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
            Preview her world
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
      <Letters />
      <Notes />
      <ProfileMedia />
      <Daily />
    </div>
  );
}
