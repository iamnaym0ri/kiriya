import { useState } from "react";
import { motion } from "motion/react";
import { useSetMood } from "../../lib/world.js";
import "./MoodCheckin.css";

export default function MoodCheckin({ moods, current, energyLabels }) {
  const setMood = useSetMood();
  const [editing, setEditing] = useState(!current);
  const [energy, setEnergy] = useState(current?.energy ?? 2);

  if (current && !editing) {
    return (
      <section className="mood mood--done" aria-label="Today's check-in">
        <span className="mood__swatch" data-mood-key={current.key} aria-hidden="true" />
        <div className="mood__summary">
          <p className="mood__summary-title">
            {current.label} <span className="mood__address">{current.address.label}</span>
          </p>
          <p className="mood__summary-energy">{energyLabels[current.energy ?? 2]}</p>
        </div>
        <button type="button" className="btn btn--soft btn--small" onClick={() => setEditing(true)}>
          Change
        </button>
      </section>
    );
  }

  function choose(key) {
    setMood.mutate({ mood: key, energy }, { onSuccess: () => setEditing(false) });
  }

  return (
    <section className="mood" aria-labelledby="mood-title">
      <h2 id="mood-title" className="mood__title">
        How are you feeling today?
      </h2>
      <p className="mood__hint">The colours, outfit ideas and how the site talks about you follow your pick.</p>
      <div className="mood__options">
        {moods.map((mood, i) => (
          <motion.button
            key={mood.key}
            type="button"
            className="mood__option"
            data-mood-key={mood.key}
            aria-pressed={current?.key === mood.key}
            onClick={() => choose(mood.key)}
            disabled={setMood.isPending}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <span className="mood__swatch" aria-hidden="true" />
            <span className="mood__label">{mood.label}</span>
            <span className="mood__option-hint">{mood.hint}</span>
            <span className="mood__address">{mood.address.label}</span>
          </motion.button>
        ))}
      </div>
      <label className="mood__energy">
        <span>
          Energy: <strong>{energyLabels[energy]}</strong>
        </span>
        <input type="range" min="0" max="4" step="1" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
      </label>
      {setMood.error && <p className="mood__error">{setMood.error.message}</p>}
    </section>
  );
}
