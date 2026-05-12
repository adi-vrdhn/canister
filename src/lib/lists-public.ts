import "server-only";

import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { normalizeListIdParam } from "./list-ids";
import type {
  Content,
  List,
  ListCollaborator,
  ListCollaboratorWithUser,
  ListItem,
  ListItemWithContent,
  ListWithItems,
  User,
} from "@/types";

type AdminUserRecord = {
  username?: string;
  name?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

function createFallbackUser(userId: string): User {
  const shortId = userId.trim().slice(0, 6);
  return {
    id: userId,
    username: userId,
    name: shortId ? `User ${shortId}` : "User",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeAdminUser(userId: string, raw: AdminUserRecord | null | undefined): User {
  if (!raw) {
    return createFallbackUser(userId);
  }

  const username = typeof raw.username === "string" && raw.username.trim() ? raw.username.trim() : userId;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null;
  const createdAt = raw.created_at || raw.createdAt || new Date().toISOString();

  return {
    id: userId,
    username,
    name: name || (username ? (username.startsWith("@") ? username.slice(1) : username) : createFallbackUser(userId).name),
    avatar_url: raw.avatar_url || null,
    created_at: createdAt,
  };
}

async function getAdminUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const db = getFirebaseAdminDatabase();
  const users = await Promise.all(
    uniqueIds.map(async (userId) => {
      const snapshot = await db.ref(`users/${userId}`).get();
      const raw = snapshot.exists() ? (snapshot.val() as AdminUserRecord) : null;
      return [userId, normalizeAdminUser(userId, raw)] as const;
    })
  );

  return Object.fromEntries(users);
}

function fallbackMovieContent(contentId: number): Content {
  return {
    id: contentId,
    title: "Unknown Movie",
    poster_url: null,
    genres: [],
    platforms: [],
    director: null,
    release_date: null,
    overview: "Movie details are unavailable right now.",
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

function fallbackShowContent(contentId: number): Content {
  return {
    id: contentId,
    title: "Unknown Show",
    name: "Unknown Show",
    poster_url: null,
    genres: [],
    status: null,
    release_date: null,
    overview: "Show details are unavailable right now.",
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
    type: "tv",
  };
}

async function getContentDetails(item: ListItem): Promise<Content> {
  if (item.content_type === "tv") {
    const show = await getShowDetails(item.content_id);
    return (show as unknown as Content) || fallbackShowContent(item.content_id);
  }

  const movie = await getMovieDetails(item.content_id);
  return (movie as unknown as Content) || fallbackMovieContent(item.content_id);
}

/**
 * Read-only list details for public/shared views.
 */
export async function getPublicListWithDetails(listId: string): Promise<ListWithItems | null> {
  try {
    const safeListId = normalizeListIdParam(listId);
    if (!safeListId) return null;

    const db = getFirebaseAdminDatabase();
    const [listSnapshot, itemsSnapshot, collaboratorsSnapshot] = await Promise.all([
      db.ref(`lists/${safeListId}`).get(),
      db.ref("list_items").get(),
      db.ref("list_collaborators").get(),
    ]);

    if (!listSnapshot.exists()) return null;

    const list = listSnapshot.val() as List;
    if (list.privacy !== "public") return null;

    const allItems = itemsSnapshot.exists() ? (itemsSnapshot.val() as Record<string, ListItem>) : {};
    const listItems = Object.values(allItems)
      .filter((item: ListItem) => item.list_id === safeListId)
      .sort((a: ListItem, b: ListItem) => (a.position || 0) - (b.position || 0));

    const allCollaborators = collaboratorsSnapshot.exists()
      ? (collaboratorsSnapshot.val() as Record<string, ListCollaborator>)
      : {};
    const listCollaborators = Object.values(allCollaborators).filter(
      (collab: ListCollaborator) => collab.list_id === safeListId
    );

    const requiredUserIds = Array.from(
      new Set([
        ...listItems.map((item) => item.added_by_user_id),
        ...listCollaborators.map((collab) => collab.user_id),
      ])
    );
    const usersById = await getAdminUsersByIds(requiredUserIds);

    const enrichedItems: ListItemWithContent[] = await Promise.all(
      listItems.map(async (item) => ({
        ...item,
        watched_by: Array.isArray(item.watched_by) ? item.watched_by : [],
        content: await getContentDetails(item),
        added_by_user: usersById[item.added_by_user_id] || createFallbackUser(item.added_by_user_id),
      }))
    );

    const enrichedCollaborators: ListCollaboratorWithUser[] = listCollaborators.map((collab) => ({
      ...collab,
      user: usersById[collab.user_id] || createFallbackUser(collab.user_id),
    }));

    return {
      ...list,
      items: enrichedItems,
      collaborators: enrichedCollaborators,
      item_count: enrichedItems.length,
      collaborator_count: enrichedCollaborators.length,
    };
  } catch (error) {
    console.error("Error fetching public list details:", error);
    return null;
  }
}
