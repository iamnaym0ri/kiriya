import { useEffect, useMemo, useRef, useState } from "react";
import { useAppBack } from "../../../shared/AppFrame.jsx";
import { haptic } from "../../../lib/native.js";
import { shrinkImage, uploadFile } from "../../../lib/uploads.js";
import { nameOf, newClientId, otherOf, useQuizzes, useSendQuiz } from "./api.js";
import { STARTER_EMOJI, suggestEmoji } from "./emoji.js";
import { creditLine, imageSize, keepPhoto } from "./openverse.js";
import { leaveSentNote } from "./sentNote.js";
import EmojiPicker from "./EmojiPicker.jsx";
import StockPicker from "./StockPicker.jsx";

// Writing a quiz: the mode, a picture (one of theirs, or a free stock photo), the question, and two
// to four emoji answers with the right one (about me) or their own (about us) marked. The card being
// written looks like the card the other one will get. A draft survives leaving the screen.

const HOME = "/world/play/quizzes";
const LIMITS = { question: 160, choiceText: 40, min: 2, max: 4 };
const DRAFT = "kiriya:quiz-draft";

const blankChoice = (index) => ({ emoji: STARTER_EMOJI[index % STARTER_EMOJI.length], text: "", chosen: false });
const blank = () => ({ mode: "me", question: "", choices: [blankChoice(0), blankChoice(1), blankChoice(2)], answer: null, image: null });

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT) ?? "null");
    if (saved && Array.isArray(saved.choices)) return { ...blank(), ...saved, image: saved.image ? { status: "ready", value: saved.image, preview: saved.image.url } : null };
  } catch {
    // No draft, or storage is off.
  }
  return blank();
}
function writeDraft(draft) {
  try {
    const { image, ...rest } = draft;
    const empty = !draft.question.trim() && draft.choices.every((c) => !c.text.trim()) && !image;
    if (empty) localStorage.removeItem(DRAFT);
    else localStorage.setItem(DRAFT, JSON.stringify({ ...rest, image: image?.status === "ready" ? image.value : null }));
  } catch {
    // Storage is off: the draft lives only while the screen is open.
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT);
  } catch {
    // Nothing to clear.
  }
}

/** What still stands between the draft and sending it, in her words (null when it's ready). */
function missing(draft) {
  if (!draft.question.trim()) return "write your question";
  if (draft.choices.length < LIMITS.min) return "add at least two answers";
  if (draft.choices.some((c) => !c.emoji)) return "every answer needs an emoji";
  const keys = draft.choices.map((c) => `${c.emoji}|${c.text.trim().toLowerCase()}`);
  if (new Set(keys).size !== keys.length) return "two answers are the same";
  if (draft.answer == null || draft.answer >= draft.choices.length) return draft.mode === "me" ? "tap ✓ on the right answer" : "tap ♡ on your own answer";
  if (draft.image?.status === "uploading") return "the picture is still uploading";
  return null;
}

export default function Composer() {
  const back = useAppBack(HOME);
  const { data } = useQuizzes();
  const send = useSendQuiz();
  const [draft, setDraft] = useState(readDraft);
  const [emojiFor, setEmojiFor] = useState(null); // index of the answer picking an emoji
  const [stockOpen, setStockOpen] = useState(false);
  const [error, setError] = useState(null);
  const [tried, setTried] = useState(false);
  const clientId = useRef(newClientId());
  const fileInput = useRef(null);
  const question = useRef(null);
  const uploadToken = useRef(0);

  const me = data?.me ?? "kiriya";
  const them = nameOf(data?.names, otherOf(me));
  const problem = missing(draft);

  useEffect(() => writeDraft(draft), [draft]);

  // The question box grows with what's written.
  useEffect(() => {
    const box = question.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [draft.question]);

  const update = (change) => setDraft((current) => ({ ...current, ...(typeof change === "function" ? change(current) : change) }));

  const setChoice = (index, change) =>
    update((current) => ({ choices: current.choices.map((choice, i) => (i === index ? { ...choice, ...change } : choice)) }));

  // Typing an answer suggests its emoji, until one is picked by hand.
  const typeChoice = (index, text) => {
    const choice = draft.choices[index];
    const suggestion = choice.chosen ? null : suggestEmoji(text, 1)[0];
    setChoice(index, { text, ...(suggestion ? { emoji: suggestion } : !choice.chosen && !text.trim() ? { emoji: STARTER_EMOJI[index % STARTER_EMOJI.length] } : {}) });
  };

  const addChoice = () => {
    if (draft.choices.length >= LIMITS.max) return;
    haptic("light");
    update((current) => ({ choices: [...current.choices, blankChoice(current.choices.length)] }));
  };
  const removeChoice = (index) => {
    haptic("light");
    update((current) => ({
      choices: current.choices.filter((_, i) => i !== index),
      answer: current.answer == null ? null : current.answer === index ? null : current.answer > index ? current.answer - 1 : current.answer,
    }));
  };

  async function startUpload(work, preview) {
    const token = ++uploadToken.current;
    setError(null);
    update({ image: { status: "uploading", preview, progress: 0 } });
    try {
      const value = await work((progress) => token === uploadToken.current && update((current) => ({ image: current.image && { ...current.image, progress } })));
      if (token !== uploadToken.current) return;
      update({ image: { status: "ready", value, preview } });
    } catch (failure) {
      if (token !== uploadToken.current) return;
      update({ image: { status: "error", preview, error: failure?.message || "That picture didn’t upload. Try again?" } });
    }
  }

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That isn’t a photo.");
      return;
    }
    const preview = URL.createObjectURL(file);
    startUpload(async (onProgress) => {
      const small = await shrinkImage(file, 1600, 0.86);
      const size = await imageSize(small);
      const { url } = await uploadFile(small, { folder: "quizzes", onProgress });
      return { kind: "upload", url, ...size };
    }, preview);
  };

  const pickStock = (photo) => {
    setStockOpen(false);
    haptic("light");
    startUpload((onProgress) => keepPhoto(photo, { onProgress }), photo.thumb);
    update((current) => ({ image: { ...current.image, credit: photo.credit } }));
  };

  const removeImage = () => {
    uploadToken.current++;
    update({ image: null });
  };

  async function submit() {
    setTried(true);
    if (problem) {
      haptic("warning");
      return;
    }
    setError(null);
    try {
      await send.mutateAsync({
        clientId: clientId.current,
        mode: draft.mode,
        question: draft.question,
        image: draft.image?.status === "ready" ? draft.image.value : null,
        choices: draft.choices.map((c) => ({ emoji: c.emoji, text: c.text.trim() })),
        answer: draft.answer,
      });
      haptic("success");
      clearDraft();
      leaveSentNote(data?.testMode ? "sent ♡ (test: only your phone got the ping)" : `sent to ${them} ♡ ${them === "kiriya" ? "she’ll" : "he’ll"} get a little ping`);
      back();
    } catch (failure) {
      haptic("warning");
      setError(failure?.message || "That quiz couldn’t be sent. Try again?");
    }
  }

  const discard = () => {
    clearDraft();
    clientId.current = newClientId();
    uploadToken.current++;
    setDraft(blank());
    setTried(false);
    setError(null);
  };
  const touched = draft.question.trim() || draft.choices.some((c) => c.text.trim()) || draft.image;
  const credit = draft.image?.status === "ready" ? draft.image.value.credit : draft.image?.credit;
  const ratio = useMemo(() => {
    const value = draft.image?.value;
    return value?.width && value?.height ? Math.min(16 / 9, Math.max(4 / 3, value.width / value.height)) : 4 / 3;
  }, [draft.image]);

  return (
    <div className="app-screen quiz-page quiz-page--write">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          quizzes
        </button>
        <h1 className="app-section__title">new quiz</h1>
        {touched && (
          <div className="app-section__actions">
            <button type="button" className="quiz-button quiz-button--quiet quiz-clear" onClick={discard}>
              start over
            </button>
          </div>
        )}
      </header>

      <div className="app-section__body">
        {data?.testMode && <p className="quiz-note quiz-note--test">test mode is on: this quiz will only reach your phone.</p>}

        <div className="quiz-modes" role="radiogroup" aria-label="what kind of quiz">
          {[
            { id: "me", label: "about me", line: `you mark the right answer, ${them} guesses` },
            { id: "us", label: "about us", line: "you both answer. same answer = in sync ♡" },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={draft.mode === mode.id}
              className="quiz-modes__option"
              onClick={() => {
                haptic("light");
                update({ mode: mode.id });
              }}
            >
              <strong>{mode.label}</strong>
              <span>{mode.line}</span>
            </button>
          ))}
        </div>

        <section className={`quiz-card quiz-card--${draft.mode} quiz-card--writing`} aria-label="your quiz">
          {draft.image ? (
            <figure className="quiz-picture quiz-picture--writing" style={{ "--ratio": ratio }}>
              <span className="quiz-picture__frame is-loaded">
                <img src={draft.image.preview} alt="your quiz picture" />
              </span>
              <span className="quiz-tape" aria-hidden="true" />
              {draft.image.status === "uploading" && (
                <span className="quiz-picture__progress" role="progressbar" aria-label="uploading" aria-valuenow={Math.round(draft.image.progress ?? 0)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ transform: `scaleX(${Math.max(0.06, (draft.image.progress ?? 0) / 100)})` }} />
                </span>
              )}
              {draft.image.status === "error" && (
                <span className="quiz-picture__failed" role="alert">
                  {draft.image.error}
                </span>
              )}
              <span className="quiz-picture__tools">
                <button type="button" onClick={() => fileInput.current?.click()}>
                  change
                </button>
                <button type="button" onClick={removeImage} aria-label="remove the picture">
                  ✕
                </button>
              </span>
              {credit && <figcaption className="quiz-credit">{creditLine(credit)}</figcaption>}
            </figure>
          ) : (
            <div className="quiz-add-picture">
              <span className="quiz-add-picture__doodle" aria-hidden="true">
                <svg viewBox="0 0 48 40" width="46" height="38" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9.5c0-2 1.6-3.5 3.5-3.5h29c2 0 3.5 1.5 3.5 3.5v21c0 2-1.5 3.5-3.5 3.5h-29C7.6 34 6 32.5 6 30.5z" />
                  <path d="m8 30 10-11 7 7 5-4 10 8" />
                  <circle cx="33" cy="14" r="3" />
                </svg>
              </span>
              <span className="quiz-add-picture__label">add a picture (optional)</span>
              <span className="quiz-add-picture__buttons">
                <button type="button" className="quiz-button" onClick={() => fileInput.current?.click()}>
                  📷 your photos
                </button>
                <button type="button" className="quiz-button" onClick={() => setStockOpen(true)}>
                  🔎 find one
                </button>
              </span>
            </div>
          )}
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePhoto} />

          <div className="quiz-card__body">
            <p className="quiz-meta">
              <span className={`quiz-mode quiz-mode--${draft.mode}`}>{draft.mode === "me" ? "about me" : "about us"}</span>
              <span className="quiz-meta__who">for {them}</span>
            </p>
            <label className="quiz-write-question">
              <span className="sr-only">your question</span>
              <textarea
                ref={question}
                rows={1}
                maxLength={LIMITS.question}
                value={draft.question}
                enterKeyHint="next"
                placeholder={draft.mode === "me" ? "ask something about you…" : "ask something about you two…"}
                onChange={(event) => update({ question: event.target.value.replace(/\n/g, " ") })}
                aria-invalid={tried && !draft.question.trim() ? "true" : undefined}
              />
            </label>
            {draft.question.length > LIMITS.question - 30 && (
              <p className="quiz-count">
                {draft.question.length}/{LIMITS.question}
              </p>
            )}
            {!draft.question && <p className="quiz-card__hint">{draft.mode === "me" ? "like “what’s my comfort food?”" : "like “where should our next date be?”"}</p>}

            <ul className="quiz-write-choices" aria-label="answers">
              {draft.choices.map((choice, index) => {
                const marked = draft.answer === index;
                return (
                  <li key={index} className={`quiz-write-choice${marked ? " is-marked" : ""}`}>
                    <button type="button" className="quiz-write-choice__emoji" onClick={() => setEmojiFor(index)} aria-label={`emoji for answer ${index + 1}: ${choice.emoji}. change it`}>
                      {choice.emoji}
                    </button>
                    <input
                      type="text"
                      value={choice.text}
                      maxLength={LIMITS.choiceText}
                      enterKeyHint={index === draft.choices.length - 1 ? "done" : "next"}
                      placeholder={index === 0 ? "an answer" : index === 1 ? "another answer" : "one more"}
                      aria-label={`answer ${index + 1}`}
                      onChange={(event) => typeChoice(index, event.target.value)}
                    />
                    <button
                      type="button"
                      className="quiz-write-choice__mark"
                      aria-pressed={marked}
                      aria-label={draft.mode === "me" ? `the right answer is answer ${index + 1}` : `my answer is answer ${index + 1}`}
                      onClick={() => {
                        haptic("light");
                        update({ answer: index });
                      }}
                    >
                      {draft.mode === "me" ? "✓" : "♡"}
                    </button>
                    {draft.choices.length > LIMITS.min && (
                      <button type="button" className="quiz-write-choice__remove" onClick={() => removeChoice(index)} aria-label={`remove answer ${index + 1}`}>
                        <span aria-hidden="true">✕</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="quiz-write-foot">
              {draft.choices.length < LIMITS.max ? (
                <button type="button" className="quiz-button quiz-button--quiet" onClick={addChoice}>
                  + add an answer
                </button>
              ) : (
                <span />
              )}
              <span className={`quiz-write-foot__hint${tried && problem ? " is-problem" : ""}`}>
                {draft.answer == null ? (draft.mode === "me" ? "tap ✓ on the right one" : "tap ♡ on yours") : draft.mode === "me" ? "✓ marks the right one" : "♡ is your answer"}
              </span>
            </div>
          </div>
        </section>

        {(error || (tried && problem)) && (
          <p className="quiz-error" role="alert">
            {error || problem}
          </p>
        )}
        <button type="button" className="quiz-button quiz-button--primary quiz-send" onClick={submit} disabled={send.isPending || draft.image?.status === "uploading"}>
          {send.isPending ? "sending…" : draft.image?.status === "uploading" ? "uploading the picture…" : `send to ${them} ♡`}
        </button>
      </div>

      <EmojiPicker
        open={emojiFor != null}
        text={emojiFor != null ? draft.choices[emojiFor]?.text : ""}
        current={emojiFor != null ? draft.choices[emojiFor]?.emoji : null}
        onPick={(emoji) => setChoice(emojiFor, { emoji, chosen: true })}
        onClose={() => setEmojiFor(null)}
      />
      <StockPicker open={stockOpen} onPick={pickStock} onClose={() => setStockOpen(false)} />
    </div>
  );
}
