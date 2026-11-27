import { useCallback, useSyncExternalStore } from "react";
import { audioContext, setZzfxVolume, zzfx } from "./zzfx.js";

// The luck games' little sounds: soft, short and original (ZzFX parameter sets written for these
// games). Sound is optional: one switch for the whole luck shelf, remembered on this phone. The
// context is "ambient", so the silent switch mutes it and her music keeps playing.
const KEY = "kiriya:luck-sound";
const listeners = new Set();
let enabled = readEnabled();
setZzfxVolume(0.22);

function readEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode: the choice lasts until the app closes.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
//  pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay]
const SOUNDS = {
  tick: [0.35, 0.05, 1500, 0, 0.004, 0.025, 1, 1.6],
  clack: [0.5, 0.05, 220, 0, 0.01, 0.06, 4, 1, 0, 0, 0, 0, 0, 0.6],
  roll: [0.25, 0.1, 160, 0.02, 0.18, 0.12, 4, 1, 0, 0, 0, 0, 0.045, 0.4],
  pop: [0.6, 0.02, 420, 0.005, 0.02, 0.09, 0, 1.4, 14],
  chime: [0.45, 0, 988, 0.005, 0.12, 0.45, 0, 1, 0, 0, 494, 0.07, 0, 0, 0, 0, 0.08, 0.7],
  sparkle: [0.35, 0, 1568, 0.005, 0.08, 0.5, 0, 1, 0, 0, 392, 0.05, 0.1, 0, 0, 0, 0.1, 0.6],
  paper: [0.28, 0.2, 700, 0.02, 0.04, 0.12, 4, 1, -6, 0, 0, 0, 0, 0.9],
  whoosh: [0.25, 0.1, 260, 0.06, 0.08, 0.22, 4, 1, 5, 0, 0, 0, 0, 0.7],
  flip: [0.3, 0.05, 520, 0, 0.012, 0.05, 1, 1, 9],
  soft: [0.35, 0, 392, 0.02, 0.1, 0.25, 0, 1, -2.5],
  lift: [0.3, 0, 330, 0.01, 0.06, 0.14, 0, 1, 6],
};
const MELODIES = {
  yay: [[784, 0], [988, 90], [1319, 180]],
  fanfare: [[659, 0], [784, 110], [988, 220], [1319, 360]],
};

// Ambient while a luck game is open: the silent switch mutes these sounds and they mix with her
// other music instead of stopping it. The session is the whole page's, so it goes back to "auto"
// when the game closes, and it's left alone while the app's own song is playing (an ambient song
// would stop when the screen locks).
let ambientSet = false;
function ambientSession() {
  try {
    const session = navigator.audioSession;
    if (!session || session.type !== "auto" || navigator.mediaSession?.playbackState === "playing") return;
    session.type = "ambient";
    ambientSet = true;
  } catch {
    // Older iOS: no audio session to set.
  }
}
export function restoreAudioSession() {
  if (!ambientSet) return;
  ambientSet = false;
  try {
    if (navigator.audioSession?.type === "ambient") navigator.audioSession.type = "auto";
  } catch {
    // Nothing to undo.
  }
}

export function unlockAudio() {
  if (enabled) ambientSession();
  const context = enabled ? audioContext() : null;
  if (context?.state === "suspended") context.resume().catch(() => {});
}

export function play(name) {
  if (!enabled) return;
  ambientSession();
  const context = audioContext();
  if (!context) return;
  if (context.state === "suspended") context.resume().catch(() => {});
  try {
    if (MELODIES[name]) {
      for (const [frequency, delay] of MELODIES[name]) {
        setTimeout(() => zzfx(0.4, 0, frequency, 0.005, 0.08, 0.3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.6), delay);
      }
    } else if (SOUNDS[name]) zzfx(...SOUNDS[name]);
  } catch {
    // A sound is never worth an error.
  }
}

/** [soundOn, toggle, play] for a game, re-rendering when any luck game flips the switch. */
export function useSound() {
  const on = useSyncExternalStore(subscribe, () => enabled, () => enabled);
  const toggle = useCallback(() => {
    setSoundOn(!enabled);
    if (enabled) {
      unlockAudio();
      play("tick");
    }
  }, []);
  return [on, toggle, play];
}
