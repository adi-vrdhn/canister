"use client";

import Sidebar from "./Sidebar";
import EmailVerificationBadge from "./EmailVerificationBadge";
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
    <div className="app-shell flex min-h-screen">
      {/* Hamburger menu for mobile */}
      <button
        className="fixed top-4 left-4 z-50 flex items-center justify-center rounded-full bg-white shadow-md p-2 lg:hidden"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
      >
        <svg className="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

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

      <div className="flex-1 overflow-auto">
        <EmailVerificationBadge className="mx-auto mt-3 w-full max-w-[1600px] px-1 sm:px-2" />
        <div className={fullWidth ? "w-full" : "mx-auto w-full max-w-[1600px] px-2 py-2 sm:px-4 md:px-6 lg:px-8"}>
          {children}
        </div>
      </div>
    </div>
  );
}
