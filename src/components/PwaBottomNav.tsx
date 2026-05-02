"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutList, NotebookPen, ScanSearch, SendHorizontal } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: false },
  { href: "/share", label: "Share", icon: SendHorizontal, exact: false },
  { href: "/logs", label: "Log", icon: NotebookPen, exact: false },
  { href: "/lists", label: "List", icon: LayoutList, exact: false },
  { href: "/movie-matcher", label: "Matcher", icon: ScanSearch, exact: false },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PwaBottomNav() {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/auth");
  const isScanRoute = pathname.startsWith("/scan");

  if (isAuthRoute || isScanRoute) {
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
              className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                active ? "text-[#ff7a1a]" : "text-white/55 hover:text-white/80"
              }`}
              aria-label={label}
            >
              <Icon
                className={`relative z-10 h-5 w-5 transition-all duration-200 sm:h-[1.15rem] sm:w-[1.15rem] ${
                  active ? "text-[#ff7a1a]" : "text-white/70"
                }`}
                strokeWidth={active ? 2.6 : 2}
                fill={active ? "currentColor" : "none"}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
