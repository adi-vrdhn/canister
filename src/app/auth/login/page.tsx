"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Lock, Mail } from "lucide-react";
import AuthMobileCard from "@/components/AuthMobileCard";
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
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center">
        <AuthMobileCard
          mode="login"
          title="Sign in"
          subtitle="Use your email or username to continue."
          footer={
            <>
              <Link href="/auth/forgot-password" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                Forgot password?
              </Link>
            </>
          }
        >
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ffb36b]" />
              <p className="text-sm text-[#f5f0de]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                  placeholder="you@example.com or @username"
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
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </AuthMobileCard>
      </div>
    </div>
  );
}
