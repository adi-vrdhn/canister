"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User, UserTasteWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserTasteProfile, addToUserTaste, removeFromUserTaste } from "@/lib/user-taste";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { ArrowLeft, Plus, Trash2, Loader2, Search, X } from "lucide-react";
import Link from "next/link";

export default function TastePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tastes, setTastes] = useState<UserTasteWithContent[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [contentType, setContentType] = useState<"movie" | "tv">("movie");
  const [addingContent, setAddingContent] = useState<string | null>(null);
  const [removingContent, setRemovingContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return (
          <PageLayout user={user}>
            <div className="flex items-center justify-center mt-12 mb-10">
              <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 uppercase">CANISTER</h1>
            </div>
            {/* ...existing code... */}
          </PageLayout>
        );

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);
        
        console.log("TastePage: Fetching taste profile for:", currentUser.id);
        // Fetch user's taste profile
        const userTastes = await getUserTasteProfile(currentUser.id);
        console.log("TastePage: Taste profile fetched:", userTastes.length, "items");
        setTastes(userTastes);

        setLoading(false);
        setError(null);
      }
    } catch (error) {
      console.error("TastePage: Error loading taste profile:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load taste profile"
      );
      setLoading(false);
    }
  });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      console.log("TastePage: Searching for", contentType, ":", query);
      let results: any[] = [];

      if (contentType === "movie") {
        results = await searchMovies(query);
      } else {
        results = await searchShows(query);
      }

      console.log("TastePage: Search returned", results.length, "results");
      
      // Add smart suggestions based on existing taste movies
      const suggestedResults = addSmartSuggestions(results);
      setSearchResults(suggestedResults.slice(0, 15));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Search failed";
      console.error("TastePage: Search error:", error);
      setError("Search error: " + errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const addSmartSuggestions = (searchResults: any[]) => {
    if (tastes.length === 0) return searchResults;

    // Extract directors and genres from existing taste
    const existingDirectors = new Set<string>();
    const existingGenres = new Set<string>();

    tastes.forEach((taste) => {
      if (taste.content && typeof taste.content === "object") {
        const content = taste.content as any;
        if (content.director) existingDirectors.add(content.director.toLowerCase());
        if (Array.isArray(content.genres)) {
          content.genres.forEach((g: string) => existingGenres.add(g.toLowerCase()));
        }
      }
    });

    // Score each result based on similarity
    const scoredResults = searchResults.map((result) => {
      let score = 0;
      const resultDirector = (result.director || result.director_name || "").toLowerCase();
      const resultGenres = Array.isArray(result.genres)
        ? result.genres.map((g: string) => g.toLowerCase())
        : [];

      // Director match = +50 points
      if (resultDirector && existingDirectors.has(resultDirector)) {
        score += 50;
      }

      // Genre matches = +10 points each
      resultGenres.forEach((genre: string) => {
        if (existingGenres.has(genre)) score += 10;
      });

      return { ...result, _suggestionScore: score };
    });

    // Sort by suggestion score (highest first), then by original order
    return scoredResults.sort((a, b) => (b._suggestionScore || 0) - (a._suggestionScore || 0));
  };

  const handleAddToTaste = async (contentId: number) => {
    if (!user) return;

    try {
      setAddingContent(`${contentType}-${contentId}`);
      setError(null);
      console.log("TastePage: Adding", contentType, "to taste:", contentId);
      const newTaste = await addToUserTaste(user.id, contentId, contentType);

      console.log("TastePage: Added to taste, refreshing profile");
      // Refresh tastes
      const updatedTastes = await getUserTasteProfile(user.id);
      console.log("TastePage: Updated tastes count:", updatedTastes.length);
      setTastes(updatedTastes);

      // Clear search
      setSearchResults([]);
      setSearchQuery("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("TastePage: Error adding to taste:", error);
      setError("Failed to add to taste: " + errorMessage);
    } finally {
      setAddingContent(null);
    }
  };

  const handleRemoveFromTaste = async (tasteId: string) => {
    try {
      setRemovingContent(tasteId);
      setError(null);
      console.log("TastePage: Removing taste:", tasteId);
      await removeFromUserTaste(tasteId);

      console.log("TastePage: Removed, refreshing profile");
      // Refresh tastes
      const updatedTastes = await getUserTasteProfile(user?.id || "");
      console.log("TastePage: Updated tastes count:", updatedTastes.length);
      setTastes(updatedTastes);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("TastePage: Error removing from taste:", error);
      setError("Failed to remove from taste: " + errorMessage);
    } finally {
      setRemovingContent(null);
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your taste profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <PageLayout user={user || { id: "", username: "", name: "", avatar_url: null, created_at: "" }} onSignOut={handleSignOut}>
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Taste Profile</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return null;
  }

  const isTasteComplete = tastes.length >= 7;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8">
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
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/profile"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Taste</h1>
              <p className="text-gray-600">
                {isTasteComplete
                  ? `You have ${tastes.length} movies in your taste profile`
                  : `Add at least 7 movies to complete your profile (${tastes.length}/7)`}
              </p>
            </div>

            <button
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Movie
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Profile Completion</span>
            <span className="text-sm font-medium text-gray-700">
              {tastes.length}/7 minimum
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isTasteComplete ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min((tastes.length / 7) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Taste Movies Grid */}
        {tastes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {tastes.filter((taste) => taste.content && taste.content.title).map((taste) => (
              <div key={taste.id} className="flex flex-col">
                <div className="relative w-full aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow mb-3 group">
                  <img
                    src={taste.content?.poster_url || ""}
                    alt={taste.content?.title || "Movie"}
                    className="w-full h-full object-cover"
                  />

                  {/* Hover overlay with delete button */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleRemoveFromTaste(taste.id)}
                      disabled={removingContent === taste.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
                      title="Remove from taste"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* TV Badge */}
                  {taste.content?.type === "tv" && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                      TV
                    </div>
                  )}
                </div>

                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {taste.content?.title || "Unknown"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Plus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No movies in your taste profile yet</p>
            <button
              onClick={() => setShowSearchModal(true)}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Add your first movie
            </button>
          </div>
        )}

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
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                    placeholder={`Search ${contentType === "movie" ? "movies" : "TV shows"}...`}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((result) => {
                    const isAlreadyAdded = tastes.some(
                      (t) => t.content_id === result.id && t.content_type === contentType
                    );

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
                          alt={result.title || result.name}
                          className="w-12 h-16 rounded object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                            {result.title || result.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {result.release_date || result.premiered
                              ? new Date(
                                  result.release_date || result.premiered
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
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          {addingContent === `${contentType}-${result.id}`
                            ? "Adding..."
                            : isAlreadyAdded
                            ? "Added"
                            : "Add"}
                        </button>
                      </div>
                    );
                  })
                ) : searchQuery.trim() ? (
                  <div className="text-center py-8 text-gray-500">No results found</div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Search to find {contentType === "movie" ? "movies" : "TV shows"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
