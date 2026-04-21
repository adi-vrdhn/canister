"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { User, List, ListWithItems } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserLists, getPublicLists, createList, getListCoverImages, getListWithDetails } from "@/lib/lists";
import { Plus, Lock, Globe, Loader2, Search, LayoutGrid, Rows3, Compass } from "lucide-react";
import Link from "next/link";

type ViewMode = "grid" | "list";

type DiscoverList = ListWithItems & {
  engagementScore: number;
};

function matchesQuery(list: List, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    list.name.toLowerCase().includes(normalized) ||
    (list.description || "").toLowerCase().includes(normalized) ||
    list.owner_id.toLowerCase().includes(normalized)
  );
}

function getDisplayName(user?: User | null, fallback = "Unknown") {
  const name = user?.name?.trim();
  if (name) return name;

  const username = user?.username?.trim();
  if (username) return username;

  return fallback;
}

function buildListAttribution(list: DiscoverList, currentUserId: string) {
  const ownerEntry = list.collaborators.find((collab) => collab.role === "owner" || collab.user_id === list.owner_id);
  const creatorName = list.owner_id === currentUserId
    ? "You"
    : getDisplayName(ownerEntry?.user, list.owner_id);

  const collaboratorNames = list.collaborators
    .filter((collab) => collab.user_id !== list.owner_id)
    .map((collab) => getDisplayName(collab.user))
    .filter((name) => name && name !== "Unknown");

  const firstCollaborator = collaboratorNames[0] ?? null;
  const extraCollaborators = Math.max(0, collaboratorNames.length - 1);

  return {
    creatorName,
    firstCollaborator,
    extraCollaborators,
    collaboratorCountLabel: collaboratorNames.length,
  };
}

function ListCard({
  list,
  coverImages,
  compact,
  currentUserId,
}: {
  list: DiscoverList;
  coverImages: string[];
  compact: boolean;
  currentUserId: string;
}) {
  const attribution = buildListAttribution(list, currentUserId);
  const hasCustomCover = list.cover_type === "custom" && Boolean(list.cover_image_url);
  const coverClassName = compact
    ? "relative w-24 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 shadow-sm"
    : "relative w-full aspect-[2/3] bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow mb-3";

  const content = (
    <div className={compact ? "flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md" : "group cursor-pointer"}>
      <div className={coverClassName}>
        {hasCustomCover && list.cover_image_url ? (
          <img
            src={list.cover_image_url}
            alt={list.name}
            className="h-full w-full object-cover"
          />
        ) : coverImages.length > 0 ? (
          <div className="grid h-full w-full grid-cols-2">
            {coverImages.slice(0, 4).map((url, idx) => (
              <div key={idx} className="h-full w-full overflow-hidden">
                <img src={url} alt={`Cover ${idx + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
            <Plus className="w-12 h-12 text-white opacity-50" />
          </div>
        )}

        {!compact && (
          <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-full">
            {list.privacy === "private" ? (
              <Lock className="w-4 h-4 text-white" />
            ) : (
              <Globe className="w-4 h-4 text-white" />
            )}
          </div>
        )}
      </div>

      <div className={compact ? "flex-1 min-w-0" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`font-semibold text-gray-900 truncate ${compact ? "group-hover:text-blue-600" : "group-hover:text-blue-600"}`}>
              {list.name}
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {list.description || "No description"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
              <span>
                By <span className="font-medium text-gray-700">{attribution.creatorName}</span>
              </span>
              {attribution.firstCollaborator && (
                <>
                  <span>and</span>
                  <span className="font-medium text-gray-700">{attribution.firstCollaborator}</span>
                </>
              )}
              {attribution.extraCollaborators > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                  +{attribution.extraCollaborators}
                </span>
              )}
            </div>
            {attribution.collaboratorCountLabel > 0 && (
              <p className="mt-1 text-[11px] text-gray-400">
                {attribution.collaboratorCountLabel} collaborator{attribution.collaboratorCountLabel === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {compact && (
            <div className="flex-shrink-0 rounded-full bg-gray-100 p-2 text-gray-600">
              {list.privacy === "private" ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return <Link href={`/lists/${list.id}`}>{content}</Link>;
}

export default function ListsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLists, setUserLists] = useState<DiscoverList[]>([]);
  const [publicLists, setPublicLists] = useState<DiscoverList[]>([]);
  const [listCovers, setListCovers] = useState<Record<string, string[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListPrivacy, setNewListPrivacy] = useState<"private" | "public">("private");
  const [newListIsRanked, setNewListIsRanked] = useState<boolean | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [activeSection, setActiveSection] = useState<"global" | "friends" | "your">("global");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sectionViews, setSectionViews] = useState<Record<"global" | "friends" | "your", ViewMode>>({
    global: "grid",
    friends: "grid",
    your: "grid",
  });

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

        const allUsersRef = ref(db, "users");
        const allUsersSnapshot = await get(allUsersRef);
        const allUsers = allUsersSnapshot.exists() ? (allUsersSnapshot.val() as Record<string, User>) : {};

        // Fetch user's lists
        const lists = await getUserLists(currentUser.id);
        const userListsWithDetails = await Promise.all(
          lists.map(async (list) => {
            const details = await getListWithDetails(list.id, allUsers);
            if (!details) return null;

            const collaboratorCount = details.collaborators.filter((collab) => collab.user_id !== details.owner_id).length;
            const watchSignal = details.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);

            return {
              ...details,
              engagementScore: details.item_count * 2 + collaboratorCount * 3 + watchSignal,
            };
          })
        );
        setUserLists(userListsWithDetails.filter((list): list is DiscoverList => Boolean(list)));

        // Fetch cover images for each list
        const covers: Record<string, string[]> = {};
        for (const list of lists) {
          covers[list.id] = await getListCoverImages(list.id);
        }
        setListCovers(covers);

        // Fetch public lists and sort by engagement
        const publicListsBase = await getPublicLists(30);
        const publicListsWithDetails = await Promise.all(
          publicListsBase.map(async (list) => {
            const details = await getListWithDetails(list.id, allUsers);
            if (!details) return null;

            const collaboratorCount = details.collaborators.filter((collab) => collab.user_id !== details.owner_id).length;
            const watchSignal = details.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);

            return {
              ...details,
              engagementScore: details.item_count * 2 + collaboratorCount * 3 + watchSignal,
            };
          })
        );
        setPublicLists(
          publicListsWithDetails
            .filter((list): list is DiscoverList => Boolean(list))
            .sort((a, b) => b.engagementScore - a.engagementScore)
        );

        const publicCovers: Record<string, string[]> = {};
        for (const list of publicListsBase) {
          publicCovers[list.id] = await getListCoverImages(list.id);
        }
        setListCovers((prev) => ({ ...prev, ...publicCovers }));

        setLoading(false);
      } catch (error) {
        console.error("Error fetching lists:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleCreateList = async () => {
    if (!user || !newListName.trim() || newListIsRanked === null) return;

    try {
      setCreatingList(true);
      const createdList = await createList(
        user.id,
        newListName,
        newListDescription || null,
        newListPrivacy,
        newListIsRanked
      );

      // Reset form
      setNewListName("");
      setNewListDescription("");
      setNewListPrivacy("private");
      setNewListIsRanked(null);
      setShowCreateModal(false);

      // Navigate to the new list
      router.push(`/lists/${createdList.id}`);
    } catch (error) {
      console.error("Error creating list:", error);
      alert("Failed to create list");
    } finally {
      setCreatingList(false);
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

  const currentUserId = user?.id ?? "";

  const ownedLists = useMemo(
    () => userLists.filter((list) => list.owner_id === currentUserId),
    [userLists, currentUserId]
  );

  const friendLists = useMemo(
    () => userLists.filter((list) => list.owner_id !== currentUserId),
    [userLists, currentUserId]
  );

  const filteredPublicLists = useMemo(
    () => publicLists.filter((list) => matchesQuery(list, globalSearch)),
    [publicLists, globalSearch]
  );

  const filteredFriendLists = useMemo(
    () => friendLists.filter((list) => matchesQuery(list, globalSearch)),
    [friendLists, globalSearch]
  );

  const filteredOwnedLists = useMemo(
    () => ownedLists.filter((list) => matchesQuery(list, globalSearch)),
    [ownedLists, globalSearch]
  );

  const scrollToSection = (refEl: { current: HTMLDivElement | null }) => {
    refEl.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading || !user) {
    return <CinematicLoading message="Your lists are loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8 space-y-10">
        <div className="sticky top-4 z-20 rounded-3xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm">
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <button
                onClick={() => setActiveSection("global")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                  activeSection === "global"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Compass className="h-4 w-4 flex-shrink-0" />
                Global
              </button>
              <button
                onClick={() => setActiveSection("friends")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                  activeSection === "friends"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Globe className="h-4 w-4 flex-shrink-0" />
                Friends
              </button>
              <button
                onClick={() => setActiveSection("your")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                  activeSection === "your"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Lock className="h-4 w-4 flex-shrink-0" />
                Your
              </button>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search all list sections..."
                className="w-full rounded-2xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {activeSection === "global" && (
          <section className="scroll-mt-28">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Global Lists</h2>
                <p className="text-sm text-gray-600">Public lists ranked by engagement.</p>
              </div>
              <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setSectionViews((prev) => ({ ...prev, global: "grid" }))}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    sectionViews.global === "grid" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                </button>
                <button
                  onClick={() => setSectionViews((prev) => ({ ...prev, global: "list" }))}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    sectionViews.global === "list" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Rows3 className="h-4 w-4" />
                  List
                </button>
              </div>
            </div>

            {filteredPublicLists.length > 0 ? (
              <div
                className={
                  sectionViews.global === "grid"
                    ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                    : "space-y-3"
                }
              >
                {filteredPublicLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact={sectionViews.global === "list"}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
                No public lists match your search.
              </div>
            )}
          </section>
        )}

        {activeSection === "friends" && (
          <section className="scroll-mt-28">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Friends&apos; Lists</h2>
                <p className="text-sm text-gray-600">Collaborative and shared lists from your network.</p>
              </div>
              <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setSectionViews((prev) => ({ ...prev, friends: "grid" }))}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    sectionViews.friends === "grid" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                </button>
                <button
                  onClick={() => setSectionViews((prev) => ({ ...prev, friends: "list" }))}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    sectionViews.friends === "list" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Rows3 className="h-4 w-4" />
                  List
                </button>
              </div>
            </div>

            {filteredFriendLists.length > 0 ? (
              <div
                className={
                  sectionViews.friends === "grid"
                    ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                    : "space-y-3"
                }
              >
                {filteredFriendLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact={sectionViews.friends === "list"}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
                No friends&apos; lists match your search.
              </div>
            )}
          </section>
        )}

        {activeSection === "your" && (
          <section className="scroll-mt-28">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Lists</h2>
                <p className="text-sm text-gray-600">Everything you own, ready to organize and share.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                  <button
                    onClick={() => setSectionViews((prev) => ({ ...prev, your: "grid" }))}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      sectionViews.your === "grid" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Grid
                  </button>
                  <button
                    onClick={() => setSectionViews((prev) => ({ ...prev, your: "list" }))}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      sectionViews.your === "list" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Rows3 className="h-4 w-4" />
                    List
                  </button>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create List
                </button>
              </div>
            </div>

            {filteredOwnedLists.length > 0 ? (
              <div
                className={
                  sectionViews.your === "grid"
                    ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                    : "space-y-3"
                }
              >
                {filteredOwnedLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact={sectionViews.your === "list"}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
                No lists match your search.
              </div>
            )}
          </section>
        )}

      {/* Create List Modal */}
      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Create a New List</h3>

            <div className="space-y-4">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  List Name *
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Sci-Fi Classics"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Add a description (optional)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Privacy Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Privacy
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewListPrivacy("private")}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      newListPrivacy === "private"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                  <button
                    onClick={() => setNewListPrivacy("public")}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      newListPrivacy === "public"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Public
                  </button>
                </div>
              </div>

              {/* List Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  List Type *
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setNewListIsRanked(false)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors text-left border-2 ${
                      newListIsRanked === false
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Regular List</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Add movies in any order. Drag to reorder.
                    </div>
                  </button>
                  <button
                    onClick={() => setNewListIsRanked(true)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors text-left border-2 ${
                      newListIsRanked === true
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Ranked List</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Rank movies from best to worst with numbers displayed.
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                disabled={!newListName.trim() || newListIsRanked === null || creatingList}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {creatingList ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}
