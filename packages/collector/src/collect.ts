import { fetchKeywordStats, type SearchAdConfig } from "./naver-searchad.ts";
import { SOURCES } from "./sources.ts";
import { mergeKeywords, readDay, writeDay } from "./storage.ts";
import type { CollectResult, KeywordItem, SourceName } from "./types.ts";

export const ALL_SOURCES = Object.keys(SOURCES) as SourceName[];

/** KST 기준 날짜/시각 문자열 */
export function kstNow(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return {
    iso: kst.slice(0, 19) + "+09:00",
    date: kst.slice(0, 10),
    time: kst.slice(11, 16),
  };
}

export async function collectKeywords(sources: SourceName[] = ALL_SOURCES): Promise<CollectResult> {
  const now = kstNow();
  // 소스 하나가 실패해도 나머지는 계속 수집한다
  const results = await Promise.allSettled(sources.map((name) => SOURCES[name]()));

  const items: KeywordItem[] = [];
  const errors: CollectResult["errors"] = {};
  results.forEach((result, i) => {
    const name = sources[i]!;
    if (result.status === "fulfilled") items.push(...result.value);
    else errors[name] = String(result.reason);
  });
  return { collectedAt: now.iso, errors, items };
}

// 같은 프로세스에서 날짜 파일 저장이 겹치면(새로고침 연타 등) 읽기-병합-쓰기가 엇갈려 내용이 빠질 수 있어 순서대로 처리한다
let queue: Promise<unknown> = Promise.resolve();

function withDayLock<T>(fn: () => Promise<T>): Promise<T> {
  const task = queue.then(fn);
  queue = task.catch(() => {});
  return task;
}

/** 수집 결과를 그날 기록에 합쳐 저장한다. 새로 추가된 키워드를 반환한다. */
export function recordKeywords(result: CollectResult, dataDir: string) {
  return withDayLock(async () => {
    const { date, time } = kstNow(new Date(result.collectedAt));
    const existing = (await readDay(dataDir, date))?.keywords ?? [];
    const { keywords, added } = mergeKeywords(existing, result.items, time);
    if (result.items.length > 0) {
      await writeDay(dataDir, { date, updatedAt: result.collectedAt, keywords });
    }
    return { date, added, total: keywords.length };
  });
}

/** 그날 기록 중 검색량을 아직 조회하지 않은 키워드만 네이버 검색광고 API로 채운다. */
export async function enrichDayWithStats(dataDir: string, date: string, config: SearchAdConfig) {
  const day = await readDay(dataDir, date);
  const missing = day?.keywords.filter((k) => k.stats === undefined).map((k) => k.keyword) ?? [];
  if (missing.length === 0) return { updated: 0, remaining: 0, error: null };

  // API 호출은 잠금 밖에서 하고, 저장할 때만 최신 파일을 다시 읽어 반영한다
  const { stats, error, remaining } = await fetchKeywordStats(config, missing);
  if (stats.size > 0) {
    await withDayLock(async () => {
      const latest = await readDay(dataDir, date);
      if (!latest) return;
      for (const k of latest.keywords) {
        if (k.stats === undefined && stats.has(k.keyword)) k.stats = stats.get(k.keyword)!;
      }
      await writeDay(dataDir, latest);
    });
  }
  return { updated: stats.size, remaining, error };
}
