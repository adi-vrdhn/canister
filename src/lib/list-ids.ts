export function normalizeListIdParam(rawId: string | null | undefined): string {
  if (typeof rawId !== "string") return "";

  let decoded = rawId;
  try {
    decoded = decodeURIComponent(rawId);
  } catch {
    decoded = rawId;
  }

  const trimmed = decoded.trim();
  if (!trimmed) return "";

  const match = trimmed.match(/^[A-Za-z0-9_-]+/);
  return match ? match[0] : "";
}
