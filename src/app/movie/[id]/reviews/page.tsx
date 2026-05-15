"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { ArrowLeft, Filter, Heart, X, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails } from "@/lib/tmdb";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { Movie, MovieReviewWithUser, User } from "@/types";
import { getLogLikes, likeLog, unlikeLog } from "@/lib/log-likes";

type ScopeFilter = "all" | "friends";
type SortFilter = "recent" | "oldest" | "rating";
type RatingFilter = "all" | "bad" | "average" | "good" | "masterpiece";

function getReactionLabelFromRating(rating: number): "Bad" | "Average" | "Good" | "Masterpiece" {
  if (rating >= 5) return "Masterpiece";
  if (rating >= 4) return "Good";
  if (rating >= 3) return "Average";
  return "Bad";
}

function getReactionBadgeClass(rating: number): string {
  const label = getReactionLabelFromRating(rating);
  if (label === "Masterpiece") return "border-[#ff8a1e]/30 bg-[#ff8a1e]/12 text-[#ffcf9b]";
  if (label === "Good") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (label === "Average") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-white/65";
}

function getRatingGroup(rating: number): Exclude<RatingFilter, "all"> {
  if (rating >= 5) return "masterpiece";
  if (rating >= 4) return "good";
  if (rating >= 3) return "average";
  return "bad";
}

function getReviewHref(review: MovieReviewWithUser): string {
  if (review.id.startsWith("log-")) {
    return `/logs/${review.id.slice(4)}`;
  }

  return `/user/${review.user.username || review.user.id}/log`;
}

function getReviewLogId(reviewId: string): string | null {
  return reviewId.startsWith("log-") ? reviewId.slice(4) : null;
}

export default function MovieReviewsPage() {
  const router = useRouter();
  const params = useParams();
  const movieId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [reviews, setReviews] = useState<MovieReviewWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("recent");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [reviewLikes, setReviewLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [likeLoadingIds, setLikeLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
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

        const followsRef = ref(db, "follows");
        const followsSnapshot = await get(followsRef);
        if (followsSnapshot.exists()) {
          const allFollows = followsSnapshot.val();
          const acceptedFriendIds = new Set<string>();

          Object.values(allFollows).forEach((follow: any) => {
            if (follow.status !== "accepted") return;
            if (follow.follower_id === currentUser.id) acceptedFriendIds.add(follow.following_id);
            if (follow.following_id === currentUser.id) acceptedFriendIds.add(follow.follower_id);
          });

          setFriendIds(Array.from(acceptedFriendIds));
        } else {
          setFriendIds([]);
        }

        if (!Number.isNaN(movieId)) {
          const [movieDetails, reviewFeed] = await Promise.all([
            getMovieDetails(movieId),
            getMovieReviewFeed(movieId, "movie"),
          ]);

          if (movieDetails) {
            setMovie({ ...movieDetails, created_at: new Date().toISOString() } as Movie);
          }

          setReviews(reviewFeed);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading movie reviews page:", error);
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

  const filteredReviews = useMemo(() => {
    const friendSet = new Set(friendIds);

    const filtered = reviews.filter((review) => {
      if (scopeFilter === "friends" && !friendSet.has(review.user_id)) {
        return false;
      }

      if (ratingFilter !== "all" && getRatingGroup(review.rating) !== ratingFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortFilter === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortFilter === "rating") {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [friendIds, ratingFilter, reviews, scopeFilter, sortFilter]);

  const toggleReviewExpanded = (reviewId: string) => {
    setExpandedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  };

  useEffect(() => {
    if (!user || reviews.length === 0) {
      setReviewLikes({});
      return;
    }

    let cancelled = false;

    const loadLikes = async () => {
      const likeEntries = await Promise.all(
        reviews.map(async (review) => {
          const logId = getReviewLogId(review.id);
          if (!logId) return null;

          const likes = await getLogLikes(logId, user.id);
          return [review.id, likes] as const;
        })
      );

      if (cancelled) return;

      const nextState: Record<string, { count: number; liked: boolean }> = {};
      likeEntries.forEach((entry) => {
        if (!entry) return;
        nextState[entry[0]] = entry[1];
      });
      setReviewLikes(nextState);
    };

    void loadLikes();

    return () => {
      cancelled = true;
    };
  }, [reviews, user]);

  const handleToggleReviewLike = async (review: MovieReviewWithUser) => {
    if (!user) return;
    const logId = getReviewLogId(review.id);
    if (!logId) return;

    const current = reviewLikes[review.id] || { count: 0, liked: false };
    if (likeLoadingIds.has(review.id)) return;

    setLikeLoadingIds((currentIds) => {
      const next = new Set(currentIds);
      next.add(review.id);
      return next;
    });

    try {
      if (current.liked) {
        await unlikeLog(logId, user.id);
        setReviewLikes((state) => ({
          ...state,
          [review.id]: {
            count: Math.max(0, current.count - 1),
            liked: false,
          },
        }));
      } else {
        await likeLog(logId, user.id);
        setReviewLikes((state) => ({
          ...state,
          [review.id]: {
            count: current.count + 1,
            liked: true,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to update review like:", error);
    } finally {
      setLikeLoadingIds((currentIds) => {
        const next = new Set(currentIds);
        next.delete(review.id);
        return next;
      });
    }
  };

  if (loading || !user) {
    return <CinematicLoading message="Movie reviews are loading" />;
  }

  const filterButtonClass = (active: boolean) =>
    `inline-flex items-center justify-center gap-2 rounded-none border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
      active
        ? "border border-[#ff8a1e]/30 bg-[#ff8a1e] text-black"
        : "border border-white/10 bg-white/5 text-white/70 hover:border-[#ff8a1e]/25 hover:bg-[#ff8a1e]/10 hover:text-white"
    }`;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href={`/movie/${movieId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Movie
            </Link>
          </div>

          <div className="pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ff8a1e]">
              Reviews
            </p>
            <h1 className="mt-3 text-3xl font-black leading-none tracking-tight text-[#f5f0de] sm:text-5xl">
              {movie?.title || "Movie"} Reviews
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              {filteredReviews.length} review{filteredReviews.length === 1 ? "" : "s"} shown.
            </p>

            <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>
          </div>

          <div className="mt-6">
            {filteredReviews.length > 0 ? (
              <div className="divide-y divide-white/10">
                {filteredReviews.map((review) => (
                  <article key={review.id} className="group py-5 transition-colors hover:bg-white/5">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                        {review.user.avatar_url ? (
                          <img
                            src={review.user.avatar_url}
                            alt={review.user.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[#f5f0de]">
                            {review.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-semibold text-[#f5f0de] group-hover:text-white">{review.user.name}</p>
                          <span className="text-xs text-white/40">
                            @{review.user.username || review.user.id}
                          </span>
                          <span className="text-xs text-white/35">•</span>
                          <span className="text-xs text-white/45">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                          <Link
                            href={getReviewHref(review)}
                            className="text-xs font-semibold text-[#ffb36b] transition hover:text-[#ffcf9b]"
                          >
                            Open log
                          </Link>
                        </div>

                        <p className={`mt-2 text-sm leading-6 text-white/78 ${expandedReviewIds.has(review.id) ? "" : "line-clamp-3"}`}>
                          {review.text}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {review.text.length > 180 && (
                            <button
                              type="button"
                              onClick={() => toggleReviewExpanded(review.id)}
                              className="inline-flex items-center rounded-none border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 transition hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
                            >
                              {expandedReviewIds.has(review.id) ? "Show less" : "Show more"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleReviewLike(review)}
                            disabled={likeLoadingIds.has(review.id)}
                            className={`inline-flex items-center gap-2 rounded-none border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              reviewLikes[review.id]?.liked
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                                : "border-white/10 bg-white/5 text-white/70 hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${reviewLikes[review.id]?.liked ? "fill-current" : ""}`} />
                            <span className="tabular-nums">{reviewLikes[review.id]?.count ?? 0}</span>
                            <span className="hidden sm:inline">{reviewLikes[review.id]?.liked ? "Liked" : "Like"}</span>
                          </button>
                        </div>
                      </div>

                      <span
                        className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getReactionBadgeClass(review.rating)}`}
                      >
                        {getReactionLabelFromRating(review.rating)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-white/60">No reviews match these filters.</p>
                <p className="mt-2 text-xs text-white/40">
                  Try switching to All, widening the rating filter, or opening Recent.
                </p>
              </div>
            )}
          </div>
        </div>

        {showFilterModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="w-full max-w-md rounded-none border border-white/10 bg-[#0f0f0f] p-4 text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/80">Filters</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight">Refine reviews</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="rounded-none border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Scope</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={filterButtonClass(scopeFilter === "all")}
                      onClick={() => setScopeFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={filterButtonClass(scopeFilter === "friends")}
                      onClick={() => setScopeFilter("friends")}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Friends
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Sort</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={filterButtonClass(sortFilter === "recent")}
                      onClick={() => setSortFilter("recent")}
                    >
                      Recent
                    </button>
                    <button
                      type="button"
                      className={filterButtonClass(sortFilter === "oldest")}
                      onClick={() => setSortFilter("oldest")}
                    >
                      Oldest
                    </button>
                    <button
                      type="button"
                      className={filterButtonClass(sortFilter === "rating")}
                      onClick={() => setSortFilter("rating")}
                    >
                      Rating
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Rating</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["all", "All"],
                      ["bad", "Bad"],
                      ["average", "Average"],
                      ["good", "Good"],
                      ["masterpiece", "Masterpiece"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={filterButtonClass(ratingFilter === value)}
                        onClick={() => setRatingFilter(value as RatingFilter)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setScopeFilter("all");
                    setSortFilter("recent");
                    setRatingFilter("all");
                  }}
                  className="text-sm font-semibold text-white/55 transition hover:text-white"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="rounded-none bg-[#ff8a1e] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff9a3d]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
