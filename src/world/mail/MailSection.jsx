import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { haptic } from "../../lib/native.js";
import MailHome from "./MailHome.jsx";
import { AllNotesScreen, JarScreen, LetterScreen, NoteScreen, ScreenMessage } from "./MailScreens.jsx";
import { JarEditor, LetterEditor, NoteComposer } from "./MailAdmin.jsx";
import { letterIdOf, useCancelNote, useJarSummary, useMail } from "./useMail.js";
import { onItsWay, opensIn } from "./format.js";
import "./Mail.css";

// The app's "notes & letters" section (docs/refactor/RENOVATION.md, owner: the mail agent): her
// letters and little notes, what's new on top, their whole history, her reactions, and the note jar.
// Josh sees exactly the same, plus the pencils to write, send and fill the jar from his phone.
//
// Screens are addresses, so notifications, widgets and the edge swipe all work:
//   /world/mail                    the section
//   /world/mail?letter=<id>        a letter (maomao: her birthday note)
//   /world/mail?note=<id>          a little note (a letter's announcement opens the letter)
//   /world/mail?jar=1              the note jar (/world/mail#note-jar lands here)
//   /world/mail?notes=all          every little note
//   /world/mail?compose=note|letter|jar   Josh's composer, opened on arrival (his admin tab links here)

const COMPOSERS = new Set(["note", "letter", "jar"]);

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
        <div className="app-card mail-skeleton" />
        <div className="app-card mail-skeleton mail-skeleton--tall" />
      </div>
    </div>
  );
}

export default function MailSection() {
  const mail = useMail();
  const jar = useJarSummary();
  const cancel = useCancelNote();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState(null); // { kind: "note" | "letter" | "jar", letterId? }
  const [toast, setToast] = useState("");
  const sticky = useRef(new Set());

  // /world/mail#note-jar (the jar's notification, its widget, the "pull a note" shortcut) is the jar.
  useLayoutEffect(() => {
    if (location.hash === "#note-jar") navigate("/world/mail?jar=1", { replace: true });
  }, [location.hash, navigate]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const letterParam = params.get("letter");
  const noteParam = params.get("note");
  const jarParam = params.has("jar");
  const allParam = params.get("notes") === "all";
  const compose = mail.admin && COMPOSERS.has(params.get("compose")) ? params.get("compose") : null;
  const atRoot = !letterParam && !noteParam && !jarParam && !allParam;

  useEffect(() => {
    if (atRoot) document.title = "notes & letters ♡";
  }, [atRoot]);

  // What was new when she came in stays in "new for you" until she leaves the section, so the
  // list doesn't jump about under her thumb as she reads.
  if (!mail.pending) {
    for (const letter of mail.letters) if (!letter.locked && !letter.openedAt) sticky.current.add(letter.id);
    for (const note of mail.notes) if (!note.openedAt) sticky.current.add(note.id);
  }

  const open = (search) => navigate(`/world/mail?${search}`);
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

  const fresh = jar.data?.fresh ?? 0;
  let screen = null;
  if (letterParam) {
    const letter =
      letterParam === "maomao" && mail.maomao
        ? { id: "maomao", author: "maomao", kind: "note", title: mail.maomao.title, maomao: mail.maomao }
        : mail.letters.find((item) => item.id === letterParam);
    screen = letter ? (
      <LetterScreen key={letter.id} letter={letter} admin={mail.admin} signature={mail.signature} onEdit={(item) => openSheet({ kind: "letter", letterId: item.id })} />
    ) : mail.pending ? (
      <ScreenMessage title="a letter">
        <p>opening it…</p>
      </ScreenMessage>
    ) : (
      <ScreenMessage title="a letter">
        <strong>this letter isn’t here any more</strong>
        <p>it may have been tucked away. everything else is right where you left it ♡</p>
      </ScreenMessage>
    );
  } else if (noteParam) {
    const note = mail.notes.find((item) => item.id === noteParam);
    const announcement = mail.announcements.find((item) => item.id === noteParam);
    const announced = announcement && mail.letters.find((item) => item.id === letterIdOf(announcement));
    const test = !note && mail.test.find((item) => item.id === noteParam);
    screen = note ? (
      <NoteScreen key={note.id} note={note} admin={mail.admin} signature={mail.signature} />
    ) : announced ? (
      <LetterScreen key={announced.id} letter={announced} admin={mail.admin} signature={mail.signature} onEdit={(item) => openSheet({ kind: "letter", letterId: item.id })} />
    ) : test ? (
      <NoteScreen key={test.id} note={test} admin test signature={mail.signature} />
    ) : mail.pending ? (
      <ScreenMessage title="a little note">
        <p>opening it…</p>
      </ScreenMessage>
    ) : (
      <ScreenMessage title="a little note">
        <strong>this note isn’t here any more</strong>
        <p>it may be an old one. all your little notes are in notes &amp; letters ♡</p>
      </ScreenMessage>
    );
  } else if (jarParam) {
    screen = <JarScreen admin={mail.admin} onEdit={() => openSheet({ kind: "jar" })} />;
  } else if (allParam) {
    screen = <AllNotesScreen notes={mail.notes} admin={mail.admin} signature={mail.signature} onOpen={(note) => open(`note=${note.id}`)} />;
  }

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
          if (letterParam) navigate("/world/mail", { replace: true });
        }}
      />
      <JarEditor open={activeSheet?.kind === "jar"} onClose={closeSheet} />
    </>
  );

  if (screen)
    return (
      <>
        {screen}
        {sheets}
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
        jar={jar}
        fresh={fresh}
        newIds={sticky.current}
        onOpenLetter={(letter) => open(`letter=${letter.id}`)}
        onOpenNote={(note) => open(`note=${note.id}`)}
        onOpenJar={() => open("jar=1")}
        onAllNotes={() => open("notes=all")}
        onWrite={openSheet}
        onCancelNote={(id) => cancel.mutate(id, { onSuccess: () => setToast("cancelled. it won’t reach her.") })}
        cancelling={cancel.isPending}
      />
      {sheets}
      <Toast message={toast} />
    </div>
  );
}
