"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useIsPwa } from "@/lib/pwa";

const DISMISSED_KEY = "canisterr_mobile_install_prompt_dismissed";
const SHOWN_KEY = "canisterr_mobile_install_prompt_shown";
const SCROLL_THRESHOLD = 280;

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
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);

    const updateMobileState = () => {
      if (typeof window === "undefined") return;
      const mobileQuery = window.matchMedia("(max-width: 768px)");
      setIsMobile(mobileQuery.matches || window.innerWidth <= 768);
    };

    updateMobileState();

    const mobileQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 768px)") : null;
    mobileQuery?.addEventListener?.("change", updateMobileState);
    window.addEventListener("resize", updateMobileState);

    return () => {
      mobileQuery?.removeEventListener?.("change", updateMobileState);
      window.removeEventListener("resize", updateMobileState);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!mounted || isPwa || !isMobile) return;

    const dismissed = safeReadStorage(window.localStorage, DISMISSED_KEY) === "1";
    const shown = safeReadStorage(window.sessionStorage, SHOWN_KEY) === "1";

    if (dismissed || shown) return;

    const revealOnScroll = () => {
      if (window.scrollY < SCROLL_THRESHOLD) return;
      setVisible(true);
      safeWriteStorage(window.sessionStorage, SHOWN_KEY, "1");
      window.removeEventListener("scroll", revealOnScroll);
    };

    revealOnScroll();
    window.addEventListener("scroll", revealOnScroll, { passive: true });

    return () => window.removeEventListener("scroll", revealOnScroll);
  }, [mounted, isPwa, isMobile]);

  const handleDismiss = () => {
    setVisible(false);
    safeWriteStorage(window.localStorage, DISMISSED_KEY, "1");
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        handleDismiss();
      }
      setDeferredPrompt(null);
      return;
    }

    setHelpOpen(true);
  };

  if (!mounted || isPwa || !isMobile || !visible) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 sm:bottom-6">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#0f0f0f]/95 px-4 py-4 text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ff7a1a] text-lg font-black text-black">
              C
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffb36b]">
                Download app
              </p>
              <h2 className="mt-1 text-lg font-black leading-tight">
                Add Canisterr to your home screen
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#f5f0de]/72">
                Install the app for faster access, smoother scrolling, and a cleaner experience on mobile.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10"
              aria-label="Dismiss install prompt"
            >
              Later
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
            >
              {deferredPrompt ? "Download app" : "How to install"}
            </button>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
              onClick={handleDismiss}
            >
              Browse
            </Link>
          </div>
        </div>
      </div>

      {helpOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#111111] p-5 text-[#f5f0de] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffb36b]">
                  Install app
                </p>
                <h3 className="mt-2 text-2xl font-black">Add Canisterr to Home Screen</h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-6 text-[#f5f0de]/72">
              <p>On iPhone, tap Share, then Add to Home Screen.</p>
              <p>On Android, tap the browser menu and choose Install app or Add to Home Screen.</p>
              <p>If you see an install banner, use that for the quickest setup.</p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
              >
                {deferredPrompt ? "Install now" : "Got it"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
