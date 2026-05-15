"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, PlayCircle, Star } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import LogMovieModal from "@/components/LogMovieModal";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getShowDetails, type ShowDetails } from "@/lib/tvmaze";
import { getSeasonEpisodes, getShowSeasons, type TVMazeEpisode, type TVMazeSeason } from "@/lib/tvmaze-seasons";
import type { Content, User } from "@/types";

function formatYear(dateStr?: string): string {
  if (!dateStr) return "";
  const year = new Date(dateStr).getFullYear();
  return Number.isNaN(year) ? dateStr : String(year);
}

function getEpisodeLabel(episode: TVMazeEpisode): string {
  return `Episode ${episode.number}${episode.name ? ` - ${episode.name}` : ""}`;
}

export default function TvSeasonPage() {
  const router = useRouter();
  const params = useParams();
  const showId = params.id as string;
  const seasonParam = params.season as string;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [seasons, setSeasons] = useState<TVMazeSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<TVMazeSeason | null>(null);
  const [episodes, setEpisodes] = useState<TVMazeEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);

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

        const numericSeason = Number(seasonParam);
        const matchingSeason = seasonList.find((season) => season.number === numericSeason) || seasonList[0] || null;

        setShow(showDetails);
        setSeasons(seasonList);
        setSelectedSeason(matchingSeason);
        setLoading(false);
      } catch (error) {
        console.error("Error loading TV season page:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, seasonParam, showId]);

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

  const seasonContent = useMemo<Content | null>(() => {
    if (!show) return null;
    return show as unknown as Content;
  }, [show]);

  if (loading || !user) {
    return <CinematicLoading message="Loading season page" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/tv/${showId}/seasons`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to seasons
          </Link>
          <Link
            href={`/tv/${showId}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to show
          </Link>
        </div>

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
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ffb36b]">Season page</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[#f5f0de] sm:text-5xl">
                {show?.title || show?.name || "TV Show"}
              </h1>
              <p className="mt-2 text-lg font-semibold text-[#ffb36b]">
                {selectedSeason ? selectedSeason.name : `Season ${seasonParam}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/70">
                {selectedSeason?.premiereDate ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {formatYear(selectedSeason.premiereDate)}
                  </span>
                ) : null}
                {selectedSeason?.episodeOrder ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {selectedSeason.episodeOrder} episodes
                  </span>
                ) : null}
                {show?.runtime ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {show.runtime} min episodes
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogMovieModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
                >
                  <Star className="h-4 w-4" />
                  Rate this season
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#111111] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#f5f0de]">
                {selectedSeason ? selectedSeason.name : "Episodes"}
              </h2>
              <p className="text-sm text-white/55">
                {selectedSeason ? `Season ${selectedSeason.number}` : "No season selected."}
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
                      {getEpisodeLabel(episode)}
                    </p>
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

        {seasonContent && (
          <LogMovieModal
            isOpen={showLogMovieModal}
            onClose={() => setShowLogMovieModal(false)}
            content={seasonContent}
            user={user}
            initialTvScope={selectedSeason?.number ?? "all"}
            initialTvEpisodeChoice="all"
            onLogCreated={() => {
              setShowLogMovieModal(false);
            }}
          />
        )}
      </main>
    </PageLayout>
  );
}
