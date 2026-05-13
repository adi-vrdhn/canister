"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, CalendarDays, Film, PlayCircle } from "lucide-react";
import CinematicLoading from "@/components/CinematicLoading";
import PageLayout from "@/components/PageLayout";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getShowDetails, type ShowDetails } from "@/lib/tvmaze";
import { getSeasonEpisodes, getShowSeasons, type TVMazeEpisode, type TVMazeSeason } from "@/lib/tvmaze-seasons";
import { User } from "@/types";

function formatYear(dateStr?: string): string {
  if (!dateStr) return "";
  const year = new Date(dateStr).getFullYear();
  return Number.isNaN(year) ? dateStr : String(year);
}

export default function TvSeasonsPage() {
  const router = useRouter();
  const params = useParams();
  const showId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [seasons, setSeasons] = useState<TVMazeSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<TVMazeSeason | null>(null);
  const [episodes, setEpisodes] = useState<TVMazeEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        const userData = userSnapshot.val();
        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        const numericShowId = Number(showId);
        if (!numericShowId || Number.isNaN(numericShowId)) {
          setLoading(false);
          return;
        }

        const [showDetails, seasonList] = await Promise.all([
          getShowDetails(numericShowId),
          getShowSeasons(numericShowId),
        ]);

        setShow(showDetails);
        setSeasons(seasonList);
        setSelectedSeason(seasonList[0] || null);
        setLoading(false);
      } catch (error) {
        console.error("Error loading TV seasons:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, showId]);

  useEffect(() => {
    if (!selectedSeason) {
      setEpisodes([]);
      return;
    }

    let cancelled = false;
    const loadEpisodes = async () => {
      try {
        setLoadingEpisodes(true);
        const seasonEpisodes = await getSeasonEpisodes(selectedSeason);
        if (!cancelled) {
          setEpisodes(seasonEpisodes);
        }
      } catch (error) {
        console.error("Error loading season episodes:", error);
        if (!cancelled) {
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEpisodes(false);
        }
      }
    };

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeason]);

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  if (loading || !user) {
    return <CinematicLoading message="Loading season guide" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/tv/${showId}`}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to show
        </Link>

        <section className="rounded-[2rem] border border-white/10 bg-[#111111] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="mx-auto w-full max-w-44 overflow-hidden border border-white/10 bg-white/5 sm:mx-0">
              {show?.poster_url ? (
                <img
                  src={show.poster_url}
                  alt={show.title || show.name}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-white/5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ffb36b]">Season guide</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[#f5f0de] sm:text-5xl">
                {show?.title || show?.name || "TV Show"}
              </h1>
              {show?.overview && (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
                  {show.overview}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/70">
                {show?.rating?.average ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Rating {show.rating.average.toFixed(1)}
                  </span>
                ) : null}
                {show?.runtime ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {show.runtime} min episodes
                  </span>
                ) : null}
                {show?.network?.name ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {show.network.name}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#f5f0de]">Seasons</h2>
              <p className="text-sm text-white/55">Pick a season to browse its episodes.</p>
            </div>
            <span className="text-xs text-white/45">{seasons.length} seasons</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((season) => {
              const isSelected = selectedSeason?.id === season.id;
              return (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => setSelectedSeason(season)}
                  className={`text-left transition ${
                    isSelected
                      ? "border-[#ff7a1a]/50 bg-[#ff7a1a]/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                  } rounded-[1.5rem] border p-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffb36b]">Season {season.number}</p>
                      <p className="mt-1 text-lg font-bold text-[#f5f0de]">{season.name}</p>
                    </div>
                    <Film className={`h-5 w-5 ${isSelected ? "text-[#ffb36b]" : "text-white/35"}`} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                    {season.premiereDate ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatYear(season.premiereDate)}
                      </span>
                    ) : null}
                    {season.episodeOrder ? (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                        {season.episodeOrder} episodes
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#111111] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#f5f0de]">
                {selectedSeason ? selectedSeason.name : "Episodes"}
              </h2>
              <p className="text-sm text-white/55">
                {selectedSeason ? `Season ${selectedSeason.number}` : "Choose a season to see episodes."}
              </p>
            </div>
            <span className="text-xs text-white/45">{episodes.length} episodes</span>
          </div>

          {loadingEpisodes ? (
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : episodes.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffb36b]">
                      Episode {episode.number}
                    </p>
                    <p className="mt-1 truncate text-lg font-bold text-[#f5f0de]">{episode.name}</p>
                    <p className="mt-1 text-sm text-white/55">
                      {episode.airdate || "Date unavailable"}
                      {episode.runtime ? ` • ${episode.runtime} min` : ""}
                    </p>
                  </div>
                  <PlayCircle className="h-6 w-6 flex-shrink-0 text-white/30" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
              No episodes found for this season.
            </div>
          )}
        </section>
      </main>
    </PageLayout>
  );
}
