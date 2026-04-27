"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { ArrowLeft, Grid3x3, List, MoreVertical, Search } from "lucide-react";
import CinematicLoading from "@/components/CinematicLoading";
import PageLayout from "@/components/PageLayout";
import ShareModal from "@/components/ShareModal";
import { signOut as authSignOut } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { getFriendLogs } from "@/lib/friend-logs";
import { buildLogUrl } from "@/lib/log-url";
import { MovieLogWithContent, ShareWithDetails, User } from "@/types";

type ActivityFilter = "all" | "shared" | "logged";
type ShareFilter = "recent" | "watched";
type ViewMode = "grid" | "list";

type ActivityItem =
  | {
      id: string;
      kind: "shared";
      poster_url: string | null;
      title: string;
      byline: string;
      reaction: "";
      createdAt: string;
      searchText: string;
      share: ShareWithDetails;
    }
  | {
      id: string;
      kind: "logged";
      poster_url: string | null;
      title: string;
      byline: string;
      reaction: string;
      createdAt: string;
      searchText: string;
      log: MovieLogWithContent & { friend: User };
    };

function reactionLabel(reaction: 0 | 1 | 2): string {
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1) return "Good";
  return "Bad";
}

export default function AllMoviesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shares, setShares] = useState<ShareWithDetails[]>([]);
  const [friendLogs, setFriendLogs] = useState<(MovieLogWithContent & { friend: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [shareFilter, setShareFilter] = useState<ShareFilter>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShare, setSelectedShare] = useState<ShareWithDetails | null>(null);
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        const userData = userSnapshot.val();
        const currentUser: User = userSnapshot.exists()
          ? {
              id: userData.id,
              username: userData.username,
              name: userData.name,
              avatar_url: userData.avatar_url || null,
              created_at: userData.createdAt || userData.created_at || new Date().toISOString(),
            }
          : {
              id: firebaseUser.uid,
              username: firebaseUser.email?.split("@")[0] || "user",
              name: firebaseUser.displayName || "User",
              avatar_url: null,
              created_at: new Date().toISOString(),
            };

        setUser(currentUser);

        try {
          const logs = await getFriendLogs(currentUser.id, 14, 100);
          setFriendLogs(logs);
        } catch (error) {
          console.error("Error loading friend logs:", error);
        }

        const sharesRef = ref(db, "shares");
        const unsubscribeShares = onValue(sharesRef, async (snapshot) => {
          if (!snapshot.exists()) {
            setShares([]);
            setLoading(false);
            return;
          }

          const sharesList = Object.entries(snapshot.val())
            .map(([id, data]: any) => ({ id, ...data }))
            .filter((share: any) => share.receiver_id === currentUser.id)
            .sort(
              (a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

          try {
            const usersSnapshot = await get(ref(db, "users"));
            const usersData = usersSnapshot.val() || {};
            setShares(
              sharesList.map((share: any) => ({
                ...share,
                movie: share.movie || null,
                content: share.content || share.movie || null,
                sender: Object.values(usersData).find((entry: any) => entry.id === share.sender_id),
              }))
            );
          } catch (error) {
            console.error("Error loading share senders:", error);
            setShares(sharesList);
          } finally {
            setLoading(false);
          }
        });

        return () => unsubscribeShares();
      } catch (error) {
        console.error("Error loading activity page:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  const activities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const selectedShares = shares.filter((share) =>
      shareFilter === "recent" ? !share.watched : Boolean(share.watched)
    );

    const sharedActivities: ActivityItem[] = selectedShares.map((share) => {
      const content = share.movie || share.content;
      const title = content?.title || "Unknown";
      const sender = share.sender?.name || "Unknown";
      return {
        id: `share-${share.id}`,
        kind: "shared",
        poster_url: content?.poster_url || null,
        title,
        byline: `shared by ${sender}`,
        reaction: "",
        createdAt: share.created_at,
        searchText: `${title} ${sender}`.toLowerCase(),
        share,
      };
    });

    const loggedActivities: ActivityItem[] = friendLogs.map((log) => ({
      id: `log-${log.id}`,
      kind: "logged",
      poster_url: log.content.poster_url,
      title: log.content.title,
      byline: `by ${log.friend.name}`,
      reaction: reactionLabel(log.reaction as 0 | 1 | 2),
      createdAt: log.created_at,
      searchText: `${log.content.title} ${log.friend.name} ${log.notes || ""}`.toLowerCase(),
      log,
    }));

    const combined = [
      ...(activityFilter === "logged" ? [] : sharedActivities),
      ...(activityFilter === "shared" ? [] : loggedActivities),
    ];

    return combined
      .filter((item) => !query || item.searchText.includes(query))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [activityFilter, friendLogs, searchQuery, shareFilter, shares]);

  const recentSharesCount = shares.filter((share) => !share.watched).length;
  const watchedSharesCount = shares.filter((share) => share.watched).length;

  const openActivity = (item: ActivityItem) => {
    if (item.kind === "shared") {
      setSelectedShare(item.share);
    } else {
      router.push(buildLogUrl(item.log));
    }
  };

  if (loading) {
    return <CinematicLoading message="Friends activity is loading" />;
  }

  if (!user) return null;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-[#f5f0de] hover:text-[#f5f0de] sm:gap-2 sm:text-base"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              Back
            </Link>
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-3xl">
              Friends Activity
            </h1>
            <p className="text-xs text-gray-500 sm:text-sm">Shared titles and friends&apos; logs combined.</p>
          </div>

          <div className="relative">
            <button
              type="button"
              aria-label="View options"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
              onClick={() => setShowViewMenu((current) => !current)}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showViewMenu && (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("grid");
                    setShowViewMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                    viewMode === "grid" ? "bg-blue-50 text-[#f5f0de]" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" />
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("list");
                    setShowViewMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                    viewMode === "list" ? "bg-blue-50 text-[#f5f0de]" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <List className="h-4 w-4" />
                  List
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 space-y-4 sm:mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              ["all", "All"],
              ["shared", "Shared"],
              ["logged", "Logged"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActivityFilter(value)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                  activityFilter === value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activityFilter !== "logged" && (
            <div className="flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setShareFilter("recent")}
                className={`px-2 pb-2 text-sm font-bold transition-colors sm:px-4 ${
                  shareFilter === "recent"
                    ? "border-b-2 border-blue-600 text-[#f5f0de]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Recent Shares ({recentSharesCount})
              </button>
              <button
                type="button"
                onClick={() => setShareFilter("watched")}
                className={`px-2 pb-2 text-sm font-bold transition-colors sm:px-4 ${
                  shareFilter === "watched"
                    ? "border-b-2 border-blue-600 text-[#f5f0de]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Watched ({watchedSharesCount})
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search titles or friends..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {activities.length > 0 ? (
          <div className={viewMode === "grid" ? "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5" : "space-y-3"}>
            {activities.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openActivity(item)}
                className={
                  viewMode === "grid"
                    ? "min-w-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                    : "flex w-full cursor-pointer items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                }
              >
                <div className={viewMode === "grid" ? "relative aspect-[3/4] overflow-hidden bg-slate-100 sm:h-64 sm:aspect-auto" : "relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100"}>
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      No poster
                    </div>
                  )}
                </div>

                <div className={viewMode === "grid" ? "p-2 sm:p-4" : "min-w-0 flex-1"}>
                  <h3 className="mb-1 truncate text-[11px] font-semibold leading-tight text-slate-900 sm:text-lg">
                    {item.title}
                  </h3>
                  <p className="mb-1 truncate text-[10px] leading-tight text-slate-500 sm:text-sm">
                    {item.byline}
                  </p>
                  <div className="min-h-[1rem] sm:min-h-[1.5rem]">
                    <span className="text-[10px] font-medium text-slate-700 sm:text-sm">
                      {item.reaction}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center">
            <p className="mb-2 font-medium text-slate-700">No activity found</p>
            <p className="text-sm text-slate-500">Try another filter or search.</p>
          </div>
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
