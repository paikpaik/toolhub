import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanKeywordList, formatBatchTable, MAX_BATCH_KEYWORDS, sortBatchRows, type BatchRow } from "./batch.ts";
import type { KeywordStat } from "./naver-searchad.ts";

describe("cleanKeywordList", () => {
  it("순위 번호·변동 표시·불릿·따옴표를 걷어낸다", () => {
    assert.deepEqual(
      cleanKeywordList(["1. 국민연금 수령나이", "2) 기초연금 신청방법 ▲3", "3위 연말정산 미리보기 NEW", "- 캠핑의자", '"에어프라이어 추천"', "12.아이폰 배터리 교체 비용 ▼2"]),
      ["국민연금 수령나이", "기초연금 신청방법", "연말정산 미리보기", "캠핑의자", "에어프라이어 추천", "아이폰 배터리 교체 비용"],
    );
  });

  it("줄바꿈·쉼표로 나뉜 한 덩어리도 받고, 공백·구두점 차이의 중복은 하나로", () => {
    assert.deepEqual(cleanKeywordList(["캠핑, 국민연금\n국민 연금\n\n캠핑 "]), ["캠핑", "국민연금"]);
  });

  it("숫자로 시작하는 키워드는 지우지 않는다 (순위 뒤에 . ) 위 구분자가 있을 때만 순위로 본다)", () => {
    assert.deepEqual(cleanKeywordList(["4대보험계산기", "2026 연말정산", "10 대 뉴스", "1.5룸 인테리어"]), ["4대보험계산기", "2026 연말정산", "10 대 뉴스", "1.5룸 인테리어"]);
  });

  it(`최대 ${MAX_BATCH_KEYWORDS}개`, () => {
    assert.equal(cleanKeywordList(Array.from({ length: 80 }, (_, i) => `키워드${i}`)).length, MAX_BATCH_KEYWORDS);
  });
});

const stat = (totalSearches: number, competition = "낮음"): KeywordStat => ({
  keyword: "",
  pcSearches: 0,
  mobileSearches: totalSearches,
  totalSearches,
  competition,
  monthlyClicks: 0,
});

const row = (keyword: string, extra: Partial<BatchRow>): BatchRow => ({
  keyword,
  stats: null,
  trend: null,
  blogTotal: null,
  saturation: null,
  drafts: [],
  ...extra,
});

describe("묶음 분석 표", () => {
  const rows = [
    row("다이어트", { stats: stat(33_760, "높음"), blogTotal: 27_210_538, saturation: { ratio: 806, level: "높음" } }),
    row("국민연금 수령나이", { stats: stat(58_080, "중간"), blogTotal: 126_419, saturation: { ratio: 2.2, level: "기회" }, drafts: ["a.md"] }),
    row("기초연금 신청방법", { stats: stat(12_400), blogTotal: 74_000, saturation: { ratio: 6, level: "기회" } }),
    row("연말정산", {
      stats: stat(22_600, "높음"),
      trend: { points: [], label: "시즌", reason: "", recentChange: 0, peakMonth: "2026-01" },
      saturation: { ratio: 31, level: "보통" },
    }),
    row("문장형 뉴스 키워드", { stats: null }),
  ];

  it("정렬: 기회 → 보통 → 높음 → 계산 불가, 같으면 검색량 순", () => {
    assert.deepEqual(
      sortBatchRows(rows).map((r) => r.keyword),
      ["국민연금 수령나이", "기초연금 신청방법", "연말정산", "다이어트", "문장형 뉴스 키워드"],
    );
  });

  it("요약에는 초안이 없는 기회 키워드만, 표에는 시즌 달·초안 표시", () => {
    const text = formatBatchTable(rows);
    assert.match(text.split("\n")[0]!, /: 기초연금 신청방법$/);
    assert.match(text, /\| 국민연금 수령나이 \| 58,080 \| 중간 \| - \| 126,419 \| 기회 \(2\.2배\) \| ✓ 1개 \|/);
    assert.match(text, /\| 연말정산 \| 22,600 \| 높음 \| 시즌\(1월\) \|/);
    assert.match(text, /\| 문장형 뉴스 키워드 \| 데이터 없음 \|/);
  });

  it("검색광고 키가 없으면 검색량 칸은 -", () => {
    assert.match(formatBatchTable([row("x", { stats: undefined })]), /\| x \| - \| - \|/);
  });
});
