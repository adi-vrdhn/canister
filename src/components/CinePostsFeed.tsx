"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Sparkles, X } from "lucide-react";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import { CinePostEngagementType, CinePostWithDetails, User } from "@/types";
import {
  getCinePostEngagementUsers,
  getCinePosts,
  setCinePostEngagement,
} from "@/lib/cineposts";

interface CinePostsFeedProps {
  currentUser: User | null;
  refreshKey?: number;
}

const PREVIEW_LIMIT = 150;

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

function Avatar({ user, size = "h-9 w-9" }: { user: User; size?: string }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.name} className={`${size} rounded-full object-cover`} />;
  }

  return (
    <div className={`flex ${size} items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white`}>
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

function getContentHref(post: CinePostWithDetails): string | null {
  if (!post.content_id || !post.content_type) return null;
  return post.content_type === "tv" ? `/tv/${post.content_id}` : `/movie/${post.content_id}`;
}

function getPreview(body: string): { text: string; isTrimmed: boolean } {
  if (body.length <= PREVIEW_LIMIT) return { text: body, isTrimmed: false };
  return {
    text: `${body.slice(0, PREVIEW_LIMIT).trimEnd()}...`,
    isTrimmed: true,
  };
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CinePostsFeed({ currentUser, refreshKey = 0 }: CinePostsFeedProps) {
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleModalTitle, setPeopleModalTitle] = useState("");
  const [peopleModalUsers, setPeopleModalUsers] = useState<User[]>([]);
  const [peopleModalLoading, setPeopleModalLoading] = useState(false);

  const refreshPosts = async () => {
    try {
      const feed = await getCinePosts(currentUser?.id, 30, { sort: "smart" });
      setPosts(feed);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        const feed = await getCinePosts(currentUser?.id, 30, { sort: "smart" });
        if (!cancelled) {
          setPosts(feed);
        }
      } catch (error) {
        console.error("Error loading posts:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, refreshKey]);

  const handleEngagement = async (
    post: CinePostWithDetails,
    type: CinePostEngagementType,
    enabled: boolean
  ) => {
    if (!currentUser) return;
    await setCinePostEngagement(post, currentUser, type, enabled);
    await refreshPosts();
  };

  const openPeopleModal = async (
    post: CinePostWithDetails,
    type: CinePostEngagementType,
    title: string
  ) => {
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

  return (
    <>
      {loading ? (
        <div className="grid gap-3">
          {[0, 1].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-[1.75rem] bg-slate-100" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-6 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="font-bold text-slate-900">No posts here yet</p>
          <p className="mt-1 text-sm text-slate-500">Try another filter or create the first one.</p>
        </div>
      ) : (
      <div className="space-y-4">
        {posts.map((post) => {
          const contentHref = getContentHref(post);
          const postHref = `/posts/${post.id}`;
          const preview = getPreview(post.body);

          return (
            <article
              key={post.id}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-5 sm:p-5">
                {contentHref ? (
                  <Link
                    href={contentHref}
                    className="group relative aspect-[2/3] overflow-hidden rounded-[1.4rem] bg-slate-950 shadow-sm sm:rounded-[1.75rem]"
                    title={`Open ${post.content_title || post.anchor_label}`}
                  >
                    {post.poster_url ? (
                      <img
                        src={post.poster_url}
                        alt={post.content_title || post.anchor_label}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-bold text-slate-400">
                        No poster
                      </div>
                    )}
                  </Link>
                ) : (
                  <div className="aspect-[2/3] rounded-[1.4rem] bg-slate-100 sm:rounded-[1.75rem]" />
                )}

                <div className="min-w-0 py-1">
                  <div className="flex items-start gap-3">
                    <Link href={profileHref(post.user)} className="hidden flex-shrink-0 sm:block">
                      <Avatar user={post.user} size="h-11 w-11" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={profileHref(post.user)} className="font-black text-slate-950 hover:text-blue-600">
                          {post.user.name}
                        </Link>
                        <span className="text-sm text-slate-400">{relativeTime(post.created_at)}</span>
                      </div>
                      <span className="mt-2 inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                        {formatPostType(post.type)}
                      </span>
                    </div>
                    <CinePostOwnerMenu
                      post={post}
                      currentUser={currentUser}
                      onDeleted={refreshPosts}
                      onUpdated={refreshPosts}
                    />
                  </div>

                  <Link href={postHref} className="mt-4 block">
                    <p className="whitespace-pre-wrap text-[14px] leading-6 text-slate-700 sm:text-[15px] sm:leading-7">
                      {preview.text}
                    </p>
                  </Link>

                  {preview.isTrimmed && (
                    <Link href={postHref} className="mt-2 inline-flex text-sm font-black text-blue-600">
                      Show more
                    </Link>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 px-3 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEngagement(post, "like", !post.liked_by_current_user)}
                      className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 transition ${
                        post.liked_by_current_user
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label={post.liked_by_current_user ? "Unlike post" : "Like post"}
                    >
                      <Heart className={`h-4 w-4 ${post.liked_by_current_user ? "fill-rose-500" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPeopleModal(post, "like", "Liked by")}
                      disabled={post.likes_count === 0}
                      className="rounded-2xl px-1 py-2 text-sm font-black text-rose-600 disabled:text-slate-400"
                    >
                      {post.likes_count}
                    </button>
                    <Link
                      href={postHref}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {post.comments_count}
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEngagement(post, "save", !post.saved_by_current_user)}
                    className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-bold transition ${
                      post.saved_by_current_user
                        ? "bg-blue-50 text-blue-600"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-label={post.saved_by_current_user ? "Unsave post" : "Save post"}
                  >
                    <Bookmark className={`h-4 w-4 ${post.saved_by_current_user ? "fill-blue-500" : ""}`} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      )}

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
    </>
  );
}
