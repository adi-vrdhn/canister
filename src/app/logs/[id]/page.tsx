"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { MovieLogWithContent, User, Content } from "@/types";
import { deleteMovieLog, updateMovieLog, getLogsForContent } from "@/lib/logs";
import { likeLog, unlikeLog, getLogLikes } from "@/lib/log-likes";
import { ref as dbRef, push as dbPush } from "firebase/database";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import { MoreVertical, ArrowLeft, Edit2, Trash2, ThumbsDown, Heart, Sparkles, CalendarDays } from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

export default function LogDetailPage() {
    const [userLogs, setUserLogs] = useState<MovieLogWithContent[]>([]);
    const [showUserLogs, setShowUserLogs] = useState(false);
  const router = useRouter();
  const params = useParams();
  const logId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [log, setLog] = useState<MovieLogWithContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingReaction, setEditingReaction] = useState<0|1|2>(1);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [reactionEdit, setReactionEdit] = useState<0|1|2|null>(null);
  const [reactionSaving, setReactionSaving] = useState(false);

  const getFallbackContent = (contentType: "movie" | "tv", contentId: number): Content => {
    if (contentType === "tv") {
      return {
        id: contentId,
        type: "tv",
        title: "Unknown Show",
        name: "Unknown Show",
        poster_url: null,
        genres: [],
        actors: [],
        language: null,
        status: null,
        release_date: null,
        overview: "Show details are unavailable right now.",
        runtime: null,
        rating: null,
        created_at: new Date().toISOString(),
      };
    }

    return {
      id: contentId,
      type: "movie",
      title: "Unknown Movie",
      poster_url: null,
      backdrop_url: null,
      genres: [],
      platforms: [],
      director: null,
      actors: [],
      language: null,
      release_date: null,
      overview: "Movie details are unavailable right now.",
      runtime: null,
      rating: null,
      created_at: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        // Fetch log by ID so friend logs are viewable too
        const logRef = ref(db, `movie_logs/${logId}`);
        const logSnapshot = await get(logRef);

        if (!logSnapshot.exists()) {
          router.push("/logs");
          return;
        }

        const logData = logSnapshot.val() || {};
        const contentType: "movie" | "tv" = logData.content_type === "tv" ? "tv" : "movie";
        const logContentId = Number(logData.content_id || 0);

        // Fetch content details
        const content =
          contentType === "tv"
            ? (await getShowDetails(logContentId)) || getFallbackContent("tv", logContentId)
            : (await getMovieDetails(logContentId)) || getFallbackContent("movie", logContentId);

        // Fetch log owner profile
        const ownerRef = ref(db, `users/${logData.user_id}`);
        const ownerSnapshot = await get(ownerRef);
        const ownerData = ownerSnapshot.val();

        const logOwner: User = {
          id: ownerData?.id || logData.user_id,
          username: ownerData?.username || "user",
          name: ownerData?.name || "User",
          avatar_url: ownerData?.avatar_url || null,
          created_at: ownerData?.createdAt || ownerData?.created_at || new Date().toISOString(),
        };

        const foundLog: MovieLogWithContent = {
          id: logId,
          ...logData,
          content_id: logContentId,
          content_type: contentType,
          watched_date: logData.watched_date || new Date().toISOString().slice(0, 10),
          reaction: typeof logData.reaction === "number" ? logData.reaction : 1,
          notes: logData.notes || "",
          created_at: logData.created_at || new Date().toISOString(),
          updated_at: logData.updated_at || new Date().toISOString(),
          content,
          user: logOwner,
        };

        setLog(foundLog);
        setEditingNotes(foundLog.notes || "");
        setEditingReaction(typeof foundLog.reaction === "number" ? foundLog.reaction : 1);

        // Fetch likes
        const likes = await getLogLikes(logId, currentUser.id);
        setLikeCount(likes.count);
        setLiked(likes.liked);


        // Fetch all logs for this user and this movie/show (full history, sorted by date desc)
        if (foundLog.content_id && foundLog.content_type && foundLog.user_id) {
          let logs = await getLogsForContent(Number(foundLog.content_id), foundLog.content_type, 100);
          // Only keep logs for the user whose log page this is
          logs = logs.filter(l => l.user_id === foundLog.user_id);
          // Sort by watched_date or created_at descending
          logs.sort((a, b) => {
            const dateA = new Date(a.watched_date || a.created_at).getTime();
            const dateB = new Date(b.watched_date || b.created_at).getTime();
            return dateB - dateA;
          });
          setUserLogs(logs);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading log:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [logId, router]);
  // Like/unlike handler (must be outside useEffect and only defined once)
  const handleLike = async () => {
    if (!user || !log) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikeLog(log.id, user.id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await likeLog(log.id, user.id);
        setLiked(true);
        setLikeCount((c) => c + 1);
        // Send notification to log owner if not self
        if (user.id !== log.user.id) {
          const notifRef = dbRef(db, `notifications/${log.user.id}`);
          await dbPush(notifRef, {
            type: "like",
            logId: log.id,
            fromUser: {
              id: user.id,
              username: user.username,
              name: user.name,
              avatar_url: user.avatar_url || null,
            },
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      alert("Failed to update like");
    }
    setLikeLoading(false);
  };

  // Reaction change handler
  // In edit mode, just update local state
  const handleReactionChange = (newReaction: 0|1|2) => {
    setEditingReaction(newReaction);
  };

  const handleDelete = async () => {
    if (!log || !user || log.user_id !== user.id) return;
    if (!confirm("Are you sure you want to delete this log?")) return;

    try {
      await deleteMovieLog(logId);
      router.push("/logs");
    } catch (error) {
      console.error("Error deleting log:", error);
      alert("Failed to delete log");
    }
  };

  const handleSaveEdit = async () => {
    if (!log || !user || log.user_id !== user.id) return;

    try {
      await updateMovieLog(logId, {
        notes: editingNotes,
        reaction: editingReaction,
      });

      // Update local state
      setLog({
        ...log,
        notes: editingNotes,
        reaction: editingReaction,
      });

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating log:", error);
      alert("Failed to update log");
    }
  };

  // Format date as '4th May 2026'
  const formatDate = (dateString?: string) => {
    if (!dateString || !dateString.includes("-")) return "Unknown date";
    const [year, month, day] = dateString.split("-");
    if (!year || !month || !day) return "Unknown date";
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    const dayNum = d.getDate();
    const daySuffix =
      dayNum % 10 === 1 && dayNum !== 11 ? "st" :
      dayNum % 10 === 2 && dayNum !== 12 ? "nd" :
      dayNum % 10 === 3 && dayNum !== 13 ? "rd" : "th";
    const monthName = d.toLocaleString("default", { month: "long" });
    return `${dayNum}${daySuffix} ${monthName} ${d.getFullYear()}`;
  };

  const getReactionDisplay = (reaction: 0 | 1 | 2) => {
    switch (reaction) {
      case 2:
        return {
          label: "Masterpiece",
          textClass: "text-emerald-300",
          badgeClass: "bg-emerald-500/15 border-emerald-400/30",
          icon: Sparkles,
        };
      case 1:
        return {
          label: "Good",
          textClass: "text-sky-300",
          badgeClass: "bg-sky-500/15 border-sky-400/30",
          icon: Heart,
        };
      case 0:
      default:
        return {
          label: "Bad",
          textClass: "text-rose-300",
          badgeClass: "bg-rose-500/15 border-rose-400/30",
          icon: ThumbsDown,
        };
    }
  };

  const isUnavailableContent =
    log?.content.title === "Unknown Movie" || log?.content.title === "Unknown Show";

  if (loading || !user) {
    return <CinematicLoading message="Your log details are loading" />;
  }

  if (!log) {
    return (
      <PageLayout user={user} onSignOut={() => router.push("/auth/login")}>
        <div className="p-8 text-center">
          <p className="text-gray-600">Log not found</p>
          <Link href="/logs" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to logs
          </Link>
        </div>
      </PageLayout>
    );
  }

  const isOwnLog = log.user_id === user.id;

  return (
    <PageLayout user={user} onSignOut={() => router.push("/auth/login")}>
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-black text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          {/* Menu (owner only) */}
          {isOwnLog && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Open log menu"
                title="Open log menu"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 bg-neutral-900 border border-white/10 rounded-lg shadow-lg z-10 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-left text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Movie Info */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 sm:p-6">
          <div className="flex gap-5 sm:gap-6">
            {log.content.poster_url && (
              <Link
                href={log.content_type === "tv" ? `/tv/${log.content_id}` : `/movie/${log.content_id}`}
                className="block w-32 h-48 rounded-xl overflow-hidden border border-white/10 shadow-xl shrink-0 hover:scale-[1.02] transition-transform"
              >
                <img
                  src={log.content.poster_url}
                  alt={log.content.title}
                  className="w-full h-full object-cover"
                />
              </Link>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight mb-2">{log.content.title}</h1>
              {isUnavailableContent && (
                <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Details unavailable
                </span>
              )}
              <p className="text-white/70 mb-4 line-clamp-4">{log.content.overview}</p>
              <Link
                href={log.content_type === "tv" ? `/tv/${log.content_id}` : `/movie/${log.content_id}`}
                className="inline-flex text-sm text-white/80 hover:text-white underline underline-offset-4"
              >
                Open {log.content_type === "tv" ? "show" : "movie"} page
              </Link>

              {/* Watched Date */}
              <div className="mt-4 mb-4 flex items-center gap-2 text-sm text-white/70">
                <CalendarDays className="w-4 h-4" />
                <span>
                  Watched on {formatDate(log.watched_date)}
                </span>
              </div>

              {/* Mood */}
              {log.mood && (
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-white/10 border border-white/15 text-white/85 rounded-full text-sm">
                    {log.mood}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Rating, Notes, and Like */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">
              {isOwnLog ? "Your Review" : `${log.user.name}'s Review`}
            </h2>
            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={`flex items-center gap-1 px-3 py-1 rounded-full border border-white/15 text-sm font-medium transition-colors ${liked ? "bg-pink-600/20 text-pink-300 border-pink-400/30" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
              aria-label={liked ? "Unlike" : "Like"}
              title={liked ? "Unlike" : "Like"}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-pink-400" : ""}`} />
              <span>{likeCount}</span>
            </button>
          </div>

          {/* Reaction Edit (owner only, only in edit mode) */}
          {isOwnLog && isEditing && (
            <div className="mb-4 flex gap-2 items-center">
              <span className="text-white/70">Change reaction:</span>
              {[{label: "Bad", value: 0}, {label: "Good", value: 1}, {label: "Masterpiece", value: 2}].map(opt => (
                <button
                  key={opt.value}
                  disabled={reactionSaving}
                  onClick={() => handleReactionChange(opt.value as 0|1|2)}
                  className={`px-3 py-1 rounded-full border text-sm font-medium transition-colors ${editingReaction === opt.value ? "bg-blue-600/30 border-blue-400/30 text-blue-200" : "bg-white/10 border-white/15 text-white/70 hover:bg-white/20"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {isOwnLog && isEditing ? (
            <div className="space-y-4">
              {/* Edit Notes */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white/85">Notes</label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-white/15 bg-black/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="Write your notes about this log"
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingNotes(log.notes);
                  }}
                  className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Reaction Display */}
              <div className="mb-6">
                {(() => {
                  const reaction = getReactionDisplay(log.reaction as 0 | 1 | 2);
                  const ReactionIcon = reaction.icon;
                  return (
                    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${reaction.badgeClass}`}>
                      <ReactionIcon className={`w-4 h-4 ${reaction.textClass}`} />
                      <span className={`text-sm font-semibold ${reaction.textClass}`}>{reaction.label}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Notes Display */}
              {log.notes && (
                <div>
                  <p className="text-sm text-white/65 mb-2">Notes</p>
                  <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{log.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Context Log */}
        {log.context_log && (
          <div className="rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-md mb-8">
            <h3 className="text-lg font-bold mb-4">Context Log</h3>
            <div className="space-y-3">
              {log.context_log.location && (
                <div>
                  <p className="text-sm text-white/65 font-medium">Where</p>
                  <p className="text-white/90">{log.context_log.location}</p>
                </div>
              )}

              {log.context_log.watched_with && (
                <div>
                  <p className="text-sm text-white/65 font-medium">With Whom</p>
                  <p className="text-white/90">{log.context_log.watched_with}</p>
                </div>
              )}

              {log.context_log.mood && (
                <div>
                  <p className="text-sm text-white/65 font-medium">Mood</p>
                  <p className="text-white/90">{log.context_log.mood}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Log History for this user and movie/show */}
        {userLogs.length > 1 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 mb-6">
            <button
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition mb-4"
              onClick={() => setShowUserLogs((v) => !v)}
            >
              {showUserLogs ? "Hide log history" : `Show log history (${userLogs.length})`}
            </button>
            {showUserLogs && (
              <div className="divide-y divide-white/10">
                {userLogs.map((l) => {
                  const reaction = getReactionDisplay(l.reaction as 0 | 1 | 2);
                  return (
                    <div key={l.id} className="flex items-center gap-4 py-4">
                      <div className="flex flex-col items-center cursor-pointer" onClick={() => router.push(`/logs/${l.id}`)} title={`View this log`}>
                        <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border block ${reaction.badgeClass}`}>{reaction.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white/90 cursor-pointer hover:underline" onClick={() => router.push(`/logs/${l.id}`)}>
                          {formatDate(l.watched_date)}
                        </span>
                        {l.notes && (
                          <p className="text-white/80 mt-1 line-clamp-3">{l.notes}</p>
                        )}
                      </div>
                      <button
                        className="ml-2 px-3 py-1 rounded border border-white/20 text-xs text-white/70 hover:bg-white/10"
                        onClick={() => router.push(`/logs/${l.id}`)}
                      >
                        View Log
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </PageLayout>
  );
}
