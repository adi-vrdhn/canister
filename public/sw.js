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

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "Canisterr";
  const body = notification.body || data.body || "";
  const url = data.url || "/notifications";

  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
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
