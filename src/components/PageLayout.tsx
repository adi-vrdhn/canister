"use client";

import Sidebar from "./Sidebar";
import EmailVerificationBadge from "./EmailVerificationBadge";
import NotificationBell from "./NotificationBell";
import { User } from "@/types";
import { ReactNode, useState } from "react";

interface PageLayoutProps {
  user: User | null;
  children: ReactNode;
  onSignOut?: () => void;
  fullWidth?: boolean;
}

export default function PageLayout({ user, children, onSignOut, fullWidth = false }: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell flex min-h-dvh overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-center bg-white/95 backdrop-blur-md lg:left-72">
        {/* Hamburger menu for mobile */}
        <button
          className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-slate-900 transition hover:text-blue-600 lg:hidden"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          <svg className="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="brand-wordmark text-2xl font-bold text-zinc-950 sm:text-3xl">
          CANISTER
        </span>
        <NotificationBell user={user} />
      </header>

      {/* Sidebar: hidden on mobile, slide-in on open */}
      <Sidebar
        user={user}
        onSignOut={onSignOut}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="min-w-0 flex-1 overflow-auto pt-16">
        <EmailVerificationBadge className="mx-auto mt-3 w-full max-w-[1600px] px-1 sm:px-2" />
        <div className={fullWidth ? "w-full" : "mx-auto w-full max-w-[1600px] px-3 py-2 sm:px-4 md:px-6 lg:px-8"}>
          {children}
        </div>
      </div>
    </div>
  );
}
