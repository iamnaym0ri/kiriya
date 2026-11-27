import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../../lib/api.js";
import { useChatSummary } from "../../lib/chat.js";
import { daysUntil, sgDate } from "../../lib/feeds.js";
import { useNotes } from "../../lib/notes.js";
import { useIsAdmin } from "../../lib/session.js";
import { useToday } from "../../lib/world.js";
import { tapByKey } from "../../../shared/taps.js";
import HomeIcon from "./icons.jsx";

const plural = (count, one, many) => (count === 1 ? one : many.replace("#", count > 9 ? "9+" : count));

function chatPreview(chat) {
  const last = chat?.last;
  if (!last) return null;
  const who = last.sender === chat.me ? "you" : chat.names?.[last.sender] ?? "";
  const what =
    last.kind === "text"
      ? last.body
      : last.kind === "tap"
        ? `${tapByKey[last.body]?.emoji ?? "♡"} ${tapByKey[last.body]?.label ?? ""}`
        : last.kind === "deleted"
          ? "message unsent"
          : ({ image: "📷 a photo", gif: "a GIF", sticker: "a sticker", voice: "🎙️ a voice note" }[last.kind] ?? "a message");
  return `${who}: ${what}`;
}

function conLabel(days) {
  if (days === 0) return "today!!";
  if (days === 1) return "tomorrow";
  if (days < 0) return "on now";
  return `in ${days} days`;
}

/** Scrolls to a part of home (the song card, the pinboard) instead of leaving the page. */
function scrollToPart(id) {
  const node = document.getElementById(id);
  if (!node) return;
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

/**
 * What's going on in the app right now, one line each, every line a way in: unread messages, little
 * notes and letters, fresh jar notes, a quiz waiting, a new song, something new pinned, the next con.
 * Anything that isn't there yet (quizzes) simply doesn't show.
 */
export default function GlanceCard({ home }) {
  const admin = useIsAdmin();
  const today = useToday().data;
  const notes = useNotes().data;
  const chat = useChatSummary().data;
  // Same cache entries as the note jar and the events list, so these cost nothing extra.
  const jar = useQuery({
    queryKey: ["me", "note-jar", today?.day ?? "today"],
    queryFn: ({ signal }) => api("/me/note-jar", { signal }),
    staleTime: 60_000,
    enabled: !admin,
  }).data;
  const quizzes = useQuery({
    queryKey: ["me", "quizzes", "summary"],
    queryFn: ({ signal }) => api("/me/quizzes/summary", { signal }),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  }).data;
  const events = useQuery({
    queryKey: ["me", "events"],
    queryFn: () => api("/me/events"),
    retry: false,
    staleTime: 10 * 60_000,
  }).data;

  const other = chat ? chat.names?.[chat.me === "kiriya" ? "admin" : "kiriya"] : admin ? "Kiriya" : "Josh";
  const rows = [];
  if (chat?.unread > 0)
    rows.push({ key: "chat", icon: "chat", to: "/world/chat", title: `${plural(chat.unread, "a new message", "# new messages")} from ${other}`, detail: chatPreview(chat) });
  const unreadNote = notes?.notes?.find((note) => !note.openedAt);
  if (notes?.unread > 0)
    rows.push({
      key: "notes",
      icon: "note",
      to: unreadNote ? `/world/notes?open=${unreadNote.id}` : "/world/mail",
      title: plural(notes.unread, "a little note is waiting", "# little notes are waiting"),
      detail: unreadNote?.title ?? null,
    });
  if (!admin && today?.letters?.unread > 0)
    rows.push({ key: "letters", icon: "letter", to: "/world/mail", title: plural(today.letters.unread, "a letter for you", "# letters for you"), detail: "sealed with love, waiting to be opened" });
  if (jar?.fresh > 0)
    rows.push({ key: "jar", icon: "jar", to: "/world/mail#note-jar", title: plural(jar.fresh, "a new note in the jar", "# new notes in the jar"), detail: "pull one whenever you like" });
  if (quizzes?.waiting > 0)
    rows.push({
      key: "quiz",
      icon: "quiz",
      to: "/world/play",
      title: plural(quizzes.waiting, "a quiz question for you", "# quiz questions for you"),
      detail: quizzes.from ? `from ${quizzes.from} ♡` : "go on, guess ♡",
    });

  const songs = home?.songs ?? [];
  const pins = home?.pins ?? [];
  if (admin) {
    const unheard = songs.filter((song) => song.heardByHer === false).length;
    if (unheard) rows.push({ key: "song", icon: "song", part: "home-song", title: `${plural(unheard, "a song", "# songs")} she hasn’t heard yet`, detail: "she finds one each time she opens the app" });
    if (pins[0] && pins[0].seenByHer === false) rows.push({ key: "pin", icon: "pin", part: "home-pinboard", title: "she hasn’t seen your newest pin yet", detail: pins[0].text });
  } else {
    const fresh = songs.filter((song) => !song.heard);
    if (fresh.length)
      rows.push({
        key: "song",
        icon: "song",
        part: "home-song",
        title: plural(fresh.length, "a new song for you ♫", "# new songs for you ♫"),
        detail: [fresh[fresh.length - 1].title, fresh[fresh.length - 1].artist].filter(Boolean).join(" · "),
      });
    const pinned = pins.filter((pin) => pin.new);
    if (pinned.length) rows.push({ key: "pin", icon: "pin", part: "home-pinboard", title: "something new on the pinboard", detail: pinned[0].label ? `${pinned[0].label}: ${pinned[0].text}` : pinned[0].text });
  }

  const nextCon = (events?.events ?? [])
    .filter((event) => event.tier === "sg" && !event.tbc && event.startsOn && daysUntil(event.endsOn ?? event.startsOn) >= 0)
    .sort((a, b) => Number(b.hers) - Number(a.hers) || String(a.startsOn).localeCompare(String(b.startsOn)))[0];
  const conRow = nextCon && {
    key: "con",
    icon: "event",
    to: `/world/events/${encodeURIComponent(nextCon.id)}`,
    title: nextCon.name,
    detail: [sgDate(nextCon.startsOn), nextCon.venue].filter(Boolean).join(" · "),
    badge: conLabel(daysUntil(nextCon.startsOn)),
  };

  return (
    <section className="app-card app-card--flush home-glance" aria-labelledby="home-glance-title" data-companion-avoid>
      <header className="app-card__head">
        <h2 id="home-glance-title" className="app-card__title">
          what’s new <span aria-hidden="true">♡</span>
        </h2>
        {rows.length > 0 && <span className="home-glance__count">{rows.length} new</span>}
      </header>
      <ul className="app-list home-glance__list">
        {rows.length === 0 && (
          <li className="app-row home-glance__calm">
            <span className="app-row__icon" data-kind="heart">
              <HomeIcon name="heart" />
            </span>
            <span className="app-row__text">
              all caught up ♡
              <small>{admin ? "nothing new from her right now" : "nothing new since you last looked"}</small>
            </span>
          </li>
        )}
        {[...rows, conRow].filter(Boolean).map((row) => (
          <li key={row.key} className="app-row app-row--more" data-kind={row.key}>
            {row.to ? (
              <Link to={row.to}>
                <Row row={row} />
              </Link>
            ) : (
              <button type="button" onClick={() => scrollToPart(row.part)}>
                <Row row={row} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ row }) {
  return (
    <>
      <span className="app-row__icon" data-kind={row.key}>
        <HomeIcon name={row.icon} />
      </span>
      <span className="app-row__text">
        <span className="home-glance__title">{row.title}</span>
        {row.detail && <small>{row.detail}</small>}
      </span>
      {row.badge && <span className="home-glance__badge">{row.badge}</span>}
    </>
  );
}
