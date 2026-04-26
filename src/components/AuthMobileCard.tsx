"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

interface AuthMobileCardProps {
  title: string;
  subtitle: string;
  mode: "login" | "signup" | "forgot";
  footer?: ReactNode;
  children: ReactNode;
}

export default function AuthMobileCard({ title, subtitle, mode, footer, children }: AuthMobileCardProps) {
  const linkBase = "text-sm font-bold transition";
  const activeLink = "text-[#ff7a1a]";
  const inactiveLink = "text-[#f5f0de]/55 hover:text-[#f5f0de]";

  return (
    <div className="mx-auto w-full max-w-[34rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111111] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 px-5 pb-5 pt-5 text-[#f5f0de] sm:px-6 sm:pb-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={42}
            height={42}
            className="h-10 w-10 rounded-full object-cover"
            aria-hidden="true"
          />
          <p className="brand-wordmark text-3xl font-black tracking-[0.04em] text-[#f5f0de] sm:text-4xl">
            Canisterr
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/auth/login"
            className={`${linkBase} ${mode === "login" ? activeLink : inactiveLink}`}
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className={`${linkBase} ${mode === "signup" ? activeLink : inactiveLink}`}
          >
            Register
          </Link>
        </div>
      </div>

      <div className="bg-[#111111] px-5 pb-5 pt-5 text-[#f5f0de] sm:px-6 sm:pb-6 sm:pt-6">
        <div className="max-w-[18rem]">
          <p className="text-2xl font-black leading-tight text-[#f5f0de] sm:text-3xl">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[#f5f0de]/65 sm:text-[0.95rem]">{subtitle}</p>
        </div>

        <div className="mt-6">
          {children}
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-white/50">{footer}</div> : null}
      </div>
    </div>
  );
}
