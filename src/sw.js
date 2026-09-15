import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Pages open instantly from the cache; the API is always live.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api(\/|$)/] }));

// iOS 18.4+ shows declarative pushes by itself. Everything else lands here, and every push must
// show a notification (iOS revokes permission from web apps that stay silent).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { notification: { title: "kiriya ♡", body: event.data?.text() ?? "" } };
  }
  const n = data.notification ?? data;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(n.title || "a little surprise ♡", {
        body: n.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: n.tag,
        data: { url: n.navigate || "/world" },
      });
      if (n.app_badge && self.navigator.setAppBadge) {
        await self.navigator.setAppBadge(Number(n.app_badge)).catch(() => {});
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/world";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
