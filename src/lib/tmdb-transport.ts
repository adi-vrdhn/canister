const TMDB_SERVER_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_PROXY_BASE_URL = "/api/tmdb";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

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
  return fetch(buildTmdbUrl(path, params), init);
}
