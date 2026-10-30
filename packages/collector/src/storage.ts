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

/** 여러 날에 걸쳐 합친 키워드 */
export interface RangeKeyword {
  keyword: string;
  /** 등장한 날짜들 (오래된 순) */
  dates: string[];
  firstDate: string;
  lastDate: string;
  sources: DayKeyword["sources"];
  bestRank: number;
  maxTraffic: number | null;
  /** 가장 최근 날의 검색량 (조회된 날이 없으면 undefined) */
  stats?: DayKeyword["stats"];
  related: string | null;
  url: string | null;
}

/** endDate부터 거꾸로 days일 (YYYY-MM-DD, 오래된 순) */
export function dateRange(endDate: string, days: number) {
  const end = new Date(`${endDate}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(end.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** 기간의 날짜 파일들을 읽어 키워드별로 합친다. 며칠 동안 떴는지 보려는 용도 */
export async function readRange(dataDir: string, endDate: string, days: number): Promise<RangeKeyword[]> {
  const records = (await Promise.all(dateRange(endDate, days).map((d) => readDay(dataDir, d)))).filter((r) => r !== null);
  const merged = new Map<string, RangeKeyword>();

  for (const record of records) {
    for (const k of record.keywords) {
      const key = normalizeKeyword(k.keyword);
      const entry = merged.get(key);
      if (!entry) {
        merged.set(key, {
          keyword: k.keyword,
          dates: [record.date],
          firstDate: record.date,
          lastDate: record.date,
          sources: [...k.sources],
          bestRank: k.bestRank,
          maxTraffic: k.maxTraffic,
          stats: k.stats,
          related: k.related,
          url: k.url,
        });
        continue;
      }
      if (!entry.dates.includes(record.date)) entry.dates.push(record.date);
      entry.lastDate = record.date;
      entry.sources = [...new Set([...entry.sources, ...k.sources])].sort();
      entry.bestRank = Math.min(entry.bestRank, k.bestRank);
      if (k.maxTraffic) entry.maxTraffic = Math.max(entry.maxTraffic ?? 0, k.maxTraffic);
      // 날짜 순으로 읽으므로 나중 날의 검색량·관련 뉴스가 남는다
      if (k.stats !== undefined) entry.stats = k.stats;
      if (k.related) [entry.related, entry.url] = [k.related, k.url];
    }
  }
  return [...merged.values()];
}
