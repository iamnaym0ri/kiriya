import { useId, useState } from "react";
import { HEART, REACTION_EMOJI } from "../../shared/reactions.js";
import { Icon } from "./WorldPrimitives.jsx";
import "./ReactionBar.css";

/** A saved reaction as it appears on a card or seal: a filled heart, or the emoji itself. */
export function ReactionMark({ reaction, className = "" }) {
  if (!reaction) return null;
  return <span className={`reaction-mark ${className}`} data-heart={reaction === HEART}>
    <span aria-hidden="true">{reaction === HEART ? "♥" : reaction}</span>
    <span className="sr-only">{reaction === HEART ? ", you hearted this" : `, you reacted ${reaction}`}</span>
  </span>;
}

/**
 * Mostly a heart; an emoji when a heart isn't quite it. Tapping the chosen one again takes it back.
 * `readOnly` shows someone else's reaction without letting it change (the admin's preview).
 */
export default function ReactionBar({ reaction = null, onReact, what = "this", readOnly = false, note = null, error = null }) {
  const [picking, setPicking] = useState(false);
  const trayId = useId();
  const emoji = reaction && reaction !== HEART ? reaction : null;
  const choose = (value) => {
    setPicking(false);
    onReact(reaction === value ? null : value);
  };
  return (
    <div className="reaction-bar">
      <div className="reaction-bar__row">
        <button type="button" className="reaction-bar__heart" aria-pressed={reaction === HEART} disabled={readOnly} onClick={() => choose(HEART)}>
          <Icon name="heart" size={20} />
          {reaction === HEART ? "hearted" : `heart ${what}`}
        </button>
        <button
          type="button"
          className="reaction-bar__more"
          aria-expanded={picking}
          aria-controls={picking ? trayId : undefined}
          aria-label={emoji ? `Your reaction is ${emoji}. Pick a different emoji` : "React with an emoji instead"}
          aria-pressed={Boolean(emoji)}
          disabled={readOnly}
          onClick={() => setPicking(!picking)}
        >
          {emoji ? <span className="reaction-emoji" aria-hidden="true">{emoji}</span> : <span aria-hidden="true">+ emoji</span>}
        </button>
      </div>
      {picking && (
        <div id={trayId} className="reaction-bar__tray" role="group" aria-label="Pick an emoji">
          {REACTION_EMOJI.map((item) => (
            <button key={item} type="button" className="reaction-emoji" aria-pressed={reaction === item} aria-label={item} onClick={() => choose(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
      {error ? <p className="reaction-bar__note" role="alert">{error}</p> : note && <p className="reaction-bar__note">{note}</p>}
    </div>
  );
}
