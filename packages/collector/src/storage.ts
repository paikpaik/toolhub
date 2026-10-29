/**
 * 날짜별 키워드 기록. 하루에 파일 하나이고, 수집할 때마다 처음 보는 키워드만 추가된다.
 *
 * data/
 *   2026-10-29.json
 */
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeKeyword } from "./sources.ts";
import type { DayKeyword, DayRecord, KeywordItem } from "./types.ts";

const dayFile = (dataDir: string, date: string) => path.join(dataDir, `${date}.json`);

export async function readDay(dataDir: string, date: string): Promise<DayRecord | null> {
  try {
    return JSON.parse(await readFile(dayFile(dataDir, date), "utf-8"));
  } catch {
    return null;
  }
}

export async function writeDay(dataDir: string, record: DayRecord) {
  await mkdir(dataDir, { recursive: true });
  // 임시 파일에 쓰고 교체해서, 쓰는 도중에 읽어도 깨진 JSON을 보지 않게 한다
  const file = dayFile(dataDir, record.date);
  await writeFile(`${file}.tmp`, JSON.stringify(record, null, 2));
  await rename(`${file}.tmp`, file);
}

/** 데이터가 있는 날짜 목록 (최신순) */
export async function listDates(dataDir: string): Promise<string[]> {
  const files = await readdir(dataDir).catch(() => []);
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort()
    .reverse();
}

/**
 * 기존 키워드 목록에 새로 수집한 항목을 합친다.
 * 처음 보는 키워드는 뒤에 추가하고, 이미 있는 키워드는 소스·최고 순위·트래픽만 갱신한다.
 */
export function mergeKeywords(existing: DayKeyword[], items: KeywordItem[], seenAt: string) {
  const byKey = new Map(existing.map((k) => [normalizeKeyword(k.keyword), { ...k, sources: [...k.sources] }]));
  const added: DayKeyword[] = [];

  for (const item of items) {
    const key = normalizeKeyword(item.keyword);
    if (!key) continue;

    const entry = byKey.get(key);
    if (!entry) {
      const created: DayKeyword = {
        keyword: item.keyword,
        sources: [item.source],
        firstSeen: seenAt,
        bestRank: item.rank,
        maxTraffic: item.traffic,
        related: item.related,
        url: item.url,
      };
      byKey.set(key, created);
      added.push(created);
      continue;
    }
    if (!entry.sources.includes(item.source)) entry.sources = [...entry.sources, item.source].sort();
    entry.bestRank = Math.min(entry.bestRank, item.rank);
    if (item.traffic) entry.maxTraffic = Math.max(entry.maxTraffic ?? 0, item.traffic);
    entry.related ??= item.related;
    entry.url ??= item.url;
  }

  return { keywords: [...byKey.values()], added };
}
