"use client";

import EmailVerificationBadge from "./EmailVerificationBadge";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "@/types";
import { ReactNode, useEffect, useState } from "react";
import { Menu, Settings } from "lucide-react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { DEFAULT_SETTINGS, mergeSettings, resolveThemePreference } from "@/lib/settings";
import { useIsPwa } from "@/lib/pwa";

const SidebarShell = dynamic(() => import("./Sidebar"), { ssr: false });
const NotificationBellShell = dynamic(() => import("./NotificationBell"), { ssr: false });

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
  const isBrutalist = theme === "brutalist";
  const pathname = usePathname();
  const isPwa = useIsPwa();
  const reserveBottomNavSpace = isPwa && !pathname.startsWith("/auth") && !pathname.startsWith("/scan");
  const guestHeaderHref = "/auth/login";

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
  }, [user]);

  return (
    <div className={`${isBrutalist ? "brutalist bg-[#0a0a0a]" : "app-shell"} flex min-h-dvh overflow-x-hidden`}>
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-center backdrop-blur-md lg:left-72 ${
          isBrutalist ? "border-b border-white/10 bg-[#0a0a0a]/95" : "bg-white/95"
        }`}
      >
        {!isPwa ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={`absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl border border-transparent bg-transparent transition lg:hidden ${
              isBrutalist
                ? "text-[#f5f0de] hover:bg-white/5 hover:border-white/10"
                : "text-slate-900 hover:bg-slate-100 hover:border-slate-200"
            }`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : user ? (
          <Link
            href="/profile"
            className={`absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border transition lg:hidden ${
              isBrutalist
                ? "border-white/10 bg-white/5 text-[#f5f0de] hover:border-[#ff7a1a]/35 hover:bg-white/10"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
            }`}
            aria-label="Open profile"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className={`text-[10px] font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            )}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={`absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl border border-transparent bg-transparent transition lg:hidden ${
              isBrutalist
                ? "text-[#f5f0de] hover:bg-white/5 hover:border-white/10"
                : "text-slate-900 hover:bg-slate-100 hover:border-slate-200"
            }`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link
          href={user ? "/dashboard" : guestHeaderHref}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:opacity-80 ${
            isBrutalist ? "text-[#f5f0de]" : "text-zinc-950"
          }`}
          aria-label={user ? "Go to home" : "Sign in"}
        >
          <Image
            src="/logo.png"
            alt=""
            width={34}
            height={34}
            className="h-8 w-8 rounded-full object-cover sm:h-9 sm:w-9"
            aria-hidden="true"
          />
          <span className="brand-wordmark text-2xl font-bold tracking-tight sm:text-[2rem]">
            Canisterr
          </span>
        </Link>
        {headerAction === "settings" ? (
          user ? (
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
            <Link
              href={guestHeaderHref}
              className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                isBrutalist
                  ? "border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              Sign in
            </Link>
          )
        ) : (
          user ? (
            <NotificationBellShell user={user} theme={theme} />
          ) : (
            <Link
              href={guestHeaderHref}
              className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                isBrutalist
                  ? "border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              Sign in
            </Link>
          )
        )}
      </header>

      {!isPwa && (
        <>
          {/* Sidebar: hidden on mobile, slide-in on open */}
          <SidebarShell
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
        </>
      )}

      <div
        className={`min-w-0 flex-1 overflow-auto pt-16 ${!isPwa ? "lg:pl-72" : ""} ${isBrutalist ? "bg-[#0a0a0a]" : ""} ${
          reserveBottomNavSpace ? "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0" : ""
        }`}
      >
        <EmailVerificationBadge className="mx-auto mt-3 w-full max-w-[1600px] px-1 sm:px-2" />
        <div className={fullWidth ? "w-full" : "mx-auto w-full max-w-[1600px] px-3 py-2 sm:px-4 md:px-6 lg:px-8"}>
          {children}
        </div>
      </div>
    </div>
  );
}
