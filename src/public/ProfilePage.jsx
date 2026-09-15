import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { countView, usePublicProfile } from "../lib/profile.js";
import { useSession } from "../lib/session.js";
import UnlockSheet from "../shared/UnlockSheet.jsx";
import { Credits, Icon, Picture, Star } from "../shared/WorldPrimitives.jsx";
import { MusicObject } from "../shared/music/MusicRoom.jsx";
import {
  BirthdayRibbon,
  Bow,
  MaomaoBuddy,
  MotionToggle,
} from "../shared/play/PlayfulWorld.jsx";
import "./ProfilePage.css";

export default function ProfilePage() {
  const profile = usePublicProfile();
  const session = useSession();
  const navigate = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [credits, setCredits] = useState(false);
  const [views, setViews] = useState(null);
  useEffect(() => {
    countView().then((count) => {
      if (count !== null) setViews(count);
    });
  }, []);
  const [copied, setCopied] = useState(false);
  const data = profile.data;
  useEffect(() => {
    document.title = data?.birthday?.isBirthday
      ? "happy birthday, kiriya ♡"
      : "kiriya · a little lilac world";
  }, [data?.birthday?.isBirthday]);
  const enter = () =>
    session.data?.role ? navigate("/world") : setUnlockOpen(true);
  return (
    <div className="lilac-scene public-scene">
      <header className="public-mast">
        <a href="/" className="tiny-wordmark">
          kiriya<span>✦</span>
        </a>
        <span className="public-mast__note">
          a little corner of the internet
        </span>
        <div className="public-mast__actions">
          <MotionToggle />
          <button className="quiet-button" onClick={enter}>
            <Icon name="lock" size={15} />
            <span>Private world</span>
          </button>
        </div>
      </header>
      <BirthdayRibbon />
      <main className="identity-scene" id="main">
        <section
          className="identity-paper"
          aria-labelledby="identity-title"
          data-motion-region
        >
          <Bow className="identity-paper__bow" />
          <div className="identity-paper__top">
            <span className="micro-label">MADE OF LITTLE LOVES</span>
            <Star />
          </div>
          <p className="handwritten identity-hello">
            {data?.birthday?.isBirthday
              ? "happy birthday to"
              : "hello, you found me."}
          </p>
          <h1 id="identity-title" className="identity-name">
            {data?.name ?? "kiriya"}
            <span aria-hidden="true">♡</span>
          </h1>
          <figure className="identity-mobile-portrait" data-motion-region>
            <Bow />
            <img
              src={data?.avatarUrl || "/images/maomao-floral.webp"}
              alt={
                data?.avatarUrl
                  ? "Kiriya, the birthday girl"
                  : "Maomao among pale flowers"
              }
              width="735"
              height="763"
            />
            <figcaption>
              {data?.avatarUrl
                ? "a whole little world, for you ♡"
                : "my favourite little apothecary ♡"}
            </figcaption>
          </figure>
          <p className="identity-bio">
            {data?.bioLines?.[0] ?? "a little world for Kiriya"}
          </p>
          {data?.bioLines?.length > 1 && (
            <details className="identity-more">
              <summary>a little more about me</summary>
              {data.bioLines.slice(1).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </details>
          )}
          <div className="identity-interests">
            <span>🎨 art & little sketches</span>
            <span>🎀 cosplay</span>
            <span>🌿 Maomao</span>
            <span>🎧 Miku on repeat</span>
          </div>
          <div className="identity-rule">
            <span>✧</span>
          </div>
          <p className="identity-dedication">
            {data?.birthday?.isBirthday
              ? "A whole little world, made with love."
              : "A place for the things I love."}
            <br />
            {data?.birthday?.isBirthday
              ? "Today is for celebrating you. ♡"
              : "And a few things made just for me."}
          </p>
          <div className="identity-socials">
            {data?.socials?.tiktok?.handle && (
              <a
                className="quiet-button"
                href={
                  data.socials.tiktok.url ||
                  `https://www.tiktok.com/@${data.socials.tiktok.handle}`
                }
                target="_blank"
                rel="noreferrer"
              >
                TikTok <Icon name="diagonal" size={14} />
              </a>
            )}
            {data?.socials?.discord?.username && (
              <button
                className="quiet-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      data.socials.discord.username,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied!" : data.socials.discord.username}{" "}
                <span className="micro-label">DISCORD</span>
              </button>
            )}
          </div>
          <button className="button-plum identity-door" onClick={enter}>
            <Icon name="lock" size={16} />
            {session.data?.role
              ? "Back to your world"
              : "The rest is just for Kiriya"}
            <Icon name="arrow" size={18} />
          </button>
          {profile.isError && (
            <button className="quiet-button" onClick={() => profile.refetch()}>
              Profile couldn’t load · try again
            </button>
          )}
          <span className="identity-paper__foot micro-label">
            A PERSONAL SPACE, WITH LOVE
          </span>
        </section>
        <div className="identity-collection" data-motion-region>
          <MaomaoBuddy compact birthday={data?.birthday?.isBirthday} />
          <figure className="portrait-frame identity-portrait">
            <div className="portrait-frame__mat">
              {data?.avatarUrl ? (
                <img
                  className="celebration-portrait"
                  src={data.avatarUrl}
                  alt="Kiriya, the birthday girl"
                  width="735"
                  height="763"
                  fetchPriority="high"
                />
              ) : (
                <Picture
                  name="maomao-floral"
                  alt="Maomao surrounded by pale flowers, wearing pink and green"
                  eager
                  width="735"
                  height="763"
                />
              )}
            </div>
            <figcaption>
              <span className="handwritten">
                {data?.avatarUrl
                  ? "the girl this whole little world is for ♡"
                  : "the apothecary has my heart"}
              </span>
              <span>{data?.avatarUrl ? "KIRIYA" : "MAOMAO"}</span>
            </figcaption>
            <span className="paper-tape" aria-hidden="true" />
          </figure>
          <Star className="identity-star" />
          <div className="identity-music">
            <MusicObject song={data?.song} compact />
          </div>
          <p className="identity-side-note">
            flowers, favourite characters
            <br />& a song or two.
          </p>
        </div>
      </main>
      <footer className="public-footer">
        <span>
          made with love for kiriya <span aria-hidden="true">♡</span>
        </span>
        <button onClick={() => setCredits(true)}>
          Art & credits <Icon name="diagonal" size={12} />
        </button>
        <span className="public-footer__date">
          {data?.showViews
            ? `${(views ?? data.views ?? 0).toLocaleString()} visits to this little world`
            : "a world of her own"}
        </span>
      </footer>
      <UnlockSheet
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => {
          setUnlockOpen(false);
          navigate("/world");
        }}
      />
      {credits && <Credits onClose={() => setCredits(false)} />}
    </div>
  );
}
