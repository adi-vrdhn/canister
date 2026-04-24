"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserMovieLogs } from "@/lib/logs";

type CinematicLoadingProps = {
  message?: string;
};

const FALLBACK_POSTERS = [
  {
    title: "La La Land",
    url: "https://image.tmdb.org/t/p/w342/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
  },
  {
    title: "The Dark Knight",
    url: "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
  },
  {
    title: "Interstellar",
    url: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  },
  {
    title: "Inception",
    url: "https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
  },
];

function normalizePosterUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `https://image.tmdb.org/t/p/w342${url}`;
}

export default function CinematicLoading({
  message = "Your page is loading",
}: CinematicLoadingProps) {
  const [recentPosters, setRecentPosters] = useState<typeof FALLBACK_POSTERS>([]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;

      try {
        const logs = await getUserMovieLogs(firebaseUser.uid, 8);
        if (cancelled) return;

        const posters = logs
          .map((log) => ({
            title: log.content?.title || "Recent watch",
            url: normalizePosterUrl(log.content?.poster_url),
          }))
          .filter((poster): poster is { title: string; url: string } => Boolean(poster.url));

        if (posters.length > 0) {
          setRecentPosters(posters);
        }
      } catch {
        if (!cancelled) {
          setRecentPosters([]);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const posters = useMemo(() => {
    const source = recentPosters.length > 0 ? recentPosters : FALLBACK_POSTERS;
    return [...source, ...source];
  }, [recentPosters]);

  return (
    <div className="relative flex min-h-dvh w-screen items-center justify-center overflow-hidden bg-[#090b12] px-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(214,180,112,0.22),_transparent_34%),linear-gradient(180deg,_rgba(9,11,18,0.18),_rgba(9,11,18,0.96))]" />

      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-8 overflow-hidden">
          <div className="cinematic-poster-track flex w-max gap-3">
            {posters.map((poster, index) => (
              <div
                key={`${poster.title}-${index}`}
                className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-black/40 sm:h-56 sm:w-36"
              >
                <img
                  src={poster.url}
                  alt={poster.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/10 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-md">
          <p className="brand-wordmark text-4xl font-bold tracking-tight text-[#f8e9c8] sm:text-5xl">
            Canisterr
          </p>
          <p className="mt-4 text-base font-semibold text-white">{message}</p>
          <p className="mt-2 text-sm text-zinc-300">
            Setting up your cinema room with recent posters.
          </p>
          <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
            <div className="cinematic-loading-bar h-full w-1/2 rounded-full bg-[#d6b470]" />
          </div>
          <p className="mt-5 text-[11px] text-zinc-400">
            Poster imagery supplied by TMDB. This product uses TMDB data but is not endorsed or certified by TMDB.
          </p>
        </div>
      </div>
    </div>
  );
}
