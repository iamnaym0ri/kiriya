import { useEffect, useState } from "react";
import { Link } from "react-router";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday, useOpenDrawer } from "../../lib/world.js";
import {
  ArtSpread,
  CosplaySpread,
  Discovery,
  MaomaoSpread,
  MusicSpread,
} from "../collection/Collections.jsx";
import { Icon, Picture, Star } from "../../shared/WorldPrimitives.jsx";
import { MusicObject } from "../../shared/music/MusicRoom.jsx";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import { Bow, MaomaoBuddy } from "../../shared/play/PlayfulWorld.jsx";
import PlayDesk from "../play/PlayDesk.jsx";
import BirthdayTakeover from "./BirthdayTakeover.jsx";
import "./TodayPage.css";

export default function TodayPage() {
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
          <p className="handwritten">
            {data?.birthday?.isBirthday
              ? "happy birthday,"
              : "there you are, lovely."}
          </p>
          <h1 id="home-title">
            kiriya<span aria-hidden="true">♡</span>
          </h1>
          <p className="home-welcome__line">
            A little world,
            <br />
            <em>with so much love.</em>
          </p>
          <p className="home-welcome__description">
            Your favourite characters, a song on repeat, a page to doodle on.
            <br className="desktop-break" /> Stay for a while. It’s all here for
            you. ♡
          </p>
          <div className="birthday-stamps" aria-label="Little birthday stamps">
            <span>🎂 SEPTEMBER GIRL</span>
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
          <div className="home-discovery">
            {data?.birthday?.isBirthday && !personalNote ? (
              <aside className="note-slip birthday-love-note">
                <span className="micro-label">A LITTLE BIRTHDAY WISH ♡</span>
                <p>
                  More favourite songs. More things worth drawing. More little
                  moments that feel like you.
                </p>
                <span className="handwritten">
                  Here’s to a year full of them. 🎀
                </span>
              </aside>
            ) : (
              <Discovery
                kind="maomao"
                card={personalNote}
                label={personalNote?.title ?? "TODAY’S LITTLE FIND"}
              />
            )}
          </div>
        </div>
        <div className="home-collage">
          <Bow className="home-collage__bow" />
          <MaomaoBuddy compact birthday={data?.birthday?.isBirthday} />
          <figure className="portrait-frame home-portrait">
            <div className="portrait-frame__mat">
              {profile.data?.avatarUrl ? (
                <img
                  className="celebration-portrait"
                  src={profile.data.avatarUrl}
                  alt="Kiriya, the birthday girl"
                  width="735"
                  height="763"
                  fetchPriority="high"
                />
              ) : (
                <Picture
                  name="maomao-floral"
                  alt="Maomao among flowers, in pink and green"
                  eager
                  width="735"
                  height="763"
                />
              )}
            </div>
            <figcaption>
              <span className="handwritten">
                {profile.data?.avatarUrl
                  ? "the girl this whole little world is for ♡"
                  : "my little apothecary ♡"}
              </span>
              <span>{profile.data?.avatarUrl ? "KIRIYA" : "猫猫"}</span>
            </figcaption>
            <span className="paper-tape" />
          </figure>
          <Star className="home-collage__star" />
          <div className="home-collage__music">
            <MusicObject song={profile.data?.song} compact />
          </div>
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
        <a href="#play-desk">🎨 doodle & play</a>
        <a href="#maomao">🌿 maomao</a>
        <a href="#music">🎧 miku</a>
        <a href="#cosplay">🎀 dress-up</a>
      </div>
      <BirthdayTakeover
        birthday={data?.birthday}
        signature={data?.signature ?? "Josh"}
      />
      <PlayDesk />
      <MaomaoSpread />
      <MusicSpread />
      <CosplaySpread />
      <ArtSpread />
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
