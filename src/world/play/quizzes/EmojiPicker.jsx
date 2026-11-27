import { useEffect, useState } from "react";
import { EditSheet } from "../../../shared/admin/AdminEdit.jsx";
import { EMOJI, EMOJI_SHELVES, lastEmoji, suggestEmoji } from "./emoji.js";

/** A bottom sheet to pick an answer's emoji: suggestions from its words, shelves, or any typed one. */
export default function EmojiPicker({ open, text, current, onPick, onClose }) {
  const [shelf, setShelf] = useState("love");
  const [typed, setTyped] = useState("");
  const suggestions = suggestEmoji(text, 8);

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const pick = (emoji) => {
    onPick(emoji);
    onClose();
  };

  return (
    <EditSheet open={open} title="pick an emoji" subtitle={text ? `for “${text}”` : undefined} onClose={onClose}>
      <div className="quiz-emoji">
        {suggestions.length > 0 && (
          <section aria-label="suggested">
            <h3 className="quiz-emoji__label">suggested</h3>
            <div className="quiz-emoji__grid">
              {suggestions.map((emoji) => (
                <button key={emoji} type="button" className="quiz-emoji__item" aria-pressed={emoji === current} onClick={() => pick(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        )}

        <section aria-label="all emoji">
          <div className="quiz-emoji__shelves" role="tablist" aria-label="emoji shelves">
            {EMOJI_SHELVES.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={shelf === item.id} aria-label={item.label} className="quiz-emoji__shelf" onClick={() => setShelf(item.id)}>
                {item.icon}
              </button>
            ))}
          </div>
          <h3 className="quiz-emoji__label">{EMOJI_SHELVES.find((item) => item.id === shelf)?.label}</h3>
        </section>
        <div className="quiz-emoji__grid" role="tabpanel" aria-label={shelf}>
          {EMOJI[shelf].map(({ emoji, words }) => (
            <button key={emoji} type="button" className="quiz-emoji__item" aria-label={words[0]} aria-pressed={emoji === current} onClick={() => pick(emoji)}>
              {emoji}
            </button>
          ))}
        </div>

        <label className="quiz-emoji__typed">
          <span>or type any emoji</span>
          <input
            type="text"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            value={typed}
            placeholder="😊"
            onChange={(event) => {
              const value = event.target.value;
              setTyped(value);
              const emoji = lastEmoji(value);
              if (emoji) pick(emoji);
            }}
          />
        </label>
      </div>
    </EditSheet>
  );
}
