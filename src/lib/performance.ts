export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type TMDBImageSize = "w92" | "w154" | "w185" | "w300" | "w342" | "w500" | "w780" | "original";

export function getTmdbImageUrl(
  path: string | null | undefined,
  size: TMDBImageSize = "w500"
): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export function getTmdbPosterUrl(path: string | null | undefined, size: TMDBImageSize = "w500") {
  return getTmdbImageUrl(path, size);
}

export function getTmdbBackdropUrl(path: string | null | undefined, size: TMDBImageSize = "w780") {
  return getTmdbImageUrl(path, size);
}

export function getBlurDataUrl(color = "#161616"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 24" preserveAspectRatio="none"><rect width="16" height="24" fill="${color}"/><path d="M-4 8h24v8H-4z" fill="rgba(255,255,255,0.08)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

