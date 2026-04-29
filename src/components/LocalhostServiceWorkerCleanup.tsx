"use client";

import { useEffect } from "react";

export default function LocalhostServiceWorkerCleanup() {
  useEffect(() => {
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!isLocalhost || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    (async () => {
      let hadRegistrations = false;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (cancelled) return;

        const staleRegistrations = registrations.filter((registration) => {
          const scriptUrls = [registration.active?.scriptURL, registration.installing?.scriptURL, registration.waiting?.scriptURL].filter(Boolean);
          return !scriptUrls.some((scriptUrl) => scriptUrl?.endsWith("/sw.js"));
        });

        if (staleRegistrations.length > 0) {
          hadRegistrations = true;
          await Promise.all(staleRegistrations.map((registration) => registration.unregister()));
        }
      } catch (error) {
        console.warn("Service worker cleanup failed:", error);
      }

      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          if (cancelled) return;

          if (keys.length > 0) {
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        }
      } catch (error) {
        console.warn("Cache cleanup failed:", error);
      }

      if (hadRegistrations && !cancelled) {
        window.location.reload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
