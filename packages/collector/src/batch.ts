/**
 * 키워드 묶음 분석: 여러 키워드의 검색량·광고 경쟁도·추이·최근 7일·포화도를 한 번에 조회해 한 표로 만든다.
 * 크리에이터 어드바이저 화면 캡처 등에서 Claude가 뽑아낸 키워드 목록을 판단하는 용도 (MCP analyze_keywords).
 */
import { formatSearchCount } from "./brief.ts";
import { fetchDailyTrends, fetchSearchTrend, searchBlog, type HubConfig } from "./naver-hub.ts";
import { fetchKeywordStats, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import { computeSaturation, formatSaturation, formatSurge, summarizeSurge, summarizeTrend, type Saturation, type Surge, type TrendSummary } from "./research.ts";
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
      // 끝의 변동 표시: ▲3, ▼2, NEW, 신규, 확장 프로그램이 복사한 "(▲1)"·"(new)"
      .replace(/\s*(?:\(\s*[▲▼↑↓]\s*\d*\s*\)|[▲▼↑↓]\s*\d*|\(?(?:NEW|new|신규)\)?)\s*$/, "")
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
  /** 최근 7일 검색 변화 (일간 추이). 조회하지 않았거나 실패하면 null */
  surge?: Surge | null;
  /** 이미 이 키워드로 쓴 초안 파일 */
  drafts: string[];
}

/** 동시에 limit개씩 처리한다 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
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
  const [statsResult, hubRows, daily] = await Promise.all([
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
    // 일간 추이는 키워드 5개씩 묶어 한 번에 (지금 오르는 키워드 = 크리에이터 어드바이저 "검색 유입 트렌드" 대용)
    hub ? fetchDailyTrends(hub, keywords).catch(() => null) : null,
  ]);

  const rows = keywords.map((keyword, i): BatchRow => {
    const stats = statsResult ? (statsResult.stats.get(keyword) ?? null) : undefined;
    const { trend = null, blogTotal = null } = hubRows?.[i] ?? {};
    const points = daily?.get(keyword);
    return {
      keyword,
      stats,
      trend,
      blogTotal,
      saturation: computeSaturation(stats?.totalSearches, blogTotal),
      surge: points ? summarizeSurge(points) : null,
      drafts: draftsOf(keyword),
    };
  });
  return { rows, error: statsResult?.error ?? null };
}

const SATURATION_RANK = { 기회: 0, 보통: 1, 높음: 2 } as const;

/** 포화도 기회 → 보통 → 높음 → 계산 불가 순, 같으면 검색량 많은 순 */
export function sortBatchRows(rows: BatchRow[]) {
  const rank = (r: BatchRow) => (r.saturation ? SATURATION_RANK[r.saturation.level] : 3);
  return [...rows].sort((a, b) => rank(a) - rank(b) || (b.stats?.totalSearches ?? -1) - (a.stats?.totalSearches ?? -1));
}

/** 표 칸용 추이 표시. 시즌이면 정점 달을 붙인다 */
export function formatTrendCell(trend: TrendSummary | null) {
  if (!trend) return "-";
  return trend.label === "시즌" && trend.peakMonth ? `시즌(${Number(trend.peakMonth.slice(5))}월)` : trend.label;
}

/** 요약 한 줄 + 표 (마크다운) */
export function formatBatchTable(rows: BatchRow[]) {
  const sorted = sortBatchRows(rows);
  const opportunities = sorted.filter((r) => r.saturation?.level === "기회" && !r.drafts.length);
  const crowded = sorted.filter((r) => r.saturation && r.saturation.level !== "기회" && !r.drafts.length);
  const lines = [
    `키워드 ${rows.length}개 분석. 포화도 "기회"(검색량 대비 글이 적고 문서도 2만 개 아래)이면서 아직 초안이 없는 키워드: ${
      opportunities.length ? opportunities.map((r) => r.keyword).join(", ") : "없음"
    }`,
    ...(crowded.length
      ? [`경쟁이 센 키워드(포화도 보통·높음)는 그대로 쓰지 말고 find_pivot_keywords로 연관어로 돌리세요: ${crowded.map((r) => r.keyword).join(", ")}`]
      : []),
    "광고 경쟁도는 검색광고 입찰 경쟁이라 블로그 노출 경쟁과는 다릅니다. 블로그 경쟁은 블로그 문서 수·포화도로 봅니다.",
    "",
    "| 키워드 | 월간 검색량 | 광고 경쟁도 | 검색 추이 | 최근 7일 | 블로그 문서 수 | 포화도 | 초안 |",
    "|---|---|---|---|---|---|---|---|",
    ...sorted.map((r) =>
      [
        "",
        r.keyword.replace(/\|/g, "/"),
        r.stats === undefined ? "-" : r.stats === null ? "데이터 없음" : formatSearchCount(r.stats.totalSearches),
        r.stats?.competition ?? "-",
        formatTrendCell(r.trend),
        formatSurge(r.surge),
        r.blogTotal === null ? "-" : r.blogTotal.toLocaleString("ko-KR"),
        formatSaturation(r.saturation),
        r.drafts.length ? `✓ ${r.drafts.length}개` : "",
        "",
      ]
        .join(" | ")
        .trim(),
    ),
  ];
  return lines.join("\n");
}
