// Where they write (round 3). Left to right: a quick signal, GIFs, the paper clip (up to 10 photos
// and videos at once), the field ("talk to me baby") and the voice note button, which becomes send
// while there are words or pictures. Emoji, stickers and Genmoji come from the iPhone's own
// keyboard: in the app the field is a plain-text contenteditable (RichField.jsx), so the keyboard
// offers stickers and Genmoji; each one is lifted out of the words into the tray and goes as its own
// sticker message. Pasted pictures join the tray too (a copied sticker as a sticker).
import { useEffect, useRef, useState } from "react";
import { ALBUM_MAX, newClientId } from "../../lib/chat.js";
import { sealFile } from "../../lib/chatCrypto.js";
import { uploadFile } from "../../lib/uploads.js";
import { haptic, isAppShell, tapFeedback } from "../../lib/native.js";
import { PREVIEW_MESSAGE } from "../../lib/viewAs.js";
import { TAPS } from "../../../shared/taps.js";
import { prepare, release } from "./attachments.js";
import { clock } from "./media.jsx";
import { snippetOf } from "./Message.jsx";
import GifPicker from "./GifPicker.jsx";
import { RichField, looksLikeSticker, setText as setFieldText, stickerPng } from "./RichField.jsx";
import { ChatIcon } from "./parts.jsx";

const MAX_VOICE_SECONDS = 120;
const CAPTION_MAX = 500;
const TEXT_MAX = 4000;
const finePointer = () => window.matchMedia?.("(pointer: fine)").matches;
const lockedHint = "the chat is still unlocking on this phone ♡ your words are kept; try again in a moment.";
const STICKERS_MAX = 10;

/** The rich field (stickers and Genmoji from the keyboard) is the app's; `kiriya:plain-field` = "1" turns it off. */
function richFieldWanted() {
  if (!isAppShell()) return false;
  try {
    return localStorage.getItem("kiriya:plain-field") !== "1";
  } catch {
    return true;
  }
}

/** 32 bars from a recording, for the little waveform. */
async function peaksOf(blob) {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const data = audio.getChannelData(0);
    const size = Math.floor(data.length / 32) || 1;
    const bars = Array.from({ length: 32 }, (_, i) => {
      let max = 0;
      for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j += 16) max = Math.max(max, Math.abs(data[j]));
      return max;
    });
    context.close?.();
    const top = Math.max(...bars) || 1;
    return bars.map((bar) => Math.round((bar / top) * 100) / 100);
  } catch {
    return undefined;
  }
}

/** The quick signals: one tap sends a little moment ("thinking of you", a hug, a kiss…). */
function Signals({ onPick, onClose }) {
  return (
    <div className="sheet sheet--signals" role="dialog" aria-label="Send a signal">
      <div className="sheet__bar">
        <p className="sheet__title">send a little signal ♡</p>
        <button type="button" className="sheet__close" aria-label="Close signals" onClick={onClose}>
          <ChatIcon name="close" size={18} />
        </button>
      </div>
      <div className="signals" role="group">
        {TAPS.map((tap, i) => (
          <button key={tap.key} type="button" className="signals__tile" data-signal={tap.key} style={{ "--i": i }} onClick={() => onPick(tap)}>
            <span className="signals__emoji" aria-hidden="true">
              {tap.emoji}
            </span>
            <span className="signals__label">{tap.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Picked photos and videos, waiting above the field until they're sent. */
function Tray({ attachments, onRemove }) {
  return (
    <div className="tray" role="list" aria-label={`${attachments.length} of ${ALBUM_MAX} attached`}>
      {attachments.map((a) => (
        <span key={a.id} className="tray__item" role="listitem" data-type={a.type ?? "loading"} aria-label={a.type === "sticker" ? "a sticker" : undefined}>
          {a.previewUrl || a.poster?.previewUrl ? <img src={a.type === "video" ? (a.poster?.previewUrl ?? "") : a.previewUrl} alt="" draggable="false" /> : <span className="tray__loading" aria-label="getting it ready" />}
          {a.type === "video" && (
            <span className="tray__duration" aria-hidden="true">
              <ChatIcon name="play" size={10} stroke={2.4} /> {clock(a.duration)}
            </span>
          )}
          <button type="button" className="tray__remove" aria-label="Remove" onClick={() => onRemove(a.id)}>
            <ChatIcon name="close" size={12} stroke={2.6} />
          </button>
        </span>
      ))}
    </div>
  );
}

export default function Composer({ names, me, replyTo, editing, onCancelReply, onCancelEdit, onSend, onEdit, notifyTyping, preview, fieldRef }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [panel, setPanel] = useState(null); // signals | gif
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState("");
  const [recording, setRecording] = useState(null); // { recorder, started, stream }
  const [elapsed, setElapsed] = useState(0);
  const ownField = useRef(null);
  const [rich] = useState(richFieldWanted);
  const field = fieldRef ?? ownField;
  const picker = useRef(null);
  const chunks = useRef([]);
  const draft = useRef("");
  const other = me === "kiriya" ? "admin" : "kiriya";

  useEffect(() => {
    if (!hint) return undefined;
    const timer = setTimeout(() => setHint(""), 4200);
    return () => clearTimeout(timer);
  }, [hint]);
  useEffect(() => {
    if (replyTo) field.current?.focus({ preventScroll: true });
  }, [replyTo, field]);
  // Editing puts the message's words in the field (and puts her draft back afterwards).
  useEffect(() => {
    if (editing) {
      draft.current = text;
      setText(editing.body ?? "");
      if (rich) setFieldText(field.current, editing.body ?? "");
      setPanel(null);
      requestAnimationFrame(() => {
        const node = field.current;
        node?.focus({ preventScroll: true });
        if (rich) setFieldText(node, editing.body ?? "");
        else node?.setSelectionRange?.(node.value.length, node.value.length);
      });
    } else if (draft.current !== null) {
      setText(draft.current ?? "");
      if (rich) setFieldText(field.current, draft.current ?? "");
      draft.current = null;
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  // Local development only: ?focus=1 raises the keyboard, so the Simulator can test the composer.
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("focus")) setTimeout(() => field.current?.focus(), 600);
  }, [field]);
  useEffect(() => {
    const el = field.current;
    if (!el || rich) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text, field, attachments.length, rich]);
  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => {
      const seconds = (Date.now() - recording.started) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_VOICE_SECONDS) stopRecording(true);
    }, 250);
    return () => clearInterval(timer);
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => attachments.forEach(release), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (preview)
    return (
      <div className="composer composer--preview">
        <p className="composer__preview" role="note">
          {PREVIEW_MESSAGE}
        </p>
      </div>
    );

  const toggle = (name) => {
    setPanel((current) => (current === name ? null : name));
    field.current?.blur();
    tapFeedback();
  };

  /** A sticker or Genmoji from the keyboard (or a pasted sticker): a chip in the tray, sent as its own message. */
  function addSticker(picture) {
    if (attachments.filter((a) => a.type === "sticker").length >= STICKERS_MAX) return setHint("that’s a lot of stickers at once ♡ send these first.");
    haptic("light");
    setAttachments((current) => [...current, { id: `s${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "sticker", file: picture.file, width: picture.width, height: picture.height, alt: picture.alt, mime: "image/png", previewUrl: URL.createObjectURL(picture.file) }]);
  }

  /** Pasted or dropped pictures: a copied sticker (small, see-through) as a sticker, the rest as photos. */
  async function addPasted(files) {
    const photos = [];
    for (const file of files) {
      if (await looksLikeSticker(file)) {
        const png = await stickerPng(file).catch(() => null);
        if (png) {
          addSticker(png);
          continue;
        }
      }
      photos.push(file);
    }
    if (photos.length) addFiles(photos);
  }

  async function addFiles(files) {
    const list = [...files].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/") || /\.(mov|mp4|m4v|heic|jpe?g|png|webp|gif)$/i.test(file.name ?? ""));
    if (!list.length) return;
    const room = ALBUM_MAX - attachments.filter((a) => a.type !== "sticker").length;
    if (room <= 0) return setHint(`up to ${ALBUM_MAX} at a time ♡`);
    if (list.length > room) setHint(`up to ${ALBUM_MAX} at a time ♡ the first ${room} are in.`);
    const placeholders = list.slice(0, room).map((file, i) => ({ id: `loading-${Date.now()}-${i}`, loading: true, name: file.name }));
    setAttachments((current) => [...current, ...placeholders]);
    setPanel(null);
    await Promise.all(
      list.slice(0, room).map(async (file, i) => {
        const ready = await prepare(file);
        setAttachments((current) => {
          if (!current.some((a) => a.id === placeholders[i].id)) {
            release(ready);
            return current;
          }
          if (ready.error) {
            setHint(ready.error);
            return current.filter((a) => a.id !== placeholders[i].id);
          }
          return current.map((a) => (a.id === placeholders[i].id ? ready : a));
        });
      }),
    );
  }

  function remove(id) {
    setAttachments((current) => {
      release(current.find((a) => a.id === id));
      return current.filter((a) => a.id !== id);
    });
  }

  function clearAfterSend() {
    setText("");
    if (rich) setFieldText(field.current, "");
    setAttachments([]);
    notifyTyping("");
  }

  function send() {
    const body = text.trim();
    const ready = attachments.filter((a) => !a.loading);
    if (editing) {
      if (editing.kind === "text" && !body) return setHint("a message can’t be empty ♡ delete it instead?");
      if (body !== (editing.body ?? "").trim()) onEdit(editing, editing.kind === "text" ? body : body.slice(0, CAPTION_MAX));
      else onCancelEdit();
      notifyTyping("");
      return;
    }
    if (attachments.some((a) => a.loading)) return setHint("one moment, still getting them ready…");
    // Stickers go first, each as its own little message; then the photos (with the words as their
    // caption) or the words. A reply quotes only the first thing sent.
    const stickers = ready.filter((a) => a.type === "sticker");
    const photos = ready.filter((a) => a.type !== "sticker");
    let quote = replyTo;
    const next = () => {
      const value = quote;
      quote = null;
      return value;
    };
    // Each one shows at once; each is posted only after the one before it (`after`), so the order holds.
    let after = null;
    const go = (message) => {
      const sent = onSend({ ...message, ...(after ? { after } : {}) });
      after = Promise.resolve(sent);
    };
    for (const sticker of stickers) go({ clientId: newClientId(), kind: "sticker", body: "", sticker, replyTo: next() });
    if (photos.length) {
      const caption = body.length <= CAPTION_MAX ? body : "";
      go({ clientId: newClientId(), kind: "image", body: caption, attachments: photos, replyTo: next() });
      if (body && !caption) go({ clientId: newClientId(), kind: "text", body: body.slice(0, TEXT_MAX), replyTo: null });
    } else if (body) go({ clientId: newClientId(), kind: "text", body: body.slice(0, TEXT_MAX), replyTo: next() });
    if (!stickers.length && !photos.length && !body) return;
    clearAfterSend();
    tapFeedback();
  }

  async function startRecording() {
    setHint("");
    setPanel(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setHint("voice notes aren’t supported on this device.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      recorder.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      recorder.start(250);
      haptic("medium");
      setElapsed(0);
      setRecording({ recorder, stream, started: Date.now() });
    } catch {
      setHint("the microphone isn’t allowed. you can turn it on in your phone’s settings.");
    }
  }

  function stopRecording(sendIt) {
    const current = recording;
    if (!current) return;
    setRecording(null);
    const seconds = (Date.now() - current.started) / 1000;
    current.recorder.onstop = async () => {
      current.stream.getTracks().forEach((track) => track.stop());
      if (!sendIt) return;
      if (seconds < 0.8) return setHint("hold on a little longer to record ♡");
      const mime = (current.recorder.mimeType || "audio/mp4").split(";")[0];
      const blob = new Blob(chunks.current, { type: mime });
      setBusy("sending your voice note…");
      try {
        const file = new File([blob], `voice.${mime.includes("webm") ? "webm" : "m4a"}`, { type: mime });
        const sealedFile = await sealFile(file);
        const [stored, peaks] = await Promise.all([uploadFile(sealedFile.blob, { folder: "chat" }), peaksOf(blob)]);
        onSend({
          clientId: newClientId(),
          kind: "voice",
          body: "",
          media: { url: stored.url, duration: Math.min(MAX_VOICE_SECONDS, Math.max(0.8, seconds)), mime, ...(peaks ? { peaks } : {}), ...(sealedFile.sealed ? { sealed: sealedFile.sealed } : {}) },
          replyTo,
        });
      } catch (error) {
        setHint(error?.code === "chat_locked" ? lockedHint : (error?.message ?? "that voice note couldn’t be sent."));
      } finally {
        setBusy("");
      }
    };
    current.recorder.stop();
  }

  const ready = attachments.length > 0;
  const photosReady = attachments.some((a) => a.type !== "sticker");
  const hasText = text.trim().length > 0;
  const canSend = hasText || ready || Boolean(editing);
  const keepFocus = (event) => event.preventDefault();
  const replyName = replyTo ? (replyTo.sender === me ? "your message" : names?.[other]) : "";

  return (
    <div
      className="composer"
      data-panel={panel || undefined}
      onDragOver={(event) => event.dataTransfer?.types?.includes("Files") && event.preventDefault()}
      onDrop={(event) => {
        if (!event.dataTransfer?.files?.length) return;
        event.preventDefault();
        addPasted([...event.dataTransfer.files]);
      }}
    >
      {panel === "signals" && (
        <Signals
          onClose={() => setPanel(null)}
          onPick={(tap) => {
            onSend({ clientId: newClientId(), kind: "tap", body: tap.key });
            haptic("success");
            setPanel(null);
          }}
        />
      )}
      {panel === "gif" && (
        <GifPicker
          onClose={() => setPanel(null)}
          onPick={(gif) => {
            onSend({
              clientId: newClientId(),
              kind: "gif",
              body: "",
              media: {
                url: gif.url,
                ...(gif.mp4 ? { mp4: gif.mp4 } : {}),
                ...(gif.still ? { still: gif.still } : {}),
                giphyId: gif.id,
                ...(gif.width ? { width: gif.width, height: gif.height } : {}),
                ...(gif.title ? { alt: gif.title.slice(0, 200) } : {}),
              },
              replyTo,
            });
            tapFeedback();
            setPanel(null);
          }}
        />
      )}
      {(replyTo || editing) && (
        <div className="composer__context" data-kind={editing ? "edit" : "reply"}>
          <ChatIcon name={editing ? "edit" : "reply"} size={16} />
          <span>
            {editing ? (
              <>
                <strong>editing</strong> {editing.kind === "image" ? "the caption" : "your message"}
              </>
            ) : (
              <>
                replying to <strong>{replyName}</strong> <em>{snippetOf(replyTo)}</em>
              </>
            )}
          </span>
          <button type="button" aria-label={editing ? "Stop editing" : "Cancel reply"} onClick={editing ? onCancelEdit : onCancelReply}>
            <ChatIcon name="close" size={14} stroke={2.4} />
          </button>
        </div>
      )}
      {ready && !editing && <Tray attachments={attachments} onRemove={remove} />}
      <div className="composer__row">
        {recording ? (
          <>
            <button type="button" className="composer__tool" aria-label="Cancel recording" onClick={() => stopRecording(false)}>
              <ChatIcon name="close" />
            </button>
            <div className="composer__recording" role="status" aria-live="polite">
              <i aria-hidden="true" /> recording {clock(elapsed)}
            </div>
          </>
        ) : (
          <>
            {!editing && (
              <>
                <button type="button" className="composer__tool" aria-label="Send a signal" aria-pressed={panel === "signals"} onClick={() => toggle("signals")}>
                  <ChatIcon name="heart" />
                </button>
                <button type="button" className="composer__tool composer__tool--gif" aria-label="GIFs" aria-pressed={panel === "gif"} onClick={() => toggle("gif")}>
                  <span aria-hidden="true">GIF</span>
                </button>
                <button
                  type="button"
                  className="composer__tool"
                  aria-label="Add photos or videos"
                  onClick={() => {
                    setPanel(null);
                    picker.current?.click();
                  }}
                  disabled={attachments.length >= ALBUM_MAX}
                >
                  <ChatIcon name="clip" />
                </button>
              </>
            )}
            <div className="composer__field">
              {rich ? (
                <RichField
                  ref={field}
                  label="Message"
                  placeholder={editing?.kind === "image" ? "add a caption" : photosReady ? "add a caption…" : "talk to me baby"}
                  empty={!text}
                  onFocus={() => setPanel(null)}
                  onBlur={() => notifyTyping("")}
                  onText={(value) => {
                    setText(value);
                    if (!editing) notifyTyping(value);
                  }}
                  onGlyph={(picture) => (editing ? setHint("stickers go in their own message ♡ finish the edit first.") : addSticker(picture))}
                  onFiles={(files) => !editing && addPasted(files)}
                  onSubmit={send}
                  onEscape={() => editing && onCancelEdit()}
                />
              ) : (
              <textarea
                ref={field}
                rows={1}
                value={text}
                maxLength={editing?.kind === "image" || ready ? undefined : TEXT_MAX}
                placeholder={editing?.kind === "image" ? "add a caption" : photosReady ? "add a caption…" : "talk to me baby"}
                aria-label="Message"
                enterKeyHint="send"
                onFocus={() => setPanel(null)}
                onBlur={() => notifyTyping("")}
                onChange={(event) => {
                  setText(event.target.value);
                  if (!editing) notifyTyping(event.target.value);
                }}
                onPaste={(event) => {
                  const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
                  if (!files.length || editing) return;
                  event.preventDefault();
                  addPasted(files);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && finePointer()) {
                    event.preventDefault();
                    send();
                  }
                  if (event.key === "Escape" && editing) onCancelEdit();
                }}
              />
              )}
            </div>
          </>
        )}
        {canSend || recording ? (
          <button
            type="button"
            className="composer__send"
            data-recording={recording ? true : undefined}
            aria-label={recording ? "Send voice note" : editing ? "Save the edit" : "Send"}
            // Keeps the keyboard up after sending, like any messaging app.
            onPointerDown={keepFocus}
            onMouseDown={keepFocus}
            onClick={() => (recording ? stopRecording(true) : send())}
          >
            <ChatIcon name={editing ? "check" : "up"} stroke={2.2} />
          </button>
        ) : (
          <button type="button" className="composer__send composer__send--voice" aria-label="Record a voice note" onClick={startRecording} disabled={Boolean(busy)}>
            <ChatIcon name="mic" />
          </button>
        )}
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          addFiles(files);
        }}
      />
      {(busy || hint) && (
        <p className="composer__hint" role="status">
          {busy || hint}
        </p>
      )}
    </div>
  );
}

export { lockedHint };
