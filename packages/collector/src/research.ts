/**
 * 키워드 조사: 검색 추이 해석, 포화도, 그리고 HUB 검색 결과(블로그·지식iN·뉴스·카페·지역)를 한 번에 모은다.
 * 웹 키워드 분석, 글쓰기 브리프, MCP research_keyword가 함께 쓴다.
 */
import {
  fetchSearchTrend,
  searchBlog,
  searchCafe,
  searchKin,
  searchNews,
  searchPlaces,
  type BlogPost,
  type CafePost,
  type HubConfig,
  type KinQuestion,
  type NewsArticle,
  type Place,
  type TrendPoint,
} from "./naver-hub.ts";

export type TrendLabel = "시즌" | "급등 이력" | "상승세" | "하락세" | "꾸준함" | "변동 큼" | "데이터 부족";

export interface TrendSummary {
  points: TrendPoint[];
  label: TrendLabel;
  /** 판단 근거 한 줄 */
  reason: string;
  /** 최근 3개월 평균의 직전 9개월 평균 대비 변화율 (%) */
  recentChange: number | null;
  peakMonth: string | null;
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * 월별 추이를 해석한다. 기준은 경험칙이며 글감 판단의 참고용이다.
 * - 시즌: 두 해 모두 같은 달에 정점이 오고, 정점이 중앙값의 2배 이상
 * - 장기 상승·하락: 마지막 6개월 평균이 처음 6개월의 2배 이상이거나 절반 이하
 *   (기간 초반에 정점이 있고 계속 줄어든 경우를 급등으로 잘못 보지 않도록 급등보다 먼저 본다)
 * - 급등 이력: 정점이 중앙값의 4배 이상인데 반복되지 않음
 * - 상승세/하락세: 최근 3개월 평균이 직전 9개월 평균보다 30% 이상 높거나 낮음
 * - 꾸준함: 변동계수 0.25 미만
 */
export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  const ratios = points.map((p) => p.ratio);
  if (points.length < 12 || Math.max(...ratios) === 0) {
    return { points, label: "데이터 부족", reason: "검색 추이 데이터가 충분하지 않습니다.", recentChange: null, peakMonth: null };
  }

  const peak = points.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const mid = median(ratios) || 1;
  const recent = average(ratios.slice(-3));
  const before = average(ratios.slice(-12, -3)) || 1;
  const recentChange = Math.round(((recent - before) / before) * 100);

  // 해마다 가장 높은 달 (24개월이면 두 해)
  const yearly = [points.slice(-24, -12), points.slice(-12)].filter((y) => y.length === 12);
  const yearlyPeaks = yearly.map((y) => y.reduce((a, b) => (b.ratio > a.ratio ? b : a)).month.slice(5, 7));
  const recurring = yearlyPeaks.length === 2 && yearlyPeaks[0] === yearlyPeaks[1];

  const mean = average(ratios);
  const cv = Math.sqrt(average(ratios.map((r) => (r - mean) ** 2))) / (mean || 1);

  const base = { points, recentChange, peakMonth: peak.month };
  const peakMonthName = `${Number(peak.month.slice(5, 7))}월`;

  if (recurring && peak.ratio >= mid * 2) {
    return { ...base, label: "시즌", reason: `해마다 ${peakMonthName}에 검색이 몰립니다 (평소의 ${(peak.ratio / mid).toFixed(1)}배).` };
  }
  const firstHalfYear = average(ratios.slice(0, 6)) || 1;
  const lastHalfYear = average(ratios.slice(-6));
  const longChange = lastHalfYear / firstHalfYear;
  if (longChange <= 0.5) {
    return { ...base, label: "하락세", reason: `최근 6개월 평균이 ${points[0]!.month} 무렵의 ${Math.round(longChange * 100)}% 수준으로 줄었습니다.` };
  }
  if (longChange >= 2) {
    return { ...base, label: "상승세", reason: `최근 6개월 평균이 ${points[0]!.month} 무렵의 ${longChange.toFixed(1)}배로 늘었습니다.` };
  }
  if (peak.ratio >= mid * 4) {
    return { ...base, label: "급등 이력", reason: `${peak.month}에 평소의 ${(peak.ratio / mid).toFixed(1)}배로 급등한 적이 있습니다. 반짝 이슈였을 수 있습니다.` };
  }
  if (recentChange >= 30) return { ...base, label: "상승세", reason: `최근 3개월 평균이 직전 9개월보다 ${recentChange}% 높습니다.` };
  if (recentChange <= -30) return { ...base, label: "하락세", reason: `최근 3개월 평균이 직전 9개월보다 ${-recentChange}% 낮습니다.` };
  if (cv < 0.25) return { ...base, label: "꾸준함", reason: "1년 내내 검색량이 고르게 유지됩니다." };
  return { ...base, label: "변동 큼", reason: "뚜렷한 패턴 없이 달마다 오르내립니다." };
}

export type SaturationLevel = "기회" | "보통" | "높음";

export interface Saturation {
  /** 블로그 문서 수 ÷ 월간 검색량 */
  ratio: number;
  level: SaturationLevel;
}

/**
 * 검색량 대비 블로그 글이 얼마나 많은지. 낮을수록 새 글이 노출될 여지가 크다.
 * 블로그 문서 수는 지금까지 쌓인 전체 글 수라 비율이 크게 나온다. 기준은 실제 키워드 측정값으로 잡았다
 * (2026-10: 롱테일 정보 키워드 2~10배, 중간 39배, 넓은 주제어 67~800배).
 */
export function computeSaturation(monthlySearches: number | null | undefined, blogTotal: number | null | undefined): Saturation | null {
  if (!monthlySearches || blogTotal === null || blogTotal === undefined) return null;
  const ratio = Math.round((blogTotal / monthlySearches) * 10) / 10;
  return { ratio, level: ratio <= 10 ? "기회" : ratio <= 50 ? "보통" : "높음" };
}

export interface KeywordResearch {
  trend: TrendSummary | null;
  blog: { total: number; items: BlogPost[] } | null;
  kin: KinQuestion[] | null;
  news: NewsArticle[] | null;
  cafe: CafePost[] | null;
  places: Place[] | null;
  /** 실패한 항목과 이유 (나머지는 정상으로 채워진다) */
  errors: Partial<Record<"trend" | "blog" | "kin" | "news" | "cafe" | "places", string>>;
}

/** HUB API를 병렬로 조회한다. 하나가 실패해도 나머지는 채운다 */
export async function researchKeyword(config: HubConfig, keyword: string): Promise<KeywordResearch> {
  const [trend, blog, kin, news, cafe, places] = await Promise.allSettled([
    fetchSearchTrend(config, keyword).then(summarizeTrend),
    searchBlog(config, keyword, 10),
    searchKin(config, keyword, 10).then((r) => r.items),
    searchNews(config, keyword, 5).then((r) => r.items),
    searchCafe(config, keyword, 10).then((r) => r.items),
    searchPlaces(config, keyword, 5),
  ]);

  const errors: KeywordResearch["errors"] = {};
  const take = <T>(name: keyof KeywordResearch["errors"], result: PromiseSettledResult<T>) => {
    if (result.status === "fulfilled") return result.value;
    errors[name] = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return null;
  };

  return {
    trend: take("trend", trend),
    blog: take("blog", blog),
    kin: take("kin", kin),
    news: take("news", news),
    cafe: take("cafe", cafe),
    places: take("places", places),
    errors,
  };
}
