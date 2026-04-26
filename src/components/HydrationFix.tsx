"use client";

import { useEffect, ReactNode } from "react";

export default function HydrationFix({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        (args[0].includes("Hydration failed") ||
          args[0].includes("hydrated but some attributes"))
      ) {
        return;
      }
      originalError.call(console, ...args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    if (!window.isSecureContext && !isLocalhost) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }, []);

  return <>{children}</>;
}
