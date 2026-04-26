import { get, ref, remove, set } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "@/types";
import { shouldDeliverNotificationToUser } from "./settings";

export type FollowRequestState = "pending" | "accepted";

export type NotificationType =
  | "follow_request"
  | "collaboration_request"
  | "post_like"
  | "post_save"
  | "post_comment"
  | "comment_reply"
  | "like"
  | "share_reply"
  | "log_comment"
  | "log_comment_reply"
  | "log_comment_like";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  fromUser?: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  };
  createdAt: string;
  seen?: boolean;
  followRequestState?: FollowRequestState;
  ref_id?: string;
  listId?: string;
  listName?: string;
  logId?: string;
  commentId?: string;
  shareId?: string;
  shareTitle?: string;
  content?: string;
  contentId?: string | number;
  contentType?: string;
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

function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedFields(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, stripUndefinedFields(fieldValue)])
    ) as T;
  }

  return value;
}

export function parseNotificationItems(raw: unknown): NotificationItem[] {
  if (!raw || typeof raw !== "object") return [];

  return Object.entries(raw as Record<string, Record<string, unknown>>).map(([id, entry]) => ({
    id,
    type: entry.type as NotificationType,
    fromUser: entry.fromUser as NotificationItem["fromUser"],
    createdAt: (entry.createdAt as string | undefined) || (entry.created_at as string | undefined) || new Date().toISOString(),
    seen: entry.seen as boolean | undefined,
    followRequestState: entry.followRequestState as FollowRequestState | undefined,
    ref_id: entry.ref_id as string | undefined,
    listId: entry.listId as string | undefined,
    listName: entry.listName as string | undefined,
    logId: entry.logId as string | undefined,
    commentId: entry.commentId as string | undefined,
    shareId: entry.shareId as string | undefined,
    shareTitle: entry.shareTitle as string | undefined,
    content: entry.content as string | undefined,
    contentId: entry.contentId as string | number | undefined,
    contentType: entry.contentType as string | undefined,
  })) as NotificationItem[];
}

export function sortNotificationItems(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function notificationHref(note: NotificationItem): string {
  if (note.type === "collaboration_request" && note.listId) return `/lists/${note.listId}`;
  if ((note.type === "post_like" || note.type === "post_save" || note.type === "post_comment" || note.type === "comment_reply") && note.ref_id) {
    return `/posts/${note.ref_id}`;
  }
  if (note.type === "share_reply" && note.shareId) {
    return `/share?share_id=${note.shareId}&panel=history`;
  }
  if ((note.type === "log_comment" || note.type === "log_comment_reply" || note.type === "log_comment_like") && note.logId) {
    return note.commentId ? `/logs/${note.logId}?comment=${note.commentId}` : `/logs/${note.logId}`;
  }
  if (note.type === "like" && note.logId) return `/logs/${note.logId}`;
  if (note.fromUser?.username) return `/profile/${note.fromUser.username}`;
  return "/dashboard";
}

export function notificationText(note: NotificationItem): string {
  switch (note.type) {
    case "follow_request":
      if (note.followRequestState === "accepted") return "follow request accepted.";
      return "requested to follow you.";
    case "collaboration_request":
      return `sent you a collaboration request${note.listName ? ` for ${note.listName}` : ""}.`;
    case "post_like":
      return "liked your post.";
    case "post_save":
      return "saved your post.";
    case "post_comment":
      return "commented on your post.";
    case "comment_reply":
      return "replied to your comment.";
    case "like":
      return "liked your log.";
    case "share_reply":
      return note.shareTitle ? `replied to your share of ${note.shareTitle}.` : "replied to your share.";
    case "log_comment":
      return "commented on your log.";
    case "log_comment_reply":
      return "replied to your log comment.";
    case "log_comment_like":
      return "liked your log comment.";
    default:
      return "sent you a notification.";
  }
}

export function formatNotificationDate(dateString: string, includeTime = false): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, includeTime ? {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  } : {
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function removeNotification(userId: string, notificationId: string): Promise<void> {
  await remove(ref(db, `notifications/${userId}/${notificationId}`));
}

export async function clearAllNotifications(userId: string): Promise<void> {
  await remove(ref(db, `notifications/${userId}`));
}

export async function clearSelectedNotifications(userId: string, notificationIds: string[]): Promise<void> {
  await Promise.all(notificationIds.map((notificationId) => removeNotification(userId, notificationId)));
}

export async function acceptFollowRequest(
  userId: string,
  note: NotificationItem,
  options?: { keepNotification?: boolean }
): Promise<void> {
  const followRef = ref(db, `follows/${note.id}`);
  const followSnapshot = await get(followRef);
  if (followSnapshot.exists()) {
    await set(followRef, {
      ...followSnapshot.val(),
      status: "accepted",
    });
  }

  if (options?.keepNotification) {
    const notificationRef = ref(db, `notifications/${userId}/${note.id}`);
    const notificationSnapshot = await get(notificationRef);
    await set(
      notificationRef,
      stripUndefinedFields({
        ...(notificationSnapshot.exists() ? notificationSnapshot.val() : {}),
        ...note,
        followRequestState: "accepted",
        seen: true,
      })
    );
    return;
  }

  await removeNotification(userId, note.id);
}

export async function declineFollowRequest(userId: string, note: NotificationItem): Promise<void> {
  await Promise.all([
    remove(ref(db, `follows/${note.id}`)),
    removeNotification(userId, note.id),
  ]);
}

export async function sendFollowRequest(
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  targetUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  }
): Promise<void> {
  if (!fromUser || !targetUser || fromUser.id === targetUser.id) return;

  const followsRef = ref(db, "follows");
  const snapshot = await get(followsRef);

  if (snapshot.exists()) {
    const existingFollow = Object.values(snapshot.val() as Record<string, any>).find(
      (follow: any) =>
        follow?.follower_id === fromUser.id && follow?.following_id === targetUser.id
    );

    if (existingFollow) {
      return;
    }
  }

  const followId = `${fromUser.id}-${targetUser.id}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const newFollow = {
    id: followId,
    follower_id: fromUser.id,
    following_id: targetUser.id,
    status: "pending" as const,
    created_at: createdAt,
    createdAt,
  };

  await set(ref(db, `follows/${followId}`), newFollow);

  if (await shouldDeliverNotificationToUser(targetUser.id, "follow_request")) {
    await set(
      ref(db, `notifications/${targetUser.id}/${followId}`),
      stripUndefinedFields({
        type: "follow_request",
        seen: false,
        followRequestState: "pending",
        fromUser: {
          id: fromUser.id,
          username: fromUser.username,
          name: fromUser.name,
          avatar_url: fromUser.avatar_url || null,
        },
        created_at: createdAt,
        createdAt,
      })
    );
  }
}

export async function createFollowRequestNotification(
  userId: string,
  followId: string,
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  createdAt: string
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, "follow_request"))) return;

  await set(
    ref(db, `notifications/${userId}/${followId}`),
    stripUndefinedFields({
      type: "follow_request",
      seen: false,
      followRequestState: "pending",
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    })
  );
}

export function createNotificationFallbackUser(userId: string): User {
  return fallbackUser(userId);
}
