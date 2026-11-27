import { useEffect } from "react";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday } from "../../lib/world.js";
import CornerWidget from "./CornerWidget.jsx";
import GlanceCard from "./GlanceCard.jsx";
import CentreStage from "./CentreStage.jsx";
import SongCard from "./SongCard.jsx";
import Pinboard from "./Pinboard.jsx";
import EventsBlock from "./EventsBlock.jsx";
import { useHome } from "./useHome.js";
import "./home.css";

// The app's home section (docs/refactor/RENOVATION.md, owner: the home agent). The website keeps
// TodayPage as it is. Top to bottom: her little corner and what's new, then her, centre stage, with
// a song and the pinboard, then events & merch. A companion walks over all of it, so the blocks
// leave it room to breathe.
export default function HomeSection() {
  const home = useHome().data;
  const today = useToday().data;
  const profile = usePublicProfile().data;
  const birthday = Boolean(today?.birthday?.isBirthday);
  useEffect(() => {
    document.title = birthday ? "happy birthday, kiriya ♡" : "kiriya’s little world ♡";
  }, [birthday]);
  const todayNote = today?.cards?.find((card) => card.kind === "special");
  return (
    <div className="app-section app-section--home home">
      <div className="app-section__body home__body">
        <p className="home__dateline" data-companion-ok>
          <span>your little lilac world</span>
          <span>
            {today?.day
              ? new Intl.DateTimeFormat("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Singapore" }).format(new Date(`${today.day}T12:00:00+08:00`)).toLowerCase()
              : "a place to stay awhile"}{" "}
            <span aria-hidden="true">✧</span>
          </span>
        </p>
        <CornerWidget />
        <GlanceCard home={home} />
        <CentreStage home={home} name={profile?.name ?? "kiriya"} birthday={birthday} avatarUrl={profile?.avatarUrl} />
        <SongCard home={home} />
        <Pinboard home={home} signature={today?.signature ?? "Josh"} todayNote={todayNote} />
        <EventsBlock />
      </div>
    </div>
  );
}
