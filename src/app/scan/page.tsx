"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Film, Loader2, Search } from "lucide-react";
import { searchMovies } from "@/lib/tmdb";
import { getBlurDataUrl, getTmdbPosterUrl } from "@/lib/performance";
import { TMDBMovie } from "@/types";

type ScanMovie = {
  id: number;
  title: string;
  posterUrl: string | null;
  releaseYear: string;
};

function toScanMovie(movie: TMDBMovie): ScanMovie {
  return {
    id: movie.id,
    title: movie.title || "Untitled",
    posterUrl: movie.poster_path ? getTmdbPosterUrl(movie.poster_path, "w500") : null,
    releaseYear: movie.release_date ? movie.release_date.slice(0, 4) : "",
  };
}

function ScanPageInner() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScanMovie[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoadingResults(false);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setLoadingResults(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const movies = await searchMovies(trimmed, 1);
        if (requestId !== searchRequestRef.current) return;
        setResults(movies.slice(0, 8).map(toScanMovie));
      } catch (error) {
        console.error("Scan search failed:", error);
        if (requestId === searchRequestRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === searchRequestRef.current) {
          setLoadingResults(false);
        }
      }
    }, 250);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query]);

  const handleSelectMovie = (movie: ScanMovie) => {
    router.push(`/movie/${movie.id}?log=1&from=scan`);
  };

  return (
    <div className="min-h-dvh bg-[#050505] px-4 py-5 text-[#f5f0de] sm:px-6 lg:px-8">
      <div className="mx-auto min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl pb-28">
        <div className="border-b border-white/10 pb-4">
          <Link href="/dashboard" className="inline-flex items-center text-2xl font-black tracking-tight text-[#f5f0de]">
            Canisterr
          </Link>
        </div>

        <div className="pt-8 sm:pt-10">
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Search a movie.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
            Pick a title and we&apos;ll take you straight to the log page.
          </p>
        </div>

        <div className="mt-8 max-w-3xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <Search className="h-5 w-5 text-[#ffb36b]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a movie"
              className="w-full bg-transparent text-xl font-semibold text-[#f5f0de] outline-none placeholder:text-white/20 sm:text-2xl"
            />
          </div>
        </div>

        <div className="mt-8 border-t border-white/10">
          {loadingResults ? (
            <div className="flex min-h-[14rem] items-center justify-center text-white/45">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[34rem] overflow-y-auto">
              {results.map((movie) => (
                <button
                  key={movie.id}
                  type="button"
                  onClick={() => handleSelectMovie(movie)}
                  className="flex w-full items-center gap-4 border-b border-white/10 py-4 text-left transition hover:bg-white/[0.02]"
                >
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={movie.title}
                      width={72}
                      height={108}
                      className="h-20 w-14 shrink-0 rounded-xl object-cover"
                      placeholder="blur"
                      blurDataURL={getBlurDataUrl()}
                    />
                  ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[11px] uppercase tracking-[0.18em] text-white/35">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[#f5f0de]">{movie.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">{movie.releaseYear || "Movie"}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#ffb36b]" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[18rem] flex-col items-start justify-center py-8 text-left">
              <Film className="h-10 w-10 text-white/20" />
              <p className="mt-4 text-base font-semibold text-[#f5f0de]">Search a movie to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ScanPage = dynamic(() => Promise.resolve(ScanPageInner), {
  ssr: false,
  loading: () => (
    <div className="min-h-dvh bg-[#050505] px-4 py-5 text-[#f5f0de] sm:px-6 lg:px-8">
      <div className="mx-auto min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl pb-28">
        <div className="border-b border-white/10 pb-4">
          <div className="inline-flex items-center text-2xl font-black tracking-tight text-[#f5f0de]">Canisterr</div>
        </div>
      </div>
    </div>
  ),
});

export default ScanPage;
