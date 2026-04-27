"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Film,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserMovieLogs } from "@/lib/logs";
import { getUserByUsername } from "@/lib/profile";
import type { MovieLogWithContent, User } from "@/types";

type ListMode = "month" | "all";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWatchedDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getDayDD(dateStr: string): string {
  const day = dateStr.split("-")[2] || "01";
  return day.padStart(2, "0");
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = monthStart(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

function isSameMonth(dateStr: string, monthRef: Date): boolean {
  const [year, month] = dateStr.split("-").map((value) => parseInt(value, 10));
  return year === monthRef.getFullYear() && month === monthRef.getMonth() + 1;
}

function compareLogsDesc(a: MovieLogWithContent, b: MovieLogWithContent): number {
  const aTime = new Date(`${a.watched_date}T00:00:00`).getTime();
  const bTime = new Date(`${b.watched_date}T00:00:00`).getTime();
  if (aTime !== bTime) return bTime - aTime;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function groupLogsByMonth(logsToGroup: MovieLogWithContent[]): Array<{ month: string; logs: MovieLogWithContent[] }> {
  const monthMap = new Map<string, MovieLogWithContent[]>();

  for (const log of logsToGroup) {
    const [year, month] = log.watched_date.split("-");
    const monthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
    const monthLabel = formatMonthTitle(monthDate);

    if (!monthMap.has(monthLabel)) {
      monthMap.set(monthLabel, []);
    }
    monthMap.get(monthLabel)!.push(log);
  }

  const result: Array<{ month: string; logs: MovieLogWithContent[] }> = [];
  for (const [month, logs] of monthMap) {
    logs.sort(compareLogsDesc);
    result.push({ month, logs });
  }

  result.sort((a, b) => {
    const aDate = new Date(`${a.logs[0].watched_date}T00:00:00`);
    const bDate = new Date(`${b.logs[0].watched_date}T00:00:00`);
    return bDate.getTime() - aDate.getTime();
  });

  return result;
}

function getReactionLabel(log: MovieLogWithContent): string {
  if (log.reaction === 2) return "Masterpiece";
  if (log.reaction === 1) return "Good";
  return "Bad";
}

function getReactionClasses(log: MovieLogWithContent): string {
  if (log.reaction === 2) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (log.reaction === 1) return "bg-sky-50 text-[#f5f0de] border border-sky-200";
  return "bg-rose-50 text-rose-700 border border-rose-200";
}

function isUnavailableContent(log: MovieLogWithContent): boolean {
  return log.content.title === "Unknown Movie" || log.content.title === "Unknown Show";
}

export default function PublicUserLogsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const reactionFilter = searchParams.get("reaction");
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<MovieLogWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ListMode>("month");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        hardRedirect("/auth/login");
        return;
      }

      try {
        const currentUserRef = ref(db, `users/${firebaseUser.uid}`);
        const currentUserSnapshot = await get(currentUserRef);
        const currentUserData = currentUserSnapshot.val();

        const user: User = {
          id: currentUserData?.id || firebaseUser.uid,
          username: currentUserData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: currentUserData?.name || firebaseUser.displayName || "User",
          email: currentUserData?.email || firebaseUser.email || undefined,
          avatar_url: currentUserData?.avatar_url || null,
          created_at: currentUserData?.createdAt || new Date().toISOString(),
          bio: currentUserData?.bio || "",
        };

        setCurrentUser(user);

        const profile = await getUserByUsername(username);
        if (!profile) {
          hardRedirect("/dashboard");
          return;
        }

        const userLogs = await getUserMovieLogs(profile.id, 500);
        const filtered = userLogs
          .filter((log) => !log.watch_later && Boolean(log.watched_date))
          .sort(compareLogsDesc);

        setProfileUser(profile);
        setLogs(filtered);
        setLoading(false);
      } catch (error) {
        console.error("Error loading public user logs:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username]);

  const filteredLogs = useMemo(() => {
    if (!reactionFilter || !["0", "1", "2"].includes(reactionFilter)) {
      return logs;
    }
    return logs.filter((log) => String(log.reaction) === reactionFilter);
  }, [logs, reactionFilter]);

  const displayName = profileUser?.name || profileUser?.username || "User";
  const pageTitle =
    reactionFilter === "2"
      ? `${displayName}'s Masterpiece Logs`
      : reactionFilter === "1"
        ? `${displayName}'s Good Logs`
        : reactionFilter === "0"
          ? `${displayName}'s Bad Logs`
          : `${displayName}'s Logs`;

  const logsByDate = useMemo(() => {
    const map = new Map<string, MovieLogWithContent[]>();
    for (const log of filteredLogs) {
      const bucket = map.get(log.watched_date) || [];
      bucket.push(log);
      map.set(log.watched_date, bucket);
    }
    for (const [, bucket] of map) {
      bucket.sort(compareLogsDesc);
    }
    return map;
  }, [filteredLogs]);

  const monthLogs = useMemo(() => {
    return filteredLogs.filter((log) => isSameMonth(log.watched_date, currentMonth));
  }, [filteredLogs, currentMonth]);

  const dayLogs = useMemo(() => {
    if (!selectedDay) return [] as MovieLogWithContent[];
    return (logsByDate.get(selectedDay) || []).slice().sort(compareLogsDesc);
  }, [logsByDate, selectedDay]);

  const displayLogs = useMemo(() => {
    if (listMode === "all") {
      return filteredLogs.slice().sort(compareLogsDesc);
    }
    if (selectedDay) {
      return dayLogs;
    }
    return monthLogs.slice().sort(compareLogsDesc);
  }, [listMode, filteredLogs, monthLogs, selectedDay, dayLogs]);

  const calendarCells = useMemo(() => {
    const { start, end } = getMonthRange(currentMonth);
    const firstWeekdayIndex = (start.getDay() + 6) % 7;
    const totalDays = end.getDate();

    const cells: Array<{ date: Date | null; key: string; inMonth: boolean }> = [];

    for (let i = 0; i < firstWeekdayIndex; i += 1) {
      cells.push({ date: null, key: `blank-start-${i}`, inMonth: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, key, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const idx = cells.length;
      cells.push({ date: null, key: `blank-end-${idx}`, inMonth: false });
    }

    return cells;
  }, [currentMonth]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      hardRedirect("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const scrollToListSection = () => {
    window.requestAnimationFrame(() => {
      listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (loading || !currentUser || !profileUser) {
    return <CinematicLoading message="Movie logs are loading" />;
  }

  return (
    <PageLayout user={currentUser} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/profile/${profileUser.username}`}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </div>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            {profileUser.avatar_url ? (
              <img
                src={profileUser.avatar_url}
                alt={profileUser.name}
                className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 text-2xl font-semibold text-white sm:h-24 sm:w-24 sm:text-3xl">
                {profileUser.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <Film className="h-5 w-5 text-zinc-700" />
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{pageTitle}</h1>
              </div>
              <p className="mt-1 text-sm text-zinc-500 sm:text-base">@{profileUser.username}</p>
              <p className="mt-2 text-sm text-zinc-600">
                <span className="font-semibold text-zinc-800">Viewing</span> {filteredLogs.length} logs
              </p>
            </div>
          </div>
        </section>

        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setSelectedDay(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }}
              className="rounded-lg p-2 transition hover:bg-gray-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>

            <h2 className="text-lg font-bold text-gray-900">{formatMonthTitle(currentMonth)}</h2>

            <button
              onClick={() => {
                setSelectedDay(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }}
              className="rounded-lg p-2 transition hover:bg-gray-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1 text-center text-xs font-semibold text-gray-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              if (!cell.inMonth || !cell.date) {
                return <div key={cell.key} className="[aspect-ratio:2/3] rounded-lg bg-gray-50" />;
              }

              const day = cell.date.getDate();
              const dayKey = cell.key;
              const dayLogsInCell = (logsByDate.get(dayKey) || []).slice().sort(compareLogsDesc);
              const isSelected = selectedDay === dayKey;

              return (
                <button
                  key={cell.key}
                  onClick={() => {
                    setListMode("month");
                    setSelectedDay((prev) => (prev === dayKey ? null : dayKey));
                    scrollToListSection();
                  }}
                  className={`relative overflow-hidden rounded-lg border p-0.5 text-left transition-colors [aspect-ratio:2/3] ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : dayLogsInCell.length > 0
                        ? "border-gray-300 bg-white hover:bg-gray-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {dayLogsInCell.length > 0 ? (
                    <div className="relative flex h-full w-full items-center justify-center">
                      {dayLogsInCell.slice(0, 3).map((log, idx) => (
                        <img
                          key={log.id}
                          src={log.content.poster_url || undefined}
                          alt={log.content.title}
                          className={`absolute h-full w-full rounded object-cover border border-white shadow ${idx === 0 ? "" : idx === 1 ? "translate-x-1 translate-y-1" : "translate-x-2 translate-y-2"}`}
                          style={{
                            zIndex: 10 + idx,
                          }}
                        />
                      ))}

                      {dayLogsInCell.length > 1 && (
                        <span className="absolute left-1 top-1 z-30 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                          {dayLogsInCell.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-start justify-start p-1">
                      <span className="text-[10px] font-semibold text-gray-400">{day}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={listSectionRef} className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-900">
                {listMode === "all"
                  ? "All Movies"
                  : selectedDay
                    ? `Logs for ${formatWatchedDate(selectedDay)}`
                    : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3>
            </div>

            <div className="inline-flex rounded-lg border border-gray-300 p-1">
              <button
                onClick={() => setListMode("month")}
                className={`rounded-md px-3 py-1 text-sm ${
                  listMode === "month" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => {
                  setListMode("all");
                  setSelectedDay(null);
                }}
                className={`rounded-md px-3 py-1 text-sm ${
                  listMode === "all" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                All
              </button>
            </div>
          </div>

          {displayLogs.length > 0 ? (
            listMode === "all" ? (
              <div className="space-y-6">
                {groupLogsByMonth(displayLogs).map((group) => (
                  <div key={group.month}>
                    <h4 className="mb-3 text-lg font-bold text-gray-900">{group.month}</h4>
                    <div className="space-y-3">
                      {group.logs.map((log) => (
                        <Link
                          key={log.id}
                          href={log.content_type === "movie" ? `/movie/${log.content_id}` : `/tv/${log.content_id}`}
                          className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 flex-shrink-0 text-center">
                              <span className="text-xl font-bold text-gray-900">{getDayDD(log.watched_date)}</span>
                            </div>

                            <img
                              src={log.content.poster_url || undefined}
                              alt={log.content.title}
                              className="h-20 w-14 flex-shrink-0 rounded border border-gray-200 object-cover"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-gray-900">{log.content.title}</p>
                              {isUnavailableContent(log) && (
                                <span className="mt-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                  Details unavailable
                                </span>
                              )}
                            </div>

                            <span
                              className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium ${getReactionClasses(log)}`}
                            >
                              {getReactionLabel(log)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {displayLogs.map((log) => (
                  <Link
                    key={log.id}
                    href={log.content_type === "movie" ? `/movie/${log.content_id}` : `/tv/${log.content_id}`}
                    className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 flex-shrink-0 text-center">
                        <span className="text-xl font-bold text-gray-900">{getDayDD(log.watched_date)}</span>
                      </div>

                      <img
                        src={log.content.poster_url || undefined}
                        alt={log.content.title}
                        className="h-20 w-14 flex-shrink-0 rounded border border-gray-200 object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{log.content.title}</p>
                        {isUnavailableContent(log) && (
                          <span className="mt-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Details unavailable
                          </span>
                        )}
                      </div>

                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium ${getReactionClasses(log)}`}
                      >
                        {getReactionLabel(log)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="py-10 text-center text-gray-500">
              No logs for this selection.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-dashed border-gray-200 bg-white/60 p-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Calendar and list view for {profileUser.name}'s logged movies.</span>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
