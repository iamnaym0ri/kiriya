import { useState } from "react";
import { celebrate } from "../../shared/effects.js";
import { Star } from "../../shared/WorldPrimitives.jsx";
import "./BirthdayTakeover.css";
export default function BirthdayTakeover({ birthday = {}, signature }) {
  const [lit, setLit] = useState(true);
  return (
    <section
      className="birthday-gift"
      aria-labelledby="birthday-gift-title"
      data-motion-region
    >
      <div className="birthday-gift__copy">
        <p className="micro-label">SEPTEMBER 15 · YOUR BIRTHDAY GIFT</p>
        <h2 id="birthday-gift-title">
          Happy freaking
          <br />
          <em>
            birthday{" "}
            <span className="birthday-babyyy" aria-label="babyyy!">
              {[..."babyyy!"].map((letter, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  style={{ "--letter": index }}
                >
                  {letter}
                </span>
              ))}
            </span>
          </em>{" "}
          <span className="birthday-gift__heart" aria-hidden="true">♥</span>
        </h2>
        <p>
          {birthday.isBirthday
            ? "Happy birthday, Kiriya. This little world is yours."
            : "Some wishes are worth coming back to. This one is here all year."}
        </p>
        <span className="handwritten">with love, {signature}</span>
      </div>
      <div className="birthday-gift__cake">
        <Star className="birthday-star" />
        <button
          aria-label={lit ? "Blow out the candle" : "Light the candle again"}
          onClick={() => {
            if (lit) celebrate({ x: 0.65, y: 0.4 }, 0.45);
            setLit(!lit);
          }}
        >
          <svg
            width="210"
            height="210"
            viewBox="0 0 210 210"
            aria-hidden="true"
          >
            <ellipse cx="105" cy="185" rx="85" ry="8" fill="#d7c5e6" />
            <path
              d="M35 130h140v45q0 12-15 12H50q-15 0-15-12Z"
              fill="#e6c5d8"
            />
            <ellipse cx="105" cy="130" rx="70" ry="16" fill="#fff9fd" />
            <path
              d="M35 130q8 25 17 7 10 22 18 2 9 17 17 1 10 23 18 1 9 18 18-1 9 17 18-2 10 17 18-2 9 10 16-6"
              fill="#fff9fd"
            />
            <path d="M101 75h9v50h-9Z" fill="#b49bcf" />
            <path
              d="m101 91 9-6m-9 20 9-6m-9 20 9-6"
              stroke="#fff9fd"
              strokeWidth="3"
            />
            {lit && (
              <g className="birthday-flame">
                <ellipse
                  className="birthday-flame__glow"
                  cx="105"
                  cy="65"
                  rx="18"
                  ry="22"
                  fill="#f6c779"
                />
                <path d="M105 46q18 30 0 31-16-2 0-31Z" fill="#eaa258" />
                <path d="M105 60q9 16 0 17-8-1 0-17Z" fill="#fff0b8" />
              </g>
            )}
            <path
              d="M63 166q5 7 10 0m25 4q7 6 14 0m25-4q6 7 12 0"
              stroke="#bc8eae"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </button>
        <p role="status">
          {lit ? "Make a wish. Tap the candle." : "Wish kept. Just between us."}
        </p>
        {!lit && (
          <button className="text-link" onClick={() => setLit(true)}>
            Make another wish <span>↺</span>
          </button>
        )}
      </div>
    </section>
  );
}
