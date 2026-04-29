"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, List, NotebookText, ScanSearch, Share2 } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: false },
  { href: "/share", label: "Share", icon: Share2, exact: false },
  { href: "/logs", label: "Log", icon: NotebookText, exact: false },
  { href: "/lists", label: "List", icon: List, exact: false },
  { href: "/movie-matcher", label: "Matcher", icon: ScanSearch, exact: false },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PwaBottomNav() {
  const pathname = usePathname();

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
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                  active ? "text-[#f5f0de]" : "text-white/55 hover:text-white/80"
                }`}
                aria-label={label}
              >
                <Icon className={`h-6 w-6 ${active ? "text-[#f5f0de]" : "text-white/70"}`} />
                <span
                  className={`absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#ff7a1a] transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
