"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Bookmark, LogsIcon, MessageCircle, Share2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import TopActionBanner from "@/components/TopActionBanner";
import AddToListModal from "@/components/AddToListModal";
import LogMovieModal from "@/components/LogMovieModal";
import CinematicLoading from "@/components/CinematicLoading";
import ContentCinePosts from "@/components/ContentCinePosts";
import { auth, db } from "@/lib/firebase";
import { getShowDetails, type ShowDetails } from "@/lib/tvmaze";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { buildLogUrl } from "@/lib/log-url";
import { getLogsForContent, getTvEpisodeLabel, getVisibleLogNotes } from "@/lib/logs";
import { signOut as authSignOut } from "@/lib/auth";
import { User, Content, MovieReviewWithUser, MovieLog, MovieLogWithContent } from "@/types";

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
  if (label === "Masterpiece") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  if (label === "Average") return "bg-amber-500/20 text-amber-300 border-amber-400/30";
  if (label === "Good") return "bg-blue-500/20 text-[#f5f0de] border-blue-400/30";
  return "bg-rose-500/20 text-rose-300 border-rose-400/30";
}

function getReactionBadgeClass(rating: number): string {
  const label = getReactionLabelFromRating(rating);
  return getReactionBadgeClassFromLabel(label);
}

type TVCreditPerson = {
  id: number;
  name: string;
  profile_url: string | null;
  job?: string | null;
  character?: string | null;
  department?: string | null;
};

function getCrewBucketLabel(job: string | null | undefined): string {
  if (!job) return "Crew";
  return job;
}

function getSeasonLabel(log: Pick<MovieLog, "content_type" | "season" | "episode" | "episode_title">): string {
  return getTvEpisodeLabel(log);
}

export default function TVShowPage() {
  const router = useRouter();
  const params = useParams();
  const showId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<MovieReviewWithUser[]>([]);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);
  const [reactionBreakdown, setReactionBreakdown] = useState({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
  const [userLogHistory, setUserLogHistory] = useState<MovieLog[]>([]);
  const [friendLogs, setFriendLogs] = useState<MovieLogWithContent[]>([]);
  const [allLogs, setAllLogs] = useState<MovieLogWithContent[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"cast" | "crew" | "reviews" | "posts">("cast");

  const loadShowLogData = async (currentUserId: string) => {
    const numericShowId = Number(showId);
    if (!numericShowId || Number.isNaN(numericShowId)) {
      setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
      setUserLogHistory([]);
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }

    const logsSnapshot = await get(ref(db, "movie_logs"));
    if (!logsSnapshot.exists()) {
      setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
      setUserLogHistory([]);
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }

    const allRawLogs = logsSnapshot.val();
    const showLogs = Object.values(allRawLogs).filter(
      (log: any) =>
        Number(log.content_id) === numericShowId &&
        log.content_type === "tv" &&
        !log.watch_later &&
        Boolean(log.watched_date)
    ) as MovieLog[];

    const bad = showLogs.filter((log) => log.reaction === 0).length;
    const average = showLogs.filter((log) => log.reaction === 1.5).length;
    const good = showLogs.filter((log) => log.reaction === 1).length;
    const masterpiece = showLogs.filter((log) => log.reaction === 2).length;
    const total = bad + average + good + masterpiece;

    setReactionBreakdown({ bad, average, good, masterpiece, total });

    const history = showLogs
      .filter((log) => log.user_id === currentUserId)
      .sort((a, b) => {
        const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
        if (watchedDiff !== 0) return watchedDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    setUserLogHistory(history.map((log) => ({ ...log, notes: getVisibleLogNotes(log) })));
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
        router.push("/auth/login");
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        if (showId && !isNaN(Number(showId))) {
          const showDetails = await getShowDetails(Number(showId));
          if (showDetails) {
            setShow(showDetails);
          }
        }

        const mergedReviews = await getMovieReviewFeed(Number(showId), "tv");
        setReviews(mergedReviews);

        await loadShowLogData(currentUser.id);

        let logs = await getLogsForContent(Number(showId), "tv", 100);
        logs = logs.filter(
          (log) =>
            Number(log.content_id) === Number(showId) &&
            log.content_type === "tv" &&
            !log.watch_later &&
            Boolean(log.watched_date)
        );

        const latestLogByUser = new Map<string, MovieLogWithContent>();
        logs.forEach((log) => {
          if (
            !latestLogByUser.has(log.user_id) ||
            new Date(log.created_at) > new Date(latestLogByUser.get(log.user_id)!.created_at)
          ) {
            latestLogByUser.set(log.user_id, log);
          }
        });

        logs = Array.from(latestLogByUser.values());
        setFriendLogs(logs.filter((log) => log.user_id !== currentUser.id));
        setAllLogs(logs);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching TV show details:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [showId, router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const myReviewLog = allLogs.length > 0 && user
    ? [...allLogs]
        .filter((log) => log.user_id === user.id)
        .sort((a, b) => {
          const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
          if (watchedDiff !== 0) return watchedDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })[0] || null
    : null;
  const castPeople = useMemo(() => show?.cast_details || [], [show]);
  const crewPeople = useMemo(() => show?.crew_details || [], [show]);

  const renderCastRow = (person: TVCreditPerson) => (
    <div key={person.id} className="flex items-center gap-4 py-4 text-left">
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

  const renderCrewRow = (person: TVCreditPerson) => (
    <div key={`${person.id}-${person.job || person.department || "crew"}`} className="flex items-center gap-4 py-4 text-left">
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
          {getCrewBucketLabel(person.job || person.department)}
        </p>
      </div>
    </div>
  );

  if (loading || !user) {
    return <CinematicLoading message="Your show page is loading" />;
  }

  if (!show) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="p-8 text-center">
          <p className="text-gray-600 text-lg">TV Show not found</p>
          <Link href="/dashboard" className="mt-4 inline-block text-[#f5f0de]">
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
        <section className={show.poster_url ? "relative overflow-hidden border-b border-white/10" : "border-b border-white/10"}>
          {show.poster_url ? (
            <div className="relative h-[42svh] min-h-[300px] sm:h-[46svh] sm:min-h-[320px] lg:h-[48svh] lg:min-h-[340px]">
              <img
                src={show.poster_url}
                alt={`${show.title} poster`}
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
            <div className={`mx-auto max-w-5xl px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 ${show.poster_url ? "pt-5 sm:pt-6 lg:pt-8" : "pt-4 sm:pt-5 lg:pt-6"}`}>
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/45">
                  {[
                    show.release_date ? formatReleaseYear(show.release_date) : null,
                    show.runtime ? formatRuntime(show.runtime) : null,
                    show.language ? show.language.toUpperCase() : null,
                    show.status,
                    show.network?.name || null,
                  ].filter(Boolean).map((part, index) => (
                    <span key={`${part}-${index}`}>{part}</span>
                  ))}
                </div>

                <h1
                  className="mt-4 text-[clamp(3rem,9vw,5.75rem)] font-black leading-[0.9] tracking-tight text-[#f5f0de]"
                  style={{ fontFamily: 'var(--font-playfair), "Playfair Display", serif' }}
                >
                  {show.title}
                </h1>

                {show.genres && show.genres.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[#ffb36b]">
                    {show.genres.slice(0, 4).map((genre, index) => (
                      <span key={genre} className="inline-flex items-center">
                        {index > 0 && <span className="mr-2 text-white/30">,</span>}
                        <span>{genre}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-6 grid grid-cols-4 gap-2 sm:mt-7 sm:gap-3">
                  <button
                    onClick={() => setShowLogMovieModal(true)}
                    className="inline-flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-white/20 hover:bg-white/10 sm:gap-2 sm:px-4 sm:py-4 sm:text-sm sm:tracking-[0.16em]"
                  >
                    Log
                  </button>
                  <button
                    onClick={() => router.push(`/share?show_id=${show.id}`)}
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
                  <Link
                    href={`/tv/${show.id}/seasons`}
                    className="inline-flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white sm:gap-2 sm:px-4 sm:py-4 sm:text-sm sm:tracking-[0.16em]"
                  >
                    Seasons
                  </Link>
                </div>

                {show.overview && (
                  <div className="mt-8">
                    <h2 className="text-3xl font-black tracking-tight text-[#f5f0de]">Overview</h2>
                    <p className="mt-3 max-w-4xl text-base leading-8 text-white/68 sm:text-[1.08rem]">
                      {show.overview}
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
                        reactionBreakdown.total === 0
                          ? "text-slate-400"
                          : reactionBreakdown.masterpiece >= reactionBreakdown.good &&
                            reactionBreakdown.masterpiece >= reactionBreakdown.average &&
                            reactionBreakdown.masterpiece >= reactionBreakdown.bad
                          ? "text-orange-300"
                          : reactionBreakdown.good >= reactionBreakdown.average && reactionBreakdown.good >= reactionBreakdown.bad
                            ? "text-emerald-300"
                            : reactionBreakdown.average >= reactionBreakdown.bad
                              ? "text-amber-300"
                              : "text-rose-300"
                      }`}
                      style={{ fontFamily: 'var(--font-playfair), "Playfair Display", serif' }}
                    >
                      {reactionBreakdown.total === 0
                        ? "None"
                        : reactionBreakdown.masterpiece >= reactionBreakdown.good &&
                            reactionBreakdown.masterpiece >= reactionBreakdown.average &&
                            reactionBreakdown.masterpiece >= reactionBreakdown.bad
                          ? "Masterpiece"
                          : reactionBreakdown.good >= reactionBreakdown.average && reactionBreakdown.good >= reactionBreakdown.bad
                            ? "Good"
                            : reactionBreakdown.average >= reactionBreakdown.bad
                              ? "Average"
                              : "Bad"}
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
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${getReactionBadgeClassFromLabel(
                            getReactionLabelFromLogReaction(myReviewLog.reaction),
                          )}`}
                        >
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
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-neutral-950">
          <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
            <div>
              <h2 className="mb-5 text-2xl font-bold">Your Log History</h2>
              {userLogHistory.length > 0 ? (
                <div className="divide-y divide-white/10 border-t border-white/10">
                  {userLogHistory.map((log) => {
                    const label = getReactionLabelFromLogReaction(log.reaction);
                    return (
                      <div key={log.id} className="py-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                            <p>Watched on {new Date(log.watched_date).toLocaleDateString()}</p>
                            {getSeasonLabel(log) ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb36b]">
                                {getSeasonLabel(log)}
                              </span>
                            ) : null}
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${getReactionBadgeClassFromLabel(label)}`}>
                            {label}
                          </span>
                        </div>
                        {log.notes?.trim() ? (
                          <p className="leading-7 text-white/85">{log.notes}</p>
                        ) : (
                          <p className="text-sm text-white/50">No review text for this log.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border-t border-white/10 pt-4 text-sm text-white/60">
                  You have not logged this show yet.
                </div>
              )}

              {friendLogs.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 text-lg font-semibold">Friends who logged this show</h3>
                  <div className="flex flex-wrap gap-4">
                    {friendLogs.map((log) => {
                      const label = getReactionLabelFromLogReaction(log.reaction);
                      return (
                        <div
                          key={log.id}
                          className="group flex cursor-pointer flex-col items-center"
                          onClick={() => router.push(buildLogUrl(log))}
                          title={`View ${log.user.name}'s log`}
                        >
                          <div className="relative flex flex-col items-center">
                            {log.user.avatar_url ? (
                              <img
                                src={log.user.avatar_url}
                                alt={log.user.name}
                                className="h-12 w-12 rounded-full border-2 border-white transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-white/10 text-lg font-bold text-white">
                                {log.user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className={`mt-2 block rounded-full border px-2 py-0.5 text-xs ${getReactionBadgeClassFromLabel(label)}`}>
                              {label}
                            </span>
                            {getSeasonLabel(log) ? (
                              <span className="mt-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb36b]">
                                {getSeasonLabel(log)}
                              </span>
                            ) : null}
                          </div>
                          <span className="mt-2 text-xs text-white/80 group-hover:underline">{log.user.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {allLogs.length > 0 && (
                <div className="mt-10">
                  <button
                    className="text-sm font-medium text-white/65 transition hover:text-white"
                    onClick={() => setShowAllLogs((value) => !value)}
                  >
                    {showAllLogs ? "Hide log history" : `Show log history (${allLogs.length})`}
                  </button>
                  {showAllLogs && (
                    <div className="mt-3 divide-y divide-white/10 border-t border-white/10">
                      {allLogs.map((log) => {
                        const label = getReactionLabelFromLogReaction(log.reaction);
                        return (
                          <div key={log.id} className="flex items-center gap-4 py-4">
                            <div
                              className="flex cursor-pointer flex-col items-center"
                              onClick={() => router.push(buildLogUrl(log))}
                              title={`View ${log.user.name}'s log`}
                            >
                              {log.user.avatar_url ? (
                                <img
                                  src={log.user.avatar_url}
                                  alt={log.user.name}
                                  className="h-10 w-10 rounded-full border-2 border-white"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white/10 text-base font-bold text-white">
                                  {log.user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className={`mt-1 block rounded-full border px-2 py-0.5 text-xs ${getReactionBadgeClassFromLabel(label)}`}>
                                {label}
                              </span>
                              {getSeasonLabel(log) ? (
                                <span className="mt-1 block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb36b]">
                                  {getSeasonLabel(log)}
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span
                                className="cursor-pointer font-semibold text-white/90 hover:underline"
                                onClick={() => router.push(buildLogUrl(log))}
                              >
                                {log.user.name}
                              </span>
                              {log.notes && <p className="mt-1 line-clamp-3 text-white/80">{log.notes}</p>}
                            </div>
                            <button
                              className="ml-2 text-xs font-medium text-white/55 transition hover:text-white hover:underline"
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
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10">
                {(["cast", "crew", "reviews", "posts"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveDetailTab(tab)}
                    className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold capitalize tracking-wide transition-colors ${
                      activeDetailTab === tab
                        ? "border-[#ff8a1e] text-[#ffb36b]"
                        : "border-transparent text-white/45 hover:border-white/20 hover:text-white/70"
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
                      <div className="divide-y divide-white/10 border-t border-white/10">
                        {castPeople.map(renderCastRow)}
                      </div>
                    ) : (
                      <p className="border-t border-white/10 pt-4 text-sm text-white/60">No cast data available.</p>
                    )}
                  </section>
                )}

                {activeDetailTab === "crew" && (
                  <section className="space-y-5">
                    <h2 className="text-2xl font-bold">Crew</h2>
                    {crewPeople.length > 0 ? (
                      <div className="divide-y divide-white/10 border-t border-white/10">
                        {crewPeople.map(renderCrewRow)}
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
                      <button
                        type="button"
                        onClick={() => setActiveDetailTab("reviews")}
                        className="text-sm font-semibold text-[#ffb36b] transition hover:text-[#ffcf9b]"
                      >
                        Open all reviews
                      </button>
                    </div>
                    {reviews.length > 0 ? (
                      <div className="grid gap-4">
                        {reviews.slice(0, 5).map((review) => (
                          <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <div className="mb-3 flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-white">{review.user.name}</p>
                                <p className="text-sm text-white/50">{new Date(review.created_at).toLocaleDateString()}</p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-xs ${getReactionBadgeClass(review.rating)}`}>
                                {getReactionLabelFromRating(review.rating)}
                              </span>
                            </div>
                            <p className="leading-7 text-white/80">{review.text}</p>
                          </div>
                        ))}
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
                    <ContentCinePosts contentId={show.id} contentType="tv" currentUser={user} theme="brutalist" compact />
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        content={show as Content}
        user={user}
      />

      <LogMovieModal
        isOpen={showLogMovieModal}
        onClose={() => setShowLogMovieModal(false)}
        content={show as Content}
        user={user}
        onLogCreated={(message) => {
          setBannerMessage(message);
          if (user) {
            void loadShowLogData(user.id);
          }
        }}
      />
    </PageLayout>
  );
}
