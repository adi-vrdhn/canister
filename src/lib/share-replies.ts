import { push, ref, get, set } from "firebase/database";
import { db } from "@/lib/firebase";
import type { ShareReply, ShareReplyWithUser, ShareWithDetails, User } from "@/types";
import { shouldDeliverNotificationToUser } from "./settings";

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

export async function getShareReplies(shareId: string, currentUserId?: string): Promise<ShareReplyWithUser[]> {
  const [repliesSnapshot, usersById] = await Promise.all([
    get(ref(db, `share_replies/${shareId}`)),
    getUsersById(),
  ]);

  if (!repliesSnapshot.exists()) return [];

  const replies = Object.values(repliesSnapshot.val() || {}) as ShareReply[];
  return replies
    .map((reply) => ({
      ...reply,
      user: usersById[reply.sender_id] || fallbackUser(reply.sender_id),
      is_current_user: Boolean(currentUserId && reply.sender_id === currentUserId),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) as ShareReplyWithUser[];
}

async function createShareReplyNotification(
  userId: string,
  fromUser: User,
  share: ShareWithDetails,
  replyId: string,
  content: string
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, "share_reply"))) return;

  const notificationRef = push(ref(db, `notifications/${userId}`));
  const now = new Date().toISOString();
  const shareTitle = share.movie?.title || share.content?.title || (share.content as any)?.name || "shared title";
  const safeUsername = fromUser.username || fromUser.name?.toLowerCase().replace(/\s+/g, "") || "user";
  const safeName = fromUser.name || fromUser.username || "Someone";

  await set(notificationRef, {
    type: "share_reply",
    ref_id: share.id,
    shareId: share.id,
    shareTitle,
    contentId: share.content_id,
    contentType: share.content_type,
    commentId: replyId,
    content,
    seen: false,
    fromUser: {
      id: fromUser.id,
      username: safeUsername,
      name: safeName,
      avatar_url: fromUser.avatar_url || null,
    },
    created_at: now,
    createdAt: now,
  });
}

export async function createShareReply(
  share: ShareWithDetails,
  user: User,
  content: string
): Promise<ShareReply> {
  const replyRef = push(ref(db, `share_replies/${share.id}`));
  const replyId = replyRef.key;
  if (!replyId) throw new Error("Failed to create share reply ID");

  const now = new Date().toISOString();
  const otherUserId = share.sender_id === user.id ? share.receiver_id : share.sender_id;

  const reply: ShareReply = {
    id: replyId,
    share_id: share.id,
    sender_id: user.id,
    receiver_id: otherUserId,
    content: content.trim(),
    created_at: now,
    updated_at: now,
  };

  await set(replyRef, reply);

  if (otherUserId && otherUserId !== user.id) {
    await createShareReplyNotification(otherUserId, user, share, replyId, reply.content);
  }

  return reply;
}
