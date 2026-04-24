"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface AuthMobileCardProps {
  title: string;
  subtitle: string;
  mode: "login" | "signup";
  footer: ReactNode;
  children: ReactNode;
}

export default function AuthMobileCard({ title, subtitle, mode, footer, children }: AuthMobileCardProps) {
  return (
    <div className="md:hidden">
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
        <div className="relative h-44 overflow-hidden bg-slate-950">
          <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16)_0_14px,transparent_15px),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.1)_0_10px,transparent_11px),radial-gradient(circle_at_35%_80%,rgba(255,255,255,0.12)_0_12px,transparent_13px)]" />
          <div className="absolute left-4 top-4">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/65">Canisterr</p>
          </div>
          <div className="absolute right-4 top-4 text-[11px] font-semibold text-white/60">
            {mode === "login" ? "Login" : "Sign up"}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href="/dashboard"
              aria-label="Go to home"
              className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.24)]"
            >
              <span className="h-6 w-6 rounded-md border-[5px] border-slate-950" />
            </Link>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <h1 className="text-2xl font-black text-slate-950">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>

          <div className="mt-5">{children}</div>

          <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>
        </div>
      </div>
    </div>
  );
}
