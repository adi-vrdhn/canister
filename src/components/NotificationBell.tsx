"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "@/types";
import { mergeSettings, shouldShowNotificationForSettings } from "@/lib/settings";
import {
  acceptFollowRequest as acceptFollowRequestAction,
  clearAllNotifications,
  declineFollowRequest as declineFollowRequestAction,
  formatNotificationDate,
  notificationHref,
  notificationText,
  parseNotificationItems,
  removeNotification,
  sendFollowRequest,
  sortNotificationItems,
  type NotificationItem,
} from "@/lib/notifications";

export default function NotificationBell({
  user,
  theme = "default",
}: {
  user: User | null;
  theme?: "default" | "brutalist";
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState(mergeSettings(null));
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isBrutalist = theme === "brutalist";

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

      setNotifications(sortNotificationItems(parseNotificationItems(snapshot.val())));
    });

    const userRef = ref(db, `users/${user.id}`);
    const unsubscribeSettings = onValue(userRef, (snapshot) => {
      setSettings(mergeSettings(snapshot.exists() ? snapshot.val()?.settings : null));
    });

    return () => {
      unsubscribe();
      unsubscribeSettings();
    };
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

  const visibleNotifications = notifications.filter((note) => shouldShowNotificationForSettings(settings, note.type));
  const latestCreatedAt = visibleNotifications[0]?.createdAt || "";
  const hasUnread =
    !!user &&
    !!latestCreatedAt &&
    typeof window !== "undefined" &&
    localStorage.getItem(`notif_seen_${user.id}`) !== latestCreatedAt;

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
    await clearAllNotifications(user.id);
    setOpen(false);
  };

  const acceptFollowRequest = async (note: NotificationItem) => {
    if (!user) return;
    await acceptFollowRequestAction(user.id, note, { keepNotification: true, actorUser: user });
  };

  const declineFollowRequest = async (note: NotificationItem) => {
    if (!user) return;
    await declineFollowRequestAction(user.id, note);
  };

  const followBack = async (note: NotificationItem) => {
    if (!user || !note.fromUser) return;
    await sendFollowRequest(user, note.fromUser);
  };

  if (!user) return null;

  return (
    <div ref={wrapperRef} className="absolute right-4 top-1/2 z-40 -translate-y-1/2 sm:right-6">
      <button
        type="button"
        onClick={openNotifications}
        className={`relative flex h-10 w-10 items-center justify-center transition ${
          isBrutalist ? "text-[#f5f0de] hover:text-[#ff7a1a]" : "text-slate-900 hover:text-[#f5f0de]"
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6" />
        {hasUnread && (
          <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${isBrutalist ? "bg-[#ff7a1a] ring-2 ring-[#0a0a0a]" : "bg-red-500 ring-2 ring-white"}`} />
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden border shadow-2xl ${isBrutalist ? "border-white/10 bg-[#0f0f0f] text-[#f5f0de]" : "rounded-[1.5rem] border-slate-200 bg-white"}`}>
          <div className={`flex items-center justify-between px-4 py-3 ${isBrutalist ? "border-b border-white/10" : "border-b border-slate-100"}`}>
            <div>
              <p className={`font-black ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>Notifications</p>
              <p className={`text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>{visibleNotifications.length} update{visibleNotifications.length === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`rounded-full p-2 ${isBrutalist ? "text-white/55 hover:bg-white/5 hover:text-[#f5f0de]" : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"}`}
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {visibleNotifications.length === 0 ? (
            <div className={`p-6 text-center text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>No notifications yet.</div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto p-2">
                {visibleNotifications.slice(0, 5).map((note) => {
                  const avatar = note.fromUser?.avatar_url ? (
                    <img
                      src={note.fromUser.avatar_url}
                      alt={note.fromUser.name}
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                      {note.fromUser?.name?.charAt(0)?.toUpperCase() || "N"}
                    </div>
                  );

                  const content = (
                    <>
                      {avatar}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-5 ${isBrutalist ? "text-[#f5f0de]/85" : "text-slate-700"}`}>
                          <span className={`font-black ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>{note.fromUser?.name || "Someone"}</span>{" "}
                          {notificationText(note)}
                        </p>
                        <p className={`mt-1 text-xs ${isBrutalist ? "text-white/40" : "text-slate-400"}`}>{formatNotificationDate(note.createdAt)}</p>
                      </div>
                    </>
                  );

                  if (note.type === "follow_request") {
                    return (
                      <div key={note.id} className={`p-3 transition ${isBrutalist ? "hover:bg-white/5" : "rounded-2xl hover:bg-slate-50"}`}>
                        <Link
                          href={notificationHref(note)}
                          onClick={() => setOpen(false)}
                          className="flex gap-3"
                        >
                          {content}
                        </Link>
                        <div className="mt-3 grid grid-cols-2 gap-2 pl-[3.25rem]">
                          {note.followRequestState === "accepted" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => followBack(note)}
                                className={`px-3 py-2 text-xs font-black transition ${isBrutalist ? "bg-[#f5f0de] text-[#0a0a0a] hover:bg-white" : "rounded-full bg-slate-950 text-white hover:bg-slate-800"}`}
                              >
                                Follow back
                              </button>
                              <button
                                type="button"
                                onClick={() => removeNotification(user.id, note.id)}
                                className={`px-3 py-2 text-xs font-black transition ${isBrutalist ? "bg-white/5 text-[#f5f0de] hover:bg-white/10" : "rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => acceptFollowRequest(note)}
                                className={`px-3 py-2 text-xs font-black transition ${isBrutalist ? "bg-[#f5f0de] text-[#0a0a0a] hover:bg-white" : "rounded-full bg-slate-950 text-white hover:bg-slate-800"}`}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => declineFollowRequest(note)}
                                className={`px-3 py-2 text-xs font-black transition ${isBrutalist ? "bg-white/5 text-[#f5f0de] hover:bg-white/10" : "rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={note.id}
                      href={notificationHref(note)}
                      onClick={() => setOpen(false)}
                      className={`flex gap-3 p-3 transition ${isBrutalist ? "hover:bg-white/5" : "rounded-2xl hover:bg-slate-50"}`}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
              <div className={`p-3 ${isBrutalist ? "border-t border-white/10" : "border-t border-slate-100"}`}>
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className={`mb-2 block w-full px-4 py-2 text-center text-sm font-bold transition ${
                    isBrutalist ? "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10" : "rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  View all notifications
                </Link>
                <button
                  type="button"
                  onClick={clearNotifications}
                  className={`w-full px-4 py-2 text-sm font-bold transition ${
                    isBrutalist ? "bg-[#f5f0de] text-[#0a0a0a] hover:bg-white" : "rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
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
