"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { ArrowLeft, SlidersHorizontal, Star, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails } from "@/lib/tmdb";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { Movie, MovieReviewWithUser, User } from "@/types";

type ScopeFilter = "all" | "friends";
type SortFilter = "recent" | "oldest" | "rating";
type RatingFilter = "all" | 1 | 2 | 3 | 4 | 5;

function getReactionLabelFromRating(rating: number): "Bad" | "Good" | "Masterpiece" {
  if (rating >= 5) return "Masterpiece";
  if (rating >= 3) return "Good";
  return "Bad";
}

function getReactionBadgeClass(rating: number): string {
  const label = getReactionLabelFromRating(rating);
  if (label === "Masterpiece") return "border-[#ff8a1e]/30 bg-[#ff8a1e]/12 text-[#ffcf9b]";
  if (label === "Good") return "border-white/10 bg-white/5 text-[#f5f0de]";
  return "border-white/10 bg-white/5 text-white/65";
}

function getReviewHref(review: MovieReviewWithUser): string {
  if (review.id.startsWith("log-")) {
    return `/logs/${review.id.slice(4)}`;
  }

  return `/user/${review.user.username || review.user.id}/log`;
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

      if (ratingFilter !== "all" && review.rating !== ratingFilter) {
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

  if (loading || !user) {
    return <CinematicLoading message="Movie reviews are loading" />;
  }

  const filterButtonClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors sm:px-4 ${
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
              {filteredReviews.length} review{filteredReviews.length === 1 ? "" : "s"} shown. Click any review to open that person&apos;s log page.
            </p>
          </div>

          <div className="sticky top-0 z-20 -mx-4 border-y border-white/10 bg-black/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </div>

              <span className="text-[11px] uppercase tracking-[0.22em] text-white/35">Scope</span>
              <button type="button" className={filterButtonClass(scopeFilter === "all")} onClick={() => setScopeFilter("all")}>
                All
              </button>
              <button type="button" className={filterButtonClass(scopeFilter === "friends")} onClick={() => setScopeFilter("friends")}>
                <Users className="h-3.5 w-3.5" />
                Friends
              </button>

              <span className="ml-2 text-[11px] uppercase tracking-[0.22em] text-white/35">Sort</span>
              <button type="button" className={filterButtonClass(sortFilter === "recent")} onClick={() => setSortFilter("recent")}>
                Recent
              </button>
              <button type="button" className={filterButtonClass(sortFilter === "oldest")} onClick={() => setSortFilter("oldest")}>
                Oldest
              </button>
              <button type="button" className={filterButtonClass(sortFilter === "rating")} onClick={() => setSortFilter("rating")}>
                <Star className="h-3.5 w-3.5" />
                Rating
              </button>

              <span className="ml-2 text-[11px] uppercase tracking-[0.22em] text-white/35">Rating</span>
              {(["all", 5, 4, 3, 2, 1] as RatingFilter[]).map((value) => {
                const active = ratingFilter === value;
                const label = value === "all" ? "All" : `${value}★`;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    className={filterButtonClass(active)}
                    onClick={() => setRatingFilter(value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            {filteredReviews.length > 0 ? (
              <div className="divide-y divide-white/10">
                {filteredReviews.map((review) => (
                  <Link
                    key={review.id}
                    href={getReviewHref(review)}
                    className="group block py-5 transition-colors hover:bg-white/5"
                  >
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
                          <p className="font-semibold text-[#f5f0de] group-hover:text-white">
                            {review.user.name}
                          </p>
                          <span className="text-xs text-white/40">
                            @{review.user.username || review.user.id}
                          </span>
                          <span className="text-xs text-white/35">•</span>
                          <span className="text-xs text-white/45">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/78">
                          {review.text}
                        </p>
                      </div>

                      <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getReactionBadgeClass(review.rating)}`}>
                        {review.rating}/5
                      </span>
                    </div>
                  </Link>
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
      </div>
    </PageLayout>
  );
}
