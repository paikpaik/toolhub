/**
 * claude.ai 프로젝트(docs/prompts)에 붙여넣을 [글쓰기 브리프]를 만든다.
 * 형식은 docs/prompts/writing.md의 "입력 형식"과 맞춰야 한다.
 */
import { fetchDailyTrends, type HubConfig } from "./naver-hub.ts";
import { fetchRelatedKeywords, toHintKeyword, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import {
  CONNECT_DISCLOSURE,
  CONNECT_MODE_LABELS,
  NAVER_FORMAT_LABELS,
  PLATFORM_LABELS,
  randomStructure,
  structureLine,
  WRITING_TYPE_LABELS,
  type ConnectMode,
  type NaverFormat,
  type Platform,
  type Structure,
  type WritingType,
} from "./platforms.ts";
import { findPivots, formatPivotTable, hasOpenPivot, needsPivot, type PivotRow } from "./pivot.ts";
import { computeSaturation, formatSaturation, formatSurge, researchKeyword, summarizeSurge, type KeywordResearch, type Surge } from "./research.ts";
import { normalizeKeyword, SOURCE_LABELS } from "./sources.ts";
import type { DayKeyword } from "./types.ts";

/** 브리프에 넣을 항목 수 */
const BRIEF_RELATED_COUNT = 20;
const BRIEF_QUESTION_COUNT = 8;
const BRIEF_BLOG_COUNT = 5;
const BRIEF_CAFE_COUNT = 5;
/** 상품 페이지에서 읽은 글자 정보가 너무 길면 여기까지만 넣는다 (상세 FAQ·표가 아주 긴 상품이 있음) */
const BRIEF_PRODUCT_MAX = 5000;

/** 쇼핑 커넥트(type connect) 글에만 쓰는 입력. 사람만 아는 정보와 확장이 상품 페이지에서 읽은 정보 */
export interface ConnectBrief {
  /** 브랜드커넥트에서 복사한 제휴 링크 */
  link?: string;
  /** 생략하면 경험 메모가 있으면 experience, 없으면 guide */
  mode?: ConnectMode;
  /** 상품명·가격·수수료·평점·상세 정보(FAQ·표) 등 상품 페이지 글자 */
  product?: string;
  /** 직접 써 본 경험 메모 (실제 경험 방식) */
  experience?: string;
}

/** 쇼핑 커넥트 브리프 줄. 경험 메모 없이 실제 경험을 고르면 지어내지 않도록 구매 가이드로 쓴다 */
export function connectBriefLines({ link, mode, product, experience }: ConnectBrief = {}) {
  const memo = experience?.trim();
  const picked: ConnectMode = memo ? (mode ?? "experience") : "guide";
  const lines = [
    `글 방식: ${CONNECT_MODE_LABELS[picked]}${
      picked === "guide"
        ? mode === "experience"
          ? " (실제 경험을 골랐지만 경험 메모가 없어 구매 가이드로 씁니다. 사용 경험을 지어내지 않습니다)"
          : " (사용 경험을 지어내지 않습니다)"
        : " (경험 메모에 있는 내용만 1인칭으로 씁니다)"
    }`,
    `쇼핑 커넥트 링크: ${link?.trim() || "없음 — 링크 자리마다 [링크: 쇼핑 커넥트] 한 줄을 둡니다"}`,
    `대가성 문구 (본문 맨 위에 글자 그대로): ${CONNECT_DISCLOSURE}`,
  ];
  const info = product?.trim();
  if (info) {
    const clipped = info.length > BRIEF_PRODUCT_MAX ? `${info.slice(0, BRIEF_PRODUCT_MAX)}\n…(이하 생략)` : info;
    lines.push("상품 정보 (판매처 페이지에서 읽은 내용, 글 쓴 시점 기준. 효능·성능은 판매처 설명으로만 씁니다):", clipped);
  }
  if (memo && picked === "experience") lines.push("경험 메모:", memo);
  return lines;
}

/** 네이버 글 형식 안내 (docs/prompts/platforms/naver.md의 같은 이름 절) */
const FORMAT_GUIDES: Record<NaverFormat, string> = {
  search: "검색해서 들어온 사람의 질문에 바로 답합니다. 네이버 규칙의 \"검색형\"을 따릅니다",
  home: "홈판을 넘기던 사람이 멈추도록, 공개된 숫자·비교로 판단(가 볼 만한가, 누구에게 이득인가)을 내려 줍니다. 네이버 규칙의 \"홈판형\"을 따릅니다. save_draft에 format=home",
};

/** 브리프의 "글 형식:" 줄. 네이버 글에만 (쇼핑 커넥트는 따로 정한 형식이라 빼고) */
export function formatLine(platform: Platform, type: WritingType, format: NaverFormat = "search") {
  if (platform !== "naver" || type === "connect") return null;
  return `글 형식: ${NAVER_FORMAT_LABELS[format]} — ${FORMAT_GUIDES[format]}`;
}

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
  /** 생략하면 무작위로 고른다 */
  structure?: Structure;
  keyword: string;
  /** null = 검색광고에 데이터 없음, undefined = 조회하지 않음(키 미설정 등) */
  self?: KeywordStat | null;
  related?: KeywordStat[];
  /** NAVER API HUB 조사 결과 (키가 없으면 생략) */
  research?: KeywordResearch | null;
  /** 최근 7일 검색 변화 (일간 추이) */
  surge?: Surge | null;
  /** 대표 키워드 경쟁이 셀 때 돌릴 연관어 (점수순). undefined = 조회하지 않음 */
  pivots?: PivotRow[];
  /** type이 connect일 때만 쓴다 */
  connect?: ConnectBrief;
  /** 네이버 글 형식. 생략하면 검색형 */
  format?: NaverFormat;
  note?: string;
}

/** 표 칸에 넣을 수 있게 | 와 줄바꿈을 정리 */
const cell = (value: string | null | undefined) => (value ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();

export function formatWritingBrief({
  platform,
  type = "info",
  structure = randomStructure(),
  keyword,
  self,
  related = [],
  research,
  surge,
  pivots,
  connect,
  format,
  note,
}: WritingBriefInput) {
  const stats =
    self === undefined
      ? "조회하지 않음"
      : self === null
        ? "데이터 없음"
        : `${formatSearchCount(self.totalSearches)} (PC ${formatSearchCount(self.pcSearches)} / 모바일 ${formatSearchCount(self.mobileSearches)}) · 광고 경쟁도: ${self.competition}`;

  const lines = [
    "[글쓰기 브리프]",
    `플랫폼: ${PLATFORM_LABELS[platform]}`,
    `유형: ${WRITING_TYPE_LABELS[type]}`,
    structureLine(type, structure),
    formatLine(platform, type, format),
    `키워드: ${keyword}`,
    `월간 검색량: ${stats}`,
  ].filter((line): line is string => line !== null);
  if (type === "connect") lines.push(...connectBriefLines(connect));

  if (research?.trend && research.trend.label !== "데이터 부족") {
    lines.push(`검색 추이: ${research.trend.label} — ${research.trend.reason}`);
  }
  const saturation = research?.blog ? computeSaturation(self?.totalSearches, research.blog.total) : null;
  if (research?.blog) {
    lines.push(
      `블로그 문서 수: ${research.blog.total.toLocaleString("ko-KR")}${saturation ? ` · 포화도 ${formatSaturation(saturation)} (문서 수 ÷ 검색량)` : ""}`,
    );
  }
  if (surge && surge.label !== "데이터 부족") lines.push(`최근 7일 검색: ${formatSurge(surge)} (직전 4주 평균 대비)`);
  // 대표 키워드 경쟁이 세면 연관어로 돌리라고 브리프 앞쪽에서 알린다 (writing.md "경쟁 판단")
  if (pivots !== undefined && needsPivot(saturation)) {
    const why = `포화도 ${formatSaturation(saturation)}`;
    if (hasOpenPivot(pivots)) {
      lines.push(
        `경쟁 판단: 대표 키워드라 경쟁이 셉니다 (${why}). 글이 적은 블로그는 상위 노출이 어려우니, 아래 추천 타깃 키워드 중 포화도 기회인 하나를 메인 키워드로 골라 그 키워드로 브리프를 다시 받아 쓰세요.`,
        "추천 타깃 키워드 (연관어로 돌리기, 검색량 대비 경쟁 글이 적은 순):",
        formatPivotTable(pivots),
      );
    } else if (pivots.length > 0) {
      lines.push(
        `경쟁 판단: 대표 키워드라 경쟁이 셉니다 (${why}). 연관어도 모두 경쟁이 세서(포화도 기회 없음) 돌려도 나아지지 않습니다. 사용자에게 알리고, 쓴다면 아래 중 경쟁 글이 가장 적은 키워드로 제목을 구체적인 상황·대상으로 좁힙니다.`,
        "연관어 (검색량 대비 경쟁 글이 적은 순):",
        formatPivotTable(pivots),
      );
    } else {
      lines.push(`경쟁 판단: 대표 키워드라 경쟁이 셉니다 (${why}). 돌릴 만한 연관어를 찾지 못했으니, 제목을 구체적인 상황·대상으로 좁혀 쓰세요.`);
    }
  }

  const top = related.slice(0, BRIEF_RELATED_COUNT);
  if (top.length > 0) {
    lines.push(
      "연관 키워드 (관련 높은 순):",
      "| 키워드 | 월간 검색량 | 광고 경쟁도 |",
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
  {
    type = "info",
    structure,
    connect,
    format,
    note,
  }: { type?: WritingType; structure?: Structure; connect?: ConnectBrief; format?: NaverFormat; note?: string } = {},
) {
  const [insight, research, daily] = await Promise.all([
    searchAd ? fetchKeywordInsight(searchAd, keyword) : null,
    hub ? researchKeyword(hub, keyword).catch(() => null) : null,
    hub ? fetchDailyTrends(hub, [keyword]).catch(() => null) : null,
  ]);
  const related = insight ? rankByRelevance(insight.related, insight.tokens) : [];
  // 대표 키워드 경쟁이 셀 때만 연관어 후보의 문서 수·추이를 더 조회한다 (API 호출이 늘어서)
  const saturation = computeSaturation(insight?.self?.totalSearches, research?.blog?.total);
  const pivots = searchAd && needsPivot(saturation) ? await findPivots({ searchAd, hub }, keyword, { related: insight?.related }).catch(() => []) : undefined;
  const points = daily?.get(keyword);
  return formatWritingBrief({
    platform,
    type,
    structure,
    keyword,
    self: insight?.self,
    related,
    research,
    surge: points ? summarizeSurge(points) : null,
    pivots,
    connect,
    format,
    note,
  });
}
