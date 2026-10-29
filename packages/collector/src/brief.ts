/**
 * claude.ai 프로젝트(docs/prompts)에 붙여넣을 [글쓰기 브리프]를 만든다.
 * 형식은 docs/prompts/writing.md의 "입력 형식"과 맞춰야 한다.
 */
import { fetchRelatedKeywords, toHintKeyword, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import { PLATFORM_LABELS, type Platform } from "./platforms.ts";
import { normalizeKeyword } from "./sources.ts";

/** 브리프에 넣을 연관 키워드 수 */
const BRIEF_RELATED_COUNT = 20;

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
  keyword: string;
  /** null = 검색광고에 데이터 없음, undefined = 조회하지 않음(키 미설정 등) */
  self?: KeywordStat | null;
  related?: KeywordStat[];
  note?: string;
}

export function formatWritingBrief({ platform, keyword, self, related = [], note }: WritingBriefInput) {
  const stats =
    self === undefined
      ? "조회하지 않음"
      : self === null
        ? "데이터 없음"
        : `${formatSearchCount(self.totalSearches)} (PC ${formatSearchCount(self.pcSearches)} / 모바일 ${formatSearchCount(self.mobileSearches)}) · 경쟁도: ${self.competition}`;

  const lines = ["[글쓰기 브리프]", `플랫폼: ${PLATFORM_LABELS[platform]}`, `키워드: ${keyword}`, `월간 검색량: ${stats}`];

  const top = related.slice(0, BRIEF_RELATED_COUNT);
  if (top.length > 0) {
    lines.push(
      "연관 키워드 (관련 높은 순):",
      "| 키워드 | 월간 검색량 | 경쟁도 |",
      "|---|---|---|",
      ...top.map((r) => `| ${r.keyword} | ${formatSearchCount(r.totalSearches)} | ${r.competition} |`),
    );
  }
  if (note?.trim()) lines.push(`참고: ${note.trim()}`);
  return lines.join("\n");
}

/** 검색광고 API로 키워드 수치와 연관 키워드를 조회해 브리프를 만든다. 키가 없으면 수치 없이 만든다. */
export async function buildWritingBrief(
  config: SearchAdConfig | null,
  keyword: string,
  platform: Platform,
  { note }: { note?: string } = {},
) {
  if (!config) return formatWritingBrief({ platform, keyword, note });
  const { self, related, tokens } = await fetchKeywordInsight(config, keyword);
  return formatWritingBrief({ platform, keyword, self, related: rankByRelevance(related, tokens), note });
}
