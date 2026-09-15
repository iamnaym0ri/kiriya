import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import InterestIcon from "../../shared/icons/InterestIcon.jsx";
import "./DayCards.css";

const HERB_KIND = {
  poison: "Poison",
  medicine: "Medicine",
  myth: "Myth-buster",
  caution: "Handle with care",
  curiosity: "Curiosity",
};

function Source({ href }) {
  if (!href) return null;
  return (
    <a className="daycard__source" href={href} target="_blank" rel="noreferrer">
      Source
    </a>
  );
}

function SpoilerText({ level, children }) {
  const [shown, setShown] = useState(false);
  if (!level || shown) return <p className="daycard__body">{children}</p>;
  return (
    <button type="button" className="daycard__spoiler" onClick={() => setShown(true)}>
      <span className="daycard__spoiler-blur" aria-hidden="true">
        {children}
      </span>
      <span className="daycard__spoiler-label">{level === "novel" ? "Novel spoiler: tap to read" : "Manga spoiler: tap to read"}</span>
    </button>
  );
}

function Card({ card }) {
  switch (card.kind) {
    case "maomao":
      return (
        <article className="daycard daycard--maomao">
          <header className="daycard__head">
            <span className="daycard__tab">Case file</span>
            <InterestIcon name="apothecary" size={20} />
          </header>
          <SpoilerText level={card.spoiler}>{card.body}</SpoilerText>
          <Source href={card.source} />
        </article>
      );
    case "herb":
      return (
        <article className="daycard daycard--herb" data-herb-kind={card.extra?.herbKind}>
          <header className="daycard__head">
            <h3 className="daycard__title">{card.title}</h3>
            <span className="daycard__chip">{HERB_KIND[card.extra?.herbKind] ?? "Herb"}</span>
          </header>
          <p className="daycard__series">{card.extra?.series}</p>
          <p className="daycard__body">{card.body}</p>
          <p className="daycard__fine">For curiosity only. Don't taste-test like Maomao.</p>
          <Source href={card.source} />
        </article>
      );
    case "vocaloid":
      return (
        <article className="daycard daycard--vocaloid">
          <header className="daycard__head">
            <h3 className="daycard__title">{card.title}</h3>
            <InterestIcon name="vocaloid" size={20} />
          </header>
          <p className="daycard__body">{card.body}</p>
          <Source href={card.source} />
        </article>
      );
    case "cosplay":
      return (
        <article className="daycard daycard--cosplay">
          <header className="daycard__head">
            <h3 className="daycard__title">{card.title}</h3>
            <span className="daycard__chip">{card.extra?.topic}</span>
          </header>
          <p className="daycard__body">{card.body}</p>
          <Source href={card.source} />
        </article>
      );
    case "ballet":
      return (
        <article className="daycard daycard--ballet">
          <header className="daycard__head">
            <h3 className="daycard__title daycard__title--term">{card.title}</h3>
            <InterestIcon name="ballet" size={20} />
          </header>
          {card.extra?.say && <p className="daycard__say">{card.extra.say}</p>}
          <p className="daycard__body">{card.body}</p>
          <Source href={card.source} />
        </article>
      );
    case "japanese":
      return (
        <article className="daycard daycard--japanese">
          <div className="daycard__kanji" lang="ja">
            {card.title}
          </div>
          <div className="daycard__reading">
            <p lang="ja" className="daycard__kana">
              {card.extra?.kana}
            </p>
            <p className="daycard__romaji">{card.extra?.romaji}</p>
            <p className="daycard__meaning">{card.body}</p>
          </div>
          {(card.extra?.note || card.extra?.zh) && (
            <p className="daycard__note">
              {card.extra.falseFriend && <span className="daycard__chip daycard__chip--warn">False friend</span>}
              {card.extra.note}
              {card.extra.zh && !card.extra.note?.includes(card.extra.zh) && (
                <span className="daycard__zh" lang="zh-Hans">
                  中文 {card.extra.zh}
                </span>
              )}
            </p>
          )}
        </article>
      );
    case "art":
      return (
        <article className="daycard daycard--art">
          <header className="daycard__head">
            <h3 className="daycard__title">{card.title}</h3>
            <InterestIcon name="artist" size={20} />
          </header>
          <p className="daycard__prompt">{card.body}</p>
          {card.extra?.tip && <p className="daycard__tip">{card.extra.tip}</p>}
          <Link to="/world/studio" className="btn btn--primary btn--small daycard__cta">
            Draw it in the studio
          </Link>
        </article>
      );
    case "special":
      return (
        <article className="daycard daycard--special">
          <span className="daycard__hearts" aria-hidden="true">
            ♡ ✦ ♡
          </span>
          <h3 className="daycard__title">{card.title}</h3>
          <p className="daycard__body">{card.body}</p>
        </article>
      );
    default:
      return null;
  }
}

export default function DayCards({ cards }) {
  return (
    <section className="daycards" aria-labelledby="daycards-title">
      <h2 id="daycards-title" className="today__section-title">
        Today's finds
      </h2>
      <div className="daycards__list">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.2 + i * 0.06 }}
          >
            <Card card={card} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
