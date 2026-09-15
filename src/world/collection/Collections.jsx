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
      source: "https://i.pinimg.com/736x/99/53/d4/9953d40bb8039d93160972f9e45b7c7d.jpg",
    },
    {
      url: "/images/miku-birthday.webp",
      title: "Hatsune Miku",
      caption: "A birthday wish from Miku · supplied illustration",
      alt: "Hatsune Miku smiling and holding a birthday cake beneath colourful confetti",
      fullImage: true,
      source: "https://i.pinimg.com/736x/fa/53/de/fa53de0920761a74877d8e54fe7db0e1.jpg",
    },
  ];
  const display = photos.length ? photos : references;
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
      {!photos.length && (
        <p className="collection-label">
          <span />
          CHARACTER & MAKER REFERENCES{" "}
          <span className="collection-label__detail">
            Your own photographs will live here.
          </span>
        </p>
      )}
      <div className="lookbook-grid">
        {display.slice(0, full ? 12 : 3).map((item, i) => (
          <button
            className={`lookbook-photo lookbook-photo--${i % 3}`}
            key={item.url}
            onClick={() => setView(i)}
          >
            <img
              className={item.fullImage ? "lookbook-photo__full-image" : undefined}
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
      <div className="lookbook-foot">
        <p className="handwritten">the wig is practically its own character.</p>
        <button className="text-link" onClick={() => setAdd(true)}>
          Add a cosplay photo <Icon name="arrow" size={15} />
        </button>
      </div>
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
export function ArtSpread({ full = false }) {
  const [view, setView] = useState(null);
  const [add, setAdd] = useState(false);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["me", "artworks"],
    queryFn: () => api("/me/artworks"),
  });
  const works = (query.data?.artworks ?? []).map((a) => ({
    ...a,
    title: "Saved sketch",
    caption: a.prompt,
    alt: a.prompt
      ? `Saved drawing for the prompt: ${a.prompt}`
      : "A saved drawing",
  }));
  const upload = useMutation({
    mutationFn: async () => {
      const stored = await uploadFile(await shrinkImage(file), {
        folder: "art",
      });
      return api("/me/artworks", {
        method: "POST",
        body: { ...stored, prompt: caption || null },
      });
    },
    onSuccess: () => {
      setAdd(false);
      setFile(null);
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["me", "artworks"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/me/artworks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setView(null);
      queryClient.invalidateQueries({ queryKey: ["me", "artworks"] });
    },
  });
  return (
    <section className="editorial-section art-spread" id="art">
      <SectionHeading
        index="🎨 PAGES FROM YOUR SKETCHBOOK"
        title="From your"
        emphasis="imagination."
        subtitle="Finished pieces, unfinished thoughts, and characters only you could dream up."
        to={full ? undefined : "/world/art"}
        action="All your work"
        page={full}
      />
      <div className="sketchbook-spread">
        <div className="sketchbook-gallery">
          {works.length ? (
            works.slice(0, full ? 30 : 1).map((work, i) => (
              <button
                key={work.id}
                className="sketchbook-work"
                onClick={() => setView(i)}
              >
                <img src={work.url} alt={work.alt} loading="lazy" />
                <span>
                  <span className="handwritten">from the saved sketchbook</span>
                  <Icon name="diagonal" size={18} />
                </span>
              </button>
            ))
          ) : (
            <div className="sketchbook-blank">
              <span className="micro-label">YOUR FIRST PAGE</span>
              <Icon name="pen" size={46} />
              <p className="handwritten">
                Something only you
                <br />
                could make.
              </p>
              <Link className="text-link" to="/world/studio">
                Make a little mark <Icon name="arrow" size={15} />
              </Link>
            </div>
          )}
        </div>
        <div className="sketchbook-margin">
          <span className="sketchbook-tab">ideas live here</span>
          <div
            className="study-palette"
            aria-label="Lilac, plum, petal pink, paper and Miku teal colour inspiration"
          >
            {["#d7c5e6", "#493653", "#e6c5d8", "#fff9fd", "#39a79f"].map(
              (c) => (
                <span key={c} style={{ background: c }} />
              ),
            )}
          </div>
          <Discovery
            kind="art"
            label="A PROMPT, IF YOU FEEL LIKE IT"
            another={full}
          />
          <Link className="button-plum" to="/world/studio">
            <Icon name="pen" size={17} />
            Open the drawing canvas
            <Icon name="arrow" size={18} />
          </Link>
          <button className="quiet-button" onClick={() => setAdd(true)}>
            Or upload a piece you’ve made <Icon name="diagonal" size={14} />
          </button>
          <p className="sketchbook-note">A rough sketch counts, too.</p>
        </div>
      </div>
      {query.isError && (
        <button className="text-link" onClick={() => query.refetch()}>
          Your saved work couldn’t load · retry
        </button>
      )}
      {view !== null && (
        <GalleryViewer
          items={works}
          index={view}
          onChange={setView}
          onClose={() => setView(null)}
          onDelete={
            full
              ? (item) => {
                  if (window.confirm("Delete this saved sketch?"))
                    remove.mutate(item.id);
                }
              : undefined
          }
        />
      )}
      {add && (
        <Modal
          title="A new piece for your sketchbook"
          onClose={() => setAdd(false)}
        >
          <form
            className="collection-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (file) upload.mutate();
            }}
          >
            <label>
              Artwork
              <input
                required
                className="field"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </label>
            <label>
              Title or a little note
              <input
                className="field"
                value={caption}
                maxLength={300}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
            <button className="button-plum" disabled={upload.isPending}>
              {upload.isPending ? "Framing…" : "Save to your sketchbook"}
            </button>
            {upload.error && <p role="alert">{upload.error.message}</p>}
          </form>
        </Modal>
      )}
    </section>
  );
}
export function MaomaoSpread({ full = false }) {
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
      <LoreCarousel kind="maomao" />
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
  const songs = [...(library.data?.songs ?? []), ...(picks.data?.songs ?? [])]
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
        <Discovery
          kind="vocaloid"
          label="A NOTE BETWEEN SONGS"
          another={full}
        />
      </div>
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
