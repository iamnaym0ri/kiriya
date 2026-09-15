import { motion } from "motion/react";
import Doily from "../shared/Doily.jsx";
import Wordmark from "../shared/Wordmark.jsx";
import "./EnterSplash.css";

// guns.lol's "click to enter", dressed for Kiriya. The tap matters: browsers only allow sound and
// motion sensors after one, so everything that needs permission starts inside this handler.
export default function EnterSplash({ avatarUrl, onEnter }) {
  function enter() {
    const Orientation = window.DeviceOrientationEvent;
    let motionPermission = Promise.resolve("granted");
    if (Orientation && typeof Orientation.requestPermission === "function") {
      motionPermission = Orientation.requestPermission().catch(() => "denied");
    }
    onEnter(motionPermission);
  }

  return (
    <motion.div className="enter" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="enter__sky" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 53 + 7) % 100}%`,
              top: `${(i * 37 + 11) % 100}%`,
              animationDelay: `${(i % 6) * -0.7}s`,
              fontSize: `${10 + (i % 4) * 5}px`,
            }}
          >
            {i % 5 === 0 ? "✞" : i % 2 ? "✦" : "⋆"}
          </span>
        ))}
      </div>

      <button type="button" className="enter__button" onClick={enter}>
        <Doily size={112}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <svg viewBox="0 0 24 24" className="enter__heart" aria-hidden="true">
              <path d="M12 21C5 16 2 12.5 2 8.5 2 5.5 4.3 3 7.2 3c2 0 3.6 1.1 4.8 2.8C13.2 4.1 14.8 3 16.8 3 19.7 3 22 5.5 22 8.5c0 4-3 7.5-10 12.5z" />
            </svg>
          )}
        </Doily>
        <Wordmark as="span" size="md" />
        <span className="enter__hint">
          <span aria-hidden="true">♡</span> tap to enter
        </span>
      </button>
    </motion.div>
  );
}
