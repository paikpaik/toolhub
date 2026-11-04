/** 정한 시간 동안만 값을 기억하는 작은 메모리 캐시 (브라우저 탭 안에서만, 새로고침하면 비워진다) */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { at: number; value: T }>();
  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (now() - entry.at >= ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      entries.set(key, { at: now(), value });
    },
    delete(key: string) {
      entries.delete(key);
    },
  };
}
