/**
 * 연관어로 돌리기: 대표 키워드가 경쟁이 세면(포화도 보통·높음) 연관 키워드 중 검색량은 적당하고
 * 경쟁 글은 적은 키워드를 골라, 글이 적은 블로그도 상위에 오를 수 있는 타깃 키워드를 추천한다.
 * 브리프(get_writing_brief·/blog-draft), MCP find_pivot_keywords, 웹 키워드 분석이 함께 쓴다.
 *
 * 예 (2026-11 실측): "절임배추"(월 87,100회·문서 62만) → "절임배추 20kg 몇포기"(월 11,780회·문서 5,280)
 */
import { mapLimit } from "./batch.ts";
import { formatSearchCount } from "./brief.ts";
import { fetchTopicKeywords, hasIntent, NAVIGATIONAL_WORDS } from "./discover.ts";
import { fetchDailyTrends, searchBlog, type HubConfig } from "./naver-hub.ts";
import { fetchRelatedKeywords, toHintKeyword, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import { computeSaturation, formatSaturation, formatSurge, summarizeSurge, type Saturation, type Surge } from "./research.ts";
import { normalizeKeyword } from "./sources.ts";

/** 너무 적으면 유입이 없고, 너무 많으면 다시 대표 키워드 경쟁이다 */
export const PIVOT_MIN_SEARCHES = 300;
export const PIVOT_MAX_SEARCHES = 30_000;
/** 문서 수·일간 추이까지 조회할 후보 수 (검색량만으로는 경쟁 글 수를 알 수 없어 넉넉히 본다. API HUB 호출이 후보마다 1번) */
export const PIVOT_CHECK_LIMIT = 25;
/** 브리프·표에 보여 줄 수 */
export const PIVOT_SHOW = 8;

export interface PivotRow {
  keyword: string;
  searches: number;
  blogTotal: number | null;
  saturation: Saturation | null;
  surge: Surge | null;
  intent: boolean;
  /** 검색량 대비 경쟁 글이 적을수록 큼. 문서 수를 모르면 null */
  score: number | null;
}

/** 이 포화도면 연관어로 돌리기를 권한다 (기회가 아니면) */
export const needsPivot = (saturation: Saturation | null) => saturation !== null && saturation.level !== "기회";

/**
 * 연관 키워드가 대표 키워드의 단어를 품는지. 붙여 쓴 4글자 이상 단어는 앞뒤 두 글자씩만 봐서
 * "독감증상" → "독감초기증상", "절임배추" → "김장배추절임"처럼 사이에 말이 끼어도 같은 주제로 본다
 */
function coversToken(key: string, token: string) {
  if (key.includes(token)) return true;
  return token.length >= 4 && key.includes(token.slice(0, 2)) && key.includes(token.slice(-2));
}

/** 대표 키워드의 단어를 모두 품고, 검색량이 적당한 연관 키워드. 검색량 순 (경쟁 글 수는 조회해 봐야 안다) */
export function pivotCandidates(keyword: string, stats: KeywordStat[]) {
  const self = normalizeKeyword(toHintKeyword(keyword));
  const tokens = keyword.split(/\s+/).map((t) => normalizeKeyword(toHintKeyword(t))).filter(Boolean);
  const seen = new Set<string>();
  return stats
    .filter((s) => {
      const key = normalizeKeyword(s.keyword);
      if (seen.has(key)) return false;
      seen.add(key);
      return (
        key !== self &&
        tokens.every((t) => coversToken(key, t)) &&
        s.totalSearches >= PIVOT_MIN_SEARCHES &&
        s.totalSearches <= PIVOT_MAX_SEARCHES &&
        !NAVIGATIONAL_WORDS.some((w) => key.includes(w))
      );
    })
    .sort((a, b) => b.totalSearches - a.totalSearches)
    .slice(0, PIVOT_CHECK_LIMIT);
}

const SURGE_BOOST = { 급상승: 1.5, 상승: 1.2, 보통: 1, 하락: 0.8, "데이터 부족": 1 } as const;

/** 검색량 ÷ (경쟁 글 + 1,000). 지금 오르는 중이면 가산. 1,000은 문서가 몇 개뿐인 키워드가 과하게 튀지 않게 */
export function pivotScore(searches: number, blogTotal: number | null, surge: Surge | null) {
  if (blogTotal === null) return null;
  return Math.round((searches / (blogTotal + 1000)) * SURGE_BOOST[surge?.label ?? "데이터 부족"] * 100) / 100;
}

/** 점수 높은 순 (문서 수를 모르는 건 뒤로), 같으면 정보형 먼저 */
export function rankPivots(rows: PivotRow[]) {
  return [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || Number(b.intent) - Number(a.intent) || b.searches - a.searches);
}

/** 돌려서 실제로 나아지는 연관어가 있는지 (포화도 기회인 후보) */
export const hasOpenPivot = (rows: PivotRow[]) => rows.some((r) => r.saturation?.level === "기회");

/**
 * 연관어 후보를 모아(이미 받은 연관 키워드 + "키워드+신청·조건·방법·추천" 힌트) 문서 수·일간 추이를 조회해 점수순으로.
 * 검색광고 호출 1번(1초 간격 규칙), API HUB는 후보 수 + 묶음 추이 몇 번
 */
export async function findPivots(
  { searchAd, hub }: { searchAd: SearchAdConfig; hub: HubConfig | null },
  keyword: string,
  { related = [] }: { related?: KeywordStat[] } = {},
): Promise<PivotRow[]> {
  const more = await fetchTopicKeywords(searchAd, [keyword]).catch(() => fetchRelatedKeywords(searchAd, [keyword]).catch(() => []));
  let candidates = pivotCandidates(keyword, [...related, ...more]);
  // "독감증상"처럼 붙여 쓴 키워드는 검색광고가 연관어를 거의 안 준다. 앞 두 글자("독감")로 넓게 받아 다시 거른다
  const head = toHintKeyword(keyword.split(/\s+/)[0] ?? "");
  if (candidates.length < 5 && head.length >= 4) {
    const wider = await fetchRelatedKeywords(searchAd, [head.slice(0, 2)]).catch(() => []);
    candidates = pivotCandidates(keyword, [...related, ...more, ...wider]);
  }
  if (candidates.length === 0) return [];
  const [blogTotals, daily] = await Promise.all([
    hub ? mapLimit(candidates, 5, (c) => searchBlog(hub, c.keyword, 1).then((r) => r.total).catch(() => null)) : candidates.map(() => null),
    hub ? fetchDailyTrends(hub, candidates.map((c) => c.keyword)) : new Map(),
  ]);
  return rankPivots(
    candidates.map((c, i) => {
      const blogTotal = blogTotals[i] ?? null;
      const points = daily.get(c.keyword);
      const surge = points ? summarizeSurge(points) : null;
      return {
        keyword: c.keyword,
        searches: c.totalSearches,
        blogTotal,
        saturation: computeSaturation(c.totalSearches, blogTotal),
        surge,
        intent: hasIntent(c.keyword),
        score: pivotScore(c.totalSearches, blogTotal, surge),
      };
    }),
  );
}

/** 마크다운 표 (브리프·MCP) */
export function formatPivotTable(rows: PivotRow[]) {
  return [
    "| 키워드 | 월간 검색량 | 블로그 문서 수 | 포화도 | 최근 7일 |",
    "|---|---|---|---|---|",
    ...rows
      .slice(0, PIVOT_SHOW)
      .map((r) => `| ${r.keyword} | ${formatSearchCount(r.searches)} | ${r.blogTotal === null ? "-" : r.blogTotal.toLocaleString("ko-KR")} | ${formatSaturation(r.saturation)} | ${formatSurge(r.surge)} |`),
  ].join("\n");
}
