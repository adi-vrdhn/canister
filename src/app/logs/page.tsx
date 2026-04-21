"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import LogMovieModal from "@/components/LogMovieModal";
import CinematicLoading from "@/components/CinematicLoading";
import { User, MovieLogWithContent, Content } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { deleteMovieLog, getUserMovieLogs } from "@/lib/logs";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

type ListMode = "month" | "all";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getPosterStackClass(index: number): string {
  return `poster-stack-${index}`;
}

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
  
  // Sort by date descending
  for (const [month, logs] of monthMap) {
    logs.sort(compareLogsDesc);
    result.push({ month, logs });
  }
  
  // Sort months by date descending
  result.sort((a, b) => {
    const aDate = new Date(a.logs[0].watched_date);
    const bDate = new Date(b.logs[0].watched_date);
    return bDate.getTime() - aDate.getTime();
  });
  
  return result;
}

function LogCard({
  log,
  onOpen,
}: {
  log: MovieLogWithContent;
  onOpen: (log: MovieLogWithContent) => void;
}) {
  return (
    <button
      onClick={() => onOpen(log)}
      className="group w-full rounded-3xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:rounded-2xl sm:p-4"
    >
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3rem_3.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="relative row-span-2 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm sm:row-span-1 sm:rounded-lg">
          {log.content.poster_url ? (
            <img
              src={log.content.poster_url}
              alt={log.content.title}
              className="aspect-[2/3] w-full object-cover sm:h-20 sm:w-14"
            />
          ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center px-2 text-center text-xs text-gray-500 sm:h-20 sm:w-14">
              No image
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-gray-900 shadow-sm sm:hidden">
            {getDayDD(log.watched_date)}
          </span>
        </div>

        <div className="hidden w-12 text-center sm:block">
          <span className="text-xl font-bold text-gray-900">{getDayDD(log.watched_date)}</span>
        </div>

        <div className="min-w-0 self-start sm:self-center">
          <p className="line-clamp-2 text-base font-bold leading-snug text-gray-950 sm:truncate sm:text-sm">
            {log.content.title}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 sm:hidden">
            Watched {formatWatchedDate(log.watched_date)}
          </p>
          {isUnavailableContent(log) && (
            <span className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Details unavailable
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:justify-end sm:self-center">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold sm:px-2 ${getReactionClasses(log)}`}>
            {getReactionLabel(log)}
          </span>
          <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 transition group-hover:border-blue-200 group-hover:text-blue-700 sm:hidden">
            Details
          </span>
        </div>
      </div>
    </button>
  );
}

export default function LogsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
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
  const [listMode, setListMode] = useState<ListMode>("month");

  const [activeLog, setActiveLog] = useState<MovieLogWithContent | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
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

        const userLogs = await getUserMovieLogs(currentUser.id, 500);
        const filtered = userLogs
          .filter((log) => !log.watch_later && Boolean(log.watched_date))
          .sort(compareLogsDesc);
        setLogs(filtered);

        setLoading(false);
      } catch (error) {
        console.error("Error loading logs:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    setSelectedDay(null);
    if (listMode !== "all") {
      setListMode("month");
    }
  }, [currentMonth, listMode]);

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

      const movies = searchMode === "tv" ? [] : await searchMovies(queryText);
      const shows = searchMode === "movie" ? [] : await searchShows(queryText);

      const movieResults = movies.map((movie) => ({
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

      const showResults = shows.map((show) => ({
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
    if (!user) return;
    try {
      const userLogs = await getUserMovieLogs(user.id, 500);
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
    router.push(`/logs/${log.id}`);
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

  if (loading || !user) {
    return <CinematicLoading message="Your movie logs are loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-6xl space-y-5 px-1 pb-8 sm:space-y-6 sm:p-8">
        <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:bg-transparent sm:p-0 sm:shadow-none sm:border-0">
          <button
            onClick={() => {
              setSearchQuery("");
              setSearchResults([]);
              setShowSearchModal(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto sm:rounded-lg sm:py-2 sm:font-medium"
          >
            <Plus className="w-5 h-5" />
            Log Movie
          </button>
        </div>

        <div className="rounded-[2rem] border border-gray-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="mb-2 flex items-center justify-between sm:mb-4">
            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-xl border border-gray-200 bg-gray-50 p-1.5 hover:bg-gray-100 sm:rounded-lg sm:border-0 sm:bg-transparent sm:p-2"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 text-gray-700 sm:h-5 sm:w-5" />
            </button>

            <h2 className="text-base font-bold tracking-tight text-gray-900 sm:text-lg">{formatMonthTitle(currentMonth)}</h2>

            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-xl border border-gray-200 bg-gray-50 p-1.5 hover:bg-gray-100 sm:rounded-lg sm:border-0 sm:bg-transparent sm:p-2"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 text-gray-700 sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 sm:mb-2 sm:gap-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1 text-center text-[10px] font-bold text-gray-500 sm:text-xs">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
            {calendarCells.map((cell) => {
              if (!cell.inMonth || !cell.date) {
                return <div key={cell.key} className="aspect-[3/4] rounded-lg bg-gray-50 sm:aspect-[2/3] sm:rounded-lg" />;
              }

              const day = cell.date.getDate();
              const dayKey = cell.key;
              // Sort logs so the most recent is first
              const dayLogsInCell = (logsByDate.get(dayKey) || []).slice().sort(compareLogsDesc);
              const isSelected = selectedDay === dayKey;

              // Show stack of up to 3 posters per day with animation, and always show the badge
              return (
                <button
                  key={cell.key}
                  onClick={() => {
                    setListMode("month");
                    setSelectedDay((prev) => (prev === dayKey ? null : dayKey));
                    scrollToListSection();
                  }}
                  className={`relative overflow-hidden rounded-lg border p-0.5 text-left [aspect-ratio:3/4] transition-colors sm:rounded-lg sm:[aspect-ratio:2/3] ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
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
                          className={`h-full w-full rounded object-cover border border-white shadow absolute ${getPosterStackClass(idx)}`}
                          style={{
                            zIndex: 10 + idx,
                          }}
                        />
                      ))}
                      {/* Show badge only if more than one movie watched */}
                      {dayLogsInCell.length > 1 && (
                        <span className="absolute left-1 top-1 z-30 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow sm:px-2 sm:text-xs">
                          {dayLogsInCell.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-start justify-start p-1">
                      <span className="text-[10px] font-semibold text-gray-400 sm:text-xs">{day}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={listSectionRef} className="scroll-mt-24 rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Clock3 className="mt-1 h-4 w-4 flex-shrink-0 text-gray-600" />
              <h3 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-lg sm:font-bold">
                {listMode === "all"
                  ? "All Movies"
                  : selectedDay
                  ? `Logs for ${selectedDay}`
                  : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3>
            </div>

            <div className="grid w-full grid-cols-2 rounded-2xl border border-gray-300 bg-gray-50 p-1 sm:inline-flex sm:w-auto sm:rounded-lg sm:bg-white">
              <button
                onClick={() => setListMode("month")}
                className={`rounded-xl px-3 py-2 text-sm font-semibold sm:rounded-md sm:py-1 ${
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
                className={`rounded-xl px-3 py-2 text-sm font-semibold sm:rounded-md sm:py-1 ${
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
                        <LogCard
                          key={log.id}
                          log={log}
                          onOpen={handleOpenLogDetails}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Regular list for "Month" mode
              <div className="space-y-3">
                {displayLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    onOpen={handleOpenLogDetails}
                  />
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

      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Search & Log Movie</h2>
              <button
                onClick={() => setShowSearchModal(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                aria-label="Close search modal"
                title="Close search modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 p-4 sm:p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search movies & shows..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  autoFocus
                  className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 sm:rounded-lg"
                />
              </div>
            </div>

            {searchResults.length > 0 && (
              <>
                <div className="sticky top-0 flex gap-2 overflow-x-auto border-b border-gray-200 bg-white p-4">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchFilter("movie")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "movie"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setSearchFilter("tv")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "tv"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    TV Shows
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {filteredSearchResults.map((result) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelectContent(result)}
                        className="flex cursor-pointer items-center gap-3 border-b border-gray-100 p-4 transition-colors last:border-b-0 hover:bg-gray-100"
                      >
                        {result.poster_url ? (
                          <img src={result.poster_url} alt={result.title} className="h-20 w-14 rounded-xl object-cover sm:h-16 sm:w-12 sm:rounded" />
                        ) : (
                          <div className="flex h-20 w-14 items-center justify-center rounded-xl bg-gray-200 text-xs text-gray-500 sm:h-16 sm:w-12 sm:rounded">
                            No Image
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="line-clamp-2 font-semibold text-gray-900">{result.title}</h3>
                          <p className="text-sm text-gray-600">{result.type === "tv" ? "TV Show" : "Movie"}</p>
                        </div>
                      </div>
                    ))}

                  {filteredSearchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                    <div className="p-10 text-center text-gray-500">
                      No {searchFilter === "tv" ? "TV shows" : searchFilter === "movie" ? "movies" : "results"} found.
                    </div>
                  )}
                </div>
              </>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No results found</p>
              </div>
            )}

            {searching && (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              </div>
            )}
          </div>
        </div>
      )}

      {selectedContent && user && (
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

      {showDetailsModal && activeLog && (
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
