"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { ArrowLeft, MessageCircle } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails } from "@/lib/tmdb";
import { getMovieReviewFeed } from "@/lib/movie-reviews";
import { Movie, MovieReviewWithUser, User } from "@/types";

function getReactionLabelFromRating(rating: number): "Bad" | "Good" | "Masterpiece" {
  if (rating >= 5) return "Masterpiece";
  if (rating >= 3) return "Good";
  return "Bad";
}

function getReactionBadgeClass(rating: number): string {
  const label = getReactionLabelFromRating(rating);
  if (label === "Masterpiece") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  if (label === "Good") return "bg-blue-500/20 text-blue-300 border-blue-400/30";
  return "bg-rose-500/20 text-rose-300 border-rose-400/30";
}

export default function MovieReviewsPage() {
  const router = useRouter();
  const params = useParams();
  const movieId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [reviews, setReviews] = useState<MovieReviewWithUser[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading || !user) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-4 mb-8">
            <Link
              href={`/movie/${movieId}`}
              className="inline-flex items-center gap-2 text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-4 py-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Movie
            </Link>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 sm:p-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{movie?.title || "Movie"} Reviews</h1>
            <p className="mt-2 text-white/60 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-semibold text-white">{review.user.name}</p>
                      <p className="text-sm text-white/50">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${getReactionBadgeClass(review.rating)}`}>
                      {getReactionLabelFromRating(review.rating)}
                    </span>
                  </div>
                  <p className="text-white/80 leading-7 whitespace-pre-wrap">{review.text}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center text-white/60">
                No reviews yet for this movie.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
