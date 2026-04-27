"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import CinematicLoading from "@/components/CinematicLoading";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";

type AuthMode = "home" | "login" | "signup";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("home");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <CinematicLoading />;
  }

  const details = {
    login: {
      eyebrow: "Welcome back for sign in",
      title: "Pick up your watchlist, logs, and posts.",
      copy: "Sign in to continue where you left off. Your feed, matcher, lists, and profile are waiting.",
      cta: "/auth/login",
      ctaLabel: "Continue to sign in",
      icon: LogIn,
    },
    signup: {
      eyebrow: "Happy to have you in register",
      title: "Create your Canisterr account and start your taste trail.",
      copy: "Register to build your profile, log movies, follow friends, and join the brutalist feed.",
      cta: "/auth/signup",
      ctaLabel: "Continue to register",
      icon: UserPlus,
    },
  }[mode === "home" ? "login" : mode];

  return (
    <div className="min-h-dvh bg-[#090909] text-[#f5f0de]">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex flex-col justify-between px-6 py-6 sm:px-8 sm:py-8 lg:border-r lg:border-white/10 lg:px-10 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,26,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.06),_transparent_35%)]" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Canisterr logo" width={60} height={60} className="h-14 w-14 rounded-2xl object-cover" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Canisterr</p>
                <h1 className="mt-1 text-3xl font-black leading-none sm:text-5xl">Black. Orange. Brutal.</h1>
              </div>
            </div>

            <p className="mt-5 max-w-xl text-base leading-7 text-[#f5f0de]/72 sm:text-lg">
              The place for movie logs, posts, lists, friends, and taste matching. Clean on desktop, sharp on mobile.
            </p>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 sm:max-w-md">
            <Link
              href="/auth/login"
              onClick={() => setMode("login")}
              className="inline-flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-[#ff7a1a]/45 hover:bg-white/[0.08]"
            >
              <span>
                <span className="block text-lg font-black text-[#f5f0de]">Sign in</span>
                <span className="block text-sm text-white/55">Welcome back for sign in</span>
              </span>
              <ArrowRight className="h-5 w-5 text-[#ffb36b]" />
            </Link>

            <Link
              href="/auth/signup"
              onClick={() => setMode("signup")}
              className="inline-flex items-center justify-between rounded-[1.5rem] border border-[#ff7a1a] bg-[#ff7a1a] px-5 py-4 text-left transition hover:bg-[#ff8d3b]"
            >
              <span>
                <span className="block text-lg font-black text-[#0a0a0a]">Register</span>
                <span className="block text-sm font-medium text-[#0a0a0a]/70">Happy to have you in register</span>
              </span>
              <ArrowRight className="h-5 w-5 text-[#0a0a0a]" />
            </Link>
          </div>

          <div className="relative z-10 mt-8 text-xs uppercase tracking-[0.24em] text-white/35">
            Sign in / Register
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="w-full max-w-xl">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <Image src="/logo.png" alt="Canisterr logo" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ffb36b]">Canisterr</p>
                <p className="text-sm text-white/55">Sign in / Register</p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ffb36b]">{details.eyebrow}</p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-[#f5f0de] sm:text-4xl">
                    {details.title}
                  </h2>
                </div>
                <div className="hidden rounded-full border border-white/10 bg-white/[0.04] p-3 text-[#ff7a1a] lg:block">
                  <details.icon className="h-6 w-6" />
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">{details.copy}</p>

              {mode === "home" ? (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-[#f5f0de] transition hover:bg-white/[0.08]"
                  >
                    Sign in details
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="rounded-full border border-[#ff7a1a] bg-[#ff7a1a] px-5 py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b]"
                  >
                    Register details
                  </button>
                </div>
              ) : (
                <div className="mt-8">
                  <Link
                    href={details.cta}
                    className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a] bg-[#ff7a1a] px-5 py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b]"
                  >
                    {details.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              <p className="mt-6 text-xs uppercase tracking-[0.22em] text-white/30">
                No extra box. Just the flow.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
