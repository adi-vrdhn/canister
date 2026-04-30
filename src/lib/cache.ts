type TimedCacheEntry<T> = {
  value: T;
  expiresAt: number;
  promise?: Promise<T>;
};

type TimedCacheOptions<TArgs extends unknown[], TValue> = {
  ttlMs: number;
  key: (...args: TArgs) => string;
  loader: (...args: TArgs) => Promise<TValue> | TValue;
  cacheNullish?: boolean;
};

export function createTimedCache<TArgs extends unknown[], TValue>({
  ttlMs,
  key,
  loader,
  cacheNullish = true,
}: TimedCacheOptions<TArgs, TValue>) {
  const cache = new Map<string, TimedCacheEntry<TValue>>();

  return async (...args: TArgs): Promise<TValue> => {
    const cacheKey = key(...args);
    const now = Date.now();
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > now && "value" in cached) {
      return cached.value;
    }

    if (cached?.promise) {
      return cached.promise;
    }

    const promise = Promise.resolve(loader(...args));
    cache.set(cacheKey, {
      value: undefined as TValue,
      expiresAt: now + ttlMs,
      promise,
    });

    try {
      const value = await promise;

      if (cacheNullish || (value !== null && value !== undefined)) {
        cache.set(cacheKey, {
          value,
          expiresAt: now + ttlMs,
        });
      } else {
        cache.delete(cacheKey);
      }

      return value;
    } catch (error) {
      cache.delete(cacheKey);
      throw error;
    }
  };
}

