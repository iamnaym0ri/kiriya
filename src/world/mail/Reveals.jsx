import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useOpenNote, useReactToNote } from "../../lib/notes.js";
import { haptic } from "../../lib/native.js";
import { AdminEdit } from "../../shared/admin/AdminEdit.jsx";
import ReactionBar from "../../shared/ReactionBar.jsx";
import { Icon } from "../../shared/WorldPrimitives.jsx";
import SaveMemory from "../chat/SaveMemory.jsx";
import { EnvelopeOpening, toneFor } from "./Envelope.jsx";
import JarMini from "./JarMini.jsx";
import { JarPaper, LetterPaper, MessagePaper, NotePaper, SealedPaper } from "./Papers.jsx";
import { RevealCard, SweptPaper, rectOf, reducedMotion } from "./Reveal.jsx";
import { useOpenLetter, useReactToLetter } from "./useMail.js";

// What opens in the middle of the screen in notes & letters (inside RevealLayer): a note from the
// jar, a little note, a letter. Each is its paper (Papers.jsx) and, once it has unfolded, what goes
// under it: her reaction, "save to our memories", and for the jar "another one". On Josh's phone the
// same, with her reaction shown (only she can change it) and his pencil on letters.

// Josh sees a sealed letter open the way she will, once per visit, not every time he checks it.
const openedHere = new Set();
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** What goes under a paper: hidden (but holding its space) until the paper has opened. */
function After({ shown, children }) {
  return (
    <div className="mail-reveal__after" data-shown={shown || undefined} aria-hidden={!shown || undefined} inert={!shown}>
      {children}
    </div>
  );
}

// ---------- the jar ----------

export function JarReveal({ entry, admin, onAnother, onReact }) {
  const cards = useRef(null);
  const [shownKey, setShownKey] = useState(null);
  const [ghost, setGhost] = useState(null);
  const shown = shownKey === entry.key && Boolean(entry.note);

  const another = (event) => {
    const card = cards.current?.querySelector(".reveal-card");
    const box = cards.current?.getBoundingClientRect();
    const rect = rectOf(card);
    if (rect && box && entry.note) setGhost({ key: entry.key, entry, rect: { ...rect, left: rect.left - box.left, top: rect.top - box.top } });
    onAnother(rectOf(event.currentTarget.querySelector(".jar-mini"), { x: 0.3, y: 0.15, w: 0.4, h: 0.2 }));
  };

  let after = null;
  if (entry.status === "empty") after = null;
  else if (admin || entry.status === "preview") {
    const her = entry.her;
    const note = entry.sample
      ? "a sample: her jar is empty right now. add a few notes ♡"
      : entry.status === "preview" && !admin
        ? "a peek at her jar: nothing changes for her."
        : !her
          ? "a peek at her jar: nothing changes for her."
          : her.reaction
            ? `her reaction ♡ she’s pulled this one ${times(her.pulls)}.`
            : her.pulls
              ? `she’s pulled this one ${times(her.pulls)}, no reaction yet.`
              : "she hasn’t pulled this one yet.";
    after = <ReactionBar what="this note" reaction={her?.reaction ?? null} onReact={() => {}} readOnly note={note} />;
  } else {
    after = (
      <ReactionBar
        what="this note"
        reaction={entry.reaction ?? null}
        onReact={onReact}
        error={entry.reactionError ?? (entry.status === "failed" ? entry.error : null)}
      />
    );
  }

  return (
    <>
      <div ref={cards} className="mail-reveal__cards" data-status={entry.status}>
        {ghost && <SweptPaper key={ghost.key} rect={ghost.rect} paper={() => <JarPaper entry={ghost.entry} admin={admin} />} onGone={() => setGhost(null)} />}
        {entry.status === "empty" ? (
          <RevealCard key={entry.key} mode="rise" origin={entry.origin} onShown={() => setShownKey(entry.key)} paper={() => (
            <MessagePaper title="the jar is filling up…">
              <p>new little notes are on their way. one small note at a time, written just for u ♡</p>
            </MessagePaper>
          )} />
        ) : entry.note ? (
          <RevealCard key={entry.key} origin={entry.origin} onShown={() => { setShownKey(entry.key); haptic("light"); }} paper={() => <JarPaper entry={entry} admin={admin} />} />
        ) : (
          <div key={`${entry.key}-finding`} className="jar-finding" role="status">
            <span className="jar-finding__note" aria-hidden="true" />
            <span>finding a little note for u…</span>
          </div>
        )}
      </div>
      <After shown={shown || entry.status === "empty"}>
        {after}
        <div className="mail-reveal__row">
          {!admin && entry.status === "kept" && entry.record && <SaveMemory key={entry.record.id} kind="jar" sourceId={entry.record.id} className="mail-reveal__pill save-memory" />}
          {entry.status !== "empty" && (
            <button type="button" className="mail-reveal__pill mail-reveal__pill--jar" onClick={another}>
              <JarMini />
              another one <span aria-hidden="true">♡</span>
            </button>
          )}
        </div>
      </After>
    </>
  );
}

// ---------- a little note ----------

export function NoteReveal({ note, admin, test, signature, origin, onClose }) {
  const open = useOpenNote();
  const react = useReactToNote();
  const marked = useRef(false);
  const [shown, setShown] = useState(false);
  // Her own notes count as read; on Josh's phone only his test notes do (her notes stay hers).
  const mine = !admin || test;
  useEffect(() => {
    if (marked.current || !mine || note.openedAt) return;
    marked.current = true;
    open.mutate(note.id);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="mail-reveal__cards">
        <RevealCard origin={origin} onShown={() => setShown(true)} paper={() => <NotePaper note={note} test={test} signature={signature} />} />
      </div>
      <After shown={shown}>
        <ReactionBar
          what="this note"
          reaction={note.reaction ?? null}
          onReact={(reaction) => {
            haptic("light");
            react.mutate({ id: note.id, reaction });
          }}
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
        {(!test || note.link) && (
          <div className="mail-reveal__row">
            {!test && <SaveMemory kind="note" sourceId={note.id} className="mail-reveal__pill save-memory" />}
            {note.link && (
              <Link className="mail-reveal__pill mail-reveal__pill--go" to={note.link} onClick={() => onClose?.()}>
                go see it <Icon name="arrow" size={16} />
              </Link>
            )}
          </div>
        )}
      </After>
    </>
  );
}

// ---------- a letter ----------

export function LetterReveal({ letter, admin, signature, origin, onEdit }) {
  const open = useOpenLetter();
  const react = useReactToLetter();
  const maomao = letter.author === "maomao";
  // A sealed letter opens with its envelope the first time (for Josh, once per visit).
  const [stage, setStage] = useState(() =>
    letter.locked
      ? { phase: "sealed", origin }
      : !letter.openedAt && !maomao && !reducedMotion() && !(admin && openedHere.has(letter.id))
        ? { phase: "envelope", origin: null, envelope: true }
        : { phase: "paper", origin },
  );
  const [shown, setShown] = useState(false);
  const marked = useRef(false);
  useEffect(() => {
    if (letter.locked || maomao || marked.current) return;
    marked.current = true;
    if (admin) openedHere.add(letter.id);
    else if (!letter.openedAt) open.mutate(letter.id);
  }, [letter.id, letter.locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = !maomao && admin && <AdminEdit label="edit this letter" onClick={() => onEdit(letter)} />;
  const reactable = !maomao && !letter.locked;
  return (
    <>
      <div className="mail-reveal__cards">
        {stage.phase === "sealed" ? (
          <RevealCard mode="rise" origin={stage.origin} onShown={() => setShown(true)} paper={() => <SealedPaper letter={letter} admin={admin} signature={signature} />} />
        ) : (
          <RevealCard
            origin={stage.origin}
            hold={stage.phase === "envelope"}
            sticker={maomao ? "✦" : "heart"}
            onShown={() => setShown(true)}
            paper={() => <LetterPaper letter={letter} signature={signature} />}
          />
        )}
        {stage.envelope && (
          <EnvelopeOpening
            tone={toneFor(letter)}
            origin={origin}
            leaving={stage.phase !== "envelope"}
            onDone={(paper) => {
              setStage({ phase: "paper", origin: paper, envelope: true });
              setTimeout(() => setStage((current) => ({ ...current, envelope: false })), 520);
            }}
          />
        )}
      </div>
      <After shown={shown}>
        {reactable && (
          <ReactionBar
            what="this letter"
            reaction={letter.reaction ?? null}
            onReact={(reaction) => {
              haptic("light");
              react.mutate({ id: letter.id, reaction });
            }}
            readOnly={admin}
            note={admin ? (letter.reaction ? "her reaction ♡ only she can change it." : letter.openedAt ? "she opened it, and hasn’t reacted yet." : "she hasn’t opened it yet.") : null}
            error={react.isError ? "that reaction didn’t save. try again?" : null}
          />
        )}
        {(reactable || edit) && (
          <div className="mail-reveal__row">
            {reactable && <SaveMemory kind="letter" sourceId={letter.id} className="mail-reveal__pill save-memory" />}
            {edit}
          </div>
        )}
      </After>
    </>
  );
}

// ---------- a quiet message (something that isn't there any more) ----------

export function MessageReveal({ title, text, origin }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <div className="mail-reveal__cards">
        <RevealCard mode="rise" origin={origin} onShown={() => setShown(true)} paper={() => (
          <MessagePaper title={title}>
            <p>{text}</p>
          </MessagePaper>
        )} />
      </div>
      <After shown={shown} />
    </>
  );
}
