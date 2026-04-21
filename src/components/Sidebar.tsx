"use client";

  const sidebarBase = "flex h-screen w-72 flex-col border-r border-border-subtle bg-[#111111] backdrop-blur z-50 transition-transform duration-300";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

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
  const sidebarBase = "flex h-screen w-72 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur z-50 transition-transform duration-300";
  const sidebarMobile = mobileOpen
    ? "fixed top-0 left-0 lg:static translate-x-0"
    : "fixed top-0 -left-80 lg:static -translate-x-full lg:translate-x-0 pointer-events-none lg:pointer-events-auto";

  return (
    <div className={`${sidebarBase} ${sidebarMobile} min-w-0`}>
      {/* Close button for mobile */}
      <button
        className={`absolute top-4 right-4 z-50 items-center justify-center rounded-full bg-bg-card shadow p-2 lg:hidden ${mobileOpen ? 'flex' : 'hidden'}`}
        onClick={onCloseMobile}
      >
        <svg className="w-6 h-6 text-gold-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Profile Section */}
      <Link href="/profile" className="block border-b border-slate-200/80 p-6 transition-colors hover:bg-slate-50/80">
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
          <div className="flex-1">
            <p className="text-base font-bold font-playfair text-slate-900">{user.name}</p>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-5">
        <Link
          href="/dashboard"
          className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive("/dashboard")
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Dashboard
        </Link>

        <Link
          href="/share"
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
