// The data behind the app's notes & letters section (MailSection.jsx). It reads the same queries
// the website's pages use (so the tab bar's count, the icon badge and the widgets stay in step) and,
// on Josh's phone, adds her inbox as she sees it plus what's still on its way to her.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { notesKey, useNotes } from "../../lib/notes.js";
import { useIsAdmin } from "../../lib/session.js";
import { todayKey } from "../../lib/world.js";

export const lettersKey = ["me", "letters"];
export const herInboxKey = ["admin", "mail", "inbox"];
// The note jar's own query (today/NoteJar.jsx uses this key for today's jar), so both share a cache.
export const jarKey = ["me", "note-jar", "today"];

const LETTER_LINK = /^\/world\/letters\?open=([0-9a-f-]{36})$/i;
/** The letter a note announces ("a new letter for you ✉"), if it is one of those. */
export const letterIdOf = (note) => LETTER_LINK.exec(note?.link ?? "")?.[1] ?? null;

export const nameOf = (signature) => String(signature ?? "Josh").replace(/\s*<3\s*$/, "").trim() || "Josh";

export function useLetters() {
  return useQuery({
    queryKey: lettersKey,
    queryFn: () => api("/me/letters"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * The note jar at a glance (`fresh`: notes Josh added that she hasn't pulled yet). One cache entry
 * for the tab bar's badge, home's what's new and this section. Like the mailbox, it's checked again
 * whenever the app comes back to the front and every few minutes while it's open; pulling a note
 * refreshes it (today/NoteJar.jsx invalidates every ["me", "note-jar", …] entry).
 */
export function useJarSummary({ enabled = true } = {}) {
  return useQuery({
    queryKey: jarKey,
    queryFn: ({ signal }) => api("/me/note-jar", { signal }),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Everything the section shows, in one shape for both of them. Her phone: her letters and notes.
 * Josh's phone: the same letters and her notes with her marks (read-only), what's on its way, and
 * his own test notes (which he can open and react to, to try them out).
 */
export function useMail() {
  const admin = useIsAdmin();
  const letters = useLetters();
  const mine = useNotes();
  const hers = useQuery({
    queryKey: herInboxKey,
    queryFn: () => api("/admin/love-notes/inbox"),
    enabled: admin,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const inbox = admin ? hers : mine;
  const pending = letters.isPending || inbox.isPending;
  const error = letters.isError || inbox.isError;

  const allLetters = letters.data?.letters ?? [];
  const giver = allLetters.filter((letter) => letter.author === "giver");
  const letterIds = new Set(giver.map((letter) => letter.id));
  const rawNotes = inbox.data?.notes ?? [];
  // A letter's announcement is the letter itself here, so it isn't listed twice.
  const notes = rawNotes.filter((note) => !letterIds.has(letterIdOf(note)));
  const test = admin ? (mine.data?.notes ?? []).filter((note) => !letterIds.has(letterIdOf(note))) : [];

  return {
    admin,
    pending,
    error,
    refetch: () => Promise.all([letters.refetch(), inbox.refetch(), admin ? mine.refetch() : null]),
    signature: nameOf(letters.data?.signature),
    letters: giver,
    maomao: letters.data?.maomao ?? null,
    notes,
    announcements: rawNotes.filter((note) => letterIds.has(letterIdOf(note))),
    test,
    upcoming: admin ? (hers.data?.upcoming ?? []) : [],
  };
}

/** Opening a letter: hers count (the letter and its announcement); Josh's reading changes nothing. */
export function useOpenLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/letters/${id}/open`, { method: "POST", body: {} }),
    onMutate: (id) =>
      queryClient.setQueryData(lettersKey, (old) =>
        old && { ...old, letters: old.letters.map((l) => (l.id === id && !l.openedAt ? { ...l, openedAt: new Date().toISOString() } : l)) },
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: lettersKey });
      queryClient.invalidateQueries({ queryKey: notesKey });
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });
}

/** Her heart or emoji on a letter. It shows straight away; a failed save puts the old one back. */
export function useReactToLetter() {
  const queryClient = useQueryClient();
  const patch = (id, reaction) =>
    queryClient.setQueryData(lettersKey, (old) => old && { ...old, letters: old.letters.map((l) => (l.id === id ? { ...l, reaction } : l)) });
  return useMutation({
    mutationFn: ({ id, reaction }) => api(`/me/letters/${id}/reaction`, { method: "PUT", body: { reaction } }),
    onMutate: async ({ id, reaction }) => {
      await queryClient.cancelQueries({ queryKey: lettersKey });
      const previous = queryClient.getQueryData(lettersKey)?.letters.find((l) => l.id === id)?.reaction ?? null;
      patch(id, reaction);
      return { previous };
    },
    onError: (_error, { id }, context) => {
      patch(id, context?.previous ?? null);
      queryClient.invalidateQueries({ queryKey: lettersKey });
    },
  });
}

// ---------- Josh's controls ----------

/** After Josh sends or changes something: refresh both what he sees and the admin desk. */
export function useRefreshMail() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: herInboxKey }),
      queryClient.invalidateQueries({ queryKey: lettersKey }),
      queryClient.invalidateQueries({ queryKey: notesKey }),
      queryClient.invalidateQueries({ queryKey: ["admin", "love-notes"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "letters"] }),
    ]);
}

export function useSendNote() {
  const refresh = useRefreshMail();
  return useMutation({ mutationFn: (body) => api("/admin/love-notes", { method: "POST", body }), onSuccess: refresh });
}

export function useCancelNote() {
  const refresh = useRefreshMail();
  return useMutation({ mutationFn: (id) => api(`/admin/love-notes/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useAdminLetters(enabled) {
  return useQuery({ queryKey: ["admin", "letters"], queryFn: () => api("/admin/letters"), enabled, staleTime: 10_000 });
}

export function useSaveLetter() {
  const refresh = useRefreshMail();
  return useMutation({
    mutationFn: ({ id, ...body }) => (id ? api(`/admin/letters/${id}`, { method: "PUT", body }) : api("/admin/letters", { method: "POST", body })),
    onSuccess: refresh,
  });
}

export function useDeleteLetter() {
  const refresh = useRefreshMail();
  return useMutation({ mutationFn: (id) => api(`/admin/letters/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

/** Sends only the notification to Josh's own phone; nothing is saved, so she sees nothing. */
export function useTryLetter() {
  return useMutation({ mutationFn: (body) => api("/admin/letters/test-announcement", { method: "POST", body }) });
}

export const adminJarKey = ["admin", "note-jar"];

export function useAdminJar(enabled) {
  return useQuery({ queryKey: adminJarKey, queryFn: () => api("/admin/note-jar"), enabled, staleTime: 10_000 });
}

export function useJarEdit() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: adminJarKey }), queryClient.invalidateQueries({ queryKey: ["me", "note-jar"] })]);
  const add = useMutation({ mutationFn: (body) => api("/admin/note-jar", { method: "POST", body }), onSuccess: refresh });
  const change = useMutation({ mutationFn: ({ id, ...body }) => api(`/admin/note-jar/${id}`, { method: "PATCH", body }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => api(`/admin/note-jar/${id}`, { method: "DELETE" }), onSuccess: refresh });
  return { add, change, remove };
}
