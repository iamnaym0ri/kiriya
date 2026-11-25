import { useState } from "react";
import { Modal } from "../../shared/WorldPrimitives.jsx";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { useSaveChatPrefs } from "../../lib/chat.js";
import { TypingIndicator } from "./parts.jsx";
import { WALLPAPERS, wallpaperUrl } from "./wallpapers.js";

export const BUBBLES = [
  ["lilac", "soft lilac"],
  ["paper", "paper notes"],
  ["pixel", "pixel retro"],
  ["kawaii", "sparkly kawaii"],
  ["cat", "kitty"],
  ["flowers", "flowers"],
  ["fairy", "fairy dust"],
  ["gothic", "dark & gothic"],
  ["lovey", "lovey-dovey"],
];
const BACKGROUNDS = [
  ["petals", "lilac petals"],
  ["night", "night sky"],
  ["notebook", "notebook"],
  ["photo", "your photo"],
  ...Object.entries(WALLPAPERS).map(([key, wallpaper]) => [key, wallpaper.label]),
];
const TYPING = [
  ["hearts", "hearts"],
  ["maomao", "maomao grinding"],
  ["pencil", "pencil scribble"],
  ["dots", "classic dots"],
];

function Swatch({ bubble, background, prefs }) {
  const style = background === "photo" && prefs.backgroundUrl ? { "--chat-photo": `url("${prefs.backgroundUrl}")` } : WALLPAPERS[background] ? { "--chat-wallpaper": `url("${wallpaperUrl(background, prefs)}")` } : undefined;
  return (
    <span className="chat chat--swatch" data-bubble={bubble} data-background={background} style={style} aria-hidden="true">
      <span className="chat__backdrop" />
      <span className="msg" data-first data-last>
        <span className="bubble">hi ♡</span>
      </span>
      <span className="msg" data-mine data-first data-last>
        <span className="bubble">hiii</span>
      </span>
    </span>
  );
}

/** Her (or his) own look for the chat. Each person's choice only changes their own screen. */
export default function ChatLook({ prefs, name, onClose }) {
  const save = useSaveChatPrefs();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function choosePhoto(file) {
    setUploading(true);
    setError("");
    try {
      const stored = await uploadFile(await shrinkImage(file, 2000), { folder: "backgrounds" });
      await save.mutateAsync({ background: "photo", backgroundUrl: stored.url });
    } catch (failure) {
      setError(failure?.message ?? "That photo couldn’t be used.");
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal title="make it yours ♡" onClose={onClose} className="chat-look">
      <h3>bubbles</h3>
      <div className="chat-look__grid">
        {BUBBLES.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={prefs.bubble === key} onClick={() => save.mutate({ bubble: key })}>
            <Swatch bubble={key} background={prefs.background} prefs={prefs} />
            {label}
          </button>
        ))}
      </div>
      <h3>background</h3>
      <div className="chat-look__grid">
        {BACKGROUNDS.map(([key, label]) =>
          key === "photo" ? (
            <label key={key} className="chat-look__upload" aria-busy={uploading}>
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && choosePhoto(e.target.files[0])} />
              <button type="button" aria-pressed={prefs.background === "photo"} onClick={(e) => (prefs.backgroundUrl && prefs.background !== "photo" ? save.mutate({ background: "photo" }) : e.currentTarget.previousSibling.click())}>
                <Swatch bubble={prefs.bubble} background="photo" prefs={prefs} />
                {uploading ? "uploading…" : prefs.backgroundUrl ? "your photo · change" : "add a photo"}
              </button>
            </label>
          ) : (
            <button key={key} type="button" aria-pressed={prefs.background === key} onClick={() => save.mutate({ background: key })}>
              <Swatch bubble={prefs.bubble} background={key} prefs={prefs} />
              {label}
            </button>
          ),
        )}
      </div>
      {error && <p className="composer__hint">{error}</p>}
      <p className="chat-look__credit">
        Miku art: {WALLPAPERS.miku.credit} Maomao wallpaper: official art, {WALLPAPERS.maomao.credit}
      </p>
      <h3>while {name} is typing</h3>
      <div className="chat-look__grid">
        {TYPING.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={prefs.typing === key} onClick={() => save.mutate({ typing: key })}>
            <TypingIndicator style={key} name={name} />
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
