/**
 * 키워드 찾기: 내 주제(캠핑, 국민연금 등)에서 블로그로 쓸 만한 키워드를 고른다.
 * 실시간 이슈와 달리 매달 꾸준히 검색되는 정보형 롱테일 키워드를 찾는 용도 (웹 키워드 찾기, MCP discover_keywords).
 *
 * 1. 주제마다 검색광고 연관 키워드를 받는다. 주제만 넣으면 넓은 주제어 위주로 와서 "주제+신청/조건/방법/추천"도 힌트로 함께 넣는다
 * 2. 주제가 들어가고 검색량이 적당한(월 300~5만) 키워드만 남기고, 정보를 찾는 형태(방법·신청·비용…)를 앞에 둔다
 * 3. 상위 30개만 검색 추이·블로그 문서 수를 조회해 포화도를 계산한다
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeKeywords, cleanKeywordList, formatTrendCell, type BatchRow } from "./batch.ts";
import { formatSearchCount } from "./brief.ts";
import type { HubConfig } from "./naver-hub.ts";
import { fetchRelatedKeywords, SearchAdError, toHintKeyword, type KeywordStat, type SearchAdConfig } from "./naver-searchad.ts";
import { computeSaturation, type TrendSummary } from "./research.ts";
import { normalizeKeyword } from "./sources.ts";

export const MAX_TOPICS = 3;
/** 추이·문서 수까지 조회할 후보 수 (API HUB 호출이 키워드당 2번이라 적당히 자른다) */
export const DISCOVER_LIMIT = 50;
/** 너무 적으면 유입이 없고, 너무 많으면 큰 블로그·공식 사이트와 경쟁해야 한다 */
export const MIN_SEARCHES = 300;
export const MAX_SEARCHES = 50_000;

const INTENT_HINTS = ["신청", "조건", "방법", "추천"];
/** 정보를 찾는 검색어에 자주 붙는 말. 이런 키워드가 글 한 편으로 답하기 좋고 오래 검색된다 */
const INTENT_WORDS = [
  "방법", "하는법", "신청", "조건", "자격", "대상", "나이", "기간", "시기", "일정", "비용", "가격", "요금", "금액",
  "수령", "계산", "조회", "비교", "차이", "추천", "순위", "후기", "준비물", "서류", "기준", "한도", "세금", "공제",
  "환급", "뜻", "종류", "장단점", "주의", "팁", "정리", "레시피", "만들기", "효과", "효능", "부작용",
];
/** 특정 사이트를 찾아가는 검색어는 블로그 글이 읽히지 않는다 */
const NAVIGATIONAL_WORDS = ["홈페이지", "사이트", "로그인", "고객센터", "전화번호", "바로가기", "포털", "공단"];

export const hasIntent = (keyword: string) => INTENT_WORDS.some((w) => keyword.includes(w));

/** 쉼표·줄바꿈으로 나뉜 주제 입력을 정리한다. 최대 3개 */
export function parseTopics(input: string | string[]) {
  return cleanKeywordList(Array.isArray(input) ? input : [input]).slice(0, MAX_TOPICS);
}

/** 연관 키워드에서 주제가 들어간, 검색량이 적당한 키워드를 골라 정보형 → 검색량 순으로 정렬한다 */
export function pickCandidates(stats: KeywordStat[], topics: string[]) {
  const topicKeys = topics.map((t) => normalizeKeyword(toHintKeyword(t)));
  const seen = new Set<string>();
  const candidates = stats.filter((s) => {
    const key = normalizeKeyword(s.keyword);
    if (seen.has(key)) return false;
    seen.add(key);
    return (
      !topicKeys.includes(key) &&
      topicKeys.some((t) => key.includes(t)) &&
      s.totalSearches >= MIN_SEARCHES &&
      s.totalSearches <= MAX_SEARCHES &&
      !NAVIGATIONAL_WORDS.some((w) => key.includes(w))
    );
  });
  const sorted = candidates.sort((a, b) => Number(hasIntent(b.keyword)) - Number(hasIntent(a.keyword)) || b.totalSearches - a.totalSearches);
  // 주제가 여러 개면 번갈아 놓아, 연관 키워드가 많은 주제가 분석 대상(상위 DISCOVER_LIMIT개)을 독차지하지 않게 한다
  const byTopic = topicKeys.map((t) => sorted.filter((s) => topicKeys.find((k) => normalizeKeyword(s.keyword).includes(k)) === t));
  return Array.from({ length: Math.max(0, ...byTopic.map((g) => g.length)) }, (_, i) => byTopic.map((g) => g[i])).flat().filter((s) => s !== undefined);
}

/** 주제마다 연관 키워드를 받는다. 의도 힌트가 거부되면(400) 주제만으로 다시 받는다 */
async function fetchTopicKeywords(config: SearchAdConfig, topics: string[]) {
  const all: KeywordStat[] = [];
  for (const topic of topics) {
    const hint = toHintKeyword(topic);
    try {
      all.push(...(await fetchRelatedKeywords(config, [hint, ...INTENT_HINTS.map((w) => hint + w)])));
    } catch (e) {
      if (!(e instanceof SearchAdError && e.status === 400)) throw e;
      all.push(...(await fetchRelatedKeywords(config, [hint])));
    }
  }
  return all;
}

export interface DiscoverRow extends BatchRow {
  intent: boolean;
  /** 추천: 포화도 기회이면서 하락세·반짝 이슈가 아닌 키워드 */
  pick: boolean;
  /** 시즌 정점이 1~3달 뒤라 지금 쓰면 시즌에 맞춰 노출될 키워드 */
  seasonSoon: boolean;
}

/** 시즌 정점 달이 오늘 기준 1~3달 뒤인지. 글이 검색에 노출되기까지 몇 주 걸리므로 이때 쓰면 시즌에 맞춰진다 */
export function isSeasonSoon(trend: TrendSummary | null, today: string) {
  if (trend?.label !== "시즌" || !trend.peakMonth) return false;
  const ahead = (Number(trend.peakMonth.slice(5, 7)) - Number(today.slice(5, 7)) + 12) % 12;
  return ahead >= 1 && ahead <= 3;
}

export function toDiscoverRow(row: BatchRow, today: string): DiscoverRow {
  const steady = row.trend !== null && row.trend.label !== "하락세" && row.trend.label !== "급등 이력";
  return {
    ...row,
    intent: hasIntent(row.keyword),
    pick: row.saturation?.level === "기회" && steady,
    seasonSoon: isSeasonSoon(row.trend, today),
  };
}

const SATURATION_RANK = { 기회: 0, 보통: 1, 높음: 2 } as const;

/** 추천 → 포화도 낮은 순 → 정보형 → 검색량 순 */
export function sortDiscoverRows(rows: DiscoverRow[]) {
  const rank = (r: DiscoverRow) => (r.pick ? 0 : r.saturation ? SATURATION_RANK[r.saturation.level] + 1 : 4);
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(b.intent) - Number(a.intent) ||
      (b.stats?.totalSearches ?? 0) - (a.stats?.totalSearches ?? 0),
  );
}

export interface DiscoverResult {
  topics: string[];
  rows: DiscoverRow[];
  /** 조건(주제 포함·검색량 범위)에 맞은 연관 키워드 수. DISCOVER_LIMIT보다 많으면 상위만 분석했다 */
  matched: number;
}

export async function discoverKeywords(
  { searchAd, hub }: { searchAd: SearchAdConfig; hub: HubConfig | null },
  topics: string[],
  today: string,
  draftsOf: (keyword: string) => string[] = () => [],
): Promise<DiscoverResult> {
  const candidates = pickCandidates(await fetchTopicKeywords(searchAd, topics), topics);
  const picked = candidates.slice(0, DISCOVER_LIMIT);
  // 검색량은 이미 받았으니 API HUB(추이·문서 수)만 조회하고 포화도를 다시 계산한다
  const { rows } = await analyzeKeywords({ searchAd: null, hub }, picked.map((s) => s.keyword), draftsOf);
  const discovered = rows.map((row, i) => {
    const stats = picked[i]!;
    return toDiscoverRow({ ...row, stats, saturation: computeSaturation(stats.totalSearches, row.blogTotal) }, today);
  });
  return { topics, rows: sortDiscoverRows(discovered), matched: candidates.length };
}

/** 마크다운 요약 + 표 (MCP discover_keywords) */
export function formatDiscoverTable({ topics, rows, matched }: DiscoverResult) {
  const picks = rows.filter((r) => r.pick && !r.drafts.length);
  const lines = [
    `주제 ${topics.join(", ")}: 연관 키워드 중 조건(주제 포함, 월 ${MIN_SEARCHES.toLocaleString("ko-KR")}~${MAX_SEARCHES.toLocaleString("ko-KR")}회)에 맞는 ${matched}개${
      matched > rows.length ? ` 중 정보형 우선 상위 ${rows.length}개` : ""
    } 분석.`,
    `추천(포화도 기회 + 하락세·반짝 이슈 아님, 초안 없음): ${picks.length ? picks.map((r) => r.keyword).join(", ") : "없음"}`,
    "",
    "| 추천 | 키워드 | 월간 검색량 | 검색 추이 | 블로그 문서 수 | 포화도 | 초안 |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      [
        "",
        r.pick ? "★" : "",
        r.keyword,
        r.stats ? formatSearchCount(r.stats.totalSearches) : "-",
        formatTrendCell(r.trend) + (r.seasonSoon ? " · 곧 시즌" : ""),
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

const RECENT_TOPICS_FILE = "discover-topics.json";
const MAX_RECENT_TOPICS = 8;

/** 최근에 찾아본 주제 (최신순). 같은 주제를 다시 입력하지 않도록 웹에 버튼으로 보여준다 */
export async function readRecentTopics(dataDir: string): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(dataDir, RECENT_TOPICS_FILE), "utf8"));
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function saveRecentTopic(dataDir: string, topic: string) {
  const recent = await readRecentTopics(dataDir);
  const key = normalizeKeyword(topic);
  const next = [topic, ...recent.filter((t) => normalizeKeyword(t) !== key)].slice(0, MAX_RECENT_TOPICS);
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, RECENT_TOPICS_FILE), JSON.stringify(next, null, 2));
  return next;
}
