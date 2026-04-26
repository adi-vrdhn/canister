"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { User, MovieLogWithContent, Content } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserMovieLogs, deleteMovieLog } from "@/lib/logs";
import { buildLogUrl } from "@/lib/log-url";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import LogMovieModal from "@/components/LogMovieModal";
import {
  Loader2,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
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
  if (log.reaction === 2) return "border border-orange-500/35 bg-orange-500/12 text-orange-200";
  if (log.reaction === 1) return "border border-white/10 bg-white/5 text-[#f5f0de]";
  return "border border-white/10 bg-white/5 text-white/65";
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

function formatShortLogDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return `${day} ${month} '${year}`;
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
      className="group grid w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-2.5 text-left sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-4"
    >
      <div className="relative flex flex-col items-center justify-center text-[#ff7a1a]">
        <span className="text-2xl font-black leading-none tracking-tight sm:text-3xl">
          {getDayDD(log.watched_date)}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffb36b]/75 sm:text-xs">
          {new Date(`${log.watched_date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}
        </span>
      </div>

      <div className="rounded-[1.35rem] border border-white/10 bg-[#111111] p-2.5 shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_45px_rgba(0,0,0,0.28)] sm:rounded-[1.5rem] sm:p-3">
        <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-sm">
            {log.content.poster_url ? (
              <img
                src={log.content.poster_url}
                alt={log.content.title}
                className="h-[4.3rem] w-full object-cover sm:h-[5rem]"
              />
            ) : (
              <div className="flex h-[4.3rem] w-full items-center justify-center px-1 text-center text-[9px] text-white/45 sm:h-[5rem]">
                No image
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-[#f5f0de] sm:text-sm">
              {log.content.title}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-medium text-white/60 sm:text-xs">
              Watched {formatWatchedDate(log.watched_date)}
            </p>
            {isUnavailableContent(log) && (
              <span className="mt-2 inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200">
                Details unavailable
              </span>
            )}

            <div className="mt-1 flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${getReactionClasses(log)}`}>
                {getReactionLabel(log)}
              </span>
              <span className="text-[10px] font-semibold text-white/45 transition group-hover:text-[#ffb36b] sm:hidden">
                Details
              </span>
            </div>
          </div>

          <div className="hidden justify-end sm:flex">
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs font-semibold text-white/45 transition group-hover:border-orange-500/30 group-hover:text-[#ffb36b]">
              Details
            </span>
          </div>
        </div>
      </div>
    </button>
  );
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
  const [logSearchQuery, setLogSearchQuery] = useState("");

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

  const visibleLogs = useMemo(() => {
    const normalized = logSearchQuery.trim().toLowerCase();
    if (!normalized) return displayLogs;

    return displayLogs.filter((log) => {
      const title = log.content.title.toLowerCase();
      const notes = (log.notes || "").toLowerCase();
      const type = log.content_type === "tv" ? "tv show" : "movie";
      return title.includes(normalized) || notes.includes(normalized) || type.includes(normalized);
    });
  }, [displayLogs, logSearchQuery]);

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

    if (queryText.trim().length < 1) {
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
      router.push(buildLogUrl(log));
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
    return <CinematicLoading message="Movie logs are loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="brutalist mx-auto max-w-6xl space-y-5 px-1 pb-8 sm:space-y-6 sm:p-8">
        <div className="flex flex-col gap-1 px-2 pt-2 sm:px-0 sm:pt-0">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/75">
            Watch Diary
          </p>
          <h1 className="text-2xl font-black leading-tight text-[#f5f0de] sm:text-3xl">
            {isOwner ? "Your Logs" : `${profileUser.name}'s Logs`}
          </h1>
          <p className="text-sm text-white/55">
            Month view calendar + day-based log history
          </p>
        </div>

        <div className="flex flex-row items-center gap-3">
          {isOwner && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSearchModal(true);
              }}
              className="action-primary flex basis-[30%] min-w-0 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-semibold sm:px-4"
            >
              <Plus className="h-5 w-5" />
              Log
            </button>
          )}

          <div className={`relative min-w-0 ${isOwner ? "basis-[70%]" : "w-full"}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Search logged movies & TV shows"
              className="field w-full rounded-full py-3 pl-10 pr-4 text-sm"
            />
          </div>
        </div>

        <div className="space-y-0">
          <div className="flex items-center justify-between px-3 py-2.5 sm:px-5 sm:py-3">
            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-full border border-white/10 bg-white/5 p-1.5 text-[#f5f0de] shadow-sm transition hover:bg-white/10 sm:p-2"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <div className="min-w-0 text-center">
              <h2 className="text-2xl font-black uppercase leading-none tracking-normal text-[#f5f0de] sm:text-4xl">
                {formatMonthTitle(currentMonth)}
              </h2>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-[#ffb36b] sm:text-[10px]">
                {currentMonth.getFullYear()}
              </p>
            </div>

            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-full border border-white/10 bg-white/5 p-1.5 text-[#f5f0de] shadow-sm transition hover:bg-white/10 sm:p-2"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-y border-white/10 bg-white/[0.02]">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-white/10 py-2 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#ffb36b]/80 last:border-r-0 sm:text-xs"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 bg-[#111111]">
            {calendarCells.map((cell) => {
              if (!cell.inMonth || !cell.date) {
                return <div key={cell.key} className="min-h-[6.25rem] border-b border-r border-white/10 bg-white/[0.02] sm:min-h-[9rem]" />;
              }

              const day = cell.date.getDate();
              const dayKey = cell.key;
              const dayLogsInCell = (logsByDate.get(dayKey) || []).slice().sort(compareLogsDesc);
              const isSelected = selectedDay === dayKey;
              const visibleStackCount = Math.min(dayLogsInCell.length, 3);
              const stackOffsetPx = dayLogsInCell.length > 1 ? 6 : 0;
              const stackHeightOffsetPx = (visibleStackCount - 1) * stackOffsetPx;

              return (
                <button
                  key={cell.key}
                  onClick={() => {
                    setListMode("month");
                    setSelectedDay((prev) => (prev === dayKey ? null : dayKey));
                    scrollToListSection();
                  }}
                  className={`group relative min-h-[6.25rem] overflow-hidden border-b border-r border-white/10 text-left transition sm:min-h-[9rem] ${
                    isSelected
                      ? "bg-orange-500/10 shadow-[inset_0_0_0_2px_rgba(255,122,26,0.55)]"
                      : dayLogsInCell.length > 0
                      ? "bg-[#101010] hover:bg-white/[0.03]"
                      : "bg-[#0f0f0f] hover:bg-white/[0.03]"
                  }`}
                >
                  {dayLogsInCell.length > 0 ? (
                    <div className="absolute inset-0">
                      <div className="relative flex h-full w-full items-center justify-center">
                        {dayLogsInCell.slice(0, 3).map((log, idx) =>
                          log.content.poster_url ? (
                            <img
                              key={log.id}
                              src={log.content.poster_url}
                              alt={log.content.title}
                              className={`absolute h-full w-full object-cover shadow-[0_8px_18px_rgba(15,23,42,0.22)] transition duration-200 group-hover:-translate-y-0.5 ${getPosterStackClass(idx)}`}
                              style={{
                                height: `calc(100% - ${stackHeightOffsetPx}px)`,
                                left: 0,
                                top: idx * stackOffsetPx,
                                width: "100%",
                                zIndex: 10 + idx,
                              }}
                            />
                          ) : (
                            <div
                              key={log.id}
                              className={`absolute flex h-full w-full items-center justify-center bg-slate-100 px-1 text-center text-[8px] font-bold text-slate-400 shadow-[0_8px_18px_rgba(15,23,42,0.16)] sm:text-[10px] ${getPosterStackClass(idx)}`}
                              style={{
                                height: `calc(100% - ${stackHeightOffsetPx}px)`,
                                left: 0,
                                top: idx * stackOffsetPx,
                                width: "100%",
                                zIndex: 10 + idx,
                              }}
                            >
                              No poster
                            </div>
                          )
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-2 z-40 flex justify-center sm:bottom-3">
                        <span
                          className={`rounded-full bg-[#ff7a1a] px-1.5 py-0.5 font-black leading-none text-black shadow-sm ${
                            dayLogsInCell.length === 1 ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs"
                          }`}
                        >
                          {dayLogsInCell.length}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`absolute left-1.5 top-1.5 z-20 text-[11px] font-black sm:left-2.5 sm:top-2.5 sm:text-sm ${
                          isSelected ? "text-[#ffb36b]" : "text-[#ff7a1a]"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden h-px bg-white/10 sm:block" />
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={listSectionRef}
          className="relative -mx-1 scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-[#2a2a2a]/95 via-[#1f1f1f]/95 to-[#141414]/95 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.24)] sm:-mx-2 sm:p-4"
        >
          <div className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-56 h-48 w-48 rounded-full bg-white/4 blur-3xl" />
          <div className="relative mb-3 flex flex-col items-center gap-2.5 text-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/75">Watch Diary</p>
              <h3 className="mt-0.5 text-xl font-black leading-tight text-[#f5f0de] sm:text-2xl">
                {listMode === "all"
                  ? "All Months"
                  : selectedDay
                    ? `Logs for ${formatShortLogDate(selectedDay)}`
                    : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setListMode("month")}
                className={`rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${
                  listMode === "month"
                    ? "bg-[#ff7a1a] text-black shadow-sm"
                    : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => {
                  setListMode("all");
                  setSelectedDay(null);
                }}
                className={`rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${
                  listMode === "all"
                    ? "bg-[#ff7a1a] text-black shadow-sm"
                    : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                All
              </button>
            </div>
          </div>

          {visibleLogs.length > 0 ? (
            listMode === "all" ? (
              <div className="relative space-y-7">
                {groupLogsByMonth(visibleLogs).map((group) => (
                  <div key={group.month}>
                    <h4 className="mb-3 text-center text-sm font-black uppercase tracking-[0.18em] text-[#ffb36b]/70">
                      {group.month}
                    </h4>
                    <div className="space-y-3">
                      {group.logs.map((log) => (
                        <LogCard key={log.id} log={log} onOpen={handleOpenLogDetails} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative space-y-3">
                {visibleLogs.map((log) => (
                  <LogCard key={log.id} log={log} onOpen={handleOpenLogDetails} />
                ))}
              </div>
            )
          ) : (
            <div className="relative py-10 text-center text-white/55">
              {logSearchQuery.trim()
                ? "No logged movies or TV shows match your search."
                : "No logs for this selection."}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#111111] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#111111] p-5">
              <h3 className="text-xl font-bold text-[#f5f0de]">Log Details</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setActiveLog(null);
                }}
                className="text-white/55 hover:text-[#f5f0de]"
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
                  <p className="text-2xl font-bold text-[#f5f0de]">{activeLog.content.title}</p>
                  {isUnavailableContent(activeLog) && (
                    <span className="mt-2 inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200">
                      Details unavailable
                    </span>
                  )}
                  <p className="mt-1 text-sm text-white/60">Watched on {formatWatchedDate(activeLog.watched_date)}</p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${getReactionClasses(activeLog)}`}>
                    {getReactionLabel(activeLog)}
                  </span>
                </div>
              </div>

              {activeLog.notes && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[#f5f0de]">Review</p>
                  <p className="whitespace-pre-wrap rounded-[1.1rem] border border-white/10 bg-white/5 p-3 text-sm text-[#f5f0de]/85">
                    {activeLog.notes}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {activeLog.mood && (
                  <div className="rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-xs text-[#ffb36b]/75">Mood</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.mood}</p>
                  </div>
                )}

                {activeLog.context_log?.location && (
                  <div className="rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-xs text-[#ffb36b]/75">Location</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.context_log.location}</p>
                  </div>
                )}

                {activeLog.context_log?.watched_with && (
                  <div className="rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-xs text-[#ffb36b]/75">Watched With</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.context_log.watched_with}</p>
                  </div>
                )}

                {activeLog.context_log?.mood && (
                  <div className="rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-xs text-[#ffb36b]/75">Context Mood</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.context_log.mood}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-white/10 bg-[#111111] p-5">
              <button
                onClick={() => router.push(buildLogUrl(activeLog))}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[#f5f0de] hover:bg-white/5"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDeleteLog}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2 text-black disabled:opacity-60"
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
