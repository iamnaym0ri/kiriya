import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { todayKey } from "../../lib/world.js";
import PageLoader from "../../shared/PageLoader.jsx";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import { Modal } from "../../shared/WorldPrimitives.jsx";
import BirthdayTakeover from "../today/BirthdayTakeover.jsx";
import { useToday } from "../../lib/world.js";
import { useSession } from "../../lib/session.js";
import { HEART } from "../../../shared/reactions.js";
import ReactionBar from "../../shared/ReactionBar.jsx";
import "./LettersPage.css";

const dateFormat = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Singapore",
});

function Envelope({ title, from, onOpen, unread, locked, unlockAt, tone, reaction }) {
  return (
    <button
      type="button"
      className="envelope"
      data-tone={tone}
      onClick={onOpen}
      disabled={locked}
    >
      <span className="envelope__flap" aria-hidden="true" />
      {/* Her reaction becomes the wax seal. */}
      <span className="envelope__seal" data-reaction={reaction ? (reaction === HEART ? "heart" : "emoji") : undefined} aria-hidden="true">
        {reaction === HEART ? "♥" : reaction ?? "♡"}
      </span>
      <span className="envelope__title">{title}</span>
      <span className="envelope__from">
        {locked ? `Opens ${dateFormat.format(new Date(unlockAt))}` : from}
      </span>
      {unread && !locked && <span className="envelope__new">new</span>}
      {reaction && <span className="sr-only">{reaction === HEART ? ", you hearted this" : `, you reacted ${reaction}`}</span>}
    </button>
  );
}

function LetterSheet({ letter, onClose, reactions }) {
  return (
    <Modal title={letter.title} onClose={onClose} className="letter-modal">
      <article className="letter-paper">
        {letter.author === "maomao" && (
          <p className="letter-fan-label">
            A MAOMAO-INSPIRED BIRTHDAY NOTE · FAN WRITING
          </p>
        )}
        <div className="letter__body">
          {letter.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {letter.signoff && <p className="letter__signoff">{letter.signoff}</p>}
        {reactions}
        <button className="button-paper" onClick={onClose}>
          Fold it back up
        </button>
      </article>
    </Modal>
  );
}

export default function LettersPage() {
  const today = useToday();
  const queryClient = useQueryClient();
  const letters = useQuery({
    queryKey: ["me", "letters"],
    queryFn: () => api("/me/letters"),
  });
  const markOpen = useMutation({
    mutationFn: (id) =>
      api(`/me/letters/${id}/open`, { method: "POST", body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "letters"] });
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });
  const react = useMutation({
    mutationFn: ({ id, reaction }) =>
      api(`/me/letters/${id}/reaction`, { method: "PUT", body: { reaction } }),
    // Shows straight away; a failed save puts the old reaction back.
    onMutate: async ({ id, reaction }) => {
      await queryClient.cancelQueries({ queryKey: ["me", "letters"] });
      const previous = queryClient.getQueryData(["me", "letters"])?.letters.find((l) => l.id === id)?.reaction ?? null;
      patchReaction(id, reaction);
      return { previous };
    },
    onError: (_error, { id }, context) => {
      patchReaction(id, context?.previous ?? null);
      queryClient.invalidateQueries({ queryKey: ["me", "letters"] });
    },
  });
  const patchReaction = (id, reaction) =>
    queryClient.setQueryData(["me", "letters"], (old) =>
      old && { ...old, letters: old.letters.map((l) => (l.id === id ? { ...l, reaction } : l)) },
    );
  const session = useSession();
  const [reading, setReading] = useState(null);

  if (letters.isPending) return <PageLoader />;
  if (letters.isError)
    return <p>Letters didn't load. Try again in a moment.</p>;

  const { signature, maomao, letters: list } = letters.data;
  const fromGiver = list.filter((l) => l.author === "giver");

  function open(letter) {
    react.reset();
    if (letter.id && !letter.openedAt) markOpen.mutate(letter.id);
    setReading(letter);
  }

  return (
    <div className="letters">
      <h1 className="letters__title">Letters</h1>
      <p className="letters__intro">
        Things people wanted you to read, folded and sealed.
      </p>

      <BirthdayTakeover birthday={today.data?.birthday} signature={signature} />
      <div className="letters__grid">
        {fromGiver.map((letter) => (
          <Envelope
            key={letter.id}
            tone="pink"
            title={letter.title}
            from={`from ${signature}`}
            unread={!letter.openedAt}
            locked={letter.locked}
            unlockAt={letter.unlockAt}
            reaction={letter.reaction}
            onOpen={() =>
              open({
                id: letter.id,
                openedAt: letter.openedAt,
                author: "giver",
                title: letter.title,
                paragraphs: (letter.body ?? "").split(/\n{2,}/),
              })
            }
          />
        ))}
        <Envelope
          tone="night"
          title={maomao.title}
          from="a Maomao-inspired birthday note"
          onOpen={() =>
            open({
              author: "maomao",
              title: maomao.title,
              paragraphs: maomao.body,
              signoff: maomao.signoff,
            })
          }
        />
      </div>

      {fromGiver.length === 0 && (
        <p className="letters__empty">
          {signature}'s letter is still being written. It'll appear here the
          moment it's sealed.
        </p>
      )}

      <AnimatePresence>
        {reading && (
          <LetterSheet
            letter={reading}
            onClose={() => setReading(null)}
            reactions={
              reading.id && (
                <ReactionBar
                  what="this letter"
                  reaction={list.find((l) => l.id === reading.id)?.reaction ?? null}
                  onReact={(reaction) => react.mutate({ id: reading.id, reaction })}
                  readOnly={session.data?.role !== "kiriya"}
                  note={session.data?.role === "admin" ? "Preview: this is Kiriya’s reaction, and only she can change it." : null}
                  error={react.isError ? "That reaction didn’t save. Try again?" : null}
                />
              )
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
