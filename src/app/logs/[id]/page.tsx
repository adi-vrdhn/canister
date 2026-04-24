"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { MovieLogWithContent, User, Content, LogCommentWithUser } from "@/types";
import { deleteMovieLog, updateMovieLog, getLogsForContent } from "@/lib/logs";
import { likeLog, unlikeLog, getLogLikes } from "@/lib/log-likes";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import {
  MoreVertical,
  ArrowLeft,
  Edit2,
  Trash2,
  ThumbsDown,
  Heart,
  Sparkles,
  CalendarDays,
  X,
  MessageCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { ref, get, ref as dbRef, push as dbPush } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import {
  createLogComment,
  getLogComments,
  getLogCommentLikers,
  likeLogComment,
  unlikeLogComment,
} from "@/lib/log-comments";

function relativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-blue-600 underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function Avatar({ user }: { user: User }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.name} className="h-10 w-10 rounded-full object-cover" />;
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
      {user.name?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
}

function PeopleModal({
  title,
  users,
  loading,
  onClose,
}: {
  title: string;
  users: User[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/25 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">No one here yet.</p>
        ) : (
          <div className="space-y-2">
            {users.map((person) => (
              <Link
                key={person.id}
                href={`/profile/${person.username || person.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-slate-50"
              >
                <Avatar user={person} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{person.name}</p>
                  <p className="truncate text-xs text-slate-500">@{person.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function sortLogCommentTree(comments: LogCommentWithUser[], mode: "top" | "newest"): LogCommentWithUser[] {
  return comments
    .map((comment) => ({
      ...comment,
      replies: sortLogCommentTree(comment.replies, mode),
    }))
    .sort((a, b) => {
      if (mode === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (b.insightScore !== a.insightScore) return b.insightScore - a.insightScore;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function CommentThread({
  comment,
  currentUser,
  logOwnerId,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  submitting,
  highlightedCommentId,
  onReply,
  onToggleLike,
  onOpenLikers,
  onJumpToProfile,
}: {
  comment: LogCommentWithUser;
  currentUser: User | null;
  logOwnerId: string;
  replyingTo: string | null;
  replyText: string;
  setReplyingTo: (commentId: string | null) => void;
  setReplyText: (value: string) => void;
  submitting: boolean;
  highlightedCommentId: string | null;
  onReply: (parentId: string, ownerId: string) => Promise<void>;
  onToggleLike: (comment: LogCommentWithUser) => Promise<void>;
  onOpenLikers: (commentId: string) => Promise<void>;
  onJumpToProfile: (user: User) => string;
}) {
  const highlighted = highlightedCommentId === comment.id;
  return (
    <div
      id={`log-comment-${comment.id}`}
      className={`py-4 transition ${
        highlighted ? "rounded-none bg-blue-50/50 ring-1 ring-blue-200" : ""
      }`}
    >
      <div className="flex gap-3">
        <Link href={onJumpToProfile(comment.user)} className="flex-shrink-0">
          {comment.user.avatar_url ? (
            <img
              src={comment.user.avatar_url}
              alt={comment.user.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
              {comment.user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={onJumpToProfile(comment.user)} className="text-sm font-black text-slate-950 hover:text-blue-600">
              {comment.user.name}
            </Link>
            <span className="text-xs text-slate-400">{relativeTime(comment.created_at)}</span>
            {comment.user_id === logOwnerId && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                owner
              </span>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{linkify(comment.content)}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-black">
            <button
              type="button"
              onClick={() => onToggleLike(comment)}
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 transition ${
                comment.liked_by_current_user ? "text-rose-600" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${comment.liked_by_current_user ? "fill-rose-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => onOpenLikers(comment.id)}
              disabled={comment.likes_count === 0}
              className="text-slate-500 hover:text-slate-900 disabled:cursor-default disabled:text-slate-300"
            >
              {comment.likes_count}
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(replyingTo === comment.id ? null : comment.id);
                  setReplyText("");
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                Reply{comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}
              </button>
            )}
          </div>
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="mt-3 flex gap-2 pl-12">
          <input
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={`Reply to ${comment.user.name}`}
            className="min-w-0 flex-1 border-b border-slate-200 bg-transparent px-0 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500"
          />
          <button
            type="button"
            disabled={submitting || replyText.trim().length < 2}
            onClick={() => onReply(comment.id, comment.user_id)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
            Reply
          </button>
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="ml-5 mt-3 space-y-1 border-l border-slate-200 pl-4 sm:ml-6 sm:pl-6">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUser={currentUser}
              logOwnerId={logOwnerId}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyingTo={setReplyingTo}
              setReplyText={setReplyText}
              submitting={submitting}
              highlightedCommentId={highlightedCommentId}
              onReply={onReply}
              onToggleLike={onToggleLike}
              onOpenLikers={onOpenLikers}
              onJumpToProfile={onJumpToProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LogDetailPage() {
    const [userLogs, setUserLogs] = useState<MovieLogWithContent[]>([]);
    const [showUserLogs, setShowUserLogs] = useState(false);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const logId = params.id as string;
  const targetCommentId = searchParams.get("comment") || "";
  const scrollTargetRef = useRef<string | null>(null);

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
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likers, setLikers] = useState<User[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [reactionSaving, setReactionSaving] = useState(false);
  const [comments, setComments] = useState<LogCommentWithUser[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSort, setCommentSort] = useState<"top" | "newest">("top");
  const [showCommentLikesModal, setShowCommentLikesModal] = useState(false);
  const [commentLikers, setCommentLikers] = useState<User[]>([]);
  const [commentLikersLoading, setCommentLikersLoading] = useState(false);
  const [commentLikesTitle, setCommentLikesTitle] = useState("");
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [commentLikeLoadingId, setCommentLikeLoadingId] = useState<string | null>(null);

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

        const logComments = await getLogComments(logId, currentUser.id);
        setComments(logComments);
        setCommentsLoading(false);

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
        setCommentsLoading(false);
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

  const handleOpenLikes = async () => {
    if (!log) return;
    setShowLikesModal(true);
    setLikersLoading(true);
    try {
      const likesRef = ref(db, `log_likes/${log.id}`);
      const likesSnapshot = await get(likesRef);
      const userIds = likesSnapshot.exists() ? Object.keys(likesSnapshot.val() || {}) : [];
      if (userIds.length === 0) {
        setLikers([]);
        return;
      }

      const usersSnapshot = await get(ref(db, "users"));
      const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};
      const nextLikers = userIds
        .map((id) => {
          const raw = usersData[id];
          if (!raw) return null;
          return {
            id: raw.id || id,
            username: raw.username || "user",
            name: raw.name || "User",
            avatar_url: raw.avatar_url || null,
            created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
          } as User;
        })
        .filter(Boolean) as User[];
      setLikers(nextLikers);
    } catch (error) {
      console.error("Error loading log likes:", error);
      setLikers([]);
    } finally {
      setLikersLoading(false);
    }
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
          textClass: "text-emerald-700",
          badgeClass: "bg-emerald-50 border-emerald-200",
          icon: Sparkles,
        };
      case 1:
        return {
          label: "Good",
          textClass: "text-sky-700",
          badgeClass: "bg-sky-50 border-sky-200",
          icon: Heart,
        };
      case 0:
      default:
        return {
          label: "Bad",
          textClass: "text-rose-700",
          badgeClass: "bg-rose-50 border-rose-200",
          icon: ThumbsDown,
        };
    }
  };

  const profileHref = (person: User) => `/profile/${person.username || person.id}`;

  const refreshComments = async () => {
    if (!user) return;
    setCommentsLoading(true);
    try {
      const logComments = await getLogComments(logId, user.id);
      setComments(logComments);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user || !log || commentText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createLogComment(log.id, log.user_id, user, commentText);
      setCommentText("");
      await refreshComments();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = async (parentId: string, ownerId: string) => {
    if (!user || !log || replyText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createLogComment(log.id, log.user_id, user, replyText, parentId, ownerId);
      setReplyText("");
      setReplyingTo(null);
      await refreshComments();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleCommentLike = async (comment: LogCommentWithUser) => {
    if (!user || !log) return;
    try {
      setCommentLikeLoadingId(comment.id);
      if (comment.liked_by_current_user) {
        await unlikeLogComment(log.id, comment.id, user.id);
      } else {
        await likeLogComment(log.id, comment.id, user.id);
      }
      await refreshComments();
    } finally {
      setCommentLikeLoadingId(null);
    }
  };

  const handleOpenCommentLikes = async (commentId: string) => {
    if (!log) return;
    setCommentLikesTitle("Likes");
    setCommentLikers([]);
    setCommentLikersLoading(true);
    setShowCommentLikesModal(true);
    try {
      const users = await getLogCommentLikers(log.id, commentId);
      setCommentLikers(users);
      setCommentLikesTitle(users.length === 1 ? "1 like" : `${users.length} likes`);
    } finally {
      setCommentLikersLoading(false);
    }
  };

  const releaseYear = log?.content.release_date ? new Date(log.content.release_date).getFullYear() : null;
  const sortedComments = useMemo(() => sortLogCommentTree(comments, commentSort), [comments, commentSort]);

  useEffect(() => {
    if (!targetCommentId || commentsLoading) return;

    const targetElement = document.getElementById(`log-comment-${targetCommentId}`);
    if (!targetElement) return;
    if (scrollTargetRef.current === targetCommentId) return;

    scrollTargetRef.current = targetCommentId;
    setHighlightedCommentId(targetCommentId);
    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = window.setTimeout(() => {
      setHighlightedCommentId((current) => (current === targetCommentId ? null : current));
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [targetCommentId, commentsLoading, sortedComments.length]);

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
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-950"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          {/* Menu (owner only) */}
          {isOwnLog && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                aria-label="Open log menu"
                title="Open log menu"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <div className="absolute right-0 z-10 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-rose-600 transition-colors hover:bg-rose-50"
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
        <div className="mb-8">
          <div className="flex gap-4 sm:gap-5">
            {log.content.poster_url && (
              <Link
                href={log.content_type === "tv" ? `/tv/${log.content_id}` : `/movie/${log.content_id}`}
                className="block w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 shadow-sm sm:w-28"
                title={`Open ${log.content.title}`}
              >
                <img
                  src={log.content.poster_url}
                  alt={log.content.title}
                  className="aspect-[2/3] w-full object-cover"
                />
              </Link>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{log.content.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:text-sm">
                {releaseYear && <span>{releaseYear}</span>}
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Watched {formatDate(log.watched_date)}
                </span>
              </div>
              {log.content.genres?.length ? (
                <p className="mt-3 text-xs text-slate-600 sm:text-sm">
                  <span className="font-semibold text-slate-500">Genres:</span>{" "}
                  {log.content.genres.slice(0, 4).join(" • ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Review */}
        <div
          className={`mb-8 border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${
            log.reaction === 2
              ? "shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_18px_40px_rgba(16,185,129,0.14)]"
              : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              {isOwnLog ? "Your review" : `${log.user.name}'s review`}
            </h2>
            {(() => {
              const reaction = getReactionDisplay(log.reaction as 0 | 1 | 2);
              const reactionLabel = (
                <span className={reaction.textClass}>{reaction.label}</span>
              );
              return (
                <span
                  className={`inline-flex items-center gap-2 border px-3 py-1 text-sm font-bold ${reaction.badgeClass}`}
                >
                  {reactionLabel}
                </span>
              );
            })()}
          </div>

          {isOwnLog && isEditing ? (
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Review</label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="field min-h-28 resize-none py-3"
                  placeholder="Write your review"
                  rows={4}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingNotes(log.notes);
                  }}
                  className="rounded-none border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-none bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 whitespace-pre-wrap text-[16px] leading-7 text-slate-800">
              {log.notes || <span className="text-slate-400">No review written yet.</span>}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 text-sm">
            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={`inline-flex items-center gap-2 border px-3 py-2 font-medium transition-colors ${
                liked
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              aria-label={liked ? "Unlike" : "Like"}
              title={liked ? "Unlike" : "Like"}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenLikes}
              className="border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {likeCount}
            </button>
          </div>

          {/* Reaction Edit (owner only, only in edit mode) */}
          {isOwnLog && isEditing && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">Change reaction:</span>
              {[{label: "Bad", value: 0}, {label: "Good", value: 1}, {label: "Masterpiece", value: 2}].map(opt => (
                <button
                  key={opt.value}
                  disabled={reactionSaving}
                  onClick={() => handleReactionChange(opt.value as 0|1|2)}
                  className={`rounded-none border px-3 py-1 text-sm font-medium transition-colors ${
                    editingReaction === opt.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Context Log */}
        {log.context_log && (
          <div className="mb-8 border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-950">Context log</h3>
            <div className="space-y-3 text-slate-700">
              {log.context_log.location && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Where</p>
                  <p>{log.context_log.location}</p>
                </div>
              )}

              {log.context_log.watched_with && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">With whom</p>
                  <p>{log.context_log.watched_with}</p>
                </div>
              )}

              {log.context_log.mood && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Mood</p>
                  <p>{log.context_log.mood}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="mb-8 border-t border-slate-200 pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
                <MessageCircle className="h-4 w-4" />
                Comments
              </h3>
              <p className="text-sm text-slate-500">Replies and likes stay with this log.</p>
            </div>
            <div className="inline-flex rounded-none border border-slate-200 bg-white p-1">
              {(["top", "newest"] as const).map((sort) => (
                <button
                  key={sort}
                  type="button"
                  onClick={() => setCommentSort(sort)}
                  className={`rounded-none px-3 py-1.5 text-xs font-black capitalize transition ${
                    commentSort === sort ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 flex gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 border-b border-slate-200 bg-transparent px-0 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
            <button
              type="button"
              disabled={submittingComment || commentText.trim().length < 2}
              onClick={handleComment}
              className="inline-flex items-center gap-1 rounded-none bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>

          <div className="divide-y divide-slate-200/70">
            {commentsLoading ? (
              <div className="space-y-3 py-2">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-none bg-slate-100" />
                ))}
              </div>
            ) : sortedComments.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No comments yet. Start the thread.</p>
            ) : (
              sortedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUser={user}
                  logOwnerId={log.user_id}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  submitting={submittingComment || commentLikeLoadingId === comment.id}
                  highlightedCommentId={highlightedCommentId}
                  onReply={handleReply}
                  onToggleLike={handleToggleCommentLike}
                  onOpenLikers={handleOpenCommentLikes}
                  onJumpToProfile={profileHref}
                />
              ))
            )}
          </div>
        </div>

        {/* Log History for this user and movie/show */}
        {userLogs.length > 1 && (
          <div className="mb-6 border-t border-slate-200 pt-6">
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition mb-4"
              onClick={() => setShowUserLogs((v) => !v)}
            >
              {showUserLogs ? "Hide log history" : `Show log history (${userLogs.length})`}
            </button>
            {showUserLogs && (
              <div className="divide-y divide-slate-200">
                {userLogs.map((l) => {
                  const reaction = getReactionDisplay(l.reaction as 0 | 1 | 2);
                  return (
                    <div key={l.id} className="flex items-center gap-4 py-4">
                      <div className="flex flex-col items-center cursor-pointer" onClick={() => router.push(`/logs/${l.id}`)} title={`View this log`}>
                        <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border block ${reaction.badgeClass}`}>{reaction.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-900 cursor-pointer hover:underline" onClick={() => router.push(`/logs/${l.id}`)}>
                          {formatDate(l.watched_date)}
                        </span>
                        {l.notes && (
                          <p className="text-slate-600 mt-1 line-clamp-3">{l.notes}</p>
                        )}
                      </div>
                      <button
                        className="ml-2 rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
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
      {showLikesModal && (
        <PeopleModal
          title={likeCount === 1 ? "1 like" : `${likeCount} likes`}
          users={likers}
          loading={likersLoading}
          onClose={() => {
            setShowLikesModal(false);
            setLikers([]);
          }}
        />
      )}
      {showCommentLikesModal && (
        <PeopleModal
          title={commentLikesTitle}
          users={commentLikers}
          loading={commentLikersLoading}
          onClose={() => {
            setShowCommentLikesModal(false);
            setCommentLikers([]);
          }}
        />
      )}
    </PageLayout>
  );
}
