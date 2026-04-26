"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Sparkles,
  Users,
} from "lucide-react";
import type { MatchAnalysis } from "@/lib/match-score";

type MovieMatchAnalysisViewProps = {
  analysis: any;
  viewerName: string;
  subjectName: string;
  subjectUsername?: string;
  onBack?: () => void;
  onClose?: () => void;
  embedded?: boolean;
};

type PosterItem = MatchAnalysis["commonTasteMovies"][number];

function PosterRail({
  title,
  subtitle,
  items,
  accent = "orange",
}: {
  title: string;
  subtitle: string;
  items: PosterItem[];
  accent?: "orange" | "amber";
}) {
  const glowClass =
    accent === "orange"
      ? "shadow-[0_24px_48px_rgba(255,122,26,0.18)] hover:shadow-[0_28px_60px_rgba(255,122,26,0.28)]"
      : "shadow-[0_24px_48px_rgba(251,191,36,0.16)] hover:shadow-[0_28px_60px_rgba(251,191,36,0.26)]";

  return (
    <section className="border-t border-white/10 pt-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
            {title}
          </p>
          <p className="mt-2 text-sm text-white/55">{subtitle}</p>
        </div>
        <p className="text-xs uppercase tracking-[0.35em] text-white/35">
          {items.length} titles
        </p>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="flex w-fit gap-3">
            {items.map((movie) => (
              <Link
                key={`${movie.type}-${movie.id}`}
                href={movie.type === "tv" ? `/tv/${movie.id}` : `/movie/${movie.id}`}
                className={`group relative w-28 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.03] transition duration-300 hover:-translate-y-1 hover:rotate-[-0.4deg] hover:border-[#ff7a1a]/35 ${glowClass}`}
              >
                <div className="relative aspect-[2/3]">
                  <img
                    src={
                      movie.poster_url
                        ? `https://image.tmdb.org/t/p/w342${movie.poster_url}`
                        : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='342' height='513'%3E%3Crect fill='%23111111' width='342' height='513'/%3E%3C/svg%3E"
                    }
                    alt={movie.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  {movie.type === "tv" && (
                    <span className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/65 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#f5f0de]">
                      TV
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-white">
                      {movie.title}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/45">Nothing shared here yet.</p>
      )}
    </section>
  );
}

export default function MovieMatchAnalysisView({
  analysis,
  viewerName,
  subjectName,
  subjectUsername,
  onBack,
  onClose,
  embedded = false,
}: MovieMatchAnalysisViewProps) {
  const commonTasteMovies = analysis.commonTasteMovies || [];
  const commonMasterpieceMovies = analysis.commonMasterpieceMovies || [];

  return (
    <div
      className={`relative overflow-x-hidden text-[#f5f0de] ${
        embedded
          ? "h-full overflow-y-auto overscroll-contain bg-transparent"
          : "min-h-screen overflow-y-auto bg-[#090909]"
      }`}
    >
      {!embedded && (
        <div className="pointer-events-none absolute inset-0">
          <div className="report-orb absolute -right-24 top-12 h-72 w-72 rounded-full bg-[#ff7a1a]/14 blur-3xl" />
          <div className="report-orb absolute left-[-6rem] top-64 h-60 w-60 rounded-full bg-white/6 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:auto,100%_18px] opacity-80" />
        </div>
      )}

      <div
        className={`relative mx-auto ${
          embedded
            ? "h-full w-full px-4 py-4 pb-8 sm:px-5 sm:py-5 sm:pb-10"
            : "max-w-6xl px-4 py-4 pb-12 sm:px-6 sm:py-6 sm:pb-14 lg:px-8 lg:py-8 lg:pb-16"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          {onBack ? (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div className="h-9" />
          )}

          <div className="text-center">
            <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
              Movie Match Report
            </p>
          </div>

          {onClose ? (
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.06]"
              title="Close analysis"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        <section className="grid gap-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-8">
          <div className="space-y-5">
            <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
              Your overlap with {subjectName}
            </p>
            <h1 className="max-w-3xl text-3xl font-black leading-[0.96] tracking-tight sm:text-5xl">
              A cinematic read on how your taste lines up.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
              We’re blending explicit taste picks, watched logs, reactions, review tone,
              creators, languages, and the titles you both keep revisiting so the score
              reflects what actually pulls your taste in the same direction.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <span className="rounded-full border border-[#ff7a1a]/35 bg-[#ff7a1a]/10 px-3 py-1 text-xs font-semibold text-[#ffb36b]">
                {analysis.blendPersonality}
              </span>
              {analysis.sharedGenres.slice(0, 4).map((genre: string) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[#f5f0de]"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          <div className="relative lg:pl-8">
            <div className="absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent via-[#ff7a1a]/60 to-transparent lg:block" />
            <div className="relative overflow-hidden border-l border-white/10 pl-6 lg:pl-8">
              <div className="absolute -left-3 top-6 hidden h-2 w-2 rounded-full bg-[#ff7a1a] shadow-[0_0_24px_rgba(255,122,26,0.65)] lg:block" />
              <p className="text-[0.65rem] uppercase tracking-[0.45em] text-white/40">
                Match score
              </p>
              <div className="mt-3 flex items-end gap-2">
                <span className="report-score text-7xl font-black leading-none text-[#ff7a1a] sm:text-8xl">
                  {analysis.totalScore}
                </span>
                <span className="pb-2 text-3xl font-black text-white/70">%</span>
              </div>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65 sm:text-base">
                {analysis.tasteInsight}
              </p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/35">
                  Reported between
                </p>
                <p className="mt-2 text-sm text-[#f5f0de] sm:text-base">
                  <span className="font-semibold">{viewerName}</span>
                  <span className="text-white/45"> and </span>
                  <span className="font-semibold">{subjectName}</span>
                </p>
                {subjectUsername && (
                  <p className="mt-2 text-xs font-medium text-[#ffb36b]">
                    View profile{" "}
                    <Link
                      href={`/profile/${subjectUsername}`}
                      className="text-[#f5f0de] transition hover:text-[#ffb36b]"
                    >
                      @{subjectUsername}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 py-5 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                Report Snapshot
              </p>
              <p className="mt-2 text-sm text-white/55">
                The numbers that explain the score without making you dig.
              </p>
            </div>
            <p className="hidden text-xs uppercase tracking-[0.35em] text-white/35 sm:block">
              More below
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Shared Movies", analysis.commonTasteMovieCount],
              ["Both Loved", analysis.commonMasterpieceMovieCount],
              ["Shared Genres", analysis.sharedGenres?.length || 0],
              ["Avg Year Gap", Math.abs((analysis.avgYearA || 0) - (analysis.avgYearB || 0))],
            ].map(([label, value]) => (
              <div key={label as string} className="border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-[0.65rem] uppercase tracking-[0.4em] text-white/35">{label as string}</p>
                <p className="mt-3 text-2xl font-black text-[#f5f0de]">{value as number}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-7 py-7 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-7">
            <section className="border-t border-white/10 pt-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#ff7a1a]" />
                <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                  Taste Insight
                </p>
              </div>
              <div className="relative mt-4 overflow-hidden border-l-2 border-[#ff7a1a] pl-5">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#ff7a1a]/10 blur-3xl" />
                <p className="max-w-3xl text-base leading-7 text-[#f5f0de] sm:text-lg sm:leading-8">
                  {analysis.tasteInsight}
                </p>
                <p className="mt-4 text-sm text-white/55">
                  Blend personality{" "}
                  <span className="text-[#ffb36b]">{analysis.blendPersonality}</span>
                </p>
              </div>
            </section>

            <section className="border-t border-white/10 pt-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#ff7a1a]" />
                <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                  Taste DNA
                </p>
              </div>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div className="border-l border-white/10 pl-5">
                  <p className="text-sm font-semibold text-[#f5f0de]">Your Top Genres</p>
                  <div className="mt-3 space-y-2">
                    {analysis.genreDistributionA.slice(0, 4).map((g: { genre: string; count: number }) => (
                      <div key={`a-${g.genre}`} className="flex items-center justify-between gap-4 text-sm">
                        <span className="capitalize text-white/70">{g.genre}</span>
                        <span className="font-semibold text-[#f5f0de]">{g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-l border-white/10 pl-5">
                  <p className="text-sm font-semibold text-[#f5f0de]">
                    {subjectName}&apos;s Top Genres
                  </p>
                  <div className="mt-3 space-y-2">
                    {analysis.genreDistributionB.slice(0, 4).map((g: { genre: string; count: number }) => (
                      <div key={`b-${g.genre}`} className="flex items-center justify-between gap-4 text-sm">
                        <span className="capitalize text-white/70">{g.genre}</span>
                        <span className="font-semibold text-[#f5f0de]">{g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-white/10 pt-5">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div className="border-l border-white/10 pl-5">
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-white/35">
                    Your average year
                  </p>
                  <p className="mt-3 text-3xl font-black text-[#ffb36b]">{analysis.avgYearA}</p>
                </div>
                <div className="border-l border-white/10 pl-5">
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-white/35">
                    {subjectName}&apos;s average year
                  </p>
                  <p className="mt-3 text-3xl font-black text-[#ffb36b]">{analysis.avgYearB}</p>
                </div>
                <div className="border-l border-white/10 pl-5">
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-white/35">
                    Shared Languages
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.sharedLanguages.length > 0 ? (
                      analysis.sharedLanguages.map((language: string) => (
                        <span
                          key={language}
                          className="rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-3 py-1 text-xs font-semibold text-[#ffb36b]"
                        >
                          {language}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-white/45">No shared languages yet.</span>
                    )}
                  </div>
                </div>
              </div>

              {analysis.sharedGenres.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                    Shared Genres
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.sharedGenres.map((genre: string) => (
                      <span
                        key={genre}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[#f5f0de]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <PosterRail
              title="Shared Watching"
              subtitle="Titles both of you have in your overlap."
              items={commonTasteMovies}
              accent="orange"
            />

            <PosterRail
              title="Both Loved"
              subtitle="The logs both of you marked as masterpiece."
              items={commonMasterpieceMovies}
              accent="amber"
            />
          </div>

          <aside className="space-y-8">
            <section className="border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#ff7a1a]" />
                <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                  Signal Breakdown
                </p>
              </div>
              <div className="mt-4 space-y-4 border-l border-white/10 pl-5">
                {[
                  ["Genre match", analysis.genreSim],
                  ["Creator match", analysis.creatorSim],
                  ["Reaction style", analysis.ratingSim],
                  ["Mood match", analysis.vibeSim],
                  ["Era match", analysis.eraSim],
                  ["Language match", analysis.languageSim],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-sm text-white/70">{label}</span>
                      <span className="text-sm font-semibold text-[#f5f0de]">{Number(value)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff7a1a] via-[#ffb36b] to-[#f5f0de] transition-all duration-500"
                        style={{ width: `${Number(value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-white/10 pt-6">
              <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                Shared Creators
              </p>
              <div className="mt-4 space-y-4 border-l border-white/10 pl-5">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0de]">Common Actors</p>
                  {analysis.commonActors.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.commonActors.slice(0, 6).map((actor: string) => (
                        <span
                          key={actor}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[#f5f0de]"
                        >
                          {actor}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">No shared actors yet.</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#f5f0de]">Common Directors</p>
                  {analysis.commonDirectors.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.commonDirectors.slice(0, 6).map((director: string) => (
                        <span
                          key={director}
                          className="rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-3 py-1 text-xs text-[#ffb36b]"
                        >
                          {director}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">No shared directors yet.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="border-t border-white/10 pt-6">
              <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">
                Quick Links
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/profile/${subjectUsername || ""}/shared-movies`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/35 bg-[#ff7a1a] px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff8d3b]"
                >
                  Open shared movies
                </Link>
                <Link
                  href={`/profile/${subjectUsername || ""}/movie-personality`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/35 hover:bg-white/[0.06]"
                >
                  View movie personality
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
