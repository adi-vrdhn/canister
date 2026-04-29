"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import { signIn } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        router.replace("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push("/dashboard");
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
    <div className="min-h-dvh bg-[#050505] text-[#f5f0de]">
      <div className="grid h-full w-full lg:grid-cols-[3fr_2fr]">
        <section className="relative hidden min-h-dvh overflow-hidden border-r border-white/10 bg-[#050505] lg:flex">
          <img
            src="https://image.tmdb.org/t/p/w780/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg"
            alt="La La Land poster"
            className="absolute inset-0 h-full w-full object-contain object-left pointer-events-none select-none"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.35),rgba(0,0,0,0.05)_50%,rgba(0,0,0,0.34))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,122,26,0.14),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.18),transparent_32%)]" />
        </section>

        <section className="flex min-h-dvh items-start justify-start bg-[#0a0a0a] px-5 py-6 sm:px-8 sm:py-8 lg:px-4 lg:py-4">
          <div className="w-full max-w-none">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="Canisterr logo" width={56} height={56} className="h-14 w-14 rounded-2xl object-cover" />
                <div>
                  <h1 className="mt-1 text-4xl font-black leading-none text-[#f5f0de] sm:text-6xl">
                    Canisterr
                  </h1>
                </div>
              </div>
            </div>

            <p className="max-w-lg text-sm leading-7 text-white/60">
              Enter your credentials to continue.
            </p>

            <div className="mt-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em]">
              <Link href="/auth/login" className="text-[#ff7a1a]">
                Sign in
              </Link>
              <span className="text-white/20">/</span>
              <Link href="/auth/signup" className="text-white/40 transition hover:text-[#ff7a1a]">
                Create account
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="flex items-start gap-3 rounded-[1.25rem] border border-[#ff7a1a]/20 bg-[#ff7a1a]/10 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ff7a1a]" />
                  <p className="text-sm text-[#f5f0de]">{error}</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/75">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-[1.25rem] border border-white/10 bg-[#111111] px-10 py-3 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/75">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[1.25rem] border border-white/10 bg-[#111111] px-10 py-3 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    placeholder="Your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[1.25rem] bg-[#f5f0de] py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff7a1a] disabled:opacity-60"
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
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/45 hover:bg-white/[0.08]"
              >
                Need an account?
                <ArrowRight className="h-4 w-4 text-[#ffb36b]" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
