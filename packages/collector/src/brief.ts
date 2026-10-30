/**
 * claude.ai 프로젝트(docs/prompts)에 붙여넣을 [글쓰기 브리프]를 만든다.
 * 형식은 docs/prompts/writing.md의 "입력 형식"과 맞춰야 한다.
 */
import type { HubConfig } from "./naver-hub.ts";
import { fetchRelatedKeywords, toHintKeyword, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import { PLATFORM_LABELS, WRITING_TYPE_LABELS, type Platform, type WritingType } from "./platforms.ts";
import { computeSaturation, researchKeyword, type KeywordResearch } from "./research.ts";
import { normalizeKeyword, SOURCE_LABELS } from "./sources.ts";
import type { DayKeyword } from "./types.ts";

/** 브리프에 넣을 항목 수 */
const BRIEF_RELATED_COUNT = 20;
const BRIEF_QUESTION_COUNT = 8;
const BRIEF_BLOG_COUNT = 5;
const BRIEF_CAFE_COUNT = 5;

/** 검색량 표시. 네이버가 "< 10"으로 주는 값은 0으로 저장돼 있다 */
export function formatSearchCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (value === 0) return "<10";
  return value.toLocaleString("ko-KR");
}

/** 연관 키워드 응답에서 조회한 키워드 자신을 분리한다 */
export function splitSelf(keyword: string, related: KeywordStat[]) {
  const selfKey = normalizeKeyword(toHintKeyword(keyword));
  const self = related.find((r) => normalizeKeyword(r.keyword) === selfKey) ?? null;
  return { self, others: related.filter((r) => r !== self) };
}

/** 띄어쓰기 기준 단어 (두 글자 이상) */
function keywordTokens(keyword: string) {
  return keyword.split(/\s+/).map(toHintKeyword).filter((t) => t.length >= 2);
}

/**
 * 키워드 자신의 수치와 연관 키워드를 조회한다.
 * 검색광고 API는 "국민연금 수령나이" 같은 롱테일 키워드에는 자기 자신만 돌려주므로,
 * 각 단어("국민연금", "수령나이")도 힌트로 함께 넣는다. 힌트는 한 요청에 5개까지라 호출은 1번이다.
 */
export async function fetchKeywordInsight(config: SearchAdConfig, keyword: string) {
  const tokens = keywordTokens(keyword);
  const hints = [keyword, ...(tokens.length > 1 ? tokens : [])].slice(0, 5);
  const { self, others } = splitSelf(keyword, await fetchRelatedKeywords(config, hints));
  return { self, related: others, tokens };
}

/** 키워드의 단어를 많이 포함할수록 앞으로, 같으면 검색량 순. 넓게 받은 연관 키워드에서 관련 높은 것을 고르기 위함 */
export function rankByRelevance(related: KeywordStat[], tokens: string[]) {
  const keys = tokens.map(normalizeKeyword);
  const matches = (r: KeywordStat) => keys.filter((k) => normalizeKeyword(r.keyword).includes(k)).length;
  return [...related].sort((a, b) => matches(b) - matches(a) || b.totalSearches - a.totalSearches);
}

export interface WritingBriefInput {
  platform: Platform;
  type?: WritingType;
  keyword: string;
  /** null = 검색광고에 데이터 없음, undefined = 조회하지 않음(키 미설정 등) */
  self?: KeywordStat | null;
  related?: KeywordStat[];
  /** NAVER API HUB 조사 결과 (키가 없으면 생략) */
  research?: KeywordResearch | null;
  note?: string;
}

/** 표 칸에 넣을 수 있게 | 와 줄바꿈을 정리 */
const cell = (value: string | null | undefined) => (value ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();

export function formatWritingBrief({ platform, type = "info", keyword, self, related = [], research, note }: WritingBriefInput) {
  const stats =
    self === undefined
      ? "조회하지 않음"
      : self === null
        ? "데이터 없음"
        : `${formatSearchCount(self.totalSearches)} (PC ${formatSearchCount(self.pcSearches)} / 모바일 ${formatSearchCount(self.mobileSearches)}) · 경쟁도: ${self.competition}`;

  const lines = [
    "[글쓰기 브리프]",
    `플랫폼: ${PLATFORM_LABELS[platform]}`,
    `유형: ${WRITING_TYPE_LABELS[type]}`,
    `키워드: ${keyword}`,
    `월간 검색량: ${stats}`,
  ];

  if (research?.trend && research.trend.label !== "데이터 부족") {
    lines.push(`검색 추이: ${research.trend.label} — ${research.trend.reason}`);
  }
  if (research?.blog) {
    const saturation = computeSaturation(self?.totalSearches, research.blog.total);
    lines.push(
      `블로그 문서 수: ${research.blog.total.toLocaleString("ko-KR")}${saturation ? ` (검색량의 ${saturation.ratio}배 · 포화도 ${saturation.level})` : ""}`,
    );
  }

  const top = related.slice(0, BRIEF_RELATED_COUNT);
  if (top.length > 0) {
    lines.push(
      "연관 키워드 (관련 높은 순):",
      "| 키워드 | 월간 검색량 | 경쟁도 |",
      "|---|---|---|",
      ...top.map((r) => `| ${r.keyword} | ${formatSearchCount(r.totalSearches)} | ${r.competition} |`),
    );
  }

  if (research?.kin?.length) {
    lines.push("실제 질문 (지식iN):", ...research.kin.slice(0, BRIEF_QUESTION_COUNT).map((q) => `- ${cell(q.title)}`));
  }
  if (research?.blog?.items.length) {
    lines.push(
      "상위 블로그 글 (겹치지 않는 각도를 잡기 위한 참고):",
      ...research.blog.items.slice(0, BRIEF_BLOG_COUNT).map((b) => `- ${cell(b.title)} (${b.date})`),
    );
  }
  if (type !== "info" && research?.cafe?.length) {
    lines.push("카페 글 (실제 후기·고민):", ...research.cafe.slice(0, BRIEF_CAFE_COUNT).map((c) => `- ${cell(c.title)}`));
  }
  if (type === "place" && research?.places?.length) {
    lines.push(
      "장소 정보 (네이버 지역 검색):",
      "| 이름 | 분류 | 도로명 주소 | 링크 |",
      "|---|---|---|---|",
      ...research.places.map((p) => `| ${cell(p.title)} | ${cell(p.category)} | ${cell(p.roadAddress || p.address)} | ${p.link || "-"} |`),
    );
  }
  if (note?.trim()) lines.push(`참고: ${note.trim()}`);
  return lines.join("\n");
}

export type DaySort = "search" | "recent";

/** 키워드 기록 정렬. search: 월간 검색량 많은 순(조회 전·데이터 없음은 뒤로), recent: 처음 본 시각이 늦은 순 */
export function sortDayKeywords(keywords: DayKeyword[], sort: DaySort) {
  // 파일에는 처음 본 순서대로 저장돼 있다
  const recent = [...keywords].reverse();
  if (sort === "recent") return recent;
  return recent.sort((a, b) => (b.stats?.totalSearches ?? -1) - (a.stats?.totalSearches ?? -1));
}

/**
 * claude.ai 프로젝트에 붙여넣을 [글감 브리핑]을 만든다.
 * 형식은 docs/prompts/planning.md의 "입력 형식"과 맞춰야 한다.
 */
export function formatPlanningBriefing(
  date: string,
  keywords: DayKeyword[],
  { sort = "search", limit = 20 }: { sort?: DaySort; limit?: number } = {},
) {
  const rows = sortDayKeywords(keywords, sort).slice(0, limit);
  return [
    "[글감 브리핑]",
    `날짜: ${date}`,
    "| 키워드 | 월간 검색량 | 경쟁도 | 소스 | 처음 본 시각 | 관련 뉴스 |",
    "|---|---|---|---|---|---|",
    ...rows.map((k) =>
      [
        "",
        cell(k.keyword),
        k.stats === undefined ? "조회 전" : formatSearchCount(k.stats?.totalSearches),
        k.stats?.competition ?? "-",
        k.sources.map((s) => SOURCE_LABELS[s]).join(", "),
        k.firstSeen,
        cell(k.related),
        "",
      ].join(" | ").trim(),
    ),
  ].join("\n");
}

export interface BriefSources {
  searchAd: SearchAdConfig | null;
  hub: HubConfig | null;
}

/**
 * 검색광고(검색량·연관 키워드)와 NAVER API HUB(추이·문서 수·질문·상위 글 등)를 함께 조회해 브리프를 만든다.
 * 키가 없는 쪽은 건너뛰고, HUB 조사가 실패해도 브리프는 만든다.
 */
export async function buildWritingBrief(
  { searchAd, hub }: BriefSources,
  keyword: string,
  platform: Platform,
  { type = "info", note }: { type?: WritingType; note?: string } = {},
) {
  const [insight, research] = await Promise.all([
    searchAd ? fetchKeywordInsight(searchAd, keyword) : null,
    hub ? researchKeyword(hub, keyword).catch(() => null) : null,
  ]);
  return formatWritingBrief({
    platform,
    type,
    keyword,
    self: insight?.self,
    related: insight ? rankByRelevance(insight.related, insight.tokens) : [],
    research,
    note,
  });
}
