import { db } from "@/lib/firebase";
import { ref, get, push, set, remove } from "firebase/database";
import {
  CinePost,
  CinePostAnchorType,
  CinePostComment,
  CinePostCommentWithUser,
  CinePostEngagementType,
  CinePostType,
  CinePostWithDetails,
  Content,
  MovieLog,
  User,
} from "@/types";
import { getListCoverImages } from "./lists";
import { shouldDeliverNotificationToUser } from "./settings";

type CreateCinePostInput = {
  user: User;
  type: CinePostType;
  anchorType: CinePostAnchorType;
  anchorLabel: string;
  body: string;
  tags?: string[];
  content?: Content | null;
  listId?: string;
  listName?: string;
  listCoverUrl?: string | null;
  logId?: string;
};

type CinePostQueryOptions = {
  type?: CinePostType | "all";
  anchorType?: CinePostAnchorType | "all";
  sort?: "smart" | "recent" | "top";
};

type UpdateCinePostInput = {
  body: string;
  tags?: string[];
};

function fallbackUser(userId: string): User {
  return {
    id: userId,
    username: "user",
    name: "Unknown",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeUser(userId: string, userData: any): User {
  return {
    id: userData?.id || userId,
    username: userData?.username || "user",
    name: userData?.name || "Unknown",
    avatar_url: userData?.avatar_url || null,
    created_at: userData?.created_at || userData?.createdAt || new Date().toISOString(),
  };
}

function cleanTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    )
  ).slice(0, 8);
}

function reactionLabel(reaction: 0 | 1 | 2): string {
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1) return "Good";
  return "Bad";
}

function scorePost(saves: number, comments: number, likes: number): number {
  return saves * 3 + comments * 2 + likes;
}

function rankPost(post: CinePostWithDetails): number {
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60)
  );
  const agePenalty = Math.pow(ageHours + 2, 0.35);
  const typeBoost = post.type === "log" ? 1.2 : 1.6;
  return (post.score + typeBoost) / agePenalty;
}

function scoreComment(comment: CinePostComment, replyCount: number): number {
  return replyCount * 4 + Math.min(comment.content.trim().length, 240) / 24;
}

async function getUsersById(): Promise<Record<string, User>> {
  const usersSnapshot = await get(ref(db, "users"));
  const usersRaw = usersSnapshot.val() || {};

  return Object.fromEntries(
    Object.entries(usersRaw).map(([id, value]) => [id, normalizeUser(id, value)])
  ) as Record<string, User>;
}

function nestComments(
  comments: CinePostComment[],
  usersById: Record<string, User>
): CinePostCommentWithUser[] {
  const nodes = new Map<string, CinePostCommentWithUser>();

  comments.forEach((comment) => {
    nodes.set(comment.id, {
      ...comment,
      user: usersById[comment.user_id] || fallbackUser(comment.user_id),
      replies: [],
      insightScore: 0,
    });
  });

  const roots: CinePostCommentWithUser[] = [];

  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)?.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (items: CinePostCommentWithUser[]) => {
    items.forEach((item) => {
      sortTree(item.replies);
      item.insightScore = scoreComment(item, item.replies.length);
    });

    items.sort((a, b) => {
      if (b.insightScore !== a.insightScore) return b.insightScore - a.insightScore;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  sortTree(roots);
  return roots;
}

export async function createCinePost(input: CreateCinePostInput): Promise<CinePost> {
  const postRef = push(ref(db, "posts"));
  const postId = postRef.key;

  if (!postId) throw new Error("Failed to create CinePost ID");

  const now = new Date().toISOString();
  const contentType: "movie" | "tv" | "list" = input.listId
    ? "list"
    : input.content?.type === "tv"
      ? "tv"
      : "movie";
  const defaultTags = [
    input.anchorLabel,
    input.type,
    ...(input.content?.genres || []),
    input.content?.director || "",
    ...((input.content as any)?.cast || []),
    ...((input.content as any)?.actors || []),
  ];

  const post: CinePost = {
    id: postId,
    user_id: input.user.id,
    type: input.type,
    anchor_type: input.anchorType,
    anchor_label: input.anchorLabel.trim(),
    body: input.body.trim(),
    tags: cleanTags([...(input.tags || []), ...defaultTags]),
    created_at: now,
    updated_at: now,
  };

  if (input.content && !input.listId) {
    post.content_id = input.content.id;
  }

  if (input.listId) {
    post.list_id = input.listId;
  }

  post.content_type = contentType;
  post.content_title =
    input.listName?.trim() ||
    input.content?.title ||
    (input.content as any)?.name ||
    input.anchorLabel;
  post.poster_url = input.listCoverUrl ?? input.content?.poster_url ?? null;

  if (contentType === "movie" && input.content) {
    post.movie_id = input.content.id;
  }

  if (input.logId) {
    post.log_id = input.logId;
  }

  await set(postRef, post);
  return post;
}

export async function createLogCinePost(
  user: User,
  log: MovieLog,
  content: Content,
  caption?: string
): Promise<CinePost> {
  const title = content.title || (content as any).name || "this title";
  const rating = reactionLabel(log.reaction);
  const body = [`Just watched ${title} - ${rating}`, caption?.trim()].filter(Boolean).join("\n\n");

  return createCinePost({
    user,
    type: "log",
    anchorType: content.type === "tv" ? "tv" : "movie",
    anchorLabel: title,
    body,
    content,
    logId: log.id,
    tags: [rating, "watched"],
  });
}

export async function getCinePosts(
  currentUserId?: string,
  limit: number = 30,
  options: CinePostQueryOptions = {}
): Promise<CinePostWithDetails[]> {
  const [postsSnapshot, usersById, commentsSnapshot, engagementSnapshot] = await Promise.all([
    get(ref(db, "posts")),
    getUsersById(),
    get(ref(db, "comments")),
    get(ref(db, "engagement")),
  ]);

  if (!postsSnapshot.exists()) return [];

  const commentsRaw = commentsSnapshot.val() || {};
  const engagementRaw = engagementSnapshot.val() || {};

  const posts = Object.values(postsSnapshot.val() as Record<string, CinePost>);
  const listPosts = posts.filter((post) => post.list_id && post.content_type === "list");
  const listCoverImagesByPostId = new Map<string, string[]>();

  await Promise.all(
    listPosts.map(async (post) => {
      if (!post.list_id) return;
      const images = await getListCoverImages(post.list_id);
      if (images.length > 0) {
        listCoverImagesByPostId.set(post.id, images);
      }
    })
  );

  return posts
    .filter((post) => {
      if (options.type && options.type !== "all" && post.type !== options.type) return false;
      if (options.anchorType && options.anchorType !== "all" && post.anchor_type !== options.anchorType) return false;
      return true;
    })
    .map((post) => {
      const postComments = Object.values(commentsRaw[post.id] || {}) as CinePostComment[];
      const engagements = Object.values(engagementRaw[post.id] || {}) as Array<{
        user_id: string;
        type: CinePostEngagementType;
      }>;
      const likes = engagements.filter((entry) => entry.type === "like");
      const saves = engagements.filter((entry) => entry.type === "save");

      return {
        ...post,
        list_cover_images: listCoverImagesByPostId.get(post.id),
        user: usersById[post.user_id] || fallbackUser(post.user_id),
        comments: nestComments(postComments, usersById),
        comments_count: postComments.length,
        likes_count: likes.length,
        saves_count: saves.length,
        score: scorePost(saves.length, postComments.length, likes.length),
        liked_by_current_user: Boolean(
          currentUserId && likes.some((entry) => entry.user_id === currentUserId)
        ),
        saved_by_current_user: Boolean(
          currentUserId && saves.some((entry) => entry.user_id === currentUserId)
        ),
      };
    })
    .sort((a, b) => {
      if (options.sort === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (options.sort === "top") {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      const rankDifference = rankPost(b) - rankPost(a);
      if (rankDifference !== 0) return rankDifference;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}

export async function getCinePost(
  postId: string,
  currentUserId?: string
): Promise<CinePostWithDetails | null> {
  const [postSnapshot, usersById, commentsSnapshot, engagementSnapshot] = await Promise.all([
    get(ref(db, `posts/${postId}`)),
    getUsersById(),
    get(ref(db, `comments/${postId}`)),
    get(ref(db, `engagement/${postId}`)),
  ]);

  if (!postSnapshot.exists()) return null;

  const post = postSnapshot.val() as CinePost;
  const listCoverImages =
    post.list_id && post.content_type === "list" ? await getListCoverImages(post.list_id) : [];
  const postComments = commentsSnapshot.exists()
    ? (Object.values(commentsSnapshot.val()) as CinePostComment[])
    : [];
  const engagements = engagementSnapshot.exists()
    ? (Object.values(engagementSnapshot.val()) as Array<{
        user_id: string;
        type: CinePostEngagementType;
      }>)
    : [];
  const likes = engagements.filter((entry) => entry.type === "like");
  const saves = engagements.filter((entry) => entry.type === "save");

  return {
    ...post,
    list_cover_images: listCoverImages.length > 0 ? listCoverImages : undefined,
    user: usersById[post.user_id] || fallbackUser(post.user_id),
    comments: nestComments(postComments, usersById),
    comments_count: postComments.length,
    likes_count: likes.length,
    saves_count: saves.length,
    score: scorePost(saves.length, postComments.length, likes.length),
    liked_by_current_user: Boolean(
      currentUserId && likes.some((entry) => entry.user_id === currentUserId)
    ),
    saved_by_current_user: Boolean(
      currentUserId && saves.some((entry) => entry.user_id === currentUserId)
    ),
  };
}

export async function getCinePostEngagementUsers(
  postId: string,
  type: CinePostEngagementType
): Promise<User[]> {
  const [engagementSnapshot, usersById] = await Promise.all([
    get(ref(db, `engagement/${postId}`)),
    getUsersById(),
  ]);

  if (!engagementSnapshot.exists()) return [];

  return (Object.values(engagementSnapshot.val()) as Array<{
    user_id: string;
    type: CinePostEngagementType;
  }>)
    .filter((entry) => entry.type === type)
    .map((entry) => usersById[entry.user_id] || fallbackUser(entry.user_id));
}

export async function getCinePostsForContent(
  contentId: number,
  contentType: "movie" | "tv",
  currentUserId?: string,
  limit: number = 20
): Promise<CinePostWithDetails[]> {
  const posts = await getCinePosts(currentUserId, 200, { sort: "recent" });
  return posts
    .filter((post) => post.content_id === contentId && post.content_type === contentType)
    .slice(0, limit);
}

export async function getRelatedCinePosts(
  post: CinePostWithDetails,
  currentUserId?: string,
  limit: number = 3
): Promise<CinePostWithDetails[]> {
  if (!post.content_id || !post.content_type || post.content_type === "list") return [];
  const posts = await getCinePostsForContent(post.content_id, post.content_type, currentUserId, 20);
  return posts.filter((candidate) => candidate.id !== post.id).slice(0, limit);
}

export async function getUserCinePosts(
  userId: string,
  currentUserId?: string,
  limit: number = 30
): Promise<CinePostWithDetails[]> {
  const posts = await getCinePosts(currentUserId, 200, { sort: "recent" });
  return posts.filter((post) => post.user_id === userId).slice(0, limit);
}

export async function getUserEngagedCinePosts(
  userId: string,
  type: CinePostEngagementType,
  currentUserId?: string,
  limit: number = 30
): Promise<CinePostWithDetails[]> {
  const [posts, engagementSnapshot] = await Promise.all([
    getCinePosts(currentUserId, 200, { sort: "recent" }),
    get(ref(db, "engagement")),
  ]);

  if (!engagementSnapshot.exists()) return [];

  const engagementRaw = engagementSnapshot.val() || {};
  const postIds = new Set<string>();

  Object.entries(engagementRaw).forEach(([postId, entries]) => {
    const values = Object.values(entries as Record<string, { user_id: string; type: CinePostEngagementType }>);
    if (values.some((entry) => entry.user_id === userId && entry.type === type)) {
      postIds.add(postId);
    }
  });

  return posts.filter((post) => postIds.has(post.id)).slice(0, limit);
}

export async function setCinePostEngagement(
  post: CinePostWithDetails,
  user: User,
  type: CinePostEngagementType,
  enabled: boolean
): Promise<void> {
  const engagementId = `${user.id}_${type}`;
  const engagementRef = ref(db, `engagement/${post.id}/${engagementId}`);

  if (!enabled) {
    await remove(engagementRef);
    return;
  }

  await set(engagementRef, {
    id: engagementId,
    user_id: user.id,
    post_id: post.id,
    type,
    created_at: new Date().toISOString(),
  });

  if (post.user_id !== user.id) {
    await createCinePostNotification(post.user_id, type === "like" ? "post_like" : "post_save", post.id, user);
  }
}

export async function updateCinePost(
  postId: string,
  userId: string,
  input: UpdateCinePostInput
): Promise<CinePost> {
  const postSnapshot = await get(ref(db, `posts/${postId}`));

  if (!postSnapshot.exists()) {
    throw new Error("Post not found");
  }

  const post = postSnapshot.val() as CinePost;
  if (post.user_id !== userId) {
    throw new Error("Only the post owner can edit this post");
  }

  const updatedPost: CinePost = {
    ...post,
    body: input.body.trim(),
    tags: cleanTags(input.tags || post.tags || []),
    updated_at: new Date().toISOString(),
  };

  await set(ref(db, `posts/${postId}`), updatedPost);
  return updatedPost;
}

export async function deleteCinePost(postId: string, userId: string): Promise<void> {
  const postSnapshot = await get(ref(db, `posts/${postId}`));

  if (!postSnapshot.exists()) {
    throw new Error("Post not found");
  }

  const post = postSnapshot.val() as CinePost;
  if (post.user_id !== userId) {
    throw new Error("Only the post owner can delete this post");
  }

  await Promise.all([
    remove(ref(db, `posts/${postId}`)),
    remove(ref(db, `comments/${postId}`)),
    remove(ref(db, `engagement/${postId}`)),
  ]);
}

export async function createCinePostComment(
  post: CinePostWithDetails,
  user: User,
  content: string,
  parentId: string | null = null,
  replyOwnerId?: string
): Promise<CinePostComment> {
  const commentRef = push(ref(db, `comments/${post.id}`));
  const commentId = commentRef.key;

  if (!commentId) throw new Error("Failed to create comment ID");

  const now = new Date().toISOString();
  const comment: CinePostComment = {
    id: commentId,
    post_id: post.id,
    user_id: user.id,
    parent_id: parentId,
    content: content.trim(),
    created_at: now,
    updated_at: now,
  };

  await set(commentRef, comment);

  if (post.user_id !== user.id) {
    await createCinePostNotification(post.user_id, "post_comment", post.id, user);
  }

  if (replyOwnerId && replyOwnerId !== user.id && replyOwnerId !== post.user_id) {
    await createCinePostNotification(replyOwnerId, "comment_reply", post.id, user);
  }

  return comment;
}

function collectCommentDescendants(
  commentsById: Record<string, CinePostComment>,
  commentId: string
): string[] {
  const ids = [commentId];

  Object.values(commentsById).forEach((comment) => {
    if (comment.parent_id === commentId) {
      ids.push(...collectCommentDescendants(commentsById, comment.id));
    }
  });

  return ids;
}

export async function updateCinePostComment(
  postId: string,
  userId: string,
  commentId: string,
  content: string
): Promise<CinePostComment> {
  const [postSnapshot, commentSnapshot] = await Promise.all([
    get(ref(db, `posts/${postId}`)),
    get(ref(db, `comments/${postId}`)),
  ]);

  if (!postSnapshot.exists()) {
    throw new Error("Post not found");
  }

  if (!commentSnapshot.exists()) {
    throw new Error("Comment not found");
  }

  const commentsById = commentSnapshot.val() as Record<string, CinePostComment>;
  const existingComment = commentsById[commentId];

  if (!existingComment) {
    throw new Error("Comment not found");
  }

  if (existingComment.user_id !== userId) {
    throw new Error("Only the comment owner can edit this comment");
  }

  const updatedComment: CinePostComment = {
    ...existingComment,
    content: content.trim(),
    updated_at: new Date().toISOString(),
  };

  await set(ref(db, `comments/${postId}/${commentId}`), updatedComment);
  return updatedComment;
}

export async function deleteCinePostComment(
  postId: string,
  userId: string,
  commentId: string
): Promise<void> {
  const [postSnapshot, commentSnapshot] = await Promise.all([
    get(ref(db, `posts/${postId}`)),
    get(ref(db, `comments/${postId}`)),
  ]);

  if (!postSnapshot.exists()) {
    throw new Error("Post not found");
  }

  if (!commentSnapshot.exists()) {
    throw new Error("Comment not found");
  }

  const post = postSnapshot.val() as CinePost;
  const commentsById = commentSnapshot.val() as Record<string, CinePostComment>;
  const existingComment = commentsById[commentId];

  if (!existingComment) {
    throw new Error("Comment not found");
  }

  if (existingComment.user_id !== userId && post.user_id !== userId) {
    throw new Error("Only the comment owner or post owner can delete this comment");
  }

  const descendantIds = collectCommentDescendants(commentsById, commentId);
  await Promise.all(descendantIds.map((id) => remove(ref(db, `comments/${postId}/${id}`))));
}

async function createCinePostNotification(
  userId: string,
  type: "post_like" | "post_save" | "post_comment" | "comment_reply",
  refId: string,
  fromUser: User
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, type))) return;

  const notificationRef = push(ref(db, `notifications/${userId}`));

  await set(notificationRef, {
    type,
    ref_id: refId,
    seen: false,
    fromUser: {
      id: fromUser.id,
      username: fromUser.username,
      name: fromUser.name,
      avatar_url: fromUser.avatar_url || null,
    },
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
}
