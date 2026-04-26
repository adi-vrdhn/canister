"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import ShareModal from "@/components/ShareModal";
import CinematicLoading from "@/components/CinematicLoading";
import LogMovieModal from "@/components/LogMovieModal";
import { User, ShareWithDetails, Content, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { buildLogUrl } from "@/lib/log-url";
import { getFriendLogs } from "@/lib/friend-logs";
import Link from "next/link";
import { Clapperboard, Film, Loader2, MessageCircle, MessageSquareText, Plus, Search, Share2, X } from "lucide-react";

import CinePostsFeed from "@/components/CinePostsFeed";
import CinePostModal from "@/components/CinePostModal";

type SearchAccount = {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
};

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rankSearchResults<T extends { title: string }>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;

  return [...items].sort((a, b) => {
    const score = (item: T) => {
      const title = normalizeSearchText(item.title || "");
      let value = 0;

      if (title === normalizedQuery) value += 120;
      if (title.startsWith(normalizedQuery)) value += 80;
      if (title.includes(normalizedQuery)) value += 50;

      return value;
    };

    return score(b) - score(a);
  });
}

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
  const [showQuickLogSearch, setShowQuickLogSearch] = useState(false);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickLogContent, setQuickLogContent] = useState<Content | null>(null);
  const [quickLogQuery, setQuickLogQuery] = useState("");
  const [quickLogResults, setQuickLogResults] = useState<Content[]>([]);
  const [quickLogSearching, setQuickLogSearching] = useState(false);
  const [quickLogFilter, setQuickLogFilter] = useState<"all" | "movie" | "tv">("all");

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

    if (query.trim().length < 1) {
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

      const combined = rankSearchResults(
        [...movieResults.slice(0, 12), ...showResults.slice(0, 12)],
        query
      ).slice(0, 20);
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

  const handleQuickLogSearch = async (queryText: string) => {
    setQuickLogQuery(queryText);

    if (queryText.trim().length < 1) {
      setQuickLogResults([]);
      return;
    }

    setQuickLogSearching(true);
    try {
      const movies = quickLogFilter === "tv" ? [] : await searchMovies(queryText);
      const shows = quickLogFilter === "movie" ? [] : await searchShows(queryText);

      const movieResults = movies.map((movie: any) => ({
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        genres: (movie.genres || []).map((genreId: number) => String(genreId)),
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
        title: show.name || show.title || "",
        name: show.name,
        poster_url: show.poster_url || null,
        genres: show.genres || [],
        release_date: show.release_date || "",
        overview: show.overview || "",
        runtime: show.runtime || 0,
        rating: typeof show.rating === "number" ? show.rating : 0,
        type: "tv" as const,
        status: show.status || null,
        network: undefined,
        created_at: new Date().toISOString(),
      }));

      setQuickLogResults([...movieResults, ...showResults].slice(0, 20));
    } catch (error) {
      console.error("Quick log search error:", error);
    } finally {
      setQuickLogSearching(false);
    }
  };

  useEffect(() => {
    if (showQuickLogSearch && quickLogQuery.trim().length >= 2) {
      void handleQuickLogSearch(quickLogQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickLogFilter]);

  const handleSelectQuickLogContent = (content: Content) => {
    setQuickLogContent(content);
    setShowQuickLogSearch(false);
    setShowQuickLogModal(true);
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
      byline: `by ${share.sender?.name || "Unknown"}`,
      note: share.note || null,
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
      onClick: () => router.push(buildLogUrl(log)),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10);
  const filteredQuickLogResults = quickLogResults.filter(
    (result) => quickLogFilter === "all" || result.type === quickLogFilter
  );

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <div className="min-h-screen bg-[#0a0a0a] px-4 py-4 text-[#f5f0de] sm:px-8 sm:py-6">
        {/* Search Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/40" />
            <input
              type="text"
              placeholder="Search movies, shows, and usernames..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => (searchResults.length > 0 || accountResults.length > 0) && setShowSearchModal(true)}
              className="w-full border border-white/15 bg-[#111111] py-3 pl-10 pr-4 text-base text-[#f5f0de] outline-none focus:border-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/20"
            />

            {/* Dropdown Results */}
            {showSearchModal && (searchResults.length > 0 || accountResults.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70dvh,600px)] overflow-y-auto overscroll-contain border border-white/10 bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
                {/* Filter Buttons */}
                <div className="sticky top-0 flex gap-2 overflow-x-auto border-b border-white/10 bg-[#111111] p-3">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "all"
                        ? "bg-[#f5f0de] text-[#0a0a0a]"
                        : "bg-white/5 text-[#f5f0de]/75 hover:bg-white/10"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchFilter("movie")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "movie"
                        ? "bg-[#f5f0de] text-[#0a0a0a]"
                        : "bg-white/5 text-[#f5f0de]/75 hover:bg-white/10"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setSearchFilter("tv")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "tv"
                        ? "bg-[#f5f0de] text-[#0a0a0a]"
                        : "bg-white/5 text-[#f5f0de]/75 hover:bg-white/10"
                    }`}
                  >
                    TV Shows
                  </button>
                  <button
                    onClick={() => setSearchFilter("accounts")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "accounts"
                        ? "bg-[#f5f0de] text-[#0a0a0a]"
                        : "bg-white/5 text-[#f5f0de]/75 hover:bg-white/10"
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
                        <div className="flex items-center gap-3 border-b border-white/10 p-3 transition-colors last:border-b-0 hover:bg-white/5">
                          {/* Poster thumbnail */}
                          <div className="w-12 h-16 flex-shrink-0 overflow-hidden border border-white/10 bg-[#1a1a1a]">
                            {result.poster_url ? (
                              <img
                                src={result.poster_url}
                                alt={result.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-xs text-white/35">
                                No Image
                              </div>
                            )}
                          </div>

                          {/* Content info */}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f5f0de]">
                              {result.title}
                            </p>
                            <p className="text-xs text-white/50">
                              {result.release_date
                                ? result.release_date.split("-")[0]
                                : "N/A"}
                              {result.type === "tv" && (
                                <span className="ml-2 inline-block bg-[#ff7a1a]/15 px-2 py-0.5 text-xs font-medium text-[#ffb36b]">
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
                            className="flex-shrink-0 bg-[#ff7a1a] px-3 py-1.5 text-xs font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
                          >
                            Share
                          </button>
                        </div>
                      </Link>
                    ))}

                  {(searchFilter === "all" || searchFilter === "accounts") && accountResults.map((account) => (
                    <Link key={`account-${account.username}`} href={`/profile/${account.username}`}>
                      <div className="flex cursor-pointer items-center gap-3 border-b border-white/10 p-3 transition-colors last:border-b-0 hover:bg-white/5">
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-[#1a1a1a]">
                          {account.avatar_url ? (
                            <img
                              src={account.avatar_url}
                              alt={account.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/55">
                              {account.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#f5f0de]">{account.name}</p>
                          <p className="truncate text-xs text-white/50">@{account.username}</p>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {searchFilter === "accounts" && accountResults.length === 0 && (
                    <div className="p-4 text-sm text-white/55">No accounts found.</div>
                  )}
                </div>

                {searching && (
                  <div className="p-4 text-center text-white/55">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-white/15 border-t-[#ff7a1a]" />
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
            <h2 className="text-base font-bold text-[#f5f0de] sm:text-2xl">
              Friends Activity
            </h2>
            <button
              type="button"
              onClick={() => setShowQuickActions(true)}
              className="inline-flex h-10 w-10 items-center justify-center bg-[#ff7a1a] text-[#0a0a0a] transition hover:bg-[#ff8d3b] sm:h-11 sm:w-11"
              aria-label="Open quick actions"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          {friendActivity.length > 0 ? (
            <>
              <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0 sm:pb-4">
                <div className="flex gap-2 sm:gap-4">
                  {friendActivity.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="w-[6rem] min-w-[6rem] max-w-[6rem] flex-shrink-0 cursor-pointer overflow-hidden border border-white/10 bg-[#111111] text-left transition hover:border-[#ff7a1a]/50 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)] sm:w-52 sm:min-w-0 sm:max-w-none"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a] sm:h-64 sm:aspect-auto">
                        {item.poster_url ? (
                          <img
                            src={item.poster_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                            No poster
                          </div>
                        )}
                      </div>
                      <div className="p-1.5 sm:p-3">
                        <h3 className="mb-0.5 truncate text-[9px] font-semibold leading-tight text-[#f5f0de] sm:mb-1 sm:text-base">
                          {item.title}
                        </h3>
                        <p className="mb-1 truncate text-[8px] leading-tight text-white/55 sm:mb-2 sm:text-sm">
                          {item.byline}
                        </p>
                        <div className="flex items-end justify-between gap-2">
                          <span className="text-[8px] font-medium uppercase tracking-[0.16em] text-[#ff7a1a] sm:text-[10px]">
                            {item.kind === "shared" ? "shared" : item.reaction}
                          </span>
                          {item.kind === "shared" && item.note ? (
                            <span
                              className="inline-flex items-center justify-center text-[#f5f0de]"
                              aria-label="Contains message"
                              title="Contains message"
                            >
                              <MessageCircle className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                            </span>
                          ) : (
                            <span className="min-h-[0.75rem]" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Link
                href="/all-movies"
                className="mt-1 inline-flex w-full justify-center border border-[#ff7a1a] px-3 py-1.5 text-xs font-medium text-[#ffb36b] transition-colors hover:bg-[#ff7a1a]/10 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
              >
                View All
              </Link>
            </>
          ) : (
            <div className="border border-white/10 bg-[#111111] px-4 py-10 text-center sm:py-12">
              <Clapperboard className="mx-auto mb-3 h-12 w-12 text-white/20" />
              <p className="font-medium text-[#f5f0de]">No friends activity yet</p>
              <p className="mt-1 text-sm text-white/55">Share titles or follow friends to see updates here.</p>
            </div>
          )}
        </div>

        {/* Posts Section */}
        <section className="relative mb-8 min-h-[100dvh] px-0 py-0">
          <div className="relative">
            <div className="mx-auto w-full max-w-none">
              <CinePostsFeed currentUser={user} refreshKey={cinePostRefreshKey} theme="brutalist" />
            </div>
          </div>
        </section>

        {/* CinePost Modal */}
        <CinePostModal
          isOpen={showCinePostModal}
          onClose={() => setShowCinePostModal(false)}
          user={user}
          onCreated={() => setCinePostRefreshKey((key) => key + 1)}
          theme="brutalist"
        />

        {showQuickActions && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setShowQuickActions(false)}
              aria-label="Close quick actions"
            />
            <div className="relative w-full max-w-md border border-white/10 bg-[#111111] p-4 text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:mb-6 sm:rounded-[2rem]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-[#f5f0de]">Create</h3>
                  <p className="text-sm text-white/55">Pick what you want to do next.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickActions(false)}
                  className="rounded-full border border-white/10 p-2 text-white/55 transition hover:bg-white/5 hover:text-[#f5f0de]"
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
                    setQuickLogQuery("");
                    setQuickLogResults([]);
                    setQuickLogFilter("all");
                    setShowQuickLogSearch(true);
                  }}
                  className="flex w-full items-center gap-3 border border-white/10 bg-[#0d0d0d] p-3 text-left transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.04]"
                >
                  <span className="flex h-11 w-11 items-center justify-center bg-[#f5f0de] text-[#0a0a0a]">
                    <Film className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-[#f5f0de]">Log Movie</span>
                    <span className="block text-sm text-white/55">Add what you watched and rate it.</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    setShowCinePostModal(true);
                  }}
                  className="flex w-full items-center gap-3 border border-white/10 bg-[#0d0d0d] p-3 text-left transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.04]"
                >
                  <span className="flex h-11 w-11 items-center justify-center bg-[#ff7a1a] text-[#0a0a0a]">
                    <MessageSquareText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-[#f5f0de]">Post</span>
                    <span className="block text-sm text-white/55">Start a movie or TV discussion.</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    router.push("/share");
                  }}
                  className="flex w-full items-center gap-3 border border-white/10 bg-[#0d0d0d] p-3 text-left transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.04]"
                >
                  <span className="flex h-11 w-11 items-center justify-center bg-[#f5f0de] text-[#0a0a0a]">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-[#f5f0de]">Share</span>
                    <span className="block text-sm text-white/55">Send a title recommendation to a friend.</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showQuickLogSearch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-2 sm:items-center sm:p-4">
            <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden border border-white/10 bg-[#111111] text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-6">
                <div>
                  <h2 className="text-lg font-black text-[#f5f0de] sm:text-xl">Search & Log Movie</h2>
                  <p className="mt-1 text-sm text-white/55">Choose a movie or show, then log it here.</p>
                </div>
                <button
                  onClick={() => setShowQuickLogSearch(false)}
                  className="rounded-full border border-white/10 p-2 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                  aria-label="Close search modal"
                  title="Close search modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b border-white/10 p-4 sm:p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/40" />
                  <input
                    type="text"
                    placeholder="Search movies & shows..."
                    value={quickLogQuery}
                    onChange={(e) => handleQuickLogSearch(e.target.value)}
                    autoFocus
                    className="w-full border border-white/15 bg-[#0d0d0d] py-3 pl-10 pr-4 text-base text-[#f5f0de] outline-none focus:border-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/20"
                  />
                </div>
              </div>

              {(quickLogResults.length > 0 || quickLogQuery.length >= 1 || quickLogSearching) && (
                <>
                  <div className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#111111] p-4">
                    {(["all", "movie", "tv"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setQuickLogFilter(filter)}
                        className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          quickLogFilter === filter
                            ? "bg-[#f5f0de] text-[#0a0a0a]"
                            : "bg-white/5 text-[#f5f0de]/75 hover:bg-white/10"
                        }`}
                      >
                        {filter === "all" ? "All" : filter === "movie" ? "Movies" : "TV Shows"}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {filteredQuickLogResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() => handleSelectQuickLogContent(result)}
                        className="flex w-full cursor-pointer items-center gap-3 border-b border-white/10 p-4 text-left transition-colors last:border-b-0 hover:bg-white/5"
                      >
                        {result.poster_url ? (
                          <img
                            src={result.poster_url}
                            alt={result.title}
                            className="h-20 w-14 object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-14 items-center justify-center bg-[#1a1a1a] text-xs text-white/35">
                            No Image
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-semibold text-[#f5f0de]">{result.title}</h3>
                          <p className="text-sm text-white/55">{result.type === "tv" ? "TV Show" : "Movie"}</p>
                        </div>
                      </button>
                    ))}

                    {filteredQuickLogResults.length === 0 && quickLogQuery.length >= 1 && !quickLogSearching && (
                      <div className="p-10 text-center text-white/55">
                        No {quickLogFilter === "tv" ? "TV shows" : quickLogFilter === "movie" ? "movies" : "results"} found.
                      </div>
                    )}
                  </div>
                </>
              )}

            {quickLogQuery.length < 1 && !quickLogSearching && (
                <div className="p-12 text-center">
                  <Film className="mx-auto mb-3 h-12 w-12 text-white/20" />
                  <p className="text-white/60">Search for what you watched.</p>
                </div>
              )}

              {quickLogSearching && (
                <div className="p-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff7a1a]" />
                </div>
              )}
            </div>
          </div>
        )}

        {quickLogContent && user && (
          <LogMovieModal
            isOpen={showQuickLogModal}
            onClose={() => {
              setShowQuickLogModal(false);
              setQuickLogContent(null);
            }}
            content={quickLogContent}
            user={user}
            onLogCreated={() => {
              setShowQuickLogModal(false);
              setQuickLogContent(null);
              router.push("/logs");
            }}
            theme="brutalist"
          />
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
            theme="brutalist"
          />
        )}
      </div>
    </PageLayout>
  );
}
