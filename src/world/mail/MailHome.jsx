import { useEffect, useRef } from "react";
import { haptic } from "../../lib/native.js";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";
import { ReactionMark } from "../../shared/ReactionBar.jsx";
import { Icon } from "../../shared/WorldPrimitives.jsx";
import EnvelopeArt, { toneFor } from "./Envelope.jsx";
import JarMini from "./JarMini.jsx";
import { onItsWay, opensIn, when } from "./format.js";
import { rectOf, reducedMotion } from "./Reveal.jsx";

// The root of the app's notes & letters section: the note jar first, as its centrepiece, then
// what's new, every letter and every little note. Josh sees exactly this, plus his pencils, her
// marks, and what's on its way. Everything opens in the middle of the screen (Reveals.jsx), flying
// out of where she tapped it, so each opener passes its own element along.

const NOTES_ON_ROOT = 6;
export const NOTE_KIND = {
  note: { icon: "mail", label: "a little note" },
  update: { icon: "star", label: "something new" },
  surprise: { icon: "heart", label: "a little surprise" },
};
export const letterKind = (letter) =>
  letter.author === "maomao" ? "a maomao-inspired note" : letter.kind === "birthday" ? "a birthday letter" : letter.kind === "open_when" ? "an open-when letter" : "a letter";
export const letterDate = (letter) => letter.unlockAt ?? letter.createdAt;

export function NoteRow({ note, unread, admin, mine = false, onOpen }) {
  const kind = NOTE_KIND[note.kind] ?? NOTE_KIND.note;
  // On Josh's phone her notes say whether she has read them yet; his test notes are his own.
  const status = admin && !mine ? (note.openedAt ? "she read it" : "not opened yet") : null;
  return (
    <li className="app-row app-row--more mail-row" data-unread={unread || undefined}>
      <button type="button" className="mail-row__button" onClick={(event) => onOpen(note, rectOf(event.currentTarget.querySelector(".mail-row__icon") ?? event.currentTarget))}>
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
      : letter.kind === "open_when" && letter.openWhen && !letter.title.toLowerCase().includes(letter.openWhen.toLowerCase())
        ? `open when ${letter.openWhen}`
        : when(letterDate(letter));
  const herMark = admin && letter.author !== "maomao" && !letter.locked ? (letter.openedAt ? "she opened it" : "not opened yet") : null;
  return (
    <li>
      <button type="button" className="mail-letter" data-locked={letter.locked || undefined} onClick={(event) => onOpen(letter, rectOf(event.currentTarget.querySelector(".envelope-art")))}>
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

/** The jar's little facts wear tiny drawn icons (no font has to carry the symbols). */
function FactIcon({ name }) {
  const paths = {
    notes: <path d="M3 5.5h10v7H3zM3 5.5l5 3.6 5-3.6" />,
    heart: <path d="M8 13s-5-3.1-5-6.6A2.6 2.6 0 0 1 8 5a2.6 2.6 0 0 1 5 1.4C13 9.9 8 13 8 13Z" />,
    pulled: <path d="M8 13V5.5M5 8l3-3 3 3M4 13h8" />,
    always: <path d="M8 8c-1.4-1.9-2.4-2.6-3.6-2.6a2.6 2.6 0 0 0 0 5.2C5.6 10.6 6.6 9.9 8 8Zm0 0c1.4 1.9 2.4 2.6 3.6 2.6a2.6 2.6 0 0 0 0-5.2C10.4 5.4 9.4 6.1 8 8Z" />,
    mood: (
      <>
        <circle cx="8" cy="8" r="5.2" />
        <path d="M6 6.8v.4M10 6.8v.4M5.9 9.4q2.1 1.9 4.2 0" />
      </>
    ),
  };
  return (
    <svg className="mail-jar__icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/**
 * The note jar's island: the jar itself (bigger, and a button: a tap pulls a note out, straight
 * into the middle of the screen), what's in it, and the little facts that used to sit under the
 * jar's own page (no daily limit, how many notes, picked for her mood), all before she taps.
 */
function JarIsland({ jar, fresh, admin, from, greet, onPull, onWrite }) {
  const { current: feeling, open: openFeeling } = useDailyStyle();
  const art = useRef(null);
  const data = jar.data;
  const total = data?.total ?? 0;
  const empty = jar.isSuccess && !total && !admin;
  const pulled = data?.pulled ?? 0;

  // The jar reacts to every pull: a squash, the lid pops, a puff of hearts (under the veil).
  const bounce = (big = true) => {
    const svg = art.current?.querySelector(".jar-mini");
    if (!svg || reducedMotion()) return;
    svg.animate(
      big
        ? [{ transform: "none" }, { transform: "scale(1.06, 0.9)", offset: 0.22 }, { transform: "translateY(-8px) scale(0.96, 1.06)", offset: 0.5 }, { transform: "none" }]
        : [{ transform: "none" }, { transform: "rotate(-5deg)", offset: 0.2 }, { transform: "rotate(5deg)", offset: 0.45 }, { transform: "rotate(-2deg)", offset: 0.7 }, { transform: "none" }],
      { duration: big ? 520 : 620, easing: "ease-out" },
    );
    svg.querySelector(".jar-mini__lid-pop")?.animate(
      big ? [{ transform: "none" }, { transform: "translateY(-14px) rotate(-12deg)", offset: 0.35 }, { transform: "translateY(-3px) rotate(4deg)", offset: 0.7 }, { transform: "none" }] : [{ transform: "none" }, { transform: "translateY(-4px)", offset: 0.4 }, { transform: "none" }],
      { duration: big ? 620 : 520, easing: "ease-out" },
    );
    if (big) {
      const puff = art.current.querySelector(".mail-jar__puff");
      puff?.classList.remove("is-on");
      void puff?.getBoundingClientRect();
      puff?.classList.add("is-on");
    }
  };

  useEffect(() => {
    if (!greet) return undefined;
    const timer = setTimeout(() => bounce(false), 450);
    return () => clearTimeout(timer);
  }, [greet]); // eslint-disable-line react-hooks/exhaustive-deps

  const pull = () => {
    if (empty || jar.isPending) {
      haptic("light");
      bounce(false);
      return;
    }
    bounce(true);
    onPull(rectOf(art.current?.querySelector(".jar-mini"), { x: 0.36, y: 0.2, w: 0.28, h: 0.14 }));
  };

  const line = jar.isPending
    ? "a little love is waiting…"
    : fresh > 0
      ? admin
        ? `${fresh === 1 ? "a new note" : `${fresh} new notes`} she hasn’t pulled yet`
        : `${fresh === 1 ? "a new little note" : `${fresh} new little notes`} from ${from}!`
      : empty
        ? "new little notes are on their way"
        : "for the bright days, the “ugh” days, & everything in between.";
  const label = empty ? "the jar is filling up…" : admin ? "pull a note" : fresh > 0 ? (fresh === 1 ? "pull ur new note" : "pull a new note") : "pull a note";

  return (
    <section className="app-card mail-card mail-jar" id="note-jar" aria-labelledby="mail-jar-title" data-fresh={fresh > 0 || undefined} data-empty={empty || undefined}>
      <div className="mail-jar__art" ref={art}>
        <button type="button" className="mail-jar__jar" onClick={pull} aria-label={empty ? "the note jar, filling up" : `the note jar: ${label}`}>
          <JarMini fresh={fresh} />
        </button>
        <span className="mail-jar__puff" aria-hidden="true">
          <span>♥</span>
          <span>♡</span>
          <span>♥</span>
          <span>✦</span>
        </span>
      </div>
      <span className="mail-jar__eyebrow">the note jar</span>
      <h2 id="mail-jar-title" className="mail-jar__title">a little jar, just for u</h2>
      <p className="mail-jar__line" data-fresh={fresh > 0 || undefined}>
        {line}
      </p>
      <ul className="mail-jar__facts" aria-label="about the jar">
        {admin ? (
          <>
            <li>
              <FactIcon name="notes" /> {total} little {total === 1 ? "note" : "notes"} inside
            </li>
            <li>
              <FactIcon name="always" /> no daily limit
            </li>
            <li>
              <FactIcon name="pulled" /> she’s pulled {pulled}
            </li>
            <li>
              <button type="button" className="mail-jar__mood" onClick={() => onWrite({ kind: "jar" })}>
                <FactIcon name="heart" /> {data?.her?.reacted ? `she reacted to ${data.her.reacted}` : "her reactions"}
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <FactIcon name="notes" /> {empty ? "filling up" : `${total} little ${total === 1 ? "note" : "notes"} inside`}
            </li>
            <li>
              <FactIcon name="always" /> no daily limit
            </li>
            <li>
              <button type="button" className="mail-jar__mood" onClick={openFeeling}>
                {feeling?.feeling?.emoji ? <span aria-hidden="true" className="mail-jar__emoji">{feeling.feeling.emoji}</span> : <FactIcon name="mood" />}
                {feeling?.feeling ? "picked for ur mood" : "a note for ur mood"}
              </button>
            </li>
          </>
        )}
      </ul>
      <button type="button" className="mail-jar__pull" onClick={pull} data-empty={empty || undefined}>
        {label} {!empty && <span aria-hidden="true">♡</span>}
      </button>
      {!admin && !empty && <p className="mail-jar__hint">tap the jar as often as u like</p>}
      {admin && (
        <div className="mail-card__admin">
          <AdminEdit label="add notes to the jar" onClick={() => onWrite({ kind: "jar" })} />
        </div>
      )}
    </section>
  );
}

export default function MailHome({ mail, jar, fresh, newIds, greetJar, onOpenLetter, onOpenNote, onPull, onAllNotes, onWrite, onCancelNote, cancelling }) {
  const { admin, letters, maomao, notes, test, upcoming, signature } = mail;
  const from = signature.toLowerCase();
  const unreadNotes = notes.filter((note) => !note.openedAt).length;
  const unreadLetters = letters.filter((letter) => !letter.locked && !letter.openedAt).length;
  const newLetters = letters.filter((letter) => newIds.has(letter.id));
  const newNotes = notes.filter((note) => newIds.has(note.id));
  // On her phone the jar's new notes count too, as on the tab's badge.
  const newCount = unreadNotes + unreadLetters + (admin ? 0 : fresh);
  // The jar's own news is on the jar itself, the first thing in the section.
  const showNew = newLetters.length + newNotes.length > 0;
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
        <JarIsland jar={jar} fresh={fresh} admin={admin} from={from} greet={greetJar} onPull={onPull} onWrite={onWrite} />

        {showNew ? (
          <section className="app-card mail-card mail-new" aria-labelledby="mail-new-title">
            <header className="app-card__head">
              <h2 className="app-card__title" id="mail-new-title">{admin ? "waiting for her" : "new for you"}</h2>
            </header>
            <ul className="app-list mail-list">
              {newLetters.map((letter) => (
                <li key={letter.id} className="app-row app-row--more mail-row mail-row--letter" data-unread={!letter.openedAt || undefined}>
                  <button type="button" className="mail-row__button" onClick={(event) => onOpenLetter(letter, rectOf(event.currentTarget.querySelector(".envelope-art")))}>
                    <EnvelopeArt className="mail-row__envelope" tone={toneFor(letter)} open={Boolean(letter.openedAt)} reaction={letter.reaction} />
                    <span className="mail-row__text">
                      <span className="mail-row__eyebrow">{admin ? (letter.openedAt ? "she opened it" : "not opened yet") : letter.openedAt ? "opened just now" : `${letterKind(letter)} from ${from}`}</span>
                      <strong>{letter.title}</strong>
                      {letter.kind === "open_when" && letter.openWhen && <span className="mail-row__preview">open when {letter.openWhen}</span>}
                    </span>
                    <span className="mail-row__end">
                      {!letter.openedAt && <span className="mail-dot" aria-label="new" />}
                    </span>
                  </button>
                </li>
              ))}
              {newNotes.map((note) => (
                <NoteRow key={note.id} note={note} unread={!note.openedAt} admin={admin} onOpen={onOpenNote} />
              ))}
            </ul>
          </section>
        ) : (
          !admin &&
          !fresh && (
            <p className="mail-caught-up">
              <span aria-hidden="true">(˘ ᵕ ˘)</span> all caught up. everything’s right here whenever u want it ♡
            </p>
          )
        )}

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
                <li className="app-row app-row--more mail-row mail-row--all">
                  <button type="button" className="mail-row__button" onClick={onAllNotes}>
                    <span className="mail-row__text">
                      <strong>all {notes.length} little notes</strong>
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
                <NoteRow key={note.id} note={note} unread={!note.openedAt} admin={admin} mine onOpen={(item, origin) => onOpenNote(item, origin, { test: true })} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
