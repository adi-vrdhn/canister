"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import MovieCard from "@/components/MovieCard";
import ShareModal from "@/components/ShareModal";
import { User, ShareWithDetails, Movie, TVShow, Content, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { getFriendLogs } from "@/lib/friend-logs";
import { getUserMovieLogs } from "@/lib/logs";
import RecentlyWatched from "@/components/RecentlyWatched";
import Link from "next/link";
import { Share2, LogIn, Clapperboard, Search, X, Star } from "lucide-react";

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
  const [recentLogs, setRecentLogs] = useState<{ content: Content; watched_at?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [accountResults, setAccountResults] = useState<SearchAccount[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "movies" | "tv" | "accounts">("all");

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
          // Fetch user's own recent logs
          try {
            const userLogs = await getUserMovieLogs(currentUser.id, 10);
            setRecentLogs(
              userLogs
                .filter((log) => log.watched_date)
                .map((log) => ({
                  content: log.content,
                  watched_at: log.watched_date,
                }))
            );
          } catch (error) {
            console.error("Error fetching user logs:", error);
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
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Separate unwatched and watched shares
  const unwatchedShares = shares.filter((s: any) => !s.watched);
  const watchedShares = shares.filter((s: any) => s.watched);

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8">
        {/* CANISTER Branding */}
        <div className="flex items-center justify-center mt-6 mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 uppercase">CANISTER</h1>
        </div>
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search movies, shows, and usernames..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => (searchResults.length > 0 || accountResults.length > 0) && setShowSearchModal(true)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />

            {/* Dropdown Results */}
            {showSearchModal && (searchResults.length > 0 || accountResults.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-[600px] overflow-y-auto">
                {/* Filter Buttons */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-3 flex gap-2">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      searchFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchFilter("movie")}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      searchFilter === "movie"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setSearchFilter("tv")}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      searchFilter === "tv"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    TV Shows
                  </button>
                  <button
                    onClick={() => setSearchFilter("accounts")}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
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
                      return result.type === searchFilter;
                    })
                    .map((result) => (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.type === "tv" ? `/tv/${result.id}` : `/movie/${result.id}`}
                      >
                        <div className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0">
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

        {/* Movies Shared to You Section with Share Button */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Movies shared to you
            </h2>
            <Link
              href="/share"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5" />
              Share
            </Link>
          </div>

          {shares.length > 0 ? (
            <div>
              {/* Horizontal Carousel - Always visible */}
              <div className="overflow-x-auto pb-4 mb-6">
                <div className="flex gap-8">
                  {/* Show only unwatched shares */}
                  {unwatchedShares.slice(0, 6).map((share) => (
                    <div
                      key={share.id}
                      onClick={() => setSelectedShare(share)}
                      className="flex-shrink-0 w-56 cursor-pointer"
                    >
                      <div className="pointer-events-none">
                        <MovieCard movie={share.movie} sharedBy={share.sender?.name || "Unknown"} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* View All Button - Links to separate page */}
              <Link
                href="/all-movies"
                className="inline-block px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors mb-6"
              >
                View All
              </Link>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Clapperboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No recent shares</p>
              <p className="text-gray-500 text-sm mt-1">
                Ask your friends to share movies with you
              </p>
            </div>
          )}
        </div>

        {/* Friends' Recent Logs Section */}
        {friendLogs.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Friends' recent logs
              </h2>
              <Link
                href="/friends/logs"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm border border-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                View More
              </Link>
            </div>

            {/* Horizontal Slider */}
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6">
                {friendLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    onClick={() => router.push(`/logs/${log.id}`)}
                    className="flex-shrink-0 w-56 bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    {/* Movie Poster */}
                    {log.content.poster_url && (
                      <img
                        src={log.content.poster_url}
                        alt={log.content.title}
                        className="w-full h-72 object-cover"
                      />
                    )}

                    {/* Content Info */}
                    <div className="p-3">
                      {/* Movie Title */}
                      <h3 className="font-semibold text-gray-900 truncate mb-1">
                        {log.content.title}
                      </h3>

                      {/* Friend Name */}
                      <p className="text-sm text-gray-600 mb-2">by {log.friend.name}</p>

                      {/* Reaction Badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {log.reaction === 2 ? "Masterpiece" : log.reaction === 1 ? "Good" : "Bad"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
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
