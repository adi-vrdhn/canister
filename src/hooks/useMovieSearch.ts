"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TMDBMovie } from "@/types";

const LS_KEY = "cineparte.search.recent";
const MAX_ENTRIES = 20;
const DEBOUNCE_MS = 300;
// Cached results expire after 30 minutes; re-request after that
const ENTRY_TTL_MS = 30 * 60 * 1000;

type CachedEntry = {
  query: string;
  results: TMDBMovie[];
  savedAt: number;
};

function readCache(): CachedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (e): e is CachedEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as CachedEntry).query === "string" &&
        Array.isArray((e as CachedEntry).results) &&
        typeof (e as CachedEntry).savedAt === "number" &&
        now - (e as CachedEntry).savedAt < ENTRY_TTL_MS
    );
  } catch {
    return [];
  }
}

function writeCache(entries: CachedEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Ignore quota / privacy-mode failures
  }
}

function getCached(normalizedQuery: string): TMDBMovie[] | null {
  const entries = readCache();
  const match = entries.find((e) => e.query === normalizedQuery);
  return match ? match.results : null;
}

function persistResult(normalizedQuery: string, results: TMDBMovie[]): void {
  const rest = readCache().filter((e) => e.query !== normalizedQuery);
  writeCache([{ query: normalizedQuery, results, savedAt: Date.now() }, ...rest]);
}

export type MovieSearchState = {
  results: TMDBMovie[];
  loading: boolean;
};

export function useMovieSearch(query: string): MovieSearchState {
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep last good results so the UI doesn't flash empty while a new search loads
  const prevResultsRef = useRef<TMDBMovie[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const fetchResults = useCallback(async (raw: string, requestId: number) => {
    const trimmed = raw.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");

    // 1. Hit localStorage first
    const cached = getCached(normalized);
    if (cached) {
      if (requestId !== requestIdRef.current) return;
      setResults(cached);
      setLoading(false);
      prevResultsRef.current = cached;
      return;
    }

    // 2. Fetch from server-side API route
    try {
      const res = await fetch(`/api/search-movies?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const movies: TMDBMovie[] = await res.json();

      if (requestId !== requestIdRef.current) return;
      setResults(movies);
      prevResultsRef.current = movies;
      persistResult(normalized, movies);
    } catch {
      // Keep previous results visible on network error
      if (requestId === requestIdRef.current) {
        setResults(prevResultsRef.current);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    // Show stale results immediately while the new request is in flight
    setResults(prevResultsRef.current);
    setLoading(true);

    timerRef.current = setTimeout(() => {
      void fetchResults(trimmed, requestId);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, fetchResults]);

  return { results, loading };
}
