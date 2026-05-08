"use client";

import { useEffect, useState } from "react";
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
import { getShowDetails } from "@/lib/tvmaze";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { buildLogUrl } from "@/lib/log-url";
import { getLogsForContent, getVisibleLogNotes } from "@/lib/logs";
import { signOut as authSignOut } from "@/lib/auth";
import { User, TVShow, Content, MovieReviewWithUser, MovieLog, MovieLogWithContent } from "@/types";

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

export default function TVShowPage() {
  const router = useRouter();
  const params = useParams();
  const showId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<TVShow | null>(null);
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
            setShow(showDetails as TVShow);
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
              {show.poster_url ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_80px_rgba(0,0,0,0.55)] w-[7.5rem] sm:w-[9rem] lg:w-[10.5rem]">
                  <img
                    src={show.poster_url}
                    alt={show.title}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-[10.5rem] w-[7.5rem] items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/5 text-3xl font-black text-white/30 sm:h-[13rem] sm:w-[9rem] lg:h-[15rem] lg:w-[10.5rem]">
                  ?
                </div>
              )}

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
                TV Show
              </p>
              <h1 className="mt-2 text-3xl font-black leading-[0.95] tracking-tight text-[#f5f0de] sm:text-5xl lg:text-6xl">
                {show.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-white/75">
                {show.release_date && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatReleaseYear(show.release_date)}
                  </span>
                )}
                {show.runtime && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatRuntime(show.runtime)}
                  </span>
                )}
                {show.language && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {show.language.toUpperCase()}
                  </span>
                )}
                {show.status && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {show.status}
                  </span>
                )}
                {show.network?.name && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {show.network.name}
                  </span>
                )}
              </div>

              {show.overview && (
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                  {show.overview}
                </p>
              )}

              <div className="mt-6 flex w-full max-w-2xl flex-wrap justify-center gap-2.5">
                <button
                  onClick={() => setShowLogMovieModal(true)}
                  className="inline-flex min-w-[11rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#ff8a1e]/25 bg-[#ff8a1e] px-4 py-3 text-sm font-bold text-black shadow-[0_10px_28px_rgba(255,138,30,0.18)] transition-transform hover:translate-y-[-1px]"
                >
                  <LogsIcon className="h-4 w-4" />
                  Log Show
                </button>
                <button
                  onClick={() => router.push(`/share?show_id=${show.id}`)}
                  className="inline-flex min-w-[11rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button
                  onClick={() => setShowAddToListModal(true)}
                  className="inline-flex min-w-[11rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10"
                >
                  <Bookmark className="h-4 w-4" />
                  Add to List
                </button>
              </div>

              <div className="mt-8 grid w-full gap-3 md:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-white/70">
                      Rating Distribution
                    </h2>
                    <span className="text-xs text-white/45">{reactionBreakdown.total} logs</span>
                  </div>
                  {[
                    { label: "Bad", value: reactionBreakdown.bad, color: "bg-rose-400" },
                    { label: "Average", value: reactionBreakdown.average, color: "bg-amber-400" },
                    { label: "Good", value: reactionBreakdown.good, color: "bg-blue-400" },
                    { label: "Masterpiece", value: reactionBreakdown.masterpiece, color: "bg-[#ff8a1e]" },
                  ].map((item) => {
                    const percent = reactionBreakdown.total > 0 ? Math.round((item.value / reactionBreakdown.total) * 100) : 0;
                    return (
                      <div key={item.label} className="mb-3 last:mb-0">
                        <div className="mb-1.5 flex justify-between text-xs text-white/75">
                          <span>{item.label}</span>
                          <span>
                            {item.value} ({percent}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:w-[18rem] md:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Network</p>
                    <p className="mt-2 line-clamp-2 text-sm font-bold text-white">{show.network?.name || "Unknown"}</p>
                  </div>
                  <Link
                    href="#reviews-section"
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Reviews</p>
                    <p className="mt-2 text-sm font-bold text-white">{reviews.length} comments</p>
                  </Link>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-white/55">
                {(show.genres || []).slice(0, 5).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="bg-neutral-950">
          <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
            <div>
              <h2 className="mb-5 text-2xl font-bold">Your Log History</h2>
              {userLogHistory.length > 0 ? (
                <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
                  {userLogHistory.map((log) => {
                    const label = getReactionLabelFromLogReaction(log.reaction);
                    return (
                      <div key={log.id} className="p-4 sm:p-5">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-white/70">
                            Watched on {new Date(log.watched_date).toLocaleDateString()}
                          </p>
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
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
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
                    className="mb-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/20"
                    onClick={() => setShowAllLogs((value) => !value)}
                  >
                    {showAllLogs ? "Hide log history" : `Show log history (${allLogs.length})`}
                  </button>
                  {showAllLogs && (
                    <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
                      {allLogs.map((log) => {
                        const label = getReactionLabelFromLogReaction(log.reaction);
                        return (
                          <div key={log.id} className="flex items-center gap-4 p-4 sm:p-5">
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
                              className="ml-2 rounded border border-white/20 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
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

            <div id="reviews-section">
              <h2 className="mb-5 flex items-center gap-2 text-2xl font-bold">
                <MessageCircle className="h-6 w-6" />
                Reviews & Comments ({reviews.length})
              </h2>

              {reviews.length > 0 ? (
                <div className="grid gap-4">
                  {reviews.slice(0, 3).map((review) => (
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
            </div>

            <div>
              <div id="cast-list-section" className="mb-5 flex items-center justify-between scroll-mt-24">
                <h2 className="text-2xl font-bold">Cast List</h2>
              </div>
              <div className="max-h-72 divide-y divide-white/10 overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
                {(show.cast || []).length > 0 ? (
                  (show.cast || []).map((actor, index) => (
                    <div key={actor} className="flex items-center justify-between px-4 py-3">
                      <p className="text-white/85">{actor}</p>
                      <p className="text-xs text-white/50">#{index + 1}</p>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-6 text-white/60">No cast data available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        <ContentCinePosts contentId={show.id} contentType="tv" currentUser={user} theme="brutalist" />
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
