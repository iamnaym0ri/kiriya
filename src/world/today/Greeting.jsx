import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import "./Greeting.css";

const POKES = [
  { text: "Don't poke the apothecary.", expression: "ew" },
  { text: "I'm busy. There are herbs to sort.", expression: "deadpan" },
  { text: "…Fine. Hi. Happy now?", expression: "smug" },
  { text: "Did you know some mushrooms glow? Now you do.", expression: "sparkle" },
  { text: "Poke me again and I'm prescribing a nap.", expression: "sleepy" },
];

function useTypewriter(text) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? text : "");
  useEffect(() => {
    if (reduce) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [text, reduce]);
  return shown;
}

export default function Greeting({ greeting, moodLine }) {
  const [poke, setPoke] = useState(null);
  const current = poke ?? greeting;
  const typed = useTypewriter(current.text);

  function onPoke() {
    setPoke((prev) => {
      const options = POKES.filter((p) => p.text !== prev?.text);
      return options[Math.floor(Math.random() * options.length)];
    });
  }

  useEffect(() => {
    if (!poke) return;
    const t = setTimeout(() => setPoke(null), 5200);
    return () => clearTimeout(t);
  }, [poke]);

  return (
    <section className="greeting" aria-label="A note from your apothecary">
      <MaomaoMascot expression={current.expression} size={118} onPoke={onPoke} />
      <div className="greeting__bubble">
        <p className="greeting__text" aria-live="polite">
          <span aria-hidden="true">{typed}</span>
          <span className="sr-only">{current.text}</span>
        </p>
        <AnimatePresence>
          {moodLine && !poke && (
            <motion.p className="greeting__mood" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {moodLine}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
