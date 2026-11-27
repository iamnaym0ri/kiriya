// The app's own small native piece for the chat's encryption (ios/App/App/KiriyaChatPlugin.swift):
// - the chat keys go into the Keychain with the App Group as their access group, so the
//   notification extension can open a message's preview and the widgets the last message;
// - each person's private key is kept there too (this device only, never synced), so a phone that
//   opens with Face ID never needs the passphrase again, even if the web view's storage is cleared;
// - the privacy cover: with the chat lock on, the app switcher's snapshot shows a soft cover
//   instead of the messages, and notification previews stay "a new message ♡".
// Everything here is a no-op on the website and on app builds without the plugin.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { toBase64Url } from "./core.js";

// Registered once and only ever called, never awaited itself (see the note in src/lib/native.js).
const plugin = registerPlugin("KiriyaChat");
export const nativeChatAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("KiriyaChat");

/** Adds chat keys ({ id: raw bytes }) to the Keychain copy the extensions read; `current` is the one in use. */
export async function saveNativeKeys(raws, current) {
  if (!nativeChatAvailable() || !Object.keys(raws).length) return;
  const keys = Object.fromEntries(Object.entries(raws).map(([id, raw]) => [id, toBase64Url(raw)]));
  await plugin.setKeys({ keys, current }).catch(() => {});
}

export async function nativeHasKey(id) {
  if (!nativeChatAvailable()) return true;
  const { has } = await plugin.hasKey({ id }).catch(() => ({ has: false }));
  return Boolean(has);
}

export async function saveNativeIdentity(role, publicKey, pkcs8) {
  if (!nativeChatAvailable()) return;
  await plugin.setIdentity({ role, publicKey, privateKey: pkcs8 }).catch(() => {});
}

/** { publicKey, privateKey (pkcs8, base64url) } kept on this phone for `role`, or null. */
export async function loadNativeIdentity(role) {
  if (!nativeChatAvailable()) return null;
  const found = await plugin.getIdentity({ role }).catch(() => null);
  return found?.publicKey && found?.privateKey ? { publicKey: found.publicKey, privateKey: found.privateKey } : null;
}

/** The chat lock's two native parts: the app switcher cover and hidden notification previews. */
export async function setNativePrivacy({ cover, hidePreviews }) {
  if (!nativeChatAvailable()) return;
  await plugin.setPrivacy({ cover: Boolean(cover), hidePreviews: Boolean(hidePreviews) }).catch(() => {});
}

export async function forgetNativeKeys() {
  if (!nativeChatAvailable()) return;
  await plugin.clear().catch(() => {});
}
