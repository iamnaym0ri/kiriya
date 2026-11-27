import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useOpenNote, useReactToNote } from "../../lib/notes.js";
import { useToday } from "../../lib/world.js";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import { useAppBack } from "../../shared/AppFrame.jsx";
import ReactionBar from "../../shared/ReactionBar.jsx";
import { Icon } from "../../shared/WorldPrimitives.jsx";
import SaveMemory from "../chat/SaveMemory.jsx";
import NoteJar from "../today/NoteJar.jsx";
import EnvelopeArt, { EnvelopeOpening, toneFor } from "./Envelope.jsx";
import { NOTE_KIND, NoteRow, letterDate, letterKind } from "./MailHome.jsx";
import { daysUntil, longDate, monthOf, writtenOn } from "./format.js";
import { useOpenLetter, useReactToLetter } from "./useMail.js";

// The pushed screens of the notes & letters section: a letter, a little note, the jar, and every
// little note. Each opens with navigate(url), so the iPhone's edge swipe goes back.

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// Josh sees a sealed letter open the way she will, once per visit, not every time he checks it.
const openedHere = new Set();

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

export function ScreenMessage({ title, children }) {
  return (
    <div className="app-screen mail-screen">
      <ScreenHead title={title} />
      <div className="app-section__body">
        <div className="app-empty">{children}</div>
      </div>
    </div>
  );
}

const GREETING = /^\s*(my\s+)?(dear|dearest|darling|hi\b|hey\b|hello|to\s+my|kiriya|love\b|baby|babe)/i;
const SIGNOFF = /(yours|love|always|xo|forever|♡|❤)/i;

function paragraphsOf(letter) {
  if (Array.isArray(letter.maomao?.body)) return letter.maomao.body;
  return String(letter.body ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function LetterPaper({ letter, signature, unfolding }) {
  const paragraphs = paragraphsOf(letter);
  const maomao = letter.author === "maomao";
  const last = paragraphs.at(-1) ?? "";
  const signedOff = !maomao && last.length < 48 && SIGNOFF.test(last);
  return (
    <article className="letter-sheet" data-tone={toneFor(letter)} data-unfolding={unfolding || undefined}>
      <span className="letter-sheet__sprig" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="34" height="34">
          <path d="M20 36C20 26 21 16 26 5" fill="none" stroke="#8d6aa6" strokeWidth="1.4" strokeLinecap="round" />
          {[[24, 9], [22.6, 14], [21.6, 19], [20.9, 24], [20.4, 29]].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x - 2.6} cy={y} rx="2.3" ry="1.4" fill="#b796d6" transform={`rotate(-35 ${x - 2.6} ${y})`} />
              <ellipse cx={x + 2.4} cy={y - 1} rx="2.3" ry="1.4" fill="#a57fcb" transform={`rotate(35 ${x + 2.4} ${y - 1})`} />
            </g>
          ))}
          <circle cx="26.4" cy="4.6" r="1.8" fill="#c7a6e3" />
        </svg>
      </span>
      {maomao && <p className="letter-sheet__fan">a maomao-inspired birthday note · fan writing</p>}
      {letter.kind === "open_when" && letter.openWhen && <p className="letter-sheet__when">open when {letter.openWhen}</p>}
      {!maomao && !GREETING.test(paragraphs[0] ?? "") && <p className="letter-sheet__greeting">my dearest kiriya,</p>}
      <div className="letter-sheet__body">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      <footer className="letter-sheet__sign">
        {maomao ? (
          letter.maomao?.signoff && <p className="letter-sheet__name">{letter.maomao.signoff}</p>
        ) : (
          <>
            {!signedOff && <p className="letter-sheet__yours">yours, always —</p>}
            <p className="letter-sheet__name">{signature}</p>
          </>
        )}
      </footer>
    </article>
  );
}

export function LetterScreen({ letter, admin, signature, onEdit }) {
  const open = useOpenLetter();
  const react = useReactToLetter();
  const maomao = letter.author === "maomao";
  // A sealed letter opens with its envelope the first time (for Josh, once per visit).
  const [phase, setPhase] = useState(() =>
    !letter.locked && !letter.openedAt && !maomao && !reducedMotion() && !(admin && openedHere.has(letter.id)) ? "envelope" : "open",
  );
  const marked = useRef(false);
  useEffect(() => {
    if (letter.locked || maomao || marked.current) return;
    marked.current = true;
    if (admin) openedHere.add(letter.id);
    else if (!letter.openedAt) open.mutate(letter.id);
  }, [letter.id, letter.locked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = `${letter.title} ♡`;
  }, [letter.title]);

  const edit = !maomao && <AdminEdit label="edit this letter" compact onClick={() => onEdit(letter)} />;
  const from = maomao ? "a maomao-inspired note" : `${letterKind(letter)} from ${signature.toLowerCase()}`;

  if (letter.locked) {
    const days = daysUntil(letter.unlockAt);
    return (
      <div className="app-screen mail-screen mail-screen--letter">
        <ScreenHead title={letter.title} short="a sealed letter" subtitle={`${from} · still sealed`} actions={edit} />
        <div className="app-section__body">
          <div className="mail-sealed">
            <EnvelopeArt tone="locked" locked unlockAt={letter.unlockAt} className="mail-sealed__envelope" />
            <p className="mail-sealed__when">it opens on {longDate(letter.unlockAt)}</p>
            <p className="mail-sealed__count">{days <= 0 ? "later today ♡" : days === 1 ? "that’s tomorrow ♡" : `just ${days} more days ♡`}</p>
            {letter.kind === "open_when" && letter.openWhen && <p className="mail-sealed__note">open when {letter.openWhen}</p>}
            <p className="mail-sealed__note">{admin ? "she sees it waiting, sealed, until that morning." : "some things are worth the wait. it’ll be right here."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen mail-screen mail-screen--letter" data-phase={phase}>
      <ScreenHead title={letter.title} short={maomao ? "a birthday note" : "a letter"} subtitle={`${from}${maomao ? "" : ` · ${writtenOn(letterDate(letter))}`}`} actions={edit} />
      <div className="app-section__body">
        {phase === "envelope" ? (
          <EnvelopeOpening tone={toneFor(letter)} onDone={() => setPhase("unfold")} />
        ) : (
          <>
            <LetterPaper letter={letter} signature={signature} unfolding={phase === "unfold"} />
            {!maomao && (
              <div className="mail-after">
                <ReactionBar
                  what="this letter"
                  reaction={letter.reaction ?? null}
                  onReact={(reaction) => react.mutate({ id: letter.id, reaction })}
                  readOnly={admin}
                  note={admin ? (letter.reaction ? "her reaction ♡ only she can change it." : letter.openedAt ? "she opened it, and hasn’t reacted yet." : "she hasn’t opened it yet.") : null}
                  error={react.isError ? "that reaction didn’t save. try again?" : null}
                />
                {!admin && <SaveMemory kind="letter" sourceId={letter.id} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function NoteScreen({ note, admin, test, signature }) {
  const open = useOpenNote();
  const react = useReactToNote();
  const marked = useRef(false);
  const [unfolding] = useState(() => !note.openedAt && !reducedMotion());
  // Her own notes count as read; on Josh's phone only his test notes do (her notes stay hers).
  const mine = !admin || test;
  useEffect(() => {
    if (marked.current || !mine || note.openedAt) return;
    marked.current = true;
    open.mutate(note.id);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = `${note.title} ♡`;
  }, [note.title]);
  const kind = NOTE_KIND[note.kind] ?? NOTE_KIND.note;
  const paragraphs = note.body.split(/\n{2,}/);
  return (
    <div className="app-screen mail-screen mail-screen--note">
      <ScreenHead title={note.title} short={kind.label} subtitle={`${test ? "a test note" : kind.label} · ${writtenOn(note.at)}`} />
      <div className="app-section__body">
        <article className="note-sheet" data-kind={note.kind} data-unfolding={unfolding || undefined}>
          <span className="note-sheet__tape" aria-hidden="true" />
          <span className="note-sheet__mark" aria-hidden="true">
            <Icon name={kind.icon} size={18} />
          </span>
          <div className="note-sheet__body">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <p className="note-sheet__sign">— {signature.toLowerCase()} ♡</p>
        </article>
        <div className="mail-after">
          <ReactionBar
            what="this note"
            reaction={note.reaction ?? null}
            onReact={(reaction) => react.mutate({ id: note.id, reaction })}
            readOnly={admin && !test}
            note={
              admin && !test
                ? note.reaction
                  ? "her reaction ♡ only she can change it."
                  : note.openedAt
                    ? "she read it, and hasn’t reacted yet."
                    : "she hasn’t opened it yet."
                : test
                  ? "your test note: reacting here tries it out."
                  : null
            }
            error={react.isError && react.variables?.id === note.id ? "that reaction didn’t save. try again?" : null}
          />
          {!admin && <SaveMemory kind="note" sourceId={note.id} />}
          {note.link && (
            <Link className="mail-go" to={note.link}>
              go see it <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function JarScreen({ admin, onEdit }) {
  const today = useToday();
  useEffect(() => {
    document.title = "the note jar ♡";
  }, []);
  return (
    <div className="app-screen mail-screen mail-screen--jar">
      <ScreenHead
        title="a little jar, just for u"
        short="the note jar"
        subtitle="for the bright days, the “ugh” days, & everything in between."
        actions={admin && <AdminEdit label="the jar’s notes" compact onClick={onEdit} />}
      />
      <div className="app-section__body">
        <NoteJar birthday={today.data?.birthday} signature={today.data?.signature} />
      </div>
    </div>
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
