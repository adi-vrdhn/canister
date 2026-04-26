"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signUp, checkUsernameAvailability } from "@/lib/auth";
import { Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react";
import AuthMobileCard from "@/components/AuthMobileCard";

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
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center">
        <AuthMobileCard
          mode="signup"
          title="Register"
          subtitle="Create your Canisterr account."
          footer={
            <>
              Already have an account?{" "}
              <Link href="/auth/login" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                Sign in
              </Link>
            </>
          }
        >
          {verificationSent ? (
            <div className="text-center">
              <h2 className="text-xl font-black text-[#f5f0de] sm:text-2xl">Verify your email</h2>
              <p className="mt-3 text-sm leading-6 text-[#f5f0de]/65">
                A verification link has been sent to <span className="font-semibold text-[#ffb36b]">{email}</span>.
                {" "}You can use the app now, but please verify within 7 days.
              </p>
              <div className="mt-4 flex items-center justify-center gap-4 text-sm font-semibold">
                <Link href="/dashboard" className="text-[#ff7a1a] hover:text-[#ff8d3b]">
                  Continue
                </Link>
                <Link href="/auth/login" className="text-[#ff7a1a] hover:text-[#ff8d3b]">
                  Log in
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ffb36b]" />
                  <p className="text-sm text-[#f5f0de]">{error}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <button
                  type="submit"
                  disabled={loading || !usernameAvailable}
                  className="w-full rounded-2xl bg-[#ff7a1a] py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:opacity-60"
                >
                  {loading ? "Creating account..." : "Sign up"}
                </button>
              </form>
            </>
          )}
        </AuthMobileCard>
      </div>
    </div>
  );
}
