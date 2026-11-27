import { useLayoutEffect, useRef } from "react";
import { Icon } from "../../shared/WorldPrimitives.jsx";
import EnvelopeArt, { toneFor } from "./Envelope.jsx";
import { NOTE_KIND, letterDate, letterKind } from "./MailHome.jsx";
import { daysUntil, longDate, writtenOn } from "./format.js";

// The papers that open in the middle of the screen (Reveals.jsx): a jar note, a little note, a
// letter, a sealed letter and a quiet message. Each is drawn the same way every time it's called:
// the reveal draws it once more per panel while it unfolds. Long ones scroll inside their paper.

/**
 * The scrolling part of a paper. Marks whether there's more above or below, so the edge softly
 * fades (and says so to VoiceOver as a scroll area).
 */
export function ScrollArea({ className = "", children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const mark = () => {
      const more = node.scrollHeight - node.clientHeight > 2;
      node.dataset.below = more && node.scrollTop + node.clientHeight < node.scrollHeight - 2 ? "1" : "";
      node.dataset.above = more && node.scrollTop > 2 ? "1" : "";
      node.tabIndex = more ? 0 : -1;
    };
    mark();
    node.addEventListener("scroll", mark, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(mark) : null;
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", mark);
      observer?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={`reveal-scroll ${className}`.trim()}>
      {children}
    </div>
  );
}

const jarDay = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long", timeZone: "Asia/Singapore" });

/** A note from the jar, on the jar's cream paper. */
export function JarPaper({ entry, admin }) {
  const note = entry.note;
  const label = entry.sample ? "a sample note" : admin || entry.status === "preview" ? "a peek into her jar" : note.label;
  const foot = [
    entry.record?.at ? jarDay.format(new Date(entry.record.at)).toLowerCase() : null,
    entry.fresh && !admin ? "a brand new one ♡" : entry.revisited && !admin ? "a little favourite, revisited" : null,
  ].filter(Boolean);
  return (
    <article className="reveal-paper jar-paper" data-sample={entry.sample || undefined}>
      <span className="reveal-paper__tape" aria-hidden="true" />
      <ScrollArea className="jar-paper__scroll">
        <p className="jar-paper__label">{label}</p>
        <p className="jar-paper__hey">hey, u.</p>
        <p className="jar-paper__text">{note.text}</p>
        <p className="jar-paper__byline">{note.byline}</p>
        {foot.length > 0 && <p className="jar-paper__foot">{foot.join(" · ")}</p>}
      </ScrollArea>
    </article>
  );
}

/** A little note (or an update, or a surprise), on notepad paper with a strip of tape. */
export function NotePaper({ note, test, signature }) {
  const kind = NOTE_KIND[note.kind] ?? NOTE_KIND.note;
  const paragraphs = String(note.body ?? "").split(/\n{2,}/);
  return (
    <article className="reveal-paper note-sheet" data-kind={note.kind}>
      <span className="reveal-paper__tape note-sheet__tape" aria-hidden="true" />
      <span className="note-sheet__mark" aria-hidden="true">
        <Icon name={kind.icon} size={17} />
      </span>
      <ScrollArea className="note-sheet__scroll">
        <p className="note-sheet__meta">
          {test ? "a test note" : kind.label} · {writtenOn(note.at)}
        </p>
        <h2 className="note-sheet__title">{note.title}</h2>
        <div className="note-sheet__body">
          {paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
        <p className="note-sheet__sign">— {signature.toLowerCase()} ♡</p>
      </ScrollArea>
    </article>
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

function Sprig() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
      <path d="M20 36C20 26 21 16 26 5" fill="none" stroke="#8d6aa6" strokeWidth="1.4" strokeLinecap="round" />
      {[[24, 9], [22.6, 14], [21.6, 19], [20.9, 24], [20.4, 29]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x - 2.6} cy={y} rx="2.3" ry="1.4" fill="#b796d6" transform={`rotate(-35 ${x - 2.6} ${y})`} />
          <ellipse cx={x + 2.4} cy={y - 1} rx="2.3" ry="1.4" fill="#a57fcb" transform={`rotate(35 ${x + 2.4} ${y - 1})`} />
        </g>
      ))}
      <circle cx="26.4" cy="4.6" r="1.8" fill="#c7a6e3" />
    </svg>
  );
}

/** A letter on its writing paper; a long one scrolls inside it. */
export function LetterPaper({ letter, signature }) {
  const paragraphs = paragraphsOf(letter);
  const maomao = letter.author === "maomao";
  const last = paragraphs.at(-1) ?? "";
  const signedOff = !maomao && last.length < 48 && SIGNOFF.test(last);
  return (
    <article className="reveal-paper letter-sheet" data-tone={toneFor(letter)}>
      <ScrollArea className="letter-sheet__scroll">
        <span className="letter-sheet__sprig">
          <Sprig />
        </span>
        <p className="letter-sheet__meta">{maomao ? "a maomao-inspired birthday note · fan writing" : `${letterKind(letter)} · ${writtenOn(letterDate(letter))}`}</p>
        <h2 className="letter-sheet__title">{letter.title}</h2>
        {letter.kind === "open_when" && letter.openWhen && !letter.title.toLowerCase().includes(letter.openWhen.toLowerCase()) && (
          <p className="letter-sheet__when">open when {letter.openWhen}</p>
        )}
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
      </ScrollArea>
    </article>
  );
}

/** A letter that isn't ready yet: its envelope with the date seal, and how long to wait. */
export function SealedPaper({ letter, admin, signature }) {
  const days = daysUntil(letter.unlockAt);
  return (
    <article className="reveal-paper sealed-paper">
      <ScrollArea className="sealed-paper__scroll">
        <EnvelopeArt tone="locked" locked unlockAt={letter.unlockAt} className="sealed-paper__envelope" />
        <p className="sealed-paper__from">{`${letterKind(letter)} from ${signature.toLowerCase()}`}</p>
        <h2 className="sealed-paper__title">{letter.title}</h2>
        <p className="sealed-paper__when">it opens on {longDate(letter.unlockAt)}</p>
        <p className="sealed-paper__count">{days <= 0 ? "later today ♡" : days === 1 ? "that’s tomorrow ♡" : `just ${days} more days ♡`}</p>
        {letter.kind === "open_when" && letter.openWhen && <p className="sealed-paper__note">open when {letter.openWhen}</p>}
        <p className="sealed-paper__note">{admin ? "she sees it waiting, sealed, until that morning." : "some things are worth the wait. it’ll be right here."}</p>
      </ScrollArea>
    </article>
  );
}

/** A small paper with a few words: a note that isn't there any more, the jar being empty. */
export function MessagePaper({ title, children }) {
  return (
    <article className="reveal-paper message-paper">
      <span className="reveal-paper__tape" aria-hidden="true" />
      <ScrollArea className="message-paper__scroll">
        <h2 className="message-paper__title">{title}</h2>
        {children}
      </ScrollArea>
    </article>
  );
}
