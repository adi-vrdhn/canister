"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import { signIn } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");
  const safeRedirect = redirectTarget && redirectTarget.startsWith("/") ? redirectTarget : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        router.replace(safeRedirect);
      }
    });

    return () => unsubscribe();
  }, [router, safeRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push(safeRedirect);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050505] text-[#f5f0de]">
      {/* Full-bleed poster */}
      <img
        src="https://image.tmdb.org/t/p/w780/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg"
        alt="La La Land poster"
        className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
      />

      {/* Base dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Right-side gradient — darkens behind the form so text is readable */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_0%,rgba(5,5,5,0.80)_52%,rgba(5,5,5,0.97)_72%,rgba(5,5,5,0.99)_100%)]" />

      {/* Subtle orange accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(255,122,26,0.10),transparent_35%)]" />

      {/* Credit */}
      <div className="absolute bottom-4 left-5 z-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 select-none">
        Credit: TMDB
      </div>

      {/* Form — floats on the right, centred vertically */}
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-10 lg:justify-end lg:px-0">
        <div className="w-full max-w-sm lg:mr-16 xl:mr-24 2xl:mr-32">

          {/* Brand */}
          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Canisterr logo"
              width={48}
              height={48}
              className="h-12 w-12 rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            />
            <h1 className="text-3xl font-black leading-none text-[#f5f0de] sm:text-4xl">
              Canisterr
            </h1>
          </div>

          <p className="text-sm leading-6 text-white/55">
            Enter your credentials to continue.
          </p>

          <div className="mt-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em]">
            <Link href="/auth/login" className="text-[#ff7a1a]">
              Sign in
            </Link>
            <span className="text-white/20">/</span>
            <Link href="/auth/signup" className="text-white/40 transition hover:text-[#ff7a1a]">
              Create account
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-[#ff7a1a]/20 bg-[#ff7a1a]/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ff7a1a]" />
                <p className="text-sm text-[#f5f0de]">{error}</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/70">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-10 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/70">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-10 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
                  placeholder="Your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#f5f0de] py-3 text-sm font-black text-[#0a0a0a] shadow-[0_8px_24px_rgba(245,240,222,0.12)] transition hover:bg-[#ff7a1a] hover:text-white disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href="/auth/forgot-password" className="font-semibold text-[#ff7a1a] hover:text-[#ff8d3b]">
              Forgot password?
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 font-semibold text-[#f5f0de] backdrop-blur-sm transition hover:border-[#ff7a1a]/45 hover:bg-white/[0.10]"
            >
              Need an account?
              <ArrowRight className="h-4 w-4 text-[#ffb36b]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
