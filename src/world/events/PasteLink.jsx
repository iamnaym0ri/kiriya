// Josh's paste-a-link box, in place: beside the events & merch block on home, on the list, and on
// each event's page. He pastes an Instagram post, an organiser page or an article; the event finder
// checks it and writes it up. Nothing here shows on her phone (AdminEdit renders nothing for her).
import { useState } from "react";
import { AdminEdit, EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { usePasteLink } from "./eventsData.js";

const looksLikeLink = (value) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export default function PasteLink({ event = null, compact = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(null);
  const paste = usePasteLink();
  const label = event ? "add a link for this" : "add from a link";
  const close = () => {
    setOpen(false);
    setUrl("");
    paste.reset();
  };
  return (
    <>
      <AdminEdit label={label} compact={compact} className={className} onClick={() => (setDone(null), setOpen(true))} />
      <EditSheet
        open={open}
        title={event ? "a link for this event" : "add from a link"}
        subtitle={event ? event.name : "events & merch"}
        saveLabel="Send"
        saveDisabled={!looksLikeLink(url)}
        dirty={url.trim().length > 0}
        onClose={close}
        onSave={async () => {
          const result = await paste.mutateAsync({ url: url.trim(), eventId: event?.id ?? null });
          setDone(result?.status ?? "queued");
          setUrl("");
          return true;
        }}
      >
        <EditField
          label="link"
          hint={
            event
              ? "a new post or page about this event: guests, tickets, merch, changes. it’s read, checked and added to the page with its source."
              : "an instagram post, an organiser’s page or an article about something in singapore. it’s read, checked, and written up here if it’s worth knowing."
          }
        >
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </EditField>
      </EditSheet>
      {done && !open && (
        <p className="ev-paste-done" role="status">
          {done === "duplicate" ? "already on it ♡ that link was sent before." : "sent ♡ it shows up here once it’s been looked into."}
          <button type="button" onClick={() => setDone(null)} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}
    </>
  );
}
