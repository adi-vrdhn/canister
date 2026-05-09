const PREFIX = "cp_";

export function lsGet<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null;
    return data as T;
  } catch {
    return null;
  }
}

export function lsSet<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
  } catch {
    // Storage quota exceeded — evict old keys and retry once
    try {
      evictOldEntries();
      localStorage.setItem(PREFIX + key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
    } catch {
      // Give up silently — caching is best-effort
    }
  }
}

function evictOldEntries(): void {
  const now = Date.now();
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    try {
      const { expiresAt } = JSON.parse(localStorage.getItem(k) || "{}");
      if (!expiresAt || now > expiresAt) toRemove.push(k);
    } catch {
      toRemove.push(k!);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}
