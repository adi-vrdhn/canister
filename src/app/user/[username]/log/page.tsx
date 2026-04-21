"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User, MovieLogWithContent, Content } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserMovieLogs, deleteMovieLog } from "@/lib/logs";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import LogMovieModal from "@/components/LogMovieModal";
import {
  Loader2,
  Calendar,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Clock3,
} from "lucide-react";

type ListMode = "month" | "all";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getReactionLabel(log: MovieLogWithContent): string {
  if (log.reaction === 2) return "Masterpiece";
  if (log.reaction === 1) return "Good";
  return "Bad";
}

function getReactionClasses(log: MovieLogWithContent): string {
  if (log.reaction === 2) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (log.reaction === 1) return "bg-sky-50 text-sky-700 border border-sky-200";
  return "bg-rose-50 text-rose-700 border border-rose-200";
}

function isUnavailableContent(log: MovieLogWithContent): boolean {
  return log.content.title === "Unknown Movie" || log.content.title === "Unknown Show";
}

function dateKeyFromLog(log: MovieLogWithContent): string {
  return log.watched_date;
}

function getDayDD(dateStr: string): string {
  const day = dateStr.split("-")[2] || "01";
  return day.padStart(2, "0");
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

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = monthStart(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

function isSameMonth(dateStr: string, monthRef: Date): boolean {
  const [y, m] = dateStr.split("-").map((v) => parseInt(v, 10));
  return y === monthRef.getFullYear() && m === monthRef.getMonth() + 1;
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
    const monthDate = new Date(parseInt(year), parseInt(month) - 1);
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
    const aDate = new Date(a.logs[0].watched_date);
    const bDate = new Date(b.logs[0].watched_date);
    return bDate.getTime() - aDate.getTime();
  });

  return result;
}


export default function UserLogPage() {
  const router = useRouter();
  const params = useParams();
  const usernameParam = params.username as string;

  const [user, setUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<MovieLogWithContent[]>([]);

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "movie" | "tv">("all");

  const [currentMonth, setCurrentMonth] = useState<Date>(monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [listMode, setListMode] = useState<"month" | "all">("month");

  const [activeLog, setActiveLog] = useState<MovieLogWithContent | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  // Determine if the logged-in user is the owner
  const isOwner = user && profileUser && user.username === profileUser.username;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      // Get logged-in user
      const userRef = ref(db, `users/${firebaseUser.uid}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();
      const currentUser: User = {
        id: userData?.id || firebaseUser.uid,
        username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
        name: userData?.name || firebaseUser.displayName || "User",
        avatar_url: userData?.avatar_url || null,
        created_at: userData?.createdAt || new Date().toISOString(),
      };
      setUser(currentUser);

      // Get profile user by username
      let profileUserData = null;
      // Try to find user by username
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const users = usersSnapshot.val() || {};
      for (const key in users) {
        if (users[key].username === usernameParam) {
          profileUserData = users[key];
          break;
        }
      }
      if (!profileUserData) {
        router.push("/404");
        return;
      }
      setProfileUser(profileUserData);

      // Fetch logs for the profile user
      const userLogs = await getUserMovieLogs(profileUserData.id, 500);
      const filtered = userLogs
        .filter((log) => !log.watch_later && Boolean(log.watched_date))
        .sort(compareLogsDesc);
      setLogs(filtered);

      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, usernameParam]);

  useEffect(() => {
    setSelectedDay(null);
    if (listMode !== "all") {
      setListMode("month");
    }
  }, [currentMonth]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, MovieLogWithContent[]>();
    for (const log of logs) {
      const key = dateKeyFromLog(log);
      const bucket = map.get(key) || [];
      bucket.push(log);
      map.set(key, bucket);
    }
    for (const [, bucket] of map) {
      bucket.sort(compareLogsDesc);
    }
    return map;
  }, [logs]);

  const monthLogs = useMemo(() => {
    return logs.filter((log) => isSameMonth(log.watched_date, currentMonth));
  }, [logs, currentMonth]);

  const dayLogs = useMemo(() => {
    if (!selectedDay) return [] as MovieLogWithContent[];
    return (logsByDate.get(selectedDay) || []).slice().sort(compareLogsDesc);
  }, [logsByDate, selectedDay]);

  const displayLogs = useMemo(() => {
    if (listMode === "all") {
      return logs.slice().sort(compareLogsDesc);
    }
    if (selectedDay) {
      return dayLogs;
    }
    return monthLogs.slice().sort(compareLogsDesc);
  }, [listMode, logs, monthLogs, selectedDay, dayLogs]);

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
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSearch = async (queryText: string) => {
    setSearchQuery(queryText);

    if (queryText.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const searchMode = searchFilter;

      const [movies, shows] = await Promise.all([
        searchMode === "tv" ? Promise.resolve([]) : searchMovies(queryText),
        searchMode === "movie" ? Promise.resolve([]) : searchShows(queryText),
      ]);

      const movieResults = movies.map((movie: any) => ({
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        genres: (movie.genres || []).map((genreId: number) => String(genreId)),
        release_date: movie.release_date || "",
        overview: movie.overview || "",
        runtime: movie.runtime || 0,
        rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
        type: "movie" as const,
        platforms: [],
        director: null,
        created_at: new Date().toISOString(),
      }));

      const showResults = shows.map((show: any) => ({
        id: show.id,
        title: show.name || show.title || "",
        name: show.name,
        poster_url: show.poster_url || null,
        genres: show.genres || [],
        release_date: show.release_date || "",
        overview: show.overview || "",
        runtime: show.runtime || 0,
        rating: typeof show.rating === "number" ? show.rating : 0,
        type: "tv" as const,
        status: show.status || null,
        network: undefined,
        created_at: new Date().toISOString(),
      }));

      setSearchResults([...movieResults, ...showResults].slice(0, 20));
      setShowSearchModal(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (showSearchModal && searchQuery.trim().length >= 2) {
      void handleSearch(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilter]);

  const handleSelectContent = (content: Content) => {
    setSelectedContent(content);
    setShowSearchModal(false);
    setShowLogModal(true);
  };

  const handleRefreshLogs = async () => {
    if (!profileUser) return;
    try {
      const userLogs = await getUserMovieLogs(profileUser.id, 500);
      const filtered = userLogs
        .filter((log) => !log.watch_later && Boolean(log.watched_date))
        .sort(compareLogsDesc);
      setLogs(filtered);
    } catch (error) {
      console.error("Error refreshing logs:", error);
    }
  };

  const filteredSearchResults = useMemo(() => {
    return searchResults.filter((result) => searchFilter === "all" || result.type === searchFilter);
  }, [searchFilter, searchResults]);

  const handleOpenLogDetails = (log: MovieLogWithContent) => {
    // Only allow editing if owner
    if (isOwner) {
      router.push(`/logs/${log.id}`);
    }
  };

  const scrollToListSection = () => {
    window.requestAnimationFrame(() => {
      listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleDeleteLog = async () => {
    if (!activeLog) return;
    const ok = window.confirm("Delete this log permanently?");
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteMovieLog(activeLog.id);
      await handleRefreshLogs();
      setShowDetailsModal(false);
      setActiveLog(null);
    } catch (error) {
      console.error("Delete log error:", error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !profileUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{isOwner ? "Your Logs" : `${profileUser.name}'s Logs`}</h1>
            <p className="text-gray-600">Month view calendar + day-based log history</p>
          </div>
          {isOwner && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSearchModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Log Movie
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>

            <h2 className="text-lg font-bold text-gray-900">{formatMonthTitle(currentMonth)}</h2>

            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-xs font-semibold text-gray-500 text-center py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              if (!cell.inMonth || !cell.date) {
                return <div key={cell.key} className="aspect-poster rounded-lg bg-gray-50" />;
              }

              const day = cell.date.getDate();
              const dayKey = cell.key;
              // Sort logs so the most recent is first
              const dayLogsInCell = (logsByDate.get(dayKey) || []).slice().sort(compareLogsDesc);
              const isSelected = selectedDay === dayKey;

              // Show stack of up to 3 posters per day
              return (
                <button
                  key={cell.key}
                  onClick={() => {
                    setListMode("month");
                    setSelectedDay((prev) => (prev === dayKey ? null : dayKey));
                    scrollToListSection();
                  }}
                  className={`[aspect-ratio:2/3] rounded-lg border p-0.5 text-left relative overflow-hidden transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : dayLogsInCell.length > 0
                      ? "border-gray-300 bg-white hover:bg-gray-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {dayLogsInCell.length > 0 ? (
                    <div className="h-full w-full flex items-center justify-center relative">
                      {dayLogsInCell.slice(0, 3).map((log, idx) => (
                        <img
                          key={log.id}
                          src={log.content.poster_url || undefined}
                          alt={log.content.title}
                          className={`h-full w-full rounded object-cover border border-white shadow absolute poster-stack-${idx}`}
                        />
                      ))}
                      {/* Show badge only if more than one movie watched */}
                      {dayLogsInCell.length > 1 && (
                        <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow z-30">
                          {dayLogsInCell.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-start justify-start p-1">
                      <span className="text-[10px] font-semibold text-gray-400">{day}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={listSectionRef} className="bg-white border border-gray-200 rounded-2xl p-5 scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-900">
                {listMode === "all"
                  ? "All Movies"
                  : selectedDay
                  ? `Logs for ${selectedDay}`
                  : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3>
            </div>

            <div className="inline-flex rounded-lg border border-gray-300 p-1">
              <button
                onClick={() => setListMode("month")}
                className={`px-3 py-1 text-sm rounded-md ${
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
                className={`px-3 py-1 text-sm rounded-md ${
                  listMode === "all" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                All
              </button>
            </div>
          </div>

          {displayLogs.length > 0 ? (
            listMode === "all" ? (
              // Grouped by month for "All" mode
              <div className="space-y-6">
                {groupLogsByMonth(displayLogs).map((group) => (
                  <div key={group.month}>
                    <h4 className="text-lg font-bold text-gray-900 mb-3">{group.month}</h4>
                    <div className="space-y-3">
                      {group.logs.map((log) => (
                        <button
                          key={log.id}
                          onClick={() => handleOpenLogDetails(log)}
                          className={`w-full text-left border border-gray-200 rounded-lg p-4 ${isOwner ? "hover:bg-gray-50 transition-colors" : "cursor-default"}`}
                          disabled={!isOwner}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 text-center flex-shrink-0">
                              <span className="text-xl font-bold text-gray-900">{getDayDD(log.watched_date)}</span>
                            </div>

                            <img
                              src={log.content.poster_url || undefined}
                              alt={log.content.title}
                              className="w-14 h-20 rounded object-cover flex-shrink-0 border border-gray-200"
                            />

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{log.content.title}</p>
                              {isUnavailableContent(log) && (
                                <span className="mt-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                  Details unavailable
                                </span>
                              )}
                            </div>

                            <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${getReactionClasses(log)}`}>
                              {getReactionLabel(log)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Regular list for "Month" mode
              <div className="space-y-3">
                {displayLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => handleOpenLogDetails(log)}
                    className={`w-full text-left border border-gray-200 rounded-lg p-4 ${isOwner ? "hover:bg-gray-50 transition-colors" : "cursor-default"}`}
                    disabled={!isOwner}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 text-center flex-shrink-0">
                        <span className="text-xl font-bold text-gray-900">{getDayDD(log.watched_date)}</span>
                      </div>

                      <img
                        src={log.content.poster_url || undefined}
                        alt={log.content.title}
                        className="w-14 h-20 rounded object-cover flex-shrink-0 border border-gray-200"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{log.content.title}</p>
                        {isUnavailableContent(log) && (
                          <span className="mt-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Details unavailable
                          </span>
                        )}
                      </div>

                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${getReactionClasses(log)}`}>
                        {getReactionLabel(log)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="py-10 text-center text-gray-500">
              No logs for this selection.
            </div>
          )}
        </div>
      </div>

      {/* Only owner can log or edit/delete logs */}
      {isOwner && selectedContent && user && (
        <LogMovieModal
          isOpen={showLogModal}
          onClose={() => {
            setShowLogModal(false);
            setSelectedContent(null);
          }}
          content={selectedContent}
          user={user}
          onLogCreated={() => {
            setShowLogModal(false);
            setSelectedContent(null);
            handleRefreshLogs();
          }}
        />
      )}

      {/* Only owner can see details modal and delete */}
      {isOwner && showDetailsModal && activeLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">Log Details</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setActiveLog(null);
                }}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close log details"
                title="Close log details"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex gap-4">
                <img
                  src={activeLog.content.poster_url || undefined}
                  alt={activeLog.content.title}
                  className="w-24 h-36 rounded object-cover"
                />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{activeLog.content.title}</p>
                  {isUnavailableContent(activeLog) && (
                    <span className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Details unavailable
                    </span>
                  )}
                  <p className="text-sm text-gray-600 mt-1">Watched on {formatWatchedDate(activeLog.watched_date)}</p>
                  <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${getReactionClasses(activeLog)}`}>
                    {getReactionLabel(activeLog)}
                  </span>
                </div>
              </div>

              {activeLog.notes && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Review</p>
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap">
                    {activeLog.notes}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {activeLog.mood && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Mood</p>
                    <p className="text-sm font-medium text-gray-900">{activeLog.mood}</p>
                  </div>
                )}

                {activeLog.context_log?.location && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-gray-900">{activeLog.context_log.location}</p>
                  </div>
                )}

                {activeLog.context_log?.watched_with && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Watched With</p>
                    <p className="text-sm font-medium text-gray-900">{activeLog.context_log.watched_with}</p>
                  </div>
                )}

                {activeLog.context_log?.mood && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Context Mood</p>
                    <p className="text-sm font-medium text-gray-900">{activeLog.context_log.mood}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 p-5 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => router.push(`/logs/${activeLog.id}`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDeleteLog}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
