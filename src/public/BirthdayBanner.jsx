import { celebrate } from "../shared/effects.js";
import "./BirthdayBanner.css";

export default function BirthdayBanner({ birthday, name }) {
  if (!birthday?.isBirthdayWeek) return null;

  function throwConfetti(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: rect.top / window.innerHeight }, 1.2);
  }

  return (
    <section className="bday-banner" aria-labelledby="bday-banner-title">
      <div className="bday-banner__ribbon" aria-hidden="true">
        <span>✦</span>
        <span>♡</span>
        <span>✦</span>
      </div>
      <h2 id="bday-banner-title" className="bday-banner__title">
        {birthday.isBirthday ? `Happy birthday, ${name}!` : `It's ${name}'s birthday week`}
      </h2>
      <p className="bday-banner__line">
        {birthday.isBirthday ? "Today's the day. Send some birthday love ♡" : `Day ${birthday.dayOfWeek} of 7, and still celebrating.`}
      </p>
      <button type="button" className="btn btn--night btn--small" onClick={throwConfetti}>
        Throw confetti
      </button>
    </section>
  );
}
