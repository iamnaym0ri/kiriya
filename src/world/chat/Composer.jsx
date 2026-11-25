import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { newClientId } from "../../lib/chat.js";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { tapFeedback } from "../../lib/native.js";
import { TAPS } from "../../../shared/taps.js";
import { STICKER_PACKS } from "../../../shared/stickers.js";
import { ChatIcon } from "./parts.jsx";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
const MAX_VOICE_SECONDS = 120;
const finePointer = () => window.matchMedia?.("(pointer: fine)").matches;

async function imageSize(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return {};
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

function GifPanel({ onPick }) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);
  const gifs = useQuery({ queryKey: ["me", "chat", "gifs", term], queryFn: () => api(`/me/chat/gifs?q=${encodeURIComponent(term)}`), staleTime: 10 * 60_000, retry: false });
  return (
    <>
      <input className="media-panel__search" type="search" placeholder="search GIFs…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search GIFs" />
      {gifs.isError ? (
        <p className="media-panel__note">{gifs.error?.status === 503 ? "GIF search isn’t switched on yet ♡" : "GIFs couldn’t load just now."}</p>
      ) : (
        <div className="media-panel__grid">
          {(gifs.data?.gifs ?? []).map((gif) => (
            <button key={gif.id} type="button" onClick={() => onPick(gif)} aria-label={gif.title || "a GIF"}>
              <img src={gif.still ?? gif.url} alt="" loading="lazy" decoding="async" onMouseEnter={(e) => (e.currentTarget.src = gif.url)} />
            </button>
          ))}
        </div>
      )}
      <p className="media-panel__giphy">Powered by GIPHY</p>
    </>
  );
}

function StickerPanel({ onPick }) {
  const queryClient = useQueryClient();
  const custom = useQuery({ queryKey: ["me", "chat", "stickers"], queryFn: () => api("/me/chat/stickers"), staleTime: 5 * 60_000 });
  const input = useRef(null);
  const add = useMutation({
    mutationFn: async (file) => {
      const ready = file.type === "image/gif" ? file : await shrinkImage(file, 512);
      const stored = await uploadFile(ready, { folder: "stickers" });
      return api("/me/chat/stickers", { method: "POST", body: { url: stored.url, label: file.name.replace(/\.\w+$/, "").slice(0, 60) } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "chat", "stickers"] }),
  });
  const mine = custom.data?.stickers ?? [];
  return (
    <>
      <div className="media-panel__grid media-panel__grid--stickers">
        <button type="button" onClick={() => input.current?.click()} aria-label="Add your own sticker" disabled={add.isPending}>
          <span style={{ fontSize: 26, color: "#8f63ad" }}>{add.isPending ? "…" : "＋"}</span>
        </button>
        {mine.map((sticker) => (
          <button key={sticker.id} type="button" onClick={() => onPick({ url: sticker.url, alt: sticker.label })} aria-label={sticker.label || "your sticker"}>
            <img src={sticker.url} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
        {STICKER_PACKS.flatMap((pack) => pack.stickers).map((sticker) => (
          <button key={sticker.id} type="button" onClick={() => onPick({ url: sticker.url, alt: sticker.label })} aria-label={sticker.label}>
            <img src={sticker.url} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      <input ref={input} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && add.mutate(e.target.files[0])} />
      {add.isError && <p className="media-panel__note">That sticker couldn’t be added.</p>}
      <p className="media-panel__giphy">{STICKER_PACKS[0]?.credit}</p>
    </>
  );
}

export default function Composer({ onSend, replyTo, replyLabel, onCancelReply, notifyTyping, placeholder }) {
  const [text, setText] = useState("");
  const [panel, setPanel] = useState(null); // taps | emoji | media
  const [mediaTab, setMediaTab] = useState("stickers");
  const [busy, setBusy] = useState("");
  const [recording, setRecording] = useState(null); // { recorder, started, stream }
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState("");
  const [focused, setFocused] = useState(false);
  const field = useRef(null);
  const photo = useRef(null);
  const chunks = useRef([]);

  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const seconds = (Date.now() - recording.started) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_VOICE_SECONDS) stopRecording(true);
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  function sendText() {
    const body = text.trim();
    if (!body) return;
    onSend({ clientId: newClientId(), kind: "text", body, replyTo });
    setText("");
    tapFeedback();
  }

  async function sendPhoto(file) {
    setBusy("sending your photo…");
    try {
      const ready = file.type === "image/gif" ? file : await shrinkImage(file, 1800);
      const [size, stored] = await Promise.all([imageSize(ready), uploadFile(ready, { folder: "chat" })]);
      onSend({ clientId: newClientId(), kind: "image", body: text.trim(), media: { url: stored.url, ...size }, replyTo });
      setText("");
    } catch (error) {
      setHint(error?.message ?? "That photo couldn’t be sent.");
    } finally {
      setBusy("");
    }
  }

  async function startRecording() {
    setHint("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setHint("Voice notes aren’t supported on this device.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      recorder.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      recorder.start(250);
      tapFeedback();
      setElapsed(0);
      setRecording({ recorder, stream, started: Date.now() });
    } catch {
      setHint("The microphone isn’t allowed. You can turn it on in your phone’s settings.");
    }
  }

  function stopRecording(send) {
    const current = recording;
    if (!current) return;
    setRecording(null);
    const seconds = (Date.now() - current.started) / 1000;
    current.recorder.onstop = async () => {
      current.stream.getTracks().forEach((track) => track.stop());
      if (!send) return;
      if (seconds < 0.8) return setHint("hold on a little longer to record ♡");
      const mime = (current.recorder.mimeType || "audio/mp4").split(";")[0];
      const blob = new Blob(chunks.current, { type: mime });
      setBusy("sending your voice note…");
      try {
        const file = new File([blob], `voice.${mime.includes("webm") ? "webm" : "m4a"}`, { type: mime });
        const [stored, peaks] = await Promise.all([uploadFile(file, { folder: "chat" }), peaksOf(blob)]);
        onSend({ clientId: newClientId(), kind: "voice", body: "", media: { url: stored.url, duration: Math.min(MAX_VOICE_SECONDS, Math.max(0.8, seconds)), mime, ...(peaks ? { peaks } : {}) }, replyTo });
      } catch (error) {
        setHint(error?.message ?? "That voice note couldn’t be sent.");
      } finally {
        setBusy("");
      }
    };
    current.recorder.stop();
  }

  const hasText = text.trim().length > 0;
  return (
    <div className="composer">
      {panel === "taps" && (
        <div className="composer__panel">
          <div className="composer__taps" role="group" aria-label="Send a little tap">
            {TAPS.map((tap) => (
              <button
                key={tap.key}
                type="button"
                onClick={() => {
                  onSend({ clientId: newClientId(), kind: "tap", body: tap.key });
                  tapFeedback();
                  setPanel(null);
                }}
              >
                <span aria-hidden="true">{tap.emoji}</span>
                {tap.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {panel === "emoji" && (
        <div className="composer__panel">
          <Suspense fallback={<p className="media-panel__note">opening the emoji box…</p>}>
            <EmojiPicker
              width="100%"
              height={320}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              skinTonesDisabled={false}
              style={{ "--epr-bg-color": "#fffaff", "--epr-category-label-bg-color": "#fffaff", "--epr-highlight-color": "#8f63ad", "--epr-hover-bg-color": "#f3e3fa", border: 0 }}
              onEmojiClick={(emoji) => {
                setText((current) => current + emoji.emoji);
                field.current?.focus();
              }}
            />
          </Suspense>
        </div>
      )}
      {panel === "media" && (
        <div className="composer__panel">
          <div className="media-panel__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mediaTab === "stickers"} onClick={() => setMediaTab("stickers")}>
              stickers
            </button>
            <button type="button" role="tab" aria-selected={mediaTab === "gifs"} onClick={() => setMediaTab("gifs")}>
              GIFs
            </button>
          </div>
          {mediaTab === "stickers" ? (
            <StickerPanel
              onPick={(media) => {
                onSend({ clientId: newClientId(), kind: "sticker", media, replyTo });
                setPanel(null);
              }}
            />
          ) : (
            <GifPanel
              onPick={(gif) => {
                onSend({ clientId: newClientId(), kind: "gif", media: { url: gif.url, ...(gif.still ? { still: gif.still } : {}), giphyId: gif.id, ...(gif.width ? { width: gif.width, height: gif.height } : {}), alt: gif.title?.slice(0, 200) }, replyTo });
                setPanel(null);
              }}
            />
          )}
        </div>
      )}
      {replyTo && (
        <div className="composer__reply">
          <span>↩ replying to {replyLabel}</span>
          <button type="button" className="chat__icon-button" onClick={onCancelReply} aria-label="Cancel reply">
            <ChatIcon name="close" size={16} />
          </button>
        </div>
      )}
      <div className="composer__row">
        {/* While she types, the field gets the room: taps and stickers step aside. */}
        {!(focused || hasText) && (
          <button type="button" className="chat__icon-button" aria-label="Send a little tap" aria-pressed={panel === "taps"} onClick={() => toggle("taps")}>
            <ChatIcon name="heart" />
          </button>
        )}
        {recording ? (
          <>
            <button type="button" className="chat__icon-button" aria-label="Cancel recording" onClick={() => stopRecording(false)}>
              <ChatIcon name="close" />
            </button>
            <div className="composer__field" role="status" aria-live="polite">
              ● recording {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}
            </div>
          </>
        ) : (
          <>
            <button type="button" className="chat__icon-button" aria-label="Emoji" aria-pressed={panel === "emoji"} onClick={() => toggle("emoji")}>
              <ChatIcon name="smile" />
            </button>
            {!(focused || hasText) && (
              <button type="button" className="chat__icon-button" aria-label="Stickers and GIFs" aria-pressed={panel === "media"} onClick={() => toggle("media")}>
                <ChatIcon name="sticker" />
              </button>
            )}
            <textarea
              ref={field}
              className="composer__field"
              rows={1}
              value={text}
              placeholder={placeholder}
              aria-label="Message"
              enterKeyHint="send"
              onFocus={() => {
                setFocused(true);
                setPanel((current) => (current === "emoji" ? current : null));
              }}
              onBlur={() => setFocused(false)}
              onChange={(event) => {
                setText(event.target.value);
                notifyTyping();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && finePointer()) {
                  event.preventDefault();
                  sendText();
                }
              }}
            />
            {!hasText && (
              <button type="button" className="chat__icon-button" aria-label="Send a photo" onClick={() => photo.current?.click()} disabled={Boolean(busy)}>
                <ChatIcon name="image" />
              </button>
            )}
          </>
        )}
        {hasText ? (
          <button type="button" className="composer__send" aria-label="Send" onClick={sendText}>
            <ChatIcon name="send" />
          </button>
        ) : (
          <button
            type="button"
            className="composer__send"
            data-recording={recording ? true : undefined}
            aria-label={recording ? "Send voice note" : "Record a voice note"}
            onClick={() => (recording ? stopRecording(true) : startRecording())}
            disabled={Boolean(busy)}
          >
            <ChatIcon name={recording ? "send" : "mic"} />
          </button>
        )}
      </div>
      <input ref={photo} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0]).finally(() => (e.target.value = ""))} />
      {(busy || hint) && (
        <p className="composer__hint" role="status">
          {busy || hint}
        </p>
      )}
    </div>
  );
}
