import { db } from "@/lib/firebase";
import {
  ref,
  get,
  push,
  set,
  remove,
} from "firebase/database";
import type { LogComment, LogCommentWithUser, User } from "@/types";
import { shouldDeliverNotificationToUser } from "./settings";
import { sendPushNotification } from "./push-notifications";

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

async function getUsersById(): Promise<Record<string, User>> {
  const usersSnapshot = await get(ref(db, "users"));
  const usersRaw = usersSnapshot.val() || {};
  return Object.fromEntries(
    Object.entries(usersRaw).map(([id, value]) => [id, normalizeUser(id, value)])
  ) as Record<string, User>;
}

function scoreComment(comment: LogComment, replyCount: number): number {
  return replyCount * 4 + Math.min(comment.content.trim().length, 240) / 24;
}

function nestComments(
  comments: LogComment[],
  usersById: Record<string, User>,
  likesByComment: Record<string, Record<string, boolean>>,
  currentUserId?: string
): LogCommentWithUser[] {
  const nodes = new Map<string, LogCommentWithUser>();

  comments.forEach((comment) => {
    const commentLikes = likesByComment[comment.id] || {};
    nodes.set(comment.id, {
      ...comment,
      user: usersById[comment.user_id] || fallbackUser(comment.user_id),
      replies: [],
      insightScore: 0,
      likes_count: Object.keys(commentLikes).length,
      liked_by_current_user: Boolean(currentUserId && commentLikes[currentUserId]),
    });
  });

  const roots: LogCommentWithUser[] = [];

  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)?.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (items: LogCommentWithUser[]) => {
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

async function createLogCommentNotification(
  userId: string,
  type: "log_comment" | "log_comment_reply" | "log_comment_like",
  logId: string,
  fromUser: User,
  commentId: string
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, type))) return;

  const notificationRef = push(ref(db, `notifications/${userId}`));
  await set(notificationRef, {
    type,
    ref_id: logId,
    logId,
    commentId,
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

  const titleByType: Record<typeof type, string> = {
    log_comment: `${fromUser.name} commented on your log`,
    log_comment_reply: `${fromUser.name} replied to your log comment`,
    log_comment_like: `${fromUser.name} liked your log comment`,
  };

  await sendPushNotification({
    userId,
    title: titleByType[type],
    body: "Open Canisterr to view it.",
    url: `/logs/${logId}${commentId ? `?comment=${commentId}` : ""}`,
    type,
    notificationId: `${logId}-${commentId}-${type}`,
  });
}

export async function getLogComments(
  logId: string,
  currentUserId?: string
): Promise<LogCommentWithUser[]> {
  const [commentsSnapshot, usersById, likesSnapshot] = await Promise.all([
    get(ref(db, `log_comments/${logId}`)),
    getUsersById(),
    get(ref(db, `log_comment_likes/${logId}`)),
  ]);

  const comments: LogComment[] = commentsSnapshot.exists()
    ? (Object.values(commentsSnapshot.val()) as LogComment[])
    : [];
  const likesRaw = likesSnapshot.exists() ? likesSnapshot.val() : {};

  return nestComments(comments, usersById, likesRaw, currentUserId);
}

export async function createLogComment(
  logId: string,
  logOwnerId: string,
  user: User,
  content: string,
  parentId: string | null = null,
  replyOwnerId?: string
): Promise<LogComment> {
  const commentRef = push(ref(db, `log_comments/${logId}`));
  const commentId = commentRef.key;
  if (!commentId) throw new Error("Failed to create comment ID");

  const now = new Date().toISOString();
  const comment: LogComment = {
    id: commentId,
    log_id: logId,
    user_id: user.id,
    parent_id: parentId,
    content: content.trim(),
    created_at: now,
    updated_at: now,
  };

  await set(commentRef, comment);

  if (logOwnerId !== user.id) {
    await createLogCommentNotification(logOwnerId, "log_comment", logId, user, commentId);
  }

  if (replyOwnerId && replyOwnerId !== user.id && replyOwnerId !== logOwnerId) {
    await createLogCommentNotification(replyOwnerId, "log_comment_reply", logId, user, commentId);
  }

  return comment;
}

export async function likeLogComment(logId: string, commentId: string, userId: string): Promise<void> {
  const [commentSnapshot, userSnapshot] = await Promise.all([
    get(ref(db, `log_comments/${logId}/${commentId}`)),
    get(ref(db, `users/${userId}`)),
  ]);

  await set(ref(db, `log_comment_likes/${logId}/${commentId}/${userId}`), true);

  if (!commentSnapshot.exists()) return;

  const comment = commentSnapshot.val() as LogComment;
  if (comment.user_id === userId) return;

  const fromUser = normalizeUser(userId, userSnapshot.val());
  await createLogCommentNotification(comment.user_id, "log_comment_like", logId, fromUser, commentId);
}

export async function unlikeLogComment(logId: string, commentId: string, userId: string): Promise<void> {
  await remove(ref(db, `log_comment_likes/${logId}/${commentId}/${userId}`));
}

export async function getLogCommentLikes(
  logId: string,
  commentId: string,
  userId: string
): Promise<{ count: number; liked: boolean; userIds: string[] }> {
  const likesSnapshot = await get(ref(db, `log_comment_likes/${logId}/${commentId}`));
  if (!likesSnapshot.exists()) return { count: 0, liked: false, userIds: [] };

  const likes = likesSnapshot.val() || {};
  const userIds = Object.keys(likes);
  return {
    count: userIds.length,
    liked: Boolean(likes[userId]),
    userIds,
  };
}

export async function getLogCommentLikers(logId: string, commentId: string): Promise<User[]> {
  const [likesSnapshot, usersById] = await Promise.all([
    get(ref(db, `log_comment_likes/${logId}/${commentId}`)),
    getUsersById(),
  ]);

  if (!likesSnapshot.exists()) return [];
  const likes = likesSnapshot.val() || {};
  return Object.keys(likes).map((userId) => usersById[userId] || fallbackUser(userId));
}
