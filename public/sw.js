/* global importScripts, firebase */

importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC_RylgN_XYnCFcUo-n9vSNWddwHHzwqqU",
  authDomain: "filmshare-72c31.firebaseapp.com",
  projectId: "filmshare-72c31",
  databaseURL: "https://filmshare-72c31-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "filmshare-72c31.appspot.com",
  messagingSenderId: "203083828735",
  appId: "1:203083828735:web:aa6b5aee894df6d39febca",
});

const messaging = firebase.messaging();
const SEEN_NOTIFICATION_KEY = "__canisterr_seen_push_notifications__";
const SEEN_NOTIFICATION_TTL_MS = 15000;

function readSeenNotifications() {
  try {
    if (!self[SEEN_NOTIFICATION_KEY]) {
      self[SEEN_NOTIFICATION_KEY] = {};
    }
    return self[SEEN_NOTIFICATION_KEY];
  } catch {
    return {};
  }
}

function writeSeenNotifications(nextMap) {
  self[SEEN_NOTIFICATION_KEY] = nextMap;
}

function getDedupKey(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};
  return (
    (data.notificationId && String(data.notificationId).trim()) ||
    (data.tag && String(data.tag).trim()) ||
    (notification.tag && String(notification.tag).trim()) ||
    (data.url && String(data.url).trim()) ||
    `${data.title || notification.title || ""}:${data.body || notification.body || ""}`
  );
}

function shouldShowNotification(dedupKey) {
  const now = Date.now();
  const seen = readSeenNotifications();
  const nextSeen = {};

  for (const [key, timestamp] of Object.entries(seen)) {
    if (now - timestamp <= SEEN_NOTIFICATION_TTL_MS) {
      nextSeen[key] = timestamp;
    }
  }

  if (nextSeen[dedupKey]) {
    writeSeenNotifications(nextSeen);
    return false;
  }

  nextSeen[dedupKey] = now;
  writeSeenNotifications(nextSeen);
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = data.title || notification.title || "Canisterr";
  const body = data.body || notification.body || "";
  const url = data.url || data.link || "/notifications";
  const dedupKey = getDedupKey(payload);

  if (!shouldShowNotification(dedupKey)) {
    return;
  }

  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || data.notificationId || dedupKey,
    renotify: false,
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/notifications";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client && client.url.includes(url)) {
          await client.focus();
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});
