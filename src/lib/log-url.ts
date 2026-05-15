import type { MovieLogWithContent, User } from "@/types";

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function slugifyTitleWithYear(title: string, year?: string | number | null): string {
  const base = slugifySegment(title);
  const yearValue = year == null ? "" : String(year).trim();
  if (!yearValue) return base;
  return `${base}-${yearValue}`;
}

export function buildLogUrl(
  log: Pick<MovieLogWithContent, "id" | "content" | "user" | "user_id" | "season" | "episode" | "episode_title">,
  extraParams?: Record<string, string | number | null | undefined>
): string {
  const params = new URLSearchParams();
  const username = log.user?.username || log.user_id || log.user?.id || "user";
  const movieName =
    log.content?.title || ("name" in log.content ? log.content.name : undefined) || "log";
  const releaseYear = log.content?.release_date ? new Date(log.content.release_date).getFullYear() : null;

  params.set("user", slugifySegment(username));
  params.set("movie", slugifyTitleWithYear(movieName, Number.isFinite(releaseYear) ? releaseYear : null));

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      params.set(key, String(value));
    });
  }

  if (typeof log.season === "number") {
    params.set("season", String(log.season));
  }

  if (typeof log.episode === "number") {
    params.set("episode", String(log.episode));
  }

  if (log.episode_title) {
    params.set("episode_title", log.episode_title);
  }

  const query = params.toString();
  return query ? `/logs/${log.id}?${query}` : `/logs/${log.id}`;
}

export function buildLogUrlFromUserAndTitle(
  logId: string,
  user: Pick<User, "id" | "username"> | null | undefined,
  title: string,
  year?: string | number | null,
  extraParams?: Record<string, string | number | null | undefined>
): string {
  const params = new URLSearchParams();
  params.set("user", slugifySegment(user?.username || user?.id || "user"));
  params.set("movie", slugifyTitleWithYear(title || "log", year));

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      params.set(key, String(value));
    });
  }

  const query = params.toString();
  return query ? `/logs/${logId}?${query}` : `/logs/${logId}`;
}
