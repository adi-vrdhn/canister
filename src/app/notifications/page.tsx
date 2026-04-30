"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { Bell, Check, Trash2, X } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import type { User } from "@/types";
import {
  clearAllNotifications,
  clearSelectedNotifications,
  formatNotificationDate,
  notificationHref,
  notificationText,
  parseNotificationItems,
  followBackUser,
  sortNotificationItems,
  type NotificationItem,
} from "@/lib/notifications";

function avatarFallback(name?: string): string {
  return name?.charAt(0)?.toUpperCase() || "N";
}

type NotificationFilter = "all" | "requests" | "posts" | "shares" | "logs" | "matcher";

function getNotificationFilter(note: NotificationItem): Exclude<NotificationFilter, "all"> {
  if (note.type === "follow_request" || note.type === "collaboration_request") return "requests";
  if (note.type === "share_reply") return "shares";
  if (note.type === "matcher_update") return "matcher";
  if (note.type === "post_like" || note.type === "post_save" || note.type === "post_comment" || note.type === "comment_reply") return "posts";
  return "logs";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);

        let currentUser: User | null = null;

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          currentUser = {
            id: userData.id,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt,
          };
        } else {
          currentUser = {
            id: firebaseUser.uid,
            username: "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
          };
        }

        setUser(currentUser);

        const notificationsRef = ref(db, `notifications/${currentUser.id}`);
        unsubscribeNotifications = onValue(notificationsRef, (snapshot) => {
          if (!snapshot.exists()) {
            setNotifications([]);
            return;
          }

          setNotifications(sortNotificationItems(parseNotificationItems(snapshot.val())));
        });

        setLoading(false);
      } catch (error) {
        console.error("Error loading notifications page:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeNotifications?.();
      unsubscribe();
    };
  }, [router]);

  const filteredNotifications = useMemo(
    () =>
      activeFilter === "all"
        ? notifications
        : notifications.filter((note) => getNotificationFilter(note) === activeFilter),
    [activeFilter, notifications]
  );

  const handleDelete = async (noteId: string) => {
    if (!user) return;

    setBusyId(noteId);
    try {
      await clearSelectedNotifications(user.id, [noteId]);
    } catch (error) {
      console.error("Error deleting notification:", error);
    } finally {
      setBusyId(null);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    try {
      await clearAllNotifications(user.id);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const handleFollowBack = async (note: NotificationItem) => {
    if (!user || !note.fromUser) return;

    setBusyId(note.id);
    try {
      await followBackUser(user, note.fromUser);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === note.id ? { ...item, followedBack: true, followRequestState: "accepted" } : item
        )
      );
    } catch (error) {
      console.error("Error following back from notification:", error);
    } finally {
      setBusyId(null);
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

  if (loading || !user) {
    return <CinematicLoading message="Notifications are loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-[#ffb36b]">
              <Bell className="h-3.5 w-3.5" />
              Notifications
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#f5f0de] sm:text-4xl">
              Notifications
            </h1>
            <p className="mt-2 text-sm text-[#f5f0de]/60">
              Keep the feed clean, filter by type, and remove what you do not need.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#ffb36b] transition hover:text-[#ff7a1a]"
          >
            Clear all
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {([
            ["all", "All"],
            ["requests", "Requests"],
            ["posts", "Posts"],
            ["shares", "Shares"],
            ["logs", "Logs"],
            ["matcher", "Matcher"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                activeFilter === value
                  ? "bg-[#ff7a1a] text-black"
                  : "text-[#f5f0de]/55 hover:text-[#f5f0de]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-0 divide-y divide-white/10">
          {filteredNotifications.length === 0 ? (
            <p className="py-12 text-sm text-[#f5f0de]/55">No notifications in this filter.</p>
          ) : (
            filteredNotifications.map((note) => {
              const avatar = note.fromUser?.avatar_url ? (
                <img
                  src={note.fromUser.avatar_url}
                  alt={note.fromUser.name}
                  className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#f5f0de] text-sm font-black text-black">
                  {avatarFallback(note.fromUser?.name)}
                </div>
              );

              return (
                <article key={note.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <Link href={notificationHref(note)} className="flex min-w-0 items-start gap-3">
                    {avatar}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-[#f5f0de]">{note.fromUser?.name || "Someone"}</p>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffb36b]/70">
                          {getNotificationFilter(note)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#f5f0de]/75">{notificationText(note)}</p>
                      <p className="mt-1 text-xs text-[#f5f0de]/45">{formatNotificationDate(note.createdAt, true)}</p>
                      <span className="mt-2 inline-flex text-sm font-bold text-[#ffb36b] transition hover:text-[#ff7a1a]">
                        Open related item
                      </span>
                    </div>
                  </Link>

                  {note.type === "follow_request" && (
                    <div className="flex flex-wrap gap-3">
                      {note.followedBack ? (
                        <span className="inline-flex items-center gap-2 text-xs font-black text-[#ff7a1a]">
                          <Check className="h-3.5 w-3.5" />
                          Following
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleFollowBack(note)}
                            disabled={busyId === note.id}
                            className="inline-flex items-center gap-2 text-xs font-black text-[#ffb36b] transition hover:text-[#ff7a1a] disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Follow back
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            disabled={busyId === note.id}
                            className="inline-flex items-center gap-2 text-xs font-black text-[#f5f0de]/60 transition hover:text-[#f5f0de] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    disabled={busyId === note.id}
                    className="inline-flex items-center gap-2 self-start text-xs font-black text-[#f5f0de]/40 transition hover:text-[#f5f0de] disabled:opacity-50 sm:pt-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </article>
              );
            })
          )}
        </div>
      </div>
    </PageLayout>
  );
}
