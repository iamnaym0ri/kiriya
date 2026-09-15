import { motion } from "motion/react";
import "./Wordmark.css";

// Her name in pixel blackletter, filled with the signature purple→pink gradient.
// Letters rise into place once when `play` turns true.
export default function Wordmark({ text = "kiriya", as: Tag = "h1", size = "lg", play = true, className = "" }) {
  const letters = [...text];
  return (
    <Tag className={`wordmark wordmark--${size} ${className}`} aria-label={text}>
      {letters.map((letter, i) => (
        <motion.span
          key={`${letter}-${i}`}
          aria-hidden="true"
          className="wordmark__letter"
          initial={{ y: "0.35em", opacity: 0, filter: "blur(6px)" }}
          animate={play ? { y: 0, opacity: 1, filter: "blur(0px)" } : undefined}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.15 + i * 0.06 }}
        >
          {letter}
        </motion.span>
      ))}
    </Tag>
  );
}
