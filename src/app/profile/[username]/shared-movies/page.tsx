"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { ArrowLeft, Film, Search, Sparkles } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { getUserByUsername } from "@/lib/profile";
import CinematicLoading from "@/components/CinematicLoading";
import type { Content, ShareWithDetails, User } from "@/types";

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

        setCurrentUser(me);
        setProfileUser(viewed);

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

  const makeItem = (share: ShareWithDetails, direction: "byYou" | "byThem"): Item | null => {
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
  };

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
  }, [shares, currentUser?.id, profileUser?.id, query, filter]);

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

  if (loading || !currentUser || !profileUser) {
    return <CinematicLoading message="Shared movies are loading" />;
  }

  const Section = ({
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
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-zinc-800">{items.length}</div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-zinc-600">No shared titles here yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.key} className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <Link href={item.type === "movie" ? `/movie/${item.content.id}` : `/tv/${item.content.id}`}>
                <div className="relative aspect-[2/3] w-full bg-gray-100">
                  {item.content.poster_url ? <img src={item.content.poster_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">No poster</div>}
                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className="rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white">{item.type === "movie" ? "Movie" : "TV"}</span>
                    {item.watched && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">Watched</span>}
                  </div>
                </div>
              </Link>
              <div className="p-4">
                <Link href={item.type === "movie" ? `/movie/${item.content.id}` : `/tv/${item.content.id}`}>
                  <p className="line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:text-zinc-700">{item.title}</p>
                </Link>
                <p className="mt-1 text-xs text-zinc-500">Shared by {item.sharedBy}</p>
                {item.note && <p className="mt-2 line-clamp-2 text-xs text-zinc-600 italic">{item.note}</p>}

                {allowRemove && (
                  <button
                    onClick={() => handleRemoveShared(item.shareId)}
                    disabled={removingShareId === item.shareId}
                    className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {removingShareId === item.shareId ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button onClick={() => router.push(`/profile/${profileUser.username}`)} className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4" /> Back to Profile
        </button>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-sky-600" />
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Shared Movies</h1>
              </div>
              <p className="mt-2 text-sm text-zinc-600">Shared titles between <span className="font-semibold text-zinc-900">{currentUser.name}</span> and <span className="font-semibold text-zinc-900">{profileUser.name}</span>.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center"><p className="text-xs font-medium uppercase tracking-wide text-sky-700">Shared by you</p><p className="text-2xl font-bold text-sky-900">{sections.byYou.length}</p></div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-center"><p className="text-xs font-medium uppercase tracking-wide text-violet-700">Shared by them</p><p className="text-2xl font-bold text-violet-900">{sections.byThem.length}</p></div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-600"><Sparkles className="h-4 w-4 text-indigo-600" /><span>Browse what you shared with each other.</span></div>
        </section>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shared titles or names..." className="w-full rounded-2xl border border-gray-300 bg-white py-3 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:w-auto sm:min-w-[320px]">
              {(["all", "movie", "tv"] as Filter[]).map((item) => (
                <button key={item} onClick={() => setFilter(item)} className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${filter === item ? "bg-zinc-900 text-white" : "bg-gray-50 text-zinc-700 hover:bg-gray-100"}`}>{item === "all" ? "All" : item === "movie" ? "Movies" : "TV Shows"}</button>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <Section title="Shared by you" subtitle={`Titles you sent to ${profileUser.name}.`} items={sections.byYou} allowRemove />
          <Section title="Shared by them" subtitle={`Titles ${profileUser.name} shared with you.`} items={sections.byThem} />
        </div>
      </div>
    </div>
  );
}
