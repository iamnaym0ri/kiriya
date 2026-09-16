import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday } from "../../lib/world.js";
import { DISCOVERY_SECTIONS, discoveryEntries } from "../../../shared/feedContent.js";
import { uploadFile, shrinkImage } from "../../lib/uploads.js";
import { Icon, Modal } from "../../shared/WorldPrimitives.jsx";
import { useMusic } from "../../shared/music/MusicRoom.jsx";
import SongArtwork from "../../shared/music/SongArtwork.jsx";
import ListeningPick from "../stage/ListeningPick.jsx";
import { cosplayCollection, filterCosplays, isCosplay, selectCosplayPicks } from "../../lib/feedPresentation.js";
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
export function Discovery(props) {
  return props.card || props.kind === "art" ? <PersonalDiscovery {...props} /> : <FeedDiscovery {...props} />;
}

function FeedDiscovery({ kind = "maomao", label, another = false }) {
  const section = DISCOVERY_SECTIONS[kind] ?? "maomao";
  const source = useSectionFeed(section);
  const [index, setIndex] = useState(0);
  const items = discoveryEntries(source.entries);
  const selected = items[index % items.length];
  if (!selected) return <aside className="note-slip" data-discovery-source="feed">
    <span className="micro-label">{label ?? "A LITTLE FIND FOR YOU"}</span>
    <p>{source.feed.isPending ? "Finding the latest little notes…" : source.feed.isError ? "These little finds couldn’t load just now." : "No new notes in this drop yet. The next ones will land here."}</p>
    {source.feed.isError && <button className="text-link" onClick={() => source.feed.refetch()}>Try again ↺</button>}
  </aside>;
  return <div data-discovery-source="feed">
    <FeedCard key={selected.primary.id} entry={selected} label={label ?? "A LITTLE FIND FOR YOU"} showMedia={false} onSeen={source.markSeen} />
    {another && items.length > 1 && <button className="text-link" onClick={() => setIndex((value) => value + 1)}>Another little find <Icon name="arrow" size={14} /></button>}
  </div>;
}

// Personal letters and drawing prompts are authored features, separate from external discoveries.
function PersonalDiscovery({ kind = "art", card, label, another = false }) {
  const today = useToday();
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const collection = useQuery({
    queryKey: ["me", "discoveries", kind],
    queryFn: () => api(`/me/discoveries?kind=${kind}`),
    enabled: another && kind === "art",
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
  const display = photos;
  const dress = useSectionFeed("dressup");
  const [params, setParams] = useSearchParams();
  const collection = ["apothecary", "miku"].includes(params.get("collection")) ? params.get("collection") : "all";
  const selectedId = params.get("item");
  const three = selectCosplayPicks(dress.entries);
  const fullShelf = filterCosplays(dress.entries, collection, selectedId);
  const community = dress.entries.filter((entry) => !isCosplay(entry) && !["three", "merch"].includes(entry.type));
  const ready = fullShelf.length > 0;
  useEffect(() => {
    if (full && selectedId && ready) document.getElementById("cosplay-feed")?.scrollIntoView({ block: "start" });
  }, [full, selectedId, ready]);
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
      <FeedSection id="cosplay-feed" title={full ? "The cosplay feed" : "Today’s cosplay picks"} subtitle={full ? "Real makers, transformations & the details worth zooming in on." : "Maomao first, another lovely look, then a little Miku. Tap a photo to explore its lookbook."} symbol="♡" tone="rose">
        {full ? <>
          <div className="cosplay-filter-bar" aria-label="Cosplay collections">
            {[["all", "All cosplay"], ["apothecary", "Maomao & the apothecary"], ["miku", "Hatsune Miku"]].map(([value, label]) => <button key={value} type="button" aria-pressed={collection === value} onClick={() => setParams(value === "all" ? {} : { collection: value })}>{label}</button>)}
          </div>
          {fullShelf.length ? <div className="feed-lookbook">
            {fullShelf.map((entry, i) => <div key={entry.key} className="cosplay-feed-item" data-selected={entry.primary.id === selectedId ? "" : undefined}>
              {entry.primary.id === selectedId && <p className="micro-label">THE LOOK YOU OPENED ♡</p>}
              <FeedPhoto entry={entry} index={i} onSeen={dress.markSeen} />
            </div>)}
          </div> : <p className="feed-empty">{dress.feed.isPending ? "Opening the lookbook…" : dress.feed.isError ? "The cosplay feed couldn’t load. Please try again in a little while." : "No published cosplay in this collection yet. Try another collection above."}</p>}
        </> : <div className="feed-lookbook feed-cosplay-picks">
          {three.map((entry, i) => entry ? <FeedPhoto key={entry.key} entry={entry} index={i} onSeen={dress.markSeen} to={`/world/atelier?collection=${cosplayCollection(entry.primary)}&item=${encodeURIComponent(entry.primary.id)}#cosplay-feed`} />
            : <Link key={`empty-${i}`} className="cosplay-pick-empty" to={`/world/atelier?collection=${i === 2 ? "miku" : i === 0 ? "apothecary" : "all"}#cosplay-feed`}>
              <span aria-hidden="true">{["( ˘͈ ᵕ ˘͈ )", "(¬‿¬)", "♫"][i]}</span><h4>{["Maomao looks", "More dress-up inspiration", "A little Miku"][i]}</h4>
              <p>{dress.feed.isPending ? "Finding the latest looks…" : dress.feed.isError ? "The feed couldn’t load just now." : "No published look for this spot yet."}</p><small>Explore the lookbook →</small>
            </Link>)}
        </div>}
      </FeedSection>
      {photos.length > 0 && <FeedSection title="Your own dress-up diary" subtitle="The looks you brought to life." symbol="🎀" tone="rose">
        <div className="lookbook-grid">
          {display.slice(0, full ? 12 : 3).map((item, i) => <button className={`lookbook-photo lookbook-photo--${i % 3}`} key={item.url} onClick={() => setView(i)}>
            <img src={item.url} alt={item.alt} loading="lazy" />
            <span className="lookbook-photo__caption"><span><small>{String(i + 1).padStart(2, "0")}</small><strong>{item.title}</strong></span><Icon name="diagonal" size={19} /></span>
            <span className="lookbook-photo__credit">{item.caption}</span>
          </button>)}
        </div>
      </FeedSection>}
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
              {community.slice(0, full ? 30 : 6).map((entry) => (
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
          {full && <MerchLine entry={dress.entries.find((e) => e.type === "merch")} onSeen={dress.markSeen} />}
          {full && <FeedPlaces />}
        </FeedSection>
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
  const visuals = club.entries.filter((entry) => entry.type === "visual");
  const notes = club.entries.filter((entry) => !["visual", "merch", "meme"].includes(entry.type));
  const companions = visuals.flatMap((entry) => (entry.companions ?? []).map((primary) => ({ key: primary.id, type: primary.kind, primary, ids: [primary.id], companions: [] })));
  const allNotes = [...notes, ...companions].filter((entry, i, list) => list.findIndex((other) => other.primary.id === entry.primary.id) === i);
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
        {!club.live && <>
          <p className="feed-empty">{club.feed.isPending ? "Checking for new Maomao posts…" : club.feed.isError ? "The Maomao drop couldn’t load. Your saved pictures are still here." : "No new Maomao posts have been published yet. These are pictures from the saved album."}</p>
          <LoreCarousel kind="maomao" />
        </>}
        {visuals.length > 0 && <div className="feed-drop__group">
          <h4 className="feed-drop__group-title">Fan art & little scenes <span aria-hidden="true">❀</span></h4>
          <div className="feed-lookbook">{visuals.slice(0, full ? 30 : 6).map((entry, i) => <FeedPhoto key={entry.key} entry={entry} index={i} onSeen={club.markSeen} />)}</div>
        </div>}
        {allNotes.length > 0 && <div className="feed-drop__group">
          <h4 className="feed-drop__group-title">News from the apothecary <span aria-hidden="true">✧</span></h4>
          <div className="feed-notes">{allNotes.slice(0, full ? 30 : 4).map((entry) => <FeedCard key={entry.key} entry={entry} label={NOTE_LABELS[entry.type] ?? "A LITTLE LORE"} onSeen={club.markSeen} />)}</div>
        </div>}
        {memes.length > 0 && <FeedSection title="Maomao memes" subtitle="The side-eye deserves its own corner." symbol="(¬‿¬)" tone="rose" level={4}>
          <div className="feed-lookbook">
            {memes.slice(0, full ? 30 : 2).map((entry, index) => <FeedPhoto key={entry.key} entry={entry} index={index} onSeen={club.markSeen} />)}
          </div>
        </FeedSection>}
        {full && <MerchLine entry={club.entries.find((entry) => entry.type === "merch")} onSeen={club.markSeen} />}
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
  const library = useQuery({
    queryKey: ["me", "songs"],
    queryFn: () => api("/me/songs"),
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
  const songs = (library.data?.songs ?? []).filter((song, i, list) => list.findIndex((other) => other.url === song.url) === i).slice(0, full ? 12 : 3);
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
      <FeedSection title="Press play, stay awhile" subtitle="A real song from your daily finds or saved collection. Try another whenever you like." symbol="♫">
        <ListeningPick />
      </FeedSection>
      <div className="music-shelf">
        {songs.length > 0 && (
          <div className="record-sleeves">
            {songs.map((song) => (
              <button
                className="record-sleeve"
                key={song.url}
                onClick={() => music.play(song)}
              >
                <span className="record-sleeve__image">
                  <SongArtwork song={song} />
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
              {feedSongs.slice(0, full ? 25 : 6).map((entry) => (
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
              {feedNotes.slice(0, full ? 25 : 6).map((entry) => (
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
          {feedVisuals.length > 0 && (
            <div className="feed-drop__group">
            <h4 className="feed-drop__group-title">Fan art & memes <span aria-hidden="true">♡</span></h4>
            <div className="feed-lookbook">
              {feedVisuals.slice(0, full ? 30 : 6).map((entry, i) => (
                <FeedPhoto
                  key={entry.key}
                  entry={entry}
                  index={i}
                  onSeen={drop.markSeen}
                />
              ))}
            </div>
            </div>
          )}
          {full && <MerchLine entry={drop.entries.find((e) => e.type === "merch")} onSeen={drop.markSeen} />}
          {full && <FeedPlaces />}
        </FeedSection>
      )}
    </section>
  );
}
