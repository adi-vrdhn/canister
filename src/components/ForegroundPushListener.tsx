"use client";

import { useEffect } from "react";
import { subscribeToForegroundPushMessages } from "@/lib/push-notifications";

export default function ForegroundPushListener() {
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

  return null;
}
