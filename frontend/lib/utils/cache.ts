/**
 * Wrap a zero-arg async function so it's only ever invoked once per session.
 * Subsequent callers receive the same in-flight promise (de-dup) and, after
 * resolution, the same cached value. On rejection the cache is cleared so
 * the next caller can retry.
 */
export function cachedAsync<T>(fn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    if (promise) return promise;
    promise = fn().catch((err) => {
      promise = null;
      throw err;
    });
    return promise;
  };
}

/**
 * Same idea, keyed by a string. Used for per-id resource caching.
 */
export function cachedAsyncByKey<T>(
  fn: (key: string) => Promise<T>,
): {
  get: (key: string) => Promise<T>;
  peek: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  prefetch: (key: string) => void;
  clear: (key?: string) => void;
} {
  const inflight = new Map<string, Promise<T>>();
  const resolved = new Map<string, T>();

  return {
    get(key) {
      const cached = resolved.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
      const pending = inflight.get(key);
      if (pending) return pending;
      const p = fn(key)
        .then((value) => {
          resolved.set(key, value);
          return value;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, p);
      return p;
    },
    peek(key) {
      return resolved.get(key);
    },
    set(key, value) {
      resolved.set(key, value);
    },
    prefetch(key) {
      // Fire and forget; errors are silently swallowed because the consumer
      // will retry on the actual call.
      this.get(key).catch(() => {});
    },
    clear(key) {
      if (key === undefined) {
        resolved.clear();
        inflight.clear();
      } else {
        resolved.delete(key);
        inflight.delete(key);
      }
    },
  };
}
