"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, Film, Home, Share2, Sparkles } from "lucide-react";
import { useIsPwa } from "@/lib/pwa";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",     label: "Home",    icon: Home,        exact: false },
  { href: "/share",         label: "Share",   icon: Share2,      exact: false },
  { href: "/logs",          label: "Log",     icon: Film,        exact: false },
  { href: "/lists",         label: "Lists",   icon: BookMarked,  exact: false },
  { href: "/movie-matcher", label: "Matcher", icon: Sparkles,    exact: false },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PwaBottomNav() {
  const pathname = usePathname();
  const isPwa = useIsPwa();
  const isAuthRoute = pathname.startsWith("/auth");
  const isScanRoute = pathname.startsWith("/scan");

  if (!isPwa || isAuthRoute || isScanRoute) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="grid h-[calc(4.75rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-white/10 bg-[#050505]/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActivePath(pathname, href, exact);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`relative flex h-full flex-col items-center justify-center gap-1 transition ${
                active ? "text-[#ff7a1a]" : "text-white/45 hover:text-white/70"
              }`}
            >
              <Icon
                className="h-[22px] w-[22px] transition-all duration-150"
                strokeWidth={active ? 2.25 : 1.6}
                fill={active ? "currentColor" : "none"}
              />
              <span
                className={`text-[10px] font-medium leading-none tracking-wide transition-colors ${
                  active ? "text-[#ff7a1a]" : "text-white/40"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
