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

// 같은 프로세스에서 저장이 겹치면(새로고침 연타 등) 읽기-병합-쓰기가 엇갈려 키워드가 빠질 수 있어 순서대로 처리한다
let queue: Promise<unknown> = Promise.resolve();

/** 수집 결과를 그날 기록에 합쳐 저장한다. 새로 추가된 키워드를 반환한다. */
export function recordKeywords(result: CollectResult, dataDir: string) {
  const task = queue.then(async () => {
    const { date, time } = kstNow(new Date(result.collectedAt));
    const existing = (await readDay(dataDir, date))?.keywords ?? [];
    const { keywords, added } = mergeKeywords(existing, result.items, time);
    if (result.items.length > 0) {
      await writeDay(dataDir, { date, updatedAt: result.collectedAt, keywords });
    }
    return { date, added, total: keywords.length };
  });
  queue = task.catch(() => {});
  return task;
}
