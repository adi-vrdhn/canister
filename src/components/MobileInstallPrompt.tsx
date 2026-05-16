"use client";

import { useEffect, useRef, useState } from "react";
import { useIsPwa } from "@/lib/pwa";

const AUTO_PROMPT_KEY = "canisterr_install_prompt_auto_prompted";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function safeReadStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures in privacy-restricted browsers.
  }
}

export default function MobileInstallPrompt() {
  const isPwa = useIsPwa();
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const promptInFlightRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      if (typeof window === "undefined") return;
      safeWriteStorage(window.sessionStorage, AUTO_PROMPT_KEY, "1");
      setDeferredPrompt(null);
      promptInFlightRef.current = false;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!mounted || isPwa || !deferredPrompt) return;
    if (promptInFlightRef.current) return;
    if (typeof window !== "undefined" && safeReadStorage(window.sessionStorage, AUTO_PROMPT_KEY) === "1") return;

    let cancelled = false;
    promptInFlightRef.current = true;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;

          if (typeof window !== "undefined") {
            safeWriteStorage(window.sessionStorage, AUTO_PROMPT_KEY, "1");
          }

          if (choice.outcome === "accepted" && typeof window !== "undefined") {
            safeWriteStorage(window.localStorage, AUTO_PROMPT_KEY, "1");
          }
        } catch {
          // If the browser blocks or rejects the prompt, we stay silent.
        } finally {
          if (!cancelled) {
            setDeferredPrompt(null);
            promptInFlightRef.current = false;
          }
        }
      })();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mounted, isPwa, deferredPrompt]);

  if (!mounted || isPwa) {
    return null;
  }

  return null;
}
