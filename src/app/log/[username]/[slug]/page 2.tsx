"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, Star, ImageIcon } from "lucide-react";
import { parseMovieSlug, slugify } from "@/lib/seo";
import { searchMovies } from "@/lib/tmdb";
import { getUserByUsername } from "@/lib/profile";
import { getUserMovieLogs } from "@/lib/logs";
import type { MovieLogWithContent, User } from "@/types";

const REACTION_CONFIG = {
  2:   { label: "Masterpiece", color: "bg-amber-400/20 text-amber-300 border-amber-400/30" },
  1:   { label: "Good",        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  1.5: { label: "Average",     color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  0:   { label: "Bad",         color: "bg-red-500/20 text-red-300 border-red-500/30" },
} as const;

function ReactionBadge({ reaction }: { reaction: number | null | undefined }) {
  if (reaction == null) return null;
  const cfg = REACTION_CONFIG[reaction as keyof typeof REACTION_CONFIG];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${cfg.color}`}>
      <Star className="h-3.5 w-3.5 fill-current" />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function PublicLogPage() {
  const params = useParams<{ username: string; slug: string }>();
  const router = useRouter();
  const { username, slug } = params;

  const [log, setLog] = useState<MovieLogWithContent | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username || !slug) return;

    let cancelled = false;

    async function resolve() {
      try {
        setLoading(true);

        const { titleHint, year } = parseMovieSlug(slug);

        // Resolve user and movie search in parallel
        const [user, searchResults] = await Promise.all([
          getUserByUsername(username),
          searchMovies(titleHint),
        ]);

        if (!user) { setError("User not found."); return; }
        if (!searchResults.length) { setError("Movie not found."); return; }

        // Pick the best match: same year if possible, else first result
        const movie = year
          ? searchResults.find((m) => m.release_date?.startsWith(String(year))) ?? searchResults[0]
          : searchResults[0];

        // Get user's logs for this movie
        const allLogs = await getUserMovieLogs(user.id, 200);
        const matchingLogs = allLogs
          .filter((l) => l.content_id === movie.id && l.content_type === "movie" && !l.watch_later)
          .sort((a, b) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime());

        if (cancelled) return;

        if (!matchingLogs.length) {
          setError(`No log found for ${username} and this movie.`);
          return;
        }

        setProfileUser(user);
        setLog(matchingLogs[0]);
      } catch (err) {
        if (!cancelled) setError("Something went wrong. Please try again.");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [username, slug]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#050505]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#ff7a1a]" />
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#050505] px-5 text-center text-[#f5f0de]">
        <p className="text-lg font-semibold">{error ?? "Log not found."}</p>
        <button
          onClick={() => router.back()}
          className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-semibold transition hover:bg-white/[0.10]"
        >
          Go back
        </button>
      </div>
    );
  }

  const content = log.content as any;
  const movieTitle = content?.title ?? "Unknown Movie";
  const releaseYear = content?.release_date ? new Date(content.release_date).getFullYear() : null;
  const movieId = log.content_id;
  const posterUrl = content?.poster_url ?? null;
  const backdropUrl = content?.backdrop_url ?? null;
  const movieSlug = `${slugify(movieTitle)}${releaseYear ? `-${releaseYear}` : ""}`;

  return (
    <div className="min-h-dvh bg-[#050505] text-[#f5f0de]">

      {/* Backdrop */}
      {backdropUrl && (
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <Image
            src={backdropUrl}
            alt={`${movieTitle} backdrop`}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#050505]" />
        </div>
      )}

      <div className="mx-auto max-w-2xl px-5 pb-20 pt-6">

        {/* Back navigation */}
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex gap-5">

          {/* Poster */}
          <Link href={`/movie/${movieId}`} className="flex-shrink-0">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={`${movieTitle} poster`}
                width={100}
                height={150}
                className="rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <div className="flex h-[150px] w-[100px] items-center justify-center rounded-xl bg-white/[0.05]">
                <ImageIcon className="h-8 w-8 text-white/25" />
              </div>
            )}
          </Link>

          {/* Movie info */}
          <div className="flex flex-col justify-end gap-1">
            <Link
              href={`/movie/${movieId}`}
              className="text-xl font-black leading-tight text-[#f5f0de] hover:text-[#ff7a1a] transition sm:text-2xl"
            >
              {movieTitle}
            </Link>
            {releaseYear && (
              <p className="text-sm text-white/40">{releaseYear}</p>
            )}
            <Link
              href={`/profile/${username}`}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-[#ff7a1a] transition"
            >
              {profileUser?.avatar_url ? (
                <Image
                  src={profileUser.avatar_url}
                  alt={profileUser.name ?? username}
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff7a1a] text-[10px] font-black text-white">
                  {(profileUser?.name ?? username).charAt(0).toUpperCase()}
                </span>
              )}
              {profileUser?.name ?? `@${username}`}
            </Link>
          </div>
        </div>

        {/* Log metadata */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ReactionBadge reaction={log.reaction} />
          {log.watched_date && (
            <span className="inline-flex items-center gap-1.5 text-sm text-white/45">
              <Calendar className="h-3.5 w-3.5" />
              Watched {formatDate(log.watched_date)}
            </span>
          )}
        </div>

        {/* Review */}
        {log.notes && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-[#f5f0de]/85">{log.notes}</p>
          </div>
        )}

        {/* Ticket / memory photo */}
        {log.ticket_image_url && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">Memory</p>
            <Image
              src={log.ticket_image_url}
              alt="Ticket or memory photo"
              width={600}
              height={400}
              className="w-full rounded-2xl object-cover shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            />
          </div>
        )}

        {/* Context (location / watched with / mood) */}
        {(log as any).context_log && (
          <div className="mt-5 flex flex-wrap gap-3">
            {(log as any).context_log.location && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50">
                📍 {(log as any).context_log.location}
              </span>
            )}
            {(log as any).context_log.watched_with && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50">
                👥 {(log as any).context_log.watched_with}
              </span>
            )}
            {(log as any).context_log.mood && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50">
                🎭 {(log as any).context_log.mood}
              </span>
            )}
          </div>
        )}

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <Link
            href={`/movie/${movieId}`}
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.10]"
          >
            View movie page
          </Link>
          <Link
            href={`/profile/${username}`}
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/[0.10]"
          >
            @{username}'s profile
          </Link>
          <Link
            href={`/movie/${movieId}`}
            className="rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-4 py-2 text-sm font-semibold text-[#ff7a1a] transition hover:bg-[#ff7a1a]/20"
          >
            All logs for {movieTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}
