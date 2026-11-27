import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import { ReactionMark } from "../../shared/ReactionBar.jsx";
import { Icon } from "../../shared/WorldPrimitives.jsx";
import EnvelopeArt, { toneFor } from "./Envelope.jsx";
import JarMini from "./JarMini.jsx";
import { onItsWay, opensIn, when } from "./format.js";

// The root of the app's notes & letters section: what's new on top, the note jar, then every letter
// and little note. Josh sees exactly this, plus his pencils, her marks, and what's on its way.

const NOTES_ON_ROOT = 6;
export const NOTE_KIND = {
  note: { icon: "mail", label: "a little note" },
  update: { icon: "star", label: "something new" },
  surprise: { icon: "heart", label: "a little surprise" },
};
export const letterKind = (letter) =>
  letter.author === "maomao" ? "a maomao-inspired note" : letter.kind === "birthday" ? "a birthday letter" : letter.kind === "open_when" ? "an open-when letter" : "a letter";
export const letterDate = (letter) => letter.unlockAt ?? letter.createdAt;

function Chevron() {
  return (
    <svg className="mail-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NoteRow({ note, unread, admin, mine = false, onOpen }) {
  const kind = NOTE_KIND[note.kind] ?? NOTE_KIND.note;
  // On Josh's phone her notes say whether she has read them yet; his test notes are his own.
  const status = admin && !mine ? (note.openedAt ? "she read it" : "not opened yet") : null;
  return (
    <li className="app-row mail-row" data-unread={unread || undefined}>
      <button type="button" className="mail-row__button" onClick={() => onOpen(note)}>
        <span className="mail-row__icon" data-kind={note.kind} aria-hidden="true">
          <Icon name={kind.icon} size={18} />
        </span>
        <span className="mail-row__text">
          <span className="mail-row__top">
            <strong>{note.title}</strong>
            <time dateTime={note.at}>{when(note.at)}</time>
          </span>
          <span className="mail-row__preview">{note.body}</span>
          {status && <span className="mail-row__status" data-read={Boolean(note.openedAt) || undefined}>{status}</span>}
        </span>
        <span className="mail-row__end">
          {unread && <span className="mail-dot" aria-label="new" />}
          <ReactionMark reaction={note.reaction} className="mail-row__reaction" />
          <Chevron />
        </span>
      </button>
    </li>
  );
}

function LetterTile({ letter, admin, isNew, onOpen }) {
  const meta = letter.locked
    ? opensIn(letter.unlockAt)
    : letter.author === "maomao"
      ? "fan writing ♡"
      : letter.kind === "open_when" && letter.openWhen
        ? `open when ${letter.openWhen}`
        : when(letterDate(letter));
  const herMark = admin && letter.author !== "maomao" && !letter.locked ? (letter.openedAt ? "she opened it" : "still sealed") : null;
  return (
    <li>
      <button type="button" className="mail-letter" data-locked={letter.locked || undefined} onClick={() => onOpen(letter)}>
        <EnvelopeArt
          tone={toneFor(letter)}
          open={Boolean(letter.openedAt) && !letter.locked}
          locked={letter.locked}
          unlockAt={letter.unlockAt}
          reaction={letter.reaction}
        />
        {isNew && <span className="mail-badge">new</span>}
        <span className="mail-letter__title">{letter.title}</span>
        <span className="mail-letter__meta">{meta}</span>
        {herMark && <span className="mail-letter__her" data-read={Boolean(letter.openedAt) || undefined}>{herMark}</span>}
      </button>
    </li>
  );
}

export default function MailHome({ mail, jar, fresh, newIds, onOpenLetter, onOpenNote, onOpenJar, onAllNotes, onWrite, onCancelNote, cancelling }) {
  const { admin, letters, maomao, notes, test, upcoming, signature } = mail;
  const from = signature.toLowerCase();
  const unreadNotes = notes.filter((note) => !note.openedAt).length;
  const unreadLetters = letters.filter((letter) => !letter.locked && !letter.openedAt).length;
  const newLetters = letters.filter((letter) => newIds.has(letter.id));
  const newNotes = notes.filter((note) => newIds.has(note.id));
  const newCount = unreadNotes + unreadLetters;
  const showNew = newLetters.length + newNotes.length > 0 || fresh > 0;
  const allLetters = maomao ? [...letters, { id: "maomao", author: "maomao", kind: "note", title: maomao.title, maomao }] : letters;

  const subtitle = admin
    ? newCount > 0
      ? `${newCount} she hasn’t opened yet`
      : "everything you sent her, as she sees it"
    : newCount > 0
      ? `${newCount === 1 ? "something new" : `${newCount} new things`} from ${from} ♡`
      : `everything ${from} wrote you, kept safe`;

  return (
    <>
      <header className="app-section__head mail-head">
        <h1 className="app-section__title">notes &amp; letters</h1>
        <p className="app-section__subtitle">{subtitle}</p>
      </header>
      <div className="app-section__body mail-body">
        {showNew ? (
          <section className="app-card mail-card mail-new" aria-labelledby="mail-new-title">
            <header className="app-card__head">
              <h2 className="app-card__title" id="mail-new-title">{admin ? "waiting for her" : "new for you"}</h2>
            </header>
            <ul className="app-list mail-list">
              {newLetters.map((letter) => (
                <li key={letter.id} className="app-row mail-row mail-row--letter" data-unread={!letter.openedAt || undefined}>
                  <button type="button" className="mail-row__button" onClick={() => onOpenLetter(letter)}>
                    <EnvelopeArt className="mail-row__envelope" tone={toneFor(letter)} open={Boolean(letter.openedAt)} reaction={letter.reaction} />
                    <span className="mail-row__text">
                      <span className="mail-row__eyebrow">{admin ? (letter.openedAt ? "she opened it" : "not opened yet") : letter.openedAt ? "opened just now" : `${letterKind(letter)} from ${from}`}</span>
                      <strong>{letter.title}</strong>
                      {letter.kind === "open_when" && letter.openWhen && <span className="mail-row__preview">open when {letter.openWhen}</span>}
                    </span>
                    <span className="mail-row__end">
                      {!letter.openedAt && <span className="mail-dot" aria-label="new" />}
                      <Chevron />
                    </span>
                  </button>
                </li>
              ))}
              {newNotes.map((note) => (
                <NoteRow key={note.id} note={note} unread={!note.openedAt} admin={admin} onOpen={onOpenNote} />
              ))}
              {fresh > 0 && (
                <li className="app-row mail-row" data-unread>
                  <button type="button" className="mail-row__button" onClick={onOpenJar}>
                    <span className="mail-row__icon mail-row__icon--jar" aria-hidden="true">✿</span>
                    <span className="mail-row__text">
                      <strong>{fresh === 1 ? "a new little note in your jar" : `${fresh} new little notes in your jar`}</strong>
                      <span className="mail-row__preview">{admin ? "she hasn’t pulled them yet" : "pull one whenever u like ♡"}</span>
                    </span>
                    <span className="mail-row__end">
                      <span className="mail-dot" aria-label="new" />
                      <Chevron />
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        ) : (
          !admin && (
            <p className="mail-caught-up">
              <span aria-hidden="true">(˘ ᵕ ˘)</span> all caught up. everything’s right here whenever u want it ♡
            </p>
          )
        )}

        <section className="app-card mail-card mail-jar" aria-labelledby="mail-jar-title">
          <button type="button" className="mail-jar__open" onClick={onOpenJar} aria-describedby="mail-jar-line">
            <JarMini fresh={fresh} />
            <span className="mail-jar__text">
              <span className="mail-jar__eyebrow">the note jar</span>
              <strong id="mail-jar-title">a little jar, just for u</strong>
              <span id="mail-jar-line" className="mail-jar__line" data-fresh={fresh > 0 || undefined}>
                {jar.isPending
                  ? "a little love is waiting…"
                  : fresh > 0
                    ? `${fresh === 1 ? "a new little note" : `${fresh} new little notes`} from ${from}!`
                    : jar.data?.total
                      ? "pull a little note, any time"
                      : "new little notes are on their way"}
              </span>
              <span className="mail-jar__pull">pull a note ♡</span>
            </span>
          </button>
          {admin && (
            <div className="mail-card__admin">
              <AdminEdit label="add notes to the jar" onClick={() => onWrite({ kind: "jar" })} />
            </div>
          )}
        </section>

        <section className="app-card mail-card mail-letters" aria-labelledby="mail-letters-title">
          <header className="app-card__head">
            <h2 className="app-card__title" id="mail-letters-title">letters</h2>
            <div className="app-card__action">
              <AdminEdit label="write a letter" onClick={() => onWrite({ kind: "letter" })} />
            </div>
          </header>
          <div className="app-card__body">
            {letters.length === 0 && (
              <p className="mail-empty">{admin ? "no letters yet. the first one you seal shows up here." : `${from}’s letter is still being written. it’ll be here the moment it’s sealed ♡`}</p>
            )}
            <ul className="mail-letters__grid">
              {allLetters.map((letter) => (
                <LetterTile key={letter.id} letter={letter} admin={admin} isNew={!admin && !letter.locked && !letter.openedAt && letter.author !== "maomao"} onOpen={onOpenLetter} />
              ))}
            </ul>
          </div>
        </section>

        {admin && upcoming.length > 0 && (
          <section className="app-card mail-card mail-upcoming" aria-labelledby="mail-upcoming-title">
            <header className="app-card__head">
              <h2 className="app-card__title" id="mail-upcoming-title">on its way to her</h2>
            </header>
            <ul className="app-list mail-list">
              {upcoming.map((note) => (
                <li key={note.id} className="app-row mail-row mail-row--upcoming">
                  <div className="mail-row__button" role="group" aria-label={note.title}>
                    <span className="mail-row__icon" data-kind={note.kind} aria-hidden="true">
                      <Icon name="lock" size={17} />
                    </span>
                    <span className="mail-row__text">
                      <span className="mail-row__eyebrow">{onItsWay(note.at)}</span>
                      <strong>{note.title}</strong>
                      <span className="mail-row__preview">{note.body}</span>
                    </span>
                    <button
                      type="button"
                      className="mail-row__cancel"
                      disabled={cancelling}
                      onClick={() => window.confirm(`Cancel “${note.title}”? It won’t reach her.`) && onCancelNote(note.id)}
                    >
                      cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="app-card mail-card mail-notes" aria-labelledby="mail-notes-title">
          <header className="app-card__head">
            <h2 className="app-card__title" id="mail-notes-title">little notes</h2>
            <div className="app-card__action">
              <AdminEdit label="send a note" onClick={() => onWrite({ kind: "note" })} />
            </div>
          </header>
          {notes.length === 0 ? (
            <div className="app-card__body">
              <p className="mail-empty">{admin ? "nothing sent yet. your first little note lands here (and on her phone)." : "nothing here yet. when a little note finds your phone, it’s kept right here too ♡"}</p>
            </div>
          ) : (
            <ul className="app-list mail-list">
              {notes.slice(0, NOTES_ON_ROOT).map((note) => (
                <NoteRow key={note.id} note={note} unread={!admin && !note.openedAt} admin={admin} onOpen={onOpenNote} />
              ))}
              {notes.length > NOTES_ON_ROOT && (
                <li className="app-row mail-row mail-row--more">
                  <button type="button" className="mail-row__button" onClick={onAllNotes}>
                    <span className="mail-row__text">
                      <strong>all {notes.length} little notes</strong>
                    </span>
                    <span className="mail-row__end">
                      <Chevron />
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>

        {admin && test.length > 0 && (
          <section className="app-card mail-card mail-test" aria-labelledby="mail-test-title">
            <header className="app-card__head">
              <h2 className="app-card__title" id="mail-test-title">your test notes</h2>
              <p className="mail-card__note">only on your phone</p>
            </header>
            <ul className="app-list mail-list">
              {test.slice(0, 5).map((note) => (
                <NoteRow key={note.id} note={note} unread={!note.openedAt} admin={admin} mine onOpen={(item) => onOpenNote(item, { test: true })} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
