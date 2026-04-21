"use client";
import { useState, useEffect } from "react";
import { getLogsForContent, createMovieLog } from "@/lib/logs";
import { format } from "date-fns";

function MenuButton({ onEdit, onAddItems, canEdit, isOwner, onDelete, onToggleWatchedStatus, watchedStatusEnabled }: {
  onEdit: () => void;
  onAddItems: () => void;
  canEdit: boolean;
  isOwner: boolean;
  onDelete?: () => void;
  onToggleWatchedStatus?: () => void;
  watchedStatusEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-50">
      <button
        type="button"
        aria-label="Open menu"
        className="relative z-50 rounded-full bg-white p-2.5 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 hover:shadow"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="w-6 h-6" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl z-50">
          {canEdit && (
            <div className="p-2">
              {canEdit && (
                <button
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50"
                  onClick={() => { setOpen(false); onEdit(); }}
                >
                  <Edit2 className="mt-0.5 h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Edit details</p>
                    <p className="text-xs text-gray-500">Title, privacy, description</p>
                  </div>
                </button>
              )}
              <button
                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50"
                onClick={() => { setOpen(false); onAddItems(); }}
              >
                <Plus className="mt-0.5 h-4 w-4 text-gray-700" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Add movies</p>
                  <p className="text-xs text-gray-500">Add items to the list</p>
                </div>
              </button>
              <button
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50 ${
                  watchedStatusEnabled ? "text-green-700" : ""
                }`}
                onClick={() => { setOpen(false); onToggleWatchedStatus && onToggleWatchedStatus(); }}
              >
                <Eye className={`mt-0.5 h-4 w-4 ${watchedStatusEnabled ? "text-green-600" : "text-gray-700"}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">Watched status</p>
                  <p className="text-xs text-gray-500">See who watched what</p>
                </div>
              </button>
              {isOwner && onDelete && (
                <button
                  className="mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-red-600 hover:bg-red-50"
                  onClick={() => { setOpen(false); onDelete(); }}
                >
                  <Trash2 className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Delete list</p>
                    <p className="text-xs text-red-500">Permanently remove this list</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User, ListWithItems, ListCollaboratorWithUser } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getListWithDetails, removeItemFromList, addCollaborator, removeCollaborator, updateList, deleteList, isUserCollaborator, markItemAsWatched, unmarkItemAsWatched, updateListViewPreferences, reorderListItems } from "@/lib/lists";
import { ArrowLeft, Lock, Globe, Plus, Trash2, UserPlus, UserX, Loader2, Edit2, Grid3x3, List as ListIcon, Eye, MoreVertical } from "lucide-react";
// ...existing imports above...
import Link from "next/link";


export default function ListDetailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [list, setList] = useState<ListWithItems | null>(null);
  const [logsMap, setLogsMap] = useState<Record<number, any[]>>({});
  useEffect(() => {
    if (!list) return;
    let cancelled = false;
    (async () => {
      const map: Record<number, any[]> = {};
      await Promise.all(
        list.items.map(async (item: any) => {
          const logs = await getLogsForContent(Number(item.content.id), "movie");
          map[item.content.id] = logs.sort((a: any, b: any) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime());
        })
      );
      if (!cancelled) setLogsMap(map);
    })();
    return () => { cancelled = true; };
  }, [list]);

  // Watched status state (must be after user/list)
  const [watchedStatusEnabled, setWatchedStatusEnabled] = useState(false);
  const [watchedMap, setWatchedMap] = useState<Record<string, { user: any }[]>>({});
  const [userWatchedIds, setUserWatchedIds] = useState<Set<string>>(new Set());
  const [markingWatched, setMarkingWatched] = useState<string | null>(null);

  useEffect(() => {
    if (!watchedStatusEnabled || !list || !user) return;
    const fetchWatched = async () => {
      const map: Record<string, { user: any }[]> = {};
      const userWatched = new Set<string>();
      for (const item of list.items) {
        const id = String(item.content.id);
        const logs = await getLogsForContent(Number(item.content.id), "movie");
        map[id] = logs.map(l => ({ user: l.user, log: l }));
        if (logs.some(l => l.user.id === user.id)) userWatched.add(id);
      }
      setWatchedMap(map);
      setUserWatchedIds(userWatched);
    };
    fetchWatched();
  }, [watchedStatusEnabled, list, user]);
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;

  // ...existing state declarations continue...
  const [loading, setLoading] = useState(true);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrivacy, setEditPrivacy] = useState<"private" | "public">("private");
  const [selectedCoverImageUrl, setSelectedCoverImageUrl] = useState<string | null>(null);
  const [showAddCollaborator, setShowAddCollaborator] = useState(false);
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<User[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<User[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);
  const [addingCollaborators, setAddingCollaborators] = useState(false);
  // (moved above)
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [showUnwatchedFirst, setShowUnwatchedFirst] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showDeleteItem, setShowDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);

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

        // Fetch list details
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        const usersData = usersSnapshot.val() || {};

        const listData = await getListWithDetails(listId, usersData);
        if (listData) {
          setList(listData);
          setEditName(listData.name);
          setEditDescription(listData.description || "");
          setEditPrivacy(listData.privacy);
          setSelectedCoverImageUrl(listData.cover_image_url || null);
          setViewType(listData.view_type || "grid");
          setShowUnwatchedFirst(listData.show_unwatched_first || false);

          // Check if user is collaborator
          const isCollab = await isUserCollaborator(listId, currentUser.id);
          setIsCollaborator(isCollab || listData.owner_id === currentUser.id);
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

  const handleViewTypeChange = async (newViewType: "grid" | "list") => {
    try {
      setSavingPreferences(true);
      setViewType(newViewType);
      await updateListViewPreferences(listId, newViewType, showUnwatchedFirst);
      if (list) {
        setList({ ...list, view_type: newViewType });
      }
    } catch (error) {
      console.error("Error changing view type:", error);
      setViewType(list?.view_type || "grid");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleUnwatchedFilterChange = async () => {
    try {
      setSavingPreferences(true);
      const newValue = !showUnwatchedFirst;
      setShowUnwatchedFirst(newValue);
      await updateListViewPreferences(listId, viewType, newValue);
      if (list) {
        setList({ ...list, show_unwatched_first: newValue });
      }
    } catch (error) {
      console.error("Error changing unwatched filter:", error);
      setShowUnwatchedFirst(list?.show_unwatched_first || false);
    } finally {
      setSavingPreferences(false);
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

  const handleRemoveItem = async (itemId: string, itemTitle: string) => {
    setShowDeleteItem({ id: itemId, name: itemTitle });
  };

  const confirmDeleteItem = async () => {
    if (!showDeleteItem || !list) return;

    try {
      await removeItemFromList(listId, showDeleteItem.id);
      setList({
        ...list,
        items: list.items.filter((item) => item.id !== showDeleteItem.id),
        item_count: list.item_count - 1,
      });
      setShowDeleteItem(null);
    } catch (error) {
      console.error("Error removing item:", error);
      alert("Failed to remove item");
      setShowDeleteItem(null);
    }
  };

  const handleSaveChanges = async () => {
    if (!list || !user) return;

    try {
      setSavingChanges(true);
      await updateList(listId, {
        name: editName,
        description: editDescription || null,
        privacy: editPrivacy,
        cover_type: selectedCoverImageUrl ? "custom" : "grid",
        cover_image_url: selectedCoverImageUrl,
      });

      setList({
        ...list,
        name: editName,
        description: editDescription || null,
        privacy: editPrivacy,
        cover_type: selectedCoverImageUrl ? "custom" : "grid",
        cover_image_url: selectedCoverImageUrl,
      });

      setEditMode(false);
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes");
    } finally {
      setSavingChanges(false);
    }
  };

  const handleDeleteList = async () => {
    if (!user || !list) return;

    if (!confirm("Are you sure you want to delete this list? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteList(listId, user.id);
      router.push("/lists");
    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Failed to delete list");
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!list) return;

    try {
      await removeCollaborator(collaboratorId, listId);
      setList({
        ...list,
        collaborators: list.collaborators.filter((c) => c.id !== collaboratorId),
        collaborator_count: list.collaborator_count - 1,
      });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      alert("Failed to remove collaborator");
    }
  };

  const handleOpenAddCollaborator = async () => {
    if (!user) return;

    try {
      // Fetch accepted followers/friends
      const followsRef = ref(db, "follows");
      const followsSnapshot = await get(followsRef);
      const allFollows = followsSnapshot.exists() ? followsSnapshot.val() : {};

      // Get friends (both who follow user and user follows)
      const friendIds = new Set<string>();
      Object.values(allFollows).forEach((follow: any) => {
        if (follow.status === "accepted") {
          if (follow.follower_id === user.id) {
            friendIds.add(follow.following_id);
          }
          if (follow.following_id === user.id) {
            friendIds.add(follow.follower_id);
          }
        }
      });

      // Get friend users and exclude already added collaborators
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const allUsers = usersSnapshot.val() || {};

      const existingCollabIds = new Set(list?.collaborators.map((c) => c.user_id) || []);

      const friends: User[] = [];
      friendIds.forEach((friendId) => {
        if (allUsers[friendId] && !existingCollabIds.has(friendId)) {
          const userData = allUsers[friendId];
          friends.push({
            id: userData.id || friendId,
            username: userData.username || "",
            name: userData.name || "",
            avatar_url: userData.avatar_url || null,
            created_at: userData.created_at || new Date().toISOString(),
          });
        }
      });

      setAvailableFriends(friends);
      setFilteredFriends(friends);
      setSelectedFriends([]);
      setCollaboratorInput("");
      setShowAddCollaborator(true);
    } catch (error) {
      console.error("Error loading friends:", error);
      alert("Failed to load friends");
    }
  };

  const handleFilterFriends = (query: string) => {
    setCollaboratorInput(query);
    if (!query.trim()) {
      setFilteredFriends(availableFriends);
    } else {
      const lowerQuery = query.toLowerCase();
      setFilteredFriends(
        availableFriends.filter(
          (friend) =>
            friend.name.toLowerCase().includes(lowerQuery) ||
            friend.username.toLowerCase().includes(lowerQuery)
        )
      );
    }
  };

  const handleSelectFriend = (friend: User) => {
    setSelectedFriends((prev) => {
      if (prev.find((f) => f.id === friend.id)) {
        return prev.filter((f) => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleAddCollaborators = async () => {
    if (!list || selectedFriends.length === 0) return;

    try {
      setAddingCollaborators(true);

      for (const friend of selectedFriends) {
        await addCollaborator(listId, friend.id);
      }

      // Reload list to see new collaborators
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const usersData = usersSnapshot.val() || {};

      const updatedList = await getListWithDetails(listId, usersData);
      if (updatedList) {
        setList(updatedList);
      }

      setShowAddCollaborator(false);
      setSelectedFriends([]);
    } catch (error) {
      console.error("Error adding collaborators:", error);
      alert("Failed to add collaborators");
    } finally {
      setAddingCollaborators(false);
    }
  };

  const handleMarkWatched = async (itemId: string, currentWatchedBy: string[]) => {
    if (!user) return;

    try {
      setMarkingWatched(itemId);

      if (currentWatchedBy.includes(user.id)) {
        // Unmark as watched
        await unmarkItemAsWatched(itemId, user.id);
      } else {
        // Mark as watched
        await markItemAsWatched(itemId, user.id);
      }

      // Reload list
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const usersData = usersSnapshot.val() || {};

      const updatedList = await getListWithDetails(listId, usersData);
      if (updatedList) {
        setList(updatedList);
      }
    } catch (error) {
      console.error("Error updating watched status:", error);
      alert("Failed to update watched status");
    } finally {
      setMarkingWatched(null);
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading list...</p>
        </div>
      </div>
    );
  }

  if (!list || !user) {
    return null;
  }

  const isOwner = list.owner_id === user.id;
  const canEdit = isOwner || isCollaborator;
  const sortedItems = [...list.items].sort((a, b) => a.position - b.position);
  const isRankedList = list.is_ranked;
  const posterOptions = sortedItems
    .map((item) => item.content.poster_url)
    .filter((poster): poster is string => Boolean(poster));
  const displayCoverImageUrl = selectedCoverImageUrl || list.cover_image_url || posterOptions[0] || null;


  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8">
        {/* Header with Back and Title */}
        <div className="mb-8">
          <Link
            href="/lists"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Lists
          </Link>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{list.name}</h1>
              {isRankedList && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Ranked List
                </span>
              )}
              {/* Collaborators: show profile pictures, open modal on click */}
              <button
                className="ml-4 flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-100 bg-blue-50"
                onClick={() => setShowCollaboratorsModal(true)}
                aria-label="Show collaborators"
                style={{ minHeight: 40 }}
              >
                {list.collaborators && list.collaborators.length > 0 && list.collaborators.slice(0, 5).map((collab) => (
                  <span key={collab.user_id} className="inline-block -ml-2 first:ml-0 border-2 border-white rounded-full bg-gray-200" style={{ width: 32, height: 32, overflow: "hidden" }}>
                    {collab.user?.avatar_url ? (
                      <img src={collab.user.avatar_url} alt={collab.user.name || collab.user.username || "User"} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-base font-bold text-gray-700 bg-gray-300 rounded-full">
                        {collab.user?.name?.[0]?.toUpperCase() || collab.user?.username?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </span>
                ))}
                <span className="inline-block ml-2 text-blue-600 font-medium text-sm">
                  {list.collaborators.length > 1 ? `+${list.collaborators.length}` : "1"}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Three-dot menu */}
              <div className="relative">
                <MenuButton
                  onEdit={() => {
                    setOpenItemMenuId(null);
                    setEditMode(true);
                    setSelectedCoverImageUrl(list.cover_image_url || null);
                  }}
                  onAddItems={() => window.location.href = `/lists/${listId}/add-items`}
                  canEdit={isOwner || isCollaborator}
                  isOwner={isOwner}
                  onDelete={isOwner ? handleDeleteList : undefined}
                  onToggleWatchedStatus={() => setWatchedStatusEnabled(v => !v)}
                  watchedStatusEnabled={watchedStatusEnabled}
                />
              </div>
            </div>
          </div>
          {list.description && !editMode && (
            <p className="text-gray-600 mt-2">{list.description}</p>
          )}
          {/* Edit mode UI remains unchanged */}
          {editMode && canEdit && (
            <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Edit list</p>
                <h3 className="text-2xl font-bold text-gray-900">Refine the details</h3>
                <p className="mt-1 text-sm text-gray-500">Update the title, description, privacy, and display cover.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    aria-label="List name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="List name"
                    className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-lg font-semibold text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    aria-label="List description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a short description for this list"
                    className="w-full resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    rows={3}
                  />
                </div>

                {/* Display cover picker */}
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-700">Display cover</p>
                    <p className="text-xs text-gray-500">Pick one poster from this list or keep the auto grid cover.</p>
                  </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCoverImageUrl(null)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedCoverImageUrl === null
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Auto grid
                  </button>
                  {posterOptions.map((posterUrl, idx) => (
                    <button
                      key={`${posterUrl}-${idx}`}
                      type="button"
                      onClick={() => setSelectedCoverImageUrl(posterUrl)}
                      className={`h-16 w-12 overflow-hidden rounded-md border-2 transition-all ${
                        selectedCoverImageUrl === posterUrl
                          ? "border-blue-600 ring-2 ring-blue-200"
                          : "border-transparent hover:border-gray-300"
                      }`}
                      aria-label={`Select poster ${idx + 1} as cover`}
                    >
                      <img src={posterUrl} alt={`Poster ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                {selectedCoverImageUrl && (
                  <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <img
                      src={selectedCoverImageUrl}
                      alt="Selected cover"
                      className="h-20 w-14 rounded-md object-cover shadow-sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">Selected cover</p>
                      <p className="text-xs text-gray-500">This poster will be used as the list cover image.</p>
                    </div>
                  </div>
                )}
                </div>
                {/* Privacy Toggle */}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    editPrivacy === "private"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}>
                    <input
                      type="radio"
                      name="privacy"
                      value="private"
                      checked={editPrivacy === "private"}
                      onChange={() => setEditPrivacy("private")}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-600" />
                        <span className="font-semibold text-gray-900">Private</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Only you and collaborators can see it.</p>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    editPrivacy === "public"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}>
                    <input
                      type="radio"
                      name="privacy"
                      value="public"
                      checked={editPrivacy === "public"}
                      onChange={() => setEditPrivacy("public")}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-600" />
                        <span className="font-semibold text-gray-900">Public</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Anyone can discover this list.</p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={savingChanges}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {savingChanges ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditName(list.name);
                      setEditDescription(list.description || "");
                      setEditPrivacy(list.privacy);
                      setSelectedCoverImageUrl(list.cover_image_url || null);
                    }}
                    className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Movie Items Section */}
        <div className="mt-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {isRankedList ? "Ranked Items" : "Items"} ({list.item_count})
            </h2>
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
              <button
                onClick={() => handleViewTypeChange("grid")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  viewType === "grid" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Grid3x3 className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => handleViewTypeChange("list")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  viewType === "list" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <ListIcon className="h-4 w-4" />
                List
              </button>
            </div>
          </div>
          {sortedItems.length > 0 ? (
            <div
              className={
                viewType === "list"
                  ? "space-y-4"
                  : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
              }
            >
              {sortedItems.map((item, idx) => {
                const rank = item.position + 1;
                const watchedArr = watchedMap[String(item.content.id)] || [];
                const userWatched = watchedArr.find(w => w.user.id === user.id);
                const collabWatched = watchedArr.find(w => w.user.id !== user.id);
                // Get logs for this movie, most recent first
                const logs = logsMap[item.content.id] || [];
                const posterSrc = logs[0]?.content?.poster_url || item.content.poster_url || null;
                let watchedDateDisplay: string | null = null;
                if (logs[0]?.watched_date) {
                  try {
                    watchedDateDisplay = format(new Date(logs[0].watched_date), "d MMM yyyy");
                  } catch {
                    watchedDateDisplay = logs[0].watched_date;
                  }
                }
                return (
                  <div
                    key={item.id}
                    className={
                      viewType === "list"
                        ? `relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${editMode && isOwner ? "cursor-move" : ""}`
                        : `relative flex flex-col rounded-2xl bg-white p-3 shadow-sm ${editMode && isOwner ? "cursor-move" : ""}`
                    }
                    draggable={editMode && isOwner}
                    onDragStart={editMode && isOwner ? e => {
                      console.log('[DnD] Drag Start', { fromIdx: idx, item: list.items[idx] });
                      e.dataTransfer.setData("text/plain", idx.toString());
                      e.currentTarget.classList.add("opacity-50");
                    } : undefined}
                    onDragEnd={editMode && isOwner ? e => {
                      console.log('[DnD] Drag End');
                      e.currentTarget.classList.remove("opacity-50");
                    } : undefined}
                    onDragOver={editMode && isOwner ? e => {
                      e.preventDefault();
                      // Optional: highlight drop target
                    } : undefined}
                    onDrop={editMode && isOwner ? async e => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                      console.log('[DnD] Drop', { fromIdx, toIdx: idx });
                      if (fromIdx === idx) return;
                      const newItems = [...list.items];
                      const [moved] = newItems.splice(fromIdx, 1);
                      newItems.splice(idx, 0, moved);
                      console.log('[DnD] New order', newItems.map(i => i.id));
                      setList({ ...list, items: newItems });
                      try {
                        await reorderListItems(listId, newItems.map((i, pos) => ({ id: i.id, position: pos })));
                        console.log('[DnD] reorderListItems success');
                      } catch (err) {
                        console.error('[DnD] reorderListItems error', err);
                      }
                    } : undefined}
                    >
                    <button
                      type="button"
                      aria-label="Item actions"
                      draggable={false}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="absolute right-2 top-2 z-40 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-gray-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenItemMenuId((current) => (current === item.id ? null : item.id));
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openItemMenuId === item.id && (
                      <div className="absolute right-2 top-10 z-50 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setWatchedStatusEnabled((v) => !v);
                            setOpenItemMenuId(null);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          Show watched status
                        </button>
                        {editMode && isOwner && (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveItem(item.id, item.content.title);
                              setOpenItemMenuId(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove item
                          </button>
                        )}
                      </div>
                    )}
                    {/* Poster */}
                    <Link
                      href={item.content.type === "tv"
                        ? `/tv/${item.content.id}`
                        : `/movie/${item.content.id}`}
                      className={
                        viewType === "list"
                          ? "relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 poster-stack-container"
                          : "relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-xl bg-gray-200 poster-stack-container"
                      }
                      tabIndex={0}
                    >
                      {posterSrc ? (
                        <img
                          src={posterSrc}
                          alt={item.content.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                          <Plus className="h-8 w-8 text-white/70" />
                        </div>
                      )}
                      {isRankedList && (
                        <span className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-1 text-[11px] font-bold text-white shadow">
                          {rank}
                        </span>
                      )}
                    </Link>
                    <div className={viewType === "list" ? "min-w-0 flex-1" : ""}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">{item.content.title}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Added by <span className="font-medium">{item.added_by_user.name}</span>
                      </p>
                      {watchedStatusEnabled && (
                        <div className="mt-1 flex items-center gap-2">
                          {userWatched && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Watched</span>
                          )}
                          {!userWatched && collabWatched && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Watched by {collabWatched.user.name}</span>
                          )}
                          {!userWatched && !collabWatched && (
                            <button
                              className="ml-1 text-xs px-2 py-0.5 rounded-full border border-green-400 text-green-700 hover:bg-green-50"
                              disabled={markingWatched === String(item.content.id)}
                              onClick={async () => {
                                setMarkingWatched(String(item.content.id));
                                await createMovieLog(user.id, item.content.id, "movie", new Date().toISOString(), 1, "");
                                setMarkingWatched(null);
                                setWatchedStatusEnabled(false); setTimeout(() => setWatchedStatusEnabled(true), 100); // Refresh
                              }}
                            >
                              {markingWatched === String(item.content.id) ? "Marking..." : "Mark as Watched"}
                            </button>
                          )}
                        </div>
                      )}
                      {watchedStatusEnabled && watchedDateDisplay && (
                        <p className="mt-1 text-xs text-gray-500">Watched on {watchedDateDisplay}</p>
                      )}
                    </div>
                    {editMode && isOwner && (
                      <button
                        aria-label="Delete movie"
                        className="absolute top-1 right-1 p-1 rounded-full bg-white bg-opacity-80 hover:bg-red-100 text-red-600 shadow z-20"
                        onClick={() => handleRemoveItem(item.id, item.content.title)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-4">This list is empty</p>
              {(isOwner || isCollaborator) && (
                <button
                  className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow"
                  onClick={() => window.location.href = `/lists/${listId}/add-items`}
                >
                  <Plus className="inline w-4 h-4 mr-2 -mt-1" /> Add Movies
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collaborators Modal, Add Collaborator Modal, Delete List Button, Delete Item Modal, etc. remain unchanged below... */}



        {/* Collaborators Modal */}
        {showCollaboratorsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Collaborators</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {(Array.isArray(list.collaborators) ? list.collaborators : []).map((collaborator, idx) => (
                  <div key={`collab-${idx}`} className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                    {collaborator.user.avatar_url && (
                      <img
                        src={collaborator.user.avatar_url}
                        alt={collaborator.user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {collaborator.user.name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{collaborator.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleOpenAddCollaborator}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors mb-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Collaborator
              </button>
              <button
                onClick={() => setShowCollaboratorsModal(false)}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Add Collaborator Modal (existing) */}
        {showAddCollaborator && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add Friends as Collaborators</h3>

              {availableFriends.length > 0 ? (
                <>
                  {/* Search input */}
                  <input
                    type="text"
                    value={collaboratorInput}
                    onChange={(e) => handleFilterFriends(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  />

                  {/* Friends list */}
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {filteredFriends.length > 0 ? (
                      filteredFriends.map((friend) => (
                        <label
                          key={friend.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.some((f) => f.id === friend.id)}
                            onChange={() => handleSelectFriend(friend)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {friend.name}
                            </p>
                            <p className="text-xs text-gray-500">@{friend.username}</p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 py-2">No matching friends found</p>
                    )}
                  </div>

                  {/* Selected count */}
                  {selectedFriends.length > 0 && (
                    <p className="text-sm text-gray-600 mb-4">
                      {selectedFriends.length} friend{selectedFriends.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  You don't have any friends to add. Make some friends first!
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddCollaborator(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCollaborators}
                  disabled={selectedFriends.length === 0 || addingCollaborators}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {addingCollaborators ? "Adding..." : `Add (${selectedFriends.length})`}
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Delete Item Confirmation Modal (existing) */}
        {showDeleteItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Remove from list?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove <span className="font-semibold">{showDeleteItem.name}</span> from this list?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteItem(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteItem}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
