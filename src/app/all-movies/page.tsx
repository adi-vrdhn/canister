"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import MovieCard from "@/components/MovieCard";
import { User, ShareWithDetails } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { ArrowLeft, Grid3x3, List, Search } from "lucide-react";
import Link from "next/link";

export default function AllMoviesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shares, setShares] = useState<ShareWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"recent" | "watched">("recent");

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

            // Fetch users for sender details
            try {
              const usersRef = ref(db, "users");
              const usersSnapshot = await get(usersRef);
              const usersData = usersSnapshot.val() || {};

              const sharesWithDetails: ShareWithDetails[] = sharesList.map(
                (share: any) => ({
                  ...share,
                  movie: share.movie || null,
                  sender: Object.values(usersData).find(
                    (u: any) => u.id === share.sender_id
                  ),
                })
              );

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

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Filter shares based on search query (by title or sender name)
  const unwatchedShares = shares.filter((share) => !share.watched);
  const watchedShares = shares.filter((share) => share.watched);

  const filteredShares = unwatchedShares.filter((share) => {
    const item = share.movie || share.content;
    const title = (item?.title || "").toLowerCase();
    const senderName = (share.sender?.name || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query) || senderName.includes(query);
  });

  const filteredWatchedShares = watchedShares.filter((share) => {
    const item = share.movie || share.content;
    const title = (item?.title || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query);
  });

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
      <div className="p-8">
        {/* Header with back button */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            All Shared Content
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("recent")}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === "recent"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Recent Shares
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === "watched"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Watched ({watchedShares.length})
          </button>
        </div>

        {/* Search Bar and Controls */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by movie title or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* View Toggle Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <List className="w-5 h-5" />
              List
            </button>
          </div>

          {/* Results Count */}
          {searchQuery && (
            <p className="text-sm text-gray-600">
              Found {activeTab === "recent" ? filteredShares.length : filteredWatchedShares.length} result{(activeTab === "recent" ? filteredShares.length : filteredWatchedShares.length) !== 1 ? "s" : ""} for "{searchQuery}"
            </p>
          )}
        </div>

        {/* Content based on active tab */}
        {activeTab === "recent" ? (
          // Recent Shares Tab
          filteredShares.length > 0 ? (
            viewMode === "grid" ? (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {filteredShares.map((share) => (
                  <div key={share.id} className="w-56">
                    <MovieCard
                      movie={share.movie || share.content}
                      sharedBy={share.sender?.name || "Unknown"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-3">
                {filteredShares.map((share) => {
                  const item = share.movie || share.content;
                  const title = (item?.title || "Unknown");
                  const contentType = share.content_type || "movie";
                  
                  return (
                    <div
                      key={share.id}
                      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      {item?.poster_url && (
                        <img
                          src={item.poster_url}
                          alt={title}
                          className="w-16 h-24 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900 truncate">
                            {title}
                          </p>
                          <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            {contentType === "tv" ? "TV" : "Movie"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Shared by <span className="font-medium">@{share.sender?.username}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(share.created_at).toLocaleDateString()}
                        </p>
                        {item?.overview && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {item.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600 font-medium">
                {searchQuery ? "No results found" : "No content shared yet"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Clear search
                </button>
              )}
            </div>
          )
        ) : (
          // Watched Tab
          filteredWatchedShares.length > 0 ? (
            viewMode === "grid" ? (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {filteredWatchedShares.map((share) => (
                  <div key={share.id} className="w-56">
                    <MovieCard
                      movie={share.movie || share.content}
                      sharedBy={share.sender?.name || "Unknown"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-3">
                {filteredWatchedShares.map((share) => {
                  const item = share.movie || share.content;
                  const title = (item?.title || "Unknown");
                  const contentType = share.content_type || "movie";
                  
                  return (
                    <div
                      key={share.id}
                      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      {item?.poster_url && (
                        <img
                          src={item.poster_url}
                          alt={title}
                          className="w-16 h-24 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900 truncate">
                            {title}
                          </p>
                          <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            {contentType === "tv" ? "TV" : "Movie"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Shared by <span className="font-medium">@{share.sender?.username}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Shared {new Date(share.created_at).toLocaleDateString()}
                        </p>
                        {item?.overview && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {item.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600 font-medium">No watched movies yet</p>
            </div>
          )
        )}
      </div>
    </PageLayout>
  );
}
