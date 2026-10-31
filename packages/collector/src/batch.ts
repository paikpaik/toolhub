/**
 * 키워드 묶음 분석: 여러 키워드의 검색량·경쟁도·추이·포화도를 한 번에 조회해 한 표로 만든다.
 * 크리에이터 어드바이저 화면 캡처 등에서 Claude가 뽑아낸 키워드 목록을 판단하는 용도 (MCP analyze_keywords).
 */
import { formatSearchCount } from "./brief.ts";
import { fetchSearchTrend, searchBlog, type HubConfig } from "./naver-hub.ts";
import { fetchKeywordStats, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import { computeSaturation, summarizeTrend, type Saturation, type TrendSummary } from "./research.ts";
import { normalizeKeyword } from "./sources.ts";

export const MAX_BATCH_KEYWORDS = 50;
/** API HUB 동시 요청 수 (키당 50 RPS 한도보다 넉넉히 낮게) */
const HUB_CONCURRENCY = 5;

/**
 * 캡처·복사에서 섞여 들어오는 순위 번호(1. 2) 3위), 변동 표시(▲3 ▼2 NEW 신규), 따옴표·불릿을 걷어내고
 * 공백·구두점 차이를 무시해 중복을 없앤다. 최대 50개.
 */
export function cleanKeywordList(input: string[]) {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const raw of input.flatMap((s) => s.split(/[\n,]/))) {
    const keyword = raw
      .replace(/^\s*(?:[-*•·]\s*)?(?:\d{1,3}\s*[.)위](?!\d)\s*)?/, "")
      .replace(/\s*(?:[▲▼↑↓]\s*\d*|\(?(?:NEW|new|신규)\)?)\s*$/, "")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();
    const key = normalizeKeyword(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords.slice(0, MAX_BATCH_KEYWORDS);
}

export interface BatchRow {
  keyword: string;
  /** undefined = 검색광고 키 없음, null = 데이터 없음 */
  stats?: KeywordStat | null;
  trend: TrendSummary | null;
  blogTotal: number | null;
  saturation: Saturation | null;
  /** 이미 이 키워드로 쓴 초안 파일 */
  drafts: string[];
}

/** 동시에 limit개씩 처리한다 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]!);
      }
    }),
  );
  return results;
}

export async function analyzeKeywords(
  { searchAd, hub }: { searchAd: SearchAdConfig | null; hub: HubConfig | null },
  keywords: string[],
  draftsOf: (keyword: string) => string[] = () => [],
) {
  // 검색광고(5개씩·1초 간격)와 API HUB(키워드마다 병렬)를 동시에 진행한다
  const [statsResult, hubRows] = await Promise.all([
    searchAd ? fetchKeywordStats(searchAd, keywords, { maxKeywords: MAX_BATCH_KEYWORDS }) : null,
    hub
      ? mapLimit(keywords, HUB_CONCURRENCY, async (keyword) => {
          const [trend, blog] = await Promise.allSettled([
            fetchSearchTrend(hub, keyword).then(summarizeTrend),
            searchBlog(hub, keyword, 1),
          ]);
          return {
            trend: trend.status === "fulfilled" ? trend.value : null,
            blogTotal: blog.status === "fulfilled" ? blog.value.total : null,
          };
        })
      : null,
  ]);

  const rows = keywords.map((keyword, i): BatchRow => {
    const stats = statsResult ? (statsResult.stats.get(keyword) ?? null) : undefined;
    const { trend = null, blogTotal = null } = hubRows?.[i] ?? {};
    return { keyword, stats, trend, blogTotal, saturation: computeSaturation(stats?.totalSearches, blogTotal), drafts: draftsOf(keyword) };
  });
  return { rows, error: statsResult?.error ?? null };
}

const SATURATION_RANK = { 기회: 0, 보통: 1, 높음: 2 } as const;

/** 포화도 기회 → 보통 → 높음 → 계산 불가 순, 같으면 검색량 많은 순 */
export function sortBatchRows(rows: BatchRow[]) {
  const rank = (r: BatchRow) => (r.saturation ? SATURATION_RANK[r.saturation.level] : 3);
  return [...rows].sort((a, b) => rank(a) - rank(b) || (b.stats?.totalSearches ?? -1) - (a.stats?.totalSearches ?? -1));
}

/** 요약 한 줄 + 표 (마크다운) */
export function formatBatchTable(rows: BatchRow[]) {
  const sorted = sortBatchRows(rows);
  const opportunities = sorted.filter((r) => r.saturation?.level === "기회" && !r.drafts.length);
  const lines = [
    `키워드 ${rows.length}개 분석. 포화도 "기회"(검색량 대비 글이 적음)이면서 아직 초안이 없는 키워드: ${
      opportunities.length ? opportunities.map((r) => r.keyword).join(", ") : "없음"
    }`,
    "",
    "| 키워드 | 월간 검색량 | 경쟁도 | 검색 추이 | 블로그 문서 수 | 포화도 | 초안 |",
    "|---|---|---|---|---|---|---|",
    ...sorted.map((r) =>
      [
        "",
        r.keyword.replace(/\|/g, "/"),
        r.stats === undefined ? "-" : r.stats === null ? "데이터 없음" : formatSearchCount(r.stats.totalSearches),
        r.stats?.competition ?? "-",
        r.trend ? (r.trend.label === "시즌" && r.trend.peakMonth ? `시즌(${Number(r.trend.peakMonth.slice(5))}월)` : r.trend.label) : "-",
        r.blogTotal === null ? "-" : r.blogTotal.toLocaleString("ko-KR"),
        r.saturation ? `${r.saturation.level} (${r.saturation.ratio}배)` : "-",
        r.drafts.length ? `✓ ${r.drafts.length}개` : "",
        "",
      ]
        .join(" | ")
        .trim(),
    ),
  ];
  return lines.join("\n");
}
