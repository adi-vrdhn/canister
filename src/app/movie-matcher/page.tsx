"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import MovieSwipeCard from "@/components/MovieSwipeCard";
import CinematicLoading from "@/components/CinematicLoading";
import MovieMatchAnalysisView from "@/components/MovieMatchAnalysisView";
import { User, UserTasteWithContent, Content, MovieLogWithContent } from "@/types";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserTasteProfile, addToUserTaste, removeFromUserTaste } from "@/lib/user-taste";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { calculateMatchScore, generateMatchAnalysis } from "@/lib/match-score";
import { getAvailableFriends, getFullTasteProfile } from "@/lib/friends-match";
import { getMovieRecommendations, RecommendationFilters } from "@/lib/movie-recommendations";
import { getSimilarMovies } from "@/lib/tmdb";
import { quickRateMovie, addToWatchlist, getUserMovieLogs } from "@/lib/logs";
import { createMatcherUpdateNotification } from "@/lib/notifications";
import { useIsPwa } from "@/lib/pwa";
import { Plus, Trash2, Loader2, Search, X, Sparkles, Zap, Users, Heart, ChevronLeft, ChevronRight, Flame, Clock, BarChart3, ChevronDown, Star } from "lucide-react";
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

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function FriendMatchCard({
  friend,
  onFindScore,
  disabled = false,
}: {
  friend: FriendMatch;
  onFindScore: () => void;
  disabled?: boolean;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const tastes = await getFullTasteProfile(friend.userId);
        if (!cancelled) {
          setCount(tastes.length);
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
    <div className="flex items-center gap-3 border-b border-white/10 py-3 sm:gap-4 sm:py-4">
      {friend.avatar_url ? (
        <img
          src={friend.avatar_url}
          alt={friend.username}
          className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-sm font-bold text-[#f5f0de] sm:h-10 sm:w-10 sm:text-base">
          {friend.username[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-semibold text-[#f5f0de] sm:text-base">{friend.name}</div>
        <div className="truncate text-xs text-white/55">
          @{friend.username} • {count === null ? "..." : count} movies
        </div>
      </div>
      <button
        disabled={disabled}
        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-white/10 text-white/35"
            : "border-white/10 bg-[#ff7a1a] text-[#0a0a0a] hover:bg-[#ff8d3b]"
        }`}
        onClick={onFindScore}
      >
        <span className="sm:hidden">{disabled ? "Need 7" : "Score"}</span>
        <span className="hidden sm:inline">{disabled ? "Add 7 Movies First" : "Find My Score"}</span>
      </button>
    </div>
  );
}

export default function MovieMatcherPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useCurrentUser();
  const isPwa = useIsPwa();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tastes, setTastes] = useState<UserTasteWithContent[]>([]);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MatcherContent[]>([]);
  const [searching, setSearching] = useState(false);
  const [contentType, setContentType] = useState<"movie" | "tv">("movie");
  const [addingContent, setAddingContent] = useState<string | null>(null);
  const [removingContent, setRemovingContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedMovie, setLastAddedMovie] = useState<MatcherContent | null>(null);
  const [similarSuggestions, setSimilarSuggestions] = useState<MatcherContent[]>([]);
  const [friends, setFriends] = useState<FriendMatch[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendMatch | null>(null);
  const [matchScore, setMatchScore] = useState<MatchScore | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showFriendsDropdown, setShowFriendsDropdown] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [showAllMovies, setShowAllMovies] = useState(false);
  const [showEditTasteModal, setShowEditTasteModal] = useState(false);
  const [tasteSearchQuery, setTasteSearchQuery] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [includeMasterpieces, setIncludeMasterpieces] = useState(true);
  const [masterpieceMovies, setMasterpieceMovies] = useState<TasteItem[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobileViewport(media.matches);

    update();
    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  const handleSelectFriend = (friend: FriendMatch) => {
    if (tasteProfileCount < 7) {
      setError("Add at least 7 movies to your taste profile before matching with friends.");
      setShowFriendsDropdown(false);
      return;
    }

    setSelectedFriend(friend);
    setShowFriendsDropdown(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 1) {
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
    if (sessionLoading) return;
    if (!sessionUser) {
      router.push("/auth/login");
      return;
    }

    let cancelled = false;
    const currentUser = sessionUser;

    const loadMatcherData = async () => {
      try {
        setUser(currentUser);

        const userTastes = await getUserTasteProfile(currentUser.id);
        if (cancelled) return;
        setTastes(userTastes);

        const logs = await getUserMovieLogs(currentUser.id, 100, currentUser);
        if (cancelled) return;
        setUserLogs(logs);
      } catch (error) {
        console.error("MovieMatcher: Error loading user data:", error);
        setError("Failed to load MovieMatcher data");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMatcherData();

    return () => {
      cancelled = true;
    };
  }, [router, sessionLoading, sessionUser]);

  const handleAddToTaste = async (contentId: number) => {
    if (!user) return;

    try {
      setAddingContent(`${contentType}-${contentId}`);
      setError(null);
      console.log("MovieMatcher: Adding", contentType, "to taste:", contentId);

      // Find the movie object for recommendations
      const selectedMovie = searchResults.find((r) => r.id === contentId);
      if (selectedMovie && selectedMovie.type === "movie") {
        setLastAddedMovie(selectedMovie);
        console.log("MovieMatcher: Saved movie for recommendations:", selectedMovie.title);

        const similarMovies = await getSimilarMovies(selectedMovie.id, 12);
        const mappedSimilar = similarMovies
          .filter((movie) => movie.id !== selectedMovie.id)
          .map((movie) => ({
            ...movie,
            title: movie.title || "Untitled",
            poster_url: movie.poster_url || null,
            genres: Array.isArray(movie.genres) ? movie.genres : [],
            director: movie.director || null,
            created_at: movie.created_at || new Date().toISOString(),
            type: "movie" as const,
            _suggestionScore: 0,
          }))
          .filter((movie) => {
            const seen = new Set(tastes.map((t) => t.content_id));
            return !seen.has(movie.id);
          });

        setSimilarSuggestions(mappedSimilar);
      }

      await addToUserTaste(user.id, contentId, contentType);

      console.log("MovieMatcher: Added to taste, refreshing profile");
      const updatedTastes = await getUserTasteProfile(user.id);
      console.log("MovieMatcher: Updated tastes count:", updatedTastes.length);
      setTastes(updatedTastes);

      // Clear search query so the next view shows the similar-movies rail.
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

  const handleDownloadApp = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowInstallHelp(false);
      }
      setDeferredInstallPrompt(null);
      return;
    }

    setShowInstallHelp(true);
  };

  const scoreByContentSimilarity = (candidate: MatcherContent, reference: MatcherContent) => {
    let score = 0;

    const candidateDirector = (candidate.director || "").toLowerCase();
    const referenceDirector = (reference.director || "").toLowerCase();
    if (candidateDirector && referenceDirector && candidateDirector === referenceDirector) {
      score += 35;
    }

    const candidateGenres = Array.isArray(candidate.genres)
      ? candidate.genres.map((genre) => genre.toLowerCase())
      : [];
    const referenceGenres = Array.isArray(reference.genres)
      ? reference.genres.map((genre) => genre.toLowerCase())
      : [];
    const sharedGenres = candidateGenres.filter((genre) => referenceGenres.includes(genre));
    score += sharedGenres.length * 18;

    const candidateLanguage = (candidate.language || "").toLowerCase();
    const referenceLanguage = (reference.language || "").toLowerCase();
    if (candidateLanguage && referenceLanguage && candidateLanguage === referenceLanguage) {
      score += 12;
    }

    const candidateYear = Number((candidate.release_date || candidate.premiered || "").split("-")[0]);
    const referenceYear = Number((reference.release_date || reference.premiered || "").split("-")[0]);
    if (Number.isFinite(candidateYear) && Number.isFinite(referenceYear)) {
      const gap = Math.abs(candidateYear - referenceYear);
      if (gap <= 2) score += 14;
      else if (gap <= 5) score += 8;
      else if (gap <= 10) score += 3;
    }

    const candidateTitle = (candidate.title || "").toLowerCase();
    const referenceTitle = (reference.title || "").toLowerCase();
    if (candidateTitle === referenceTitle) {
      score -= 20;
    }

    return score;
  };

  const getRecommendedMovies = () => {
    // If user just added a movie, show similar movies to that
    if (lastAddedMovie) {
      const source = similarSuggestions.length > 0 ? similarSuggestions : searchResults;
      const seen = new Set(tastes.map((t) => t.content_id));

      return source
        .map((result) => ({
          ...result,
          _suggestionScore: scoreByContentSimilarity(result, lastAddedMovie),
        }))
        .filter((result) => result.id !== lastAddedMovie.id && !seen.has(result.id))
        .sort((a, b) => (b._suggestionScore || 0) - (a._suggestionScore || 0))
        .slice(0, 5);
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
          reasons.push(`Same ${commonGenres[0]} energy`);
        }
      }

      if (
        lastAddedMovie.language &&
        movie.language &&
        lastAddedMovie.language.toLowerCase() === movie.language.toLowerCase()
      ) {
        reasons.push("Same language");
      }

      if (lastAddedMovie.release_date && movie.release_date) {
        const gap = Math.abs(
          new Date(lastAddedMovie.release_date).getFullYear() - new Date(movie.release_date).getFullYear()
        );
        if (Number.isFinite(gap) && gap <= 5) {
          reasons.push("Similar era");
        }
      }

      return reasons.length > 0 ? reasons[0] : "Similar cinematic fit";
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
    return <CinematicLoading message="MovieMatcher is loading" />;
  }

  if (error && !user) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#ff7a1a] hover:bg-[#ff8d3b] text-black px-4 py-2 rounded-lg font-semibold"
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
  const canMatchFriends = tasteProfileCount >= 7;
  const filteredEditableTastes = tastes
    .filter((taste) => taste.content?.title)
    .filter((taste) =>
      (taste.content?.title || "").toLowerCase().includes(tasteSearchQuery.toLowerCase())
    );

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-6xl px-3 pt-4 pb-[calc(10rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 sm:pb-[calc(10rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 lg:pb-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 sm:mb-6 sm:p-4">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Movie Matcher intro */}
        <div id="movie-matcher-intro" className="mb-6 sm:mb-10">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Movie Matcher</p>
              <h1 className="max-w-xl text-3xl font-black tracking-tight text-[#f5f0de] sm:text-4xl lg:text-5xl">
                Build your taste profile, match with friends, and get smarter movie picks.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Movie Matcher helps you save the movies and shows you love, compare taste with friends, and uncover
                recommendations that actually fit your vibe. If you want the smoothest experience, download the app
                and keep matching from your home screen.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownloadApp()}
                  disabled={isPwa}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    isPwa
                      ? "cursor-not-allowed bg-white/10 text-white/35"
                      : "bg-[#ff7a1a] text-black hover:bg-[#ff8d3b]"
                  }`}
                >
                  {isPwa ? "App installed" : deferredInstallPrompt ? "Download app" : "Install app"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                {
                  title: "Taste profile",
                  description: "Save movies and shows so the matcher learns what you actually like.",
                },
                {
                  title: "Friend scores",
                  description: "See compatibility with friends once your profile has enough history.",
                },
              ].map((item) => (
                <div key={item.title} className="border-t border-white/10 pt-4">
                  <p className="text-sm font-black text-[#f5f0de]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isPwa ? (
          <>
            {/* Tab Navigation */}
            <div id="matcher-tool" className="mb-5 flex gap-2 overflow-x-auto border-b border-white/10 scroll-mt-24 sm:mb-8">
              <button
                onClick={() => {
                  setActiveTab("build");
                }}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-6 sm:py-3 ${
                  activeTab === "build"
                    ? "border-[#ff7a1a] text-[#f5f0de]"
                    : "border-transparent text-white/55 hover:text-[#f5f0de]"
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
                <div className="mb-8 border-b border-white/10 pb-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                    <Sparkles className="h-5 w-5 text-[#ff7a1a]" />
                    <h2 className="text-base font-bold text-[#f5f0de] sm:text-lg">Your Taste Profile</h2>
                    <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 sm:ml-2">{tasteProfileCount} items</span>
                    {tastes.length > 0 && (
                      <button
                        onClick={() => setShowEditTasteModal(true)}
                        className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#f5f0de] transition-colors hover:bg-white/10 sm:ml-2 sm:w-auto"
                      >
                        Edit Taste
                      </button>
                    )}
                  </div>

                  {/* Taste Movies Horizontal Slider */}
                  {tasteProfile.length > 0 ? (
                    <div className="mb-4">
                      <div className="relative">
                        <div
                          ref={scrollContainerRef}
                          className="-mx-2 overflow-x-auto px-2 scrollbar-hide sm:mx-0 sm:px-0"
                        >
                          <div className="flex w-fit gap-2 pb-2 sm:gap-2.5">
                            {tasteProfile
                              .filter((taste) => taste.content && taste.content.title)
                              .slice(0, showAllMovies ? undefined : 6)
                              .map((taste) => (
                                <div key={taste.id} className="w-[4.75rem] flex-shrink-0 sm:w-20 md:w-24">
                                  <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-white/10 bg-[#111111] shadow-none transition-shadow hover:border-[#ff7a1a]/35">
                                    <img
                                      src={taste.content?.poster_url || undefined}
                                      alt={taste.content?.title || "Movie"}
                                      className="w-full h-full object-cover"
                                    />

                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                                      <button
                                        onClick={() => handleRemoveFromTaste(taste.id)}
                                        disabled={removingContent === taste.id}
                                        className="rounded-full bg-[#ff7a1a] p-2 text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b] disabled:bg-white/20 disabled:text-white/35"
                                        title="Remove from taste"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {taste.content?.type === "tv" && (
                                      <div className="absolute right-1 top-1 rounded-full bg-[#ff7a1a] px-1.5 py-0.5 text-[9px] font-bold text-[#0a0a0a]">
                                        TV
                                      </div>
                                    )}
                                    {taste.isMasterpiece && (
                                      <div className="absolute bottom-1 right-1 rounded-full bg-[#ff7a1a] px-1.5 py-0.5 text-[9px] font-bold text-[#0a0a0a] shadow">
                                        Masterpiece
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      {tasteProfile.length > 6 && (
                        <div className="mt-3 flex justify-start">
                          <button
                            onClick={() => setShowAllMovies(!showAllMovies)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5f0de] transition-colors hover:bg-white/10"
                          >
                            {showAllMovies ? "Show Less" : `View All (${tasteProfile.length})`}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-6 text-center">
                      <Plus className="mx-auto mb-2 h-8 w-8 text-white/35" />
                      <p className="mb-3 text-sm text-white/55">No movies yet</p>
                    </div>
                  )}

                  <div className="mt-4 mb-3 flex items-start gap-2 sm:items-center sm:mb-2">
                    <input
                      id="include-masterpieces"
                      type="checkbox"
                      checked={includeMasterpieces}
                      onChange={() => setIncludeMasterpieces((v) => !v)}
                      className="mt-0.5 h-4 w-4 accent-yellow-500 sm:mt-0"
                    />
                    <label htmlFor="include-masterpieces" className="select-none text-xs leading-5 text-gray-700 sm:text-sm">
                      Include masterpiece movies from your log in your taste profile
                    </label>
                  </div>

                  <button
                    onClick={() => setShowSearchModal(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
                  >
                    <Plus className="w-4 h-4" />
                    {tasteProfile.length > 0 ? "Add Another" : "Add Your First Movie"}
                  </button>
                </div>

                <div className="mt-10 border-t border-white/10 pt-6 sm:mt-12 sm:pt-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="hidden rounded-full border border-white/10 bg-white/5 p-3 text-[#f5f0de] sm:block">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2 sm:hidden">
                        <Users className="h-5 w-5 text-[#ff7a1a]" />
                        <h3 className="text-lg font-bold text-[#f5f0de]">Match With Friends</h3>
                      </div>
                      <h3 className="mb-2 hidden text-xl font-bold text-[#f5f0de] sm:block">Match With Friends</h3>
                      <p className="mb-5 max-w-2xl text-sm text-white/60 sm:text-base">
                        Instantly see your compatibility with friends who have built their taste profile.
                      </p>
                      {!canMatchFriends && (
                        <div className="mb-5 rounded-2xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 px-4 py-4 text-sm text-[#ffb36b]">
                          Add at least 7 movies to your taste profile before you can match with friends.
                        </div>
                      )}
                      {loadingFriends ? (
                        <div className="py-8 text-center text-sm text-white/55 sm:text-base">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading friends...
                        </div>
                      ) : friends.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55 sm:text-base">
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
                                disabled={!canMatchFriends}
                                onFindScore={async () => {
                                  if (!canMatchFriends) {
                                    setError("Add at least 7 movies to your taste profile before matching with friends.");
                                    return;
                                  }

                                  if (isMobileViewport) {
                                    router.push(`/movie-matcher/${friend.username}?from=matcher`);
                                    return;
                                  }

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
                                    const theirTastes = await getFullTasteProfile(friend.userId);
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

                                    if (user!.id !== friend.userId) {
                                      await createMatcherUpdateNotification(
                                        friend.userId,
                                        user!,
                                        friend.username,
                                        friend.name,
                                        new Date().toISOString()
                                      );
                                    }
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
            )}

            {activeTab === "match" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <Zap className="w-5 h-5 text-[#ff7a1a]" />
                    <h2 className="text-lg font-bold text-[#f5f0de]">Find Your Movie Match</h2>
                  </div>
                  <p className="text-sm text-white/60">
                    Compare your movie taste with friends and discover how compatible you are. See what movies you both love and get personalized recommendations!
                  </p>
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* Analysis Modal */}
        {showAnalysisModal && matchAnalysis && selectedFriend && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-[#090909] shadow-2xl sm:rounded-3xl">
              <MovieMatchAnalysisView
                embedded
                analysis={matchAnalysis}
                viewerName={user?.name || "You"}
                subjectName={selectedFriend.name}
                subjectUsername={selectedFriend.username}
                onClose={() => setShowAnalysisModal(false)}
              />
            </div>
          </div>
        )}

        {showInstallHelp && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#111111] p-5 text-[#f5f0de] shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffb36b]">Install app</p>
                  <h3 className="mt-2 text-2xl font-black">Add Canisterr to Home Screen</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallHelp(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-[#f5f0de]/72">
                <p>On iPhone, tap Share, then Add to Home Screen.</p>
                <p>On Android, tap the browser menu and choose Install app or Add to Home Screen.</p>
                <p>If you see an install banner, use that for the fastest setup.</p>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleDownloadApp()}
                  className="rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
                >
                  {deferredInstallPrompt ? "Install now" : "Try again"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInstallHelp(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
