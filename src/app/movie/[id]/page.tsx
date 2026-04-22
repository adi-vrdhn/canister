"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import AddToListModal from "@/components/AddToListModal";
import LogMovieModal from "@/components/LogMovieModal";
import CinematicLoading from "@/components/CinematicLoading";
import ContentCinePosts from "@/components/ContentCinePosts";
import { User, Movie, MovieReviewWithUser, Content, MovieLog, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push, set } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails, getSimilarMovies } from "@/lib/tmdb";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { getLogsForContent } from "@/lib/logs";
import { ArrowLeft, Share2, MessageCircle, Bookmark, LogsIcon, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

function formatReleaseYear(releaseDate: string | null | undefined): string {
  if (!releaseDate) return "";
  const year = new Date(releaseDate).getFullYear();
  return Number.isNaN(year) ? releaseDate : String(year);
}

function formatRuntime(runtime: number | null | undefined): string {
  if (!runtime) return "";
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function getReactionLabelFromRating(rating: number): "Bad" | "Good" | "Masterpiece" {
  if (rating >= 5) return "Masterpiece";
  if (rating >= 3) return "Good";
  return "Bad";
}

function getReactionLabelFromLogReaction(reaction: 0 | 1 | 2): "Bad" | "Good" | "Masterpiece" {
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1) return "Good";
  return "Bad";
}

function getReactionBadgeClassFromLabel(label: "Bad" | "Good" | "Masterpiece"): string {
  if (label === "Masterpiece") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  if (label === "Good") return "bg-blue-500/20 text-blue-300 border-blue-400/30";
  return "bg-rose-500/20 text-rose-300 border-rose-400/30";
}

function getReactionBadgeClass(rating: number): string {
  const label = getReactionLabelFromRating(rating);
  return getReactionBadgeClassFromLabel(label);
}

export default function MoviePage() {
  const router = useRouter();
  const params = useParams();
  const movieId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [reviews, setReviews] = useState<MovieReviewWithUser[]>([]);
  const [appAvgRating, setAppAvgRating] = useState<number>(0);
  const [friendsAvgRating, setFriendsAvgRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [friendsWhoWatched, setFriendsWhoWatched] = useState<User[]>([]);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [reactionBreakdown, setReactionBreakdown] = useState({ bad: 0, good: 0, masterpiece: 0, total: 0 });
  const [userLogHistory, setUserLogHistory] = useState<MovieLog[]>([]);
  const [friendLogs, setFriendLogs] = useState<MovieLogWithContent[]>([]);
  const [allLogs, setAllLogs] = useState<MovieLogWithContent[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const loadMovieLogData = async (currentUserId: string) => {
    const numericMovieId = Number(movieId);
    if (!numericMovieId || Number.isNaN(numericMovieId)) {
      setReactionBreakdown({ bad: 0, good: 0, masterpiece: 0, total: 0 });
      setUserLogHistory([]);
      return;
    }

    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) {
      setReactionBreakdown({ bad: 0, good: 0, masterpiece: 0, total: 0 });
      setUserLogHistory([]);
      return;
    }

    const allLogs = logsSnapshot.val();
    const movieLogs = Object.values(allLogs).filter(
      (log: any) =>
        log.content_id === numericMovieId &&
        log.content_type === "movie" &&
        !log.watch_later
    ) as MovieLog[];

    const bad = movieLogs.filter((log) => log.reaction === 0).length;
    const good = movieLogs.filter((log) => log.reaction === 1).length;
    const masterpiece = movieLogs.filter((log) => log.reaction === 2).length;
    const total = bad + good + masterpiece;

    setReactionBreakdown({ bad, good, masterpiece, total });

    const history = movieLogs
      .filter((log) => log.user_id === currentUserId)
      .sort((a, b) => {
        const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
        if (watchedDiff !== 0) return watchedDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    setUserLogHistory(history);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch current user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        // Fetch movie details from TMDB
        if (movieId && !isNaN(Number(movieId))) {
          const movieDetails = await getMovieDetails(Number(movieId));
          if (movieDetails) {
            setMovie({ ...movieDetails, created_at: new Date().toISOString() } as Movie);
            const similar = await getSimilarMovies(Number(movieId), 6);
            setSimilarMovies(similar as Movie[]);
          }
        }

        // Fetch ratings for this movie
        const ratingsRef = ref(db, `ratings`);
        const ratingsSnapshot = await get(ratingsRef);
        if (ratingsSnapshot.exists()) {
          const allRatings = ratingsSnapshot.val();
          const movieRatings = Object.entries(allRatings)
            .filter(([_, rating]: any) => rating.content_id === Number(movieId))
            .map(([_, rating]: any) => rating);

          // Calculate average rating
          if (movieRatings.length > 0) {
            const avgRating = movieRatings.reduce((sum: number, rating: any) => sum + rating.rating, 0) / movieRatings.length;
            setAppAvgRating(Number(avgRating.toFixed(1)));
            setTotalRatings(movieRatings.length);
          }

          // Find user's rating
          const myRating = movieRatings.find((r: any) => r.user_id === currentUser.id);
          if (myRating) {
            setUserRating(myRating.rating);
          }
        }

        // Fetch reviews from both explicit reviews table and movie log notes.
        const mergedReviews = await getMovieReviewFeed(Number(movieId), "movie");
        setReviews(mergedReviews);

        // Fetch reaction breakdown + current user's log history for this movie
        await loadMovieLogData(currentUser.id);

        // Fetch all logs for this movie (to show friends' logs)
        let logs = await getLogsForContent(Number(movieId), "movie", 100);
        // Only keep the latest log per user
        const latestLogByUser = new Map();
        logs.forEach((log) => {
          if (!latestLogByUser.has(log.user_id) || new Date(log.created_at) > new Date(latestLogByUser.get(log.user_id).created_at)) {
            latestLogByUser.set(log.user_id, log);
          }
        });
        logs = Array.from(latestLogByUser.values());
        // Show only friends (not self)
        const friendLogsFiltered = logs.filter(l => l.user_id !== currentUser.id);
        setFriendLogs(friendLogsFiltered);
        setAllLogs(logs);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching movie details:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [movieId, router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleRateMovie = async (rating: number) => {
    if (!user || !movie) return;

    try {
      const ratingsRef = ref(db, `ratings`);
      const ratingsSnapshot = await get(ratingsRef);
      const allRatings = ratingsSnapshot.val() || {};

      // Check if user already rated this movie
      const existingRating = Object.entries(allRatings).find(
        ([_, r]: any) => r.user_id === user.id && r.content_id === movie.id
      );

      if (existingRating) {
        // Update existing rating
        const ratingRef = ref(db, `ratings/${existingRating[0]}`);
        await set(ratingRef, {
          id: existingRating[0],
          user_id: user.id,
          content_id: movie.id,
          content_type: "movie",
          rating,
          created_at: new Date().toISOString(),
        });
      } else {
        // Create new rating
        await push(ratingsRef, {
          user_id: user.id,
          content_id: movie.id,
          content_type: "movie",
          rating,
          created_at: new Date().toISOString(),
        });
      }

      setUserRating(rating);
    } catch (error) {
      console.error("Error rating movie:", error);
    }
  };

  if (loading || !user) {
    return <CinematicLoading message="Your movie page is loading" />;
  }

  if (!movie) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="p-8 text-center">
          <p className="text-gray-600 text-lg">Movie not found</p>
          <Link href="/dashboard" className="text-blue-600 mt-4 inline-block">
            Back to Home
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="min-h-screen bg-neutral-950 text-white">
        <section className="relative overflow-hidden px-4 pb-10 pt-4 lg:hidden">
          <div className="absolute inset-0">
            {(movie.backdrop_url || movie.poster_url) ? (
              <img
                src={movie.backdrop_url || movie.poster_url || ""}
                alt={movie.title}
                className="h-full w-full scale-110 object-cover opacity-65 blur-[2px]"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-rose-950 via-neutral-950 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-neutral-950" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_34%)]" />
          </div>

          <div className="relative z-10">
            <button
              onClick={() => router.back()}
              className="mb-5 inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur-md"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="rounded-[2rem] border border-white/15 bg-black/35 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
              {movie.poster_url && (
                <div className="mx-auto mb-5 w-full max-w-[19rem] overflow-hidden rounded-[1.6rem] border border-white/15 bg-white/10 shadow-2xl">
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              )}

              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Movie</p>
              <h1 className="text-4xl font-black leading-none tracking-tight text-white">
                {movie.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-white/80">
                {movie.release_date && <span className="rounded-full bg-white/10 px-3 py-1">{formatReleaseYear(movie.release_date)}</span>}
                {movie.runtime && <span className="rounded-full bg-white/10 px-3 py-1">{formatRuntime(movie.runtime)}</span>}
                {movie.language && <span className="rounded-full bg-white/10 px-3 py-1">{movie.language.toUpperCase()}</span>}
              </div>

              {movie.overview && (
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-white/82">
                  {movie.overview}
                </p>
              )}

              <div className="mt-5 grid gap-2.5">
                <button
                  onClick={() => setShowLogMovieModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-emerald-950/30"
                >
                  <LogsIcon className="h-4 w-4" />
                  Log Movie
                </button>
                <button
                  onClick={() => router.push(`/share?movie_id=${movie.id}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button
                  onClick={() => setShowAddToListModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 py-3 text-sm font-bold text-white backdrop-blur"
                >
                  <Bookmark className="h-4 w-4" />
                  Add to List
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[2rem] border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Rating Distribution</h2>
                <span className="text-xs text-white/55">{reactionBreakdown.total} logs</span>
              </div>
              {[
                { label: "Bad", value: reactionBreakdown.bad, color: "bg-rose-400" },
                { label: "Good", value: reactionBreakdown.good, color: "bg-blue-400" },
                { label: "Masterpiece", value: reactionBreakdown.masterpiece, color: "bg-emerald-400" },
              ].map((item) => {
                const percent = reactionBreakdown.total > 0 ? Math.round((item.value / reactionBreakdown.total) * 100) : 0;
                return (
                  <div key={item.label} className="mb-3 last:mb-0">
                    <div className="mb-1.5 flex justify-between text-xs text-white/75">
                      <span>{item.label}</span>
                      <span>{item.value} ({percent}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Director</p>
                <p className="mt-2 line-clamp-2 text-sm font-bold">{movie.director || "Unknown"}</p>
              </div>
              <Link
                href={`/movie/${movie.id}/reviews`}
                className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-md"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Reviews</p>
                <p className="mt-2 text-sm font-bold">{reviews.length} comments</p>
              </Link>
            </div>
          </div>
        </section>

        <div className="hidden lg:block">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0">
            {movie.backdrop_url ? (
              <img
                src={movie.backdrop_url}
                alt={movie.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/15" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-950 to-transparent" />
          </div>

          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-10 md:pt-14 pb-16">
            <div className="flex items-center justify-between gap-4 mb-10">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-4 py-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>

              <div />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start pt-24 md:pt-32">
              <div className="space-y-4">
                {movie.poster_url && (
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="w-full max-w-[280px] rounded-2xl shadow-2xl border border-white/10"
                  />
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => setShowLogMovieModal(true)}
                    className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 py-2.5 font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <LogsIcon className="w-4 h-4" />
                    Log Movie
                  </button>
                  <button
                    onClick={() => router.push(`/share?movie_id=${movie.id}`)}
                    className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 text-neutral-950 py-2.5 font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button
                    onClick={() => setShowAddToListModal(true)}
                    className="w-full rounded-lg bg-white/10 hover:bg-white/15 backdrop-blur-md py-2.5 font-semibold transition-colors flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Bookmark className="w-4 h-4" />
                    Add to List
                  </button>
                </div>

                <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 p-4 space-y-4 text-sm text-white/85">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">Community Reactions</p>
                    <p className="text-xs text-white/60">{reactionBreakdown.total} logs</p>
                  </div>

                  {[
                    { label: "Bad", value: reactionBreakdown.bad, color: "bg-rose-500" },
                    { label: "Good", value: reactionBreakdown.good, color: "bg-blue-500" },
                    { label: "Masterpiece", value: reactionBreakdown.masterpiece, color: "bg-emerald-500" },
                  ].map((item) => {
                    const percent = reactionBreakdown.total > 0 ? Math.round((item.value / reactionBreakdown.total) * 100) : 0;
                    return (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/80">{item.label}</span>
                          <span className="text-white/70">{item.value} ({percent}%)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                          <div
                            className={`h-full ${item.color} transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-white/60 text-sm tracking-[0.2em] uppercase mb-2">Movie</p>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none">
                      {movie.title}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/80">
                      {movie.release_date && <span>{formatReleaseYear(movie.release_date)}</span>}
                      {movie.runtime && <span>• {formatRuntime(movie.runtime)}</span>}
                      {movie.language && <span>• {movie.language.toUpperCase()}</span>}
                    </div>
                  </div>

                  <p className="max-w-3xl text-base md:text-lg text-white/85 leading-7">
                    {movie.overview}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Director</p>
                    <p className="font-semibold text-lg">{movie.director || "Unknown"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Genres</p>
                    <div className="flex flex-wrap gap-2">
                      {(movie.genres || []).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full bg-white/10 px-3 py-1 text-sm border border-white/10"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Cast
                      </h2>
                      {movie.actors && movie.actors.length > 0 && movie.actors.length > 6 && (
                        <a href="#cast-list-section" className="text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
                          View more <ChevronRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(movie.actors || []).slice(0, 6).map((actor) => (
                        <div key={actor} className="rounded-xl bg-white/5 px-3 py-2 border border-white/10">
                          <p className="font-medium">{actor}</p>
                        </div>
                      ))}
                      {(!movie.actors || movie.actors.length === 0) && (
                        <p className="text-white/60 text-sm">No cast data available.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        Similar Movies
                      </h2>
                      <a href="#similar-movies-section" className="text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
                        View more <ChevronRight className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {similarMovies.slice(0, 2).map((similarMovie) => (
                        <Link key={similarMovie.id} href={`/movie/${similarMovie.id}`} className="block">
                          <div className="h-28 w-full rounded-xl overflow-hidden border border-white/10">
                            {similarMovie.poster_url ? (
                              <img
                                src={similarMovie.poster_url}
                                alt={similarMovie.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-white/10" />
                            )}
                          </div>
                          <p className="text-xs text-white/80 mt-2 line-clamp-1">{similarMovie.title}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-neutral-950 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
            <div>
              <h2 className="text-2xl font-bold mb-5">Your Log History</h2>
              {userLogHistory.length > 0 ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
                  {userLogHistory.map((log) => {
                    const label = getReactionLabelFromLogReaction(log.reaction);
                    return (
                      <div key={log.id} className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                          <p className="text-sm text-white/70">
                            Watched on {new Date(log.watched_date).toLocaleDateString()}
                          </p>
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${getReactionBadgeClassFromLabel(label)}`}>
                            {label}
                          </span>
                        </div>
                        {log.notes?.trim() ? (
                          <p className="text-white/85 leading-7">{log.notes}</p>
                        ) : (
                          <p className="text-white/50 text-sm">No review text for this log.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center text-white/60">
                  You have not logged this movie yet.
                </div>
              )}

              {/* Friends' logs row */}
              {friendLogs.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-3">Friends who logged this movie</h3>
                  <div className="flex flex-wrap gap-4">
                    {friendLogs.map((log) => {
                      const label = getReactionLabelFromLogReaction(log.reaction);
                      return (
                        <div key={log.id} className="flex flex-col items-center cursor-pointer group" onClick={() => router.push(`/logs/${log.id}`)} title={`View ${log.user.name}'s log`}>
                          <div className="relative flex flex-col items-center">
                            {log.user.avatar_url ? (
                              <img src={log.user.avatar_url} alt={log.user.name} className="w-12 h-12 rounded-full border-2 border-white group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold text-white border-2 border-white">
                                {log.user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className={`mt-2 text-xs px-2 py-0.5 rounded-full border block ${getReactionBadgeClassFromLabel(label)}`}>{label}</span>
                          </div>
                          <span className="mt-2 text-xs text-white/80 group-hover:underline">{log.user.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All logs expandable section */}
              {allLogs.length > 0 && (
                <div className="mt-10">
                  <button
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition mb-4"
                    onClick={() => setShowAllLogs((v) => !v)}
                  >
                    {showAllLogs ? "Hide log history" : `Show log history (${allLogs.length})`}
                  </button>
                  {showAllLogs && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
                      {allLogs.map((log) => {
                        const label = getReactionLabelFromLogReaction(log.reaction);
                        return (
                          <div key={log.id} className="flex items-center gap-4 p-4 sm:p-5">
                            <div className="flex flex-col items-center cursor-pointer" onClick={() => router.push(`/logs/${log.id}`)} title={`View ${log.user.name}'s log`}>
                              {log.user.avatar_url ? (
                                <img src={log.user.avatar_url} alt={log.user.name} className="w-10 h-10 rounded-full border-2 border-white" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-base font-bold text-white border-2 border-white">
                                  {log.user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border block ${getReactionBadgeClassFromLabel(label)}`}>{label}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-white/90 cursor-pointer hover:underline" onClick={() => router.push(`/logs/${log.id}`)}>{log.user.name}</span>
                              {log.notes && (
                                <p className="text-white/80 mt-1 line-clamp-3">{log.notes}</p>
                              )}
                            </div>
                            <button
                              className="ml-2 px-3 py-1 rounded border border-white/20 text-xs text-white/70 hover:bg-white/10"
                              onClick={() => router.push(`/logs/${log.id}`)}
                            >
                              View Log
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-5">
                <MessageCircle className="w-6 h-6" />
                Reviews & Comments ({reviews.length})
              </h2>
              <div className="mb-5">
                <Link
                  href={`/movie/${movie.id}/reviews`}
                  className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
                >
                  View all reviews
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {reviews.length > 0 ? (
                <div className="grid gap-4">
                  {reviews.slice(0, 3).map((review) => (
                    <div
                      key={review.id}
                      className="rounded-2xl bg-white/5 border border-white/10 p-5"
                    >
                      <div className="flex items-start justify-between mb-3 gap-4">
                        <div>
                          <p className="font-semibold text-white">{review.user.name}</p>
                          <p className="text-sm text-white/50">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${getReactionBadgeClass(review.rating)}`}>
                          {getReactionLabelFromRating(review.rating)}
                        </span>
                      </div>
                      <p className="text-white/80 leading-7">{review.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center text-white/60">
                  No reviews yet. Be the first to review.
                </div>
              )}
            </div>

            <div>
              <div id="cast-list-section" className="flex items-center justify-between mb-5 scroll-mt-24">
                <h2 className="text-2xl font-bold">Cast List</h2>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 max-h-72 overflow-y-auto divide-y divide-white/10">
                {(movie.actors || []).length > 0 ? (
                  (movie.actors || []).map((actor, idx) => (
                    <div key={actor} className="px-4 py-3 flex items-center justify-between">
                      <p className="text-white/85">{actor}</p>
                      <p className="text-xs text-white/50">#{idx + 1}</p>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-6 text-white/60">No cast data available.</p>
                )}
              </div>
            </div>

            <div>
              <div id="similar-movies-section" className="flex items-center justify-between mb-5 scroll-mt-24">
                <h2 className="text-2xl font-bold">Similar Movies</h2>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 max-h-[520px] overflow-y-auto divide-y divide-white/10">
                {similarMovies.map((similarMovie) => (
                  <Link key={similarMovie.id} href={`/movie/${similarMovie.id}`} className="block hover:bg-white/5 transition-colors">
                    <div className="p-4 flex items-center gap-4">
                      <div className="h-24 w-16 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                        {similarMovie.poster_url ? (
                          <img
                            src={similarMovie.poster_url}
                            alt={similarMovie.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-white/10" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white line-clamp-1">{similarMovie.title}</p>
                        <p className="text-sm text-white/60 mt-1 line-clamp-2">{similarMovie.overview || "No overview available."}</p>
                        <p className="text-xs text-white/50 mt-2">{formatReleaseYear(similarMovie.release_date)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/50 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>

      </div>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        <ContentCinePosts contentId={movie.id} contentType="movie" currentUser={user} />
      </div>

      {/* Add to List Modal */}
      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        content={movie as Content}
        user={user}
      />

      {/* Log Movie Modal */}
      <LogMovieModal
        isOpen={showLogMovieModal}
        onClose={() => setShowLogMovieModal(false)}
        content={movie as Content}
        user={user}
        onLogCreated={() => {
          if (!user) return;
          void loadMovieLogData(user.id);
        }}
      />
    </PageLayout>
  );
}
