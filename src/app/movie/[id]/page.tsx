"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useParams, usePathname, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import TopActionBanner from "@/components/TopActionBanner";
import AddToListModal from "@/components/AddToListModal";
import LogMovieModal from "@/components/LogMovieModal";
import CinematicLoading from "@/components/CinematicLoading";
import ContentCinePosts from "@/components/ContentCinePosts";
import { User, Movie, MovieReviewWithUser, Content, MovieLog, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails } from "@/lib/tmdb";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { getLogsForContent } from "@/lib/logs";
import { buildLogUrl } from "@/lib/log-url";
import {
  ArrowLeft,
  Share2,
  Bookmark,
  LogsIcon,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

type MovieCreditPerson = {
  id: number;
  name: string;
  profile_url: string | null;
  job?: string | null;
  character?: string | null;
  department?: string | null;
};

type MovieDetails = Movie & {
  cast_details?: MovieCreditPerson[];
  crew_details?: MovieCreditPerson[];
};

type MovieDetailTab = "cast" | "crew" | "reviews" | "posts";

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
  if (label === "Good") return "bg-blue-500/20 text-[#f5f0de] border-blue-400/30";
  return "bg-rose-500/20 text-rose-300 border-rose-400/30";
}

function getReactionBadgeClass(rating: number): string {
  const label = getReactionLabelFromRating(rating);
  return getReactionBadgeClassFromLabel(label);
}

function getMovieMetaParts(movie: Movie | null): string[] {
  if (!movie) return [];

  const parts: string[] = [];
  if (movie.release_date) parts.push(formatReleaseYear(movie.release_date));
  if (movie.runtime) parts.push(formatRuntime(movie.runtime));
  if (movie.language) parts.push(movie.language.toUpperCase());
  if (movie.genres?.length) parts.push(movie.genres.slice(0, 4).join(", "));
  return parts.filter(Boolean);
}

function getCrewBuckets(crew: MovieCreditPerson[]) {
  const buckets = {
    Directors: crew.filter((person) => person.job === "Director"),
    Producers: crew.filter((person) => ["Producer", "Executive Producer", "Co-Producer"].includes(person.job || "")),
    Cinematography: crew.filter((person) => ["Cinematography", "Director of Photography"].includes(person.job || "")),
    Editing: crew.filter((person) => person.job === "Editor"),
    Music: crew.filter((person) => ["Original Music Composer", "Music"].includes(person.job || "")),
  };

  return Object.entries(buckets).filter(([, people]) => people.length > 0);
}

export default function MoviePage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const movieId = params.id;
  const searchParamsString = searchParams.toString();
  const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;
  const isScanLogFlow = searchParams.get("log") === "1" && searchParams.get("from") === "scan";
  const autoOpenScanLogRef = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<MovieReviewWithUser[]>([]);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);
  const [showScanThanksModal, setShowScanThanksModal] = useState(false);
  const [reactionBreakdown, setReactionBreakdown] = useState({ bad: 0, good: 0, masterpiece: 0, total: 0 });
  const [friendLogs, setFriendLogs] = useState<MovieLogWithContent[]>([]);
  const [allLogs, setAllLogs] = useState<MovieLogWithContent[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<MovieDetailTab>("cast");
  const [showAllCast, setShowAllCast] = useState(false);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());

  const loadMovieLogData = async () => {
    const numericMovieId = Number(movieId);
    if (!numericMovieId || Number.isNaN(numericMovieId)) {
      setReactionBreakdown({ bad: 0, good: 0, masterpiece: 0, total: 0 });
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }

    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) {
      setReactionBreakdown({ bad: 0, good: 0, masterpiece: 0, total: 0 });
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }

    const allLogs = logsSnapshot.val();
    const movieLogs = Object.values(allLogs).filter(
      (log: any) =>
        Number(log.content_id) === numericMovieId &&
        log.content_type === "movie" &&
        !log.watch_later &&
        Boolean(log.watched_date)
    ) as MovieLog[];

    const bad = movieLogs.filter((log) => log.reaction === 0).length;
    const good = movieLogs.filter((log) => log.reaction === 1).length;
    const masterpiece = movieLogs.filter((log) => log.reaction === 2).length;
    const total = bad + good + masterpiece;

    setReactionBreakdown({ bad, good, masterpiece, total });
  };

  useEffect(() => {
    if (!bannerMessage) return;

    const timer = window.setTimeout(() => {
      setBannerMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
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
            setMovie({ ...movieDetails, created_at: new Date().toISOString() } as MovieDetails);
          }
        }

        // Fetch reviews from both explicit reviews table and movie log notes.
        const mergedReviews = await getMovieReviewFeed(Number(movieId), "movie");
        setReviews(mergedReviews);

        // Fetch reaction breakdown for this movie
        await loadMovieLogData();

        // Fetch all logs for this movie (to show friends' logs)
        let logs = await getLogsForContent(Number(movieId), "movie", 100);
        logs = logs.filter(
          (log) =>
            Number(log.content_id) === Number(movieId) &&
            log.content_type === "movie" &&
            !log.watch_later &&
            Boolean(log.watched_date)
        );
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
  }, [currentUrl, movieId, router]);

  useEffect(() => {
    if (!isScanLogFlow) {
      autoOpenScanLogRef.current = false;
      return;
    }

    if (loading || !movie || !user || autoOpenScanLogRef.current) {
      return;
    }

    autoOpenScanLogRef.current = true;
    const timer = window.setTimeout(() => {
      setShowLogMovieModal(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isScanLogFlow, loading, movie, user]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const movieMetaParts = useMemo(() => getMovieMetaParts(movie), [movie]);
  const castPeople = useMemo(() => movie?.cast_details || [], [movie]);
  const visibleCastPeople = showAllCast ? castPeople : castPeople.slice(0, 10);
  const crewBuckets = useMemo(() => getCrewBuckets(movie?.crew_details || []), [movie]);

  const toggleReviewExpanded = (reviewId: string) => {
    setExpandedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  };

  const renderCastCard = (person: MovieCreditPerson) => (
    <div
      key={person.id}
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left"
    >
      <div className="overflow-hidden rounded-xl bg-white/5">
        {person.profile_url ? (
          <img src={person.profile_url} alt={person.name} className="aspect-[3/4] w-full object-cover" />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-white/10 text-2xl font-black text-white/30">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-semibold text-[#f5f0de]">{person.name}</p>
        {person.character && <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">{person.character}</p>}
      </div>
    </div>
  );

  if (loading || !user) {
    return <CinematicLoading message="Your movie page is loading" />;
  }

  if (!movie) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="p-8 text-center">
          <p className="text-gray-600 text-lg">Movie not found</p>
          <Link href="/dashboard" className="text-[#f5f0de] mt-4 inline-block">
            Back to Home
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} fullWidth>
      <TopActionBanner message={bannerMessage} />
      <div className="min-h-screen bg-black text-white">
        <section className="relative overflow-hidden px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,138,30,0.18),_transparent_34%),radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.05),_transparent_22%)]" />

          <div className="relative z-10 mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between gap-3">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:border-[#ff8a1e]/40 hover:bg-[#ff8a1e]/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <span className="rounded-full border border-[#ff8a1e]/30 bg-[#ff8a1e]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ffb36b]">
                Now Playing
              </span>
            </div>

            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              {movie.poster_url && (
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_80px_rgba(0,0,0,0.55)] w-[7.5rem] sm:w-[9rem] lg:w-[10.5rem]">
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              )}

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
                Movie
              </p>
              <h1 className="mt-2 text-3xl font-black leading-[0.95] tracking-tight text-[#f5f0de] sm:text-5xl lg:text-6xl">
                {movie.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-medium text-white/70">
                {movieMetaParts.map((part, index) => (
                  <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                    {index > 0 && <span className="text-white/30">•</span>}
                    <span>{part}</span>
                  </span>
                ))}
              </div>

              {movie.overview && (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-white/80 text-justify sm:text-base">
                  {movie.overview}
                </p>
              )}

              <div className="mt-6 flex w-full max-w-2xl flex-wrap justify-center gap-2.5">
                <button
                  onClick={() => setShowAddToListModal(true)}
                  className="inline-flex min-w-[11rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10"
                >
                  <Bookmark className="h-4 w-4" />
                  Add to List
                </button>
                <button
                  onClick={() => router.push(`/share?movie_id=${movie.id}`)}
                  className="inline-flex min-w-[11rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button
                  onClick={() => setShowLogMovieModal(true)}
                  className="inline-flex min-w-[11rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#ff8a1e]/25 bg-[#ff8a1e] px-4 py-3 text-sm font-bold text-black shadow-[0_10px_28px_rgba(255,138,30,0.18)] transition-transform hover:translate-y-[-1px]"
                >
                  <LogsIcon className="h-4 w-4" />
                  Log Movie
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
                <span className="text-white/45">Rating distribution:</span>
                <button
                  type="button"
                  onClick={() => setBannerMessage(`${reactionBreakdown.bad} bad rating${reactionBreakdown.bad === 1 ? "" : "s"}`)}
                  className="text-rose-300 transition hover:text-rose-200"
                >
                  Bad {reactionBreakdown.bad}
                </button>
                <span className="text-white/20">•</span>
                <button
                  type="button"
                  onClick={() => setBannerMessage(`${reactionBreakdown.good} good rating${reactionBreakdown.good === 1 ? "" : "s"}`)}
                  className="text-[#f5f0de] transition hover:text-white"
                >
                  Good {reactionBreakdown.good}
                </button>
                <span className="text-white/20">•</span>
                <button
                  type="button"
                  onClick={() => setBannerMessage(`${reactionBreakdown.masterpiece} masterpiece rating${reactionBreakdown.masterpiece === 1 ? "" : "s"}`)}
                  className="text-[#ffb36b] transition hover:text-[#ffcf9b]"
                >
                  Masterpiece {reactionBreakdown.masterpiece}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-neutral-950 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
            {/* Friends' logs row */}
            {friendLogs.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Friends who logged this movie</h3>
                <div className="flex flex-wrap gap-4">
                  {friendLogs.map((log) => {
                    const label = getReactionLabelFromLogReaction(log.reaction);
                    return (
                      <div key={log.id} className="flex flex-col items-center cursor-pointer group" onClick={() => router.push(buildLogUrl(log))} title={`View ${log.user.name}'s log`}>
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
                  {showAllLogs ? "Hide all logs" : `Show all logs (${allLogs.length})`}
                </button>
                {showAllLogs && (
                  <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
                    {allLogs.map((log) => {
                      const label = getReactionLabelFromLogReaction(log.reaction);
                      return (
                        <div key={log.id} className="flex items-center gap-4 p-4 sm:p-5">
                          <div className="flex flex-col items-center cursor-pointer" onClick={() => router.push(buildLogUrl(log))} title={`View ${log.user.name}'s log`}>
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
                            <span className="font-semibold text-white/90 cursor-pointer hover:underline" onClick={() => router.push(buildLogUrl(log))}>{log.user.name}</span>
                            {log.notes && (
                              <p className="text-white/80 mt-1 line-clamp-3">{log.notes}</p>
                            )}
                          </div>
                          <button
                            className="ml-2 px-3 py-1 rounded border border-white/20 text-xs text-white/70 hover:bg-white/10"
                            onClick={() => router.push(buildLogUrl(log))}
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

            <div className="pt-2">
              <div className="flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.28em] text-white/45">
                {(["cast", "crew", "reviews", "posts"] as MovieDetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveDetailTab(tab)}
                    className={`border-b-2 px-2 py-2 transition ${
                      activeDetailTab === tab
                        ? "border-[#ff8a1e] text-[#ffb36b]"
                        : "border-transparent hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-8">
                {activeDetailTab === "cast" && (
                  <section className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">Cast</h2>
                      {castPeople.length > 10 && (
                        <button
                          type="button"
                          onClick={() => setShowAllCast((value) => !value)}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[#ffb36b] hover:text-[#ffcf9b]"
                        >
                          {showAllCast ? "Show less" : `Show all (${castPeople.length})`}
                          <ChevronDown className={`h-4 w-4 transition ${showAllCast ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    {castPeople.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {visibleCastPeople.map(renderCastCard)}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                        No cast data available.
                      </div>
                    )}
                  </section>
                )}

                {activeDetailTab === "crew" && (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">Crew</h2>
                      <p className="text-sm text-white/45">
                        Directors, producers, cinematography, editing, and music
                      </p>
                    </div>
                    {crewBuckets.length > 0 ? (
                      <div className="space-y-5">
                        {crewBuckets.map(([group, people]) => (
                          <div key={group} className="space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/45">{group}</p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {people.map((person) => (
                                <div
                                  key={`${group}-${person.id}-${person.name}`}
                                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                                >
                                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/10">
                                    {person.profile_url ? (
                                      <img src={person.profile_url} alt={person.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                                        {person.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[#f5f0de]">{person.name}</p>
                                    <p className="truncate text-xs text-white/55">{person.job || person.department || group}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                        No crew credits available.
                      </div>
                    )}
                  </section>
                )}

                {activeDetailTab === "reviews" && (
                  <section className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold">Reviews</h2>
                        <p className="mt-1 text-sm text-white/55">
                          A quick preview of reviews. Open the full page for filters and the complete list.
                        </p>
                      </div>
                      <Link
                        href={`/movie/${movie.id}/reviews`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
                      >
                        Open all reviews
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                    {reviews.length > 0 ? (
                      <div className="grid gap-4">
                        {reviews.slice(0, 6).map((review) => {
                          const expanded = expandedReviewIds.has(review.id);
                          return (
                            <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                              <div className="mb-3 flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-white">{review.user.name}</p>
                                  <p className="text-sm text-white/50">{new Date(review.created_at).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full border ${getReactionBadgeClass(review.rating)}`}>
                                  {getReactionLabelFromRating(review.rating)}
                                </span>
                              </div>
                              <p className={`leading-7 text-white/80 ${expanded ? "" : "line-clamp-3"}`}>
                                {review.text}
                              </p>
                              {review.text.length > 180 && (
                                <button
                                  type="button"
                                  onClick={() => toggleReviewExpanded(review.id)}
                                  className="mt-3 text-sm font-semibold text-[#ffb36b] hover:text-[#ffcf9b]"
                                >
                                  {expanded ? "Show less" : "Show more"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                        No reviews yet. Be the first to review.
                      </div>
                    )}
                  </section>
                )}

                {activeDetailTab === "posts" && (
                  <section className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-bold">Posts</h2>
                      <p className="mt-1 text-sm text-white/55">
                        All posts, logs, and discussions mapped to this movie.
                      </p>
                    </div>
                    <ContentCinePosts contentId={movie.id} contentType="movie" currentUser={user} theme="brutalist" />
                  </section>
                )}
              </div>
            </div>

          </div>
        </div>
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
        onLogCreated={(message) => {
          if (isScanLogFlow) {
            setShowScanThanksModal(true);
          } else {
            setBannerMessage(message);
          }
          if (!user) return;
          void loadMovieLogData();
        }}
      />

      {showScanThanksModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-3 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#0c0c0c] px-5 py-6 text-center text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#ff8a1e]/25 bg-[#ff8a1e]/10 text-[#ffb36b]">
              <LogsIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-2xl font-black tracking-tight">Thanks for submitting your review.</h3>
            <p className="mt-3 text-sm leading-7 text-white/65">
              Your log is saved. Explore Canisterr for more movies, reviews, and logs.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowScanThanksModal(false);
                router.push("/dashboard");
              }}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#ff8a1e] px-5 py-3 text-sm font-black text-black transition-transform hover:translate-y-[-1px]"
            >
              Explore Canisterr
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
