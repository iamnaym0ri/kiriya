import { useEffect } from "react";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { NoteRow } from "./MailHome.jsx";
import { monthOf } from "./format.js";

// The pushed screen of the notes & letters section: every little note, month by month. Letters,
// little notes and jar notes open in the middle of the screen instead (Reveals.jsx). The screen
// opens with navigate(url), so the iPhone's edge swipe goes back.

function ScreenHead({ title, short, subtitle, actions }) {
  const back = useAppBack("/world/mail");
  return (
    <header className="app-section__head">
      <button type="button" className="app-screen__back" onClick={back}>
        notes &amp; letters
      </button>
      <h1 className="app-section__title" data-short={short}>
        {title}
      </h1>
      {actions && <div className="app-section__actions">{actions}</div>}
      {subtitle && <p className="app-section__subtitle">{subtitle}</p>}
    </header>
  );
}

export function AllNotesScreen({ notes, admin, onOpen, signature }) {
  useEffect(() => {
    document.title = "little notes ♡";
  }, []);
  const groups = [];
  for (const note of notes) {
    const month = monthOf(note.at);
    if (groups.at(-1)?.month !== month) groups.push({ month, notes: [] });
    groups.at(-1).notes.push(note);
  }
  return (
    <div className="app-screen mail-screen mail-screen--all">
      <ScreenHead title="little notes" subtitle={`${notes.length} little notes from ${signature.toLowerCase()}`} />
      <div className="app-section__body">
        {groups.map((group) => (
          <section key={group.month} className="mail-month" aria-label={group.month}>
            <h2 className="app-group-title">{group.month}</h2>
            <ul className="app-list mail-list">
              {group.notes.map((note) => (
                <NoteRow key={note.id} note={note} unread={!admin && !note.openedAt} admin={admin} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
