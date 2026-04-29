"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Bookmark, Heart, MessageCircle, MoreVertical, Pencil, Send, Trash2, X } from "lucide-react";
import CinematicLoading from "@/components/CinematicLoading";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import ShareLinkButton from "@/components/ShareLinkButton";
import PageLayout from "@/components/PageLayout";
import CinePostArtwork from "@/components/CinePostArtwork";
import {
  CinePostCommentWithUser,
  CinePostEngagementType,
  CinePostWithDetails,
  User,
} from "@/types";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import {
  createCinePostComment,
  deleteCinePostComment,
  getCinePost,
  getCinePostEngagementUsers,
  setCinePostEngagement,
  updateCinePostComment,
} from "@/lib/cineposts";
import { reportAppError } from "@/lib/report-error";

function formatPostType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function relativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function profileHref(user: User): string {
  return `/profile/${user.username || user.id}`;
}

function contentHref(post: CinePostWithDetails): string | null {
  if (post.list_id && post.content_type === "list") return `/lists/${post.list_id}`;
  if (!post.content_id || !post.content_type) return null;
  return post.content_type === "tv" ? `/tv/${post.content_id}` : `/movie/${post.content_id}`;
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
          className="font-semibold text-[#ff7a1a] underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function Avatar({ user, size = "h-10 w-10" }: { user: User; size?: string }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.name} className={`${size} rounded-full object-cover`} />;
  }

  return (
    <div className={`flex ${size} items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white`}>
      {user.name.charAt(0).toUpperCase()}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No one here yet.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {users.map((user) => (
              <Link
                key={user.id}
                href={profileHref(user)}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50"
              >
                <Avatar user={user} />
                <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentThread({
  comment,
  currentUser,
  postOwnerId,
  onReply,
  onEdit,
  onDelete,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  submitting,
  theme = "brutalist",
}: {
  comment: CinePostCommentWithUser;
  currentUser: User | null;
  postOwnerId: string;
  onReply: (parentId: string, ownerId: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  replyingTo: string | null;
  replyText: string;
  setReplyingTo: (commentId: string | null) => void;
  setReplyText: (value: string) => void;
  submitting: boolean;
  theme?: "default" | "brutalist";
}) {
  const isBrutalist = theme === "brutalist";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditText(comment.content);
    }
  }, [comment.content, isEditing]);

  const canManageComment = currentUser?.id === comment.user_id;

  const startEdit = () => {
    setMenuOpen(false);
    setEditText(comment.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText(comment.content);
  };

  const saveEdit = async () => {
    if (editText.trim().length < 2) return;

    try {
      setCommentSaving(true);
      await onEdit(comment.id, editText);
      setIsEditing(false);
    } catch (error) {
      reportAppError({
        title: "Comment update failed",
        message: "We could not save your edit.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    } finally {
      setCommentSaving(false);
    }
  };

  const deleteComment = async () => {
    const confirmed = window.confirm(
      comment.replies.length > 0
        ? "Delete this comment and its replies?"
        : "Delete this comment?"
    );
    if (!confirmed) return;

    try {
      setMenuOpen(false);
      setCommentSaving(true);
      await onDelete(comment.id);
    } catch (error) {
      reportAppError({
        title: "Comment delete failed",
        message: "We could not delete this comment.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    } finally {
      setCommentSaving(false);
    }
  };

  return (
    <div className="py-4">
      <div className="flex gap-3">
        <Link href={profileHref(comment.user)} className="flex-shrink-0">
          <Avatar user={comment.user} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={profileHref(comment.user)} className="text-sm font-black text-[#f5f0de] hover:text-white">
                  {comment.user.name}
                </Link>
                <span className="text-xs text-slate-400">{relativeTime(comment.created_at)}</span>
                {comment.insightScore > 8 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    top insight
                  </span>
                )}
                {comment.user_id === postOwnerId && (
                  <span className="rounded-full bg-[#ffb36b]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ff7a1a]">
                    owner
                  </span>
                )}
              </div>
            </div>

            {canManageComment && (
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className={`rounded-full p-1 transition ${
                    isBrutalist ? "text-white/55 hover:bg-white/5 hover:text-[#f5f0de]" : "text-slate-400 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  aria-label="Comment options"
                  aria-expanded={menuOpen}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {menuOpen && (
                  <div
                    className={`absolute right-0 top-9 z-20 w-40 overflow-hidden border p-1 shadow-xl ${
                      isBrutalist ? "border-white/10 bg-[#111111]" : "rounded-2xl border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={startEdit}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                        isBrutalist ? "text-[#f5f0de] hover:bg-white/5" : "rounded-xl text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={deleteComment}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                        isBrutalist ? "text-[#ff7a1a] hover:bg-white/5" : "rounded-xl text-red-600 hover:bg-red-50"
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={3}
                className={`w-full resize-none rounded-3xl border px-4 py-3 text-sm leading-6 outline-none ${
                  isBrutalist
                    ? "border-white/10 bg-[#0d0d0d] text-[#f5f0de] focus:border-[#ff7a1a]"
                    : "border-slate-200 bg-white text-slate-800 focus:border-blue-500"
                }`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className={`rounded-full border px-3 py-2 text-xs font-black ${
                    isBrutalist
                      ? "border-white/10 text-[#f5f0de] hover:bg-white/5"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={commentSaving || editText.trim().length < 2}
                  className={`rounded-full px-3 py-2 text-xs font-black text-black disabled:opacity-50 ${
                    isBrutalist ? "bg-[#ff7a1a] hover:bg-[#ff8d3b]" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {commentSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {linkify(comment.content)}
              </p>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(replyingTo === comment.id ? null : comment.id);
                    setReplyText("");
                  }}
                  className="mt-2 text-xs font-black text-[#ff7a1a]"
                >
                  Reply
                  {comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="mt-3 flex gap-2 pl-12">
          <input
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={`Reply to ${comment.user.name}`}
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#111111] px-3 py-2 text-sm text-[#f5f0de] outline-none focus:border-[#ff7a1a]"
          />
          <button
            type="button"
            disabled={submitting || replyText.trim().length < 2}
            onClick={() => onReply(comment.id, comment.user_id)}
            className="rounded-full bg-slate-950 px-3 py-2 text-white disabled:opacity-50"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
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
            postOwnerId={postOwnerId}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            replyingTo={replyingTo}
            replyText={replyText}
            setReplyingTo={setReplyingTo}
            setReplyText={setReplyText}
            submitting={submitting}
            theme={theme}
          />
        ))}
      </div>
    )}
  </div>
  );
}

export default function CinePostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<CinePostWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [peopleModalTitle, setPeopleModalTitle] = useState("");
  const [peopleModalUsers, setPeopleModalUsers] = useState<User[]>([]);
  const [peopleModalLoading, setPeopleModalLoading] = useState(false);
  const [commentSort, setCommentSort] = useState<"top" | "newest">("top");

  const loadPost = async (currentUserId?: string) => {
    const foundPost = await getCinePost(postId, currentUserId);
    setPost(foundPost);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          router.push("/auth/login");
          return;
        }

        const userSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        const userData = userSnapshot.val();
        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.created_at || userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);
        await loadPost(currentUser.id);
      } catch (error) {
        console.error("Error loading post:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [postId, router]);

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  const refreshPost = async () => {
    await loadPost(user?.id);
  };

  const handleEngagement = async (
    type: CinePostEngagementType,
    enabled: boolean
  ) => {
    if (!user || !post) return;
    await setCinePostEngagement(post, user, type, enabled);
    await refreshPost();
  };

  const openPeopleModal = async (type: CinePostEngagementType, title: string) => {
    if (!post) return;
    setPeopleModalTitle(title);
    setPeopleModalUsers([]);
    setPeopleModalLoading(true);
    try {
      const users = await getCinePostEngagementUsers(post.id, type);
      setPeopleModalUsers(users);
    } finally {
      setPeopleModalLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user || !post || commentText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createCinePostComment(post, user, commentText);
      setCommentText("");
      await refreshPost();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = async (parentId: string, ownerId: string) => {
    if (!user || !post || replyText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createCinePostComment(post, user, replyText, parentId, ownerId);
      setReplyText("");
      setReplyingTo(null);
      await refreshPost();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!user || !post) return;
    await updateCinePostComment(post.id, user.id, commentId, content);
    await refreshPost();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !post) return;
    await deleteCinePostComment(post.id, user.id, commentId);
    await refreshPost();
  };

  if (loading || !user) {
    return <CinematicLoading message="Post is loading" />;
  }

  if (!post) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="rounded-[2rem] border border-white/10 bg-[#111111] p-8 text-center">
            <p className="font-black text-[#f5f0de]">This post was not found.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const href = contentHref(post);
  const sortedComments = [...post.comments].sort((a, b) => {
    if (commentSort === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (b.insightScore !== a.insightScore) return b.insightScore - a.insightScore;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <article className="border-y border-white/10 bg-black">
          <div className="grid gap-6 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:py-6">
            {href ? (
              <Link
                href={href}
                className="group relative mx-auto aspect-[2/3] w-full max-w-48 overflow-hidden bg-[#111111] sm:mx-0"
              >
                <CinePostArtwork
                  src={post.poster_url}
                  collageImages={post.list_cover_images}
                  alt={post.content_title || post.anchor_label}
                  className="h-full w-full"
                  mediaClassName="transition duration-300 group-hover:scale-[1.02]"
                />
              </Link>
            ) : (
              <div className="mx-auto aspect-[2/3] w-full max-w-48 bg-[#111111] sm:mx-0" />
            )}

            <div className="min-w-0 pr-4 sm:pr-0">
              <div className="flex items-start gap-3">
                <Link href={profileHref(post.user)} className="flex-shrink-0">
                  <Avatar user={post.user} size="h-11 w-11" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={profileHref(post.user)} className="text-lg font-black text-[#f5f0de] hover:text-[#ffb36b]">
                      {post.user.name}
                    </Link>
                    <span className="text-sm text-white/45">{relativeTime(post.created_at)}</span>
                  </div>
                  <span className="mt-2 inline-flex rounded-full bg-[#ff7a1a] px-3 py-1 text-xs font-black text-black">
                    {formatPostType(post.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShareLinkButton
                    href={`/posts/${post.id}`}
                    title={`${post.user.name}'s post`}
                    text={`Shared from Canisterr by ${post.user.name}.`}
                    showLabel
                    className="rounded-full border border-white/10 bg-[#111111] px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:border-[#ff7a1a]/35 hover:bg-white/[0.08] hover:text-[#ffb36b]"
                    ariaLabel="Share post link"
                  />
                  <CinePostOwnerMenu
                    post={post}
                    currentUser={user}
                    onDeleted={() => router.push("/dashboard")}
                    onUpdated={refreshPost}
                    theme="brutalist"
                  />
                </div>
              </div>

              <div className="mt-6 max-w-3xl whitespace-pre-wrap text-[16px] leading-8 text-[#f5f0de]/82">
                {linkify(post.body)}
              </div>

              {post.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-sm font-bold text-[#f5f0de]/65"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEngagement("like", !post.liked_by_current_user)}
                  className={`inline-flex items-center justify-center rounded-full px-2.5 py-2 transition ${
                    post.liked_by_current_user
                      ? "text-rose-300 hover:text-rose-200"
                      : "text-white/60 hover:text-[#ffb36b]"
                  }`}
                >
                  <Heart className={`h-5 w-5 ${post.liked_by_current_user ? "fill-rose-500" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => openPeopleModal("like", "Liked by")}
                  disabled={post.likes_count === 0}
                  className="rounded-full px-1 py-2 text-sm font-black text-rose-300 disabled:text-white/30"
                >
                  {post.likes_count} like{post.likes_count === 1 ? "" : "s"}
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-white/55">
                  <MessageCircle className="h-4 w-4" />
                  {post.comments_count}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleEngagement("save", !post.saved_by_current_user)}
                className={`inline-flex items-center justify-center rounded-full px-2.5 py-2 transition ${
                  post.saved_by_current_user
                    ? "bg-[#ffb36b]/20 text-[#ff7a1a]"
                    : "text-white/60 hover:text-[#ffb36b]"
                }`}
              >
                <Bookmark className={`h-5 w-5 ${post.saved_by_current_user ? "fill-[#ff7a1a]" : ""}`} />
              </button>
            </div>
          </div>
        </article>

        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#f5f0de]">Comments</h2>
              <p className="text-sm text-white/55">Top insights rise first, with full threaded replies expanded.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-[#111111] p-1">
              {(["top", "newest"] as const).map((sort) => (
                <button
                  key={sort}
                  type="button"
                  onClick={() => setCommentSort(sort)}
                  className={`rounded-full px-3 py-1.5 text-xs font-black capitalize transition ${
                    commentSort === sort ? "bg-[#ff7a1a] text-black" : "text-white/55 hover:bg-white/10 hover:text-[#f5f0de]"
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
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#111111] px-4 py-3 text-sm text-[#f5f0de] outline-none focus:border-[#ff7a1a]"
            />
            <button
              type="button"
              disabled={submittingComment || commentText.trim().length < 2}
              onClick={handleComment}
              className="rounded-full bg-[#ff7a1a] px-4 py-3 text-black disabled:opacity-50"
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <div className="divide-y divide-white/10">
            {post.comments.length === 0 ? (
              <p className="border-b border-white/10 py-5 text-sm text-white/55">
                No comments yet. Start the thread.
              </p>
            ) : (
              sortedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUser={user}
                  postOwnerId={post.user_id}
                  onReply={handleReply}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  submitting={submittingComment}
                  theme="brutalist"
                />
              ))
            )}
          </div>
        </section>
      </main>

      {peopleModalTitle && (
        <PeopleModal
          title={peopleModalTitle}
          users={peopleModalUsers}
          loading={peopleModalLoading}
          onClose={() => {
            setPeopleModalTitle("");
            setPeopleModalUsers([]);
          }}
        />
      )}
    </PageLayout>
  );
}
