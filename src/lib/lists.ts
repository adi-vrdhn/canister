import { db } from "@/lib/firebase";
import { ref, set, get, push, remove, onValue } from "firebase/database";
import { List, ListItem, ListCollaborator, ListWithItems, ListItemWithContent, ListCollaboratorWithUser, User, Content } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { getUsersByIds } from "./users";

/**
 * Create a new list
 */
export async function createList(
  ownerId: string,
  name: string,
  description: string | null = null,
  privacy: "private" | "public" = "private",
  isRanked: boolean = false
): Promise<List> {
  const listRef = push(ref(db, "lists"));
  const listId = listRef.key;

  if (!listId) throw new Error("Failed to generate list ID");

  const newList: List = {
    id: listId,
    name,
    description,
    owner_id: ownerId,
    privacy,
    is_ranked: isRanked,
    view_type: "grid",
    show_unwatched_first: false,
    cover_type: "grid",
    cover_image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await set(listRef, newList);

  // Add owner as collaborator
  const collaboratorRef = push(ref(db, "list_collaborators"));
  await set(collaboratorRef, {
    list_id: listId,
    user_id: ownerId,
    role: "owner",
    joined_at: new Date().toISOString(),
  });

  return newList;
}

/**
 * Get user's own lists (owned) + collaborative lists
 */
export async function getUserLists(userId: string): Promise<List[]> {
  try {
    // Get all lists
    const listsRef = ref(db, "lists");
    const listsSnapshot = await get(listsRef);

    if (!listsSnapshot.exists()) return [];

    const allLists = listsSnapshot.val();

    // Get lists where user is owner
    const ownedLists = Object.values(allLists).filter(
      (list: any) => list.owner_id === userId
    ) as List[];

    // Get lists where user is a collaborator
    const collaboratorsRef = ref(db, "list_collaborators");
    const collaboratorsSnapshot = await get(collaboratorsRef);
    
    const collaborativeLists: List[] = [];
    if (collaboratorsSnapshot.exists()) {
      const allCollaborators = collaboratorsSnapshot.val();
      Object.values(allCollaborators).forEach((collab: any) => {
        if (collab.user_id === userId && allLists[collab.list_id]) {
          const list = allLists[collab.list_id] as List;
          // Only add if not already in ownedLists
          if (!ownedLists.find(l => l.id === list.id)) {
            collaborativeLists.push(list);
          }
        }
      });
    }

    // Combine and sort
    const userLists = [...ownedLists, ...collaborativeLists];
    return userLists.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch (error) {
    console.error("Error fetching user lists:", error);
    return [];
  }
}

/**
 * Get public lists (for discovery)
 */
export async function getPublicLists(limit: number = 20): Promise<List[]> {
  try {
    const snapshot = await get(ref(db, "lists"));

    if (!snapshot.exists()) return [];

    const allLists = snapshot.val();
    const publicLists = Object.values(allLists)
      .filter((list: any) => list.privacy === "public")
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit) as List[];

    return publicLists;
  } catch (error) {
    console.error("Error fetching public lists:", error);
    return [];
  }
}

/**
 * Get list details with items and collaborators
 */
export async function getListWithDetails(listId: string, allUsers?: Record<string, User>): Promise<ListWithItems | null> {
  try {
    const listRef = ref(db, `lists/${listId}`);
    const listSnapshot = await get(listRef);

    if (!listSnapshot.exists()) return null;

    const list = listSnapshot.val() as List;

    // Fetch items
    const itemsRef = ref(db, "list_items");
    const itemsSnapshot = await get(itemsRef);
    const allItems = itemsSnapshot.exists() ? itemsSnapshot.val() : {};
    const listItems = Object.values(allItems)
      .filter((item: any) => item.list_id === listId)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0)) as ListItem[];

    // Fetch collaborators
    const collaboratorsRef = ref(db, "list_collaborators");
    const collaboratorsSnapshot = await get(collaboratorsRef);
    const allCollaborators = collaboratorsSnapshot.exists() ? collaboratorsSnapshot.val() : {};
    const listCollaborators = Object.values(allCollaborators).filter(
      (collab: any) => collab.list_id === listId
    ) as ListCollaborator[];

    const requiredUserIds = Array.from(
      new Set([
        ...listItems.map((item) => item.added_by_user_id),
        ...listCollaborators.map((collab) => collab.user_id),
      ])
    );
    const usersData =
      allUsers && Object.keys(allUsers).length > 0 ? allUsers : await getUsersByIds(requiredUserIds);

    // Enrich items with content and user info
    const enrichedItems: ListItemWithContent[] = await Promise.all(
      listItems.map(async (item) => {
        let content: Content;
        if (item.content_type === "tv") {
          const show = await getShowDetails(item.content_id);
          content = show as unknown as Content;
        } else {
          const movie = await getMovieDetails(item.content_id);
          content = movie as unknown as Content;
        }

        return {
          ...item,
          content,
          added_by_user: usersData[item.added_by_user_id] || { id: item.added_by_user_id, username: "Unknown", name: "Unknown User", avatar_url: null, created_at: "" },
        };
      })
    );

    // Enrich collaborators with user info
    const enrichedCollaborators: ListCollaboratorWithUser[] = listCollaborators.map((collab) => ({
      ...collab,
      user: usersData[collab.user_id] || { id: collab.user_id, username: "Unknown", name: "Unknown User", avatar_url: null, created_at: "" },
    }));

    return {
      ...list,
      items: enrichedItems,
      collaborators: enrichedCollaborators,
      item_count: enrichedItems.length,
      collaborator_count: enrichedCollaborators.length,
    };
  } catch (error) {
    console.error("Error fetching list details:", error);
    return null;
  }
}

/**
 * Add item to list
 */
export async function addItemToList(
  listId: string,
  contentId: number,
  contentType: "movie" | "tv",
  userId: string
): Promise<ListItem> {
  const itemRef = push(ref(db, "list_items"));
  const itemId = itemRef.key;

  if (!itemId) throw new Error("Failed to generate item ID");

  // Get the count of existing items to set position
  const itemsRef = ref(db, "list_items");
  const itemsSnapshot = await get(itemsRef);
  const allItems = itemsSnapshot.exists() ? itemsSnapshot.val() : {};
  const listItems = Object.values(allItems).filter((item: any) => item.list_id === listId) as ListItem[];
  const position = listItems.length;

  const newItem: ListItem = {
    id: itemId,
    list_id: listId,
    content_id: contentId,
    content_type: contentType,
    added_by_user_id: userId,
    position,
    added_at: new Date().toISOString(),
    watched_by: [],
  };

  await set(itemRef, newItem);

  // Update list updated_at
  await set(ref(db, `lists/${listId}/updated_at`), new Date().toISOString());

  return newItem;
}

/**
 * Remove item from list
 */
export async function removeItemFromList(listId: string, itemId: string): Promise<void> {
  await remove(ref(db, `list_items/${itemId}`));

  // Update list updated_at
  await set(ref(db, `lists/${listId}/updated_at`), new Date().toISOString());
}

/**
 * Add collaborator to list
 */
export async function addCollaborator(
  listId: string,
  userId: string,
  role: "owner" | "collaborator" = "collaborator"
): Promise<ListCollaborator> {
  // Check if already a collaborator
  const collaboratorsRef = ref(db, "list_collaborators");
  const snapshot = await get(collaboratorsRef);
  const allCollaborators = snapshot.exists() ? snapshot.val() : {};

  const existing = Object.entries(allCollaborators).find(
    ([_, collab]: any) => collab.list_id === listId && collab.user_id === userId
  );

  if (existing) {
    throw new Error("User is already a collaborator on this list");
  }

  const collabRef = push(collaboratorsRef);
  const collabId = collabRef.key;

  if (!collabId) throw new Error("Failed to generate collaborator ID");

  const newCollaborator: ListCollaborator = {
    id: collabId,
    list_id: listId,
    user_id: userId,
    role,
    joined_at: new Date().toISOString(),
  };

  await set(collabRef, newCollaborator);

  return newCollaborator;
}

/**
 * Remove collaborator from list
 */
export async function removeCollaborator(collaboratorId: string, listId: string): Promise<void> {
  await remove(ref(db, `list_collaborators/${collaboratorId}`));

  // Update list updated_at
  await set(ref(db, `lists/${listId}/updated_at`), new Date().toISOString());
}

/**
 * Update list metadata
 */
export async function updateList(
  listId: string,
  updates: Partial<List>
): Promise<void> {
  await set(ref(db, `lists/${listId}`), {
    ...(await get(ref(db, `lists/${listId}`)).then((snap) => snap.val())),
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Delete list (soft delete by checking ownership)
 */
export async function deleteList(listId: string, userId: string): Promise<void> {
  const listRef = ref(db, `lists/${listId}`);
  const listSnapshot = await get(listRef);

  if (!listSnapshot.exists()) throw new Error("List not found");

  const list = listSnapshot.val() as List;
  if (list.owner_id !== userId) throw new Error("Only list owner can delete the list");

  // Delete all items in list
  const itemsRef = ref(db, "list_items");
  const itemsSnapshot = await get(itemsRef);
  if (itemsSnapshot.exists()) {
    const allItems = itemsSnapshot.val();
    Object.entries(allItems).forEach(([itemId, item]: any) => {
      if (item.list_id === listId) {
        remove(ref(db, `list_items/${itemId}`));
      }
    });
  }

  // Delete all collaborators
  const collaboratorsRef = ref(db, "list_collaborators");
  const collaboratorsSnapshot = await get(collaboratorsRef);
  if (collaboratorsSnapshot.exists()) {
    const allCollaborators = collaboratorsSnapshot.val();
    Object.entries(allCollaborators).forEach(([collabId, collab]: any) => {
      if (collab.list_id === listId) {
        remove(ref(db, `list_collaborators/${collabId}`));
      }
    });
  }

  // Delete list
  await remove(listRef);
}

/**
 * Get cover images for list (first 4 items)
 */
export async function getListCoverImages(listId: string): Promise<string[]> {
  try {
    const itemsRef = ref(db, "list_items");
    const snapshot = await get(itemsRef);

    if (!snapshot.exists()) return [];

    const allItems = snapshot.val();
    const listItems = Object.values(allItems)
      .filter((item: any) => item.list_id === listId)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
      .slice(0, 4) as ListItem[];

    const images = await Promise.all(
      listItems.map(async (item) => {
        try {
          if (item.content_type === "tv") {
            const show = await getShowDetails(item.content_id);
            return show?.poster_url || "";
          } else {
            const movie = await getMovieDetails(item.content_id);
            return movie?.poster_url || "";
          }
        } catch {
          return "";
        }
      })
    );

    return images.filter((img) => img);
  } catch (error) {
    console.error("Error fetching cover images:", error);
    return [];
  }
}

/**
 * Check if user is collaborator
 */
export async function isUserCollaborator(listId: string, userId: string): Promise<boolean> {
  try {
    const collaboratorsRef = ref(db, "list_collaborators");
    const snapshot = await get(collaboratorsRef);

    if (!snapshot.exists()) return false;

    const allCollaborators = snapshot.val();
    return Object.values(allCollaborators).some(
      (collab: any) => collab.list_id === listId && collab.user_id === userId
    );
  } catch (error) {
    console.error("Error checking collaborator status:", error);
    return false;
  }
}

/**
 * Check if item already in list
 */
export async function isItemInList(listId: string, contentId: number, contentType: "movie" | "tv"): Promise<boolean> {
  try {
    const itemsRef = ref(db, "list_items");
    const snapshot = await get(itemsRef);

    if (!snapshot.exists()) return false;

    const allItems = snapshot.val();
    return Object.values(allItems).some(
      (item: any) => item.list_id === listId && item.content_id === contentId && item.content_type === contentType
    );
  } catch (error) {
    console.error("Error checking if item in list:", error);
    return false;
  }
}

/**
 * Mark an item as watched by a user
 */
export async function markItemAsWatched(itemId: string, userId: string): Promise<void> {
  try {
    const itemRef = ref(db, `list_items/${itemId}`);
    const itemSnapshot = await get(itemRef);

    if (!itemSnapshot.exists()) {
      throw new Error("Item not found");
    }

    const item = itemSnapshot.val();
    const watchedBy = item.watched_by || [];

    // Add user to watched_by if not already there
    if (!watchedBy.includes(userId)) {
      watchedBy.push(userId);
      await set(itemRef, {
        ...item,
        watched_by: watchedBy,
      });
    }
  } catch (error) {
    console.error("Error marking item as watched:", error);
    throw error;
  }
}

/**
 * Unmark an item as watched by a user
 */
export async function unmarkItemAsWatched(itemId: string, userId: string): Promise<void> {
  try {
    const itemRef = ref(db, `list_items/${itemId}`);
    const itemSnapshot = await get(itemRef);

    if (!itemSnapshot.exists()) {
      throw new Error("Item not found");
    }

    const item = itemSnapshot.val();
    const watchedBy = item.watched_by || [];

    // Remove user from watched_by
    const filteredWatched = watchedBy.filter((id: string) => id !== userId);
    await set(itemRef, {
      ...item,
      watched_by: filteredWatched,
    });
  } catch (error) {
    console.error("Error unmarking item as watched:", error);
    throw error;
  }
}

/**
 * Update item position in list
 */
export async function updateItemPosition(itemId: string, newPosition: number, listId: string): Promise<void> {
  try {
    const itemRef = ref(db, `list_items/${itemId}`);
    const itemSnapshot = await get(itemRef);

    if (!itemSnapshot.exists()) {
      throw new Error("Item not found");
    }

    const item = itemSnapshot.val();
    await set(itemRef, {
      ...item,
      position: newPosition,
    });

    // Update list updated_at
    await set(ref(db, `lists/${listId}/updated_at`), new Date().toISOString());
  } catch (error) {
    console.error("Error updating item position:", error);
    throw error;
  }
}

/**
 * Reorder items in batch (for drag and drop)
 */
export async function reorderListItems(listId: string, itemPositions: Array<{ id: string; position: number }>): Promise<void> {
  try {
    for (const { id, position } of itemPositions) {
      const itemRef = ref(db, `list_items/${id}`);
      const itemSnapshot = await get(itemRef);
      if (itemSnapshot.exists()) {
        const item = itemSnapshot.val();
        await set(itemRef, { ...item, position });
      }
    }

    // Update list updated_at
    await set(ref(db, `lists/${listId}/updated_at`), new Date().toISOString());
  } catch (error) {
    console.error("Error reordering items:", error);
    throw error;
  }
}

/**
 * Update list view preferences
 */
export async function updateListViewPreferences(
  listId: string,
  viewType: "grid" | "list",
  showUnwatchedFirst: boolean
): Promise<void> {
  try {
    await set(ref(db, `lists/${listId}`), {
      ...(await get(ref(db, `lists/${listId}`)).then((snap) => snap.val())),
      view_type: viewType,
      show_unwatched_first: showUnwatchedFirst,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating list view preferences:", error);
    throw error;
  }
}
