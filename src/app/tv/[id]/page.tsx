"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import AddToListModal from "@/components/AddToListModal";
import CinematicLoading from "@/components/CinematicLoading";
import { User, TVShow, Content } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push, set } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getShowDetails } from "@/lib/tvmaze";
// Removed unused imports
import LogMovieModal from "@/components/LogMovieModal";
import { ArrowLeft, Share2, Star, Network, Calendar, Tv, Users, MessageCircle, Zap, Bookmark } from "lucide-react";
import Link from "next/link";

export default function TVShowPage() {
  const router = useRouter();
  const params = useParams();
  const showId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);

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

        // Fetch TV show details from TVMaze
        if (showId && !isNaN(Number(showId))) {
          const showDetails = await getShowDetails(Number(showId));
          if (showDetails) {
            setShow(showDetails as TVShow);
          }
        }

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

  // Removed rating logic (no longer used in new design)

  if (loading || !user) {
    return <CinematicLoading message="Your show page is loading" />;
  }

  if (!show) {
    return (
      <PageLayout user={user}>
        <div className="p-8 text-center">
          <p className="text-gray-600 text-lg">TV Show not found</p>
          <Link href="/dashboard" className="text-blue-600 mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </PageLayout>
    );
  }

  // --- Redesigned TV Show Page ---
  return (
    <PageLayout user={user} fullWidth>
      <div className="min-h-screen bg-neutral-950 text-white">
        {/* Back Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/60 hover:bg-black/80 text-white text-sm font-medium shadow"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>

        {/* Poster and Background */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0">
            {show.poster_url ? (
              <img
                src={show.poster_url}
                alt={show.title}
                className="h-full w-full object-cover opacity-60"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-black via-neutral-900 to-neutral-800 animate-pulse" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/15" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-950 to-transparent" />
          </div>
          <div className="relative z-10 px-6 pt-16 pb-8 flex flex-col md:flex-row md:items-end gap-8">
            <div className="flex-shrink-0">
              {show.poster_url ? (
                <img
                  src={show.poster_url}
                  alt={show.title}
                  className="w-44 h-64 rounded-2xl object-cover shadow-lg border border-white/10"
                />
              ) : (
                <div className="w-44 h-64 rounded-2xl bg-neutral-900 flex items-center justify-center text-3xl font-bold text-white/40">
                  ?
                </div>
              )}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg shadow"
                  onClick={() => setShowLogMovieModal(true)}
                >
                  Log Show
                </button>
                <button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow"
                  onClick={() => setShowAddToListModal(true)}
                >
                  Add to List
                </button>
                <button
                  className="w-full bg-neutral-800 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg shadow"
                  onClick={() => navigator.share ? navigator.share({ title: show.title, url: window.location.href }) : null}
                >
                  Share
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-5xl font-extrabold mb-2">{show.title}</h1>
              <div className="flex flex-wrap gap-4 items-center text-lg text-white/80 mb-4">
                {show.release_date && <span>{new Date(show.release_date).getFullYear()}</span>}
                {show.genres && show.genres.length > 0 && (
                  <>
                    <span className="font-semibold">Genres:</span>{" "}
                    <span>{show.genres.join(", ")}</span>
                  </>
                )}
                {show.language && (
                  <>
                    <span className="font-semibold">Language:</span> {show.language}
                  </>
                )}
                {show.country && (
                  <>
                    <span className="font-semibold">Country:</span> {show.country}
                  </>
                )}
                {show.streaming_services && show.streaming_services.length > 0 && (
                  <>
                    <span className="font-semibold">Streaming:</span> {show.streaming_services.join(", ")}
                  </>
                )}
              </div>
              <p className="max-w-2xl text-white/90 mb-4 text-lg">{show.overview}</p>
              <div className="flex flex-wrap gap-6 mt-4">
                {show.director && (
                  <div>
                    <div className="font-semibold text-white/80">Director</div>
                    <div className="text-white/90">{show.director}</div>
                  </div>
                )}
                {show.runtime && (
                  <div>
                    <div className="font-semibold text-white/80">Runtime</div>
                    <div className="text-white/90">{show.runtime} min</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cast List */}
        {show.cast && show.cast.length > 0 && (
          <div className="max-w-3xl mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-4">Cast</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {show.cast.map((actor: string, idx: number) => (
                <div key={idx} className="bg-white/5 rounded-lg px-4 py-3 text-white/90 text-lg font-medium flex items-center">
                  {actor}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add to List Modal */}
        <AddToListModal
          isOpen={showAddToListModal}
          onClose={() => setShowAddToListModal(false)}
          content={show as Content}
          user={user}
        />

        {/* Log TV Show Modal */}
        <LogMovieModal
          isOpen={showLogMovieModal}
          onClose={() => setShowLogMovieModal(false)}
          content={show as Content}
          user={user}
        />
      </div>
    </PageLayout>
  );
// End of file
}
