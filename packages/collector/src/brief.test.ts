import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPlanningBriefing, formatSearchCount, formatWritingBrief, rankByRelevance, sortDayKeywords, splitSelf } from "./brief.ts";
import type { KeywordStat } from "./naver-searchad.ts";
import { STRUCTURE_NAMES, structureLine } from "./platforms.ts";
import type { KeywordResearch } from "./research.ts";
import type { DayKeyword } from "./types.ts";

const stat = (keyword: string, totalSearches: number, competition = "낮음"): KeywordStat => ({
  keyword,
  pcSearches: Math.round(totalSearches / 4),
  mobileSearches: totalSearches - Math.round(totalSearches / 4),
  totalSearches,
  competition,
  monthlyClicks: 0,
});

const research: KeywordResearch = {
  trend: { points: [], label: "꾸준함", reason: "1년 내내 검색량이 고르게 유지됩니다.", recentChange: 0, peakMonth: null },
  blog: { total: 126_419, items: [{ title: "국민연금 | 총정리", link: "", description: "", blogger: "a", date: "2026-09-12" }] },
  kin: [{ title: "1968년생 언제 받나요?", link: "", description: "" }],
  news: [],
  cafe: [{ title: "카페 후기", link: "", description: "", cafe: "c" }],
  places: [{ title: "가게", link: "https://x", category: "음식점", address: "지번", roadAddress: "도로명" }],
  errors: {},
};

describe("formatSearchCount", () => {
  it("숫자·10 미만·없음", () => {
    assert.equal(formatSearchCount(58040), "58,040");
    assert.equal(formatSearchCount(0), "<10");
    assert.equal(formatSearchCount(null), "-");
  });
});

describe("연관 키워드", () => {
  it("splitSelf: 띄어쓰기·대소문자를 무시하고 자기 자신을 분리한다", () => {
    const { self, others } = splitSelf("국민연금 수령나이", [stat("국민연금", 1), stat("국민연금수령나이", 2)]);
    assert.equal(self?.keyword, "국민연금수령나이");
    assert.deepEqual(
      others.map((o) => o.keyword),
      ["국민연금"],
    );
  });

  it("rankByRelevance: 키워드 단어를 많이 포함할수록 앞, 같으면 검색량 순", () => {
    const ranked = rankByRelevance(
      [stat("4대보험계산기", 81_100), stat("국민연금", 287_000), stat("국민연금수령나이조회", 10), stat("수령나이", 5)],
      ["국민연금", "수령나이"],
    );
    assert.deepEqual(
      ranked.map((r) => r.keyword),
      ["국민연금수령나이조회", "국민연금", "수령나이", "4대보험계산기"],
    );
  });
});

describe("formatWritingBrief", () => {
  const base = { platform: "tistory" as const, keyword: "국민연금 수령나이", self: stat("국민연금수령나이", 58_080, "중간") };

  it("정보 유형: 공통 줄, 구성, 추이·포화도·질문·상위 글 (카페·장소는 없음)", () => {
    const brief = formatWritingBrief({ ...base, type: "info", structure: "B", related: [stat("국민연금", 287_000)], research });
    const lines = brief.split("\n");
    assert.deepEqual(lines.slice(0, 4), ["[글쓰기 브리프]", "플랫폼: 티스토리", "유형: 정보", "구성: B (결론 먼저형)"]);
    assert.match(brief, /월간 검색량: 58,080 \(PC 14,520 \/ 모바일 43,560\) · 경쟁도: 중간/);
    assert.match(brief, /검색 추이: 꾸준함/);
    assert.match(brief, /블로그 문서 수: 126,419 \(검색량의 2\.2배 · 포화도 기회\)/);
    assert.match(brief, /\| 국민연금 \| 287,000 \| 낮음 \|/);
    assert.match(brief, /- 1968년생 언제 받나요\?/);
    assert.match(brief, /- 국민연금 \/ 총정리 \(2026-09-12\)/, "표·목록을 깨는 | 는 / 로 바꾼다");
    assert.doesNotMatch(brief, /카페 글|장소 정보/);
  });

  it("리뷰는 카페 글, 장소는 카페 글과 장소 정보를 넣는다", () => {
    const review = formatWritingBrief({ ...base, type: "review", research });
    assert.match(review, /카페 글/);
    assert.doesNotMatch(review, /장소 정보/);
    const place = formatWritingBrief({ ...base, type: "place", research });
    assert.match(place, /\| 가게 \| 음식점 \| 도로명 \| https:\/\/x \|/);
  });

  it("키가 없을 때(조회하지 않음)와 데이터 없음", () => {
    assert.match(formatWritingBrief({ platform: "naver", keyword: "x" }), /월간 검색량: 조회하지 않음/);
    assert.match(formatWritingBrief({ platform: "naver", keyword: "x", self: null }), /월간 검색량: 데이터 없음/);
  });

  it("구성을 주지 않으면 A~D 중 하나를 고른다", () => {
    const line = formatWritingBrief({ platform: "blogger", type: "place", keyword: "x" }).split("\n")[3]!;
    assert.ok(Object.keys(STRUCTURE_NAMES.place).some((s) => line === structureLine("place", s as "A")), line);
  });

  it("참고 메모", () => {
    assert.match(formatWritingBrief({ platform: "naver", keyword: "x", note: "  부모님 사례  " }), /참고: 부모님 사례$/);
  });
});

describe("글감 브리핑·정렬", () => {
  const k = (keyword: string, total: number | null | undefined, firstSeen: string): DayKeyword => ({
    keyword,
    sources: ["google"],
    firstSeen,
    bestRank: 1,
    maxTraffic: null,
    related: "뉴스 | 제목",
    url: null,
    ...(total === undefined ? {} : { stats: total === null ? null : stat(keyword, total) }),
  });
  const keywords = [k("가", 100, "09:00"), k("나", 5000, "10:00"), k("다", undefined, "11:00"), k("라", null, "12:00")];

  it("sortDayKeywords: 검색량 순(조회 전·데이터 없음은 뒤), 최근 순", () => {
    assert.deepEqual(
      sortDayKeywords(keywords, "search").map((x) => x.keyword),
      ["나", "가", "라", "다"],
    );
    assert.deepEqual(
      sortDayKeywords(keywords, "recent").map((x) => x.keyword),
      ["라", "다", "나", "가"],
    );
  });

  it("formatPlanningBriefing 형식", () => {
    const lines = formatPlanningBriefing("2026-10-30", keywords, { limit: 2 }).split("\n");
    assert.deepEqual(lines.slice(0, 2), ["[글감 브리핑]", "날짜: 2026-10-30"]);
    assert.equal(lines.length, 6);
    assert.equal(lines[4], "| 나 | 5,000 | 낮음 | Google Trends | 10:00 | 뉴스 / 제목 |");
  });
});
