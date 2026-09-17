import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useNotes, useOpenNote } from "../../lib/notes.js";
import { useToday } from "../../lib/world.js";
import { Icon, Modal } from "../../shared/WorldPrimitives.jsx";
import PageLoader from "../../shared/PageLoader.jsx";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import "./NotesPage.css";

const KIND = {
  note: { icon: "mail", label: "A LITTLE NOTE" },
  update: { icon: "star", label: "SOMETHING NEW" },
  surprise: { icon: "heart", label: "A LITTLE SURPRISE" },
};
const when = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

export default function NotesPage() {
  const notes = useNotes();
  const open = useOpenNote();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [reading, setReading] = useState(null);
  const list = notes.data?.notes ?? [];
  const note = list.find((item) => item.id === reading);

  useEffect(() => {
    document.title = "little notes for you ♡";
  }, []);
  // A tapped notification lands here with ?open=<id>.
  useEffect(() => {
    const id = params.get("open");
    if (!id || !notes.data) return;
    if (list.some((item) => item.id === id)) read(id);
    setParams({}, { replace: true });
  }, [params, notes.data]);

  function read(id) {
    setReading(id);
    if (!list.find((item) => item.id === id)?.openedAt) open.mutate(id);
  }

  if (notes.isPending) return <PageLoader />;
  return (
    <div className="notes-page">
      <header className="section-heading notes-page__head">
        <div>
          <p className="micro-label">SENT STRAIGHT TO YOUR PHONE</p>
          <h1>
            Little notes <em>for you.</em>
          </h1>
          <p>Every note that finds your phone also waits here, so none of them get lost in notifications.</p>
        </div>
        <MaomaoMascot expression={notes.data?.unread ? "sparkle" : "happy"} size={84} />
      </header>
      {notes.isError ? (
        <div className="note-slip" role="alert">
          <p>Your notes couldn’t load.</p>
          <button className="text-link" onClick={() => notes.refetch()}>Try again</button>
        </div>
      ) : list.length === 0 ? (
        <div className="note-slip notes-page__empty">
          <p>Nothing here yet. When a little note is sent your way, it’ll be tucked right here ♡</p>
        </div>
      ) : (
        <ul className="notes-page__list">
          {list.map((item, index) => (
            <li key={item.id} style={{ "--tilt": `${[-1, 0.8, -0.4, 1.2][index % 4]}deg` }}>
              <button className="notes-card" data-unread={!item.openedAt} onClick={() => read(item.id)}>
                <span className="notes-card__mark" aria-hidden="true"><Icon name={KIND[item.kind]?.icon ?? "mail"} size={19} /></span>
                <span className="notes-card__text">
                  <span className="micro-label">
                    {KIND[item.kind]?.label ?? "A LITTLE NOTE"} · {when.format(new Date(item.at))}
                  </span>
                  <strong>{item.title}</strong>
                  <span className="notes-card__preview">{item.body}</span>
                </span>
                {!item.openedAt && <span className="notes-card__new">new</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <Modal title={note.title} onClose={() => setReading(null)} className="letter-modal notes-dialog">
          <article className="notes-dialog__paper">
            <p className="micro-label">{KIND[note.kind]?.label ?? "A LITTLE NOTE"} · {when.format(new Date(note.at))}</p>
            {note.body.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            <p className="notes-dialog__signoff">— {today.data?.signature ?? "with love"}</p>
            <div className="notes-dialog__actions">
              {note.link && (
                <Link className="button-plum" to={note.link} onClick={() => setReading(null)}>
                  Go see it <Icon name="arrow" size={16} />
                </Link>
              )}
              <button className="button-paper" onClick={() => setReading(null)}>
                Fold it back up
              </button>
            </div>
          </article>
        </Modal>
      )}
    </div>
  );
}
