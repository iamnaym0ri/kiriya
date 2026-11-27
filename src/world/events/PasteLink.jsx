// Josh's paste-a-link box, in place: beside the events & merch block on home, on the list, and on
// each event's page. He pastes an Instagram post, an organiser page or an article; the event finder
// checks it and writes it up (POST /api/admin/events/links). Nothing here shows on her phone
// (AdminEdit renders nothing for her).
import { useState } from "react";
import { Link } from "react-router";
import { AdminEdit, EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { SETTLED_LINK, eventPath, useLinkStatus, usePasteLink, useRefreshEvent } from "./eventsData.js";

const looksLikeLink = (value) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const STATUS_WORDS = {
  queued: "in the queue",
  checking: "checking it",
  researching: "looking into it",
  added: "added ♡",
  updated: "event updated ♡",
  not_an_event: "not an event in singapore",
  duplicate: "already known",
  failed: "that didn’t work",
  paused: "paused for now",
  skipped: "skipped",
};

/** The pasted link's progress, live while it's on screen. */
function LinkProgress({ link, onDismiss }) {
  const { data } = useLinkStatus(link);
  const current = data ?? link;
  const settled = SETTLED_LINK.has(current.status);
  return (
    <div className="ev-paste-done" role="status" data-settled={settled ? "" : undefined}>
      <span className="ev-paste-done__text">
        <strong>{STATUS_WORDS[current.status] ?? current.status}</strong>
        {current.message && <small>{current.message}</small>}
        {current.eventId && ["added", "updated", "duplicate"].includes(current.status) && (
          <Link to={eventPath(current.eventId)}>open it</Link>
        )}
      </span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export default function PasteLink({ event = null, compact = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(null);
  const paste = usePasteLink();
  const refresh = useRefreshEvent();
  const close = () => {
    setOpen(false);
    setUrl("");
    setNote("");
  };
  return (
    <>
      <AdminEdit label={event ? "add a link" : "add from a link"} compact={compact} className={className} onClick={() => (setSent(null), setOpen(true))} />
      <EditSheet
        open={open}
        title={event ? "a link for this event" : "add from a link"}
        subtitle={event ? event.name : "events & merch"}
        saveLabel="Send"
        saveDisabled={!looksLikeLink(url)}
        dirty={url.trim().length > 0}
        onClose={close}
        onSave={async () => {
          const words = [event ? `about ${event.name} (${event.id})` : null, note.trim() || null].filter(Boolean).join(" · ");
          const link = await paste.mutateAsync({ url: url.trim(), note: words || null });
          setSent(link);
          return true;
        }}
      >
        <EditField
          label="link"
          hint={
            event
              ? "a new post or page about this: guests, tickets, merch, changes. it’s read, checked and added here with its source."
              : "an instagram post, an organiser’s page or an article about something in singapore. it’s checked within a few minutes and written up if it’s worth knowing."
          }
        >
          <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </EditField>
        <EditField label="a note (optional)" hint="anything the finder should know, like “she loves this artist”.">
          <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </EditField>
        {event && (
          <div className="ev-paste-refresh">
            <button
              type="button"
              className="ev-pill-link"
              disabled={refresh.isPending || refresh.isSuccess}
              onClick={() => refresh.mutate(event.id)}
            >
              {refresh.isSuccess ? "asked ✓" : refresh.isPending ? "asking…" : "look into this event again"}
            </button>
            {refresh.isError && <small role="alert">{refresh.error?.message ?? "that didn’t work"}</small>}
          </div>
        )}
      </EditSheet>
      {sent && !open && <LinkProgress link={sent} onDismiss={() => setSent(null)} />}
    </>
  );
}
