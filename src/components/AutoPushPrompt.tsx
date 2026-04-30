"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { Bell, Loader2, X } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { mergeSettings } from "@/lib/settings";
import {
  enablePushNotificationsForUser,
  getPushEnrollmentState,
  type PushEnrollmentState,
} from "@/lib/push-notifications";

const DISMISSED_KEY_PREFIX = "canisterr_push_prompt_dismissed";

function dismissedKey(userId: string) {
  return `${DISMISSED_KEY_PREFIX}:${userId}`;
}

function readDismissed(userId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(dismissedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dismissedKey(userId), "1");
  } catch {
    // Ignore localStorage failures.
  }
}

export default function AutoPushPrompt() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushEnrollmentState>({
    supported: false,
    permission: "unsupported",
    enabled: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(true);

  const isAuthRoute = useMemo(() => pathname?.startsWith("/auth/"), [pathname]);
  const isAppRoute = useMemo(() => {
    if (!pathname) return false;
    return !pathname.startsWith("/auth/") && !pathname.startsWith("/api/");
  }, [pathname]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUserId(null);
        setDismissed(true);
        return;
      }

      setUserId(firebaseUser.uid);
      setDismissed(readDismissed(firebaseUser.uid));
      setPushState(await getPushEnrollmentState());
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !isAppRoute || isAuthRoute) return;

    let cancelled = false;

    const maybeAutoEnable = async () => {
      const nextState = await getPushEnrollmentState();
      if (cancelled) return;
      setPushState(nextState);

      if (!nextState.supported) return;
      if (nextState.enabled) return;
      if (nextState.permission !== "granted") return;

      try {
        setBusy(true);
        const result = await enablePushNotificationsForUser(userId);
        if (!result.ok) {
          if (!cancelled) {
            setMessage(result.message);
          }
          return;
        }

        const userSnapshot = await get(ref(db, `users/${userId}`));
        const settings = mergeSettings(userSnapshot.exists() ? userSnapshot.val()?.settings : null);
        await update(ref(db, `users/${userId}`), {
          settings: {
            ...settings,
            notifications: {
              ...settings.notifications,
              pushNotifications: true,
            },
          },
          settings_updated_at: new Date().toISOString(),
        });

        if (!cancelled) {
          setPushState(await getPushEnrollmentState());
          setDismissed(true);
          writeDismissed(userId);
        }
      } catch (error) {
        console.error("Auto-enable push failed:", error);
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    void maybeAutoEnable();

    return () => {
      cancelled = true;
    };
  }, [isAppRoute, isAuthRoute, userId]);

  const handleEnable = async () => {
    if (!userId || busy) return;

    setBusy(true);
    setMessage("");
    try {
      const result = await enablePushNotificationsForUser(userId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      const userSnapshot = await get(ref(db, `users/${userId}`));
      const settings = mergeSettings(userSnapshot.exists() ? userSnapshot.val()?.settings : null);
      await update(ref(db, `users/${userId}`), {
        settings: {
          ...settings,
          notifications: {
            ...settings.notifications,
            pushNotifications: true,
          },
        },
        settings_updated_at: new Date().toISOString(),
      });

      setPushState(await getPushEnrollmentState());
      setDismissed(true);
      writeDismissed(userId);
    } catch (error) {
      console.error("Push prompt enable failed:", error);
      setMessage("Could not enable notifications right now.");
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    if (userId) {
      writeDismissed(userId);
    }
    setDismissed(true);
  };

  if (!userId || !isAppRoute || isAuthRoute) return null;
  if (!pushState.supported) return null;
  if (pushState.permission === "denied") return null;
  if (pushState.enabled) return null;
  if (dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 lg:left-auto lg:right-6 lg:w-[24rem]">
      <div className="rounded-[1.5rem] border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 p-2 text-[#ffb36b]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black text-[#f5f0de]">Turn on notifications</p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                We&apos;ll let you know when someone follows you, comments, or sends updates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full p-1 text-white/45 transition hover:bg-white/5 hover:text-[#f5f0de]"
            aria-label="Dismiss notification prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {message ? <p className="mt-3 text-xs text-[#ffb36b]">{message}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[#f5f0de] transition hover:bg-white/10"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-3 py-2 text-xs font-black text-black transition hover:bg-[#ff8d3b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
