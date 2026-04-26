"use client";

import Link from "next/link";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import { CinePostWithDetails, User } from "@/types";

const PREVIEW_LIMIT = 130;

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

function formatPostType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function preview(body: string): string {
  if (body.length <= PREVIEW_LIMIT) return body;
  return `${body.slice(0, PREVIEW_LIMIT).trimEnd()}...`;
}

export default function CinePostPreviewList({
  posts,
  emptyText = "No posts yet.",
  className = "",
  currentUser = null,
  onPostMutated,
}: {
  posts: CinePostWithDetails[];
  emptyText?: string;
  className?: string;
  currentUser?: User | null;
  onPostMutated?: () => void;
}) {
  if (posts.length === 0) {
    return (
      <div className={`border border-dashed border-white/10 bg-[#111111] p-6 text-center text-sm text-white/50 ${className}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {posts.map((post) => {
        const contentHref =
          post.content_id && post.content_type
            ? post.content_type === "tv"
              ? `/tv/${post.content_id}`
              : `/movie/${post.content_id}`
            : null;

        return (
          <article
            key={post.id}
            className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 border-b border-white/10 py-3 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4 sm:py-4"
          >
            {contentHref ? (
              <Link href={contentHref} className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                {post.poster_url ? (
                  <img
                    src={post.poster_url}
                    alt={post.content_title || post.anchor_label}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-xs font-bold text-white/35">
                    No poster
                  </div>
                )}
              </Link>
            ) : (
              <div className="aspect-[2/3] bg-[#1a1a1a]" />
            )}
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <Link href={profileHref(post.user)} className="font-black text-[#f5f0de] hover:text-[#ffb36b]">
                    {post.user.name}
                  </Link>
                  <span className="text-xs text-white/45">{relativeTime(post.created_at)}</span>
                  <span className="rounded-full bg-[#ff7a1a] px-2 py-0.5 text-[10px] font-black text-black">
                    {formatPostType(post.type)}
                  </span>
                </div>
                {currentUser && currentUser.id === post.user_id && onPostMutated && (
                  <CinePostOwnerMenu
                    post={post}
                    currentUser={currentUser}
                    onDeleted={onPostMutated}
                    onUpdated={onPostMutated}
                  />
                )}
              </div>
              <Link href={`/posts/${post.id}`} className="mt-2 block">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#f5f0de]/80">{preview(post.body)}</p>
              </Link>
              <div className="mt-2 flex gap-3 text-xs font-bold text-white/55">
                <span>{post.likes_count} likes</span>
                <span>{post.comments_count} comments</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
