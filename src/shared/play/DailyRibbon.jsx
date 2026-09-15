import { usePlayful } from "./PlayfulContext.js";
import { useDailyStyle } from "../DailyStyle.jsx";
import { dailyRibbon } from "./dailyRibbon.js";
import "./DailyRibbon.css";

// Text faces with independently waving arms; the whole emoticon bops to today's dance.
function LittleDancer({ dancer, index, side = false }) {
  return <span className={`ribbon-dancer${side ? " ribbon-dancer--side" : ""}`} data-reaction={dancer.reaction} aria-hidden="true" dir="ltr" style={{ "--dancer-delay": `${index * -.43}s` }}>
    <span className="ribbon-dancer__body">
      <span className="ribbon-dancer__arm ribbon-dancer__arm--left">{dancer.left}</span>
      <span className="ribbon-dancer__face">{dancer.face}</span>
      <span className="ribbon-dancer__arm ribbon-dancer__arm--right">{dancer.right}</span>
    </span>
    <span className="ribbon-dancer__little-love">{dancer.charm ?? (index === 1 ? "♡" : "♪")}</span>
  </span>;
}

export default function DailyRibbon() {
  const { day, ribbonSlot } = usePlayful();
  const style = useDailyStyle();
  const feeling = style.day === day ? style.current?.feeling?.key : null;
  const parade = dailyRibbon(day, { slot: ribbonSlot, feeling });
  return <div className="birthday-ribbon daily-ribbon" data-motion-region data-day={parade.day} data-slot={parade.slot} data-feeling={parade.feeling ?? "any"} data-dance={parade.dance} data-birthday={parade.birthday} role="region" aria-label="Today's little parade" tabIndex={0}>
    <div className="birthday-ribbon__track" key={`${parade.day}:${parade.slot}:${parade.feeling}`}>
      {[0, 1].map(copy => <div className="daily-ribbon__group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
        <span className="daily-ribbon__home"><span className="daily-ribbon__bow" aria-hidden="true">🎀</span> a little world for kiriya</span>
        {parade.messages.map((message, index) => <span className="daily-ribbon__bit" key={index}>
          <LittleDancer dancer={parade.dancers[index]} index={index}/>
          <span className="daily-ribbon__message">{message}</span>
          <LittleDancer dancer={parade.sides[index]} index={index + 3} side/>
          <span className="daily-ribbon__glint" aria-hidden="true">{index === 1 ? "♥" : "✧"}</span>
        </span>)}
        <span className="daily-ribbon__face" aria-hidden="true">{parade.face}</span>
      </div>)}
    </div>
  </div>;
}
