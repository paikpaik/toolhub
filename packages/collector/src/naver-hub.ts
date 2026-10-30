/**
 * NAVER API HUB (네이버 클라우드) - 검색어 트렌드, 쇼핑 인사이트, 검색(블로그·지식iN·뉴스·카페글·지역)
 * https://api.ncloud-docs.com/docs/naver-api-hub-overview
 *
 * 필요한 환경변수 (네이버 클라우드 콘솔 > NAVER API HUB > Application > 인증 정보)
 *   NAVER_API_HUB_CLIENT_ID
 *   NAVER_API_HUB_CLIENT_SECRET
 */

const BASE_URL = "https://naverapihub.apigw.ntruss.com";
const TIMEOUT_MS = 15_000;

export interface HubConfig {
  clientId: string;
  clientSecret: string;
}

export function hubConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HubConfig | null {
  const clientId = env.NAVER_API_HUB_CLIENT_ID?.trim();
  const clientSecret = env.NAVER_API_HUB_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export class HubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(config: HubConfig, path: string, init: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const url = `${BASE_URL}${path}${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: init.body ? "POST" : "GET",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": config.clientId,
        "X-NCP-APIGW-API-KEY": config.clientSecret,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return res.json() as Promise<T>;
    // 429는 한 번만 잠시 쉬었다가 다시 시도한다
    if (res.status === 429 && attempt === 0) {
      await sleep(2_000);
      continue;
    }
    throw new HubError(res.status, `NAVER API HUB ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** 검색 결과의 <b> 강조 태그와 HTML 엔티티를 걷어낸다 */
export function cleanText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

// ── 검색 ────────────────────────────────────────────────────────────

interface SearchResponse<T> {
  total: number;
  items: T[];
}

export interface BlogPost {
  title: string;
  link: string;
  description: string;
  blogger: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface KinQuestion {
  title: string;
  link: string;
  description: string;
}

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  /** ISO 형식 */
  date: string;
}

export interface CafePost {
  title: string;
  link: string;
  description: string;
  cafe: string;
}

export interface Place {
  title: string;
  link: string;
  category: string;
  address: string;
  roadAddress: string;
}

const toDate = (yyyymmdd: string) => (/^\d{8}$/.test(yyyymmdd) ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}` : yyyymmdd);

export async function searchBlog(config: HubConfig, query: string, display = 10) {
  const data = await request<SearchResponse<{ title: string; link: string; description: string; bloggername: string; postdate: string }>>(
    config,
    "/search/v1/blog",
    { query: { query, display: String(display), sort: "sim" } },
  );
  return {
    total: data.total,
    items: data.items.map<BlogPost>((i) => ({
      title: cleanText(i.title),
      link: i.link,
      description: cleanText(i.description),
      blogger: i.bloggername,
      date: toDate(i.postdate),
    })),
  };
}

export async function searchKin(config: HubConfig, query: string, display = 10) {
  const data = await request<SearchResponse<{ title: string; link: string; description: string }>>(config, "/search/v1/kin", {
    query: { query, display: String(display), sort: "sim" },
  });
  return {
    total: data.total,
    items: data.items.map<KinQuestion>((i) => ({ title: cleanText(i.title), link: i.link, description: cleanText(i.description) })),
  };
}

export async function searchNews(config: HubConfig, query: string, display = 5) {
  const data = await request<SearchResponse<{ title: string; link: string; originallink: string; description: string; pubDate: string }>>(
    config,
    "/search/v1/news",
    { query: { query, display: String(display), sort: "date" } },
  );
  return {
    total: data.total,
    items: data.items.map<NewsArticle>((i) => ({
      title: cleanText(i.title),
      link: i.originallink || i.link,
      description: cleanText(i.description),
      date: Number.isNaN(Date.parse(i.pubDate)) ? i.pubDate : new Date(i.pubDate).toISOString(),
    })),
  };
}

export async function searchCafe(config: HubConfig, query: string, display = 10) {
  const data = await request<SearchResponse<{ title: string; link: string; description: string; cafename: string }>>(
    config,
    "/search/v1/cafearticle",
    { query: { query, display: String(display), sort: "sim" } },
  );
  return {
    total: data.total,
    items: data.items.map<CafePost>((i) => ({ title: cleanText(i.title), link: i.link, description: cleanText(i.description), cafe: i.cafename })),
  };
}

/** 지역 검색은 한 번에 최대 5개 */
export async function searchPlaces(config: HubConfig, query: string, display = 5) {
  const data = await request<SearchResponse<{ title: string; link: string; category: string; address: string; roadAddress: string }>>(
    config,
    "/search/v1/local",
    { query: { query, display: String(Math.min(display, 5)), sort: "random" } },
  );
  return data.items.map<Place>((i) => ({
    title: cleanText(i.title),
    link: i.link,
    category: i.category,
    address: i.address,
    roadAddress: i.roadAddress,
  }));
}

// ── 검색어 트렌드 · 쇼핑 인사이트 ─────────────────────────────────────

export interface TrendPoint {
  /** YYYY-MM */
  month: string;
  /** 기간 중 최댓값을 100으로 한 상대값 */
  ratio: number;
}

interface TrendResponse {
  results: { title: string; data: { period: string; ratio: number }[] }[];
}

/** 최근 months개월의 월별 범위. 이번 달은 아직 덜 쌓여 값이 낮게 나오므로 지난달까지만 */
function monthRange(months: number, today = new Date()) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

const toPoints = (data: TrendResponse) =>
  (data.results[0]?.data ?? []).map<TrendPoint>((d) => ({ month: d.period.slice(0, 7), ratio: Math.round(d.ratio * 10) / 10 }));

/** 네이버 통합검색 월별 검색 추이 (기본 24개월: 같은 달이 두 번 들어가야 시즌성을 볼 수 있다) */
export async function fetchSearchTrend(config: HubConfig, keyword: string, months = 24) {
  const data = await request<TrendResponse>(config, "/search-trend/v1/search", {
    body: { ...monthRange(months), timeUnit: "month", keywordGroups: [{ groupName: keyword, keywords: [keyword] }] },
  });
  return toPoints(data);
}

/** 네이버쇼핑 대분류 코드 (쇼핑 인사이트의 category 필수값) */
export const SHOPPING_CATEGORIES = {
  "50000000": "패션의류",
  "50000001": "패션잡화",
  "50000002": "화장품/미용",
  "50000003": "디지털/가전",
  "50000004": "가구/인테리어",
  "50000005": "출산/육아",
  "50000006": "식품",
  "50000007": "스포츠/레저",
  "50000008": "생활/건강",
  "50000009": "여가/생활편의",
  "50005542": "도서",
} as const;

export type ShoppingCategory = keyof typeof SHOPPING_CATEGORIES;

/** 쇼핑 분야 안에서 키워드의 월별 검색 클릭 추이 */
export async function fetchShoppingTrend(config: HubConfig, keyword: string, category: ShoppingCategory, months = 24) {
  const data = await request<TrendResponse>(config, "/shopping/v1/category/keywords", {
    body: { ...monthRange(months), timeUnit: "month", category, keyword: [{ name: keyword, param: [keyword] }] },
  });
  return toPoints(data);
}
