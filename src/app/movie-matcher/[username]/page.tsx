"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, BarChart3, Clock, Flame, Sparkles, Users } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { getFullTasteProfile } from "@/lib/friends-match";
import { generateMatchAnalysis } from "@/lib/match-score";
import { getUserByUsername } from "@/lib/profile";
import CinematicLoading from "@/components/CinematicLoading";
import type { User } from "@/types";

export default function MovieMatcherReportPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        hardRedirect("/auth/login");
        return;
      }

      try {
        const currentUserRef = ref(db, `users/${firebaseUser.uid}`);
        const currentUserSnapshot = await get(currentUserRef);
        if (!currentUserSnapshot.exists()) {
          hardRedirect("/profile/edit");
          return;
        }

        const currentUserData = currentUserSnapshot.val();
        const currentUserProfile: User = {
          id: currentUserData?.id || firebaseUser.uid,
          username: currentUserData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: currentUserData?.name || firebaseUser.displayName || "User",
          email: currentUserData?.email || firebaseUser.email || undefined,
          avatar_url: currentUserData?.avatar_url || null,
          created_at: currentUserData?.createdAt || new Date().toISOString(),
          bio: currentUserData?.bio || "",
        };

        const viewedProfile = await getUserByUsername(username);
        if (!viewedProfile) {
          hardRedirect("/dashboard");
          return;
        }

        const [currentTastes, viewedTastes] = await Promise.all([
          getFullTasteProfile(currentUserProfile.id),
          getFullTasteProfile(viewedProfile.id),
        ]);

        const report = await generateMatchAnalysis(
          currentTastes,
          viewedTastes,
          currentUserProfile.id,
          viewedProfile.id
        );

        setCurrentUser(currentUserProfile);
        setProfileUser(viewedProfile);
        setAnalysis(report);
      } catch (error) {
        console.error("Error loading match report:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username]);

  if (loading || !currentUser || !profileUser || !analysis) {
    return <CinematicLoading message="Your match report is loading" />;
  }

  const commonTasteMovies = analysis.commonTasteMovies || [];
  const commonMasterpieceMovies = analysis.commonMasterpieceMovies || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <button
          onClick={() => router.push(`/profile/${profileUser.username}`)}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100 sm:mb-5 sm:px-4 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </button>

        <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                  Movie Match Report
                </h1>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                Full taste report between <span className="font-semibold text-zinc-900">{currentUser.name}</span> and <span className="font-semibold text-zinc-900">{profileUser.name}</span>.
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Match Score</p>
              <p className="text-2xl font-bold text-indigo-900">{analysis.totalScore}%</p>
            </div>
          </div>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
              <BarChart3 className="h-4 w-4 text-sky-600" />
              Shared Movies
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900 sm:mt-3 sm:text-3xl">{analysis.commonTasteMovieCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
              <Flame className="h-4 w-4 text-amber-600" />
              Both Loved
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900 sm:mt-3 sm:text-3xl">{analysis.commonMasterpieceMovieCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
              <Users className="h-4 w-4 text-violet-600" />
              Shared Genres
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900 sm:mt-3 sm:text-3xl">{analysis.sharedGenres?.length || 0}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
              <Clock className="h-4 w-4 text-emerald-600" />
              Avg Year Gap
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900 sm:mt-3 sm:text-3xl">
              {Math.abs((analysis.avgYearA || 0) - (analysis.avgYearB || 0))}
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h2 className="text-lg font-bold text-zinc-900">Taste Insight</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{analysis.tasteInsight}</p>
              <p className="mt-3 text-sm text-zinc-600">
                Blend personality: <span className="font-semibold text-zinc-900">{analysis.blendPersonality}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <h2 className="text-lg font-bold text-zinc-900">Preferences</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs text-zinc-600">Your Avg Movie Year</p>
                  <p className="mt-1 text-xl font-bold text-amber-700 sm:text-2xl">{analysis.avgYearA}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs text-zinc-600">{profileUser.name}&apos;s Avg Year</p>
                  <p className="mt-1 text-xl font-bold text-amber-700 sm:text-2xl">{analysis.avgYearB}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-zinc-700 mb-2">Shared Languages</p>
                {analysis.sharedLanguages?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.sharedLanguages.map((language: string) => (
                      <span key={language} className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        {language}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No shared languages detected yet.</p>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-zinc-700 mb-2">Shared Genres</p>
                {analysis.sharedGenres?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.sharedGenres.map((genre: string) => (
                      <span key={genre} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                        {genre}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No shared genres detected yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <h2 className="text-lg font-bold text-zinc-900">Quick Links</h2>
              <div className="mt-4 grid gap-3">
                <Link
                  href={`/profile/${profileUser.username}/shared-movies`}
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                >
                  Open shared movies list
                </Link>
                <Link
                  href={`/profile/${profileUser.username}`}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-gray-100"
                >
                  Back to profile
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <h2 className="text-lg font-bold text-zinc-900">Common Watching</h2>
              <div className="mt-4 space-y-5">
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm font-semibold text-sky-800">
                    Your Taste Overlap <span className="text-xs text-sky-600">({analysis.commonTasteMovieCount})</span>
                  </p>
                  {commonTasteMovies.length > 0 ? (
                    <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                      {commonTasteMovies.map((movie: any) => (
                        <Link
                          key={`taste-${movie.type}-${movie.id}`}
                          href={movie.type === "movie" ? `/movie/${movie.id}` : `/tv/${movie.id}`}
                          className="group flex-shrink-0"
                        >
                          <div className="w-20 overflow-hidden rounded-xl bg-gray-200 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:w-24">
                            {movie.poster_url ? (
                              <img
                                src={movie.poster_url}
                                alt={movie.title}
                                className="aspect-[2/3] w-full object-cover"
                              />
                            ) : (
                              <div className="aspect-[2/3] w-full flex items-center justify-center text-xs text-zinc-500">
                                No poster
                              </div>
                            )}
                          </div>
                          <p className="mt-2 w-20 text-xs font-medium text-zinc-700 line-clamp-2 sm:w-24">{movie.title}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No shared titles yet.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">
                    Both Loved <span className="text-xs text-amber-600">({analysis.commonMasterpieceMovieCount})</span>
                  </p>
                  {commonMasterpieceMovies.length > 0 ? (
                    <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                      {commonMasterpieceMovies.map((movie: any) => (
                        <Link
                          key={`masterpiece-${movie.type}-${movie.id}`}
                          href={movie.type === "movie" ? `/movie/${movie.id}` : `/tv/${movie.id}`}
                          className="group flex-shrink-0"
                        >
                          <div className="w-20 overflow-hidden rounded-xl bg-gray-200 shadow-sm ring-2 ring-amber-400 transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:w-24">
                            {movie.poster_url ? (
                              <img
                                src={movie.poster_url}
                                alt={movie.title}
                                className="aspect-[2/3] w-full object-cover"
                              />
                            ) : (
                              <div className="aspect-[2/3] w-full flex items-center justify-center text-xs text-zinc-500">
                                No poster
                              </div>
                            )}
                          </div>
                          <p className="mt-2 w-20 text-xs font-medium text-zinc-700 line-clamp-2 sm:w-24">{movie.title}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No shared masterpieces yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
