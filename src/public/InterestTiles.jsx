import { useState } from "react";
import InterestIcon from "../shared/icons/InterestIcon.jsx";
import "./InterestTiles.css";

function Tile({ interest }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <li className="tile" data-interest={interest.key} data-flipped={flipped}>
      <div className="tile__card">
        <button
          type="button"
          className="tile__face tile__front"
          onClick={() => setFlipped(true)}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
        >
          <span className="tile__icon">
            <InterestIcon name={interest.key} size={26} />
          </span>
          <span className="tile__title">{interest.title}</span>
          <span className="tile__line">{interest.line}</span>
          <span className="tile__more" aria-hidden="true">
            tap for a fact
          </span>
        </button>
        <div className="tile__face tile__back" aria-hidden={!flipped}>
          <p className="tile__fact">{interest.fact}</p>
          <div className="tile__back-row">
            {interest.source && (
              <a href={interest.source} target="_blank" rel="noreferrer" tabIndex={flipped ? 0 : -1}>
                Source
              </a>
            )}
            <button type="button" onClick={() => setFlipped(false)} tabIndex={flipped ? 0 : -1}>
              Flip back
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function InterestTiles({ interests }) {
  return (
    <section className="interests" aria-labelledby="interests-title">
      <h2 id="interests-title" className="section-title">
        Things I'm into
      </h2>
      <ul className="interests__grid">
        {interests.map((interest) => (
          <Tile key={interest.key} interest={interest} />
        ))}
      </ul>
    </section>
  );
}
