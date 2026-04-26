"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import {
  ArrowLeft,
  Lock,
  Globe,
  Plus,
  Trash2,
  UserPlus,
  Loader2,
  Edit2,
  Grid3x3,
  List as ListIcon,
  Eye,
  MoreVertical,
  GripVertical,
  MoveRight,
  Copy,
  ChevronUp,
  ChevronDown,
  UserX,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { User, ListWithItems, ListCollaboratorWithUser } from "@/types";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import {
  getListWithDetails,
  removeItemFromList,
  addCollaborator,
  removeCollaborator,
  updateList,
  deleteList,
  isUserCollaborator,
  updateListViewPreferences,
  reorderListItems,
  createList,
  addItemToList,
} from "@/lib/lists";
import { getLogsForContent } from "@/lib/logs";
import { getUserWatchedMovies, upsertWatchedMovie, type WatchedMovie } from "@/lib/watched-movies";
import { canInviteCollaborators, isUsernameBlocked, mergeSettings } from "@/lib/settings";

function MenuButton({ onEdit, onAddItems, canEdit, isOwner, onDelete, onClone, cloneLoading, onToggleWatchedStatus, watchedStatusEnabled, viewType, onSetViewType, onToggleReorder, reorderMode }: {
  onEdit: () => void;
  onAddItems: () => void;
  canEdit: boolean;
  isOwner: boolean;
  onDelete?: () => void;
  onClone: () => void;
  cloneLoading?: boolean;
  onToggleWatchedStatus?: () => void;
  watchedStatusEnabled?: boolean;
  viewType: "grid" | "list";
  onSetViewType: (viewType: "grid" | "list") => void;
  onToggleReorder?: () => void;
  reorderMode?: boolean;
  }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-50">
      <button
        type="button"
        aria-label="Open menu"
        className="relative z-50 flex items-center justify-center p-1 text-[#ff7a1a] transition hover:text-[#ffb36b]"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-6 w-6" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden border border-white/10 bg-[#111111] shadow-xl">
          <div className="p-2">
            <div className="px-3 pb-2 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Layout</p>
            </div>
            <button
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
              onClick={() => { setOpen(false); onSetViewType("grid"); }}
            >
              <Grid3x3 className={`mt-0.5 h-4 w-4 ${viewType === "grid" ? "text-[#ff7a1a]" : "text-white/60"}`} />
              <div>
                <p className="text-sm font-semibold text-[#f5f0de]">Grid</p>
                <p className="text-xs text-white/55">Posters in a tight grid</p>
              </div>
            </button>
            <button
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
              onClick={() => { setOpen(false); onSetViewType("list"); }}
            >
              <ListIcon className={`mt-0.5 h-4 w-4 ${viewType === "list" ? "text-[#ff7a1a]" : "text-white/60"}`} />
              <div>
                <p className="text-sm font-semibold text-[#f5f0de]">List</p>
                <p className="text-xs text-white/55">One row per item</p>
              </div>
            </button>
            <button
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
              onClick={() => { setOpen(false); onClone(); }}
            >
              <Copy className="mt-0.5 h-4 w-4 text-[#ff7a1a]" />
              <div>
                <p className="text-sm font-semibold text-[#f5f0de]">{cloneLoading ? "Cloning..." : "Clone list"}</p>
                <p className="text-xs text-white/55">Save a private copy to Your lists</p>
              </div>
            </button>
            <button
              className={`mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5 ${
                watchedStatusEnabled ? "text-[#ffb36b]" : ""
              }`}
              onClick={() => { setOpen(false); onToggleWatchedStatus && onToggleWatchedStatus(); }}
            >
              <Eye className={`mt-0.5 h-4 w-4 ${watchedStatusEnabled ? "text-[#ff7a1a]" : "text-white/60"}`} />
              <div>
                <p className="text-sm font-medium text-[#f5f0de]">Watched status</p>
                <p className="text-xs text-white/55">See who watched what</p>
              </div>
            </button>

            {canEdit && viewType === "list" && onToggleReorder && (
              <button
                className={`mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5 ${
                  reorderMode ? "text-[#ffb36b]" : ""
                }`}
                onClick={() => { setOpen(false); onToggleReorder(); }}
              >
                <GripVertical className={`mt-0.5 h-4 w-4 ${reorderMode ? "text-[#ff7a1a]" : "text-white/60"}`} />
                <div>
                  <p className="text-sm font-semibold text-[#f5f0de]">Reorder items</p>
                  <p className="text-xs text-white/55">Drag rows to change order</p>
                </div>
              </button>
            )}

            {canEdit && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <button
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
                  onClick={() => { setOpen(false); onEdit(); }}
                >
                  <Edit2 className="mt-0.5 h-4 w-4 text-[#ff7a1a]" />
                  <div>
                    <p className="text-sm font-semibold text-[#f5f0de]">Edit details</p>
                    <p className="text-xs text-white/55">Title, privacy, description</p>
                  </div>
                </button>
                <button
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
                  onClick={() => { setOpen(false); onAddItems(); }}
                >
                  <Plus className="mt-0.5 h-4 w-4 text-white/60" />
                  <div>
                    <p className="text-sm font-medium text-[#f5f0de]">Add movies</p>
                    <p className="text-xs text-white/55">Add items to the list</p>
                  </div>
                </button>
                {isOwner && onDelete && (
                  <button
                    className="mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-[#ff7a1a] hover:bg-white/5"
                    onClick={() => { setOpen(false); onDelete(); }}
                  >
                    <Trash2 className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Delete list</p>
                      <p className="text-xs text-white/55">Permanently remove this list</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ListDetailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserSettings, setCurrentUserSettings] = useState(() => mergeSettings(null));
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

  useEffect(() => {
    if (!user || !list) return;

    let cancelled = false;
    (async () => {
      try {
        const records = await getUserWatchedMovies(user.id);
        if (cancelled) return;

        const map: Record<string, WatchedMovie> = {};
        for (const record of records) {
          map[`${record.content_type}-${record.content_id}`] = record;
        }
        setWatchedMovies(map);
      } catch (error) {
        console.error("Error loading watched movies:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, list]);

  // Watched status state (must be after user/list)
  const [watchedStatusEnabled, setWatchedStatusEnabled] = useState(false);
  const [markingWatched, setMarkingWatched] = useState<string | null>(null);
  const [watchedMovies, setWatchedMovies] = useState<Record<string, WatchedMovie>>({});
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
  const [viewType, setViewType] = useState<"grid" | "list">("list");
  const [reorderMode, setReorderMode] = useState(false);
  const [showUnwatchedFirst, setShowUnwatchedFirst] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [cloningList, setCloningList] = useState(false);
  const [showDeleteItem, setShowDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);

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
        setCurrentUserSettings(mergeSettings(userData?.settings));

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
          setViewType("list");
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
      if (newViewType !== "list") {
        setReorderMode(false);
      }
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

  const handleReorderItems = async (fromIdx: number, toIdx: number) => {
    if (!list || fromIdx === toIdx) return;

    const previousItems = list.items;
    const nextItems = [...list.items];
    const [moved] = nextItems.splice(fromIdx, 1);
    nextItems.splice(toIdx, 0, moved);

    const normalizedItems = nextItems.map((item, position) => ({ ...item, position }));
    setList({ ...list, items: normalizedItems });

    try {
      await reorderListItems(
        listId,
        normalizedItems.map((item) => ({ id: item.id, position: item.position }))
      );
    } catch (error) {
      console.error("Error reordering items:", error);
      setList({ ...list, items: previousItems });
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

  const handleCloneList = async () => {
    if (!user || !list) return;

    try {
      setCloningList(true);
      const clonedName = `Copy of ${list.name}`;
      const clonedList = await createList(
        user.id,
        clonedName,
        list.description || null,
        "private",
        list.is_ranked
      );

      await updateList(clonedList.id, {
        view_type: list.view_type,
        show_unwatched_first: list.show_unwatched_first || false,
        cover_type: list.cover_type,
        cover_image_url: list.cover_image_url,
        privacy: "private",
      });

      const itemsInOrder = [...list.items].sort((a, b) => a.position - b.position);
      for (const item of itemsInOrder) {
        await addItemToList(clonedList.id, item.content_id, item.content_type, user.id);
      }

      router.push(`/lists/${clonedList.id}`);
    } catch (error) {
      console.error("Error cloning list:", error);
      alert("Failed to clone list");
    } finally {
      setCloningList(false);
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
    if (!canInviteCollaborators(currentUserSettings)) {
      alert("Your collaboration invites are turned off in settings.");
      return;
    }

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
          const friendSettings = mergeSettings(userData?.settings);
          if (
            friendSettings.account.status !== "active" ||
            !friendSettings.social.allowCollaborations ||
            isUsernameBlocked(friendSettings, user.username) ||
            isUsernameBlocked(currentUserSettings, userData.username || "")
          ) {
            return;
          }

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

  if (loading) {
    return <CinematicLoading message="Your list is loading" />;
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
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <div className="px-2 py-4 sm:p-8">
        {/* Header with Back and Title */}
        <div className="mb-5 sm:mb-8">
          <Link
            href="/lists"
            className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#ffb36b] hover:text-[#ff7a1a] sm:mb-4 sm:text-base"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            Back to Lists
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-[#f5f0de] sm:text-3xl sm:font-bold">
                {list.name}
              </h1>
              {list.description && !editMode && (
                <p className="mt-2 text-sm leading-relaxed text-white/55 sm:mt-2 sm:text-base">{list.description}</p>
              )}
            </div>

            <MenuButton
              onEdit={() => {
                setEditMode(true);
                setSelectedCoverImageUrl(list.cover_image_url || null);
              }}
              onAddItems={() => window.location.href = `/lists/${listId}/add-items`}
              canEdit={isOwner || isCollaborator}
              isOwner={isOwner}
              onDelete={isOwner ? handleDeleteList : undefined}
              onClone={handleCloneList}
              cloneLoading={cloningList}
              onToggleWatchedStatus={() => setWatchedStatusEnabled(v => !v)}
              watchedStatusEnabled={watchedStatusEnabled}
              viewType={viewType}
              onSetViewType={(nextViewType) => void handleViewTypeChange(nextViewType)}
              onToggleReorder={canEdit && viewType === "list" ? () => setReorderMode((v) => !v) : undefined}
              reorderMode={reorderMode}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
              {isRankedList && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#f5f0de]">
                  Ranked List
                </span>
              )}
              {/* Collaborators: show profile pictures, open modal on click */}
              <button
                className="flex items-center gap-1 border border-white/10 bg-white/5 px-3 py-1.5 text-[#f5f0de]"
                onClick={() => setShowCollaboratorsModal(true)}
                aria-label="Show collaborators"
              >
                {list.collaborators && list.collaborators.length > 0 && list.collaborators.slice(0, 5).map((collab) => (
                <span key={collab.user_id} className="inline-block -ml-2 h-7 w-7 overflow-hidden rounded-full border-2 border-[#111111] bg-[#1a1a1a] first:ml-0 sm:h-8 sm:w-8">
                    {collab.user?.avatar_url ? (
                      <img src={collab.user.avatar_url} alt={collab.user.name || collab.user.username || "User"} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2a2a2a] text-base font-bold text-[#f5f0de]">
                        {collab.user?.name?.[0]?.toUpperCase() || collab.user?.username?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </span>
                ))}
                <span className="ml-1 inline-block text-xs font-bold text-[#ffb36b] sm:text-sm">
                  {list.collaborators.length > 1 ? `+${list.collaborators.length}` : "1"}
                </span>
              </button>
          </div>

          {/* Edit mode UI remains unchanged */}
          {editMode && canEdit && (
            <div className="mt-5 border border-white/10 bg-[#111111] p-4 sm:mt-6 sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#ffb36b] sm:text-sm">Edit list</p>
                <h3 className="text-xl font-bold text-[#f5f0de] sm:text-2xl">Refine the details</h3>
                <p className="mt-1 text-xs text-white/55 sm:text-sm">Update the title, description, privacy, and display cover.</p>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-white/65 sm:text-sm">Title</label>
                  <input
                    aria-label="List name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="List name"
                    className="field w-full px-4 py-2.5 text-base font-semibold sm:py-3 sm:text-lg"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-white/65 sm:text-sm">Description</label>
                  <textarea
                    aria-label="List description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a short description for this list"
                    className="field w-full resize-none px-4 py-2.5 text-xs sm:py-3 sm:text-sm"
                    rows={3}
                  />
                </div>

                {/* Display cover picker */}
                <div className="space-y-3 border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <div>
                    <p className="text-sm font-medium text-[#f5f0de]">Display cover</p>
                    <p className="text-[11px] text-white/55 sm:text-xs">Pick one poster from this list or keep the auto grid cover.</p>
                  </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCoverImageUrl(null)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedCoverImageUrl === null
                        ? "bg-[#ff7a1a] text-[#0a0a0a]"
                        : "border border-white/10 bg-[#0d0d0d] text-[#f5f0de] hover:bg-white/5"
                    }`}
                  >
                    Auto grid
                  </button>
                  {posterOptions.map((posterUrl, idx) => (
                    <button
                      key={`${posterUrl}-${idx}`}
                      type="button"
                      onClick={() => setSelectedCoverImageUrl(posterUrl)}
                      className={`h-14 w-10 overflow-hidden rounded-md border-2 transition-all sm:h-16 sm:w-12 ${
                        selectedCoverImageUrl === posterUrl
                          ? "border-[#ff7a1a] ring-2 ring-[#ff7a1a]/20"
                          : "border-transparent hover:border-white/20"
                      }`}
                      aria-label={`Select poster ${idx + 1} as cover`}
                    >
                      <img src={posterUrl} alt={`Poster ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                {selectedCoverImageUrl && (
                  <div className="flex items-center gap-3 border border-white/10 bg-[#0d0d0d] p-3">
                    <img
                      src={selectedCoverImageUrl}
                      alt="Selected cover"
                      className="h-16 w-11 rounded-md object-cover shadow-sm sm:h-20 sm:w-14"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#f5f0de]">Selected cover</p>
                      <p className="text-[11px] text-white/55 sm:text-xs">This poster will be used as the list cover image.</p>
                    </div>
                  </div>
                )}
                </div>
                {/* Privacy Toggle */}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    editPrivacy === "private"
                      ? "border-[#ff7a1a] bg-white/[0.04]"
                      : "border-white/10 bg-[#0d0d0d] hover:border-white/20"
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
                        <Lock className="h-4 w-4 text-white/65" />
                        <span className="font-semibold text-[#f5f0de]">Private</span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/55 sm:text-xs">Only you and collaborators can see it.</p>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    editPrivacy === "public"
                      ? "border-[#ff7a1a] bg-white/[0.04]"
                      : "border-white/10 bg-[#0d0d0d] hover:border-white/20"
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
                        <Globe className="h-4 w-4 text-white/65" />
                        <span className="font-semibold text-[#f5f0de]">Public</span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/55 sm:text-xs">Anyone can discover this list.</p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleSaveChanges}
                disabled={savingChanges}
                className="rounded-xl bg-[#ff7a1a] px-5 py-3 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:bg-white/10 disabled:text-white/35"
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
                    className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Movie Items Section */}
        <div className="mt-4 sm:mt-6">
          {reorderMode && viewType === "list" && canEdit && (
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
              <MoveRight className="h-3.5 w-3.5" />
              Use arrows or drag to reorder
            </div>
          )}
          {sortedItems.length > 0 ? (
            <div
              className={
                viewType === "list"
                  ? "space-y-2.5 sm:space-y-3"
                  : "grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5"
              }
            >
              {sortedItems.map((item, idx) => {
                const rank = item.position + 1;
                // Get logs for this movie, most recent first
                const logs = logsMap[item.content.id] || [];
                const posterSrc = logs[0]?.content?.poster_url || item.content.poster_url || null;
                const watchedKey = `${item.content.type || "movie"}-${item.content.id}`;
                const watchedRecord = watchedMovies[watchedKey] || null;
                const userWatched = Boolean(watchedRecord);
                const canReorder = reorderMode && canEdit && viewType === "list";
                const isFirst = idx === 0;
                const isLast = idx === sortedItems.length - 1;
                return (
                  <div
                    key={item.id}
                    className={
                      viewType === "list"
                        ? `group relative flex items-start gap-3 py-1 ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`
                        : `relative flex flex-col ${editMode && isOwner ? "cursor-move" : ""}`
                    }
                      draggable={canReorder}
                    onDragStart={canReorder ? e => {
                      e.dataTransfer.setData("text/plain", idx.toString());
                      e.currentTarget.classList.add("opacity-50");
                    } : undefined}
                    onDragEnd={canReorder ? e => {
                      e.currentTarget.classList.remove("opacity-50");
                    } : undefined}
                    onDragOver={canReorder ? e => {
                      e.preventDefault();
                    } : undefined}
                    onDrop={canReorder ? async e => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                      if (fromIdx === idx) return;
                      await handleReorderItems(fromIdx, idx);
                    } : undefined}
                      >
                    {canReorder && (
                      <div className="mt-0.5 flex w-6 shrink-0 flex-col items-center gap-1 text-white/40">
                        <GripVertical className="h-3.5 w-3.5" />
                        <button
                          type="button"
                          aria-label={`Move ${item.content.title} up`}
                          disabled={isFirst}
                          onClick={() => void handleReorderItems(idx, idx - 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-white/55 transition hover:border-[#ff7a1a] hover:text-[#ffb36b] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${item.content.title} down`}
                          disabled={isLast}
                          onClick={() => void handleReorderItems(idx, idx + 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-white/55 transition hover:border-[#ff7a1a] hover:text-[#ffb36b] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* Poster */}
                    <Link
                      href={item.content.type === "tv"
                        ? `/tv/${item.content.id}`
                        : `/movie/${item.content.id}`}
                      className={
                        viewType === "list"
                          ? `relative h-20 w-14 flex-shrink-0 overflow-hidden bg-[#1a1a1a] poster-stack-container sm:h-24 sm:w-16 ${
                              canReorder ? "pointer-events-none" : ""
                            }`
                          : "relative aspect-[3/4] w-full overflow-hidden bg-[#1a1a1a] poster-stack-container sm:aspect-[2/3]"
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
                        <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a]">
                          <Plus className="h-8 w-8 text-white/35" />
                        </div>
                      )}
                      {isRankedList && (
                        <span className="absolute left-2 top-2 rounded-full bg-[#ff7a1a] px-2 py-1 text-[11px] font-bold text-[#0a0a0a] shadow">
                          {rank}
                        </span>
                      )}
                      </Link>
                      <div className={viewType === "list" ? "min-w-0 flex-1 pt-0.5" : "min-w-0 pt-1"}>
                        {canReorder && (
                          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                            <GripVertical className="h-3.5 w-3.5" />
                            Tap arrows or drag
                          </div>
                        )}
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-[#f5f0de] sm:text-sm">
                          {item.content.title}
                        </p>
                        {viewType === "list" && (
                          <p className="mt-0.5 truncate text-[10px] font-medium text-white/55 sm:text-xs">
                            Added by <span className="font-medium">{item.added_by_user.name}</span>
                          </p>
                        )}
                        {watchedStatusEnabled && (
                          <div className="mt-1">
                            {userWatched ? (
                              <span className="inline-flex rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-200">
                                Watched
                              </span>
                            ) : (
                              <button
                                className="text-[10px] font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
                                disabled={markingWatched === String(item.content.id)}
                                onClick={async () => {
                                  setMarkingWatched(String(item.content.id));
                                  await upsertWatchedMovie(
                                    user.id,
                                    Number(item.content.id),
                                    item.content.type === "tv" ? "tv" : "movie",
                                    "list"
                                  );
                                  const refreshed = await getUserWatchedMovies(user.id);
                                  const refreshedMap: Record<string, WatchedMovie> = {};
                                  for (const record of refreshed) {
                                    refreshedMap[`${record.content_type}-${record.content_id}`] = record;
                                  }
                                  setWatchedMovies(refreshedMap);
                                  setMarkingWatched(null);
                                }}
                              >
                                {markingWatched === String(item.content.id) ? "Marking..." : "Mark watched"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    {editMode && isOwner && (
                      <button
                        aria-label="Delete movie"
                        className="absolute right-0 top-0 rounded-full bg-white/90 p-1 text-red-600 shadow-sm ring-1 ring-gray-100"
                        onClick={() => handleRemoveItem(item.id, item.content.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
        ) : (
            <div className="py-12 text-center">
              <p className="mb-4 text-white/55">This list is empty</p>
              {(isOwner || isCollaborator) && (
                <button
                  className="mt-4 rounded-lg bg-[#ff7a1a] px-6 py-2 font-medium text-[#0a0a0a] shadow hover:bg-[#ff8d3b]"
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
            <div className="flex max-h-96 w-full max-w-md flex-col border border-white/10 bg-[#111111] p-6 text-[#f5f0de] mx-4">
              <h3 className="mb-4 text-xl font-bold text-[#f5f0de]">Collaborators</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {(Array.isArray(list.collaborators) ? list.collaborators : []).map((collaborator, idx) => (
                  <div key={`collab-${idx}`} className="flex items-center gap-2 border border-white/10 bg-white/[0.03] p-3">
                    {collaborator.user.avatar_url && (
                      <img
                        src={collaborator.user.avatar_url}
                        alt={collaborator.user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-[#f5f0de]">
                        {collaborator.user.name}
                      </p>
                      <p className="capitalize text-xs text-white/55">{collaborator.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleOpenAddCollaborator}
                className="mb-2 flex items-center gap-2 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
              >
                <UserPlus className="w-4 h-4" />
                Add Collaborator
              </button>
              <button
                onClick={() => setShowCollaboratorsModal(false)}
                className="w-full rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Add Collaborator Modal (existing) */}
        {showAddCollaborator && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="mx-4 flex max-h-96 w-full max-w-md flex-col border border-white/10 bg-[#111111] p-6 text-[#f5f0de]">
              <h3 className="mb-4 text-xl font-bold text-[#f5f0de]">Add Friends as Collaborators</h3>

              {availableFriends.length > 0 ? (
                <>
                  {/* Search input */}
                  <input
                    type="text"
                    value={collaboratorInput}
                    onChange={(e) => handleFilterFriends(e.target.value)}
                    placeholder="Search friends..."
                    className="field mb-4 w-full px-4 py-2"
                  />

                  {/* Friends list */}
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {filteredFriends.length > 0 ? (
                      filteredFriends.map((friend) => (
                        <label
                          key={friend.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.some((f) => f.id === friend.id)}
                            onChange={() => handleSelectFriend(friend)}
                            className="h-4 w-4 rounded border-white/20 text-[#ff7a1a] focus:ring-[#ff7a1a]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-[#f5f0de]">
                              {friend.name}
                            </p>
                            <p className="text-xs text-white/55">@{friend.username}</p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="py-2 text-sm text-white/55">No matching friends found</p>
                    )}
                  </div>

                  {/* Selected count */}
                  {selectedFriends.length > 0 && (
                    <p className="mb-4 text-sm text-white/55">
                      {selectedFriends.length} friend{selectedFriends.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </>
              ) : (
                <p className="mb-4 text-sm text-white/55">
                  You don't have any friends to add. Make some friends first!
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddCollaborator(false)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCollaborators}
                  disabled={selectedFriends.length === 0 || addingCollaborators}
                  className="flex-1 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b] disabled:bg-white/10 disabled:text-white/35"
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
            <div className="mx-4 w-full max-w-sm border border-white/10 bg-[#111111] p-6 text-[#f5f0de]">
              <h3 className="mb-2 text-lg font-bold text-[#f5f0de]">Remove from list?</h3>
              <p className="mb-6 text-white/55">
                Are you sure you want to remove <span className="font-semibold">{showDeleteItem.name}</span> from this list?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteItem(null)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteItem}
                  className="flex-1 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
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
