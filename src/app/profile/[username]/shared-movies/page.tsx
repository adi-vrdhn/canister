"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { ArrowLeft, Film, Search } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { getUserByUsername } from "@/lib/profile";
import CinematicLoading from "@/components/CinematicLoading";
import type { Content, ShareWithDetails, User } from "@/types";
import { canShowSharedMovies, isUsernameBlocked, mergeSettings } from "@/lib/settings";

type Filter = "all" | "movie" | "tv";
type Item = { key: string; shareId: string; content: Content; title: string; type: "movie" | "tv"; sharedBy: string; note?: string | null; watched?: boolean };

export default function SharedMoviesPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [shares, setShares] = useState<ShareWithDetails[]>([]);
  const [canAccessPage, setCanAccessPage] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [removingShareId, setRemovingShareId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return window.location.assign("/auth/login");
      try {
        const currentUserSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        if (!currentUserSnapshot.exists()) return window.location.assign("/profile/edit");

        const currentUserData = currentUserSnapshot.val();
        const currentSettings = mergeSettings(currentUserData?.settings);
        const me: User = {
          id: currentUserData?.id || firebaseUser.uid,
          username: currentUserData?.username || "user",
          name: currentUserData?.name || firebaseUser.displayName || "User",
          email: currentUserData?.email || firebaseUser.email || undefined,
          avatar_url: currentUserData?.avatar_url || null,
          created_at: currentUserData?.createdAt || new Date().toISOString(),
          bio: currentUserData?.bio || "",
        };

        const viewed = await getUserByUsername(username);
        if (!viewed) return window.location.assign("/dashboard");

        const usersSnapshot = await get(ref(db, "users"));
        const usersData = usersSnapshot.val() || {};
        const viewedRaw = Object.values(usersData).find(
          (entry: any) => entry?.id === viewed.id || entry?.username === viewed.username
        );
        const viewedSettings = mergeSettings((viewedRaw as any)?.settings);

        const followsSnapshot = await get(ref(db, "follows"));
        const followsData = followsSnapshot.val() || {};
        const isFollowingViewed = Object.values(followsData).some(
          (follow: any) =>
            follow?.follower_id === me.id &&
            follow?.following_id === viewed.id &&
            follow?.status === "accepted"
        );

        const blockedByProfile = isUsernameBlocked(viewedSettings, me.username);
        const blockingProfile = isUsernameBlocked(currentSettings, viewed.username);
        const canViewShared = canShowSharedMovies(viewedSettings, false, isFollowingViewed);

        setCurrentUser(me);
        setProfileUser(viewed);

        if (blockedByProfile || blockingProfile || !canViewShared) {
          setCanAccessPage(false);
          setShares([]);
          setLoading(false);
          return;
        }

        setCanAccessPage(true);

        const unsubscribeShares = onValue(ref(db, "shares"), async (snapshot) => {
          if (!snapshot.exists()) {
            setShares([]);
            return;
          }

          const usersSnapshot = await get(ref(db, "users"));
          const usersData = usersSnapshot.val() || {};
          const allShares = snapshot.val();
          const relevant = Object.entries(allShares)
            .map(([id, data]: any) => ({ id, ...data }))
            .filter((share: any) =>
              (share.sender_id === me.id && share.receiver_id === viewed.id) ||
              (share.sender_id === viewed.id && share.receiver_id === me.id)
            )
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((share: any) => ({
              ...share,
              movie: share.movie || null,
              content: share.content || share.movie || null,
              sender: Object.values(usersData).find((u: any) => u.id === share.sender_id),
              receiver: Object.values(usersData).find((u: any) => u.id === share.receiver_id),
            })) as ShareWithDetails[];

          setShares(relevant);
        });

        setLoading(false);
        return () => unsubscribeShares();
      } catch (error) {
        console.error("Error loading shared movies page:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username]);

  const makeItem = useCallback((share: ShareWithDetails, direction: "byYou" | "byThem"): Item | null => {
    const content = (share.content || share.movie) as Content | null;
    if (!content) return null;
    return {
      key: `${direction}-${share.id}`,
      shareId: share.id,
      content,
      title: (content as any).title || (content as any).name || "Untitled",
      type: (share.content_type || (content as any).type || "movie") as "movie" | "tv",
      sharedBy: direction === "byYou" ? currentUser?.name || "You" : profileUser?.name || "Them",
      note: share.note || null,
      watched: share.watched,
    };
  }, [currentUser?.name, profileUser?.name]);

  const sections = useMemo(() => {
    const byYou = shares.map((s) => (s.sender_id === currentUser?.id && s.receiver_id === profileUser?.id ? makeItem(s, "byYou") : null)).filter(Boolean) as Item[];
    const byThem = shares.map((s) => (s.sender_id === profileUser?.id && s.receiver_id === currentUser?.id ? makeItem(s, "byThem") : null)).filter(Boolean) as Item[];

    const q = query.trim().toLowerCase();
    const matches = (item: Item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.sharedBy.toLowerCase().includes(q);
    };

    return {
      byYou: byYou.filter(matches),
      byThem: byThem.filter(matches),
    };
  }, [shares, currentUser?.id, profileUser?.id, query, filter, makeItem]);

  const handleRemoveShared = async (shareId: string) => {
    try {
      setRemovingShareId(shareId);
      await remove(ref(db, `shares/${shareId}`));
    } catch (error) {
      console.error("Error removing shared item:", error);
    } finally {
      setRemovingShareId(null);
    }
  };

  const SharedRail = ({
    title,
    subtitle,
    items,
    allowRemove,
  }: {
    title: string;
    subtitle: string;
    items: Item[];
    allowRemove?: boolean;
  }) => (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#f5f0de] sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm text-[#f5f0de]/60">{subtitle}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold text-[#ffb36b]">
          {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-[#f5f0de]/55">No shared titles here yet.</p>
      ) : (
        <div className="scrollbar-hide -mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2">
          {items.map((item) => (
            <article
              key={item.key}
              className="group shrink-0 snap-start basis-[44%] sm:basis-[30%] md:basis-[24%] lg:basis-[19%] xl:basis-[18%]"
            >
              <Link href={item.type === "movie" ? `/movie/${item.content.id}` : `/tv/${item.content.id}`} className="block">
                <div className="relative overflow-hidden rounded-[1.4rem] border border-white/8 bg-white/5 shadow-[0_14px_35px_rgba(0,0,0,0.3)] transition duration-300 group-hover:-translate-y-1 group-hover:border-[#ff7a1a]/30">
                  <div className="relative aspect-[2/3] w-full">
                    {item.content.poster_url ? (
                      <img src={item.content.poster_url} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#111111] text-sm text-[#f5f0de]/45">No poster</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                        {item.type === "movie" ? "Movie" : "TV"}
                      </span>
                      {item.watched && (
                        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#f5f0de]">
                          Watched
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-sm font-black leading-5 text-[#f5f0de]">{item.title}</p>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="mt-3 space-y-1 px-1">
                <p className="text-xs uppercase tracking-[0.16em] text-[#ffb36b]">Shared by {item.sharedBy}</p>
                {item.note && <p className="line-clamp-2 text-xs leading-5 text-[#f5f0de]/65">{item.note}</p>}
                {allowRemove && (
                  <button
                    onClick={() => handleRemoveShared(item.shareId)}
                    disabled={removingShareId === item.shareId}
                    className="inline-flex text-xs font-bold text-[#ffb36b] transition hover:text-[#ff7a1a] disabled:opacity-50"
                  >
                    {removingShareId === item.shareId ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  if (loading || !currentUser || !profileUser) {
    return <CinematicLoading message="Shared movies are loading" />;
  }

  if (!canAccessPage) {
    return (
      <div className="brutalist min-h-screen bg-[#0a0a0a] bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.16),_transparent_38%)] text-[#f5f0de]">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full rounded-[1.5rem] border border-white/10 bg-[#111111] p-6 text-center shadow-2xl sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffb36b]/75">Shared movies locked</p>
            <h1 className="mt-3 text-3xl font-black text-[#f5f0de] sm:text-4xl">
              This shared-movies view is not available.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#f5f0de]/60 sm:text-base">
              The profile owner has hidden shared movies, or one of you has blocked the other.
            </p>
            <button
              onClick={() => router.push(`/profile/${profileUser.username}`)}
              className="mt-6 rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8d33]"
            >
              Back to profile
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="brutalist min-h-screen bg-[#0a0a0a] bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.16),_transparent_38%)] text-[#f5f0de]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <button
              onClick={() => router.push(`/profile/${profileUser.username}`)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Profile
            </button>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-[#ffb36b]">
                <Film className="h-3.5 w-3.5" />
                Shared Movies
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-[#f5f0de] sm:text-4xl">
                Shared titles between {currentUser.name} and {profileUser.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[#f5f0de]/65 sm:text-base">
                Browse what you shared with each other, search by title, and keep the feed clean without heavy panels.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffb36b]">Shared by you</p>
              <p className="mt-1 text-2xl font-black text-[#f5f0de]">{sections.byYou.length}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffb36b]">Shared by them</p>
              <p className="mt-1 text-2xl font-black text-[#f5f0de]">{sections.byThem.length}</p>
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shared titles or names..."
              className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]/50 focus:ring-2 focus:ring-[#ff7a1a]/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "movie", "tv"] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filter === item
                    ? "bg-[#ff7a1a] text-black"
                    : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                {item === "all" ? "All" : item === "movie" ? "Movies" : "TV Shows"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          <SharedRail title="Shared by you" subtitle={`Titles you sent to ${profileUser.name}.`} items={sections.byYou} allowRemove />
          <SharedRail title="Shared by them" subtitle={`Titles ${profileUser.name} shared with you.`} items={sections.byThem} />
        </div>

        <div className="mt-10 border-t border-white/10 pt-4 text-sm text-white/40">
          Tip: drag the poster rail sideways or use the trackpad to browse more titles.
        </div>
      </div>
    </div>
  );
}
