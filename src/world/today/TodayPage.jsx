import { useEffect, useState } from "react";
import { Link } from "react-router";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday, useOpenDrawer } from "../../lib/world.js";
import {
  CosplaySpread,
  Discovery,
  MaomaoSpread,
  MusicSpread,
} from "../collection/Collections.jsx";
import { Icon, Star } from "../../shared/WorldPrimitives.jsx";
import { MusicObject } from "../../shared/music/MusicRoom.jsx";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import { Bow, MaomaoBuddy } from "../../shared/play/PlayfulWorld.jsx";
import PlayDesk from "../play/PlayDesk.jsx";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";
import WorldWelcome from "../../shared/profile/WorldWelcome.jsx";
import CosplayPortrait from "../../shared/profile/CosplayPortrait.jsx";
import NoteJar from "./NoteJar.jsx";
import { MemeOfTheDay, NewCount } from "../feeds/FeedPieces.jsx";
import { useFeed } from "../../lib/feeds.js";
import "./TodayPage.css";

export default function TodayPage() {
  const { copy } = useDailyStyle();
  const today = useToday();
  const profile = usePublicProfile();
  const drawer = useOpenDrawer();
  const [peek, setPeek] = useState(false);
  const data = today.data;
  useEffect(() => {
    document.title = data?.birthday?.isBirthday
      ? "happy birthday, kiriya ♡"
      : "kiriya’s little world ♡";
  }, [data?.birthday?.isBirthday]);
  const personalNote = data?.cards.find((card) => card.kind === "special");
  const reward = data?.drawer?.reward ?? drawer.data?.reward;
  const feedsLive = Boolean(useFeed("maomao").data?.revision);
  return (
    <div className="personal-home">
      <div className="home-dateline">
        <span>YOUR LITTLE LILAC WORLD</span>
        <span>
          {data?.day
            ? new Intl.DateTimeFormat("en-SG", {
                day: "numeric",
                month: "long",
                timeZone: "Asia/Singapore",
              }).format(new Date(`${data.day}T12:00:00+08:00`))
            : "A place to stay awhile"}{" "}
          <span aria-hidden="true">✧</span>
        </span>
      </div>
      <section
        className="home-opening"
        aria-labelledby="home-title"
        data-motion-region
      >
        <div className="home-welcome">
          <WorldWelcome birthday={data?.birthday?.isBirthday} name={profile.data?.name}/>
          <div className="home-discovery">
            <aside className="note-slip birthday-love-note" data-motion-region>
              <span className="micro-label">A LITTLE BIRTHDAY WISH ♡</span>
              <p>
                That u will keep being unique and speciall just like u always
                have been <span className="birthday-forever">forever!!</span>
              </p>
            </aside>
            {personalNote && (
              <Discovery
                kind="maomao"
                card={personalNote}
                label={personalNote?.title ?? "TODAY’S LITTLE FIND"}
              />
            )}
          </div>
          <div className="birthday-stamps" aria-label="Little birthday stamps">
            <span>{copy?.birthdayStamp ?? "🎂 SEPTEMBER GIRL"}</span>
            <span>♡ VERY LOVED</span>
            <span>✿ DOODLES WELCOME</span>
          </div>
          <div className="home-welcome__links">
            <a className="text-link" href="#play-desk">
              Come play <Icon name="arrow" size={16} />
            </a>
            <Link className="home-gift-link" to="/world/letters">
              <Icon name="mail" size={16} />A love letter for you
            </Link>
          </div>
        </div>
        <div className="home-collage">
          <Bow className="home-collage__bow" />
          <CosplayPortrait className="home-portrait" avatarUrl={profile.data?.avatarUrl}/>
          <Star className="home-collage__star" />
          <div className="home-collage__music">
            <MusicObject song={profile.data?.song} compact />
          </div>
          <MaomaoBuddy compact birthday={data?.birthday?.isBirthday} />
          <button
            className="home-surprise"
            onClick={() => {
              setPeek(!peek);
              if (!data?.drawer?.opened && !drawer.data && !drawer.isPending)
                drawer.mutate();
            }}
            aria-expanded={peek}
          >
            <span aria-hidden="true">✧</span>
            <span>
              {peek ? "A little keepsake" : "psst… a little surprise"}
            </span>
          </button>
          {peek && (
            <div className="home-keepsake" role="status">
              {reward?.sticker ? (
                <>
                  <StickerArt id={reward.sticker.art} size={72} />
                  <span>
                    {reward.sticker.label ??
                      reward.sticker.name ??
                      "A keepsake for your collection"}
                  </span>
                </>
              ) : (
                <span>
                  {drawer.isError
                    ? "The drawer is stuck. Tap again to retry."
                    : "Opening the little drawer…"}
                </span>
              )}
            </div>
          )}
        </div>
      </section>
      <div className="home-section-index">
        <span>A FEW OF YOUR FAVOURITE THINGS</span>
        <a href="#note-jar">♡ a little note</a>
        <a href="#play-desk">🎨 doodle & play</a>
        <a href="#maomao">
          🌿 maomao
          <NewCount section="maomao" />
        </a>
        <a href="#music">
          🎧 miku
          <NewCount section="music" />
        </a>
        <a href="#cosplay">
          🎀 dress-up
          <NewCount section="dressup" />
        </a>
        {feedsLive && (
          <>
            <Link to="/world/saves">♡ saves</Link>
            <Link to="/world/merch">🛍 merch</Link>
          </>
        )}
      </div>
      <NoteJar
        birthday={data?.birthday}
        signature={data?.signature ?? "Josh"}
        day={data?.day}
      />
      <PlayDesk />
      <MemeOfTheDay />
      <MaomaoSpread />
      <MusicSpread />
      <CosplaySpread />
      <section className="gift-margin">
        <Icon name="mail" size={33} />
        <div>
          <span className="micro-label">FOLDED UP, JUST FOR YOU</span>
          <h2>
            Some things are better <em>in a letter.</em>
          </h2>
          <p>
            Your birthday gift is here whenever you want to come back to it.
          </p>
        </div>
        <Link className="button-plum" to="/world/letters">
          Open your letters <Icon name="arrow" size={17} />
        </Link>
      </section>
    </div>
  );
}
