"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import ShareModal from "@/components/ShareModal";
import CinematicLoading from "@/components/CinematicLoading";
import { User, ShareWithDetails, Content, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { getFriendLogs } from "@/lib/friend-logs";
import Link from "next/link";
import { Clapperboard, Film, MessageSquareText, Plus, Search, Share2, X } from "lucide-react";

import CinePostsFeed from "@/components/CinePostsFeed";
import CinePostModal from "@/components/CinePostModal";

type SearchAccount = {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shares, setShares] = useState<ShareWithDetails[]>([]);
  const [selectedShare, setSelectedShare] = useState<ShareWithDetails | null>(null);
  const [friendLogs, setFriendLogs] = useState<(MovieLogWithContent & { friend: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [accountResults, setAccountResults] = useState<SearchAccount[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "movie" | "tv" | "accounts">("all");

  // CinePost modal state
  const [showCinePostModal, setShowCinePostModal] = useState(false);
  const [cinePostRefreshKey, setCinePostRefreshKey] = useState(0);
  const [showQuickActions, setShowQuickActions] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user profile from Firebase
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);

        let currentUser: User | null = null;

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          currentUser = {
            id: userData.id,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt,
          };
        } else {
          // Fallback user from auth
          currentUser = {
            id: firebaseUser.uid,
            username: "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
          };
        }

        setUser(currentUser);
        setLoading(false);

        // Fetch friend logs
        if (currentUser) {
          try {
            const logs = await getFriendLogs(currentUser.id, 14, 20);
            setFriendLogs(logs);
          } catch (error) {
            console.error("Error fetching friend logs:", error);
          }
        }

        // Set up real-time listener for shares
        if (currentUser) {
          const sharesRef = ref(db, "shares");
          const unsubscribeShares = onValue(sharesRef, async (snapshot) => {
            if (!snapshot.exists()) {
              setShares([]);
              return;
            }

            const allShares = snapshot.val();
            const sharesList = Object.entries(allShares)
              .map(([id, data]: any) => ({
                id,
                ...data,
              }))
              .filter((s: any) => s.receiver_id === currentUser.id)
              .sort(
                (a: any, b: any) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              );

            // Fetch receivers for shares
            try {
              const usersRef = ref(db, "users");
              const usersSnapshot = await get(usersRef);
              const usersData = usersSnapshot.val() || {};

              // Movie data is already in the share object, no need to fetch separately
              const sharesWithDetails: ShareWithDetails[] = sharesList.map(
                (share: any) => {
                  console.log("Share ID:", share.id);
                  console.log("Receiver ID:", share.receiver_id);
                  console.log("Current user ID:", currentUser.id);
                  console.log("Share movie exists?", !!share.movie);
                  console.log("Full share object:", share);
                  
                  return {
                    ...share,
                    // Use movie data from share object if it exists
                    movie: share.movie || null,
                    sender: Object.values(usersData).find(
                      (u: any) => u.id === share.sender_id
                    ),
                  };
                }
              );

              console.log("Number of shares for this user:", sharesWithDetails.length);
              console.log("All shares with details:", sharesWithDetails);

              setShares(sharesWithDetails);
            } catch (error) {
              console.error("Error fetching shares details:", error);
              setShares(sharesList);
            }
          });

          return () => unsubscribeShares();
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setAccountResults([]);
      return;
    }

    setSearching(true);
    try {
      const [movies, shows, usersSnapshot] = await Promise.all([
        searchMovies(query),
        searchShows(query),
        get(ref(db, "users")),
      ]);

      const movieResults = movies.map((movie: any) => ({
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,
        genres: movie.genres || [],
        release_date: movie.release_date || "",
        overview: movie.overview || "",
        runtime: movie.runtime || 0,
        rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
        type: "movie" as const,
        platforms: [],
        director: null,
        created_at: new Date().toISOString(),
      }));

      const showResults = shows.map((show: any) => ({
        id: show.id,
        title: show.name || show.title,
        name: show.name,
        poster_url: show.poster_url,
        genres: show.genres || [],
        release_date: show.release_date || "",
        overview: show.overview || "",
        runtime: show.runtime || 0,
        rating: typeof show.rating === "number" ? show.rating : 0,
        type: "tv" as const,
        status: show.status,
        network: undefined,
        created_at: new Date().toISOString(),
      }));

      const combined = [...movieResults, ...showResults].slice(0, 20);
      setSearchResults(combined);

      const allUsers = usersSnapshot.val() || {};
      const normalizedQuery = query.trim().toLowerCase();
      const usersMatched = Object.values(allUsers)
        .filter((entry: any) => {
          const username = String(entry?.username || "").toLowerCase();
          const name = String(entry?.name || "").toLowerCase();
          return username.includes(normalizedQuery) || name.includes(normalizedQuery);
        })
        .slice(0, 20)
        .map((entry: any) => ({
          id: entry?.id || "",
          username: entry?.username || "",
          name: entry?.name || "User",
          avatar_url: entry?.avatar_url || null,
        }))
        .filter((entry: SearchAccount) => entry.username);

      setAccountResults(usersMatched);
      setShowSearchModal(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchShare = (movieId: number) => {
    router.push(`/share?movie_id=${movieId}`);
    setShowSearchModal(false);
    setSearchQuery("");
    setSearchResults([]);
    setAccountResults([]);
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading) {
    return <CinematicLoading message="Your home is loading" />;
  }

  if (!user) {
    return null;
  }

  // Separate unwatched shares for the home preview.
  const unwatchedShares = shares.filter((s: any) => !s.watched);

  const friendActivity = [
    ...unwatchedShares.slice(0, 6).map((share) => ({
      id: `share-${share.id}`,
      kind: "shared" as const,
      poster_url: (share.movie || share.content)?.poster_url || null,
      title: (share.movie || share.content)?.title || "Unknown",
      byline: `shared by ${share.sender?.name || "Unknown"}`,
      reaction: "",
      createdAt: share.created_at,
      onClick: () => setSelectedShare(share),
    })),
    ...friendLogs.slice(0, 8).map((log) => ({
      id: `log-${log.id}`,
      kind: "logged" as const,
      poster_url: log.content.poster_url,
      title: log.content.title,
      byline: `by ${log.friend.name}`,
      reaction: log.reaction === 2 ? "Masterpiece" : log.reaction === 1 ? "Good" : "Bad",
      createdAt: log.created_at,
      onClick: () => router.push(`/logs/${log.id}`),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10);

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="px-1 py-2 sm:p-8">
        {/* Search Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search movies, shows, and usernames..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => (searchResults.length > 0 || accountResults.length > 0) && setShowSearchModal(true)}
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Dropdown Results */}
            {showSearchModal && (searchResults.length > 0 || accountResults.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70dvh,600px)] overflow-y-auto overscroll-contain rounded-xl border border-gray-300 bg-white shadow-lg">
                {/* Filter Buttons */}
                <div className="sticky top-0 flex gap-2 overflow-x-auto border-b border-gray-200 bg-white p-3">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchFilter("movie")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "movie"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setSearchFilter("tv")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "tv"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    TV Shows
                  </button>
                  <button
                    onClick={() => setSearchFilter("accounts")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "accounts"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Accounts
                  </button>
                </div>

                {/* List Results */}
                <div className="space-y-1">
                  {searchResults
                    .filter((result) => {
                      if (searchFilter === "all") return true;
                      // Fix: match 'movie' type for Movies filter
                      if (searchFilter === "movie") return result.type === "movie";
                      if (searchFilter === "tv") return result.type === "tv";
                      return false;
                    })
                    .map((result) => (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.type === "tv" ? `/tv/${result.id}` : `/movie/${result.id}`}
                      >
                        <div className="flex items-center gap-3 border-b border-gray-100 p-3 transition-colors last:border-b-0 hover:bg-gray-100">
                          {/* Poster thumbnail */}
                          <div className="w-12 h-16 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
                            {result.poster_url ? (
                              <img
                                src={result.poster_url}
                                alt={result.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500 text-xs">
                                No Image
                              </div>
                            )}
                          </div>

                          {/* Content info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {result.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {result.release_date
                                ? result.release_date.split("-")[0]
                                : "N/A"}
                              {result.type === "tv" && (
                                <span className="ml-2 inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                                  TV
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Share Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleSearchShare(result.id);
                            }}
                            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            Share
                          </button>
                        </div>
                      </Link>
                    ))}

                  {(searchFilter === "all" || searchFilter === "accounts") && accountResults.map((account) => (
                    <Link key={`account-${account.username}`} href={`/profile/${account.username}`}>
                      <div className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                          {account.avatar_url ? (
                            <img
                              src={account.avatar_url}
                              alt={account.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-gray-600 font-semibold">
                              {account.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{account.name}</p>
                          <p className="text-xs text-gray-500 truncate">@{account.username}</p>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {searchFilter === "accounts" && accountResults.length === 0 && (
                    <div className="p-4 text-sm text-gray-600">No accounts found.</div>
                  )}
                </div>

                {searching && (
                  <div className="p-4 text-center text-gray-600">
                    <div className="w-6 h-6 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin inline-block" />
                  </div>
                )}
              </div>
            )}

            {/* Close dropdown when clicking outside */}
            {showSearchModal && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSearchModal(false)}
              />
            )}
          </div>
        </div>
        {/* Recently Watched Section (Current User) removed as requested */}

        {/* Friends Activity Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900 sm:text-2xl">
              Friends Activity
            </h2>
            <button
              type="button"
              onClick={() => setShowQuickActions(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:h-11 sm:w-11"
              aria-label="Open quick actions"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          {friendActivity.length > 0 ? (
            <>
              <div className="-mx-3 overflow-x-auto px-3 pb-4 sm:mx-0 sm:px-0">
                <div className="flex gap-2.5 sm:gap-6">
                  {friendActivity.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="w-[27vw] min-w-[5.5rem] max-w-[6.75rem] flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-shadow hover:shadow-lg sm:w-56 sm:min-w-0 sm:max-w-none sm:rounded-lg"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100 sm:h-72 sm:aspect-auto">
                        {item.poster_url ? (
                          <img
                            src={item.poster_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            No poster
                          </div>
                        )}
                      </div>
                      <div className="p-2 sm:p-3">
                        <h3 className="mb-0.5 truncate text-[11px] font-semibold leading-tight text-gray-900 sm:mb-1 sm:text-base">
                          {item.title}
                        </h3>
                        <p className="mb-1 truncate text-[10px] leading-tight text-gray-600 sm:mb-2 sm:text-sm">
                          {item.byline}
                        </p>
                        <div className="min-h-[1rem] sm:min-h-[1.5rem]">
                          <span className="text-[10px] font-medium text-gray-700 sm:text-sm">
                            {item.reaction}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Link
                href="/all-movies"
                className="mt-1 inline-flex w-full justify-center rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
              >
                View All
              </Link>
            </>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center sm:py-12">
              <Clapperboard className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-600">No friends activity yet</p>
              <p className="mt-1 text-sm text-gray-500">Share titles or follow friends to see updates here.</p>
            </div>
          )}
        </div>

        {/* Posts Section */}
        <section className="relative -mx-1 mb-8 min-h-[100dvh] overflow-hidden rounded-[2.25rem] border border-blue-100 bg-gradient-to-b from-blue-100/80 via-sky-50/90 to-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_70px_rgba(37,99,235,0.12)] sm:-mx-4 sm:px-5 sm:py-5">
          <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-blue-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-72 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-8 top-16 h-px bg-gradient-to-r from-transparent via-blue-200/70 to-transparent" />

          <div className="relative">
            <div className="mx-auto max-w-3xl">
              <CinePostsFeed currentUser={user} refreshKey={cinePostRefreshKey} />
            </div>
          </div>
        </section>

        {/* CinePost Modal */}
        <CinePostModal
          isOpen={showCinePostModal}
          onClose={() => setShowCinePostModal(false)}
          user={user}
          onCreated={() => setCinePostRefreshKey((key) => key + 1)}
        />

        {showQuickActions && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setShowQuickActions(false)}
              aria-label="Close quick actions"
            />
            <div className="relative w-full max-w-md rounded-t-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:mb-6 sm:rounded-[2rem]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Create</h3>
                  <p className="text-sm text-slate-500">Pick what you want to do next.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickActions(false)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    router.push("/logs");
                  }}
                  className="flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Film className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-slate-950">Log Movie</span>
                    <span className="block text-sm text-slate-500">Add what you watched and rate it.</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    setShowCinePostModal(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <MessageSquareText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-slate-950">Post</span>
                    <span className="block text-sm text-slate-500">Start a movie or TV discussion.</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    router.push("/share");
                  }}
                  className="flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-slate-950">Share</span>
                    <span className="block text-sm text-slate-500">Send a title recommendation to a friend.</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* More Features section removed as requested */}

        {/* Share Modal */}
        {selectedShare && (
          <ShareModal
            key={selectedShare.id}
            share={selectedShare}
            currentUserId={user?.id || ""}
            onClose={() => setSelectedShare(null)}
            user={user}
          />
        )}
      </div>
    </PageLayout>
  );
}
