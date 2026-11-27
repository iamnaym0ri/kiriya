import { useEffect, useState } from "react";
import { EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import { useHomeEdit } from "./useHome.js";
import { fromLine, PinNote } from "./Pinboard.jsx";

const COLOURS = [
  ["cream", "cream"],
  ["lilac", "lilac"],
  ["pink", "pink"],
  ["mint", "mint"],
  ["butter", "butter"],
  ["sky", "sky"],
];
const STICKERS = ["kitten", "sprig", "leek", "bow", "star", "cake", "brush", "bottle", "mirror"];
const blank = { text: "", label: "", style: "pin", colour: "cream", sticker: null };

/** Pinning a new note, or changing or taking down one that's up. */
export function PinSheet({ editing, onClose, signature }) {
  const open = Boolean(editing);
  const pin = editing?.kind === "edit" ? editing.pin : null;
  const add = useHomeEdit("/pins", "POST");
  const edit = useHomeEdit((body) => `/pins/${body.__id}`, "PATCH");
  const remove = useHomeEdit((body) => `/pins/${body.__id}`, "DELETE");
  const [draft, setDraft] = useState(blank);
  const [quiet, setQuiet] = useState(false);
  const [bump, setBump] = useState(false);
  const start = pin ? { text: pin.text, label: pin.label ?? "", style: pin.style, colour: pin.colour, sticker: pin.sticker ?? null } : blank;

  useEffect(() => {
    if (!open) return;
    setDraft(start);
    setQuiet(false);
    setBump(false);
  }, [open, pin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setDraft((old) => ({ ...old, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(start) || bump;
  const text = draft.text.trim();

  return (
    <EditSheet
      open={open}
      onClose={onClose}
      title={pin ? "this note" : "pin a note"}
      subtitle={pin ? (pin.seenByHer ? "she’s seen it ♡" : "she hasn’t seen it yet") : "it shows as new until she’s seen it"}
      saveLabel={pin ? "Save" : "Pin it"}
      dirty={dirty}
      saveDisabled={!text || !dirty}
      onSave={() =>
        pin
          ? edit.mutateAsync({ __id: pin.id, ...draft, text, label: draft.label.trim(), ...(quiet ? { quiet: true } : {}), ...(bump ? { bump: true } : {}) })
          : add.mutateAsync({ ...draft, text, label: draft.label.trim() })
      }
      onDelete={pin ? () => remove.mutateAsync({ __id: pin.id }) : undefined}
      deleteLabel="Take it down"
    >
      <div className="home-edit__pin-preview" aria-hidden="true">
        <PinNote pin={{ id: pin?.id ?? "preview", ...draft, text: draft.text || "your note…", new: !quiet }} signature={signature} preview />
      </div>
      <EditField label="the note" hint={`${draft.text.length}/400 · something to cheer her on, or just because`}>
        <textarea className="home-edit__input" rows={4} maxLength={400} value={draft.text} onChange={(event) => set({ text: event.target.value })} />
      </EditField>
      <EditField label="little label on top" hint={`empty says “${fromLine(signature)}”`}>
        <input className="home-edit__input" maxLength={40} value={draft.label} placeholder={fromLine(signature)} onChange={(event) => set({ label: event.target.value })} />
      </EditField>
      <fieldset className="home-edit__fieldset">
        <legend>held up with</legend>
        <div className="home-edit__segmented" role="group" aria-label="Held up with">
          {[
            ["pin", "a pin"],
            ["tape", "washi tape"],
          ].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={draft.style === value} onClick={() => set({ style: value })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="home-edit__fieldset">
        <legend>paper</legend>
        <div className="home-edit__swatches">
          {COLOURS.map(([value, label]) => (
            <button key={value} type="button" className="home-edit__swatch" data-colour={value} aria-pressed={draft.colour === value} aria-label={label} onClick={() => set({ colour: value })} />
          ))}
        </div>
      </fieldset>
      <fieldset className="home-edit__fieldset">
        <legend>a sticker</legend>
        <div className="home-edit__stickers">
          <button type="button" className="home-edit__sticker" aria-pressed={!draft.sticker} onClick={() => set({ sticker: null })}>
            none
          </button>
          {STICKERS.map((art) => (
            <button key={art} type="button" className="home-edit__sticker" aria-pressed={draft.sticker === art} aria-label={art} onClick={() => set({ sticker: art })}>
              <StickerArt art={art} size={34} />
            </button>
          ))}
        </div>
      </fieldset>
      {pin && (
        <div className="home-edit__checks">
          <label className="home-edit__check">
            <input type="checkbox" checked={quiet} onChange={(event) => setQuiet(event.target.checked)} />
            <span>
              just a small fix
              <small>don’t show it to her as new again</small>
            </span>
          </label>
          <label className="home-edit__check">
            <input type="checkbox" checked={bump} onChange={(event) => setBump(event.target.checked)} />
            <span>
              move it to the top
              <small>right under the birthday wish</small>
            </span>
          </label>
        </div>
      )}
    </EditSheet>
  );
}
