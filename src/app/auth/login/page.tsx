"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { AlertCircle } from "lucide-react";
import AuthMobileCard from "@/components/AuthMobileCard";


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
    <div className="min-h-screen">
      <div className="px-4 py-6 sm:px-6 md:hidden">
        <AuthMobileCard
          mode="login"
          title="Login"
          subtitle="Welcome back. Pick up your watchlist and posts right where you left them."
          footer={
            <>
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="font-semibold text-blue-600">
                Sign up
              </Link>
            </>
          }
        >
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email or Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="Enter your email or username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="Enter your password"
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-slate-300" />
                Remember for 30 days
              </label>
              <Link href="/auth/forgot-password" className="font-medium text-blue-600">
                Forgot?
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </AuthMobileCard>
      </div>

      {/* Desktop */}
      <div className="hidden min-h-screen md:flex">
        <div className="flex flex-1 flex-col justify-center bg-white px-8 sm:px-16 md:px-24 lg:px-32">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center justify-center mt-12 mb-10">
            <h1 className="brand-wordmark text-4xl font-bold tracking-tight text-zinc-900">Canisterr</h1>
          </div>
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Welcome back</h2>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email or Username</label>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your email or username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your password" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded border-gray-300" />
                Remember for 30 days
              </label>
              <Link href="/auth/forgot-password" className="text-blue-600 hover:underline text-sm font-medium">Forgot password</Link>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow">{loading ? "Signing in..." : "Sign in"}</button>
            {/* Google sign-in removed */}
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-blue-600 hover:underline font-medium">Sign up</Link>
          </div>
        </div>
      </div>
      {/* Right: Image/Quote */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="https://image.tmdb.org/t/p/original/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg"
            alt="La La Land (2016) Poster"
            className="w-4/5 h-4/5 object-cover rounded-3xl shadow-lg"
          />
        </div>
        <div className="absolute bottom-8 left-8 right-8 text-white text-xl font-semibold drop-shadow-lg">
          <span className="bg-black bg-opacity-40 px-4 py-2 rounded-lg">La la land</span>
        </div>
      </div>
      </div>
    </div>
  );
}
