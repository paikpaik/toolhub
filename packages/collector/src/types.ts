export type SourceName = "google" | "nate" | "signal";

/** 소스 하나에서 수집한 키워드 한 건 */
export interface KeywordItem {
  source: SourceName;
  rank: number;
  keyword: string;
  /** 구글 트렌드의 대략적인 검색량 (예: "2000+" → 2000). 다른 소스는 null */
  traffic: number | null;
  /** 순위 변동 (네이트: "n" 신규, "+2" 상승, "-1" 하락 등) */
  state: string | null;
  /** 관련 뉴스 제목 또는 검색용 키워드 */
  related: string | null;
  url: string | null;
}

/** 전체 소스를 한 번 조회한 결과 */
export interface CollectResult {
  collectedAt: string;
  errors: Partial<Record<SourceName, string>>;
  items: KeywordItem[];
}

/** 그날 한 번이라도 뜬 키워드 (키워드당 한 줄) */
export interface DayKeyword {
  keyword: string;
  sources: SourceName[];
  /** 처음 본 시각 (KST HH:mm) */
  firstSeen: string;
  bestRank: number;
  maxTraffic: number | null;
  related: string | null;
  url: string | null;
}

/** data/YYYY-MM-DD.json */
export interface DayRecord {
  date: string;
  updatedAt: string;
  /** 처음 본 순서대로 */
  keywords: DayKeyword[];
}
