import { useState } from "react";
import { creditLine } from "./openverse.js";
import { nameOf, otherOf, timeAgo } from "./api.js";

// The pieces every quiz screen shares: the picture, the question card and its answers, the result.

export const MODE_LABEL = { me: "about me", us: "about us" };

// Where the sticker emoji sit on a card without a photo: spread evenly, alternating high and low.
const stickerSpot = (index, count) => ({
  x: count === 1 ? 50 : 14 + (index * 72) / (count - 1),
  y: index % 2 ? 36 : 58,
  r: [-12, 8, -6, 12][index % 4],
  s: [1.05, 0.92, 1.12, 0.96][index % 4],
});

/** The photo at the top of a card (4:3 to 16:9), or, without one, the answers' emoji as stickers. */
export function QuizPicture({ image, choices = [], compact = false, credit = true }) {
  const [loaded, setLoaded] = useState(false);
  if (!image?.url) {
    return (
      <div className={`quiz-picture quiz-picture--stickers${compact ? " quiz-picture--compact" : ""}`} aria-hidden="true">
        {choices.slice(0, 4).map((choice, index, shown) => {
          const spot = stickerSpot(index, shown.length);
          return (
            <span key={choice.id ?? index} className="quiz-sticker" style={{ left: `${spot.x}%`, top: `${spot.y}%`, "--r": `${spot.r}deg`, "--s": spot.s, "--i": index }}>
              {choice.emoji}
            </span>
          );
        })}
      </div>
    );
  }
  const ratio = image.width && image.height ? Math.min(16 / 9, Math.max(4 / 3, image.width / image.height)) : 4 / 3;
  return (
    <figure className={`quiz-picture${compact ? " quiz-picture--compact" : ""}`} style={{ "--ratio": ratio }}>
      <span className={`quiz-picture__frame${loaded ? " is-loaded" : ""}`}>
        <img src={image.url} alt="" decoding="async" onLoad={() => setLoaded(true)} draggable="false" />
      </span>
      <span className="quiz-tape" aria-hidden="true" />
      {credit && image.kind === "stock" && image.credit && <figcaption className="quiz-credit">{creditLine(image.credit)}</figcaption>}
    </figure>
  );
}

/** "from josh · 2 h ago" (or "you asked · …"), with the mode as a little label. */
export function QuizMeta({ quiz, me, names }) {
  const who = quiz.from === me && !quiz.test ? "you asked" : `from ${nameOf(names, quiz.from)}`;
  return (
    <p className="quiz-meta">
      <span className={`quiz-mode quiz-mode--${quiz.mode}`}>{MODE_LABEL[quiz.mode]}</span>
      {quiz.test && <span className="quiz-mode quiz-mode--test">test</span>}
      <span className="quiz-meta__who">
        {who} · {timeAgo(quiz.createdAt)}
      </span>
    </p>
  );
}

/** Who answered a quiz (Josh answers his own test quizzes, playing her part). */
export const answererOf = (quiz) => (quiz.test ? quiz.from : quiz.to);

/** The little name tags that sit on an answer once it's revealed. */
function tagsFor(quiz, choice, me, names) {
  if (!quiz.reply && quiz.answer == null) return [];
  const answerer = answererOf(quiz);
  const label = (role) => (role === me ? "you" : nameOf(names, role));
  const tags = [];
  if (quiz.mode === "me") {
    if (choice.id === quiz.answer) tags.push({ key: "answer", text: quiz.reply ? "✓ right answer" : "✓ your answer", kind: "answer" });
    if (quiz.reply?.choice === choice.id && quiz.reply.choice !== quiz.answer) tags.push({ key: "guess", text: `${label(answerer)} guessed`, kind: "guess" });
    if (quiz.reply?.choice === choice.id && quiz.reply.choice === quiz.answer) tags.push({ key: "guess", text: label(answerer), kind: "person" });
  } else {
    const sender = quiz.test ? null : quiz.from;
    if (choice.id === quiz.answer) tags.push({ key: "sender", text: quiz.reply ? label(sender ?? me) : "your pick", kind: "person" });
    if (quiz.reply?.choice === choice.id) tags.push({ key: "reply", text: quiz.test ? "you" : label(answerer), kind: "person" });
  }
  return tags;
}

/** The state an answer is drawn in. */
function stateOf(quiz, choice, picked) {
  if (quiz.reply) {
    const isAnswer = choice.id === quiz.answer;
    const isReply = choice.id === quiz.reply.choice;
    if (quiz.mode === "me") return isAnswer ? "right" : isReply ? "wrong" : "dim";
    if (isAnswer && isReply) return "match";
    return isAnswer || isReply ? "picked-us" : "dim";
  }
  if (quiz.answer != null) return choice.id === quiz.answer ? "marked" : "idle";
  return picked === choice.id ? "picked" : picked ? "unpicked" : "idle";
}

/**
 * The answers. Answers with words are pills; an all-emoji quiz is a grid of big tiles.
 * `onPick` makes them tappable (answering); otherwise they show the result or the sender's answer.
 */
export function Choices({ quiz, me, names, picked = null, onPick = null, waiting = false }) {
  const tiles = quiz.choices.every((choice) => !choice.text);
  return (
    <ul
      className={`quiz-choices${tiles ? " quiz-choices--tiles" : ""}`}
      data-count={quiz.choices.length}
      role={onPick ? "radiogroup" : undefined}
      aria-label={onPick ? "answers" : undefined}
    >
      {quiz.choices.map((choice, index) => {
        const state = stateOf(quiz, choice, picked);
        const tags = tagsFor(quiz, choice, me, names);
        const body = (
          <>
            <span className="quiz-choice__emoji" aria-hidden={choice.text ? "true" : undefined}>
              {choice.emoji}
            </span>
            {choice.text && <span className="quiz-choice__text">{choice.text}</span>}
            {state === "picked" && waiting && <span className="quiz-choice__dots" aria-label="checking">…</span>}
            {tags.length > 0 && (
              <span className="quiz-choice__tags">
                {tags.map((tag) => (
                  <span key={tag.key} className={`quiz-tag quiz-tag--${tag.kind}`}>
                    {tag.text}
                  </span>
                ))}
              </span>
            )}
          </>
        );
        return (
          <li key={choice.id} style={{ "--i": index }}>
            {onPick ? (
              <button
                type="button"
                role="radio"
                aria-checked={picked === choice.id}
                className="quiz-choice"
                data-state={state}
                disabled={waiting}
                onClick={() => onPick(choice.id)}
              >
                {body}
              </button>
            ) : (
              <div className="quiz-choice" data-state={state}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The result as a headline, from whoever is looking. */
export function resultWords(quiz, me, names) {
  const pick = quiz.choices.find((c) => c.id === quiz.reply?.choice);
  const answer = quiz.choices.find((c) => c.id === quiz.answer);
  const says = (choice) => (choice ? `${choice.emoji}${choice.text ? ` ${choice.text}` : ""}` : "");
  const answerer = answererOf(quiz);
  const mineToAnswer = answerer === me;
  const them = nameOf(names, mineToAnswer ? quiz.from : answerer);
  switch (quiz.result) {
    case "right":
      return mineToAnswer
        ? { title: "you got it! ✨", line: quiz.test ? "that’s what she’ll see when she’s right" : `you know ${them} so well` }
        : { title: `${them} got it right ✨`, line: `${them} knows you so well ♡` };
    case "wrong":
      return mineToAnswer
        ? { title: "so close ♡", line: `it was ${says(answer)}` }
        : { title: `${them} guessed ${pick?.emoji ?? ""}`, line: `so close ♡ it was ${says(answer)}` };
    case "match":
      return { title: "in sync ♡", line: `you both picked ${says(pick)}` };
    case "differ":
      return mineToAnswer
        ? { title: "two different answers", line: `${quiz.test ? "you" : them} picked ${says(answer)}. cute either way ♡` }
        : { title: `${them} picked ${pick?.emoji ?? ""}`, line: `you picked ${says(answer)}. cute either way ♡` };
    default:
      return null;
  }
}

export function ResultBanner({ quiz, me, names, stats, fresh = false }) {
  const words = resultWords(quiz, me, names);
  if (!words) return null;
  const mine = stats?.[me];
  // Who earned the point: about me, whoever guessed right; about us, both of them when in sync.
  const iScored = quiz.result === "match" || (quiz.result === "right" && answererOf(quiz) === me);
  const theyScored = quiz.result === "right" && answererOf(quiz) !== me && !quiz.test;
  const scored = fresh && iScored && mine;
  return (
    <div className={`quiz-result quiz-result--${quiz.result}${fresh ? " is-fresh" : ""}`} role="status">
      <span className="quiz-result__stamp" aria-hidden="true">
        {{ right: "✓", match: "♡", wrong: "♡", differ: "✿" }[quiz.result]}
      </span>
      <div className="quiz-result__words">
        <strong>{words.title}</strong>
        <span>{words.line}</span>
        {scored && (
          <span className="quiz-result__score">
            +1 ✦ · {mine.points} {mine.points === 1 ? "point" : "points"}
            {mine.streak > 0 ? ` · 🔥 ${mine.streak} ${mine.streak === 1 ? "day" : "days"}` : ""}
          </span>
        )}
        {fresh && theyScored && <span className="quiz-result__score">+1 ✦ for {nameOf(names, answererOf(quiz))}</span>}
      </div>
    </div>
  );
}

/** A small round initial for a person. */
export function PersonDot({ role, names, me }) {
  const name = nameOf(names, role);
  return (
    <span className={`quiz-person quiz-person--${role}`} aria-hidden="true" title={role === me ? "you" : name}>
      {name.slice(0, 1)}
    </span>
  );
}

export const otherName = (names, me) => nameOf(names, otherOf(me));
