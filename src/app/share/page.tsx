"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import SearchBar from "@/components/SearchBar";
import { Content, ShareWithDetails, TMDBMovie, User } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, set } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails, searchMovies } from "@/lib/tmdb";
import { getShowDetails, searchShows, ShowDetails } from "@/lib/tvmaze";
import { ChevronLeft, ChevronRight, SendHorizontal, Sparkles, Trash2 } from "lucide-react";

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

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const movieIdParam = searchParams.get("movie_id");
  const showIdParam = searchParams.get("show_id");
  const contentIdParam = searchParams.get("content_id");
  const typeParam = searchParams.get("type");

  const [sharedSearchQuery, setSharedSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
                  setSelectedContent({ ...movie, type: "movie", created_at: new Date().toISOString() });
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
                  setSelectedContent(show as Content);
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
                    setSelectedContent(show as Content);
                    setCurrentStep(2);
                  }
                } else {
                  const movie = await getMovieDetails(contentId);
                  if (movie) {
                    setSelectedContent({ ...movie, type: "movie", created_at: new Date().toISOString() });
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
              .filter(Boolean) as User[];

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
        title: show.name || show.title,
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
          setSelectedContent(showDetails as Content);
        }
      } else {
        const movieDetails = await getMovieDetails(item.originalId);
        if (movieDetails) {
          setSelectedContent({
            ...movieDetails,
            type: "movie",
            created_at: new Date().toISOString(),
          });
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

  const handleShare = async () => {
    if (!selectedContent || selectedRecipients.length === 0 || !user) {
      return;
    }

    try {
      const contentType = selectedContent.type === "tv" ? "tv" : "movie";

      for (const recipient of selectedRecipients) {
        const shareId = `share-${user.id}-${recipient.id}-${contentType}-${selectedContent.id}-${Date.now()}`;

        await set(ref(db, `shares/${shareId}`), {
          id: shareId,
          sender_id: user.id,
          receiver_id: recipient.id,
          content_id: selectedContent.id,
          content_type: contentType,
          movie: selectedContent,
          content: selectedContent,
          note: shareNote || null,
          created_at: new Date().toISOString(),
        });
      }

      setCurrentStep(1);
      setSelectedContent(null);
      setSelectedRecipients([]);
      setShareNote("");
      setFollowersSearchQuery("");
      setContentTypeFilter("all");
      setYearFilter("");
      setSearchResults([]);
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

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="relative min-h-screen overflow-hidden px-4 pb-14 pt-8 sm:px-8">
        <div className="share-orb share-float-slow absolute -left-28 top-20 h-80 w-80 rounded-full" />
        <div className="share-orb share-float-slow share-float-delay absolute -right-20 top-56 h-72 w-72 rounded-full" />

        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-10 flex items-center justify-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 uppercase">CANISTER</h1>
          </div>

          <section className="share-card mb-8 px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                  <Sparkles className="h-3.5 w-3.5 text-zinc-700" />
                  Share Studio
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                  Curate and send a recommendation in two thoughtful steps.
                </h1>
                <p className="mt-3 max-w-xl text-sm text-zinc-600 sm:text-base">
                  Pick a title, choose friends, and add context so your share feels personal.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-white/90 text-zinc-700">{followers.length} friends</span>
                <span className="chip bg-white/90 text-zinc-700">{sentShares.length} sent shares</span>
              </div>
            </div>
          </section>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <section className="share-card overflow-hidden">
              <div className="border-b border-zinc-200/70 px-6 py-5 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Share Flow</p>
                    <h2 className="mt-1 text-2xl font-semibold text-zinc-900">Send a recommendation</h2>
                  </div>
                  <div className="flex gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      currentStep === 1 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      1. Pick title
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      currentStep === 2 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      2. Pick friends
                    </span>
                  </div>
                </div>

                <div className="share-progress mt-4 h-2 rounded-full bg-zinc-200/70">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              <div className="min-h-[31rem] p-6 sm:p-8">
                <div
                  className={`transition-all duration-500 ${
                    currentStep === 1 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
                  } ${currentStep !== 1 ? "hidden" : ""}`}
                >
                  <h3 className="text-2xl font-semibold text-zinc-900">Select a Movie or Show</h3>
                  <p className="mt-1 text-sm text-zinc-600">Find the right title first, then continue.</p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setContentTypeFilter("all");
                        setSelectedContent(null);
                        setSearchResults([]);
                        setYearFilter("");
                      }}
                      className={`share-pill ${contentTypeFilter === "all" ? "share-pill-active" : ""}`}
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
                      className={`share-pill ${contentTypeFilter === "movies" ? "share-pill-active" : ""}`}
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
                      className={`share-pill ${contentTypeFilter === "tv" ? "share-pill-active" : ""}`}
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
                      minChars={2}
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
                    <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                      <p className="mb-3 text-sm font-semibold text-zinc-900">
                        Results for {yearFilter} ({filteredResults.length})
                      </p>

                      <div className="share-soft-scroll max-h-64 space-y-2 overflow-y-auto pr-1">
                        {filteredResults.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectContent(item)}
                            className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                          >
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.title}
                                className="h-16 w-12 flex-shrink-0 rounded-lg object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-zinc-900">{item.title}</p>
                              <p className="truncate text-xs text-zinc-500">{item.subtitle}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContent && (
                    <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row">
                        {selectedContent.poster_url && (
                          <img
                            src={selectedContent.poster_url}
                            alt={selectedContent.title}
                            className="h-48 w-32 rounded-2xl object-cover shadow-sm"
                          />
                        )}

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-zinc-900">✓ {selectedContent.title}</p>
                            <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">
                              {selectedContent.type === "tv" ? "TV Show" : "Movie"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-zinc-600">
                            {selectedContent.release_date?.split("-")[0]} • {selectedContent.runtime} min
                          </p>

                          <p className="mt-3 line-clamp-3 text-sm text-zinc-600">{selectedContent.overview}</p>

                          <button
                            onClick={() => setSelectedContent(null)}
                            className="mt-4 text-sm font-semibold text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
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
                  <h3 className="text-2xl font-semibold text-zinc-900">Send to Friends</h3>
                  <p className="mt-1 text-sm text-zinc-600">Pick recipients and attach a short note.</p>

                  {selectedContent && (
                    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      {selectedContent.poster_url && (
                        <img
                          src={selectedContent.poster_url}
                          alt={selectedContent.title}
                          className="h-20 w-14 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{selectedContent.title}</p>
                        <p className="text-xs text-zinc-500">
                          {selectedContent.type === "tv" ? "TV Show" : "Movie"} • ready to share
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-5">
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={followersSearchQuery}
                      onChange={(e) => setFollowersSearchQuery(e.target.value)}
                      className="field"
                    />
                  </div>

                  <div className="share-soft-scroll mb-4 mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {filteredFollowers.length > 0 ? (
                      filteredFollowers.map((friend) => (
                        <button
                          key={friend.id}
                          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                          onClick={() => handleAddRecipient(friend.id)}
                        >
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">@{friend.username}</p>
                            <p className="text-xs text-zinc-500">{friend.name}</p>
                          </div>

                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              selectedRecipients.find((recipient) => recipient.id === friend.id)
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-300 text-transparent"
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
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <p className="mb-2 text-sm font-semibold text-zinc-800">
                        Selected: {selectedRecipients.length} friend{selectedRecipients.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRecipients.map((recipient) => (
                          <div
                            key={recipient.id}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm"
                          >
                            <span className="text-zinc-900">@{recipient.username}</span>
                            <button
                              onClick={() => handleRemoveRecipient(recipient.id)}
                              className="text-zinc-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-zinc-700">Add a Note (Optional)</label>
                    <textarea
                      value={shareNote}
                      onChange={(e) => setShareNote(e.target.value.slice(0, 300))}
                      placeholder="Write a personal message to include with your share..."
                      className="field min-h-[100px] resize-none"
                      rows={3}
                      maxLength={300}
                    />
                    <p className="mt-1 text-right text-xs text-zinc-500">{shareNote.length}/300</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-200/70 bg-white/70 px-6 py-4 sm:px-8">
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

            <aside className="share-card h-fit overflow-hidden xl:sticky xl:top-8">
              <div className="border-b border-zinc-200/70 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Sent Log</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-900">Movies You Shared</h2>
              </div>

              <div className="p-6">
                <input
                  type="text"
                  placeholder="Search shared movies..."
                  value={sharedSearchQuery}
                  onChange={(e) => setSharedSearchQuery(e.target.value)}
                  className="field mb-4"
                />

                {filteredSentShares.length > 0 ? (
                  <div className="share-soft-scroll max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                    {filteredSentShares.map((share) => {
                      const item = share.movie || share.content;

                      return (
                        <div
                          key={share.id}
                          className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                        >
                          {item?.poster_url && (
                            <img
                              src={item.poster_url}
                              alt={item.title}
                              className="h-16 w-12 flex-shrink-0 rounded-lg object-cover"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-900">{item?.title || "Unknown"}</p>
                            <p className="mt-1 text-xs text-zinc-500">To @{share.receiver?.username}</p>

                            {share.content_type && (
                              <p className="mt-1 text-xs font-medium text-zinc-600">
                                {share.content_type === "tv" ? "TV Show" : "Movie"}
                              </p>
                            )}

                            {share.note && (
                              <p className="mt-2 border-l-2 border-zinc-300 pl-2 text-xs italic text-zinc-600">
                                &quot;{share.note}&quot;
                              </p>
                            )}

                            <p className="mt-1 text-xs text-zinc-400">
                              {new Date(share.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <button
                            onClick={() => handleRemoveShare(share.id)}
                            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center">
                    <p className="text-zinc-500">No shares yet</p>
                    <p className="mt-1 text-sm text-zinc-400">Share your first movie!</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SharePageContent />
    </Suspense>
  );
}
