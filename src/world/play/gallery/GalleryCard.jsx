import { useIsAdmin } from "../../../lib/session.js";
import { artKind, artTitle } from "./kinds.js";
import { isHeart, reactionGlyph, useArtworks, useSignature } from "./useArtworks.js";
import { KindMark, LetterIcon } from "./GalleryParts.jsx";
import "./gallery.css";

// The gallery's own entry near the top of the play section: her latest things in a strip, Josh's
// new notes, and the way into the whole gallery (/world/play?gallery=1).

const STRIP = 10;

export default function GalleryCard({ onOpen, onOpenArt, onStart }) {
  const admin = useIsAdmin();
  const signature = useSignature();
  const { query, artworks, withNews } = useArtworks();
  const recent = artworks.slice(0, STRIP);
  const more = artworks.length - recent.length;
  const title = admin ? "her gallery" : "your gallery";

  return (
    <section className="app-card app-card--flush play-gallery" aria-labelledby="play-gallery-title">
      <button type="button" className="play-gallery__head" onClick={onOpen} aria-label={`${title}, ${artworks.length} ${artworks.length === 1 ? "piece" : "pieces"}. see all`}>
        <span className="play-gallery__frame" aria-hidden="true">
          <FrameArt />
        </span>
        <span className="play-gallery__words">
          <h2 className="play-gallery__title" id="play-gallery-title">
            {title}
          </h2>
          <span className="play-gallery__count">
            {query.isPending ? "opening…" : artworks.length ? `${artworks.length} little ${artworks.length === 1 ? "thing" : "things"} ${admin ? "she’s" : "you’ve"} made` : "doodles, kaleidoscopes, dolls & bouquets"}
          </span>
        </span>
        <span className="play-gallery__all" aria-hidden="true">
          see all
        </span>
      </button>

      {!admin && withNews.length > 0 && (
        <button type="button" className="play-gallery__news" onClick={() => onOpenArt(withNews[0].id)}>
          <LetterIcon size={20} />
          <span>{withNews.length === 1 ? `a little note from ${signature} on “${artTitle(withNews[0])}”` : `little notes from ${signature} on ${withNews.length} of your things`}</span>
        </button>
      )}

      {recent.length > 0 ? (
        <ul className="play-gallery__strip" aria-label={admin ? "her latest things" : "your latest things"}>
          {recent.map((art) => {
            const fresh = art.notes?.some((note) => !note.seenAt);
            return (
              <li key={art.id}>
                <button type="button" className="gallery-tile gallery-tile--strip" onClick={() => onOpenArt(art.id)} aria-label={`open ${artTitle(art)}`}>
                  <img src={art.url} alt="" loading="lazy" decoding="async" />
                  <KindMark kind={artKind(art)} />
                  {art.reaction && (
                    <span className="gallery-tile__heart" data-heart={isHeart(art.reaction) || undefined} aria-hidden="true">
                      {reactionGlyph(art.reaction)}
                    </span>
                  )}
                  {art.notes?.length > 0 && (
                    <span className="gallery-tile__note" data-new={fresh || undefined} aria-hidden="true">
                      <LetterIcon />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {more > 0 && (
            <li>
              <button type="button" className="gallery-tile gallery-tile--strip gallery-tile--more" onClick={onOpen}>
                <strong>+{more}</strong>
                <span>see all</span>
              </button>
            </li>
          )}
        </ul>
      ) : query.isSuccess ? (
        <div className="play-gallery__empty">
          <p>{admin ? "nothing kept yet. what she makes will gather here ♡" : "what you make lives here: keep a doodle, a kaleidoscope, a paper doll look or a bouquet ♡"}</p>
          {!admin && (
            <button type="button" className="play-gallery__start" onClick={onStart}>
              start a doodle
            </button>
          )}
        </div>
      ) : query.isError ? (
        <div className="play-gallery__empty">
          <button type="button" className="play-gallery__start" onClick={() => query.refetch()}>
            couldn’t open it. try again
          </button>
        </div>
      ) : (
        <div className="play-gallery__strip play-gallery__strip--loading" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="gallery-tile gallery-tile--strip gallery-tile--ghost" />
          ))}
        </div>
      )}
    </section>
  );
}

/** A little gilded frame with a heart doodle in it. */
function FrameArt() {
  return (
    <svg viewBox="0 0 56 56">
      <rect x="5" y="6" width="46" height="44" rx="6" fill="#f3e6fb" stroke="#9c7ab8" strokeWidth="2.4" />
      <rect x="11" y="12" width="34" height="32" rx="3" fill="#fffaf2" stroke="#c9b1ee" strokeWidth="1.6" />
      <path d="M28 37c-6-4-9-7.5-8-11 .8-3 5-3.6 8-.6 3-3 7.2-2.4 8 .6 1 3.5-2 7-8 11Z" fill="#f6b6cf" stroke="#c77ba1" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M17 20l1 2.2 2.4.3-1.8 1.6.5 2.3-2.1-1.1-2.1 1.1.5-2.3-1.8-1.6 2.4-.3Z" fill="#efcf88" />
      <circle cx="28" cy="4.5" r="2.6" fill="#9c7ab8" />
    </svg>
  );
}
