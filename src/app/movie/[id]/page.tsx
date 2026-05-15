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

function getReactionLabelFromLogReaction(reaction: 0 | 1 | 1.5 | 2 | null | undefined): "Unrated" | "Bad" | "Average" | "Good" | "Masterpiece" {
  if (reaction == null) return "Unrated";
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1.5) return "Average";
  if (reaction === 1) return "Good";
  return "Bad";
}

function getReactionBadgeClassFromLabel(label: "Unrated" | "Bad" | "Average" | "Good" | "Masterpiece"): string {
  if (label === "Unrated") return "bg-slate-500/20 text-slate-300 border-slate-400/30";
  if (label === "Masterpiece") return "bg-orange-500/20 text-orange-300 border-orange-400/30";
  if (label === "Average") return "bg-amber-500/20 text-amber-300 border-amber-400/30";
  if (label === "Good") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
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

function getDisplayUserLabel(user: User): string {
  if (user.name && user.name.trim()) return user.name;
  if (user.username && user.username !== user.id) return `@${user.username}`;
  return "User";
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
  const [reactionBreakdown, setReactionBreakdown] = useState({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
  const [movieStats, setMovieStats] = useState({ totalLogs: 0, totalWatched: 0 });
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
      setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
      setMovieStats({ totalLogs: 0, totalWatched: 0 });
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }

    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) {
      setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
      setMovieStats({ totalLogs: 0, totalWatched: 0 });
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
    const average = movieLogs.filter((log) => log.reaction === 1.5).length;
    const good = movieLogs.filter((log) => log.reaction === 1).length;
    const masterpiece = movieLogs.filter((log) => log.reaction === 2).length;
    const total = bad + average + good + masterpiece;
    const totalLogs = movieLogs.length;
    const totalWatched = new Set(movieLogs.map((log) => log.user_id)).size;

    setReactionBreakdown({ bad, average, good, masterpiece, total });
    setMovieStats({ totalLogs, totalWatched });
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
        // Keep friend logs for the top row, but show only the current user's own logs in history.
        const myLogs = logs.filter((log) => log.user_id === currentUser.id);
        const friendLogsFiltered = logs.filter(l => l.user_id !== currentUser.id);
        setFriendLogs(friendLogsFiltered);
        setAllLogs(myLogs);

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
  const heroImageUrl = movie?.backdrop_url || movie?.poster_url || null;
  const movieGenres = movie?.genres || [];
  const castPeople = useMemo(() => movie?.cast_details || [], [movie]);
  const visibleCastPeople = showAllCast ? castPeople : castPeople.slice(0, 10);
  const crewBuckets = useMemo(() => getCrewBuckets(movie?.crew_details || []), [movie]);
  const myReviewLog = useMemo(() => {
    if (allLogs.length === 0) return null;

    return [...allLogs].sort((a, b) => {
      const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
      if (watchedDiff !== 0) return watchedDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0] || null;
    }, [allLogs]);
  const verdictLabel = useMemo(() => {
    if (reactionBreakdown.total === 0) return "None";

    const counts = [
      { label: "Bad", count: reactionBreakdown.bad },
      { label: "Average", count: reactionBreakdown.average },
      { label: "Good", count: reactionBreakdown.good },
      { label: "Masterpiece", count: reactionBreakdown.masterpiece },
    ];

    return counts.reduce((best, current) => (current.count > best.count ? current : best), counts[0]).label;
  }, [reactionBreakdown]);

  const toggleReviewExpanded = (reviewId: string) => {
    setExpandedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  };

  const renderCastRow = (person: MovieCreditPerson) => (
    <div
      key={person.id}
      className="flex items-center gap-4 py-4 text-left"
    >
      <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-none border border-white/10 bg-white/10 sm:h-24 sm:w-16">
        {person.profile_url ? (
          <img src={person.profile_url} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base font-black text-white/35">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f5f0de] sm:text-base">{person.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55 sm:text-sm">
          {person.character || "Character unavailable"}
        </p>
      </div>
    </div>
  );

  const renderCrewRow = (person: MovieCreditPerson, group: string) => (
    <div
      key={`${group}-${person.id}-${person.name}`}
      className="flex items-center gap-4 py-4 text-left"
    >
      <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-none border border-white/10 bg-white/10 sm:h-24 sm:w-16">
        {person.profile_url ? (
          <img src={person.profile_url} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base font-black text-white/35">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f5f0de] sm:text-base">{person.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55 sm:text-sm">
          {person.job || person.department || group}
        </p>
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
        <section className={heroImageUrl ? "relative overflow-hidden border-b border-white/10" : "border-b border-white/10"}>
          {heroImageUrl ? (
            <div className="relative h-[42svh] min-h-[300px] sm:h-[46svh] sm:min-h-[320px] lg:h-[48svh] lg:min-h-[340px]">
              <img
                src={heroImageUrl}
                alt={`${movie.title} backdrop`}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.18)_34%,rgba(0,0,0,0.48)_68%,rgba(0,0,0,0.92)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,26,0.18),transparent_28%)]" />

              <div className="relative z-10 mx-auto flex h-full max-w-7xl items-start px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pt-6">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:border-[#ff8a1e]/40 hover:bg-black/70 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:border-[#ff8a1e]/40 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          )}

          <div className="relative z-10 bg-black">
            <div className={`mx-auto max-w-5xl px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 ${heroImageUrl ? "pt-5 sm:pt-6 lg:pt-8" : "pt-4 sm:pt-5 lg:pt-6"}`}>
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/45">
                  {movieMetaParts.map((part, index) => (
                    <span key={`${part}-${index}`}>{part}</span>
                  ))}
                </div>

                <h1
                  className="mt-4 text-[clamp(3rem,9vw,5.75rem)] font-black leading-[0.9] tracking-tight text-[#f5f0de]"
                  style={{ fontFamily: 'var(--font-playfair), "Playfair Display", serif' }}
                >
                  {movie.title}
                </h1>

                {movieGenres.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[#ffb36b]">
                    {movieGenres.slice(0, 4).map((genre, index) => (
                      <span key={genre} className="inline-flex items-center">
                        {index > 0 && <span className="mr-2 text-white/30">,</span>}
                        <span>{genre}</span>
                      </span>
                    ))}
                  </div>
                )}

                {movie.director && (
                  <p className="mt-4 text-base text-white/58 sm:text-lg">
                    Directed by <span className="text-white/82">{movie.director}</span>
                  </p>
                )}

                <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-3">
                  <button
                    onClick={() => setShowLogMovieModal(true)}
                    className="inline-flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-white/20 hover:bg-white/10 sm:gap-2 sm:px-4 sm:py-4 sm:text-sm sm:tracking-[0.16em]"
                  >
                    Log
                  </button>
                  <button
                    onClick={() => router.push(`/share?movie_id=${movie.id}`)}
                    className="inline-flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white sm:gap-2 sm:px-4 sm:py-4 sm:text-sm sm:tracking-[0.16em]"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => setShowAddToListModal(true)}
                    className="inline-flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white sm:gap-2 sm:px-4 sm:py-4 sm:text-sm sm:tracking-[0.16em]"
                  >
                    Add to List
                  </button>
                </div>

                {movie.overview && (
                  <div className="mt-8">
                    <h2 className="text-3xl font-black tracking-tight text-[#f5f0de]">Overview</h2>
                    <p className="mt-3 max-w-4xl text-base leading-8 text-white/68 sm:text-[1.08rem]">
                      {movie.overview}
                    </p>
                  </div>
                )}

                <div className="mt-8 w-full max-w-3xl text-center">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-white/45">
                    <span>Rating distribution</span>
                    <span>{reactionBreakdown.total} logs</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    {reactionBreakdown.total > 0 ? (
                      <div className="flex h-full w-full">
                        {[
                          { label: "Bad", value: reactionBreakdown.bad, color: "bg-rose-400" },
                          { label: "Average", value: reactionBreakdown.average, color: "bg-amber-400" },
                          { label: "Good", value: reactionBreakdown.good, color: "bg-emerald-400" },
                          { label: "Masterpiece", value: reactionBreakdown.masterpiece, color: "bg-orange-400" },
                        ].map((item) => {
                          const percent = (item.value / reactionBreakdown.total) * 100;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => setBannerMessage(`${item.value} ${item.label.toLowerCase()} rating${item.value === 1 ? "" : "s"}`)}
                              className={`${item.color} h-full transition-opacity hover:opacity-90`}
                              style={{ width: `${percent}%` }}
                              aria-label={`${item.label} ${item.value}`}
                              title={`${item.label} ${item.value}`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full w-full rounded-full bg-slate-500/60" />
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-[9px] uppercase tracking-[0.34em] text-white/40">Verdict</p>
                    <p
                      className={`mt-1 text-[22px] font-semibold leading-none tracking-[0.08em] ${
                        verdictLabel === "None"
                          ? "text-slate-400"
                          : verdictLabel === "Masterpiece"
                          ? "text-orange-300"
                          : verdictLabel === "Good"
                            ? "text-emerald-300"
                            : verdictLabel === "Average"
                              ? "text-amber-300"
                              : "text-rose-300"
                      }`}
                      style={{ fontFamily: 'var(--font-playfair), "Playfair Display", serif' }}
                    >
                      {verdictLabel}
                    </p>
                    {reactionBreakdown.total > 0 && (
                      <div className="-mx-1 mt-3 flex flex-nowrap justify-center gap-3 overflow-x-auto px-1 pb-1 text-[10px] text-white/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                          Bad {reactionBreakdown.bad}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          Average {reactionBreakdown.average}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          Good {reactionBreakdown.good}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                          Masterpiece {reactionBreakdown.masterpiece}
                        </span>
                      </div>
                    )}
                  </div>
                  {myReviewLog && (
                    <button
                      type="button"
                      onClick={() => router.push(buildLogUrl(myReviewLog))}
                      className="mt-4 block w-full rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left transition-colors hover:border-white/20 hover:bg-white/10"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">My review</p>
                          <p className="mt-1 text-sm font-semibold text-[#f5f0de]">Your latest log</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${getReactionBadgeClassFromLabel(getReactionLabelFromLogReaction(myReviewLog.reaction))}`}>
                          {getReactionLabelFromLogReaction(myReviewLog.reaction)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm leading-6 text-white/80">
                        {myReviewLog.notes?.trim() ? myReviewLog.notes : "No review text yet."}
                      </p>
                      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        Open full review
                      </p>
                    </button>
                  )}
                  {allLogs.length > 0 && (
                    <div className="mt-5">
                      <button
                        className="text-sm font-medium text-white/65 transition hover:text-white"
                        onClick={() => setShowAllLogs((v) => !v)}
                      >
                        {showAllLogs ? "Hide all logs" : `Show all logs (${allLogs.length})`}
                      </button>
                      {showAllLogs && (
                        <div className="mt-3 divide-y divide-white/10 border-t border-white/10">
                          {allLogs.map((log) => {
                            const label = getReactionLabelFromLogReaction(log.reaction);
                            const userLabel = "You";
                            return (
                              <div key={log.id} className="flex items-center gap-4 py-4">
                                <button
                                  type="button"
                                  className="flex flex-col items-center text-center"
                                  onClick={() => router.push(buildLogUrl(log))}
                                  title={`View ${userLabel}'s log`}
                                >
                                  {log.user.avatar_url ? (
                                    <img src={log.user.avatar_url} alt={userLabel} className="h-10 w-10 rounded-full border border-white/15" />
                                  ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-base font-bold text-white">
                                      Y
                                    </div>
                                  )}
                                  <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border block ${getReactionBadgeClassFromLabel(label)}`}>{label}</span>
                                </button>
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    className="font-semibold text-white/90 transition hover:underline"
                                    onClick={() => router.push(buildLogUrl(log))}
                                  >
                                    {userLabel}
                                  </button>
                                  {log.notes && (
                                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/70">{log.notes}</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="text-xs font-medium text-white/55 transition hover:text-white hover:underline"
                                  onClick={() => router.push(buildLogUrl(log))}
                                >
                                  View
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-5">
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        href={`/movie/${movie.id}/reviews`}
                        className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10"
                      >
                        <span className="text-[9px] uppercase tracking-[0.18em] text-white/45">Total Reviews</span>
                        <span className="mt-1 text-lg font-black text-[#f5f0de]">{reviews.length}</span>
                      </Link>
                      <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center">
                        <span className="text-[9px] uppercase tracking-[0.18em] text-white/45">Total Logs</span>
                        <span className="mt-1 text-lg font-black text-[#f5f0de]">{movieStats.totalLogs}</span>
                      </div>
                      <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center">
                        <span className="text-[9px] uppercase tracking-[0.18em] text-white/45">Total Watched</span>
                        <span className="mt-1 text-lg font-black text-[#f5f0de]">{movieStats.totalWatched}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-neutral-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
            {/* Friends' logs row */}
            {friendLogs.length > 0 && (
              <div>
                <div className="mb-4 flex items-end justify-between gap-4 border-l-2 border-[#ff8a1e] pl-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#ffb36b]/80">
                      Your circle
                    </p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-[#f5f0de]">
                      Friends who watched it
                    </h3>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
                    {friendLogs.length} log{friendLogs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {friendLogs.slice(0, 10).map((log) => {
                    const label = getReactionLabelFromLogReaction(log.reaction);
                    const userLabel = getDisplayUserLabel(log.user);
                    return (
                      <button
                        key={log.id}
                        type="button"
                        className="flex cursor-pointer flex-col items-center p-1 text-center transition-colors hover:opacity-90"
                        onClick={() => router.push(buildLogUrl(log))}
                        title={`View ${userLabel}'s log`}
                      >
                        <div className="relative flex flex-col items-center">
                          {log.user.avatar_url ? (
                            <img
                              src={log.user.avatar_url}
                              alt={userLabel}
                              className="h-12 w-12 rounded-2xl border border-white/15 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lg font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                              {userLabel.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className={`mt-2 text-xs px-2 py-0.5 rounded-full border block ${getReactionBadgeClassFromLabel(label)}`}>{label}</span>
                        </div>
                        <span className="mt-2 text-xs text-white/80 group-hover:underline">{userLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2">
              <div className="flex items-center justify-center gap-4 text-sm font-black uppercase tracking-[0.16em] text-white/55 sm:text-base sm:tracking-[0.2em]">
                {(["cast", "crew", "reviews", "posts"] as MovieDetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveDetailTab(tab)}
                    className={`border-b-2 px-2 py-2 transition sm:px-3 ${
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
                    <h2 className="text-2xl font-bold">Cast</h2>
                    {castPeople.length > 0 ? (
                      <div className="space-y-3">
                        <div className="divide-y divide-white/10 border-t border-white/10">
                          {visibleCastPeople.map(renderCastRow)}
                        </div>
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
                    ) : (
                      <p className="border-t border-white/10 pt-4 text-sm text-white/60">No cast data available.</p>
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
                            <div className="divide-y divide-white/10 border-t border-white/10">
                              {people.map((person) => renderCrewRow(person, group))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="border-t border-white/10 pt-4 text-sm text-white/60">No crew credits available.</p>
                    )}
                  </section>
                )}

                {activeDetailTab === "reviews" && (
                  <section className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">Reviews</h2>
                      <Link
                        href={`/movie/${movie.id}/reviews`}
                        className="text-sm font-semibold text-[#ffb36b] transition hover:text-[#ffcf9b]"
                      >
                        Open all reviews
                      </Link>
                    </div>
                    {reviews.length > 0 ? (
                      <div className="grid gap-4">
                        {reviews.slice(0, 5).map((review) => {
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
                    <ContentCinePosts contentId={movie.id} contentType="movie" currentUser={user} theme="brutalist" compact />
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
