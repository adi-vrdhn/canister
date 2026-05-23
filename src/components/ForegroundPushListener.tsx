"use client";

import { useEffect } from "react";
import type { MessagePayload } from "firebase/messaging";
import { subscribeToForegroundPushMessages } from "@/lib/push-notifications";

const SEEN_NOTIFICATION_KEY = "canisterr_seen_push_notifications";
const SEEN_NOTIFICATION_TTL_MS = 15_000;

function readSeenNotificationMap(): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SEEN_NOTIFICATION_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeSeenNotificationMap(nextMap: Record<string, number>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SEEN_NOTIFICATION_KEY, JSON.stringify(nextMap));
  } catch {
    // Ignore localStorage failures.
  }
}

function getNotificationDedupKey(payload: MessagePayload) {
  const anyPayload = payload as MessagePayload & {
    notification?: { tag?: string | null } | null;
    data?: { notificationId?: string; tag?: string; url?: string; title?: string; body?: string } | null;
  };

  return (
    anyPayload.data?.notificationId?.trim() ||
    anyPayload.data?.tag?.trim() ||
    anyPayload.notification?.tag?.trim() ||
    anyPayload.data?.url?.trim() ||
    `${anyPayload.data?.title || ""}:${anyPayload.data?.body || ""}`
  );
}

function shouldShowNotification(dedupKey: string): boolean {
  const seen = readSeenNotificationMap();
  const now = Date.now();
  const nextSeen: Record<string, number> = {};

  for (const [key, timestamp] of Object.entries(seen)) {
    if (now - timestamp <= SEEN_NOTIFICATION_TTL_MS) {
      nextSeen[key] = timestamp;
    }
  }

  if (nextSeen[dedupKey]) {
    writeSeenNotificationMap(nextSeen);
    return false;
  }

  nextSeen[dedupKey] = now;
  writeSeenNotificationMap(nextSeen);
  return true;
}

export default function ForegroundPushListener() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    return subscribeToForegroundPushMessages((payload) => {
      if (Notification.permission !== "granted") return;

      const dedupKey = getNotificationDedupKey(payload);
      if (!shouldShowNotification(dedupKey)) {
        return;
      }

      const title = payload.data?.title || payload.notification?.title || "Canisterr";
      const body =
        payload.data?.body ||
        payload.notification?.body ||
        "You have a new notification.";
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
          tag: payload.data?.tag || payload.data?.notificationId || dedupKey,
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
