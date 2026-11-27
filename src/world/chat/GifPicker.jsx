// The GIF picker (round 3): its own button and sheet. Trending GIFs straight away, a search that
// answers as she types, three columns of lightweight 200w previews that keep their shape, more as
// she scrolls. A picked GIF is sent as GIPHY's crisp MP4 (server/routes/chat.js gifShape).
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { ChatIcon } from "./parts.jsx";

const IDEAS = ["hug", "love", "cute", "miss you", "sleepy", "happy", "kiss", "cat"];

/** Three columns, each GIF going to the shortest one, so the grid stays even. */
function columns(gifs, count = 3) {
  const cols = Array.from({ length: count }, () => ({ height: 0, items: [] }));
  for (const gif of gifs) {
    const ratio = gif.preview?.width && gif.preview?.height ? gif.preview.height / gif.preview.width : 0.75;
    const col = cols.reduce((low, c) => (c.height < low.height ? c : low), cols[0]);
    col.items.push({ gif, ratio });
    col.height += ratio;
  }
  return cols;
}

export default function GifPicker({ onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const scroller = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const gifs = useInfiniteQuery({
    queryKey: ["me", "chat", "gifs", term],
    queryFn: ({ pageParam = 0 }) => api(`/me/chat/gifs?q=${encodeURIComponent(term)}${pageParam ? `&offset=${pageParam}` : ""}`),
    initialPageParam: 0,
    getNextPageParam: (page) => page.next ?? undefined,
    staleTime: 10 * 60_000,
    retry: false,
  });
  useEffect(() => scroller.current?.scrollTo?.({ top: 0 }), [term]);
  const list = gifs.data?.pages.flatMap((page) => page.gifs) ?? [];
  const seen = new Set();
  const unique = list.filter((gif) => !seen.has(gif.id) && seen.add(gif.id));
  const onScroll = (event) => {
    const node = event.currentTarget;
    if (gifs.hasNextPage && !gifs.isFetchingNextPage && node.scrollHeight - node.scrollTop - node.clientHeight < 400) gifs.fetchNextPage();
  };
  return (
    <div className="sheet sheet--gif" role="dialog" aria-label="GIFs">
      <div className="sheet__bar">
        <label className="gif-search">
          <ChatIcon name="search" size={18} />
          <input type="search" placeholder="search GIFs" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search GIFs" enterKeyHint="search" autoComplete="off" />
          {query && (
            <button type="button" className="gif-search__clear" aria-label="Clear the search" onClick={() => setQuery("")}>
              <ChatIcon name="close" size={14} stroke={2.2} />
            </button>
          )}
        </label>
        <button type="button" className="sheet__close" aria-label="Close GIFs" onClick={onClose}>
          <ChatIcon name="close" size={18} />
        </button>
      </div>
      {!query && (
        <div className="gif-ideas" role="group" aria-label="Ideas">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setQuery(idea)}>
              {idea}
            </button>
          ))}
        </div>
      )}
      <div ref={scroller} className="gif-grid" onScroll={onScroll} aria-busy={gifs.isFetching || undefined}>
        {gifs.isError ? (
          <p className="sheet__note">{gifs.error?.status === 503 ? "GIFs aren’t switched on yet ♡" : "GIFs couldn’t load just now. try again in a moment?"}</p>
        ) : gifs.isPending ? (
          <div className="gif-grid__cols" aria-hidden="true">
            {[0, 1, 2].map((c) => (
              <div key={c} className="gif-grid__col">
                {[0.8, 1.1, 0.7, 0.95].map((r, i) => (
                  <span key={i} className="gif-grid__ghost" style={{ "--r": c % 2 ? 1.6 - r : r }} />
                ))}
              </div>
            ))}
          </div>
        ) : unique.length === 0 ? (
          <p className="sheet__note">nothing for “{term}” — try another word?</p>
        ) : (
          <div className="gif-grid__cols">
            {columns(unique).map((col, c) => (
              <div key={c} className="gif-grid__col">
                {col.items.map(({ gif, ratio }) => (
                  <button key={gif.id} type="button" className="gif-grid__item" style={{ "--r": ratio }} onClick={() => onPick(gif)} aria-label={gif.title || "a GIF"}>
                    <img src={gif.preview?.url ?? gif.url} alt="" loading="lazy" decoding="async" draggable="false" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <p className="sheet__credit">Powered by GIPHY</p>
      </div>
    </div>
  );
}
