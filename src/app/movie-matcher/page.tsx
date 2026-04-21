"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import MovieSwipeCard from "@/components/MovieSwipeCard";
import { User, UserTasteWithContent, Content, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserTasteProfile, addToUserTaste, removeFromUserTaste } from "@/lib/user-taste";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { calculateMatchScore, generateMatchAnalysis } from "@/lib/match-score";
import { getAvailableFriends, getFriendTasteProfile } from "@/lib/friends-match";
import { getMovieRecommendations, RecommendationFilters } from "@/lib/movie-recommendations";
import { quickRateMovie, addToWatchlist, getUserMovieLogs } from "@/lib/logs";
import { ArrowLeft, Plus, Trash2, Loader2, Search, X, Sparkles, Zap, Users, Heart, ChevronLeft, ChevronRight, Flame, Clock, BarChart3, ChevronDown, Star } from "lucide-react";
import Link from "next/link";

type MatcherContent = Content & {
  poster_path?: string | null;
  director?: string | null;
  director_name?: string | null;
  premiered?: string;
  _score?: number;
  _suggestionScore?: number;
};

type FriendMatch = {
  userId: string;
  name: string;
  username: string;
  avatar_url: string | null;
  tasteCount: number;
};

type MatchScore = {
  totalScore: number;
  genreSim: number;
  creatorSim: number;
  ratingSim: number;
  vibeSim: number;
  eraSim: number;
  languageSim: number;
};

type GenreStat = {
  genre: string;
  count: number;
};

type SharedMovie = {
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
};

type MatchAnalysis = {
  blendPersonality: string;
  totalScore: number;
  tasteInsight: string;
  genreSim: number;
  creatorSim: number;
  sharedGenres: string[];
  genreMismatch?: string | null;
  commonActors: string[];
  commonDirectors: string[];
  genreDistributionA: GenreStat[];
  genreDistributionB: GenreStat[];
  avgYearA: number;
  avgYearB: number;
  sharedLanguages: string[];
  commonTasteMovieCount: number;
  commonTasteMovies: SharedMovie[];
  commonMasterpieceMovieCount: number;
  commonMasterpieceMovies: SharedMovie[];
  ratingSim: number;
  vibeSim: number;
  eraSim: number;
  languageSim: number;
};

type TasteItem = UserTasteWithContent & {
  isMasterpiece: boolean;
};

function FriendMatchCard({
  friend,
  onFindScore,
}: {
  friend: FriendMatch;
  onFindScore: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const tastes = await getFriendTasteProfile(friend.userId);
        const logs = await getUserMovieLogs(friend.userId, 500);
        const masterpieceKeys = new Set(
          tastes.map((taste) => `${taste.content_type}-${taste.content_id}`)
        );
        const masterpieces = logs.filter(
          (log) =>
            log.reaction === 2 &&
            !masterpieceKeys.has(`${log.content_type}-${log.content_id}`)
        );

        if (!cancelled) {
          setCount(tastes.length + masterpieces.length);
        }
      } catch {
        if (!cancelled) {
          setCount(friend.tasteCount);
        }
      }
    }

    void fetchCount();

    return () => {
      cancelled = true;
    };
  }, [friend.userId, friend.tasteCount]);

  return (
    <div className="flex items-center gap-4 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      {friend.avatar_url ? (
        <img
          src={friend.avatar_url}
          alt={friend.username}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
          {friend.username[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 truncate">{friend.name}</div>
        <div className="text-xs text-gray-500 truncate">
          @{friend.username} • {count === null ? "..." : count} movies
        </div>
      </div>
      <button
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
        onClick={onFindScore}
      >
        Find My Score
      </button>
    </div>
  );
}

export default function MovieMatcherPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tastes, setTastes] = useState<UserTasteWithContent[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MatcherContent[]>([]);
  const [searching, setSearching] = useState(false);
  const [contentType, setContentType] = useState<"movie" | "tv">("movie");
  const [addingContent, setAddingContent] = useState<string | null>(null);
  const [removingContent, setRemovingContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedMovie, setLastAddedMovie] = useState<MatcherContent | null>(null);
  const [friends, setFriends] = useState<FriendMatch[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendMatch | null>(null);
  const [matchScore, setMatchScore] = useState<MatchScore | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showFriendsDropdown, setShowFriendsDropdown] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [showAllMovies, setShowAllMovies] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [includeMasterpieces, setIncludeMasterpieces] = useState(true);
  const [masterpieceMovies, setMasterpieceMovies] = useState<TasteItem[]>([]);

  useEffect(() => {
    const fetchMasterpieces = async () => {
      if (!user) return;
      try {
        // Fetch all masterpiece logs (rating === 2)
        const logs = await getUserMovieLogs(user.id, 200);
        const masterpieces = logs
          .filter((log) => log.reaction === 2 && log.content)
          .map((log) => ({
            id: `masterpiece-${log.id}`,
            user_id: log.user_id,
            content_id: log.content_id,
            content_type: log.content_type,
            added_at: log.watched_date,
            content: log.content,
            isMasterpiece: true,
          }));
        setMasterpieceMovies(masterpieces);
      } catch (err) {
        // ignore
      }
    };
    fetchMasterpieces();
  }, [user]);

  const handleSelectFriend = (friend: FriendMatch) => {
    setSelectedFriend(friend);
    setShowFriendsDropdown(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const searchMode = contentType;
      const [movies, shows] = await Promise.all([
        searchMode === "tv" ? Promise.resolve([]) : searchMovies(query),
        searchMode === "movie" ? Promise.resolve([]) : searchShows(query),
      ]);

      const movieResults = movies.map((movie) => ({
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

      const showResults = shows.map((show) => ({
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

      setSearchResults([...movieResults, ...showResults].slice(0, 20));
    } catch (error) {
      console.error("MovieMatcher: Search error:", error);
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  };

  // Load friends list when user and taste profile are ready
  // Load friends list when user and taste profile are ready (including masterpieces if checked)
  useEffect(() => {
    const loadFriends = async () => {
      const tasteCount = (tastes.length + (includeMasterpieces ? masterpieceMovies.length : 0));
      if (!user || tasteCount < 7) return;
      setLoadingFriends(true);
      try {
        const friendsList = await getAvailableFriends(user.id);
        setFriends(friendsList);
      } catch (err) {
        setError("Failed to load friends list");
      } finally {
        setLoadingFriends(false);
      }
    };
    loadFriends();
    // Only reload when user, tastes, masterpieces, or checkbox changes
  }, [user, tastes, masterpieceMovies, includeMasterpieces]);

  // Rate Movies State
  const [activeTab, setActiveTab] = useState<"build" | "rate" | "match">("build");
  const [recommendations, setRecommendations] = useState<Content[]>([]);
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RecommendationFilters>({
    languages: [],
    actors: [],
    yearRange: { from: 2015, to: new Date().getFullYear() },
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [ratingStats, setRatingStats] = useState({ good: 0, bad: 0, masterpiece: 0 });
  const [userLogs, setUserLogs] = useState<MovieLogWithContent[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        console.log("MovieMatcher: Fetching user data for:", firebaseUser.uid);
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        console.log("MovieMatcher: Fetching taste profile for:", currentUser.id);
        const userTastes = await getUserTasteProfile(currentUser.id);
        console.log("MovieMatcher: Taste profile fetched:", userTastes.length, "items");
        setTastes(userTastes);

        // Fetch actual logged ratings for swipe/watch history UI
        const logs = await getUserMovieLogs(currentUser.id, 100);
        setUserLogs(logs);
      } catch (error) {
        console.error("MovieMatcher: Error loading user data:", error);
        setError("Failed to load MovieMatcher data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleAddToTaste = async (contentId: number) => {
    if (!user) return;

    try {
      setAddingContent(`${contentType}-${contentId}`);
      setError(null);
      console.log("MovieMatcher: Adding", contentType, "to taste:", contentId);

      // Find the movie object for recommendations
      const selectedMovie = searchResults.find((r) => r.id === contentId);
      if (selectedMovie) {
        setLastAddedMovie(selectedMovie);
        console.log("MovieMatcher: Saved movie for recommendations:", selectedMovie.title);
      }

      await addToUserTaste(user.id, contentId, contentType);

      console.log("MovieMatcher: Added to taste, refreshing profile");
      const updatedTastes = await getUserTasteProfile(user.id);
      console.log("MovieMatcher: Updated tastes count:", updatedTastes.length);
      setTastes(updatedTastes);

      // Clear search query but KEEP searchResults for recommendations
      setSearchQuery("");
      console.log("MovieMatcher: Ready to show recommendations");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("MovieMatcher: Error adding to taste:", error);
      setError("Failed to add to taste: " + errorMessage);
    } finally {
      setAddingContent(null);
    }
  };

  const handleRemoveFromTaste = async (tasteId: string) => {
    try {
      setRemovingContent(tasteId);
      setError(null);
      console.log("MovieMatcher: Removing taste:", tasteId);
      await removeFromUserTaste(tasteId);

      console.log("MovieMatcher: Removed, refreshing profile");
      // Refresh tastes
      const updatedTastes = await getUserTasteProfile(user?.id || "");
      console.log("MovieMatcher: Updated tastes count:", updatedTastes.length);
      setTastes(updatedTastes);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("MovieMatcher: Error removing from taste:", error);
      setError("Failed to remove from taste: " + errorMessage);
    } finally {
      setRemovingContent(null);
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

  const getRecommendedMovies = () => {
    // If user just added a movie, show similar movies to that
    if (lastAddedMovie) {
      console.log("=== RECOMMENDATIONS DEBUG ===");
      console.log("lastAddedMovie:", {
        title: lastAddedMovie.title,
        director: lastAddedMovie.director,
        genres: lastAddedMovie.genres,
      });
      console.log("searchResults count:", searchResults.length);
      if (searchResults.length > 0) {
        console.log("First searchResult:", {
          title: searchResults[0].title,
          director: searchResults[0].director,
          genres: searchResults[0].genres,
          keys: Object.keys(searchResults[0]).slice(0, 10),
        });
      }
      console.log("tastes count:", tastes.length);

      // Score all search results by similarity to lastAddedMovie
      const recommendedByLastAdded = searchResults
        .map((result) => {
          let score = 0;

          // Director match = +100 points
          if (
            result.director &&
            lastAddedMovie.director &&
            result.director.toLowerCase() === lastAddedMovie.director.toLowerCase()
          ) {
            score += 100;
          }

          // Genre matches = +20 points each
          if (Array.isArray(result.genres) && Array.isArray(lastAddedMovie.genres)) {
            result.genres.forEach((genre: string) => {
              if (
                (lastAddedMovie.genres ?? []).some(
                  (g: string) => g.toLowerCase() === genre.toLowerCase()
                )
              ) {
                score += 20;
              }
            });
          }

          // If no director/genre data, just use all results (they matched the search already)
          if (score === 0) {
            score = 1; // Give minimum score to all results
          }

          return { ...result, _score: score };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, 5);

      // Filter out already added movies and the movie itself
      const seen = new Set(tastes.map((t) => t.content_id));
      const final = recommendedByLastAdded.filter((r) => r.id !== lastAddedMovie.id && !seen.has(r.id));
      
      console.log("Recommendations: Final count:", final.length);
      console.log("Recommendations: Final movies:", final.map((r) => r.title));
      
      return final;
    }

    // Otherwise, recommend based on taste profile
    if (tastes.length === 0) return [];

    // Extract directors and genres from existing taste
    const tasteDirectors = new Map<string, number>();
    const tasteGenres = new Map<string, number>();

    tastes.forEach((taste) => {
      if (taste.content && typeof taste.content === "object") {
        const content = taste.content as MatcherContent;

        // Count director occurrences
        if (content.director) {
          const director = content.director.toLowerCase();
          tasteDirectors.set(director, (tasteDirectors.get(director) || 0) + 1);
        }

        // Count genre occurrences
        if (Array.isArray(content.genres)) {
          content.genres.forEach((g: string) => {
            const genre = g.toLowerCase();
            tasteGenres.set(genre, (tasteGenres.get(genre) || 0) + 1);
          });
        }
      }
    });

    // Score search results based on taste similarity
    const recommendedByTaste = searchResults
      .map((result) => {
        let score = 0;
        const resultDirector = (result.director || "").toLowerCase();
        const resultGenres = Array.isArray(result.genres)
          ? result.genres.map((g: string) => g.toLowerCase())
          : [];

        // Director match = +50 points
        if (resultDirector && tasteDirectors.has(resultDirector)) {
          score += 50;
        }

        // Genre matches = +15 points each
        resultGenres.forEach((genre: string) => {
          if (tasteGenres.has(genre)) {
            score += 15;
          }
        });

        return { ...result, _score: score };
      })
      .filter((r) => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);

    const seen = new Set(tastes.map((t) => t.content_id));
    return recommendedByTaste.filter((r) => !seen.has(r.id));
  };

  const getMatchReason = (movie: MatcherContent) => {
    // If we just added a movie, show similarities to that movie
    if (lastAddedMovie) {
      const reasons: string[] = [];

      // Check director match
      if (
        lastAddedMovie.director &&
        movie.director &&
        lastAddedMovie.director.toLowerCase() === movie.director.toLowerCase()
      ) {
        reasons.push(`Same director as "${lastAddedMovie.title}"`);
      }

      // Check genre matches
      if (Array.isArray(lastAddedMovie.genres) && Array.isArray(movie.genres)) {
        const commonGenres = (lastAddedMovie.genres ?? []).filter((g: string) =>
          (movie.genres ?? []).some((mg: string) => mg.toLowerCase() === g.toLowerCase())
        );
        if (commonGenres.length > 0) {
          reasons.push(`Both are ${commonGenres[0]}`);
        }
      }

      return reasons.length > 0 ? reasons[0] : "Similar to your selection";
    }

    // Otherwise, show similarities to taste profile
    if (tastes.length === 0) return null;

    const reasons: string[] = [];

    tastes.forEach((taste) => {
      if (taste.content && typeof taste.content === "object") {
        const content = taste.content as MatcherContent;

        // Check director match
        if (
          content.director &&
          movie.director &&
          content.director.toLowerCase() === movie.director.toLowerCase()
        ) {
          reasons.push(`Same director as "${content.title}"`);
        }

        // Check genre matches
        if (Array.isArray(content.genres) && Array.isArray(movie.genres)) {
          const commonGenres = (content.genres ?? []).filter((g: string) =>
            (movie.genres ?? []).some((mg: string) => mg.toLowerCase() === g.toLowerCase())
          );
          if (commonGenres.length > 0) {
            reasons.push(`Shares ${commonGenres[0]} genre`);
          }
        }
      }
    });

    return reasons.length > 0 ? reasons[0] : "Based on your taste";
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading MovieMatcher...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Load recommendations when Rate Movies tab is opened
  const loadRecommendations = async () => {
    if (recommendations.length > 0) return; // Already loaded
    
    try {
      setLoadingRecommendations(true);
      const recs = await getMovieRecommendations(user.id, filters || undefined);
      setRecommendations(recs);
      setCurrentMovieIndex(0);
    } catch (err) {
      console.error("Error loading recommendations:", err);
      setError("Failed to load movie recommendations");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const loadUserLogs = async () => {
    try {
      const logs = await getUserMovieLogs(user.id, 100);
      setUserLogs(logs);
    } catch (err) {
      console.error("Error loading user logs:", err);
    }
  };

  // Handle swipe actions
  const handleSwipeRight = async () => {
    if (!recommendations[currentMovieIndex]) return;
    
    try {
      const movie = recommendations[currentMovieIndex];
      await quickRateMovie(user.id, movie.id, movie.type || "movie", 1); // Good
      setRatingStats((prev) => ({ ...prev, good: prev.good + 1 }));
      await loadUserLogs();
      moveToNextMovie();
    } catch (err) {
      console.error("Error rating movie:", err);
      setError("Failed to save rating");
    }
  };

  const handleSwipeLeft = async () => {
    if (!recommendations[currentMovieIndex]) return;
    
    try {
      const movie = recommendations[currentMovieIndex];
      await quickRateMovie(user.id, movie.id, movie.type || "movie", 0); // Bad
      setRatingStats((prev) => ({ ...prev, bad: prev.bad + 1 }));
      await loadUserLogs();
      moveToNextMovie();
    } catch (err) {
      console.error("Error rating movie:", err);
      setError("Failed to save rating");
    }
  };

  const handleDoubleTap = async () => {
    if (!recommendations[currentMovieIndex]) return;
    
    try {
      const movie = recommendations[currentMovieIndex];
      await quickRateMovie(user.id, movie.id, movie.type || "movie", 2); // Masterpiece
      setRatingStats((prev) => ({ ...prev, masterpiece: prev.masterpiece + 1 }));
      await loadUserLogs();
      moveToNextMovie();
    } catch (err) {
      console.error("Error rating movie:", err);
      setError("Failed to save rating");
    }
  };

  const handleSwipeDown = async () => {
    if (!recommendations[currentMovieIndex]) return;
    
    try {
      const movie = recommendations[currentMovieIndex];
      await addToWatchlist(user.id, movie.id, movie.type || "movie");
      await loadUserLogs();
      moveToNextMovie();
    } catch (err) {
      console.error("Error adding to watchlist:", err);
      setError("Failed to add to watchlist");
    }
  };

  const moveToNextMovie = () => {
    if (currentMovieIndex < recommendations.length - 1) {
      setCurrentMovieIndex((prev) => prev + 1);
    } else {
      // Loop back to the top of the current deck when we hit the end.
      setCurrentMovieIndex(0);
    }
  };

  // Taste profile: explicit taste movies plus optional masterpiece logs only
  const tasteProfile = includeMasterpieces
    ? [
        ...tastes.map((t) => ({ ...t, isMasterpiece: false })),
        ...masterpieceMovies.filter((m) => !tastes.some((t) => t.content_id === m.content_id)),
      ]
    : tastes.map((t) => ({ ...t, isMasterpiece: false }));
  const tasteProfileCount = tasteProfile.length;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">MovieMatcher</h1>
          <p className="text-gray-600">
            Build your taste profile and discover movies and shows tailored just for you
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab("build");
            }}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "build"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <Sparkles size={18} /> Build Profile
            </span>
          </button>
        </div>

        {activeTab === "build" && (
        <div>
        {/* ===== YOUR TASTE SECTION ===== */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Your Taste Profile</h2>
            <span className="ml-2 text-blue-700 text-xs font-semibold bg-blue-100 rounded px-2 py-1">{tasteProfileCount} items</span>
          </div>



          {/* Taste Movies Horizontal Slider */}
          {tasteProfile.length > 0 ? (
            <div className="mb-4">
              {/* Slider Container */}
              <div className="relative">
                {/* Scroll Container */}
                <div
                  ref={scrollContainerRef}
                  className="overflow-x-auto scrollbar-hide"
                >
                  <div className="flex gap-3 pb-2 w-fit">
                    {tasteProfile
                      .filter((taste) => taste.content && taste.content.title)
                      .slice(0, showAllMovies ? undefined : 6)
                      .map((taste) => (
                        <div key={taste.id} className="flex-shrink-0 w-32">
                          <div className="relative w-full aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow group">
                            <img
                              src={taste.content?.poster_url || undefined}
                              alt={taste.content?.title || "Movie"}
                              className="w-full h-full object-cover"
                            />

                            {/* Hover overlay with delete button */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                onClick={() => handleRemoveFromTaste(taste.id)}
                                disabled={removingContent === taste.id}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white p-2 rounded-full transition-colors"
                                title="Remove from taste"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* TV Badge */}
                            {taste.content?.type === "tv" && (
                              <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded text-[10px]">
                                TV
                              </div>
                            )}
                            {/* Masterpiece Badge */}
                            {taste.isMasterpiece && (
                              <div className="absolute bottom-1 right-1 bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded text-[10px] shadow">
                                Masterpiece
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Left Arrow - Only show if not at start */}
                {tasteProfile.length > 6 && (
                  <button
                    onClick={() => {
                      if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollBy({
                          left: -150,
                          behavior: "smooth",
                        });
                      }
                    }}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white hover:bg-gray-100 text-gray-700 p-2 rounded-full shadow-lg transition-colors z-10"
                    title="Scroll left"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Right Arrow - Only show if more movies and not all shown */}
                {tasteProfile.length > 6 && !showAllMovies && (
                  <button
                    onClick={() => {
                      if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollBy({
                          left: 150,
                          behavior: "smooth",
                        });
                      }
                    }}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white hover:bg-gray-100 text-gray-700 p-2 rounded-full shadow-lg transition-colors z-10"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* View More Option */}
              {tasteProfile.length > 6 && (
                <div className="mt-3 flex justify-center">
                  <button
                    onClick={() => setShowAllMovies(!showAllMovies)}
                    className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors border border-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    {showAllMovies ? "Show Less" : `View All (${tasteProfile.length})`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-gray-200">
              <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm mb-3">No movies yet</p>
            </div>
          )}

          {/* Masterpiece Checkbox */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            <input
              id="include-masterpieces"
              type="checkbox"
              checked={includeMasterpieces}
              onChange={() => setIncludeMasterpieces((v) => !v)}
              className="accent-yellow-500 w-4 h-4"
            />
            <label htmlFor="include-masterpieces" className="text-sm text-gray-700 select-none">
              Include masterpiece movies from your log in your taste profile
            </label>
          </div>

          {/* Add Movie Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {tasteProfile.length > 0 ? "Add Another" : "Add Your First Movie"}
          </button>
        </div>

        {/* ===== FRIENDS MATCH SECTION ===== */}
        <div className="mt-8">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
            <div className="flex items-start gap-4">
              <div className="bg-purple-600 text-white p-3 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Match With Friends</h3>
                <p className="text-gray-600 mb-4">
                  Instantly see your compatibility with friends who have built their taste profile.
                </p>
                {loadingFriends ? (
                  <div className="py-8 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading friends...
                  </div>
                ) : friends.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No friends with complete taste profiles yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {friends
                      .filter((friend) => friend.tasteCount && friend.tasteCount > 0)
                      .map((friend) => (
                        <FriendMatchCard
                          key={friend.userId}
                          friend={friend}
                          onFindScore={async () => {
                            setSelectedFriend(friend);
                            setMatchScore(null);
                            setMatchAnalysis(null);
                            setShowAnalysisModal(false);
                            try {
                              setLoadingFriends(true);
                              const myTastes = includeMasterpieces
                                ? [
                                    ...tastes.map((t) => ({ ...t, isMasterpiece: false })),
                                    ...masterpieceMovies.filter((m) => !tastes.some((t) => t.content_id === m.content_id)),
                                  ]
                                : tastes.map((t) => ({ ...t, isMasterpiece: false }));
                              const theirTastes = await getFriendTasteProfile(friend.userId);
                              const analysis = await generateMatchAnalysis(myTastes, theirTastes, user!.id, friend.userId);
                              setMatchScore({
                                totalScore: analysis.totalScore,
                                genreSim: analysis.genreSim,
                                creatorSim: analysis.creatorSim,
                                ratingSim: analysis.ratingSim,
                                vibeSim: analysis.vibeSim,
                                eraSim: analysis.eraSim,
                                languageSim: analysis.languageSim,
                              });
                              setMatchAnalysis(analysis);
                              setShowAnalysisModal(true);
                            } catch (err) {
                              setError("Failed to calculate match score");
                            } finally {
                              setLoadingFriends(false);
                            }
                          }}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
        )}

        {/* ===== MATCH MOVIES TAB ===== */}
        {activeTab === "match" && (
          <div className="space-y-6">
            {/* Intro Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Find Your Movie Match</h2>
              </div>
              <p className="text-gray-600 text-sm">
                Compare your movie taste with friends and discover how compatible you are. See what movies you both love and get personalized recommendations!
              </p>
            </div>

            {/* Friend Selection */}
            {!selectedFriend ? (
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Select a Friend
                </h3>

                <div className="relative">
                  <button
                    onClick={() => setShowFriendsDropdown(!showFriendsDropdown)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-left font-medium text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span>Choose a friend...</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {/* Friends Dropdown */}
                  {showFriendsDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-40 max-h-60 overflow-y-auto">
                      {loadingFriends ? (
                        <div className="p-4 text-center text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                      ) : friends.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No friends with complete profiles yet
                        </div>
                      ) : (
                        <div>
                          {/* Search input within dropdown */}
                          <div className="sticky top-0 p-2 border-b bg-white">
                            <input
                              type="text"
                              placeholder="Filter friends..."
                              value={friendSearchQuery}
                              onChange={(e) => setFriendSearchQuery(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Friends list */}
                          {friends
                            .filter((f) =>
                              f.name.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
                              f.username.toLowerCase().includes(friendSearchQuery.toLowerCase())
                            )
                            .map((friend) => (
                              <button
                                key={friend.userId}
                                onClick={() => handleSelectFriend(friend)}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors flex items-center gap-3"
                              >
                                {friend.avatar_url && (
                                  <img
                                    src={friend.avatar_url}
                                    alt={friend.username}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{friend.name}</p>
                                  <p className="text-xs text-gray-500">
                                    @{friend.username} • {friend.tasteCount} movies
                                  </p>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Prerequisites Check */}
                {tasteProfileCount < 7 && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      ⚠️ Complete your taste profile first (at least 7 movies) to see matches!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Selected Friend Info */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {selectedFriend.avatar_url && (
                      <img
                        src={selectedFriend.avatar_url}
                        alt={selectedFriend.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{selectedFriend.name}</p>
                      <p className="text-sm text-gray-600">@{selectedFriend.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFriend(null);
                      setMatchScore(null);
                      setShowFriendsDropdown(false);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Deselect friend"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Match Score Display */}
                {matchScore ? (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-600" />
                      Your Compatibility
                    </h3>

                    {/* Overall Score */}
                    <div className="mb-6 text-center">
                      <div className="text-5xl font-bold text-rose-600">{matchScore.totalScore}%</div>
                      <p className="text-sm text-gray-600 mt-1">Movie Taste Match</p>
                    </div>

                    {/* Compatibility Breakdown */}
                    <div className="space-y-4">
                      {/* Genre Match */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Genre Compatibility</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(matchScore.genreSim)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-blue-500 h-2 rounded-full transition-all`}
                            style={{ width: `${matchScore.genreSim}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Creator Match */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Creator Compatibility</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(matchScore.creatorSim)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-purple-500 h-2 rounded-full transition-all`}
                            style={{ width: `${matchScore.creatorSim}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Rating Match */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Rating Compatibility</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(matchScore.ratingSim)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-amber-500 h-2 rounded-full transition-all`}
                            style={{ width: `${matchScore.ratingSim}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Vibe Match */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Vibe Match</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(matchScore.vibeSim)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-rose-500 h-2 rounded-full transition-all`}
                            style={{ width: `${matchScore.vibeSim}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Era Match */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Era Match</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(matchScore.eraSim)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-green-500 h-2 rounded-full transition-all`}
                            style={{ width: `${matchScore.eraSim}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Language Match */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Language Match</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(matchScore.languageSim)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-indigo-500 h-2 rounded-full transition-all`}
                            style={{ width: `${matchScore.languageSim}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Match Status Message */}
                    <div className="text-center pt-4 border-t mt-4">
                      {matchScore.totalScore >= 75 && (
                        <p className="text-sm font-semibold text-green-600">
                          Perfect match! You both love the same kind of movies!
                        </p>
                      )}
                      {matchScore.totalScore >= 50 && matchScore.totalScore < 75 && (
                        <p className="text-sm font-semibold text-amber-600">
                          Great match! Lots in common!
                        </p>
                      )}
                      {matchScore.totalScore < 50 && (
                        <p className="text-sm font-semibold text-gray-600">
                          Different tastes = great movie convos!
                        </p>
                      )}
                    </div>

                    {/* Analysis Button */}
                    <button
                      onClick={() => setShowAnalysisModal(true)}
                      className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                      View Full Analysis
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                    <p className="text-gray-600">Calculating your compatibility...</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== FEATURES COMING SECTION ===== */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Feature Card 1 */}
          {/* Removed Find Your Match and Smart Recommendations cards from main page */}
        </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-h-[90vh] w-full max-w-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add to Your Taste</h3>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
                className="text-gray-500 hover:text-gray-700"
                title="Close search modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Type Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setContentType("movie");
                  setSearchResults([]);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  contentType === "movie"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => {
                  setContentType("tv");
                  setSearchResults([]);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  contentType === "tv"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                TV Shows
              </button>
            </div>

            {/* Search Input */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder={`Search ${contentType === "movie" ? "movies" : "TV shows"}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      void handleSearch(e.target.value);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {searching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}

              {!searching && searchResults.length === 0 && searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  No results found
                </div>
              )}

              {/* Recommended Movies (when no search query) */}
              {!searchQuery && !searching && (tastes.length > 0 || lastAddedMovie) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    {lastAddedMovie ? "Similar to Your Selection" : "Recommended for You"}
                  </h4>
                  <div className="space-y-2">
                    {getRecommendedMovies().map((result) => {
                      const isAlreadyAdded = tastes.some((t) => t.content_id === result.id);
                      const matchReason = getMatchReason(result);

                      return (
                        <div
                          key={`${contentType}-${result.id}`}
                          className="flex gap-3 p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                        >
                          <img
                            src={
                              result.poster_path || result.poster_url
                                ? `https://image.tmdb.org/t/p/w92${
                                    result.poster_path || result.poster_url
                                  }`
                                : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='68'%3E%3Crect fill='%23ccc' width='45' height='68'/%3E%3C/svg%3E"
                            }
                              alt={result.title}
                            className="w-12 h-16 rounded object-cover"
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                              {result.title}
                            </p>
                            <p className="text-xs text-gray-500 mb-1">
                              {result.release_date || result.premiered
                                ? new Date(
                                    result.release_date ?? result.premiered ?? ""
                                  ).getFullYear()
                                : "N/A"}
                            </p>
                            {matchReason && (
                              <p className="text-xs text-amber-700 font-medium">{matchReason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddToTaste(result.id)}
                            disabled={isAlreadyAdded || addingContent === `${contentType}-${result.id}`}
                            className={`px-3 py-1 rounded font-medium text-sm transition-colors ${
                              isAlreadyAdded
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : addingContent === `${contentType}-${result.id}`
                                ? "bg-blue-500 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                          >
                            {isAlreadyAdded ? "Added" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Search Results</h4>
                  <div className="space-y-2">
                    {searchResults.map((result) => {
                      const isAlreadyAdded = tastes.some((t) => t.content_id === result.id);

                      return (
                        <div
                          key={`${contentType}-${result.id}`}
                          className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <img
                            src={
                              result.poster_path || result.poster_url
                                ? `https://image.tmdb.org/t/p/w92${
                                    result.poster_path || result.poster_url
                                  }`
                                : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='68'%3E%3Crect fill='%23ccc' width='45' height='68'/%3E%3C/svg%3E"
                            }
                              alt={result.title}
                            className="w-12 h-16 rounded object-cover"
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                              {result.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {result.release_date || result.premiered
                                ? new Date(
                                    result.release_date ?? result.premiered ?? ""
                                  ).getFullYear()
                                : "N/A"}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddToTaste(result.id)}
                            disabled={isAlreadyAdded || addingContent === `${contentType}-${result.id}`}
                            className={`px-3 py-1 rounded font-medium text-sm transition-colors ${
                              isAlreadyAdded
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : addingContent === `${contentType}-${result.id}`
                                ? "bg-blue-500 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                          >
                            {isAlreadyAdded ? "Added" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {showAnalysisModal && matchAnalysis && selectedFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-h-[90vh] w-full max-w-3xl overflow-y-auto shadow-xl">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Movie Blend Analysis</h2>
                <p className="text-sm text-gray-600 mt-1">{matchAnalysis.blendPersonality}</p>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="text-gray-400 hover:text-gray-600"
                title="Close analysis modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Core Overview */}
              <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-lg p-4 border border-rose-200">
                <h3 className="font-bold text-gray-900 mb-3">Compatibility Score</h3>
                <div className="text-center mb-3">
                  <div className="text-6xl font-bold text-rose-600">{matchAnalysis.totalScore}</div>
                  <p className="text-sm text-gray-600">% Match</p>
                </div>
                <p className="text-sm text-gray-700 text-center italic">{matchAnalysis.tasteInsight}</p>
              </div>

              {/* Taste Similarity */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Taste Similarity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Genre Match</p>
                    <p className="text-2xl font-bold text-blue-600">{matchAnalysis.genreSim}%</p>
                    {matchAnalysis.sharedGenres.length > 0 && (
                      <p className="text-xs text-gray-700 mt-2">
                        <span className="font-semibold">Shared:</span> {matchAnalysis.sharedGenres.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Creator Match</p>
                    <p className="text-2xl font-bold text-purple-600">{matchAnalysis.creatorSim}%</p>
                    <p className="text-xs text-gray-700 mt-2">
                      {matchAnalysis.commonActors.length > 0 || matchAnalysis.commonDirectors.length > 0
                        ? `${matchAnalysis.commonActors.length} actors, ${matchAnalysis.commonDirectors.length} directors`
                        : "No shared creators yet"}
                    </p>
                  </div>
                </div>
                {matchAnalysis.genreMismatch && (
                  <p className="text-sm text-gray-700 mt-3 bg-gray-50 p-2 rounded">
                    <span className="font-semibold">Unique to you:</span> {matchAnalysis.genreMismatch}
                  </p>
                )}
              </div>

              {/* Creators */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Shared Creators</h3>
                {matchAnalysis.commonActors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Common Actors:</p>
                    <div className="flex flex-wrap gap-2">
                      {matchAnalysis.commonActors.slice(0, 5).map((actor: string, idx: number) => (
                        <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                          {actor}
                        </span>
                      ))}
                      {matchAnalysis.commonActors.length > 5 && (
                        <span className="text-gray-600 text-xs">+{matchAnalysis.commonActors.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}
                {matchAnalysis.commonDirectors.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Common Directors:</p>
                    <div className="flex flex-wrap gap-2">
                      {matchAnalysis.commonDirectors.slice(0, 5).map((dir: string, idx: number) => (
                        <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                          {dir}
                        </span>
                      ))}
                      {matchAnalysis.commonDirectors.length > 5 && (
                        <span className="text-gray-600 text-xs">+{matchAnalysis.commonDirectors.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}
                {matchAnalysis.commonActors.length === 0 && matchAnalysis.commonDirectors.length === 0 && (
                  <p className="text-sm text-gray-600 italic">No common creators yet - discover new favorites together!</p>
                )}
              </div>

              {/* Taste DNA */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Taste DNA</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Your Top Genres:</p>
                    <div className="space-y-1">
                      {matchAnalysis.genreDistributionA.slice(0, 4).map((g: GenreStat, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-gray-700">{g.genre}</span>
                          <span className="font-semibold text-gray-900">{g.count} movies</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      {selectedFriend.name}&apos;s Top Genres:
                    </p>
                    <div className="space-y-1">
                      {matchAnalysis.genreDistributionB.slice(0, 4).map((g: GenreStat, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-gray-700">{g.genre}</span>
                          <span className="font-semibold text-gray-900">{g.count} movies</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Preferences</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-gray-600">Your Avg Movie Year</p>
                    <p className="text-2xl font-bold text-amber-600">{matchAnalysis.avgYearA}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-gray-600">{selectedFriend.name}&apos;s Avg Year</p>
                    <p className="text-2xl font-bold text-amber-600">{matchAnalysis.avgYearB}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Language Preferences:</p>
                  <div className="flex gap-2 flex-wrap">
                    {matchAnalysis.sharedLanguages.length > 0 && (
                      <>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                          Shared: {matchAnalysis.sharedLanguages.join(", ")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Shared Watching */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Shared Watching</h3>
                <div className="space-y-4">
                  {/* Common Taste Movies */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-gray-700 mb-3 font-semibold">
                      <span className="text-blue-600">Your Taste Overlap</span>
                      <span className="text-gray-500 text-xs ml-2">({matchAnalysis.commonTasteMovieCount})</span>
                    </p>
                    {matchAnalysis.commonTasteMovies && matchAnalysis.commonTasteMovies.length > 0 ? (
                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-2 w-fit">
                          {matchAnalysis.commonTasteMovies.map((movie) => (
                            <div key={`taste-${movie.type}-${movie.id}`} className="flex-shrink-0">
                              <div className="relative w-24 h-36 bg-gray-300 rounded-lg overflow-hidden group">
                                <img
                                  src={
                                    movie.poster_url
                                      ? `https://image.tmdb.org/t/p/w154${movie.poster_url}`
                                      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='144'%3E%3Crect fill='%23ccc' width='96' height='144'/%3E%3C/svg%3E"
                                  }
                                  alt={movie.title}
                                  className="w-full h-full object-cover"
                                />
                                {movie.type === "tv" && (
                                  <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                    TV
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                                  <p className="text-white text-xs text-center line-clamp-2 font-medium">
                                    {movie.title}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No movies in your taste overlap yet</p>
                    )}
                  </div>

                  {/* Common Masterpiece Movies */}
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <p className="text-sm text-gray-700 mb-3 font-semibold">
                      <span className="text-amber-600">Both Loved (Masterpiece)</span>
                      <span className="text-gray-500 text-xs ml-2">({matchAnalysis.commonMasterpieceMovieCount})</span>
                    </p>
                    {matchAnalysis.commonMasterpieceMovies && matchAnalysis.commonMasterpieceMovies.length > 0 ? (
                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-2 w-fit">
                          {matchAnalysis.commonMasterpieceMovies.map((movie) => (
                            <div key={`masterpiece-${movie.type}-${movie.id}`} className="flex-shrink-0">
                              <div className="relative w-24 h-36 bg-gray-300 rounded-lg overflow-hidden group ring-2 ring-amber-400">
                                <img
                                  src={
                                    movie.poster_url
                                      ? `https://image.tmdb.org/t/p/w154${movie.poster_url}`
                                      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='144'%3E%3Crect fill='%23ccc' width='96' height='144'/%3E%3C/svg%3E"
                                  }
                                  alt={movie.title}
                                  className="w-full h-full object-cover"
                                />
                                {movie.type === "tv" && (
                                  <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                    TV
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                                  <p className="text-white text-xs text-center line-clamp-2 font-medium">
                                    {movie.title}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No masterpiece movies in common yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Other Metrics */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">📈 Other Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Rating Match</p>
                    <p className="text-xl font-bold text-gray-900">{matchAnalysis.ratingSim}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Vibe Match</p>
                    <p className="text-xl font-bold text-gray-900">{matchAnalysis.vibeSim}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Era Match</p>
                    <p className="text-xl font-bold text-gray-900">{matchAnalysis.eraSim}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Language Match</p>
                    <p className="text-xl font-bold text-gray-900">{matchAnalysis.languageSim}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </PageLayout>
  );
}
