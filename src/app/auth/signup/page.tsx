"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signUp, checkUsernameAvailability } from "@/lib/auth";
import { Mail, Lock, User, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const usernameCheckDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (usernameCheckDebounceRef.current) {
      clearTimeout(usernameCheckDebounceRef.current);
      usernameCheckDebounceRef.current = null;
    }

    if (username.length < 3) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    usernameCheckDebounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(username);
        setUsernameAvailable(available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => {
      if (usernameCheckDebounceRef.current) {
        clearTimeout(usernameCheckDebounceRef.current);
        usernameCheckDebounceRef.current = null;
      }
    };
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions to continue.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!usernameAvailable) {
      setError("Username is not available");
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, username, name);
      setVerificationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
                <h1 className="mt-1 text-3xl font-black leading-none sm:text-5xl">Happy to have you in register</h1>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#f5f0de]/72 sm:text-lg">
              Create your account, choose your username, and start building your taste profile in the black and orange flow.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:max-w-md">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.08]"
            >
              <span>
                <span className="block text-lg font-black text-[#f5f0de]">Sign in instead</span>
                <span className="block text-sm text-white/55">Welcome back for sign in</span>
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
                <p className="text-sm text-white/55">Register</p>
              </div>
            </div>

            {verificationSent ? (
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-[#f5f0de] sm:text-4xl">Verify your email</h2>
                <p className="text-sm leading-7 text-[#f5f0de]/65 sm:text-base">
                  A verification link has been sent to <span className="font-semibold text-[#ffb36b]">{email}</span>.
                  {" "}You can use the app now, but please verify within 7 days.
                </p>
                <div className="flex flex-wrap gap-3 text-sm font-semibold">
                  <Link href="/dashboard" className="rounded-full border border-[#ff7a1a] bg-[#ff7a1a] px-4 py-2.5 text-[#0a0a0a] transition hover:bg-[#ff8d3b]">
                    Continue
                  </Link>
                  <Link href="/auth/login" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[#f5f0de] transition hover:bg-white/[0.08]">
                    Log in
                  </Link>
                </div>
              </div>
            ) : (
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
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@username"
                      minLength={3}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-10 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    />
                    {username.length >= 3 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingUsername ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#ff7a1a]" />
                        ) : usernameAvailable ? (
                          <CheckCircle className="h-5 w-5 text-[#ff7a1a]" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-[#ffb36b]" />
                        )}
                      </div>
                    )}
                  </div>
                  {username.length > 0 && username.length < 3 && (
                    <p className="mt-1 text-xs text-[#f5f0de]/45">At least 3 characters</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-[#f5f0de]/80">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-[#151515] text-[#ff7a1a] accent-[#ff7a1a]"
                  />
                  <span>
                    By clicking I agree to the{" "}
                    <Link href="/terms" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                      terms and conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                      privacy policy
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !usernameAvailable || !agreedToTerms}
                  className="w-full rounded-2xl bg-[#ff7a1a] py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:opacity-60"
                >
                  {loading ? "Creating account..." : "Register"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
