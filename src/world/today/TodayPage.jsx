import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { Link } from "react-router";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday, useOpenDrawer } from "../../lib/world.js";
import { Discovery } from "../collection/Collections.jsx";
import { Icon, Star } from "../../shared/WorldPrimitives.jsx";
import ListeningPick from "../stage/ListeningPick.jsx";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import { Bow } from "../../shared/play/PlayfulWorld.jsx";
import PlayDesk from "../play/PlayDesk.jsx";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";
import WorldWelcome from "../../shared/profile/WorldWelcome.jsx";
import CosplayPortrait from "../../shared/profile/CosplayPortrait.jsx";
import NoteJar from "./NoteJar.jsx";
import HomeNudges from "./HomeNudges.jsx";
import { EventsStrip, HomeMerch } from "../feeds/FeedPieces.jsx";
import { useFeed } from "../../lib/feeds.js";
import { useNotes } from "../../lib/notes.js";
import { useChatSummary } from "../../lib/chat.js";
import { tapByKey } from "../../../shared/taps.js";
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
  const feedsLive = Boolean(useFeed("merch").data?.revision);
  const unread = useNotes().data?.unread ?? 0;
  return (
    <div className="personal-home">
      <HomeNudges />
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
            <ListeningPick compact />
          </div>
          {/* Maomao is no longer pinned to this collage: she lives in the world now and walks it
              (see world/mascot/MaomaoCompanion.jsx, mounted by WorldShell). */}
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
        <a href="#letters-hub">✉ letters & notes</a>
        <a href="#note-jar">♡ the note jar</a>
        <a href="#play-desk">🎨 doodle & play</a>
        <a href="#events">☆ events</a>
        <a href="#merch">♡ merch</a>
        {feedsLive && (
          <>
            <Link to="/world/saves">♡ saves</Link>
          </>
        )}
      </div>
      <LettersHub unread={unread} day={data?.day} />
      <NoteJar
        birthday={data?.birthday}
        signature={data?.signature ?? "Josh"}
        day={data?.day}
      />
      <PlayDesk />
      <EventsStrip standalone />
      <HomeMerch />
    </div>
  );
}

/** Everything written between us, kept near the top so it is the first thing she reaches. */
function LettersHub({ unread, day }) {
  // Same cache entry as the jar below, so this costs no extra request.
  const jar = useQuery({
    queryKey: ["me", "note-jar", day ?? "today"],
    queryFn: ({ signal }) => api("/me/note-jar", { signal }),
    staleTime: 60_000,
  });
  const fresh = jar.data?.fresh ?? 0;
  const chat = useChatSummary().data;
  const other = chat?.me === "kiriya" ? "admin" : "kiriya";
  const last = chat?.last;
  const preview = !last
    ? "say hi ♡ photos, voice notes, stickers & little taps"
    : `${last.sender === chat.me ? "you" : chat.names[last.sender]}: ${
        last.kind === "text" ? last.body : last.kind === "tap" ? `${tapByKey[last.body]?.emoji ?? "♡"} ${tapByKey[last.body]?.label ?? ""}` : last.kind === "deleted" ? "message unsent" : ({ image: "📷 a photo", gif: "a GIF", sticker: "a sticker", voice: "🎙️ a voice note" }[last.kind] ?? "a message")
      }`;
  return (
    <section className="letters-hub" id="letters-hub" aria-labelledby="letters-hub-title">
      <header className="letters-hub__heading">
        <span className="micro-label">JUST BETWEEN US</span>
        <h2 id="letters-hub-title">
          Letters, messages & <em>little notes.</em>
        </h2>
        <p>Everything between us lives right here.</p>
      </header>
      <Link className="letters-hub__chat" to="/world/chat" data-unread={chat?.unread > 0 || undefined}>
        <span className="letters-hub__chat-icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16v11H9l-5 4Z" />
            <path d="M9.5 10.5q2.5 2 5 0" />
          </svg>
        </span>
        <span className="letters-hub__chat-text">
          <strong>
            Messages{chat ? ` with ${chat.names[other]}` : ""}
            {chat?.unread > 0 && <span className="letters-hub__count">{chat.unread > 9 ? "9+" : chat.unread} new</span>}
          </strong>
          <span>{preview}</span>
        </span>
        <span className="letters-hub__chat-go" aria-hidden="true">→</span>
      </Link>
      <div className="letters-hub__doors">
        <Link className="letters-hub__door" to="/world/letters">
          <Icon name="mail" size={26} />
          <strong>Your letters</strong>
          <span>your birthday gift, and every letter after it</span>
        </Link>
        <Link className="letters-hub__door" to="/world/notes" data-unread={unread > 0 || undefined}>
          <Icon name="heart" size={26} />
          <strong>
            Little notes
            {unread > 0 && <span className="letters-hub__count">{unread > 9 ? "9+" : unread} new</span>}
          </strong>
          <span>every note that finds your phone, kept safe</span>
        </Link>
        <a className="letters-hub__door" href="#note-jar" data-unread={fresh > 0 || undefined}>
          <span className="letters-hub__glyph" aria-hidden="true">✿</span>
          <strong>
            The note jar
            {fresh > 0 && <span className="letters-hub__count">{fresh > 9 ? "9+" : fresh} new</span>}
          </strong>
          <span>pull a little note whenever you need one</span>
        </a>
      </div>
    </section>
  );
}
