"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { onValue, ref, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "@/types";

type NotificationType =
  | "follow_request"
  | "collaboration_request"
  | "post_like"
  | "post_save"
  | "post_comment"
  | "comment_reply"
  | "like";

type NotificationItem = {
  id: string;
  type: NotificationType;
  fromUser?: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  };
  createdAt: string;
  ref_id?: string;
  listId?: string;
  listName?: string;
  logId?: string;
};

function notificationHref(note: NotificationItem): string {
  if (note.type === "collaboration_request" && note.listId) return `/lists/${note.listId}`;
  if ((note.type === "post_like" || note.type === "post_save" || note.type === "post_comment" || note.type === "comment_reply") && note.ref_id) {
    return `/posts/${note.ref_id}`;
  }
  if (note.type === "like" && note.logId) return `/logs/${note.logId}`;
  if (note.fromUser?.username) return `/profile/${note.fromUser.username}`;
  return "/dashboard";
}

function notificationText(note: NotificationItem): string {
  switch (note.type) {
    case "follow_request":
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
    default:
      return "sent you a notification.";
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationBell({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const notificationsRef = ref(db, `notifications/${user.id}`);
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setNotifications([]);
        return;
      }

      const rows = Object.entries(snapshot.val()).map(([id, raw]: any) => ({
        id,
        type: raw.type,
        fromUser: raw.fromUser,
        createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
        ref_id: raw.ref_id,
        listId: raw.listId,
        listName: raw.listName,
        logId: raw.logId,
      })) as NotificationItem[];

      setNotifications(
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const latestCreatedAt = notifications[0]?.createdAt || "";
  const hasUnread = useMemo(() => {
    if (!user || !latestCreatedAt) return false;
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`notif_seen_${user.id}`) !== latestCreatedAt;
  }, [latestCreatedAt, user]);

  const openNotifications = () => {
    setOpen((current) => {
      const next = !current;
      if (next && user && latestCreatedAt && typeof window !== "undefined") {
        localStorage.setItem(`notif_seen_${user.id}`, latestCreatedAt);
      }
      return next;
    });
  };

  const clearNotifications = async () => {
    if (!user) return;
    await remove(ref(db, `notifications/${user.id}`));
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div ref={wrapperRef} className="absolute right-4 top-1/2 z-40 -translate-y-1/2 sm:right-6">
      <button
        type="button"
        onClick={openNotifications}
        className="relative flex h-10 w-10 items-center justify-center text-slate-900 transition hover:text-blue-600"
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6" />
        {hasUnread && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-black text-slate-950">Notifications</p>
              <p className="text-xs text-slate-500">{notifications.length} update{notifications.length === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No notifications yet.</div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto p-2">
                {notifications.map((note) => (
                  <Link
                    key={note.id}
                    href={notificationHref(note)}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 rounded-2xl p-3 transition hover:bg-slate-50"
                  >
                    {note.fromUser?.avatar_url ? (
                      <img
                        src={note.fromUser.avatar_url}
                        alt={note.fromUser.name}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                        {note.fromUser?.name?.charAt(0)?.toUpperCase() || "N"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-5 text-slate-700">
                        <span className="font-black text-slate-950">{note.fromUser?.name || "Someone"}</span>{" "}
                        {notificationText(note)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(note.createdAt)}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  Clear notifications
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
