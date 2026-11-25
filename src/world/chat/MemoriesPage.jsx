import { useEffect } from "react";
import { Link } from "react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.js";
import { tapByKey } from "../../../shared/taps.js";
import { VoiceNote } from "./parts.jsx";
import "./Chat.css";

const key = ["me", "memories"];
const when = (iso) => new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" });

function Body({ memory }) {
  const s = memory.snapshot;
  if (memory.kind === "message") {
    if (s.kind === "image" || s.kind === "gif" || s.kind === "sticker")
      return (
        <>
          <img src={s.media.url} alt="" loading="lazy" />
          {s.body && <p>{s.body}</p>}
        </>
      );
    if (s.kind === "voice") return <VoiceNote media={s.media} />;
    if (s.kind === "tap") return <p>{tapByKey[s.body]?.emoji} {tapByKey[s.body]?.label}</p>;
    return <p>{s.body}</p>;
  }
  if (memory.kind === "jar") return <p>{s.text}</p>;
  return (
    <>
      <p>
        <strong>{s.title}</strong>
      </p>
      <p>{s.body.length > 400 ? `${s.body.slice(0, 400)}…` : s.body}</p>
    </>
  );
}

const SOURCE = { message: "from your chat", note: "a little note", letter: "a letter", jar: "from the jar" };

/** "Our memories": everything either of them saved, newest first. */
export default function MemoriesPage() {
  const queryClient = useQueryClient();
  const role = useSession().data?.role;
  const memories = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api(`/me/memories${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null,
    getNextPageParam: (page) => page.next ?? undefined,
  });
  const remove = useMutation({ mutationFn: (id) => api(`/me/memories/${id}`, { method: "DELETE" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: key }) });
  useEffect(() => {
    document.title = "our memories ♡";
  }, []);
  const items = memories.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="memories">
      <header className="section-heading">
        <div>
          <p className="micro-label">JUST THE TWO OF US</p>
          <h1>
            our <em>memories.</em>
          </h1>
          <p>Long-press anything in your chat, or the ♡ on a note, to keep it here forever.</p>
        </div>
        <Link className="text-link" to="/world/chat">
          back to messages
        </Link>
      </header>
      {memories.isPending ? (
        <p role="status">opening the scrapbook…</p>
      ) : memories.isError ? (
        <p role="alert">Your memories couldn’t load.</p>
      ) : items.length === 0 ? (
        <p className="chat__empty">nothing saved yet. the first little moment goes here ♡</p>
      ) : (
        <div className="memories__grid">
          {items.map((memory, i) => (
            <article key={memory.id} className="memory" style={{ "--tilt": `${[-1, 0.8, -0.4, 1.1][i % 4]}deg` }}>
              <Body memory={memory} />
              {memory.caption && <p>“{memory.caption}”</p>}
              <footer>
                <span>
                  {SOURCE[memory.kind]} · {when(memory.snapshot.at ?? memory.createdAt)}
                  {memory.savedBy === role ? "" : " · saved by them"}
                </span>
                <button type="button" onClick={() => window.confirm("Take this out of your memories?") && remove.mutate(memory.id)}>
                  remove
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {memories.hasNextPage && (
        <button className="text-link" onClick={() => memories.fetchNextPage()} disabled={memories.isFetchingNextPage}>
          older memories ↓
        </button>
      )}
    </div>
  );
}
