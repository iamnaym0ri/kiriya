import { useEffect, useMemo, useState } from "react";
import { EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { useAdminJar, useAdminLetters, useDeleteLetter, useJarEdit, useSaveLetter, useSendNote, useTryLetter } from "./useMail.js";
import { onItsWay } from "./format.js";

// Josh's in-place controls in the notes & letters section (his phone only): send a little note,
// write or change a letter, and fill the note jar. They use the admin desk's own APIs.

const TZ = "Asia/Singapore";
/** "2026-11-27T20:00" in Singapore time, for a datetime-local field. */
function sgLocal(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
const sgDay = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });
const fromSgLocal = (value) => new Date(`${value}:00+08:00`);

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="mail-seg" role="radiogroup" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Count({ value, max }) {
  return <span className="mail-count" data-near={value > max * 0.9 || undefined}>{value}/{max}</span>;
}

// ---------- a little note ----------

const NOTE_KINDS = [
  ["note", "💌 little note"],
  ["surprise", "🎁 surprise"],
  ["update", "✦ update"],
];

export function NoteComposer({ open, onClose, onSent }) {
  const send = useSendNote();
  const [to, setTo] = useState("kiriya");
  const [kind, setKind] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState("now");
  const [at, setAt] = useState("");
  useEffect(() => {
    if (!open) return;
    setTo("kiriya");
    setKind("note");
    setTitle("");
    setBody("");
    setMode("now");
    setAt(sgLocal(new Date(Math.ceil((Date.now() + 60 * 60_000) / 900_000) * 900_000)));
  }, [open]);
  const hour = mode === "at" && at ? Number(at.slice(11, 13)) : null;
  const late = hour !== null && (hour < 8 || hour >= 22);
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="a little note"
      subtitle={to === "admin" ? "to your phone only, to try it" : "to her phone, and kept in her notes"}
      saveLabel={mode === "now" ? "Send ♡" : "Schedule"}
      saveDisabled={!title.trim() || !body.trim() || (mode === "at" && !at)}
      dirty={Boolean(title.trim() || body.trim())}
      onSave={async () => {
        const result = await send.mutateAsync({
          recipient: to,
          kind,
          title: title.trim(),
          body: body.trim(),
          when: mode === "at" ? { mode: "at", at: fromSgLocal(at).toISOString() } : { mode },
        });
        onSent?.(result, { to, mode });
      }}
    >
      <Segmented
        label="Send to"
        value={to}
        onChange={setTo}
        options={[
          ["kiriya", "to kiriya"],
          ["admin", "try on my phone"],
        ]}
      />
      <div className="mail-chips" role="radiogroup" aria-label="Kind of note">
        {NOTE_KINDS.map(([key, text]) => (
          <button key={key} type="button" className="mail-chip" role="radio" aria-checked={kind === key} onClick={() => setKind(key)}>
            {text}
          </button>
        ))}
      </div>
      <EditField label="title" hint="shows on her lock screen">
        <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="thinking of u" enterKeyHint="next" />
      </EditField>
      <EditField label={<>the note <Count value={body.length} max={1000} /></>} hint="the first line or two shows in the notification. all of it waits here.">
        <textarea value={body} maxLength={1000} rows={5} onChange={(e) => setBody(e.target.value)} placeholder="hope ur day is soft ♡" />
      </EditField>
      <Segmented
        label="When"
        value={mode}
        onChange={setMode}
        options={[
          ["now", "now"],
          ["at", "at a time"],
          ["surprise", "surprise me"],
        ]}
      />
      {mode === "at" && (
        <EditField label="send at (singapore time)" hint={late ? "that’s outside her notification hours. it still arrives then, quietly." : null}>
          <input type="datetime-local" value={at} min={sgLocal(new Date())} onChange={(e) => setAt(e.target.value)} />
        </EditField>
      )}
      {mode === "surprise" && <p className="mail-sheet-note">a random moment inside her notification hours, later today or tomorrow ✨</p>}
    </EditSheet>
  );
}

// ---------- a letter ----------

const LETTER_KINDS = [
  ["birthday", "birthday"],
  ["open_when", "open when…"],
  ["note", "a letter"],
];
const EMPTY_LETTER = { kind: "note", title: "", body: "", openWhen: "", unlockAt: "", notify: true };

export function LetterEditor({ open, letterId = null, onClose, onSaved, onDeleted }) {
  const letters = useAdminLetters(open && Boolean(letterId));
  const save = useSaveLetter();
  const remove = useDeleteLetter();
  const tryIt = useTryLetter();
  const existing = letterId ? letters.data?.find((letter) => letter.id === letterId) : null;
  const initial = useMemo(
    () =>
      existing
        ? {
            kind: existing.kind,
            title: existing.title,
            body: existing.body,
            openWhen: existing.openWhen ?? "",
            unlockAt: existing.unlockAt ? sgDay(existing.unlockAt) : "",
            notify: false,
          }
        : EMPTY_LETTER,
    [existing],
  );
  const [draft, setDraft] = useState(initial);
  useEffect(() => {
    if (open) {
      setDraft(initial);
      tryIt.reset();
    }
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const loading = Boolean(letterId) && !existing;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const today = sgDay(new Date());
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title={letterId ? "change this letter" : "a new letter"}
      subtitle={letterId ? "she sees the change the next time she opens it" : "sealed with a wax heart, kept in her letters"}
      saveLabel={letterId ? "Save" : "Seal it ♡"}
      saveDisabled={loading || !draft.title.trim() || !draft.body.trim()}
      dirty={dirty}
      onSave={async () => {
        const saved = await save.mutateAsync({
          id: letterId ?? undefined,
          kind: draft.kind,
          title: draft.title.trim(),
          body: draft.body.trim(),
          openWhen: draft.kind === "open_when" ? draft.openWhen.trim() || null : null,
          unlockAt: draft.unlockAt ? new Date(`${draft.unlockAt}T00:00:00+08:00`).toISOString() : null,
          ...(letterId ? {} : { notify: draft.notify }),
        });
        onSaved?.(saved, { created: !letterId, notify: draft.notify, unlockAt: draft.unlockAt });
      }}
      onDelete={letterId ? async () => {
        await remove.mutateAsync(letterId);
        onDeleted?.();
      } : undefined}
      deleteLabel="Delete this letter"
    >
      {loading ? (
        <p className="mail-sheet-note">{letters.isError ? "that letter couldn’t load. try again?" : "opening it…"}</p>
      ) : (
        <>
          <Segmented label="Kind of letter" value={draft.kind} onChange={(kind) => setDraft((current) => ({ ...current, kind }))} options={LETTER_KINDS} />
          {draft.kind === "open_when" && (
            <EditField label="open when…" hint="it shows on the envelope">
              <input value={draft.openWhen} maxLength={120} onChange={set("openWhen")} placeholder="you can’t sleep" />
            </EditField>
          )}
          <EditField label="title">
            <input value={draft.title} maxLength={120} onChange={set("title")} placeholder="for you, on a quiet day" />
          </EditField>
          <EditField label={<>the letter <Count value={draft.body.length} max={20000} /></>} hint="leave a blank line between paragraphs. she sees it in your handwriting font.">
            <textarea className="mail-letter-field" value={draft.body} maxLength={20000} rows={12} onChange={set("body")} placeholder="my dearest kiriya," />
          </EditField>
          <EditField label="keep it sealed until (optional)" hint={draft.unlockAt ? "she sees the envelope now, and it opens that morning" : "leave empty and she can open it right away"}>
            <input type="date" value={draft.unlockAt} min={letterId ? undefined : today} onChange={set("unlockAt")} />
          </EditField>
          {draft.unlockAt && (
            <button type="button" className="mail-link-button" onClick={() => setDraft((current) => ({ ...current, unlockAt: "" }))}>
              no date, she can open it now
            </button>
          )}
          {!letterId && (
            <>
              <label className="mail-toggle">
                <input type="checkbox" checked={draft.notify} onChange={set("notify")} />
                <span>
                  tell her phone{draft.unlockAt ? " when it unlocks" : ""}
                  <small>“a new letter for you ✉”</small>
                </span>
              </label>
              <button type="button" className="mail-soft-button" disabled={!draft.title.trim() || tryIt.isPending} onClick={() => tryIt.mutate({ title: draft.title.trim(), body: draft.body.trim() || undefined, openWhen: draft.openWhen.trim() || null, kind: draft.kind })}>
                {tryIt.isPending ? "sending…" : tryIt.isSuccess ? "sent to your phone ✓ try it again?" : "try the notification on my phone first"}
              </button>
              {tryIt.isError && <p className="mail-sheet-note" role="alert">{tryIt.error?.message ?? "that didn’t send."}</p>}
              {tryIt.isSuccess && tryIt.data?.note?.pushResult?.skipped && <p className="mail-sheet-note">{tryIt.data.note.pushResult.skipped}</p>}
            </>
          )}
        </>
      )}
    </EditSheet>
  );
}

// ---------- the note jar ----------

const JAR_STATUS = { waiting: "waiting for the morning", in_jar: "in her jar", read: "she pulled it" };

export function JarEditor({ open, onClose }) {
  const jar = useAdminJar(open);
  const { add, change, remove } = useJarEdit();
  const [text, setText] = useState("");
  const [feelings, setFeelings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [added, setAdded] = useState(null);
  useEffect(() => {
    if (!open) return;
    setText("");
    setFeelings([]);
    setEditing(null);
    setAdded(null);
  }, [open]);
  const data = jar.data;
  const toggle = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  const Chips = ({ value, onChange }) => (
    <div className="mail-chips" role="group" aria-label="Which days is this note for?">
      <button type="button" className="mail-chip" aria-pressed={!value.length} onClick={() => onChange([])}>
        ✿ any day
      </button>
      {(data?.feelings ?? []).map((f) => (
        <button key={f.key} type="button" className="mail-chip" aria-pressed={value.includes(f.key)} onClick={() => onChange(toggle(value, f.key))}>
          {f.emoji} {f.label.toLowerCase()}
        </button>
      ))}
    </div>
  );
  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title="the note jar"
      subtitle="new notes join her jar at 8:00 am"
      saveLabel="Add ♡"
      saveDisabled={!text.trim()}
      dirty={Boolean(text.trim())}
      onSave={async () => {
        const saved = await add.mutateAsync({ text: text.trim(), feelings });
        setText("");
        setFeelings([]);
        setAdded(saved);
        return false; // stay open for the next one
      }}
    >
      <EditField label={<>a little note for her jar <Count value={text.length} max={800} /></>}>
        <textarea value={text} maxLength={800} rows={4} onChange={(e) => setText(e.target.value)} placeholder="drink some water, cutie ♡" />
      </EditField>
      <Chips value={feelings} onChange={setFeelings} />
      {added && (
        <p className="mail-sheet-note" role="status">
          in the jar ♡ it joins her jar {onItsWay(added.releaseAt)}.
        </p>
      )}
      {data && (
        <p className="mail-jar-counts">
          <span><strong>{data.counts.waiting}</strong> waiting</span>
          <span><strong>{data.counts.inJar}</strong> new in her jar</span>
          <span><strong>{data.counts.read}</strong> pulled</span>
        </p>
      )}
      {jar.isPending && open && <p className="mail-sheet-note">opening the jar…</p>}
      {data?.notes.length === 0 && <p className="mail-sheet-note">the jar is empty. your first note starts it.</p>}
      <ul className="mail-jar-list">
        {(data?.notes ?? []).map((note) =>
          editing?.id === note.id ? (
            <li key={note.id} className="mail-jar-note" data-editing>
              <textarea className="mail-jar-note__edit" value={editing.text} maxLength={800} rows={3} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Change this note" />
              <Chips value={editing.feelings} onChange={(value) => setEditing({ ...editing, feelings: value })} />
              <div className="mail-jar-note__actions">
                <button type="button" className="mail-soft-button" onClick={() => setEditing(null)}>cancel</button>
                <button
                  type="button"
                  className="mail-soft-button mail-soft-button--strong"
                  disabled={!editing.text.trim() || change.isPending}
                  onClick={() => change.mutate({ id: note.id, text: editing.text.trim(), feelings: editing.feelings }, { onSuccess: () => setEditing(null) })}
                >
                  save
                </button>
              </div>
            </li>
          ) : (
            <li key={note.id} className="mail-jar-note" data-status={note.status}>
              <p>{note.text}</p>
              <p className="mail-jar-note__meta">
                <span className="mail-jar-note__status">{JAR_STATUS[note.status]}</span>
                {note.status === "waiting" ? ` · joins ${onItsWay(note.releaseAt)}` : ""}
                {note.feelings.length ? ` · ${note.label}` : ""}
              </p>
              <div className="mail-jar-note__actions">
                {note.status === "waiting" && (
                  <button type="button" className="mail-soft-button" disabled={change.isPending} onClick={() => change.mutate({ id: note.id, releaseNow: true })}>
                    skip the wait
                  </button>
                )}
                <button type="button" className="mail-soft-button" onClick={() => setEditing({ id: note.id, text: note.text, feelings: note.feelings })}>
                  edit
                </button>
                <button
                  type="button"
                  className="mail-soft-button mail-soft-button--danger"
                  disabled={remove.isPending}
                  onClick={() => window.confirm("Take this note out of the jar? If she already pulled it, she keeps her copy.") && remove.mutate(note.id)}
                >
                  remove
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {(change.error || remove.error) && <p className="mail-sheet-note" role="alert">{(change.error ?? remove.error).message}</p>}
    </EditSheet>
  );
}
