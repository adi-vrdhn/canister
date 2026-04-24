"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Settings } from "lucide-react";
import type { User } from "@/types";

interface SidebarProps {
  user: User | null;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  theme?: "default" | "brutalist";
}

export default function Sidebar({
  user,
  onSignOut,
  mobileOpen = false,
  onCloseMobile,
  theme = "default",
}: SidebarProps) {
  const pathname = usePathname();
  const isBrutalist = theme === "brutalist";

  const isActive = (path: string) => pathname.startsWith(path);

  if (!user) {
    return null;
  }

  // Sidebar classes for mobile/desktop
  const sidebarBase = isBrutalist
    ? "flex h-dvh w-[min(18rem,85vw)] flex-col border-r border-white/10 bg-[#0a0a0a]/95 text-[#f5f0de] backdrop-blur z-50 transition-transform duration-300 lg:fixed lg:left-0 lg:top-0 lg:h-dvh lg:w-72"
    : "flex h-dvh w-[min(18rem,85vw)] flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur z-50 transition-transform duration-300 lg:fixed lg:left-0 lg:top-0 lg:h-dvh lg:w-72";
  const sidebarMobile = mobileOpen
    ? "fixed left-0 top-0 translate-x-0 lg:translate-x-0 lg:pointer-events-auto"
    : "fixed left-0 top-0 -translate-x-full pointer-events-none lg:translate-x-0 lg:pointer-events-auto";

  return (
    <div className={`${sidebarBase} ${sidebarMobile} min-w-0`}>
      {/* Close button for mobile */}
      <button
        className={`absolute right-4 top-4 z-50 h-10 w-10 items-center justify-center rounded-full border shadow-sm lg:hidden ${
          isBrutalist
            ? "border-white/15 bg-[#161616] text-[#f5f0de]"
            : "border-slate-200 bg-white text-slate-900"
        } ${mobileOpen ? "flex" : "hidden"}`}
        onClick={onCloseMobile}
        aria-label="Close menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Profile Section */}
      <Link
        href="/profile"
        onClick={onCloseMobile}
        className={`block border-b p-5 pr-16 transition-colors sm:p-6 ${
          isBrutalist ? "border-white/10 hover:bg-white/5" : "border-slate-200/80 hover:bg-slate-50/80"
        }`}
      >
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.username}
              width={40}
              height={40}
              className={`h-10 w-10 rounded-full object-cover ${
                isBrutalist ? "ring-1 ring-white/10" : "ring-1 ring-slate-200"
              }`}
            />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${isBrutalist ? "bg-[#f5f0de] text-[#0a0a0a]" : "bg-slate-900 text-white"}`}>
              {user.username && user.username.length > 0 ? user.username[0].toUpperCase() : "U"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-base font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>{user.name}</p>
            <p className={`mt-0.5 text-xs font-semibold ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>View profile</p>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-5">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/dashboard")
              ? isBrutalist
                ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                : "bg-slate-900 text-white shadow-sm"
              : isBrutalist
              ? "text-[#f5f0de] hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Home
        </Link>

        <Link
          href="/share"
          onClick={onCloseMobile}
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/share")
              ? isBrutalist
                ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                : "bg-slate-900 text-white shadow-sm"
              : isBrutalist
              ? "text-[#f5f0de] hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Share
        </Link>


        <Link
          href="/lists"
          onClick={onCloseMobile}
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/lists")
              ? isBrutalist
                ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                : "bg-slate-900 text-white shadow-sm"
              : isBrutalist
              ? "text-[#f5f0de] hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Lists
        </Link>

        <Link
          href="/logs"
          onClick={onCloseMobile}
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/logs")
              ? isBrutalist
                ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                : "bg-slate-900 text-white shadow-sm"
              : isBrutalist
              ? "text-[#f5f0de] hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Logs
        </Link>

        <Link
          href="/profile/settings"
          onClick={onCloseMobile}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/profile/settings")
              ? isBrutalist
                ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                : "bg-slate-900 text-white shadow-sm"
              : isBrutalist
              ? "text-[#f5f0de] hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>

        <Link
          href="/movie-matcher"
          onClick={onCloseMobile}
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/movie-matcher")
              ? isBrutalist
                ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                : "bg-slate-900 text-white shadow-sm"
              : isBrutalist
              ? "text-[#f5f0de] hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          MovieMatcher
        </Link>
      </nav>

      {/* Sign Out */}
      <div className="border-t border-slate-200/80 p-5">
        <button
          onClick={onSignOut}
          className={`w-full rounded-full border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
            isBrutalist
              ? "border-white/10 bg-[#161616] text-[#f5f0de] hover:bg-white/5"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
