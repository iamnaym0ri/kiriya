import { useSyncExternalStore } from "react";

// One audio player for the whole app (the home song card drives it). It lives outside React so a
// song keeps playing while she moves between tabs, and it tells the phone what's playing (Media
// Session: the Lock Screen and Control Center show the cover, title and buttons). Playing on with
// the screen locked needs the app's audio background mode (ios/App/App/Info.plist).

let audio = null;
let state = { song: null, playing: false, loading: false, time: 0, duration: 0, error: null, repeat: false };
let queue = { previous: null, next: null };
const listeners = new Set();
let lastPosition = 0;

function set(change) {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

const session = () => (typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null);

function absolute(src) {
  try {
    return new URL(src, location.href).href;
  } catch {
    return src;
  }
}

function describe(song) {
  const media = session();
  if (!media || typeof MediaMetadata === "undefined") return;
  try {
    media.metadata = new MediaMetadata({
      title: song.title ?? "a song for you",
      artist: song.artist ?? "",
      album: song.album ?? "",
      artwork: song.thumbnail
        ? [
            { src: absolute(song.thumbnail), sizes: "512x512" },
            { src: absolute(song.thumbnail), sizes: "256x256" },
          ]
        : [{ src: absolute("/icons/icon-512.png"), sizes: "512x512", type: "image/png" }],
    });
  } catch {
    // Older WebKit: no Lock Screen details, the song still plays.
  }
}

function setHandlers() {
  const media = session();
  if (!media) return;
  const handle = (action, fn) => {
    try {
      media.setActionHandler(action, fn);
    } catch {
      // Not every action exists on every phone.
    }
  };
  handle("play", () => audio?.play().catch(() => {}));
  handle("pause", () => audio?.pause());
  handle("stop", () => engine.stop());
  handle("seekto", (details) => details.seekTime != null && engine.seek(details.seekTime));
  handle("seekbackward", (details) => engine.seek((audio?.currentTime ?? 0) - (details.seekOffset ?? 10)));
  handle("seekforward", (details) => engine.seek((audio?.currentTime ?? 0) + (details.seekOffset ?? 10)));
  handle("previoustrack", queue.previous ? () => queue.previous() : null);
  handle("nexttrack", queue.next ? () => queue.next() : null);
}

function position() {
  const media = session();
  if (!media?.setPositionState || !audio || !Number.isFinite(audio.duration) || !audio.duration) return;
  try {
    media.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
  } catch {
    // A position past the end (a stream still measuring itself) is ignored.
  }
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  // Inline on iPhone, never the full-screen player.
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.addEventListener("play", () => {
    set({ playing: true, error: null });
    const media = session();
    if (media) media.playbackState = "playing";
  });
  audio.addEventListener("playing", () => set({ loading: false }));
  audio.addEventListener("waiting", () => set({ loading: true }));
  audio.addEventListener("pause", () => {
    set({ playing: false, loading: false });
    const media = session();
    if (media) media.playbackState = "paused";
  });
  audio.addEventListener("loadedmetadata", () => {
    set({ duration: Number.isFinite(audio.duration) ? audio.duration : state.duration });
    position();
  });
  audio.addEventListener("durationchange", () => Number.isFinite(audio.duration) && set({ duration: audio.duration }));
  audio.addEventListener("timeupdate", () => {
    set({ time: audio.currentTime });
    const now = Date.now();
    if (now - lastPosition > 4000) {
      lastPosition = now;
      position();
    }
  });
  audio.addEventListener("seeked", position);
  audio.addEventListener("ended", () => {
    if (state.repeat) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else set({ playing: false, time: 0 });
  });
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    set({ playing: false, loading: false, error: "This song couldn’t load just now. Try again in a moment." });
  });
  if (typeof window !== "undefined") window.addEventListener("kiriya:locked", () => engine.stop());
  return audio;
}

export const engine = {
  /** The song loaded right now (playing or paused), or null. */
  current: () => state.song,
  /** Starts (or resumes) a song. Call from inside a tap so the phone allows sound. */
  play(song) {
    const player = ensureAudio();
    if (state.song?.id !== song.id || player.getAttribute("src") !== song.embedId) {
      player.src = song.embedId;
      set({ song, time: 0, duration: song.duration ?? 0, error: null, loading: true });
      describe(song);
      setHandlers();
    }
    return player.play().catch((error) => {
      if (error?.name === "AbortError") return;
      set({ playing: false, loading: false, error: "Playback didn’t start. Tap play to try again." });
    });
  },
  pause() {
    audio?.pause();
  },
  toggle(song) {
    if (state.song?.id === song.id && state.playing) engine.pause();
    else engine.play(song);
  },
  seek(seconds) {
    if (!audio) return;
    const end = Number.isFinite(audio.duration) ? audio.duration : state.duration;
    audio.currentTime = Math.max(0, Math.min(seconds, end || seconds));
    set({ time: audio.currentTime });
  },
  stop() {
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    set({ song: null, playing: false, loading: false, time: 0, duration: 0, error: null });
    const media = session();
    if (media) {
      media.metadata = null;
      media.playbackState = "none";
    }
  },
  setRepeat(repeat) {
    set({ repeat });
  },
  /** What the Lock Screen's previous/next buttons do (flip through the songs on the card). */
  setQueue(next) {
    queue = { previous: next.previous ?? null, next: next.next ?? null };
    if (state.song) setHandlers();
  },
  /** The song changed elsewhere (a fixed title): refresh the Lock Screen. */
  refresh(song) {
    if (state.song?.id !== song.id) return;
    set({ song: { ...state.song, ...song, embedId: state.song.embedId } });
    describe(state.song);
  },
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The shared player's state: { song, playing, loading, time, duration, error, repeat }. */
export const useAudioEngine = () => useSyncExternalStore(subscribe, () => state, () => state);

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
