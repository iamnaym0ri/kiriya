// Over-the-air updates for the bundled iPhone app (docs/refactor/PLAN.md 4b), with Capgo's
// open-source updater (@capgo/capacitor-updater, MPL-2.0) and no Capgo cloud: every deploy publishes
// /app-bundle/latest.json (scripts/build-app-bundle.mjs) listing each file of the site with its
// SHA-256. The app downloads only the files it doesn't already have and switches to the new version
// the next time it goes to the background, so she never sees it happen. If a new version fails to
// start, the updater rolls back by itself (notifyAppReady never came).
import { Capacitor } from "@capacitor/core";
import { API_ORIGIN, isBundledApp } from "./api.js";

/* global __APP_BUNDLE_VERSION__ */
export const BUNDLE_VERSION = typeof __APP_BUNDLE_VERSION__ === "string" ? __APP_BUNDLE_VERSION__ : "dev";
const CHECK_EVERY_MS = 10 * 60 * 1000;
let lastCheck = 0;
let running = null;

const updater = async () => (await import("@capgo/capacitor-updater")).CapacitorUpdater;
const available = () => isBundledApp && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CapacitorUpdater");

/** Call once, as early as possible on every launch: this version started fine. */
export async function markAppReady() {
  if (!available()) return;
  await (await updater()).notifyAppReady().catch(() => {});
}

export function checkForUpdate({ force = false } = {}) {
  if (!available() || running || (!force && Date.now() - lastCheck < CHECK_EVERY_MS)) return running;
  lastCheck = Date.now();
  running = update()
    .catch(() => null)
    .finally(() => {
      running = null;
    });
  return running;
}

async function update() {
  const url = `${API_ORIGIN}/app-bundle/latest.json`;
  const latest = await fetch(url, { cache: "no-store" }).then((response) => (response.ok ? response.json() : null));
  if (!latest?.version || !Array.isArray(latest.manifest) || latest.version === BUNDLE_VERSION) return null;
  // A version that needs newer native code waits for the next TestFlight build.
  const { App } = await import("@capacitor/app");
  const { build } = await App.getInfo();
  if (Number(build) < Number(latest.minBuild ?? 0)) return null;
  const CapacitorUpdater = await updater();
  const { bundles } = await CapacitorUpdater.list();
  let bundle = bundles.find((item) => item.version === latest.version && item.status !== "error");
  if (!bundle) bundle = await CapacitorUpdater.download({ url, version: latest.version, manifest: latest.manifest });
  await CapacitorUpdater.next({ id: bundle.id });
  return bundle.version;
}
