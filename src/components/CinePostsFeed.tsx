"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronRight, Heart, MessageCircle, Sparkles, X } from "lucide-react";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import { CinePostEngagementType, CinePostWithDetails, User } from "@/types";
import {
  getCinePostEngagementUsers,
  getCinePosts,
  setCinePostEngagement,
} from "@/lib/cineposts";
import { getListWithDetails, getPublicLists } from "@/lib/lists";
import { db } from "@/lib/firebase";
import { get, ref } from "firebase/database";

interface CinePostsFeedProps {
  currentUser: User | null;
  refreshKey?: number;
  theme?: "default" | "brutalist";
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

function Avatar({
  user,
  size = "h-9 w-9",
  dark = false,
}: {
  user: User;
  size?: string;
  dark?: boolean;
}) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.name} className={`${size} rounded-full object-cover`} />;
  }

  return (
    <div
      className={`flex ${size} items-center justify-center rounded-full text-sm font-bold ${
        dark ? "bg-[#f5f0de] text-[#0a0a0a]" : "bg-slate-950 text-white"
      }`}
    >
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

type TrendingList = {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
  coverImage: string | null;
  engagementScore: number;
};

function buildTrendingScore(list: {
  item_count: number;
  collaborators: Array<{ user_id: string }>;
  items: Array<{ watched_by?: string[] }>;
}): number {
  const collaboratorCount = list.collaborators.filter((collab) => Boolean(collab.user_id)).length;
  const watchSignal = list.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);
  return list.item_count * 2 + collaboratorCount * 3 + watchSignal;
}

function PeopleModal({
  title,
  users,
  loading,
  onClose,
  theme = "default",
}: {
  title: string;
  users: User[];
  loading: boolean;
  onClose: () => void;
  theme?: "default" | "brutalist";
}) {
  const isBrutalist = theme === "brutalist";

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center p-3 backdrop-blur-sm sm:items-center ${
      isBrutalist ? "bg-black/70" : "bg-slate-950/45"
    }`}>
      <div
        className={`w-full max-w-md border p-4 shadow-2xl ${
          isBrutalist
            ? "border-white/10 bg-[#111111] text-[#f5f0de]"
            : "rounded-[1.75rem] border-slate-200 bg-white"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-lg font-black ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full border p-2 ${
              isBrutalist
                ? "border-white/10 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className={`h-12 animate-pulse ${isBrutalist ? "bg-white/5" : "rounded-2xl bg-slate-100"}`} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className={`p-4 text-sm ${isBrutalist ? "bg-white/5 text-white/55" : "rounded-2xl bg-slate-50 text-slate-500"}`}>
            No one here yet.
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {users.map((user) => (
              <Link
                key={user.id}
                href={profileHref(user)}
                onClick={onClose}
                className={`flex items-center gap-3 p-2 transition ${
                  isBrutalist ? "hover:bg-white/5" : "rounded-2xl hover:bg-slate-50"
                }`}
              >
                <Avatar user={user} dark={isBrutalist} />
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>{user.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CinePostsFeed({ currentUser, refreshKey = 0, theme = "default" }: CinePostsFeedProps) {
  const isBrutalist = theme === "brutalist";
  const router = useRouter();
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleModalTitle, setPeopleModalTitle] = useState("");
  const [peopleModalUsers, setPeopleModalUsers] = useState<User[]>([]);
  const [peopleModalLoading, setPeopleModalLoading] = useState(false);
  const [trendingLists, setTrendingLists] = useState<TrendingList[]>([]);
  const [trendingListsLoading, setTrendingListsLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;

    const loadTrendingLists = async () => {
      try {
        setTrendingListsLoading(true);

        const [publicListsBase, usersSnapshot] = await Promise.all([
          getPublicLists(8),
          get(ref(db, "users")),
        ]);

        const allUsers = usersSnapshot.exists() ? usersSnapshot.val() : {};
        const publicListsWithDetails = await Promise.all(
          publicListsBase.map(async (list) => {
            const details = await getListWithDetails(list.id, allUsers);
            if (!details) return null;

            return {
              id: details.id,
              name: details.name,
              description: details.description,
              item_count: details.item_count,
              coverImage: details.cover_image_url || details.items[0]?.content?.poster_url || null,
              engagementScore: buildTrendingScore(details),
            } satisfies TrendingList;
          })
        );

        const nextTrending = publicListsWithDetails
          .filter((list): list is TrendingList => Boolean(list))
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .slice(0, 3);

        if (!cancelled) {
          setTrendingLists(nextTrending);
        }
      } catch (error) {
        console.error("Error loading trending lists:", error);
      } finally {
        if (!cancelled) {
          setTrendingListsLoading(false);
        }
      }
    };

    loadTrendingLists();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const renderTrendingListsSection = () => {
    if (trendingListsLoading || trendingLists.length === 0) return null;

    return (
      <article
        className={`cursor-pointer overflow-hidden ${
          isBrutalist
            ? "border border-white/10 bg-[#111111] text-[#f5f0de] shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
            : "rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
        }`}
        onClick={() => router.push("/lists")}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push("/lists");
          }
        }}
      >
        <div className={`flex items-center justify-between gap-3 px-3 py-3 sm:px-4 ${
          isBrutalist ? "border-b border-white/10" : "border-b border-slate-100"
        }`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${isBrutalist ? "text-[#ff7a1a]" : "text-blue-600"}`} />
              <h3 className={`text-sm font-black sm:text-base ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>Trending lists</h3>
            </div>
            <p className={`mt-0.5 text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>Global picks worth checking out</p>
          </div>

          <Link
            href="/lists"
            onClick={(event) => event.stopPropagation()}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
              isBrutalist
                ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-[#ff7a1a]/40 hover:text-[#ffb36b]"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
            }`}
            aria-label="Open lists"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto px-3 py-3 sm:px-4">
          {trendingLists.map((list) => {
            const listHref = `/lists/${list.id}`;

            return (
              <div
                key={list.id}
                className={`w-[8.75rem] shrink-0 p-2.5 transition hover:-translate-y-0.5 sm:w-[10.5rem] ${
                  isBrutalist
                    ? "border border-white/10 bg-[#0a0a0a] hover:border-[#ff7a1a]/40 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                    : "rounded-[1.1rem] border border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                }`}
              >
                <Link
                  href={listHref}
                  onClick={(event) => event.stopPropagation()}
                  className="group block"
                >
                  <div className={`aspect-[2/3] overflow-hidden ${isBrutalist ? "bg-[#1a1a1a]" : "rounded-[0.9rem] bg-slate-100"}`}>
                    {list.coverImage ? (
                      <img
                        src={list.coverImage}
                        alt={list.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${
                        isBrutalist
                          ? "bg-[#1a1a1a] text-white/35"
                          : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500"
                      }`}>
                        No poster
                      </div>
                    )}
                  </div>

                  <div className="mt-3 min-w-0">
                    <h4 className={`truncate text-xs font-black sm:text-sm ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>{list.name}</h4>
                    {list.description && (
                      <p className={`mt-1 line-clamp-2 text-[11px] leading-4 ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                        {list.description}
                      </p>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </article>
    );
  };

  return (
    <>
      {loading ? (
        <div className={isBrutalist ? "divide-y divide-white/10" : "grid gap-3"}>
          {[0, 1].map((item) => (
            <div key={item} className={`h-48 animate-pulse ${isBrutalist ? "bg-white/5" : "rounded-[1.75rem] bg-slate-100"}`} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className={`p-6 text-center ${isBrutalist ? "bg-black" : "rounded-[1.75rem] border border-dashed border-slate-300 bg-white"}`}>
          <Sparkles className={`mx-auto mb-3 h-8 w-8 ${isBrutalist ? "text-[#ff7a1a]" : "text-slate-300"}`} />
          <p className={`font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>No posts here yet</p>
          <p className={`mt-1 text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>Try another filter or create the first one.</p>
        </div>
      ) : (
      <div className={isBrutalist ? "divide-y divide-white/10" : "space-y-4"}>
        {posts.map((post, index) => {
          const contentHref = getContentHref(post);
          const postHref = `/posts/${post.id}`;
          const preview = getPreview(post.body);

          return (
            <div key={post.id} className={isBrutalist ? "py-5 sm:py-6" : "space-y-4"}>
              <article className={isBrutalist ? "bg-black text-[#f5f0de]" : "overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"}>
                <div className={`grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5 ${
                  isBrutalist ? "px-0 py-0" : "p-3 sm:p-5"
                }`}>
                  {contentHref ? (
                    <Link
                      href={contentHref}
                      className={`group relative aspect-[2/3] overflow-hidden shadow-sm ${
                        isBrutalist ? "bg-black" : "rounded-[1.4rem] bg-slate-950"
                      }`}
                      title={`Open ${post.content_title || post.anchor_label}`}
                    >
                      {post.poster_url ? (
                        <img
                          src={post.poster_url}
                          alt={post.content_title || post.anchor_label}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${
                          isBrutalist ? "bg-[#1a1a1a] text-white/35" : "bg-slate-100 text-slate-400"
                        }`}>
                          No poster
                        </div>
                      )}
                    </Link>
                  ) : (
                    <div className={`aspect-[2/3] sm:rounded-[1.75rem] ${isBrutalist ? "bg-[#1a1a1a]" : "rounded-[1.4rem] bg-slate-100"}`} />
                  )}

                    <div className="min-w-0 py-1">
                      <div className="flex items-start gap-3">
                        <Link href={profileHref(post.user)} className="flex-shrink-0">
                          <Avatar user={post.user} size="h-7 w-7 sm:h-8 sm:w-8" dark={isBrutalist} />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <Link
                              href={profileHref(post.user)}
                              className={`text-[13px] font-black leading-none sm:text-sm ${isBrutalist ? "text-[#f5f0de] hover:text-[#ffb36b]" : "text-slate-950 hover:text-blue-600"}`}
                            >
                              {post.user.name}
                            </Link>
                            <span className={`text-[10px] sm:text-xs ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>{relativeTime(post.created_at)}</span>
                          </div>
                        </div>
                        <CinePostOwnerMenu
                          post={post}
                          currentUser={currentUser}
                          onDeleted={refreshPosts}
                          onUpdated={refreshPosts}
                        />
                      </div>

                      <Link href={postHref} className="mt-2 block sm:mt-3">
                        <p className={`whitespace-pre-wrap text-[13px] leading-5 sm:text-[14px] sm:leading-6 ${
                          isBrutalist ? "text-[#f5f0de]/92" : "text-slate-700"
                        }`}>
                          {preview.text}
                        </p>
                      </Link>

                      {preview.isTrimmed && (
                        <Link
                          href={postHref}
                          className={`mt-1 inline-flex text-[11px] font-black sm:mt-2 sm:text-sm ${
                            isBrutalist ? "text-[#ffb36b]" : "text-blue-600"
                          }`}
                        >
                          Show more
                        </Link>
                      )}
                    </div>
                </div>

                <div className={`py-3 sm:py-4 ${isBrutalist ? "border-t border-white/10" : "border-t border-slate-100 px-3 sm:px-5"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEngagement(post, "like", !post.liked_by_current_user)}
                        className={`inline-flex items-center justify-center transition ${
                          post.liked_by_current_user
                            ? isBrutalist
                              ? "text-[#ff7a1a]"
                              : "bg-rose-50 text-rose-600"
                            : isBrutalist
                            ? "text-white/65 hover:text-[#ffb36b]"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label={post.liked_by_current_user ? "Unlike post" : "Like post"}
                      >
                        <Heart className={`h-5 w-5 ${post.liked_by_current_user ? (isBrutalist ? "fill-[#ff7a1a]" : "fill-rose-500") : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openPeopleModal(post, "like", "Liked by")}
                        disabled={post.likes_count === 0}
                        className={`px-1 py-2 text-sm font-black disabled:opacity-40 ${
                          isBrutalist ? "text-[#ffb36b]" : "text-rose-600 disabled:text-slate-400"
                        }`}
                      >
                        {post.likes_count}
                      </button>
                      <Link
                        href={postHref}
                        className={`inline-flex items-center justify-center gap-1.5 transition ${
                          isBrutalist ? "text-white/65 hover:text-[#ffb36b]" : "rounded-2xl bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 sm:px-3 sm:text-sm"
                        }`}
                      >
                        <MessageCircle className="h-5 w-5" />
                        {post.comments_count}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEngagement(post, "save", !post.saved_by_current_user)}
                      className={`inline-flex items-center justify-center transition ${
                        post.saved_by_current_user
                          ? isBrutalist
                            ? "text-[#ff7a1a]"
                            : "bg-blue-50 text-blue-600"
                          : isBrutalist
                          ? "text-white/65 hover:text-[#ffb36b]"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label={post.saved_by_current_user ? "Unsave post" : "Save post"}
                    >
                      <Bookmark className={`h-5 w-5 ${post.saved_by_current_user ? (isBrutalist ? "fill-[#ff7a1a]" : "fill-blue-500") : ""}`} />
                    </button>
                  </div>
                </div>
              </article>

              {index === 1 && renderTrendingListsSection()}
            </div>
          );
        })}
      </div>
      )}

      {peopleModalTitle && (
        <PeopleModal
          title={peopleModalTitle}
          users={peopleModalUsers}
          loading={peopleModalLoading}
          theme={theme}
          onClose={() => {
            setPeopleModalTitle("");
            setPeopleModalUsers([]);
          }}
        />
      )}
    </>
  );
}
