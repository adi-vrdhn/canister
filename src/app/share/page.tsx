"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import SearchBar from "@/components/SearchBar";
import CinematicLoading from "@/components/CinematicLoading";
import ShareModal from "@/components/ShareModal";
import { Content, ShareWithDetails, TMDBMovie, User } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, set } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails, searchMovies } from "@/lib/tmdb";
import { getShowDetails, searchShows, ShowDetails } from "@/lib/tvmaze";
import { hasUserWatchedContent } from "@/lib/watched-movies";
import { isUsernameBlocked, mergeSettings } from "@/lib/settings";
import { createShareReceivedNotification } from "@/lib/notifications";
import { ChevronLeft, ChevronRight, SendHorizontal, Trash2 } from "lucide-react";

type SearchResultItem = {
  id: string | number;
  title: string;
  subtitle?: string;
  image?: string;
  year?: string;
  type?: "movie" | "tv";
  originalId?: number;
};

type DatabaseUser = {
  id: string;
  username: string;
  name: string;
  avatar_url?: string | null;
  createdAt?: string;
  email?: string;
  bio?: string;
};

type FollowRecord = {
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
};

type ShareRecord = {
  sender_id: string;
  receiver_id: string;
  created_at: string;
  movie?: Content | null;
  content?: Content | null;
} & Record<string, unknown>;

function createMovieContent(
  movie: Awaited<ReturnType<typeof getMovieDetails>>,
  createdAt: string
): Content | null {
  if (!movie) return null;

  return {
    ...movie,
    type: "movie",
    created_at: createdAt,
  };
}

function createShowContent(show: ShowDetails, createdAt: string): Content {
  return {
    id: show.id,
    title: show.title || show.name,
    name: show.name,
    poster_url: show.poster_url ?? show.image?.original ?? show.image?.medium ?? null,
    genres: show.genres ?? [],
    director: show.director ?? null,
    actors: show.actors ?? null,
    cast: show.cast ?? null,
    language: show.language ?? null,
    status: show.status ?? null,
    country: show.country ?? null,
    release_date: show.release_date ?? show.premiered ?? null,
    overview: show.overview ?? show.summary ?? null,
    runtime: show.runtime ?? null,
    rating: show.rating ?? null,
    created_at: createdAt,
    type: "tv",
    network: show.network,
    streaming_services: show.streaming_services ?? null,
  };
}

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const movieIdParam = searchParams.get("movie_id");
  const showIdParam = searchParams.get("show_id");
  const contentIdParam = searchParams.get("content_id");
  const typeParam = searchParams.get("type");
  const shareIdParam = searchParams.get("share_id");
  const panelParam = searchParams.get("panel");

  const [sharedSearchQuery, setSharedSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"share" | "history">(() =>
    panelParam === "history" ? "history" : "share"
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [followersSearchQuery, setFollowersSearchQuery] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState<"all" | "movies" | "tv">("all");
  const [yearFilter, setYearFilter] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [sentShares, setSentShares] = useState<ShareWithDetails[]>([]);
  const [selectedShare, setSelectedShare] = useState<ShareWithDetails | null>(null);
  const [showWatchConflictModal, setShowWatchConflictModal] = useState(false);
  const [pendingShareRecipients, setPendingShareRecipients] = useState<User[]>([]);
  const [watchConflictRecipients, setWatchConflictRecipients] = useState<User[]>([]);
  const hasInitializedFromParams = useRef(false);

  useEffect(() => {
    let unsubscribeFollowers = () => {};
    let unsubscribeShares = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const latestCurrentUserSettings = mergeSettings(userSnapshot.exists() ? userSnapshot.val()?.settings : null);

        let currentUser: User;

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          currentUser = {
            id: userData.id,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt,
            email: userData.email,
            bio: userData.bio,
          };
        } else {
          currentUser = {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
            email: firebaseUser.email || undefined,
            bio: "",
          };
        }

        setUser(currentUser);

        if (!hasInitializedFromParams.current) {
          hasInitializedFromParams.current = true;
          if (movieIdParam) {
            const movieId = Number.parseInt(movieIdParam, 10);
            if (!Number.isNaN(movieId)) {
              try {
                const movie = await getMovieDetails(movieId);
                if (movie) {
                  setSelectedContent(createMovieContent(movie, new Date().toISOString()));
                  setCurrentStep(2);
                }
              } catch (error) {
                console.error("Error fetching movie from URL param:", error);
              }
            }
          } else if (showIdParam) {
            const showId = Number.parseInt(showIdParam, 10);
            if (!Number.isNaN(showId)) {
              try {
                const show = await getShowDetails(showId);
                if (show) {
                  setSelectedContent(createShowContent(show, new Date().toISOString()));
                  setCurrentStep(2);
                }
              } catch (error) {
                console.error("Error fetching TV show from URL param:", error);
              }
            }
          } else if (contentIdParam && typeParam) {
            const contentId = Number.parseInt(contentIdParam, 10);
            if (!Number.isNaN(contentId)) {
              try {
                if (typeParam === "tv") {
                  const show = await getShowDetails(contentId);
                  if (show) {
                    setSelectedContent(createShowContent(show, new Date().toISOString()));
                    setCurrentStep(2);
                  }
                } else {
                  const movie = await getMovieDetails(contentId);
                  if (movie) {
                    setSelectedContent(createMovieContent(movie, new Date().toISOString()));
                    setCurrentStep(2);
                  }
                }
              } catch (error) {
                console.error("Error fetching content from URL param:", error);
              }
            }
          }
        }

        setLoading(false);

        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        const usersData = (usersSnapshot.val() || {}) as Record<string, DatabaseUser>;

        const resolveUserById = (userId: string): User | undefined => {
          const direct = usersData[userId];
          if (direct) {
            return {
              id: direct.id,
              username: direct.username,
              name: direct.name,
              avatar_url: direct.avatar_url || null,
              created_at: direct.createdAt || new Date().toISOString(),
              email: direct.email,
              bio: direct.bio,
            };
          }

          const fallback = Object.values(usersData).find((entry) => entry?.id === userId);
          if (!fallback) {
            return undefined;
          }

          return {
            id: fallback.id,
            username: fallback.username,
            name: fallback.name,
            avatar_url: fallback.avatar_url || null,
            created_at: fallback.createdAt || new Date().toISOString(),
            email: fallback.email,
            bio: fallback.bio,
          };
        };

        const followsRef = ref(db, "follows");
        unsubscribeFollowers = onValue(followsRef, (snapshot) => {
          try {
            if (!snapshot.exists()) {
              setFollowers([]);
              return;
            }

            const followsData = snapshot.val() as Record<string, FollowRecord>;
            const followersList = Object.values(followsData)
              .filter((follow) => follow.follower_id === currentUser.id && follow.status === "accepted")
              .map((follow) => resolveUserById(follow.following_id))
              .filter((friend): friend is User => {
                if (!friend) return false;
                const rawFriend = usersData[friend.id];
                const friendSettings = mergeSettings((rawFriend as any)?.settings);
                return (
                  friendSettings.account.status === "active" &&
                  !isUsernameBlocked(latestCurrentUserSettings, friend.username) &&
                  !isUsernameBlocked(friendSettings, currentUser.username)
                );
              });

            setFollowers(followersList);
          } catch (error) {
            console.error("Error fetching followers:", error);
            setFollowers([]);
          }
        });

        const sharesRef = ref(db, "shares");
        unsubscribeShares = onValue(sharesRef, (snapshot) => {
          if (!snapshot.exists()) {
            setSentShares([]);
            return;
          }

          try {
            const sharesData = snapshot.val() as Record<string, ShareRecord>;
            const sent = Object.entries(sharesData)
              .map(([id, data]) => ({ id, ...data }))
              .filter((share) => share.sender_id === currentUser.id)
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              .map((share) => ({
                ...share,
                movie: share.movie || null,
                content: share.content || share.movie || null,
                receiver: resolveUserById(share.receiver_id),
              }));

            setSentShares(sent as ShareWithDetails[]);
          } catch (error) {
            console.error("Error fetching sent shares:", error);
            setSentShares([]);
          }
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeFollowers();
      unsubscribeShares();
      unsubscribeAuth();
    };
  }, [
    router,
    movieIdParam,
    showIdParam,
    contentIdParam,
    typeParam,
  ]);

  useEffect(() => {
    if (!user || !shareIdParam) return;

    const loadShareFromId = async () => {
      const existing = sentShares.find((share) => share.id === shareIdParam);
      if (existing) {
        setSelectedShare(existing);
        setActivePanel("history");
        return;
      }

      try {
        const shareSnapshot = await get(ref(db, `shares/${shareIdParam}`));
        if (!shareSnapshot.exists()) return;

        const shareData = shareSnapshot.val() as ShareRecord;
        const usersSnapshot = await get(ref(db, "users"));
        const usersData = usersSnapshot.val() || {};
        const resolveUserById = (userId: string): User | undefined =>
          Object.values(usersData).find((entry: any) => entry?.id === userId) as User | undefined;

        setSelectedShare({
          id: shareIdParam,
          ...shareData,
          movie: shareData.movie || null,
          content: shareData.content || shareData.movie || null,
          sender: resolveUserById(shareData.sender_id),
          receiver: resolveUserById(shareData.receiver_id),
        } as ShareWithDetails);
        setActivePanel("history");
      } catch (error) {
        console.error("Error loading share from URL:", error);
      }
    };

    void loadShareFromId();
  }, [sentShares, shareIdParam, user]);

  const progressPercentage = (currentStep / 2) * 100;

  const filteredFollowers = followers.filter((friend) => {
    const query = followersSearchQuery.toLowerCase();
    const username = typeof friend.username === "string" ? friend.username.toLowerCase() : "";
    const name = typeof friend.name === "string" ? friend.name.toLowerCase() : "";
    return (
      username.includes(query) ||
      name.includes(query)
    );
  });

  const filteredSentShares = sentShares.filter((share) => {
    const query = sharedSearchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const item = share.movie || share.content;
    const title = item?.title?.toLowerCase() || "";
    const receiverUsername = share.receiver?.username?.toLowerCase() || "";
    const note = share.note?.toLowerCase() || "";

    return (
      title.includes(query) ||
      receiverUsername.includes(query) ||
      note.includes(query)
    );
  });

  const filteredResults = yearFilter
    ? searchResults.filter((item) => item.year === yearFilter)
    : searchResults;

  const uniqueYears = [...new Set(searchResults.map((item) => item.year || "N/A"))]
    .filter(Boolean)
    .sort()
    .reverse();

  const handleMovieSearch = async (query: string): Promise<SearchResultItem[]> => {
    try {
      const [movies, shows] = await Promise.all([
        contentTypeFilter === "all" || contentTypeFilter === "movies"
          ? searchMovies(query).catch(() => [])
          : [],
        contentTypeFilter === "all" || contentTypeFilter === "tv"
          ? searchShows(query).catch(() => [])
          : [],
      ]);

      const movieResults = (movies as TMDBMovie[]).map((movie) => ({
        id: `movie-${movie.id}`,
        title: movie.title,
        subtitle: `${movie.release_date?.split("-")[0] || "N/A"} • Movie`,
        year: movie.release_date?.split("-")[0] || "N/A",
        image: movie.poster_path
          ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
          : undefined,
        type: "movie" as const,
        originalId: movie.id,
      }));

      const showResults = (shows as ShowDetails[]).map((show) => ({
        id: `tv-${show.id}`,
        title: show.name || show.title || "Untitled",
        subtitle: `${show.premiered?.split("-")[0] || "N/A"} • TV Show`,
        year: show.premiered?.split("-")[0] || "N/A",
        image: show.poster_url || show.image?.medium,
        type: "tv" as const,
        originalId: show.id,
      }));

      const combinedResults = [...movieResults, ...showResults];
      setSearchResults(combinedResults);
      setYearFilter("");
      return combinedResults;
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      return [];
    }
  };

  const handleSelectContent = async (item: SearchResultItem) => {
    if (!item.originalId || !item.type) {
      return;
    }

    try {
        if (item.type === "tv") {
          const showDetails = await getShowDetails(item.originalId);
          if (showDetails) {
            setSelectedContent(createShowContent(showDetails, new Date().toISOString()));
          }
        } else {
          const movieDetails = await getMovieDetails(item.originalId);
          if (movieDetails) {
            setSelectedContent(createMovieContent(movieDetails, new Date().toISOString()));
          }
        }
    } catch (error) {
      console.error("Error selecting content:", error);
    }
  };

  const handleAddRecipient = (recipientId: string) => {
    const recipient = followers.find((friend) => friend.id === recipientId);
    if (!recipient) {
      return;
    }

    if (!selectedRecipients.find((existing) => existing.id === recipientId)) {
      setSelectedRecipients((prev) => [...prev, recipient]);
    }
  };

  const handleRemoveRecipient = (recipientId: string) => {
    setSelectedRecipients((prev) => prev.filter((recipient) => recipient.id !== recipientId));
  };

  const resetShareFlow = () => {
    setCurrentStep(1);
    setSelectedContent(null);
    setSelectedRecipients([]);
    setShareNote("");
    setFollowersSearchQuery("");
    setContentTypeFilter("all");
    setYearFilter("");
    setSearchResults([]);
    setWatchConflictRecipients([]);
    setPendingShareRecipients([]);
    setShowWatchConflictModal(false);
  };

  const sendSharesToRecipients = async (recipients: User[]) => {
    if (!selectedContent || recipients.length === 0 || !user) return;

    const contentType = selectedContent.type === "tv" ? "tv" : "movie";
    for (const recipient of recipients) {
      const shareId = `share-${user.id}-${recipient.id}-${contentType}-${selectedContent.id}-${Date.now()}`;
      const createdAt = new Date().toISOString();

      await set(ref(db, `shares/${shareId}`), {
        id: shareId,
        sender_id: user.id,
        receiver_id: recipient.id,
        content_id: selectedContent.id,
        content_type: contentType,
        movie: selectedContent,
        content: selectedContent,
        note: shareNote || null,
        created_at: createdAt,
      });

      await createShareReceivedNotification(
        recipient.id,
        shareId,
        selectedContent.type === "tv"
          ? selectedContent.name || selectedContent.title || "a title"
          : selectedContent.title || "a title",
        contentType,
        user,
        createdAt,
        shareNote || null
      );
    }
  };

  const handleShare = async () => {
    if (!selectedContent || selectedRecipients.length === 0 || !user) {
      return;
    }

    try {
      const contentType = selectedContent.type === "tv" ? "tv" : "movie";
      const watchResults = await Promise.all(
        selectedRecipients.map(async (recipient) => {
          const watched = await hasUserWatchedContent(recipient.id, selectedContent.id, contentType);
          return { recipient, watched: Boolean(watched) };
        })
      );

      const watchedRecipients = watchResults.filter((result) => result.watched).map((result) => result.recipient);
      if (watchedRecipients.length > 0) {
        setPendingShareRecipients(selectedRecipients);
        setWatchConflictRecipients(watchedRecipients);
        setShowWatchConflictModal(true);
        return;
      }

      await sendSharesToRecipients(selectedRecipients);
      resetShareFlow();
    } catch (error) {
      console.error("Error sharing content:", error);
    }
  };

  const handleSendAnyway = async () => {
    try {
      await sendSharesToRecipients(pendingShareRecipients);
      resetShareFlow();
    } catch (error) {
      console.error("Error sharing content:", error);
    }
  };

  const handleSendOnlyUnwatched = async () => {
    try {
      const unwatchedRecipients = pendingShareRecipients.filter(
        (recipient) => !watchConflictRecipients.some((watched) => watched.id === recipient.id)
      );

      if (unwatchedRecipients.length > 0) {
        await sendSharesToRecipients(unwatchedRecipients);
      }
      resetShareFlow();
    } catch (error) {
      console.error("Error sharing content:", error);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      await set(ref(db, `shares/${shareId}`), null);
      setSentShares((prev) => prev.filter((share) => share.id !== shareId));
    } catch (error) {
      console.error("Error removing share:", error);
    }
  };

  const openShareDetails = (share: ShareWithDetails) => {
    setSelectedShare(share);
    setActivePanel("history");
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
    return <CinematicLoading message="Your share studio is loading" />;
  }

  if (!user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <div className="min-h-screen px-4 pb-8 pt-4 sm:px-8 sm:pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => setActivePanel("share")}
              className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold transition ${
                activePanel === "share"
                  ? "border-[#ff7a1a] bg-[#ff7a1a] text-[#0a0a0a]"
                  : "border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/[0.08]"
              }`}
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("history")}
              className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold transition ${
                activePanel === "history"
                  ? "border-[#ff7a1a] bg-[#ff7a1a] text-[#0a0a0a]"
                  : "border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/[0.08]"
              }`}
            >
              History
            </button>
          </div>

          {activePanel === "share" ? (
            <section>
              <div className="px-0 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Share Flow</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#f5f0de] sm:text-2xl">Send a recommendation</h2>
                  </div>
                  <div className="flex max-w-full gap-3 overflow-x-auto pb-1">
                    <span className={`text-xs font-semibold ${
                      currentStep === 1 ? "text-[#f5f0de]" : "text-white/35"
                    }`}>
                      1. Pick title
                    </span>
                    <span className={`text-xs font-semibold ${
                      currentStep === 2 ? "text-[#f5f0de]" : "text-white/35"
                    }`}>
                      2. Pick friends
                    </span>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden bg-white/10">
                  <div
                    className="h-full bg-[#ff7a1a] transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              <div className="min-h-[24rem] py-4 sm:min-h-[28rem] sm:py-6">
                <div
                  className={`transition-all duration-500 ${
                    currentStep === 1 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
                  } ${currentStep !== 1 ? "hidden" : ""}`}
                >
                  <h3 className="text-xl font-semibold text-[#f5f0de] sm:text-2xl">Select a Movie or Show</h3>
                  <p className="mt-1 text-sm text-white/65">Find the right title first, then continue.</p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setContentTypeFilter("all");
                        setSelectedContent(null);
                        setSearchResults([]);
                        setYearFilter("");
                      }}
                      className={`text-sm font-medium ${
                        contentTypeFilter === "all" ? "text-[#f5f0de]" : "text-white/45 hover:text-[#f5f0de]"
                      }`}
                    >
                      All
                    </button>

                    <button
                      onClick={() => {
                        setContentTypeFilter("movies");
                        setSelectedContent(null);
                        setSearchResults([]);
                        setYearFilter("");
                      }}
                      className={`text-sm font-medium ${
                        contentTypeFilter === "movies" ? "text-[#f5f0de]" : "text-white/45 hover:text-[#f5f0de]"
                      }`}
                    >
                      Movies
                    </button>

                    <button
                      onClick={() => {
                        setContentTypeFilter("tv");
                        setSelectedContent(null);
                        setSearchResults([]);
                        setYearFilter("");
                      }}
                      className={`text-sm font-medium ${
                        contentTypeFilter === "tv" ? "text-[#f5f0de]" : "text-white/45 hover:text-[#f5f0de]"
                      }`}
                    >
                      TV Shows
                    </button>
                  </div>

                  <div className="mt-4">
                    <SearchBar
                      placeholder="Search movies & TV shows..."
                      onSearch={handleMovieSearch}
                      onSelect={(item) => {
                        if (yearFilter && item.year !== yearFilter) {
                          return;
                        }
                        handleSelectContent(item as SearchResultItem);
                      }}
                      minChars={1}
                      theme="brutalist"
                    />
                  </div>

                  {searchResults.length > 0 && uniqueYears.length > 1 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="text-sm font-medium text-zinc-700">Filter year</label>
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="field w-auto min-w-[170px] py-2 text-sm"
                      >
                        <option value="">All years ({searchResults.length})</option>
                        {uniqueYears.map((year) => {
                          const count = searchResults.filter((item) => item.year === year).length;
                          return (
                            <option key={year} value={year}>
                              {year} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {yearFilter && filteredResults.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-3 text-sm font-semibold text-[#f5f0de]">
                          Results for {yearFilter} ({filteredResults.length})
                        </p>

                      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                        {filteredResults.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectContent(item)}
                            className="group flex w-full items-center gap-3 border-b border-white/10 px-0 py-2 text-left transition-colors hover:border-white/20"
                          >
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.title}
                              className="h-16 w-12 flex-shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#f5f0de]">{item.title}</p>
                              <p className="truncate text-xs text-white/55">{item.subtitle}</p>
                          </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContent && (
                  <div className="mt-5 sm:mt-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {selectedContent.poster_url && (
                          <img
                            src={selectedContent.poster_url}
                            alt={selectedContent.title}
                            className="h-40 w-24 rounded-lg object-cover sm:h-44 sm:w-28"
                          />
                        )}

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-[#f5f0de]">✓ {selectedContent.title}</p>
                            <span className="rounded-full bg-[#ff7a1a] px-2.5 py-1 text-xs font-semibold text-[#0a0a0a]">
                              {selectedContent.type === "tv" ? "TV Show" : "Movie"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-white/65">
                            {selectedContent.release_date?.split("-")[0]} • {selectedContent.runtime} min
                          </p>

                          <p className="mt-3 line-clamp-3 text-sm text-white/65">{selectedContent.overview}</p>

                          <button
                            onClick={() => setSelectedContent(null)}
                            className="mt-4 text-sm font-semibold text-[#ffb36b] underline underline-offset-2 hover:text-[#f5f0de]"
                          >
                            Choose something else
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`transition-all duration-500 ${
                    currentStep === 2 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"
                  } ${currentStep !== 2 ? "hidden" : ""}`}
                >
                  <h3 className="text-xl font-semibold text-[#f5f0de] sm:text-2xl">Send to Friends</h3>
                  <p className="mt-1 text-sm text-white/65">Pick recipients and attach a short note.</p>

                  {selectedContent && (
                    <div className="mt-5 flex items-center gap-3 border-b border-zinc-200 py-3">
                      {selectedContent.poster_url && (
                        <img
                          src={selectedContent.poster_url}
                          alt={selectedContent.title}
                          className="h-16 w-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#f5f0de]">{selectedContent.title}</p>
                        <p className="text-xs text-white/55">
                          {selectedContent.type === "tv" ? "TV Show" : "Movie"} • ready to share
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={followersSearchQuery}
                      onChange={(e) => setFollowersSearchQuery(e.target.value)}
                      className="field"
                    />
                  </div>

                  <div className="mb-3 mt-4 max-h-56 space-y-1 overflow-y-auto pr-1">
                    {filteredFollowers.length > 0 ? (
                      filteredFollowers.map((friend) => (
                        <button
                          key={friend.id}
                          className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-0 py-3 text-left transition-colors hover:border-white/20"
                          onClick={() => handleAddRecipient(friend.id)}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#f5f0de]">@{friend.username}</p>
                            <p className="text-xs text-white/55">{friend.name}</p>
                          </div>

                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              selectedRecipients.find((recipient) => recipient.id === friend.id)
                                ? "border-[#ff7a1a] bg-[#ff7a1a] text-[#0a0a0a]"
                                : "border-white/20 text-transparent"
                            }`}
                          >
                            ✓
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-zinc-500">No friends found</p>
                    )}
                  </div>

                  {selectedRecipients.length > 0 && (
                    <div className="py-2">
                      <p className="mb-2 text-sm font-semibold text-[#f5f0de]">
                        Selected: {selectedRecipients.length} friend{selectedRecipients.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/65">
                        {selectedRecipients.map((recipient, index) => (
                          <span key={recipient.id} className="inline-flex items-center gap-2">
                            <span className="text-[#f5f0de]">@{recipient.username}</span>
                            <button
                              onClick={() => handleRemoveRecipient(recipient.id)}
                              className="text-white/45 hover:text-[#ff7a1a]"
                            >
                              ×
                            </button>
                            {index < selectedRecipients.length - 1 && <span className="text-white/25">•</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-medium text-[#f5f0de]">Add a Note (Optional)</label>
                    <textarea
                      value={shareNote}
                      onChange={(e) => setShareNote(e.target.value.slice(0, 300))}
                      placeholder="Write a personal message to include with your share..."
                      className="field min-h-[100px] resize-none"
                      rows={3}
                      maxLength={300}
                    />
                    <p className="mt-1 text-right text-xs text-white/45">{shareNote.length}/300</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-0 py-4">
                <button
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    }
                  }}
                  disabled={currentStep === 1}
                  className={`action ${currentStep === 1 ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>

                <div className="flex gap-3">
                  {currentStep === 1 && (
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={!selectedContent}
                      className={`action-primary gap-2 ${!selectedContent ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      onClick={handleShare}
                      disabled={selectedRecipients.length === 0}
                      className={`action-primary gap-2 ${
                        selectedRecipients.length === 0 ? "cursor-not-allowed opacity-40" : ""
                      }`}
                    >
                      <SendHorizontal className="h-4 w-4" />
                      Share
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section>
              <div className="px-0 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Share History</p>
                <h2 className="mt-1 text-xl font-semibold text-[#f5f0de] sm:text-2xl">Titles You Shared</h2>
              </div>

              <div className="py-3">
                <input
                  type="text"
                  placeholder="Search shared titles..."
                  value={sharedSearchQuery}
                  onChange={(e) => setSharedSearchQuery(e.target.value)}
                  className="field mb-4"
                />

                {filteredSentShares.length > 0 ? (
                  <div className="max-h-[50rem] divide-y divide-white/10 overflow-y-auto pr-1">
                    {filteredSentShares.map((share) => {
                      const item = share.movie || share.content;

                      return (
                        <div
                          key={share.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openShareDetails(share)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openShareDetails(share);
                            }
                          }}
                          className="group flex w-full items-start gap-3 py-3 text-left"
                        >
                          {item?.poster_url && (
                            <img
                              src={item.poster_url}
                              alt={item.title}
                              className="h-16 w-12 flex-shrink-0 object-cover"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#f5f0de]">{item?.title || "Unknown"}</p>
                            <p className="mt-1 text-xs text-white/55">To @{share.receiver?.username}</p>

                            {share.content_type && (
                              <p className="mt-1 text-xs font-medium text-white/55">
                                {share.content_type === "tv" ? "TV Show" : "Movie"}
                              </p>
                            )}

                            {share.note && (
                              <p className="mt-2 pl-2 text-xs italic text-white/65">
                                &quot;{share.note}&quot;
                              </p>
                            )}

                            <p className="mt-1 text-xs text-white/40">
                              {new Date(share.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveShare(share.id);
                            }}
                            className="rounded-md p-1 text-white/45 transition-colors hover:bg-white/5 hover:text-[#ff7a1a]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-[#f5f0de]">No shares yet</p>
                    <p className="mt-1 text-sm text-white/45">Share your first title!</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {selectedShare && user && (
        <ShareModal
          key={selectedShare.id}
          share={selectedShare}
          currentUserId={user.id}
          onClose={() => setSelectedShare(null)}
          user={user}
          theme="brutalist"
        />
      )}

      {showWatchConflictModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-[#111111] p-4 text-[#f5f0de] shadow-2xl sm:rounded-[2rem] sm:p-6">
            <h3 className="text-lg font-semibold text-[#f5f0de] sm:text-xl">They already watched this</h3>
            <p className="mt-2 text-sm text-white/65">
              {watchConflictRecipients.length === 1
                ? `${watchConflictRecipients[0].name} has already watched this title. Do you still want to send it?`
                : `${watchConflictRecipients.map((recipient) => recipient.name).join(", ")} have already watched this title. Do you still want to send it to everyone?`}
            </p>

            <div className="mt-4 rounded-2xl bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                Watched recipients
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {watchConflictRecipients.map((recipient) => (
                  <span
                    key={recipient.id}
                    className="rounded-full bg-black px-3 py-1 text-sm font-medium text-[#f5f0de] shadow-sm ring-1 ring-white/10"
                  >
                    @{recipient.username}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowWatchConflictModal(false);
                  setPendingShareRecipients([]);
                  setWatchConflictRecipients([]);
                }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#f5f0de] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendOnlyUnwatched}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#f5f0de] hover:bg-white/5"
              >
                Send only unwatched
              </button>
              <button
                type="button"
                onClick={handleSendAnyway}
                className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ff8d3b]"
              >
                Send anyway
              </button>
            </div>
          </div>
        </div>
      )}

      </PageLayout>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<CinematicLoading message="Your share studio is loading" />}>
      <SharePageContent />
    </Suspense>
  );
}
