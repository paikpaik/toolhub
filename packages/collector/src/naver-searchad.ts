/**
 * 네이버 검색광고 API - 키워드 도구 (/keywordstool)
 * 키워드별 월간 검색수(PC/모바일), 경쟁 정도, 연관 키워드를 조회한다.
 *
 * 필요한 환경변수 (searchad.naver.com > 도구 > API 사용 관리에서 발급)
 *   NAVER_SEARCHAD_API_KEY      액세스 라이선스
 *   NAVER_SEARCHAD_SECRET_KEY   비밀키
 *   NAVER_SEARCHAD_CUSTOMER_ID  CUSTOMER_ID
 */
import { createHmac } from "node:crypto";
import { normalizeKeyword } from "./sources.ts";

const BASE_URL = "https://api.searchad.naver.com";
/** 한 번에 넣을 수 있는 힌트 키워드 수 */
const MAX_HINTS = 5;
const TIMEOUT_MS = 15_000;
/** 키워드 도구는 호출 한도가 낮아(429) 요청 사이에 간격을 둔다. 프로세스 전체에서 공유한다 */
const MIN_REQUEST_INTERVAL_MS = 1_000;
/** 429를 받았을 때 재시도 대기 시간 */
const RETRY_DELAYS_MS = [2_000, 4_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let nextRequestAt = 0;

async function waitForSlot() {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

export interface SearchAdConfig {
  apiKey: string;
  secretKey: string;
  customerId: string;
}

export interface KeywordStat {
  keyword: string;
  /** 월간 검색수. 네이버가 "< 10"으로 주는 경우 0 */
  pcSearches: number;
  mobileSearches: number;
  totalSearches: number;
  /** 경쟁 정도: "낮음" | "중간" | "높음" */
  competition: string;
  /** 월평균 클릭수 (PC + 모바일) */
  monthlyClicks: number;
}

interface RawKeyword {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  monthlyAvePcClkCnt: number | string;
  monthlyAveMobileClkCnt: number | string;
  compIdx: string;
}

export function searchAdConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SearchAdConfig | null {
  const apiKey = env.NAVER_SEARCHAD_API_KEY?.trim();
  const secretKey = env.NAVER_SEARCHAD_SECRET_KEY?.trim();
  const customerId = env.NAVER_SEARCHAD_CUSTOMER_ID?.trim();
  return apiKey && secretKey && customerId ? { apiKey, secretKey, customerId } : null;
}

/** 키워드 도구는 공백·특수문자가 들어간 힌트를 거부하므로 글자와 숫자만 남긴다 */
export function toHintKeyword(keyword: string) {
  return keyword.replace(/[^\p{L}\p{N}]/gu, "");
}

function parseCount(value: number | string) {
  if (typeof value === "number") return value;
  if (value.includes("<")) return 0;
  return Number(value.replace(/,/g, "")) || 0;
}

function toStat(raw: RawKeyword): KeywordStat {
  const pcSearches = parseCount(raw.monthlyPcQcCnt);
  const mobileSearches = parseCount(raw.monthlyMobileQcCnt);
  return {
    keyword: raw.relKeyword,
    pcSearches,
    mobileSearches,
    totalSearches: pcSearches + mobileSearches,
    competition: raw.compIdx,
    monthlyClicks: Math.round(parseCount(raw.monthlyAvePcClkCnt) + parseCount(raw.monthlyAveMobileClkCnt)),
  };
}

async function request<T>(config: SearchAdConfig, uri: string, query: Record<string, string>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(config, uri, query);
    } catch (e) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (!(e instanceof SearchAdError && e.status === 429) || delay === undefined) throw e;
      await sleep(delay);
    }
  }
}

async function requestOnce<T>(config: SearchAdConfig, uri: string, query: Record<string, string>): Promise<T> {
  await waitForSlot();
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", config.secretKey).update(`${timestamp}.GET.${uri}`).digest("base64");
  const res = await fetch(`${BASE_URL}${uri}?${new URLSearchParams(query)}`, {
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": config.apiKey,
      "X-Customer": config.customerId,
      "X-Signature": signature,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new SearchAdError(res.status, `검색광고 API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export class SearchAdError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 힌트 키워드(최대 5개)와 그 연관 키워드들의 검색량. 검색량 많은 순 */
export async function fetchRelatedKeywords(config: SearchAdConfig, hints: string[]): Promise<KeywordStat[]> {
  const cleaned = [...new Set(hints.map(toHintKeyword).filter(Boolean))].slice(0, MAX_HINTS);
  if (cleaned.length === 0) return [];
  const data = await request<{ keywordList?: RawKeyword[] }>(config, "/keywordstool", {
    hintKeywords: cleaned.join(","),
    showDetail: "1",
  });
  return (data.keywordList ?? []).map(toStat).sort((a, b) => b.totalSearches - a.totalSearches);
}

/**
 * 키워드마다 자기 자신의 검색량을 찾는다. 검색광고에 데이터가 없는 키워드는 null.
 * 도중에 실패하면 그때까지 조회한 결과와 에러를 함께 반환한다 (조회한 만큼은 저장할 수 있도록).
 * 요청 간격 때문에 오래 걸리므로 한 번에 maxKeywords개까지만 조회하고, 나머지는 다음 호출에 맡긴다.
 */
export async function fetchKeywordStats(config: SearchAdConfig, allKeywords: string[], { maxKeywords = 50 } = {}) {
  const keywords = allKeywords.slice(0, maxKeywords);
  const stats = new Map<string, KeywordStat | null>();
  let error: string | null = null;

  const lookup = async (batch: string[]) => {
    const found = new Map((await fetchRelatedKeywords(config, batch)).map((s) => [normalizeKeyword(s.keyword), s]));
    for (const k of batch) stats.set(k, found.get(normalizeKeyword(toHintKeyword(k))) ?? null);
  };

  for (let i = 0; i < keywords.length; i += MAX_HINTS) {
    const batch = keywords.slice(i, i + MAX_HINTS);
    try {
      await lookup(batch);
    } catch (e) {
      // 400이면 묶음 속 키워드 하나가 거부된 것일 수 있어 하나씩 다시 시도하고, 그래도 안 되면 데이터 없음으로 처리
      if (e instanceof SearchAdError && e.status === 400 && batch.length > 1) {
        for (const k of batch) await lookup([k]).catch(() => stats.set(k, null));
        continue;
      }
      error = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  return { stats, error, remaining: allKeywords.length - stats.size };
}
