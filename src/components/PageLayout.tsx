"use client";

import Sidebar from "./Sidebar";
import EmailVerificationBadge from "./EmailVerificationBadge";
import NotificationBell from "./NotificationBell";
import Image from "next/image";
import Link from "next/link";
import { User } from "@/types";
import { ReactNode, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { DEFAULT_SETTINGS, mergeSettings, resolveThemePreference } from "@/lib/settings";

interface PageLayoutProps {
  user: User | null;
  children: ReactNode;
  onSignOut?: () => void;
  fullWidth?: boolean;
  theme?: "default" | "brutalist";
  headerAction?: "notifications" | "settings";
}

export default function PageLayout({
  user,
  children,
  onSignOut,
  fullWidth = false,
  theme = "brutalist",
  headerAction = "notifications",
}: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPwaBottomNav, setShowPwaBottomNav] = useState(false);
  const isBrutalist = theme === "brutalist";

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    if (!user) {
      root.dataset.cineTheme = DEFAULT_SETTINGS.appearance.theme;
      root.dataset.cineTextSize = DEFAULT_SETTINGS.appearance.textSize;
      root.dataset.cineReduceMotion = DEFAULT_SETTINGS.appearance.reduceMotion ? "true" : "false";
      root.style.colorScheme = "light";
      return;
    }

    const userRef = ref(db, `users/${user.id}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const settings = mergeSettings(snapshot.exists() ? snapshot.val()?.settings : null);
      root.dataset.cineTheme = settings.appearance.theme;
      root.dataset.cineTextSize = settings.appearance.textSize;
      root.dataset.cineReduceMotion = settings.appearance.reduceMotion ? "true" : "false";
      root.style.colorScheme = resolveThemePreference(settings.appearance.theme);
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      setShowPwaBottomNav(Boolean(standalone && mobile));
    };

    update();

    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const mobileMedia = window.matchMedia("(max-width: 1023px)");

    standaloneMedia.addEventListener?.("change", update);
    mobileMedia.addEventListener?.("change", update);
    window.addEventListener("resize", update);

    return () => {
      standaloneMedia.removeEventListener?.("change", update);
      mobileMedia.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className={`${isBrutalist ? "brutalist bg-[#0a0a0a]" : "app-shell"} flex min-h-dvh overflow-x-hidden`}>
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-center backdrop-blur-md lg:left-72 ${
          isBrutalist ? "border-b border-white/10 bg-[#0a0a0a]/95" : "bg-white/95"
        }`}
      >
        <Link
          href="/profile"
          className={`absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border transition ${
            isBrutalist
              ? "border-white/10 bg-white/5 text-[#f5f0de] hover:border-[#ff7a1a]/35 hover:bg-white/10"
              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
          }`}
          aria-label="Go to profile"
        >
          {user?.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.name}
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
          )}
        </Link>

        <Link
          href="/dashboard"
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:opacity-80 ${
            isBrutalist ? "text-[#f5f0de]" : "text-zinc-950"
          }`}
          aria-label="Go to home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover sm:h-8 sm:w-8"
            aria-hidden="true"
          />
          <span className="brand-wordmark text-xl font-bold tracking-tight sm:text-2xl">
            Canisterr
          </span>
        </Link>
        {headerAction === "settings" ? (
          <Link
            href="/profile/settings"
            className={`absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border transition ${
              isBrutalist
                ? "border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
            }`}
            aria-label="Profile settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        ) : (
          <NotificationBell user={user} theme={theme} />
        )}
      </header>

      {/* Sidebar: hidden on mobile, slide-in on open */}
      <Sidebar
        user={user}
        onSignOut={onSignOut}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        theme={theme}
      />

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 z-40 lg:hidden ${isBrutalist ? "bg-black/70" : "bg-black/30"}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`min-w-0 flex-1 overflow-auto pt-16 lg:pl-72 ${isBrutalist ? "bg-[#0a0a0a]" : ""} ${showPwaBottomNav ? "pb-28" : ""}`}>
        <EmailVerificationBadge className="mx-auto mt-3 w-full max-w-[1600px] px-1 sm:px-2" />
        <div className={fullWidth ? "w-full" : "mx-auto w-full max-w-[1600px] px-3 py-2 sm:px-4 md:px-6 lg:px-8"}>
          {children}
        </div>
      </div>
    </div>
  );
}
