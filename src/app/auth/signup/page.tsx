"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signUp, checkUsernameAvailability } from "@/lib/auth";
import { Mail, Lock, User, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function SignUpPage() {
  const router = useRouter();
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        router.replace("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

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
    <div className="relative min-h-dvh overflow-hidden bg-[#050505] text-[#f5f0de]">
      {/* Full-bleed poster */}
      <img
        src="https://image.tmdb.org/t/p/w780/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg"
        alt="La La Land poster"
        className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
      />

      {/* Base dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Right-side gradient — darkens behind the form */}
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
            Build your profile and start logging films.
          </p>

          <div className="mt-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em]">
            <Link href="/auth/login" className="text-white/40 transition hover:text-[#ff7a1a]">
              Sign in
            </Link>
            <span className="text-white/20">/</span>
            <Link href="/auth/signup" className="text-[#ff7a1a]">
              Create account
            </Link>
          </div>

          {verificationSent ? (
            <div className="mt-8 space-y-4">
              <h2 className="text-2xl font-black text-[#f5f0de]">Verify your email</h2>
              <p className="text-sm leading-7 text-white/60">
                A verification link has been sent to{" "}
                <span className="font-semibold text-[#ffb36b]">{email}</span>.
                {" "}You can use the app now, but please verify within 7 days.
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-[#ff7a1a] bg-[#ff7a1a] px-4 py-2.5 text-[#0a0a0a] transition hover:bg-[#ff8d3b]"
                >
                  Continue
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[#f5f0de] backdrop-blur-sm transition hover:bg-white/[0.10]"
                >
                  Log in
                </Link>
              </div>
            </div>
          ) : (
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
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-10 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/70">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@username"
                    minLength={3}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-10 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
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
                <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/70">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/70">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-10 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]/70">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-10 py-3 text-sm text-[#f5f0de] outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-[#ff7a1a]/50 focus:bg-white/[0.10] focus:ring-2 focus:ring-[#ff7a1a]/15"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-6 text-[#f5f0de]/80 backdrop-blur-sm">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.07] text-[#ff7a1a] accent-[#ff7a1a]"
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
                className="w-full rounded-2xl bg-[#f5f0de] py-3 text-sm font-black text-[#0a0a0a] shadow-[0_8px_24px_rgba(245,240,222,0.12)] transition hover:bg-[#ff7a1a] hover:text-white disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href="/auth/login" className="font-semibold text-[#ff7a1a] hover:text-[#ff8d3b]">
              Already have an account?
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 font-semibold text-[#f5f0de] backdrop-blur-sm transition hover:border-[#ff7a1a]/45 hover:bg-white/[0.10]"
            >
              Sign in
              <ArrowRight className="h-4 w-4 text-[#ffb36b]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
