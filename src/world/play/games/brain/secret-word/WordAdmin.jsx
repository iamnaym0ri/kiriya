import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../lib/api.js";
import { EditField, EditSheet } from "../../../../../shared/admin/AdminEdit.jsx";
import { NOTE_MAX, isFiveLetters, normalizeWord } from "./words.js";

// Josh's word queue, in place (docs/refactor/RENOVATION.md, "Admin in place"): what's coming up,
// what the tin will give on days he hasn't picked, and how she did lately. Only Josh sees this.

const ADMIN_KEY = ["admin", "games", "secret-word"];
const label = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).toLowerCase();
const herResult = (her) => (!her ? "not played" : her.status === "won" ? `found in ${her.tries} ♡` : her.status === "lost" ? "didn’t find it" : `on try ${her.tries + 1}`);

export default function WordAdmin({ open, onClose, loadDictionary }) {
  const client = useQueryClient();
  const view = useQuery({ queryKey: ADMIN_KEY, queryFn: () => api("/admin/games/secret-word"), enabled: open });
  const [form, setForm] = useState(null); // null = the list; { id?, word, day, note } = adding or changing one
  const [known, setKnown] = useState(null);
  useEffect(() => {
    loadDictionary().then(setKnown, () => {});
  }, [loadDictionary]);

  const done = () => {
    client.invalidateQueries({ queryKey: ADMIN_KEY });
    client.invalidateQueries({ queryKey: ["games", "secret-word"] });
  };
  const save = useMutation({
    mutationFn: ({ id, ...body }) => (id ? api(`/admin/games/secret-word/${id}`, { method: "PATCH", body }) : api("/admin/games/secret-word", { method: "POST", body })),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (id) => api(`/admin/games/secret-word/${id}`, { method: "DELETE" }), onSuccess: done });

  const data = view.data;
  const word = normalizeWord(form?.word);
  const valid = form && isFiveLetters(word) && form.day;
  const startNew = (day) => setForm({ word: "", day: day ?? data?.nextFreeDay ?? "", note: "" });

  if (form) {
    const editingToday = form.day === data?.today;
    return (
      <EditSheet
        open={open}
        title={form.id ? "change this word" : "a new secret word"}
        subtitle={form.day ? label(form.day) : undefined}
        onClose={() => setForm(null)}
        saveDisabled={!valid}
        dirty={Boolean(form.word || form.note)}
        onSave={async () => {
          await save.mutateAsync({ id: form.id, word, day: form.day, note: form.note.trim() });
          setForm(null);
          return false; // back to the list, the sheet stays open
        }}
        onDelete={form.id ? async () => {
          await remove.mutateAsync(form.id);
          setForm(null);
          return false;
        } : undefined}
        deleteLabel="Remove this word"
      >
        <EditField
          label="the word"
          hint={
            word.length === 5 && !isFiveLetters(word)
              ? "letters a to z only"
              : isFiveLetters(word) && known && !known.has(word)
                ? "not in her guess dictionary. that’s fine: it still counts when she types it."
                : "five letters. she’ll have six tries."
          }
        >
          <input
            className="sw-admin-word"
            value={form.word}
            maxLength={5}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="next"
            onChange={(event) => setForm({ ...form, word: event.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase() })}
          />
        </EditField>
        <EditField label="the day" hint={editingToday ? "today: if she has already started, a new word starts her over." : "her day, in Singapore."}>
          <input type="date" value={form.day} min={data?.today} onChange={(event) => setForm({ ...form, day: event.target.value })} />
        </EditField>
        <EditField label="a little note (optional)" hint={`she sees it after she finds the word. ${form.note.length}/${NOTE_MAX}`}>
          <textarea rows={3} maxLength={NOTE_MAX} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </EditField>
      </EditSheet>
    );
  }

  return (
    <EditSheet open={open} title="secret words" subtitle={data ? `her streak: ${data.herStreak} ♡` : undefined} onClose={onClose}>
      {view.isPending ? (
        <p className="sw-admin-note">opening the word box…</p>
      ) : view.isError ? (
        <p className="sw-admin-note">the words couldn’t load. try again in a moment.</p>
      ) : (
        <div className="sw-admin">
          <button type="button" className="brain-btn sw-admin-add" onClick={() => startNew()}>
            + pick a word
          </button>
          <section>
            <h3>coming up</h3>
            {data.upcoming.length === 0 ? (
              <p className="sw-admin-note">nothing picked yet. the tin fills in the days.</p>
            ) : (
              <ul className="sw-admin-list">
                {data.upcoming.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setForm({ id: item.id, word: item.word, day: item.day, note: item.note ?? "" })}>
                      <span className="sw-admin-day">{item.day === data.today ? "today" : label(item.day)}</span>
                      <b>{item.word}</b>
                      {item.note && <small>“{item.note}”</small>}
                      <span className="sw-admin-go" aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>days the tin will fill</h3>
            <ul className="sw-admin-list sw-admin-list--tin">
              {data.tin.map((item) => (
                <li key={item.day}>
                  <button type="button" onClick={() => startNew(item.day)}>
                    <span className="sw-admin-day">{item.day === data.today ? "today" : label(item.day)}</span>
                    <b>{item.word}</b>
                    <small>tap to pick your own</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>how she did</h3>
            <ul className="sw-admin-list sw-admin-list--past">
              {data.recent.map((item) => (
                <li key={item.day}>
                  <div>
                    <span className="sw-admin-day">{item.day === data.today ? "today" : label(item.day)}</span>
                    <b>{item.word}</b>
                    <small>{item.by === "josh" ? "yours" : "tin"} · {herResult(item.her)}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </EditSheet>
  );
}
