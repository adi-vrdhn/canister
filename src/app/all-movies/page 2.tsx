"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import MovieCard from "@/components/MovieCard";
import ShareModal from "@/components/ShareModal";
import CinematicLoading from "@/components/CinematicLoading";
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
  const [selectedShare, setSelectedShare] = useState<ShareWithDetails | null>(null);

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
    return <CinematicLoading message="Your shared movies are loading" />;
  }

  if (!user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="px-3 py-4 sm:p-8">
        {/* Header with back button */}
        <div className="mb-5 flex items-center gap-3 sm:mb-8 sm:gap-4">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 sm:gap-2 sm:text-base"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            Back
          </Link>
          <h1 className="min-w-0 truncate text-xl font-bold text-gray-900 sm:text-3xl">
            All Shared Content
          </h1>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-gray-200 sm:mb-8 sm:gap-4">
          <button
            onClick={() => setActiveTab("recent")}
            className={`px-2 pb-2 text-sm font-medium transition-colors sm:px-4 sm:text-base ${
              activeTab === "recent"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Recent Shares
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-2 pb-2 text-sm font-medium transition-colors sm:px-4 sm:text-base ${
              activeTab === "watched"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Watched ({watchedShares.length})
          </button>
        </div>

        {/* Search Bar and Controls */}
        <div className="mb-5 space-y-3 sm:mb-8 sm:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400 sm:h-5 sm:w-5" />
            <input
              type="text"
              placeholder="Search by movie title or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:py-3 sm:pl-10 sm:pr-4 sm:text-base"
            />
          </div>

          {/* View Toggle Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-4 ${
                viewMode === "grid"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Grid3x3 className="h-4 w-4 sm:h-5 sm:w-5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-4 ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <List className="h-4 w-4 sm:h-5 sm:w-5" />
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
              <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-8 md:grid-cols-4 lg:grid-cols-5">
                {filteredShares.map((share) => (
                  <div
                    key={share.id}
                    onClick={() => setSelectedShare(share)}
                    className="min-w-0 cursor-pointer sm:w-44 lg:w-48"
                  >
                    <MovieCard
                      movie={share.movie || share.content}
                      sharedBy={share.sender?.name || "Unknown"}
                      compact
                      disableLink
                    />
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-2 sm:space-y-3">
                {filteredShares.map((share) => {
                  const item = share.movie || share.content;
                  const title = (item?.title || "Unknown");
                  const contentType = share.content_type || "movie";
                  
                  return (
                    <div
                      key={share.id}
                      onClick={() => setSelectedShare(share)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md sm:gap-4 sm:p-4"
                    >
                      {item?.poster_url && (
                        <img
                          src={item.poster_url}
                          alt={title}
                          className="h-20 w-14 flex-shrink-0 rounded object-cover sm:h-24 sm:w-16"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 sm:text-lg">
                            {title}
                          </p>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 sm:px-2 sm:py-1 sm:text-xs">
                            {contentType === "tv" ? "TV" : "Movie"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-600 sm:text-sm">
                          Shared by <span className="font-medium">@{share.sender?.username}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                          {new Date(share.created_at).toLocaleDateString()}
                        </p>
                        {item?.overview && (
                          <p className="mt-2 hidden text-sm text-gray-600 line-clamp-2 sm:block">
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
              <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-8 md:grid-cols-4 lg:grid-cols-5">
                {filteredWatchedShares.map((share) => (
                  <div
                    key={share.id}
                    onClick={() => setSelectedShare(share)}
                    className="min-w-0 cursor-pointer sm:w-44 lg:w-48"
                  >
                    <MovieCard
                      movie={share.movie || share.content}
                      sharedBy={share.sender?.name || "Unknown"}
                      compact
                      disableLink
                    />
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-2 sm:space-y-3">
                {filteredWatchedShares.map((share) => {
                  const item = share.movie || share.content;
                  const title = (item?.title || "Unknown");
                  const contentType = share.content_type || "movie";
                  
                  return (
                    <div
                      key={share.id}
                      onClick={() => setSelectedShare(share)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md sm:gap-4 sm:p-4"
                    >
                      {item?.poster_url && (
                        <img
                          src={item.poster_url}
                          alt={title}
                          className="h-20 w-14 flex-shrink-0 rounded object-cover sm:h-24 sm:w-16"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 sm:text-lg">
                            {title}
                          </p>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 sm:px-2 sm:py-1 sm:text-xs">
                            {contentType === "tv" ? "TV" : "Movie"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-600 sm:text-sm">
                          Shared by <span className="font-medium">@{share.sender?.username}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                          Shared {new Date(share.created_at).toLocaleDateString()}
                        </p>
                        {item?.overview && (
                          <p className="mt-2 hidden text-sm text-gray-600 line-clamp-2 sm:block">
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
        {selectedShare && (
          <ShareModal
            key={selectedShare.id}
            share={selectedShare}
            currentUserId={user.id}
            onClose={() => setSelectedShare(null)}
            user={user}
          />
        )}
      </div>
    </PageLayout>
  );
}
