import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { haptic } from "../../lib/native.js";
import MailHome from "./MailHome.jsx";
import { AllNotesScreen } from "./MailScreens.jsx";
import { JarEditor, LetterEditor, NoteComposer } from "./MailAdmin.jsx";
import { RevealLayer } from "./Reveal.jsx";
import { JarReveal, LetterReveal, MessageReveal, NoteReveal } from "./Reveals.jsx";
import { useJar } from "./useJar.js";
import { letterIdOf, useCancelNote, useMail } from "./useMail.js";
import { onItsWay, opensIn } from "./format.js";
import "./Mail.css";
import "./Reveal.css";

// The app's "notes & letters" section (docs/refactor/RENOVATION.md, owner: the mail agent): her
// letters and little notes, what's new on top, their whole history, her reactions, and the note jar.
// Josh sees exactly the same, plus the pencils to write, send and fill the jar from his phone.
//
// A jar note, a little note or a letter opens in the middle of the screen, over the section
// (Reveal.jsx, Reveals.jsx), not on a page of its own. Old addresses still land right:
//   /world/mail?letter=<id>        opens that letter (maomao: her birthday note)
//   /world/mail?note=<id>          opens that little note (a letter's announcement opens the letter)
//   /world/mail?jar=1, #note-jar   the section, with the jar saying hello at the top
//   /world/mail?notes=all          every little note (a pushed screen)
//   /world/mail?compose=note|letter|jar   Josh's composer, opened on arrival (his admin tab links here)

const COMPOSERS = new Set(["note", "letter", "jar"]);
const LINK_PARAMS = ["letter", "note", "jar"];

function Toast({ message }) {
  if (!message) return null;
  return (
    <p className="mail-toast" role="status">
      {message}
    </p>
  );
}

function RootSkeleton() {
  return (
    <div className="app-section app-section--mail mail" aria-busy="true">
      <header className="app-section__head">
        <h1 className="app-section__title">notes &amp; letters</h1>
        <p className="app-section__subtitle">opening your mailbox…</p>
      </header>
      <div className="app-section__body">
        <div className="app-card mail-skeleton mail-skeleton--tall" />
        <div className="app-card mail-skeleton" />
      </div>
    </div>
  );
}

export default function MailSection() {
  const mail = useMail();
  const jar = useJar({ admin: mail.admin });
  const cancel = useCancelNote();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState(null); // { kind: "note" | "letter" | "jar", letterId? }
  const [reveal, setReveal] = useState(null); // { kind: "jar" | "letter" | "note" | "message", … }
  const [greetJar, setGreetJar] = useState(0);
  const [toast, setToast] = useState("");
  const sticky = useRef(new Set());

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const allParam = params.get("notes") === "all";
  const compose = mail.admin && COMPOSERS.has(params.get("compose")) ? params.get("compose") : null;

  useEffect(() => {
    if (!allParam) document.title = "notes & letters ♡";
  }, [allParam]);

  // A notification, a widget or an old link: open what it points at in the middle of the screen,
  // then tidy the address so the section underneath is just the section.
  const linked = LINK_PARAMS.some((key) => params.has(key)) || location.hash === "#note-jar";
  useLayoutEffect(() => {
    if (!linked || mail.pending) return;
    const letterId = params.get("letter");
    const noteId = params.get("note");
    if (letterId) {
      const letter = letterId === "maomao" ? (mail.maomao && { id: "maomao" }) : mail.letters.find((item) => item.id === letterId);
      setReveal(letter ? { kind: "letter", id: letter.id, origin: null } : { kind: "message", title: "this letter isn’t here any more", text: "it may have been tucked away. everything else is right where you left it ♡" });
    } else if (noteId) {
      const note = mail.notes.find((item) => item.id === noteId);
      const announcement = !note && mail.announcements.find((item) => item.id === noteId);
      const announced = announcement && mail.letters.find((item) => item.id === letterIdOf(announcement));
      const test = !note && !announced && mail.test.find((item) => item.id === noteId);
      setReveal(
        note
          ? { kind: "note", id: note.id, origin: null }
          : announced
            ? { kind: "letter", id: announced.id, origin: null }
            : test
              ? { kind: "note", id: test.id, test: true, origin: null }
              : { kind: "message", title: "this note isn’t here any more", text: "it may be an old one. all your little notes are right here ♡" },
      );
    } else setGreetJar((n) => n + 1);
    const next = new URLSearchParams(params);
    for (const key of LINK_PARAMS) next.delete(key);
    const search = next.toString();
    navigate({ pathname: "/world/mail", search: search ? `?${search}` : "" }, { replace: true });
  }, [linked, mail.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // What was new when she came in stays in "new for you" until she leaves the section, so the
  // list doesn't jump about under her thumb as she reads.
  if (!mail.pending) {
    for (const letter of mail.letters) if (!letter.locked && !letter.openedAt) sticky.current.add(letter.id);
    for (const note of mail.notes) if (!note.openedAt) sticky.current.add(note.id);
  }

  const openSheet = (next) => {
    haptic("light");
    setSheet(next);
  };
  const activeSheet = sheet ?? (compose ? { kind: compose } : null);
  const closeSheet = () => {
    setSheet(null);
    if (compose) {
      const next = new URLSearchParams(params);
      next.delete("compose");
      setParams(next, { replace: true });
    }
  };

  const openLetter = (letter, origin = null) => {
    haptic("light");
    setReveal({ kind: "letter", id: letter.id, origin });
  };
  const openNote = (note, origin = null, { test = false } = {}) => {
    haptic("light");
    setReveal({ kind: "note", id: note.id, test, origin });
  };
  const pull = (origin) => {
    jar.pull(origin);
    setReveal({ kind: "jar" });
  };
  const closeReveal = () => setReveal(null);
  useEffect(() => {
    if (!reveal && jar.entry) {
      const timer = setTimeout(jar.close, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [reveal, jar.entry, jar.close]);

  // ---------- what's open in the middle of the screen ----------
  let revealed = null;
  let label = "";
  if (reveal?.kind === "jar" && jar.entry) {
    label = "a note from the jar";
    revealed = <JarReveal entry={jar.entry} admin={mail.admin} onAnother={(origin) => jar.pull(origin)} onReact={jar.react} />;
  } else if (reveal?.kind === "letter") {
    const letter =
      reveal.id === "maomao" && mail.maomao
        ? { id: "maomao", author: "maomao", kind: "note", title: mail.maomao.title, maomao: mail.maomao }
        : mail.letters.find((item) => item.id === reveal.id);
    label = letter ? letter.title : "a letter";
    revealed = letter ? (
      <LetterReveal key={letter.id} letter={letter} admin={mail.admin} signature={mail.signature} origin={reveal.origin} onEdit={(item) => openSheet({ kind: "letter", letterId: item.id })} />
    ) : (
      <MessageReveal key="gone" title="this letter isn’t here any more" text="it may have been tucked away. everything else is right where you left it ♡" />
    );
  } else if (reveal?.kind === "note") {
    const note = (reveal.test ? mail.test : mail.notes).find((item) => item.id === reveal.id);
    label = note ? note.title : "a little note";
    revealed = note ? (
      <NoteReveal key={note.id} note={note} admin={mail.admin} test={reveal.test} signature={mail.signature} origin={reveal.origin} onClose={closeReveal} />
    ) : (
      <MessageReveal key="gone" title="this note isn’t here any more" text="it may be an old one. all your little notes are right here ♡" />
    );
  } else if (reveal?.kind === "message") {
    label = reveal.title;
    revealed = <MessageReveal key={reveal.title} title={reveal.title} text={reveal.text} origin={reveal.origin} />;
  }

  const layer = (
    <RevealLayer open={Boolean(revealed)} onClose={closeReveal} label={label} kind={reveal?.kind}>
      {revealed}
    </RevealLayer>
  );

  const sheets = mail.admin && (
    <>
      <NoteComposer
        open={activeSheet?.kind === "note"}
        onClose={closeSheet}
        onSent={(result, { to, mode }) => {
          haptic("success");
          const at = result?.note?.sendAt;
          setToast(
            to === "admin"
              ? "sent to your phone ♡"
              : mode === "now"
                ? "sent ♡ it’s on her phone"
                : `${mode === "surprise" ? "a surprise" : "scheduled"} for ${at ? onItsWay(at) : "later"} ♡`,
          );
        }}
      />
      <LetterEditor
        open={activeSheet?.kind === "letter"}
        letterId={activeSheet?.letterId ?? null}
        onClose={closeSheet}
        onSaved={(_saved, { created, notify, unlockAt }) => {
          haptic("success");
          setToast(
            !created
              ? "saved ♡ she sees it next time she opens it"
              : unlockAt
                ? `sealed ♡ it ${opensIn(new Date(`${unlockAt}T00:00:00+08:00`))}`
                : notify
                  ? "sealed ♡ her phone gets a little envelope"
                  : "sealed ♡ it’s in her letters",
          );
        }}
        onDeleted={() => {
          setToast("the letter is gone");
          setReveal(null);
        }}
      />
      <JarEditor open={activeSheet?.kind === "jar"} onClose={closeSheet} />
    </>
  );

  if (allParam)
    return (
      <>
        <AllNotesScreen notes={mail.notes} admin={mail.admin} signature={mail.signature} onOpen={openNote} />
        {sheets}
        {layer}
        <Toast message={toast} />
      </>
    );

  if (mail.pending) return <RootSkeleton />;
  if (mail.error)
    return (
      <div className="app-section app-section--mail mail">
        <header className="app-section__head">
          <h1 className="app-section__title">notes &amp; letters</h1>
        </header>
        <div className="app-section__body">
          <div className="app-empty" role="alert">
            <strong>your mailbox didn’t open</strong>
            <p>the connection may be napping. try again in a moment?</p>
            <button type="button" className="mail-soft-button mail-soft-button--strong" onClick={() => mail.refetch()}>
              try again
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="app-section app-section--mail mail">
      <MailHome
        mail={mail}
        jar={jar.summary}
        fresh={jar.summary.data?.fresh ?? 0}
        newIds={sticky.current}
        greetJar={greetJar}
        onOpenLetter={openLetter}
        onOpenNote={openNote}
        onPull={pull}
        onAllNotes={() => navigate("/world/mail?notes=all")}
        onWrite={openSheet}
        onCancelNote={(id) => cancel.mutate(id, { onSuccess: () => setToast("cancelled. it won’t reach her.") })}
        cancelling={cancel.isPending}
      />
      {sheets}
      {layer}
      <Toast message={toast} />
    </div>
  );
}
