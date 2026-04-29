"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Sparkles, X } from "lucide-react";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import CinePostArtwork from "@/components/CinePostArtwork";
import { CinePostEngagementType, CinePostWithDetails, Content, TMDBMovie, User } from "@/types";
import {
  getCinePostEngagementUsers,
  getCinePosts,
  setCinePostEngagement,
} from "@/lib/cineposts";
import { getPublicLists, getListWithDetails } from "@/lib/lists";
import { getPopularMovies } from "@/lib/tmdb";
import { getTasteBasedPopularMovies } from "@/lib/movie-recommendations";
import { db } from "@/lib/firebase";
import { get, ref } from "firebase/database";

interface CinePostsFeedProps {
  currentUser: User | null;
  refreshKey?: number;
  theme?: "default" | "brutalist";
}

const PREVIEW_LIMIT = 150;

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
  if (post.list_id && post.content_type === "list") return `/lists/${post.list_id}`;
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

type RailItem = {
  id: string;
  label: string;
  href: string;
  posterUrl: string | null;
  meta: string;
};

type DiscoverListItem = {
  id: string;
  name: string;
  href: string;
  coverImage: string | null;
  description: string | null;
};

function tmdbPosterUrl(path: string | null): string | null {
  return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

function buildPopularRailItems(items: TMDBMovie[]): RailItem[] {
  return items.map((item) => ({
    id: String(item.id),
    label: item.title,
    href: `/movie/${item.id}`,
    posterUrl: tmdbPosterUrl(item.poster_path),
    meta: item.vote_average ? `TMDB ${item.vote_average.toFixed(1)}` : "Popular",
  }));
}

function buildSuggestedRailItems(items: Content[]): RailItem[] {
  return items.map((item) => ({
    id: String(item.id),
    label: item.title || (item as any).name || "Untitled",
    href: item.type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`,
    posterUrl: item.poster_url || null,
    meta: item.type === "tv" ? "Suggested show" : "Suggested movie",
  }));
}

function buildDiscoverListScore(list: {
  item_count: number;
  collaborator_count: number;
  items: Array<{ watched_by?: string[] }>;
}): number {
  const watchSignal = list.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);
  return list.item_count * 2 + list.collaborator_count * 3 + watchSignal;
}

function buildDiscoverListItems(allLists: DiscoverListItem[]): DiscoverListItem[] {
  return allLists;
}

function scrollRail(ref: { current: HTMLDivElement | null }, direction: -1 | 1) {
  const node = ref.current;
  if (!node) return;
  const amount = Math.max(node.clientWidth * 0.88, 320);
  node.scrollBy({ left: amount * direction, behavior: "smooth" });
}

function DiscoveryRail({
  title,
  items,
  loading,
  emptyLabel,
  railRef,
  theme = "default",
  onLeft,
  onRight,
  showButtons = true,
}: {
  title: string;
  items: RailItem[];
  loading: boolean;
  emptyLabel: string;
  railRef: { current: HTMLDivElement | null };
  theme?: "default" | "brutalist";
  onLeft?: () => void;
  onRight?: () => void;
  showButtons?: boolean;
}) {
  const isBrutalist = theme === "brutalist";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
            {title}
          </h3>
        </div>
        {showButtons && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLeft}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                isBrutalist
                  ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              aria-label={`Scroll ${title.toLowerCase()} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRight}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                isBrutalist
                  ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              aria-label={`Scroll ${title.toLowerCase()} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="grid grid-flow-col gap-3 overflow-x-auto scroll-smooth pb-1 pr-1 scrollbar-hide snap-x snap-mandatory auto-cols-[7.5rem] sm:auto-cols-[8rem] lg:auto-cols-[calc((100%-3rem)/5)]"
      >
        {loading ? (
          Array.from({ length: 10 }).map((_, index) => (
            <div key={`${title}-skeleton-${index}`} className="snap-start">
              <div className="aspect-[2/3] overflow-hidden bg-white/5">
                <div className="h-full w-full animate-pulse bg-white/10" />
              </div>
              <div className="mt-2 h-3 w-4/5 animate-pulse bg-white/10" />
              <div className="mt-2 h-2 w-2/5 animate-pulse bg-white/5" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className={`py-3 text-sm ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="snap-start">
              <div className="group">
                <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.label}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/35">No poster</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-8">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#f5f0de]">{item.label}</p>
                  </div>
                </div>
                <p className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${isBrutalist ? "text-white/35" : "text-slate-400"}`}>
                  {item.meta}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function DiscoverListRail({
  items,
  loading,
  emptyLabel,
  railRef,
  theme = "default",
  onLeft,
  onRight,
}: {
  items: DiscoverListItem[];
  loading: boolean;
  emptyLabel: string;
  railRef: { current: HTMLDivElement | null };
  theme?: "default" | "brutalist";
  onLeft?: () => void;
  onRight?: () => void;
}) {
  const isBrutalist = theme === "brutalist";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
            Discover Lists
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeft}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
              isBrutalist
                ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
            aria-label="Scroll discover lists left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRight}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
              isBrutalist
                ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
            aria-label="Scroll discover lists right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="grid grid-flow-col gap-3 overflow-x-auto scroll-smooth pb-1 pr-1 scrollbar-hide snap-x snap-mandatory auto-cols-[7.5rem] sm:auto-cols-[8rem] lg:auto-cols-[calc((100%-3rem)/5)]"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={`discover-skeleton-${index}`} className="snap-start">
              <div className="aspect-[2/3] overflow-hidden bg-white/5">
                <div className="h-full w-full animate-pulse bg-white/10" />
              </div>
              <div className="mt-2 h-3 w-4/5 animate-pulse bg-white/10" />
              <div className="mt-2 h-2 w-2/5 animate-pulse bg-white/5" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className={`py-3 text-sm ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="snap-start">
              <div className="group">
                <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/35">No poster</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-8">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#f5f0de]">{item.name}</p>
                  </div>
                </div>
                <p className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${isBrutalist ? "text-white/35" : "text-slate-400"}`}>
                  Public list
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
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
  const popularRailRef = useRef<HTMLDivElement | null>(null);
  const suggestedRailRef = useRef<HTMLDivElement | null>(null);
  const discoverRailRef = useRef<HTMLDivElement | null>(null);
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [popularMovies, setPopularMovies] = useState<RailItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [suggestedMovies, setSuggestedMovies] = useState<RailItem[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [discoverLists, setDiscoverLists] = useState<DiscoverListItem[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
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

  useEffect(() => {
    let cancelled = false;

    const loadDiscoveryRails = async () => {
      setPopularLoading(true);
      setSuggestedLoading(true);
      setDiscoverLoading(true);

      try {
        const [popular, suggested, publicListsBase, usersSnapshot] = await Promise.all([
          getPopularMovies(1, 10),
          currentUser?.id ? getTasteBasedPopularMovies(currentUser.id, 10) : Promise.resolve([]),
          getPublicLists(8),
          get(ref(db, "users")),
        ]);

        if (cancelled) return;

        setPopularMovies(buildPopularRailItems(popular));
        setSuggestedMovies(buildSuggestedRailItems(suggested));

        const allUsers = usersSnapshot.exists() ? usersSnapshot.val() : {};
        const detailedLists = await Promise.all(
          publicListsBase.slice(0, 5).map(async (list) => {
            const details = await getListWithDetails(list.id, allUsers);
            if (!details) return null;
            return {
              id: details.id,
              name: details.name,
              href: `/lists/${details.id}`,
              coverImage: details.cover_image_url || details.items[0]?.content?.poster_url || null,
              description: details.description,
              item_count: details.item_count,
              collaborator_count: details.collaborator_count,
              items: details.items,
            };
          })
        );

        const sortedLists = detailedLists
          .filter(Boolean)
          .sort((a, b) => buildDiscoverListScore(b as any) - buildDiscoverListScore(a as any))
          .map((list) => ({
            id: (list as any).id,
            name: (list as any).name,
            href: (list as any).href,
            coverImage: (list as any).coverImage,
            description: (list as any).description,
          }));

        setDiscoverLists(sortedLists);
      } catch (error) {
        console.error("Error loading discovery rails:", error);
      } finally {
        if (!cancelled) {
          setPopularLoading(false);
          setSuggestedLoading(false);
          setDiscoverLoading(false);
        }
      }
    };

    loadDiscoveryRails();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

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

  const renderPopularSection = () => (
    <div className="pt-6">
      <DiscoveryRail
        title="Popular Movies"
        items={popularMovies}
        loading={popularLoading}
        emptyLabel="Popular movies will appear here soon."
        railRef={popularRailRef}
        theme={theme}
        onLeft={() => scrollRail(popularRailRef, -1)}
        onRight={() => scrollRail(popularRailRef, 1)}
      />
    </div>
  );

  const renderSuggestedSection = () => (
    <div className="pt-6">
      <DiscoveryRail
        title="Suggested Movies"
        items={suggestedMovies}
        loading={suggestedLoading}
        emptyLabel={currentUser?.id ? "Suggested movies will appear here soon." : "Sign in to get personalized suggestions."}
        railRef={suggestedRailRef}
        theme={theme}
        onLeft={() => scrollRail(suggestedRailRef, -1)}
        onRight={() => scrollRail(suggestedRailRef, 1)}
      />
    </div>
  );

  const renderDiscoverSection = () => (
    <div className="pt-6">
      <DiscoverListRail
        items={discoverLists}
        loading={discoverLoading}
        emptyLabel="Public lists will appear here soon."
        railRef={discoverRailRef}
        theme={theme}
        onLeft={() => scrollRail(discoverRailRef, -1)}
        onRight={() => scrollRail(discoverRailRef, 1)}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {(loading || posts.length === 0) && (
          <div className="space-y-6">
            <div className="space-y-6">
              <DiscoveryRail
                title="Popular Movies"
                items={popularMovies}
                loading={popularLoading}
                emptyLabel="Popular movies will appear here soon."
                railRef={popularRailRef}
                theme={theme}
                onLeft={() => scrollRail(popularRailRef, -1)}
                onRight={() => scrollRail(popularRailRef, 1)}
              />
              <DiscoveryRail
                title="Suggested Movies"
                items={suggestedMovies}
                loading={suggestedLoading}
                emptyLabel={currentUser?.id ? "Suggested movies will appear here soon." : "Sign in to get personalized suggestions."}
                railRef={suggestedRailRef}
                theme={theme}
                onLeft={() => scrollRail(suggestedRailRef, -1)}
                onRight={() => scrollRail(suggestedRailRef, 1)}
              />
              <DiscoverListRail
                items={discoverLists}
                loading={discoverLoading}
                emptyLabel="Public lists will appear here soon."
                railRef={discoverRailRef}
                theme={theme}
                onLeft={() => scrollRail(discoverRailRef, -1)}
                onRight={() => scrollRail(discoverRailRef, 1)}
              />
            </div>
          </div>
        )}

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
          const shouldIgnorePostClick = (target: EventTarget | null) => {
            if (!(target instanceof Element)) return false;
            return Boolean(target.closest("a,button,[role='button'],input,textarea,select,label"));
          };

          return (
            <div key={post.id} className={isBrutalist ? "py-5 sm:py-6" : "space-y-4"}>
              <article
                className={`cursor-pointer ${isBrutalist ? "bg-black text-[#f5f0de]" : "overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"}`}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if (shouldIgnorePostClick(event.target)) return;
                  router.push(postHref);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(postHref);
                  }
                }}
              >
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
                      onClick={(event) => event.stopPropagation()}
                    >
                      <CinePostArtwork
                        src={post.poster_url}
                        collageImages={post.list_cover_images}
                        alt={post.content_title || post.anchor_label}
                        className="h-full w-full"
                        mediaClassName="transition duration-300 group-hover:scale-105"
                        theme={theme}
                      />
                    </Link>
                  ) : (
                    <div className={`aspect-[2/3] overflow-hidden shadow-sm ${
                      isBrutalist ? "bg-black" : "rounded-[1.4rem] bg-slate-950"
                    }`}>
                      <CinePostArtwork
                        src={post.poster_url}
                        collageImages={post.list_cover_images}
                        alt={post.content_title || post.anchor_label}
                        className="h-full w-full"
                        mediaClassName="transition duration-300 group-hover:scale-105"
                        theme={theme}
                      />
                    </div>
                  )}

                    <div className="min-w-0 py-1">
                      <div className="flex items-start gap-3">
                        <Link href={profileHref(post.user)} className="flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                          <Avatar user={post.user} size="h-7 w-7 sm:h-8 sm:w-8" dark={isBrutalist} />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <Link
                              href={profileHref(post.user)}
                              onClick={(event) => event.stopPropagation()}
                              className={`text-[13px] font-black leading-none sm:text-sm ${isBrutalist ? "text-[#f5f0de] hover:text-[#ffb36b]" : "text-slate-950 hover:text-[#f5f0de]"}`}
                            >
                              {post.user.name}
                            </Link>
                            <span className={`text-[10px] sm:text-xs ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>{relativeTime(post.created_at)}</span>
                          </div>
                        </div>
                        <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                          <CinePostOwnerMenu
                            post={post}
                            currentUser={currentUser}
                            onDeleted={refreshPosts}
                            onUpdated={refreshPosts}
                            theme={theme}
                          />
                        </div>
                      </div>

                      <Link href={postHref} className="mt-2 block sm:mt-3" onClick={(event) => event.stopPropagation()}>
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
                            isBrutalist ? "text-[#ffb36b]" : "text-[#f5f0de]"
                          }`}
                          onClick={(event) => event.stopPropagation()}
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
                        onMouseDown={(event) => event.stopPropagation()}
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
                        onMouseDown={(event) => event.stopPropagation()}
                        disabled={post.likes_count === 0}
                        className={`px-1 py-2 text-sm font-black disabled:opacity-40 ${
                          isBrutalist ? "text-[#ffb36b]" : "text-rose-600 disabled:text-slate-400"
                        }`}
                      >
                        {post.likes_count}
                      </button>
                      <Link
                        href={postHref}
                        onClick={(event) => event.stopPropagation()}
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
                      onMouseDown={(event) => event.stopPropagation()}
                      className={`inline-flex items-center justify-center transition ${
                        post.saved_by_current_user
                          ? isBrutalist
                            ? "text-[#ff7a1a]"
                            : "bg-blue-50 text-[#f5f0de]"
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

              {index === 2 && renderPopularSection()}
              {index === 5 && renderSuggestedSection()}
              {index === 8 && renderDiscoverSection()}
            </div>
          );
        })}
          </div>
        )}
      </div>

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
