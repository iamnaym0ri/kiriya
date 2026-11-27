// The kiriya.love iPhone app (Capacitor, docs/refactor/PLAN.md phases 3 and 4b). Everything here
// runs only inside it: on the web, `isNativeApp()` is false and nothing else in this file is
// reached. Plugins load on demand, so browsers never download them, and each one is checked with
// isPluginAvailable first, so an older app build without a plugin simply skips that feature.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { API_ORIGIN, api } from "./api.js";

const SERVER = "kiriya.love"; // the Keychain entry's name
const DEVICE = "kiriya:app-device"; // this install's device id (not a secret)
const PUSH_OFF = "kiriya:app-push-off"; // she turned notifications off inside the app
const NO_FACE_ID = "kiriya:app-open-without-face-id"; // "open with Face ID" switched off on this phone

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * The app's own layout: five sections under a tab bar (docs/refactor/RENOVATION.md). True inside
 * the iPhone app. On the website it stays false, so the site keeps its look, except in local
 * development: open any page with `?app=1` (remembered for the tab, `?app=0` turns it off) to build
 * and test the app layout in a browser or the iOS Simulator's Safari. Native-only features (push,
 * haptics, widgets) still check isNativeApp().
 */
export const isAppShell = () => isNativeApp() || (import.meta.env.DEV && devAppPreview());

function devAppPreview() {
  try {
    const flag = new URLSearchParams(window.location.search).get("app");
    if (flag === "1") sessionStorage.setItem("kiriya:dev-app", "1");
    if (flag === "0") sessionStorage.removeItem("kiriya:dev-app");
    return sessionStorage.getItem("kiriya:dev-app") === "1";
  } catch {
    return false;
  }
}

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private storage unavailable: the app asks for the passphrase next time instead.
  }
};

/** This phone's install id, once Face ID has been set up after the passphrase. */
export const enrolledDevice = () => (isNativeApp() ? read(DEVICE) : null);

const biometric = () => import("@capgo/capacitor-native-biometric");

// The app's own Keychain item for opening without Face ID (ios/App/App/MainViewController.swift,
// KiriyaKeychainPlugin): this device only, readable after the first unlock, never synced. Registered
// once here and only ever called, never awaited itself (see the note above pushModule).
const openKeychain = registerPlugin("KiriyaKeychain");

/** Whether this phone opens with Face ID (the default) or straight away (her choice in her tab). */
export const opensWithFaceId = () => read(NO_FACE_ID) !== "1";
/** The "open with Face ID" switch needs this app build's own Keychain plugin. */
export const canOpenWithoutFaceId = () => has("KiriyaKeychain");

/** Where the switch stands on this phone, and what it can do. */
export async function faceIdGateState() {
  if (!canOpenWithoutFaceId()) return { available: false, on: true, biometry: false };
  const { NativeBiometric } = await biometric();
  const { isAvailable } = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
  return { available: true, on: opensWithFaceId(), biometry: Boolean(isAvailable), enrolled: Boolean(enrolledDevice()) };
}

async function rememberDevice(device) {
  await saveWidgetKey(device.widgetKey, device.role).catch(() => {});
  if (!opensWithFaceId() && canOpenWithoutFaceId()) {
    await openKeychain.set({ account: device.id, secret: device.secret });
  } else {
    const { NativeBiometric, AccessControl } = await biometric();
    await NativeBiometric.setCredentials({ username: device.id, password: device.secret, server: SERVER, accessControl: AccessControl.BIOMETRY_ANY });
  }
  write(DEVICE, device.id);
}

/**
 * After the passphrase opens the app: a device secret goes into the iPhone Keychain behind Face ID
 * (the Keychain itself refuses to hand it over without a face match), and the server keeps a hash.
 * With "open with Face ID" off, it goes into the app's own item instead (no Face ID needed).
 */
export async function enrollThisPhone() {
  if (!isNativeApp() || enrolledDevice()) return false;
  if (opensWithFaceId() || !canOpenWithoutFaceId()) {
    const { NativeBiometric } = await biometric();
    const { isAvailable } = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
    if (!isAvailable) return false;
  }
  const device = await api("/app/devices", { method: "POST", body: { label: "iPhone" } });
  try {
    await rememberDevice(device);
  } catch (error) {
    await api(`/app/devices/${device.id}`, { method: "DELETE" }).catch(() => {});
    throw error;
  }
  return true;
}

/** Face ID → Keychain secret → a fresh session. A 401 means this phone needs the passphrase again. */
export async function signInWithFaceId() {
  const { NativeBiometric } = await biometric();
  const credentials = await NativeBiometric.getSecureCredentials({ server: SERVER, reason: "Open your little world" });
  return signInWithSecret(credentials.username, credentials.password);
}

async function signInWithSecret(id, secret) {
  try {
    return await api("/session/app", { method: "POST", body: { id, secret } });
  } catch (error) {
    if (error?.status === 401) await forgetThisPhoneLocally();
    throw error;
  }
}

/**
 * Opens the app the way this phone is set to: Face ID, or (switched off) straight from the app's own
 * Keychain item with no prompt. Also how an expired session renews itself while the app is open.
 */
export async function signInToApp() {
  if (opensWithFaceId() || !canOpenWithoutFaceId()) return signInWithFaceId();
  const { account, secret } = await openKeychain.get();
  if (!account || !secret) {
    // Nothing stored any more: this phone needs the passphrase again.
    write(DEVICE, null);
    throw Object.assign(new Error("This phone needs the passphrase again."), { status: 401 });
  }
  return signInWithSecret(account, secret);
}

/**
 * Switches "open with Face ID" on this phone. Off: confirmed once with Face ID (which hands over the
 * secret to move), or with the passphrase where Face ID isn't there (the phone is set up afresh).
 * On: checked with Face ID, then the secret goes back behind it. Throws if she cancels.
 */
export async function setOpenWithFaceId(on, { passphrase } = {}) {
  if (!canOpenWithoutFaceId()) throw new Error("This needs the newest version of the app.");
  const { NativeBiometric, AccessControl } = await biometric();
  if (on) {
    await NativeBiometric.verifyIdentity({ reason: "Open with Face ID again" });
    const { account, secret } = await openKeychain.get();
    if (account && secret) {
      await NativeBiometric.setCredentials({ username: account, password: secret, server: SERVER, accessControl: AccessControl.BIOMETRY_ANY });
    }
    await openKeychain.remove();
    write(NO_FACE_ID, null);
    return true;
  }
  const { isAvailable } = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
  if (isAvailable && enrolledDevice()) {
    const credentials = await NativeBiometric.getSecureCredentials({ server: SERVER, reason: "Open without Face ID from now on" });
    await openKeychain.set({ account: credentials.username, secret: credentials.password });
    await NativeBiometric.deleteCredentials({ server: SERVER }).catch(() => {});
    write(NO_FACE_ID, "1");
    return false;
  }
  // No Face ID to confirm with (or this phone was never set up): the passphrase confirms, and the
  // phone is set up again with its secret in the app's own item.
  if (!passphrase) throw Object.assign(new Error("Enter your passphrase to confirm."), { code: "needs_passphrase" });
  await api("/me/passphrase/check", { method: "POST", body: { passphrase } });
  const old = enrolledDevice();
  write(NO_FACE_ID, "1");
  write(DEVICE, null);
  try {
    await enrollThisPhone();
  } catch (error) {
    write(NO_FACE_ID, null);
    if (old) write(DEVICE, old);
    throw error;
  }
  if (old && old !== enrolledDevice()) await api(`/app/devices/${old}`, { method: "DELETE" }).catch(() => {});
  return false;
}

export async function forgetThisPhoneLocally() {
  write(DEVICE, null);
  await saveWidgetKey(null).catch(() => {});
  const { NativeBiometric } = await biometric();
  await NativeBiometric.deleteCredentials({ server: SERVER }).catch(() => {});
  // Her "open with Face ID" choice stays; only the secret goes.
  if (canOpenWithoutFaceId()) await openKeychain.remove().catch(() => {});
}

/** "Lock kiriya on this device": Face ID can't open it again until the passphrase does. */
export async function forgetThisPhone() {
  const id = enrolledDevice();
  if (id) await api(`/app/devices/${id}`, { method: "DELETE" }).catch(() => {});
  await forgetThisPhoneLocally();
}

// ---------- notifications ----------

// A Capacitor plugin object answers *every* property as a native method, `then` included, so it must
// never be the result of an async function or an `await`: the promise machinery would call
// `plugin.then()` and fail with "….then() is not implemented on ios". These return the module, and
// each caller takes the plugin off it.
const pushModule = () => import("@capacitor/push-notifications");
let listening = false;

/** Taps on a notification open the page it was about. Registered once, as early as possible. */
export async function listenForNotifications(open) {
  if (!isNativeApp() || listening) return;
  listening = true;
  const { PushNotifications } = await pushModule();
  await PushNotifications.addListener("registration", ({ value }) => {
    const id = enrolledDevice();
    if (id && value) api(`/app/devices/${id}/push`, { method: "PUT", body: { token: value } }).catch(() => {});
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ actionId, notification }) => {
    // "♡ back" and Reply are sent by the app's Swift code in the background (AppDelegate), so the
    // app never has to open for them; only a tap on the notification or "Open" lands here.
    // "Open ✉" and "Pull one" happen inside the notification itself (ios/App/KiriyaNotificationContent).
    if (["HEART", "REPLY", "OPEN_HERE", "PULL"].includes(actionId)) return;
    const to = notification?.data?.navigate;
    if (typeof to === "string" && to.startsWith("/")) open(to);
  });
}

/** "on" | "off" | "denied" for this install. */
export async function nativePushState() {
  const { PushNotifications } = await pushModule();
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === "denied") return "denied";
  if (receive !== "granted" || read(PUSH_OFF) || !enrolledDevice()) return "off";
  return "on";
}

/** Asks for permission (from a tap, or right after setup) and registers with Apple. */
export async function registerForPush({ ask = true } = {}) {
  if (!enrolledDevice()) return "off";
  if (!ask && read(PUSH_OFF)) return "off";
  const { PushNotifications } = await pushModule();
  let { receive } = await PushNotifications.checkPermissions();
  if (receive.startsWith("prompt") && ask) ({ receive } = await PushNotifications.requestPermissions());
  if (receive !== "granted") return receive === "denied" ? "denied" : "off";
  write(PUSH_OFF, null);
  await PushNotifications.register();
  return "on";
}

export async function turnOffNativePush() {
  write(PUSH_OFF, "1");
  const id = enrolledDevice();
  if (id) await api(`/app/devices/${id}/push`, { method: "DELETE" }).catch(() => {});
  const { PushNotifications } = await pushModule();
  await PushNotifications.unregister().catch(() => {});
  return "off";
}

export async function tapFeedback() {
  if (!isNativeApp()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export async function haptic(kind = "light") {
  if (!isNativeApp()) return;
  const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
  const run =
    kind === "success" ? Haptics.notification({ type: NotificationType.Success })
    : kind === "warning" ? Haptics.notification({ type: NotificationType.Warning })
    : kind === "medium" ? Haptics.impact({ style: ImpactStyle.Medium })
    : Haptics.impact({ style: ImpactStyle.Light });
  await run.catch(() => {});
}

const has = (plugin) => isNativeApp() && Capacitor.isPluginAvailable(plugin);

// ---------- widgets, notification buttons, Siri (the App Group the Swift side reads) ----------

export const APP_GROUP = "group.love.kiriya.app";
const bridgeModule = () => import("capacitor-widget-bridge"); // see the note above pushModule

/** The widget key goes where the widgets and the notification extension can read it. */
export async function saveWidgetKey(key, role = null) {
  if (!has("WidgetBridgePlugin")) return;
  const { WidgetBridgePlugin: widgets } = await bridgeModule();
  const group = APP_GROUP;
  if (key) {
    await widgets.setItem({ group, key: "widgetKey", value: key });
    await widgets.setItem({ group, key: "apiBase", value: API_ORIGIN || "https://kiriya.love" });
    if (role) await widgets.setItem({ group, key: "role", value: role });
  } else {
    for (const item of ["widgetKey", "role", "snapshot"]) await widgets.removeItem({ group, key: item }).catch(() => {});
  }
  await widgets.reloadAllTimelines().catch(() => {});
}

/** A reinstall keeps the Face ID secret (Keychain) but loses the App Group: ask for a new key. */
export async function ensureWidgetKey(role) {
  const id = enrolledDevice();
  if (!id || !has("WidgetBridgePlugin")) return;
  const { WidgetBridgePlugin: widgets } = await bridgeModule();
  const { results } = await widgets.getItem({ group: APP_GROUP, key: "widgetKey" }).catch(() => ({ results: null }));
  if (results) return;
  const { widgetKey } = await api(`/app/devices/${id}/widget-key`, { method: "POST", body: {} });
  if (widgetKey) await saveWidgetKey(widgetKey, role);
}

let lastWidgetReload = 0;
/** Something the widgets show changed (a note opened, the jar drawn, a message read). */
export async function refreshWidgets({ force = false } = {}) {
  if (!has("WidgetBridgePlugin") || (!force && Date.now() - lastWidgetReload < 20_000)) return;
  lastWidgetReload = Date.now();
  const { WidgetBridgePlugin: widgets } = await bridgeModule();
  await widgets.reloadAllTimelines().catch(() => {});
}

// ---------- the icon: badge, quick actions, alternate icons ----------

export async function setBadge(count) {
  if (!has("Badge")) return;
  const { Badge } = await import("@capawesome/capacitor-badge");
  await (count > 0 ? Badge.set({ count }) : Badge.clear()).catch(() => {});
}

/** Long-press on the icon. Each id is routed by NativeApp. */
export const QUICK_ACTIONS = [
  { id: "heart", title: "Send a ♡", description: "thinking of you", iosIcon: "heart.fill" },
  { id: "chat", title: "Open chat", iosIcon: "bubble.left.and.bubble.right.fill" },
  { id: "pull-note", title: "Pull a note", description: "from the jar", iosIcon: "sparkles" },
];

export async function setupQuickActions(onAction) {
  if (!has("AppShortcuts")) return () => {};
  const { AppShortcuts } = await import("@capawesome/capacitor-app-shortcuts");
  await AppShortcuts.set({ shortcuts: QUICK_ACTIONS }).catch(() => {});
  const listener = await AppShortcuts.addListener("click", ({ shortcutId }) => onAction(shortcutId));
  return () => listener.remove();
}

/** The icons she can pick from (Settings). `null` is the lilac original. Names match the Xcode icon sets. */
export const APP_ICONS = [
  { name: null, label: "lilac", preview: "/app-icons/lilac.png" },
  { name: "Night", label: "night sky", preview: "/app-icons/night.png" },
  { name: "Blush", label: "blush", preview: "/app-icons/blush.png" },
  { name: "Mint", label: "miku mint", preview: "/app-icons/mint.png" },
  { name: "Paper", label: "paper", preview: "/app-icons/paper.png" },
];

export async function appIconState() {
  if (!has("AppIcon")) return { available: false, current: null };
  const { AppIcon } = await import("@capawesome/capacitor-app-icon");
  const { available } = await AppIcon.isAvailable().catch(() => ({ available: false }));
  if (!available) return { available: false, current: null };
  const { icon } = await AppIcon.getCurrentIcon().catch(() => ({ icon: null }));
  return { available: true, current: icon ?? null };
}

export async function chooseAppIcon(name) {
  const { AppIcon } = await import("@capawesome/capacitor-app-icon");
  if (name) await AppIcon.setIcon({ icon: name });
  else await AppIcon.resetIcon();
}

// ---------- keyboard and deep links ----------

/** Tracks the keyboard so the chat composer can ride on top of it (Keyboard resize mode "none"). */
export async function trackKeyboard() {
  if (!has("Keyboard")) return () => {};
  const { Keyboard } = await import("@capacitor/keyboard");
  const root = document.documentElement;
  const shown = await Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => {
    root.style.setProperty("--kb", `${keyboardHeight}px`);
    document.body.classList.add("keyboard-open");
  });
  const hidden = await Keyboard.addListener("keyboardWillHide", () => {
    root.style.setProperty("--kb", "0px");
    document.body.classList.remove("keyboard-open");
  });
  await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  return () => {
    shown.remove();
    hidden.remove();
  };
}

/** kiriyalove://open/world/chat → "/world/chat" (widgets and Siri open the app this way). */
export function deepLinkPath(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "kiriyalove:" || parsed.host !== "open") return null;
    const path = `${parsed.pathname || "/world"}${parsed.search}${parsed.hash}`;
    return path.startsWith("/world") ? path : null;
  } catch {
    return null;
  }
}

export async function listenForDeepLinks(open) {
  const { App } = await import("@capacitor/app");
  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    const path = deepLinkPath(url);
    if (path) open(path);
  });
  return () => listener.remove();
}
