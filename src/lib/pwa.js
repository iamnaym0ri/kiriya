import { api } from "./api.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
let registrationPromise = null;
let registration = null;

export function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID_PUBLIC_KEY);
}

/** Registers the service worker once. In development there is no worker (Vite serves the source). */
export function registerServiceWorker() {
  if (registrationPromise) return registrationPromise;
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) {
    registrationPromise = Promise.resolve(null);
    return registrationPromise;
  }
  registrationPromise = navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      registration = reg;
      return reg;
    })
    .catch(() => null);
  return registrationPromise;
}

function keyToBytes(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Must run straight from a tap: iOS only shows the permission prompt when subscribe() is called
 * inside the gesture, so the registration is looked up in advance rather than awaited here.
 */
export async function enableSurprises() {
  if (!pushSupported()) return { state: "unsupported" };
  const reg = registration ?? (await registerServiceWorker());
  if (!reg) return { state: "unsupported" };
  try {
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
    await api("/push/subscribe", { method: "POST", body: subscription.toJSON() });
    return { state: "on" };
  } catch (error) {
    if (Notification.permission === "denied") return { state: "denied" };
    return { state: "error", message: error.message };
  }
}

export async function disableSurprises() {
  const reg = registration ?? (await registerServiceWorker());
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) {
    await api("/push/unsubscribe", { method: "POST", body: { endpoint: subscription.endpoint } }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
  return { state: "off" };
}

export async function currentSurpriseState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = registration ?? (await registerServiceWorker());
  const subscription = await reg?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/** iOS can drop a subscription silently; re-send it to the server each time the app opens. */
export async function resyncSurprises() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await registerServiceWorker();
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) await api("/push/subscribe", { method: "POST", body: subscription.toJSON() }).catch(() => {});
  // The app badge now follows unread notes (see lib/notes.js) instead of clearing on every open.
}
