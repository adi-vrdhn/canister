self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.registration.unregister();
      } catch (error) {
        console.warn("Service worker unregister failed:", error);
      }

      try {
        if ("caches" in self) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch (error) {
        console.warn("Cache cleanup failed:", error);
      }
    })()
  );
});

