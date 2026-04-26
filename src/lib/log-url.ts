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

export function buildLogUrl(
  log: Pick<MovieLogWithContent, "id" | "content" | "user" | "user_id">,
  extraParams?: Record<string, string | number | null | undefined>
): string {
  const params = new URLSearchParams();
  const username = log.user?.username || log.user_id || log.user?.id || "user";
  const movieName =
    log.content?.title || ("name" in log.content ? log.content.name : undefined) || "log";

  params.set("user", slugifySegment(username));
  params.set("movie", slugifySegment(movieName));

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      params.set(key, String(value));
    });
  }

  const query = params.toString();
  return query ? `/logs/${log.id}?${query}` : `/logs/${log.id}`;
}

export function buildLogUrlFromUserAndTitle(
  logId: string,
  user: Pick<User, "id" | "username"> | null | undefined,
  title: string,
  extraParams?: Record<string, string | number | null | undefined>
): string {
  const params = new URLSearchParams();
  params.set("user", slugifySegment(user?.username || user?.id || "user"));
  params.set("movie", slugifySegment(title || "log"));

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      params.set(key, String(value));
    });
  }

  const query = params.toString();
  return query ? `/logs/${logId}?${query}` : `/logs/${logId}`;
}
