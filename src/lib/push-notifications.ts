"use client";

import { get, push, ref, remove, set } from "firebase/database";
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import app, { db } from "@/lib/firebase";

const PUSH_TOKEN_ID_KEY = "canisterr_push_token_ref";
const PUSH_TOKEN_VALUE_KEY = "canisterr_push_token_value";

export type PushEnrollmentState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  enabled: boolean;
};

export type PushEnableResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      reason: "unsupported" | "permission" | "token";
      message: string;
    };

export type PushSendResult = {
  ok: boolean;
  skipped?: string;
  successCount?: number;
  failureCount?: number;
  error?: string;
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

async function getPushSupportStatus() {
  if (typeof window === "undefined") {
    return { supported: false, permission: "unsupported" as const };
  }

  const supported = await isSupported().catch(() => false);
  const permission = ("Notification" in window ? Notification.permission : "unsupported") as
    | NotificationPermission
    | "unsupported";

  return { supported, permission };
}

async function ensurePushServiceWorkerRegistration() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    return null;
  }
}

export async function getPushEnrollmentState(): Promise<PushEnrollmentState> {
  const { supported, permission } = await getPushSupportStatus();
  const enabled = Boolean(readStorage(PUSH_TOKEN_VALUE_KEY));

  return { supported, permission, enabled };
}

export async function enablePushNotificationsForUser(userId: string): Promise<PushEnableResult> {
  const { supported, permission } = await getPushSupportStatus();

  if (!supported) {
    return {
      ok: false,
      reason: "unsupported" as const,
      message: "Push notifications are not supported in this browser.",
    };
  }

  const nextPermission =
    permission === "granted" ? permission : await Notification.requestPermission().catch(() => "default");

  if (nextPermission !== "granted") {
    return {
      ok: false,
      reason: "permission" as const,
      message: "Please allow notifications to enable push alerts.",
    };
  }

  const messaging = getMessaging(app);
  const registration = await ensurePushServiceWorkerRegistration();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return {
      ok: false,
      reason: "token" as const,
      message: "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY, so this browser cannot register for push.",
    };
  }

  const token = await getToken(messaging, {
    vapidKey,
    ...(registration ? { serviceWorkerRegistration: registration } : {}),
  });

  if (!token) {
    return {
      ok: false,
      reason: "token" as const,
      message: "Could not create a push token for this device.",
    };
  }

  const existingTokensRef = ref(db, `users/${userId}/push_tokens`);
  const existingTokensSnapshot = await get(existingTokensRef);
  if (existingTokensSnapshot.exists()) {
    const existingTokens = existingTokensSnapshot.val() as Record<string, { token?: string }>;
    const duplicateEntries = Object.entries(existingTokens).filter(([, value]) => value?.token === token);
    await Promise.all(duplicateEntries.map(([key]) => remove(ref(db, `users/${userId}/push_tokens/${key}`))));
  }

  const tokenRef = push(ref(db, `users/${userId}/push_tokens`));
  await set(tokenRef, {
    token,
    createdAt: new Date().toISOString(),
    source: "web",
    platform: typeof navigator !== "undefined" ? navigator.userAgent : "web",
  });

  if (tokenRef.key) {
    writeStorage(PUSH_TOKEN_ID_KEY, tokenRef.key);
  }
  writeStorage(PUSH_TOKEN_VALUE_KEY, token);

  return {
    ok: true,
    token,
  };
}

export type PushDeliveryInput = {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string;
  notificationId?: string;
};

export async function sendPushNotification(input: PushDeliveryInput): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const response = await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      console.warn("Push notification dispatch failed:", payload?.error || response.statusText);
      return;
    }

    const payload = (await response.json().catch(() => null)) as PushSendResult | null;
    if (!payload?.ok) {
      console.warn("Push notification dispatch failed:", payload?.error || "Unknown push error");
      return;
    }

    if (payload.skipped) {
      console.warn("Push notification skipped:", payload.skipped);
    }
  } catch (error) {
    console.warn("Push notification dispatch failed:", error);
  }
}

export async function sendTestPushNotification(userId: string): Promise<PushSendResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Test notifications must be sent from a browser session." };
  }

  if (!userId) {
    return { ok: false, error: "Missing user id for test push notification." };
  }

  try {
    const response = await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        title: "Canisterr test notification",
        body: "Push notifications are working on this device.",
        url: "/notifications",
        tag: "canisterr-test",
      }),
    });

    const payload = (await response.json().catch(() => null)) as PushSendResult | null;
    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error || "The push send route returned an error.",
      };
    }

    return payload || { ok: false, error: "No response from push send route." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send a test notification.",
    };
  }
}

export async function disablePushNotificationsForUser(userId: string) {
  const { supported } = await getPushSupportStatus();
  const tokenValue = readStorage(PUSH_TOKEN_VALUE_KEY);
  const tokenRefKey = readStorage(PUSH_TOKEN_ID_KEY);

  if (supported) {
    const messaging = getMessaging(app);
    await deleteToken(messaging).catch(() => {});
  }

  if (tokenRefKey) {
    await remove(ref(db, `users/${userId}/push_tokens/${tokenRefKey}`)).catch(() => {});
  } else if (tokenValue) {
    const snapshotRef = ref(db, `users/${userId}/push_tokens`);
    const snapshot = await get(snapshotRef);
    if (snapshot.exists()) {
      const matches = Object.entries(snapshot.val() as Record<string, { token?: string }>).find(
        ([, value]) => value?.token === tokenValue
      );
      if (matches) {
        await remove(ref(db, `users/${userId}/push_tokens/${matches[0]}`)).catch(() => {});
      }
    }
  }

  removeStorage(PUSH_TOKEN_ID_KEY);
  removeStorage(PUSH_TOKEN_VALUE_KEY);
}

export function subscribeToForegroundPushMessages(onPayload: (payload: MessagePayload) => void) {
  let unsubscribe = () => {};
  let cancelled = false;

  void (async () => {
    const { supported } = await getPushSupportStatus();
    if (cancelled || !supported) return;

    const messaging = getMessaging(app);
    unsubscribe = onMessage(messaging, onPayload);
  })();

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
