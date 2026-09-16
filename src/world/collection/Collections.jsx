import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday } from "../../lib/world.js";
import { uploadFile, shrinkImage } from "../../lib/uploads.js";
import { Icon, Modal, Picture, Star } from "../../shared/WorldPrimitives.jsx";
import { MusicObject, useMusic } from "../../shared/music/MusicRoom.jsx";
import "./Collections.css";
import LoreCarousel from "./LoreCarousel.jsx";
import {
  EpisodeBanner,
  EventsStrip,
  FeedCard,
  FeedPhoto,
  FeedPlaces,
  FeedProgress,
  FeedSection,
  FeedSleeve,
  MerchLine,
  PersonalPhoto,
  useSectionFeed,
} from "../feeds/FeedPieces.jsx";

const NOTE_LABELS = {
  sekai: "PROJECT SEKAI · GLOBAL",
  note: "A NOTE BETWEEN SONGS",
  news: "FRESH NEWS",
  lore: "A LITTLE LORE",
  process: "FROM THE SEWING TABLE",
  tutorial: "FROM THE SEWING TABLE",
  dare: "A LITTLE DARE",
  event: "ON THE CALENDAR",
  extra: "A LITTLE EXTRA",
  look: "A LOOK TO STEAL",
  spot: "A SHOOT SPOT",
  creator: "SINGAPORE SCENE",
  meme: "A LITTLE MEME",
  cosplay: "MORE DRESS-UP",
  visual: "A LITTLE PICTURE",
};
const titleCase = (text) =>
  text.replace(/(^|\s)(\p{L})/gu, (_, gap, c) => gap + c.toUpperCase());

export function SectionHeading({
  index,
  title,
  emphasis,
  subtitle,
  to,
  action,
  page = false,
}) {
  const Heading = page ? "h1" : "h2";
  return (
    <header className="section-heading">
      <div>
        <p className="micro-label">{index}</p>
        <Heading>
          {title} {emphasis && <em>{emphasis}</em>}
        </Heading>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {to && (
        <Link className="text-link" to={to}>
          {action ?? "Look inside"}
          <Icon name="arrow" size={15} />
        </Link>
      )}
    </header>
  );
}
export function Discovery({ kind = "maomao", card, label, another = false }) {
  const today = useToday();
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const collection = useQuery({
    queryKey: ["me", "discoveries", kind],
    queryFn: () => api(`/me/discoveries?kind=${kind}`),
    enabled: another,
    staleTime: Infinity,
  });
  const items = collection.data?.items ?? [];
  const selected = index
    ? items[(index - 1) % items.length]
    : (card ?? today.data?.cards.find((c) => c.kind === kind));
  return (
    <aside className="note-slip">
      <span className="micro-label">{label ?? "A LITTLE FIND FOR YOU"}</span>
      {selected ? (
        <>
          {selected.spoiler && !revealed ? (
            <div>
              <p>A sealed Maomao note.</p>
              <button className="text-link" onClick={() => setRevealed(true)}>
                Reveal manga spoiler <Icon name="lock" size={13} />
              </button>
            </div>
          ) : (
            <p>{selected.body}</p>
          )}
          <div className="note-slip__source">
            {selected.source ? (
              <a href={selected.source} target="_blank" rel="noreferrer">
                Read the source ↗
              </a>
            ) : (
              <span>
                {selected.kind === "special"
                  ? "Kept here for you."
                  : "A sketchbook prompt"}
              </span>
            )}
            {another && items.length > 0 && (
              <button
                onClick={() => {
                  setIndex(index + 1);
                  setRevealed(false);
                }}
              >
                Another little find
                <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
        </>
      ) : (
        <p>
          {today.isError
            ? "The little finds couldn’t load. Your collection is still here."
            : "A little room for your next discovery."}
        </p>
      )}
    </aside>
  );
}
export function GalleryViewer({
  items,
  index,
  onChange,
  onClose,
  onDelete,
  deleteLabel = "Delete saved sketch",
}) {
  const item = items[index];
  if (!item) return null;
  return (
    <Modal
      title={item.title ?? "A closer look"}
      onClose={onClose}
      className="gallery-dialog"
    >
      <img src={item.url} alt={item.alt ?? item.title ?? "Saved image"} />
      <p>{item.caption}</p>
      {item.source && (
        <a
          className="text-link"
          href={item.source}
          target="_blank"
          rel="noreferrer"
        >
          Original source <Icon name="diagonal" size={14} />
        </a>
      )}
      <div className="gallery-dialog__actions">
        <button
          className="button-paper"
          disabled={items.length < 2}
          onClick={() => onChange((index + items.length - 1) % items.length)}
        >
          Previous
        </button>
        {onDelete && (
          <button className="quiet-button" onClick={() => onDelete(item)}>
            {deleteLabel}
          </button>
        )}
        <button
          className="button-paper"
          disabled={items.length < 2}
          onClick={() => onChange((index + 1) % items.length)}
        >
          Next
        </button>
      </div>
    </Modal>
  );
}
export function CosplaySpread({ full = false }) {
  const profile = usePublicProfile();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["me", "cosplay"],
    queryFn: () => api("/me/atelier/cosplay"),
  });
  const [view, setView] = useState(null);
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState({ character: "", notes: "", file: null });
  const projects = query.data?.projects ?? [];
  const photos = [
    ...projects
      .filter((p) => p.coverUrl)
      .map((p) => ({
        id: p.id,
        title: p.character,
        url: p.coverUrl,
        caption: p.notes ?? p.series,
        alt: `${p.character} cosplay photograph`,
      })),
    ...(profile.data?.cosplays ?? [])
      .filter((p) => p.photoUrl)
      .map((p) => ({
        title: p.character,
        url: p.photoUrl,
        caption: p.series,
        alt: `${p.character} cosplay photograph`,
      })),
  ];
  const upload = useMutation({
    mutationFn: async () => {
      const stored = await uploadFile(await shrinkImage(form.file), {
        folder: "cosplay",
      });
      return api("/me/atelier/cosplay", {
        method: "POST",
        body: {
          character: form.character,
          notes: form.notes,
          coverUrl: stored.url,
        },
      });
    },
    onSuccess: () => {
      setAdd(false);
      setForm({ character: "", notes: "", file: null });
      queryClient.invalidateQueries({ queryKey: ["me", "cosplay"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/me/atelier/cosplay/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setView(null);
      queryClient.invalidateQueries({ queryKey: ["me", "cosplay"] });
    },
  });
  const references = [
    {
      url: "/images/maomao-floral.webp",
      title: "Maomao",
      caption: "Character illustration · supplied reference",
      alt: "Maomao’s pink robe, green wrap and teal hair",
    },
    {
      url: "/images/maomao-blossom-cosplay.webp",
      title: "The little details",
      caption: "Pink robes & cherry blossoms · supplied cosplay reference",
      alt: "A Maomao cosplayer in pink and green robes holding a fan beneath cherry blossoms",
      fullImage: true,
      source:
        "https://i.pinimg.com/736x/99/53/d4/9953d40bb8039d93160972f9e45b7c7d.jpg",
    },
    {
      url: "/images/miku-birthday.webp",
      title: "Hatsune Miku",
      caption: "A birthday wish from Miku · supplied illustration",
      alt: "Hatsune Miku smiling and holding a birthday cake beneath colourful confetti",
      fullImage: true,
      source:
        "https://i.pinimg.com/736x/fa/53/de/fa53de0920761a74877d8e54fe7db0e1.jpg",
    },
  ];
  const display = photos.length ? photos : references;
  const dress = useSectionFeed("dressup");
  const three = dress.entries.filter((e) => e.type === "three");
  const community = dress.entries.filter(
    (e) => !["three", "merch"].includes(e.type),
  );
  const personal = dress.data?.plan?.personal;
  // The reference images are the fallback: they step aside only while today's three is showing.
  const showReferences = photos.length > 0 || !(dress.live && three.length);
  return (
    <section className="editorial-section cosplay-spread" id="cosplay">
      <SectionHeading
        index="🎀 A LITTLE DRESS-UP DIARY"
        title="A little dress-up,"
        emphasis="a lot of you."
        subtitle={
          photos.length
            ? "Costumes, careful details, and all the work between."
            : "Maomao, Miku, Lynette. A place for every version you bring to life."
        }
        to={full ? undefined : "/world/atelier"}
        action="The lookbook"
        page={full}
      />
      {dress.live && three.length > 0 && (
        <FeedSection title={`Today’s cosplay picks${personal ? " + one of yours" : ""}`} subtitle={dress.data.plan?.rotatingFandom ? `Today’s rotation: ${dress.data.plan.rotatingFandom}` : "Looks, transformations & the people behind them."} symbol="♡" tone="rose">
          <div className="feed-lookbook">
            {three.map((entry, i) => (
              <FeedPhoto
                key={entry.key}
                entry={entry}
                index={i}
                title={titleCase(
                  entry.primary.tags?.characters?.[0] ?? "today’s pick",
                )}
                onSeen={dress.markSeen}
              />
            ))}
            {personal && (
              <PersonalPhoto personal={personal} index={three.length} />
            )}
          </div>
        </FeedSection>
      )}
      {showReferences && !photos.length && (
        <p className="collection-label">
          <span />
          CHARACTER & MAKER REFERENCES{" "}
          <span className="collection-label__detail">
            Your own photographs will live here.
          </span>
        </p>
      )}
      {showReferences && (
        <div className="lookbook-grid">
          {display.slice(0, full ? 12 : 3).map((item, i) => (
            <button
              className={`lookbook-photo lookbook-photo--${i % 3}`}
              key={item.url}
              onClick={() => setView(i)}
            >
              <img
                className={
                  item.fullImage ? "lookbook-photo__full-image" : undefined
                }
                src={item.url}
                alt={item.alt}
                loading="lazy"
              />
              <span className="lookbook-photo__caption">
                <span>
                  <small>{String(i + 1).padStart(2, "0")}</small>
                  <strong>{item.title}</strong>
                </span>
                <Icon name="diagonal" size={19} />
              </span>
              <span className="lookbook-photo__credit">{item.caption}</span>
            </button>
          ))}
        </div>
      )}
      <div className="lookbook-foot">
        <p className="handwritten">the wig is practically its own character.</p>
        <button className="text-link" onClick={() => setAdd(true)}>
          Add a cosplay photo <Icon name="arrow" size={15} />
        </button>
      </div>
      {dress.live && (
        <FeedSection title="New dress-up drops" subtitle="Fresh finds from your little cosplay world." symbol="✂" className="feed-dressup">
          <FeedProgress data={dress.data} label="TODAY’S DRESS-UP DROP" />
          {community.length > 0 && (
            <div className="feed-notes">
              {community.slice(0, full ? 30 : 2).map((entry) => (
                <FeedCard
                  key={entry.key}
                  entry={entry}
                  label={NOTE_LABELS[entry.type] ?? "A LITTLE EXTRA"}
                  onSeen={dress.markSeen}
                />
              ))}
            </div>
          )}
          {full && <EventsStrip />}
          <MerchLine
            entry={dress.entries.find((e) => e.type === "merch")}
            onSeen={dress.markSeen}
          />
          {full && <FeedPlaces />}
        </FeedSection>
      )}
      {full && (
        <div className="cosplay-notes">
          <Discovery kind="cosplay" label="FROM THE SEWING TABLE" another />
          <aside className="note-slip">
            <span className="micro-label">A MAKER’S MARGIN NOTE</span>
            <p>
              SajaLyn widened the overlap on her next wrap skirt after the first
              opened when walking. A little movement test can change the whole
              fit.
            </p>
            <div className="note-slip__source">
              <a href={references[1].source} target="_blank" rel="noreferrer">
                SajaLyn’s full process ↗
              </a>
            </div>
          </aside>
        </div>
      )}
      {view !== null && (
        <GalleryViewer
          items={display}
          index={view}
          onChange={setView}
          onClose={() => setView(null)}
          deleteLabel="Remove photograph"
          onDelete={
            display[view]?.id
              ? (item) => {
                  if (
                    window.confirm("Remove this photograph from your lookbook?")
                  )
                    remove.mutate(item.id);
                }
              : undefined
          }
        />
      )}
      {add && (
        <Modal title="Add to your lookbook" onClose={() => setAdd(false)}>
          <form
            className="collection-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.file) upload.mutate();
            }}
          >
            <label>
              Character
              <input
                className="field"
                required
                maxLength={80}
                value={form.character}
                onChange={(e) =>
                  setForm({ ...form, character: e.target.value })
                }
              />
            </label>
            <label>
              Photograph
              <input
                className="field"
                type="file"
                required
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) =>
                  setForm({ ...form, file: e.target.files?.[0] })
                }
              />
            </label>
            <label>
              A caption
              <textarea
                className="field"
                maxLength={4000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <p className="status-copy">Saved privately to your lookbook.</p>
            <button className="button-plum" disabled={upload.isPending}>
              {upload.isPending ? "Adding your photo…" : "Save photograph"}
            </button>
            {upload.error && <p role="alert">{upload.error.message}</p>}
          </form>
        </Modal>
      )}
    </section>
  );
}
export function MaomaoSpread({ full = false }) {
  const club = useSectionFeed("maomao");
  const memes = club.entries.filter((entry) => entry.type === "meme");
  return (
    <section className="editorial-section maomao-spread" id="maomao">
      <SectionHeading
        index="🌿 A VERY PARTICULAR SOFT SPOT"
        title="Maomao appreciation"
        emphasis="club."
        subtitle="Favourite pictures, little stories, and one very curious girl."
        to={full ? undefined : "/world/apothecary"}
        action="More little finds"
        page={full}
      />
      <EpisodeBanner episode={club.data?.plan?.episode} />
      <FeedSection title={club.live ? "New Maomao drops" : "From the Maomao collection"} subtitle="Pictures, clips & a little apothecary lore." symbol="❀" tone="mint">
        <FeedProgress data={club.data} />
        <LoreCarousel kind="maomao" feed={club.entries.filter((entry) => !["merch", "meme"].includes(entry.type))} onSeen={club.markSeen} />
        {memes.length > 0 && <FeedSection title="Maomao memes" subtitle="The side-eye deserves its own corner." symbol="(¬‿¬)" tone="rose" level={4}>
          <div className="feed-lookbook">
            {memes.slice(0, full ? 30 : 2).map((entry, index) => <FeedPhoto key={entry.key} entry={entry} index={index} title="a little Maomao meme" onSeen={club.markSeen} />)}
          </div>
        </FeedSection>}
        <MerchLine entry={club.entries.find((entry) => entry.type === "merch")} onSeen={club.markSeen} />
      </FeedSection>
      <div className="maomao-afterword">
        <p>
          A little shrine to the girl
          <br />
          with the best side-eye. ♡
        </p>
        <Discovery
          kind="maomao"
          label="ANOTHER PAGE IN THE COLLECTION"
          another
        />
      </div>
      {full && club.live && <FeedPlaces />}
    </section>
  );
}
export function MusicSpread({ full = false }) {
  const profile = usePublicProfile();
  const library = useQuery({
    queryKey: ["me", "songs"],
    queryFn: () => api("/me/songs"),
  });
  const picks = useQuery({
    queryKey: ["me", "music-picks"],
    queryFn: () => api("/me/music-picks"),
    staleTime: Infinity,
  });
  const music = useMusic();
  const drop = useSectionFeed("music");
  const feedSongs = drop.entries.filter((e) => e.type === "song");
  const feedNotes = drop.entries.filter((e) =>
    ["sekai", "note", "news", "lore", "event"].includes(e.type),
  );
  const feedVisuals = drop.entries.filter((e) =>
    ["visual", "meme"].includes(e.type),
  );
  // Owner decision (2026-09-16, second pass): this shelf should be her own collection and the live
  // feed, not the authored stand-ins. Her saved songs always come first; the hardcoded picks only
  // fill in on a day the feed brought no songs, so the shelf is never empty.
  const hers = library.data?.songs ?? [];
  const authored = feedSongs.length ? [] : (picks.data?.songs ?? []);
  const songs = [...hers, ...authored]
    .filter((s, i, list) => list.findIndex((x) => x.url === s.url) === i)
    .slice(0, full ? 12 : 3);
  return (
    <section className="editorial-section music-spread" id="music">
      <SectionHeading
        index="🎧 A SONG TO KEEP YOU COMPANY"
        title="A world with"
        emphasis="a soundtrack."
        subtitle="Miku at the centre. Rin, Len, and room for your next favourite."
        to={full ? undefined : "/world/stage"}
        action="Your music"
        page={full}
      />
      <LoreCarousel kind="miku" />
      <div className="music-shelf">
        <MusicObject song={profile.data?.song} />
        {songs.length > 0 && (
          <div className="record-sleeves">
            {songs.map((song, i) => (
              <button
                className="record-sleeve"
                key={song.url}
                onClick={() => music.play(song)}
              >
                <span className="record-sleeve__image">
                  {song.thumbnail ? (
                    <img
                      src={song.thumbnail}
                      alt={`${song.title} video cover`}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/images/miku.webp";
                        e.currentTarget.onerror = null;
                      }}
                    />
                  ) : (
                    <Picture name={i % 2 ? "rin" : "miku"} alt="" />
                  )}
                  <span className="record-play">
                    <Icon name="play" size={20} />
                  </span>
                </span>
                <strong>{song.title}</strong>
                <small>{song.artist}</small>
                <span className="record-sleeve__label">
                  {song.id ? "YOUR COLLECTION" : "A SELECTED LISTEN"}
                </span>
              </button>
            ))}
          </div>
        )}
        <Discovery
          kind="vocaloid"
          label="A NOTE BETWEEN SONGS"
          another={full}
        />
      </div>
      {drop.live && (
        <FeedSection title="New music drops" subtitle="Songs, news & finds for your next little obsession." symbol="♫" className="feed-music">
          <FeedProgress data={drop.data} label="TODAY’S SONGS & FINDS" />
          {feedSongs.length > 0 && (
            <div className="feed-drop__group">
            <h4 className="feed-drop__group-title">Songs to play <span aria-hidden="true">▷</span></h4>
            <div className="record-sleeves feed-sleeves">
              {feedSongs.slice(0, full ? 25 : 3).map((entry) => (
                <FeedSleeve
                  key={entry.key}
                  entry={entry}
                  onSeen={drop.markSeen}
                />
              ))}
            </div>
            </div>
          )}
          {feedNotes.length > 0 && (
            <div className="feed-drop__group">
            <h4 className="feed-drop__group-title">News & little finds <span aria-hidden="true">✧</span></h4>
            <div className="feed-notes">
              {feedNotes.slice(0, full ? 25 : 1).map((entry) => (
                <FeedCard
                  key={entry.key}
                  entry={entry}
                  label={NOTE_LABELS[entry.type] ?? "A LITTLE NOTE"}
                  onSeen={drop.markSeen}
                />
              ))}
            </div>
            </div>
          )}
          {full && feedVisuals.length > 0 && (
            <div className="feed-drop__group">
            <h4 className="feed-drop__group-title">Fan art & memes <span aria-hidden="true">♡</span></h4>
            <div className="feed-lookbook">
              {feedVisuals.map((entry, i) => (
                <FeedPhoto
                  key={entry.key}
                  entry={entry}
                  index={i}
                  title={entry.type === "meme" ? "a little meme" : "fan art"}
                  onSeen={drop.markSeen}
                />
              ))}
            </div>
            </div>
          )}
          <MerchLine
            entry={drop.entries.find((e) => e.type === "merch")}
            onSeen={drop.markSeen}
          />
          {full && <FeedPlaces />}
        </FeedSection>
      )}
      {full && (
        <div className="kagamine-strip">
          <Picture
            name="rin"
            alt="Kagamine Rin’s original character illustration"
            width="600"
            height="600"
          />
          <div>
            <span className="micro-label">ALSO IN GOOD COMPANY</span>
            <h2>Rin & Len</h2>
            <p>Two familiar voices. Plenty of stories.</p>
            <small>© Crypton Future Media, Inc. 2007 · CC BY-NC 3.0</small>
          </div>
          <Picture
            name="len"
            alt="Kagamine Len’s original character illustration"
            width="600"
            height="600"
          />
        </div>
      )}
    </section>
  );
}
