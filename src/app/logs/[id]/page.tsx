"use client";

import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import LogMovieModal from "@/components/LogMovieModal";
import { MovieLog, MovieLogWithContent, User, Content, LogCommentWithUser } from "@/types";
import { deleteMovieLog, updateMovieLog, getLogsForContent, getVisibleLogNotes } from "@/lib/logs";
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
  Image as ImageIcon,
  X,
  MessageCircle,
  Send,
  Upload,
  Share2,
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
import { buildLogUrl } from "@/lib/log-url";
import { shouldDeliverNotificationToUser } from "@/lib/settings";

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
          className="font-semibold text-[#f5f0de] underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
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
      <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#121212] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#f5f0de]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/55 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-white/55">No one here yet.</p>
        ) : (
          <div className="space-y-2">
            {users.map((person) => (
              <Link
                key={person.id}
                href={`/profile/${person.username || person.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5"
              >
                <Avatar user={person} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#f5f0de]">{person.name}</p>
                  <p className="truncate text-xs text-white/55">@{person.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketActionsModal({
  imageUrl,
  title,
  uploading,
  onClose,
  onDelete,
  onReplace,
}: {
  imageUrl: string | null;
  title: string;
  uploading: boolean;
  onClose: () => void;
  onDelete: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm border border-white/10 bg-[#101010] p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb36b]/80">Ticket image</p>
            <h3 className="mt-1 text-base font-semibold text-[#f5f0de]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/55 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {imageUrl && (
          <div className="mb-4 overflow-hidden bg-black">
            <img src={imageUrl} alt={`${title} ticket preview`} className="h-56 w-full object-cover" />
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={onReplace}
            disabled={uploading}
            className="flex w-full items-center gap-3 border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-60"
          >
            <Upload className="h-4 w-4 text-[#ff7a1a]" />
            {uploading ? "Uploading..." : "Replace image"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={uploading}
            className="flex w-full items-center gap-3 border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Delete image
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 text-sm font-semibold text-[#f5f0de]/70 transition hover:text-[#f5f0de]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function sortLogCommentTree(
  comments: LogCommentWithUser[],
  mode: "top" | "newest",
  ownerId?: string
): LogCommentWithUser[] {
  return comments
    .map((comment) => ({
      ...comment,
      replies: sortLogCommentTree(comment.replies, mode, ownerId),
    }))
    .sort((a, b) => {
      if (mode === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      const aOwner = ownerId && a.user_id === ownerId ? 1 : 0;
      const bOwner = ownerId && b.user_id === ownerId ? 1 : 0;
      if (aOwner !== bOwner) return bOwner - aOwner;

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
            <Link href={onJumpToProfile(comment.user)} className="text-sm font-black text-[#f5f0de] transition hover:text-[#ffb36b]">
              {comment.user.name}
            </Link>
            <span className="text-xs text-slate-400">{relativeTime(comment.created_at)}</span>
            {comment.user_id === logOwnerId && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f5f0de]">
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
                className="text-[#f5f0de] hover:text-[#f5f0de]"
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
  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likers, setLikers] = useState<User[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [comments, setComments] = useState<LogCommentWithUser[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentLikesModal, setShowCommentLikesModal] = useState(false);
  const [commentLikers, setCommentLikers] = useState<User[]>([]);
  const [commentLikersLoading, setCommentLikersLoading] = useState(false);
  const [commentLikesTitle, setCommentLikesTitle] = useState("");
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [commentLikeLoadingId, setCommentLikeLoadingId] = useState<string | null>(null);
  const [ticketSide, setTicketSide] = useState<"front" | "back">("front");
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [showTicketActions, setShowTicketActions] = useState(false);
  const ticketInputRef = useRef<HTMLInputElement | null>(null);

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
          notes: getVisibleLogNotes(logData),
          created_at: logData.created_at || new Date().toISOString(),
          updated_at: logData.updated_at || new Date().toISOString(),
          content,
          user: logOwner,
        };

        setLog(foundLog);
        setTicketImageUrl((foundLog as MovieLog).ticket_image_url || null);
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
        if (user.id !== log.user.id && (await shouldDeliverNotificationToUser(log.user.id, "like"))) {
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

  const handleTicketUploadClick = () => {
    setShowTicketActions(false);
    ticketInputRef.current?.click();
  };

  const handleDeleteTicketImage = async () => {
    if (!log || !user || log.user_id !== user.id) return;

    try {
      setTicketUploading(true);
      await updateMovieLog(log.id, {
        ticket_image_url: null,
      } as Partial<MovieLog>);
      setTicketImageUrl(null);
      setLog((prev) => (prev ? { ...prev, ticket_image_url: null } : prev));
      setTicketSide("front");
      setShowTicketActions(false);
    } catch (error) {
      console.error("Error deleting ticket image:", error);
      alert("Failed to delete the image. Please try again.");
    } finally {
      setTicketUploading(false);
    }
  };

  const handleLogUpdated = (updatedLog: MovieLogWithContent) => {
    setLog((prev) =>
      prev
        ? {
            ...prev,
            ...updatedLog,
            content: prev.content,
            user: prev.user,
          }
        : prev
    );
    setTicketImageUrl(updatedLog.ticket_image_url || null);
    setTicketSide("front");
    setShowEditLogModal(false);
  };

  const handleTicketFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !log || !user || log.user_id !== user.id) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Image size must be 8MB or smaller.");
      return;
    }

    try {
      setTicketUploading(true);
      const downloadUrl = await fileToDataUrl(file);
      await updateMovieLog(log.id, {
        ticket_image_url: downloadUrl,
      } as Partial<MovieLog>);

      setTicketImageUrl(downloadUrl);
      setLog((prev) => (prev ? { ...prev, ticket_image_url: downloadUrl } : prev));
      setTicketSide("back");
      setShowTicketActions(false);
    } catch (error) {
      console.error("Error uploading ticket image:", error);
      alert("Failed to upload the image. Please try again.");
    } finally {
      setTicketUploading(false);
      event.target.value = "";
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
          textClass: "text-[#f5f0de]",
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
  const hasTicketImage = Boolean(ticketImageUrl);
  const sortedComments = useMemo(() => sortLogCommentTree(comments, "top", log?.user_id), [comments, log?.user_id]);
  const contentHref = log
    ? log.content_type === "tv"
      ? `/tv/${log.content.id}`
      : `/movie/${log.content.id}`
    : "#";

  const handleShareLog = async () => {
    if (!log || typeof window === "undefined") return;

    const shareUrl = buildLogUrl(log, targetCommentId ? { comment: targetCommentId } : undefined);
    const absoluteUrl = new URL(shareUrl, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: log.content.title,
          text: `Take a look at ${log.content.title} on Canisterr.`,
          url: absoluteUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        return;
      }
    } catch (error) {
      console.error("Share log failed:", error);
    }

    window.prompt("Copy this link", absoluteUrl);
  };

  useEffect(() => {
    if (!log) return;

    const canonicalUrl = buildLogUrl(log, targetCommentId ? { comment: targetCommentId } : undefined);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== canonicalUrl) {
      router.replace(canonicalUrl);
    }
  }, [log, router, targetCommentId]);

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
          <Link href="/logs" className="text-[#f5f0de] hover:underline mt-4 inline-block">
            Back to logs
          </Link>
        </div>
      </PageLayout>
    );
  }

  const isOwnLog = log.user_id === user.id;

  return (
    <PageLayout user={user} onSignOut={() => router.push("/auth/login")} theme="brutalist">
      <div className="min-h-screen bg-black text-[#f5f0de]">
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
          <div className="flex items-center justify-between pb-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#f5f0de]/70 transition hover:text-[#f5f0de]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[#f5f0de]/60 transition hover:text-[#f5f0de]"
                aria-label="Open log actions"
              >
                <MoreVertical className="h-4 w-4" />
                Menu
              </button>

              {showMenu && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 min-w-40 border border-white/10 bg-[#101010]">
                  <button
                    onClick={() => {
                      handleShareLog();
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-[#f5f0de] transition-colors hover:bg-white/5"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  {isOwnLog && (
                    <>
                      <button
                        onClick={() => {
                          setShowEditLogModal(true);
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[#f5f0de] transition-colors hover:bg-white/5"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          handleDelete();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-rose-300 transition-colors hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(8.75rem,0.9fr)_minmax(0,1.1fr)] gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
            <div className="w-full">
              <div className="relative aspect-[3/4] overflow-hidden bg-black">
                <div
                  className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
                  style={{
                    transform: ticketSide === "front" ? "rotateY(0deg)" : "rotateY(180deg)",
                  }}
                >
                  <div
                    className={`absolute inset-0 [backface-visibility:hidden] ${
                      ticketSide === "front" ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                  >
                    {hasTicketImage ? (
                      <div className="relative h-full w-full">
                        <img
                          src={ticketImageUrl || ""}
                          alt={`${log.content.title} ticket`}
                          className="h-full w-full object-cover"
                        />
                        {isOwnLog && (
                          <button
                            type="button"
                            onClick={() => setShowTicketActions(true)}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center border border-white/10 bg-black/70 text-[#f5f0de] transition hover:bg-black"
                            aria-label="Open ticket actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={contentHref}
                        className="absolute inset-0 z-0 block"
                        aria-label={`Open ${log.content.title}`}
                      >
                        {log.content.poster_url ? (
                          <img
                            src={log.content.poster_url}
                            alt={log.content.title}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.01]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/3 text-xs uppercase tracking-[0.2em] text-white/30">
                            No poster
                          </div>
                        )}
                      </Link>
                    )}
                  </div>

                  <div
                    className={`absolute inset-0 [backface-visibility:hidden] ${
                      ticketSide === "back" ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                    style={{ transform: "rotateY(180deg)" }}
                  >
                    {hasTicketImage ? (
                      <Link
                        href={contentHref}
                        className="absolute inset-0 z-0 block"
                        aria-label={`Open ${log.content.title}`}
                      >
                        {log.content.poster_url ? (
                          <img
                            src={log.content.poster_url}
                            alt={log.content.title}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.01]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/3 text-xs uppercase tracking-[0.2em] text-white/30">
                            No poster
                          </div>
                        )}
                      </Link>
                    ) : isOwnLog ? (
                      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb36b]/75">
                          Upload a picture or ticket
                        </p>
                        <p className="mt-2 max-w-[10rem] text-xs leading-5 text-[#f5f0de]/65">
                          Add an image for the back of this log card.
                        </p>
                        <button
                          type="button"
                          onClick={handleTicketUploadClick}
                          disabled={ticketUploading}
                          className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#ff7a1a] transition hover:text-[#ffb36b] disabled:opacity-60"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {ticketUploading ? "Uploading" : "Upload image"}
                        </button>
                        <p className="mt-3 text-[11px] text-white/35">
                          JPG, PNG, or WebP up to 8MB.
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center">
                        <p className="max-w-[10rem] text-xs leading-5 text-[#f5f0de]/55">
                          No ticket image yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/35">
                <button
                  type="button"
                  onClick={() => setTicketSide("front")}
                  className={ticketSide === "front" ? "text-[#ff7a1a]" : "text-white/45 hover:text-[#f5f0de]"}
                >
                  {hasTicketImage ? "Picture" : "Front"}
                </button>
                <span className="text-white/15">/</span>
                <button
                  type="button"
                  onClick={() => setTicketSide("back")}
                  className={ticketSide === "back" ? "text-[#ff7a1a]" : "text-white/45 hover:text-[#f5f0de]"}
                >
                  {hasTicketImage ? "Poster" : "Back"}
                </button>
                {isOwnLog && ticketImageUrl && (
                  <>
                    <span className="text-white/15">/</span>
                    <button
                      type="button"
                      onClick={handleTicketUploadClick}
                      disabled={ticketUploading}
                      className="text-[#ff7a1a] hover:text-[#ffb36b] disabled:opacity-60"
                    >
                      {ticketUploading ? "Uploading" : "Replace"}
                    </button>
                  </>
                )}
              </div>

              {isOwnLog && (
                <input
                  ref={ticketInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleTicketFileChange}
                />
              )}
            </div>

            <div className="min-w-0 pt-0 lg:pt-2">
              <Link
                href={contentHref}
                className="group inline-block max-w-full"
                aria-label={`Open ${log.content.title}`}
              >
                <h1 className="line-clamp-3 text-[clamp(1.55rem,6vw,3.35rem)] font-black leading-[0.96] tracking-tight text-[#f5f0de] transition group-hover:text-[#ffb36b]">
                  {log.content.title}
                </h1>
              </Link>

              <div className="mt-4 space-y-2 text-[13px] text-white/72 sm:text-sm">
                {releaseYear && (
                  <p>Year {releaseYear}</p>
                )}
                <p className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Watched {formatDate(log.watched_date)}
                </p>
                {log.content.genres?.length ? (
                  <p className="leading-6 text-[#f5f0de]/76">
                    {log.content.genres.slice(0, 4).join(", ")}
                  </p>
                ) : null}
                <div className="pt-3 text-[10px] uppercase tracking-[0.22em] text-[#ffb36b]/75">
                  {log.content_type === "tv" ? "TV Show" : "Movie"}
                </div>
              </div>
            </div>
          </div>

          {/* Review */}
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-[#f5f0de] sm:text-xl">
                {isOwnLog ? "Your review" : `${log.user.name}'s review`}
              </h2>
              {(() => {
                const reaction = getReactionDisplay(log.reaction as 0 | 1 | 2);
                const reactionLabel = <span className={reaction.textClass}>{reaction.label}</span>;
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-2 border px-4 py-1.5 text-sm font-bold ${reaction.badgeClass}`}
                    >
                      {reactionLabel}
                    </span>
                    {ticketImageUrl && (
                      <span
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-[#f5f0de]/80"
                        aria-label="Ticket image attached"
                        title="Ticket image attached"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

          <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-[#f5f0de]/90">
            {log.notes || <span className="text-white/35">No review written yet.</span>}
          </div>

          <div className="mt-5 inline-flex items-center gap-2 text-sm">
            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                liked
                  ? "text-rose-300"
                  : "text-[#f5f0de]/80 hover:text-[#f5f0de]"
              }`}
              aria-label={liked ? "Unlike" : "Like"}
              title={liked ? "Unlike" : "Like"}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenLikes}
              className="font-medium text-[#f5f0de]/80 transition hover:text-[#f5f0de]"
            >
              {likeCount}
            </button>
          </div>

        </div>

        {/* Context Log */}
        {log.context_log && (
          <div className="mb-8 border-t border-white/10 pt-6">
            <h3 className="mb-4 text-lg font-semibold text-[#f5f0de]">Context log</h3>
            <div className="space-y-3 text-white/75">
              {log.context_log.location && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb36b]/80">Where</p>
                  <p>{log.context_log.location}</p>
                </div>
              )}

              {log.context_log.watched_with && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb36b]/80">With whom</p>
                  <p>{log.context_log.watched_with}</p>
                </div>
              )}

              {log.context_log.mood && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb36b]/80">Mood</p>
                  <p>{log.context_log.mood}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="mb-8 border-t border-white/10 pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-2 text-base font-semibold text-[#f5f0de] sm:text-lg">
                <MessageCircle className="h-4 w-4" />
                Comments
              </h3>
              <p className="text-xs text-white/45 sm:text-sm">Replies and likes stay with this log.</p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 border-b border-white/10 bg-transparent px-0 py-2.5 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]"
            />
            <button
              type="button"
              disabled={submittingComment || commentText.trim().length < 2}
              onClick={handleComment}
              className="inline-flex items-center gap-1 rounded-none bg-[#ff7a1a] px-4 py-2.5 text-sm font-black text-black disabled:opacity-50"
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>

          <div className="divide-y divide-white/10">
            {commentsLoading ? (
              <div className="space-y-3 py-2">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-none bg-white/5" />
                ))}
              </div>
            ) : sortedComments.length === 0 ? (
              <p className="py-4 text-sm text-white/55">No comments yet. Start the thread.</p>
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
          <div className="mb-6 border-t border-white/10 pt-6">
            <button
              className="mb-4 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#f5f0de] hover:bg-white/5 transition"
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
                      <div className="flex flex-col items-center cursor-pointer" onClick={() => router.push(buildLogUrl(l))} title={`View this log`}>
                        <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border block ${reaction.badgeClass}`}>{reaction.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-900 cursor-pointer hover:underline" onClick={() => router.push(buildLogUrl(l))}>
                          {formatDate(l.watched_date)}
                        </span>
                        {l.notes && (
                          <p className="text-slate-600 mt-1 line-clamp-3">{l.notes}</p>
                        )}
                      </div>
                      <button
                        className="ml-2 rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        onClick={() => router.push(buildLogUrl(l))}
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
      {showEditLogModal && log && (
        <LogMovieModal
          isOpen={showEditLogModal}
          onClose={() => setShowEditLogModal(false)}
          content={log.content}
          user={user}
          mode="edit"
          existingLog={log}
          onLogUpdated={handleLogUpdated}
          theme="brutalist"
        />
      )}
      {showTicketActions && (
        <TicketActionsModal
          imageUrl={ticketImageUrl}
          title={log.content.title}
          uploading={ticketUploading}
          onClose={() => setShowTicketActions(false)}
          onDelete={handleDeleteTicketImage}
          onReplace={handleTicketUploadClick}
        />
      )}
    </PageLayout>
  );
}
