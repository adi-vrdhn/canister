"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User, List, Content } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { addItemToList, getListWithDetails } from "@/lib/lists";
import { ArrowLeft, Search, Plus, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function AddItemsToListPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"movie" | "tv">("movie");
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user
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

        // Fetch list
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        const usersData = usersSnapshot.val() || {};

        const listData = await getListWithDetails(listId, usersData);
        if (listData) {
          setList(listData);
        } else {
          router.push("/lists");
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading list:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [listId, router]);

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
      let results: Content[] = [];

      if (selectedTab === "movie") {
        const movies = await searchMovies(query);
        results = movies.map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : null,
          backdrop_url: undefined,
          genres: [],
          platforms: [],
          director: movie.director || null,
          release_date: movie.release_date,
          overview: movie.overview,
          runtime: movie.runtime,
          rating: movie.vote_average,
          created_at: new Date().toISOString(),
          type: "movie" as const,
        } as Content));
      } else {
        const shows = await searchShows(query);
        results = shows.map((show) => ({
          id: show.id,
          title: show.name,
          poster_url: show.image?.medium || null,
          genres: [],
          status: show.status || null,
          release_date: show.premiered || null,
          overview: show.summary || null,
          runtime: show.runtime || null,
          rating: show.rating?.average || null,
          created_at: new Date().toISOString(),
          type: "tv" as const,
        } as Content));
      }

      setSearchResults(results);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddItem = async (content: Content) => {
    if (!user || !list) return;

    try {
      const contentId = content.id;
      const contentType = content.type === "tv" ? "tv" : "movie";

      await addItemToList(listId, contentId, contentType, user.id);

      // Mark as added
      setAddedItems(new Set([...addedItems, `${contentId}-${contentType}`]));
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item to list");
    }
  };

  if (loading || !user) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="p-8 text-center">
          <p className="text-gray-600">List not found</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <Link
          href={`/lists/${listId}`}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to {list.name}
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Items to List</h1>
        <p className="text-gray-600 mb-8">Search and add movies or shows to your list</p>

        {/* Search Section */}
        <div className="mb-8">
          {/* Tab Selection */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setSelectedTab("movie");
                setSearchResults([]);
                setSearchQuery("");
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTab === "movie"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => {
                setSelectedTab("tv");
                setSearchResults([]);
                setSearchQuery("");
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTab === "tv"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Shows
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder={`Search ${selectedTab === "movie" ? "movies" : "shows"}...`}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Results Grid */}
        {searchResults.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {searchResults.map((content) => {
              const key = `${content.id}-${content.type || "movie"}`;
              const isAdded = addedItems.has(key);

              return (
                <div
                  key={key}
                  className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                >
                  {/* Poster */}
                  <div className="relative aspect-video bg-gray-200 overflow-hidden">
                    {content.poster_url ? (
                      <img
                        src={content.poster_url}
                        alt={content.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                    {isAdded && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="p-3">
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">
                      {content.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      {content.release_date
                        ? new Date(content.release_date).getFullYear()
                        : "N/A"}
                    </p>

                    {/* Add Button */}
                    <button
                      onClick={() => handleAddItem(content)}
                      disabled={isAdded}
                      className={`w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition-colors ${
                        isAdded
                          ? "bg-green-100 text-green-700 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : searchQuery ? (
          <div className="text-center py-12">
            {searching ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                <p className="text-gray-600">Searching...</p>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">
                  No {selectedTab === "movie" ? "movies" : "shows"} found matching "{searchQuery}"
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Search className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600">
              Start typing to search for {selectedTab === "movie" ? "movies" : "shows"}
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
