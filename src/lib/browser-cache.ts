const DEFAULT_TTL_MS = 10 * 60 * 1000;

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readBrowserCache<T>(key: string): T | null {
  if (!isBrowserStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writeBrowserCache<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    const envelope: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore storage quota and privacy-mode failures.
  }
}

export function removeBrowserCache(key: string): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}
