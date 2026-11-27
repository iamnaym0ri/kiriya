import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { haptic } from "../../lib/native.js";
import { jarKey, useJarSummary } from "./useMail.js";

// Pulling notes from the jar in the app: no daily limit, and no waiting. The jar's summary (and
// every pull) carries the next note, so a tap shows it at once; the pull itself goes to the server
// in the background and keeps that very note (server/lib/noteJar.js, `prefer`). Her reactions and
// "save to our memories" wait for that pull to be kept, which is long done by the time the note has
// unfolded. On Josh's phone a pull is a preview (nothing changes for her) that says how that note
// went with her, and "another one" goes round the whole jar.

const RETRIES = [600, 1500, 3200];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16));

/**
 * `entry` (what the reveal shows): { key, origin, note, fresh, revisited, sample, status, record,
 * reaction, her, error }. status: "pending" (shown, being kept), "kept" (hers, in her jar history),
 * "preview" (Josh, or "see it as kiriya"), "failed" (couldn't be kept after retries), "empty".
 */
export function useJar({ admin }) {
  const queryClient = useQueryClient();
  const summary = useJarSummary();
  const [entry, setEntry] = useState(null);
  const ready = useRef(null); // the next note, fetched ahead
  const inflight = useRef(null);
  const shown = useRef([]); // Josh: the notes he has just looked at
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // The summary's `next` is the first one; after that each pull brings the one after it (and puts it
  // in the summary too). A fresh summary (the app back in front, new notes from Josh) wins, except
  // while a pull is on its way: that one decides what comes next.
  useEffect(() => {
    if (summary.data && !inflight.current) ready.current = summary.data.next ?? null;
  }, [summary.data]);

  const patch = useCallback((key, change) => {
    if (!alive.current) return;
    setEntry((current) => (current?.key === key ? { ...current, ...(typeof change === "function" ? change(current) : change) } : current));
  }, []);

  const keep = useCallback(
    async (key, requestId, prefer) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const record = await api("/me/note-jar/pull", {
            method: "POST",
            body: { requestId, prefer: prefer ?? null, exclude: admin ? shown.current.slice(-60) : [] },
          });
          if (record.jar) {
            ready.current = record.jar.next ?? null;
            queryClient.setQueryData(jarKey, (old) => (old ? { ...old, fresh: record.jar.fresh, total: record.jar.total, pulled: record.jar.pulled, next: record.jar.next } : old));
          }
          if (record.preview && !record.sample) shown.current = [...shown.current.filter((id) => id !== record.note.id), record.note.id].slice(-60);
          patch(key, (current) => ({
            record,
            note: record.note,
            sample: Boolean(record.sample),
            revisited: record.revisited ?? current.revisited,
            fresh: record.fresh ?? current.fresh,
            her: record.her ?? null,
            status: record.preview ? "preview" : "kept",
          }));
          // The website's jar shows her history; it's out of date now.
          queryClient.invalidateQueries({ queryKey: ["me", "note-jar", "history"] });
          return record;
        } catch (error) {
          if (error?.status === 403 && error?.code === "preview") {
            // "See it as kiriya": her next note, shown, but nothing can change for her.
            patch(key, { status: "preview", her: null });
            return null;
          }
          if (error?.status === 404) {
            patch(key, { status: "empty" });
            queryClient.invalidateQueries({ queryKey: jarKey });
            return null;
          }
          if (attempt >= RETRIES.length || (error?.status && error.status < 500 && error.status !== 409)) {
            patch(key, { status: "failed", error: "this one didn’t make it into ur jar. try another?" });
            return null;
          }
          await wait(RETRIES[attempt]);
        }
      }
    },
    [admin, patch, queryClient],
  );

  /** Takes a note out of the jar, now. `origin`: where on screen it comes out from. */
  const pull = useCallback(
    async (origin = null) => {
      haptic("light");
      const key = newId();
      // A pull still on its way brings the next note; it's only a moment.
      if (!ready.current && inflight.current) await inflight.current.catch(() => null);
      const next = ready.current;
      ready.current = null;
      setEntry({
        key,
        origin,
        note: next?.note ?? null,
        fresh: Boolean(next?.fresh),
        revisited: Boolean(next?.revisited),
        sample: Boolean(next?.sample),
        status: "pending",
        record: null,
        reaction: null,
        her: null,
        error: null,
      });
      const done = keep(key, key, next?.note?.id);
      inflight.current = done;
      done.finally(() => {
        if (inflight.current === done) inflight.current = null;
      });
      return key;
    },
    [keep],
  );

  /** Her heart or emoji on the note in front of her. Shows at once; a failed save puts it back. */
  const react = useCallback(
    async (reaction) => {
      const current = entry;
      if (!current) return;
      const previous = current.reaction ?? null;
      patch(current.key, { reaction, reactionError: null });
      haptic("light");
      try {
        const record = current.record ?? (await inflight.current);
        if (!record?.id || record.preview) throw new Error("not kept");
        await api(`/me/note-jar/${record.id}/reaction`, { method: "PUT", body: { reaction } });
      } catch {
        patch(current.key, { reaction: previous, reactionError: "that reaction didn’t save. try again?" });
      }
    },
    [entry, patch],
  );

  const close = useCallback(() => setEntry(null), []);

  return { summary, entry, pull, react, close };
}
