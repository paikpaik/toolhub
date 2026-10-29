import { XMLParser } from "fast-xml-parser";
import type { KeywordItem, SourceName } from "./types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 15_000;

const GOOGLE_TRENDS_RSS = "https://trends.google.com/trending/rss?geo=KR";
const NATE_LIVE_KEYWORD = "https://www.nate.com/js/data/jsonLiveKeywordDataV1.js";
const SIGNAL_REALTIME = "https://api.signal.bz/news/realtime";

async function get(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.arrayBuffer();
}

/** "2000+", "1만+" 같은 구글 트래픽 표기를 정수로 변환한다. */
export function parseTraffic(text: unknown): number | null {
  if (typeof text !== "string" || !text) return null;
  let s = text.replace(/[,+\s]/g, "");
  let multiplier = 1;
  if (s.endsWith("만")) [multiplier, s] = [10_000, s.slice(0, -1)];
  else if (s.endsWith("천")) [multiplier, s] = [1_000, s.slice(0, -1)];
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * multiplier) : null;
}

interface GoogleRssItem {
  title: string;
  "ht:approx_traffic"?: string;
  "ht:news_item"?: { "ht:news_item_title"?: string; "ht:news_item_url"?: string }[];
}

export async function fetchGoogleTrends(): Promise<KeywordItem[]> {
  const xml = new TextDecoder("utf-8").decode(await get(GOOGLE_TRENDS_RSS));
  const parser = new XMLParser({
    // 키워드가 "2026" 같은 숫자여도 문자열로 유지
    parseTagValue: false,
    isArray: (name) => name === "item" || name === "ht:news_item",
  });
  const items: GoogleRssItem[] = parser.parse(xml)?.rss?.channel?.item ?? [];
  return items.map((item, i) => {
    const news = item["ht:news_item"]?.[0];
    return {
      source: "google",
      rank: i + 1,
      keyword: String(item.title).trim(),
      traffic: parseTraffic(item["ht:approx_traffic"]),
      state: null,
      related: news?.["ht:news_item_title"] ?? null,
      url: news?.["ht:news_item_url"] ?? null,
    };
  });
}

export async function fetchNate(): Promise<KeywordItem[]> {
  // EUC-KR로 인코딩된 JS 배열: [순위, 키워드, 상태(n/s/+/-), 변동폭, 검색용 키워드]
  const text = new TextDecoder("euc-kr").decode(await get(NATE_LIVE_KEYWORD));
  const rows: string[][] = JSON.parse(text);
  return rows.map(([rank, keyword, state, change, query]) => ({
    source: "nate",
    rank: Number(rank),
    keyword: (keyword ?? "").trim(),
    traffic: null,
    state: state === "+" || state === "-" ? `${state}${change}` : (state ?? null),
    related: query ?? null,
    url: null,
  }));
}

interface SignalResponse {
  top10?: { rank: number; keyword: string; state?: string }[];
}

export async function fetchSignal(): Promise<KeywordItem[]> {
  const data: SignalResponse = JSON.parse(new TextDecoder("utf-8").decode(await get(SIGNAL_REALTIME)));
  return (data.top10 ?? []).map((row) => ({
    source: "signal",
    rank: row.rank,
    keyword: row.keyword.trim(),
    traffic: null,
    state: row.state ?? null,
    related: null,
    url: null,
  }));
}

export const SOURCES: Record<SourceName, () => Promise<KeywordItem[]>> = {
  google: fetchGoogleTrends,
  nate: fetchNate,
  signal: fetchSignal,
};

/** 소스 간 같은 키워드를 묶기 위한 키. 공백·구두점·대소문자 차이를 무시한다. */
export function normalizeKeyword(keyword: string): string {
  return keyword.replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}
