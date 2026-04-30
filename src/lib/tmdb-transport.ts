const TMDB_SERVER_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_PROXY_BASE_URL = "/api/tmdb";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_RESPONSE_CACHE = new Map<
  string,
  {
    expiresAt: number;
    body: string;
    status: number;
    statusText: string;
    headers: [string, string][];
  }
>();

type QueryValue = string | number | boolean | null | undefined;

type QueryParams = Record<string, QueryValue>;

function isClientRuntime() {
  return typeof window !== "undefined";
}

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

function buildSearchParams(params?: QueryParams, includeApiKey: boolean = false) {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      searchParams.set(key, String(value));
    });
  }

  if (includeApiKey && TMDB_API_KEY && !searchParams.has("api_key")) {
    searchParams.set("api_key", TMDB_API_KEY);
  }

  return searchParams;
}

function getCacheTtlMs(path: string) {
  if (path.includes("/search/")) return 5 * 60 * 1000;
  if (path.includes("/discover/")) return 10 * 60 * 1000;
  if (path.includes("/popular")) return 30 * 60 * 1000;
  if (path.includes("/similar")) return 30 * 60 * 1000;
  if (path.includes("/movie/") || path.includes("/tv/") || path.includes("/person/")) {
    return 60 * 60 * 1000;
  }
  return 10 * 60 * 1000;
}

export function buildTmdbUrl(path: string, params?: QueryParams) {
  const normalizedPath = normalizePath(path);
  const searchParams = buildSearchParams(params, !isClientRuntime());
  const queryString = searchParams.toString();
  const baseUrl = isClientRuntime() ? TMDB_PROXY_BASE_URL : TMDB_SERVER_BASE_URL;

  return `${baseUrl}/${normalizedPath}${queryString ? `?${queryString}` : ""}`;
}

export async function fetchTmdb(
  path: string,
  params?: QueryParams,
  init?: RequestInit
) {
  const url = buildTmdbUrl(path, params);
  const method = (init?.method || "GET").toUpperCase();

  if (method !== "GET" || init?.cache === "no-store") {
    return fetch(url, init);
  }

  const cacheKey = `${method}:${url}`;
  const cached = TMDB_RESPONSE_CACHE.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: cached.headers,
    });
  }

  const response = await fetch(url, init);
  const body = await response.text();

  if (response.ok) {
    TMDB_RESPONSE_CACHE.set(cacheKey, {
      expiresAt: now + getCacheTtlMs(normalizePath(path)),
      body,
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    });
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
