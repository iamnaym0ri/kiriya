import { useEffect, useState } from "react";
import { Link } from "react-router";
import { SectionHeading } from "../collection/Collections.jsx";
import { FeedCard, FeedProgress, FeedSection, useSectionFeed } from "../feeds/FeedPieces.jsx";

const options = (entries, key) =>
  [...new Set(entries.flatMap((e) => e.primary.tags?.[key] ?? []))].sort();

export default function MerchPage() {
  const shelf = useSectionFeed("merch");
  const [fandom, setFandom] = useState("");
  const [type, setType] = useState("");
  useEffect(() => {
    document.title = "the merch shelf ♡";
  }, []);
  const fandoms = options(shelf.entries, "fandoms");
  const types = options(shelf.entries, "formats");
  // The server already orders the shelf: preorder deadline first, then fandom, then budget fit.
  const visible = shelf.entries.filter(
    (e) =>
      (!fandom || e.primary.tags?.fandoms?.includes(fandom)) &&
      (!type || e.primary.tags?.formats?.includes(type)),
  );
  return (
    <section className="editorial-section feed-page" id="merch">
      <SectionHeading
        index="🛍 THE MERCH SHELF"
        title="Things for"
        emphasis="the shelf."
        subtitle="Preorders closing soon come first. Prices are approximate, in SGD, with the shop’s own price beside them."
        page
      />
      {shelf.live ? (
        <FeedSection title="New merch drops" subtitle="Little finds, favourites & things to keep an eye on." symbol="♡" tone="rose" level={2}>
          <FeedProgress data={shelf.data} label="ON THE SHELF TODAY" />
          {(fandoms.length > 1 || types.length > 1) && (
            <div className="feed-filters">
              {fandoms.length > 1 && (
                <label>
                  <span className="micro-label">FANDOM</span>
                  <select className="field" value={fandom} onChange={(e) => setFandom(e.target.value)}>
                    <option value="">all of them</option>
                    {fandoms.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {types.length > 1 && (
                <label>
                  <span className="micro-label">TYPE</span>
                  <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="">every kind</option>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <div className="feed-notes feed-shelf">
            {visible.map((entry) => (
              <FeedCard
                key={entry.key}
                entry={entry}
                label={entry.primary.facts?.preorderUntil ? "PREORDER OPEN" : "FOR THE SHELF"}
                onSeen={shelf.markSeen}
              />
            ))}
          </div>
          {!visible.length && (
            <p className="status-copy">nothing matches both of those right now. try “all of them”.</p>
          )}
        </FeedSection>
      ) : (
        <aside className="note-slip">
          <span className="micro-label">THE SHELF IS STILL EMPTY</span>
          <p>
            {shelf.feed.isPending
              ? "dusting off the shelf…"
              : "new figures, plushies and preorders show up here once the daily drop is running."}
          </p>
          <div className="note-slip__source">
            <Link to="/world/saves">ur saves ♡</Link>
          </div>
        </aside>
      )}
    </section>
  );
}
