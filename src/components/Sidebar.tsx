"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import type { User } from "@/types";

interface SidebarProps {
  user: User | null;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ user, onSignOut, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

  if (!user) {
    return null;
  }

  // Sidebar classes for mobile/desktop
  const sidebarBase = "flex h-dvh w-[min(18rem,85vw)] flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur z-50 transition-transform duration-300 lg:h-screen lg:w-72";
  const sidebarMobile = mobileOpen
    ? "fixed left-0 top-0 translate-x-0 lg:static"
    : "fixed left-0 top-0 -translate-x-full pointer-events-none lg:static lg:translate-x-0 lg:pointer-events-auto";

  return (
    <div className={`${sidebarBase} ${sidebarMobile} min-w-0`}>
      {/* Close button for mobile */}
      <button
        className={`absolute right-4 top-4 z-50 h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm lg:hidden ${mobileOpen ? 'flex' : 'hidden'}`}
        onClick={onCloseMobile}
        aria-label="Close menu"
      >
        <svg className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Profile Section */}
      <Link href="/profile" onClick={onCloseMobile} className="block border-b border-slate-200/80 p-5 pr-16 transition-colors hover:bg-slate-50/80 sm:p-6">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.username}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {user.username && user.username.length > 0 ? user.username[0].toUpperCase() : "U"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold font-playfair text-slate-900">{user.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">View profile</p>
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
              ? "bg-slate-900 text-white shadow-sm"
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
              ? "bg-slate-900 text-white shadow-sm"
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
              ? "bg-slate-900 text-white shadow-sm"
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
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Logs
        </Link>

        <Link
          href="/movie-matcher"
          onClick={onCloseMobile}
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/movie-matcher")
              ? "bg-slate-900 text-white shadow-sm"
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
          className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
