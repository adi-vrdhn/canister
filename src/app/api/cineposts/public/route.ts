import "server-only";

import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getPublicListWithDetails } from "@/lib/lists-public";
import type { CinePost, CinePostEngagementType, CinePostWithDetails, ListWithItems, User } from "@/types";

export const runtime = "nodejs";

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
  if (!raw) return createFallbackUser(userId);

  const username = typeof raw.username === "string" && raw.username.trim() ? raw.username.trim() : userId;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null;
  const createdAt = raw.created_at || raw.createdAt || new Date().toISOString();

  return {
    id: userId,
    username,
    name: name || (username.startsWith("@") ? username.slice(1) : username),
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

function scorePost(saves: number, comments: number, likes: number): number {
  return saves * 3 + comments * 2 + likes;
}

function normalizeFeedToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeFeedTags(tags: Array<string | null | undefined>): Set<string> {
  return new Set(
    tags
      .map((tag) => normalizeFeedToken(String(tag || "").replace(/^#/, "")))
      .filter(Boolean)
  );
}

function getPostTasteTags(post: Pick<CinePostWithDetails, "tags" | "anchor_label" | "content_title" | "person_name" | "person_department">): Set<string> {
  return normalizeFeedTags([
    ...(post.tags || []),
    post.anchor_label,
    post.content_title || "",
    post.person_name || "",
    post.person_department || "",
  ]);
}

function getAgeHours(createdAt: string): number {
  return Math.max(1, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
}

function rankPost(
  post: CinePostWithDetails,
  context: {
    friendIds: Set<string>;
    seenPostIds: Set<string>;
    tasteTags: Set<string>;
    popularIds: Set<string>;
  }
): CinePostWithDetails {
  const ageHours = getAgeHours(post.created_at);
  const isFromFriend = context.friendIds.has(post.user_id);
  const seenByUser = context.seenPostIds.has(post.id);
  const postTasteTags = getPostTasteTags(post);
  const tasteMatches = Array.from(postTasteTags).filter((tag) => context.tasteTags.has(tag)).length;

  const recencyScore = 240 / Math.pow(ageHours + 2, 0.85);
  const popularityScore = post.score * 18 + post.likes_count * 2 + post.comments_count * 4 + post.saves_count * 5;
  const friendScore = isFromFriend ? 260 : 0;
  const unseenBoost = isFromFriend && !seenByUser && ageHours < 48 ? 500 : 0;
  const freshPublicBoost = !isFromFriend && ageHours < 24 ? 70 : 0;
  const tasteScore = tasteMatches > 0 ? 120 + tasteMatches * 35 : 0;
  const popularBoost = context.popularIds.has(post.id) ? 160 : 0;

  let feedTier = 5;
  if (post.liked_by_current_user) {
    feedTier = 9;
  } else if (isFromFriend && !seenByUser && ageHours < 48) {
    feedTier = 0;
  } else if (isFromFriend) {
    feedTier = 1;
  } else if (ageHours < 24) {
    feedTier = 2;
  } else if (context.popularIds.has(post.id)) {
    feedTier = 3;
  } else if (tasteMatches > 0) {
    feedTier = 4;
  }

  return {
    ...post,
    feedTier,
    feedScore: recencyScore + popularityScore + friendScore + unseenBoost + freshPublicBoost + tasteScore + popularBoost,
    isFromFriend,
    seenByUser,
    tasteMatchScore: tasteMatches,
  };
}

function clampLimit(rawLimit: string | null): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

function mapListPost(post: CinePost, list: ListWithItems | null | undefined): Partial<CinePostWithDetails> {
  if (!list) return {};

  return {
    list_items: list.items,
    list_cover_images:
      list.items
        .map((item) => item.content.poster_url)
        .filter((image): image is string => Boolean(image)) || [],
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = clampLimit(url.searchParams.get("limit"));

    const db = getFirebaseAdminDatabase();
    const [postsSnapshot, commentsSnapshot, engagementSnapshot] = await Promise.all([
      db.ref("posts").get(),
      db.ref("comments").get(),
      db.ref("engagement").get(),
    ]);

    if (!postsSnapshot.exists()) {
      return NextResponse.json({ posts: [] }, { status: 200 });
    }

    const commentsRaw = commentsSnapshot.exists() ? (commentsSnapshot.val() as Record<string, Record<string, unknown>>) : {};
    const engagementRaw = engagementSnapshot.exists() ? (engagementSnapshot.val() as Record<string, Record<string, { user_id: string; type: CinePostEngagementType }>>) : {};
    const posts = Object.values(postsSnapshot.val() as Record<string, CinePost>).filter(
      (post): post is CinePost => Boolean(post && post.id)
    );

    const listPosts = posts.filter((post) => post.list_id && post.content_type === "list");
    const listDetailsByPostId = new Map<string, NonNullable<Awaited<ReturnType<typeof getPublicListWithDetails>>>>();

    await Promise.all(
      listPosts.map(async (post) => {
        if (!post.list_id) return;
        const list = await getPublicListWithDetails(post.list_id);
        if (list) {
          listDetailsByPostId.set(post.id, list);
        }
      })
    );

    const usersById = await getAdminUsersByIds([
      ...new Set([
        ...posts.map((post) => post.user_id),
        ...Object.values(commentsRaw).flatMap((postComments) =>
          Object.values(postComments || {}).map((comment: any) => comment.user_id).filter(Boolean)
        ),
        ...Object.values(engagementRaw).flatMap((postEngagements) =>
          Object.values(postEngagements || {}).map((entry) => entry.user_id).filter(Boolean)
        ),
      ]),
    ]);

    const enrichedPosts: CinePostWithDetails[] = posts.map((post) => {
      const postComments = Object.values(commentsRaw[post.id] || {}) as Array<{ user_id: string }>;
      const engagements = Object.values(engagementRaw[post.id] || {}) as Array<{
        user_id: string;
        type: CinePostEngagementType;
      }>;
      const likes = engagements.filter((entry) => entry.type === "like");
      const saves = engagements.filter((entry) => entry.type === "save");

      const listDetails = listDetailsByPostId.get(post.id);
      const listPostData = post.list_id && post.content_type === "list" ? mapListPost(post, listDetails) : {};

      return {
        ...post,
        ...listPostData,
        user: usersById[post.user_id] || createFallbackUser(post.user_id),
        comments: [],
        comments_count: postComments.length,
        likes_count: likes.length,
        saves_count: saves.length,
        score: scorePost(saves.length, postComments.length, likes.length),
        liked_by_current_user: false,
        saved_by_current_user: false,
      } satisfies CinePostWithDetails;
    });

    const popularityRanked = [...enrichedPosts].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const popularIds = new Set(
      popularityRanked
        .slice(0, Math.max(5, Math.ceil(popularityRanked.length * 0.2)))
        .map((post) => post.id)
    );

    const ranked = enrichedPosts
      .map((post) =>
        rankPost(post, {
          friendIds: new Set(),
          seenPostIds: new Set(),
          tasteTags: new Set(),
          popularIds,
        })
      )
      .sort((a, b) => {
        if ((a.feedTier || 0) !== (b.feedTier || 0)) return (a.feedTier || 0) - (b.feedTier || 0);
        if ((b.feedScore || 0) !== (a.feedScore || 0)) return (b.feedScore || 0) - (a.feedScore || 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, limit);

    return NextResponse.json({ posts: ranked }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error loading public cine posts:", error);
    return NextResponse.json({ posts: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
