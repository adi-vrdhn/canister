"use client";

import { useEffect, ReactNode } from "react";
import { subscribeToForegroundPushMessages } from "@/lib/push-notifications";

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
    if (typeof window === "undefined" || !("Notification" in window)) return;

    return subscribeToForegroundPushMessages((payload) => {
      if (Notification.permission !== "granted") return;

      const title = payload.notification?.title || "Canisterr";
      const body = payload.notification?.body || payload.data?.body || "You have a new notification.";
      const icon = payload.notification?.icon || "/icon.svg";
      const clickTarget =
        (payload as { fcmOptions?: { link?: string } }).fcmOptions?.link ||
        payload.data?.link ||
        "/notifications";

      try {
        const notification = new Notification(title, {
          body,
          icon,
          badge: icon,
          data: { url: clickTarget },
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = clickTarget;
          notification.close();
        };
      } catch (error) {
        console.warn("Foreground notification failed:", error);
      }
    });
  }, []);

  return <>{children}</>;
}
