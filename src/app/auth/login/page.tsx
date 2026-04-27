"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock, Mail, ArrowRight } from "lucide-react";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-dvh bg-[#090909] px-4 py-6 text-[#f5f0de] sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between px-0 py-4 lg:px-4 lg:py-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Canisterr logo" width={56} height={56} className="h-14 w-14 rounded-2xl object-cover" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Canisterr</p>
                <h1 className="mt-1 text-3xl font-black leading-none sm:text-5xl">Welcome back for sign in</h1>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#f5f0de]/72 sm:text-lg">
              Sign in to get back to your feed, matcher, lists, and logs. Everything lives in the same brutal black and orange flow.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:max-w-md">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.08]"
            >
              <span>
                <span className="block text-lg font-black text-[#f5f0de]">Register instead</span>
                <span className="block text-sm text-white/55">Happy to have you in register</span>
              </span>
              <ArrowRight className="h-5 w-5 text-[#ffb36b]" />
            </Link>
          </div>
        </section>

        <section className="flex items-center justify-center py-6 lg:px-4 lg:py-8">
          <div className="w-full max-w-xl">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <Image src="/logo.png" alt="Canisterr logo" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ffb36b]">Canisterr</p>
                <p className="text-sm text-white/55">Sign in</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-3 rounded-[1.25rem] border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ffb36b]" />
                  <p className="text-sm text-[#f5f0de]">{error}</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    placeholder="Your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#ff7a1a] py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-5 text-sm text-white/55">
              <Link href="/auth/forgot-password" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                Forgot password?
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
