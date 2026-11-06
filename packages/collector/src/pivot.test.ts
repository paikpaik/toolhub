import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeywordStat } from "./naver-searchad.ts";
import { needsPivot, pivotCandidates, pivotScore, rankPivots, type PivotRow } from "./pivot.ts";
import { computeSaturation } from "./research.ts";

const stat = (keyword: string, totalSearches: number): KeywordStat => ({
  keyword,
  pcSearches: 0,
  mobileSearches: totalSearches,
  totalSearches,
  competition: "중간",
  monthlyClicks: 0,
});

describe("연관어로 돌리기", () => {
  it("기회가 아닌(보통·높음) 대표 키워드만 돌리기를 권한다", () => {
    assert.equal(needsPivot(computeSaturation(87_100, 620_270)), true);
    assert.equal(needsPivot(computeSaturation(11_780, 5_280)), false);
    assert.equal(needsPivot(null), false);
  });

  it("후보: 대표 키워드 단어를 모두 품고, 월 300~3만 회, 자기 자신·사이트 찾기 제외, 검색량 순, 중복 제거", () => {
    const picked = pivotCandidates("절임배추", [
      stat("절임배추", 87_100),
      stat("절임배추20KG", 75_650),
      stat("괴산절임배추", 19_710),
      stat("절임배추20KG몇포기", 11_780),
      stat("절임배추 20kg 몇포기", 11_780),
      stat("절임배추가격", 5_000),
      stat("절임배추5KG", 200),
      stat("김장김치", 9_000),
      stat("절임배추홈페이지", 3_000),
    ]);
    assert.deepEqual(
      picked.map((p) => p.keyword),
      ["괴산절임배추", "절임배추20KG몇포기", "절임배추가격"],
    );
    assert.deepEqual(
      pivotCandidates("독감증상", [stat("독감초기증상", 5_000), stat("독감증상기간", 3_000), stat("감기증상", 9_000)]).map((p) => p.keyword),
      ["독감초기증상", "독감증상기간"],
      "붙여 쓴 단어는 앞뒤 두 글자로 (사이에 말이 끼어도)",
    );
    assert.deepEqual(
      pivotCandidates("근로장려금 지급일", [stat("근로장려금지급일조회", 2_000), stat("근로장려금신청", 9_000)]).map((p) => p.keyword),
      ["근로장려금지급일조회"],
      "여러 단어면 모두 들어간 것만",
    );
  });

  it("점수: 검색량 ÷ (문서 수 + 1,000), 오르는 중이면 가산, 문서 수를 모르면 뒤로", () => {
    assert.equal(pivotScore(11_780, 5_280, null), 1.88);
    assert.equal(pivotScore(11_780, 5_280, { ratio: 2.2, label: "급상승" }), 2.81);
    assert.ok(pivotScore(87_100, 620_270, null)! < 0.2, "대표 키워드는 점수가 낮다");
    const row = (keyword: string, score: number | null, searches = 1000): PivotRow => ({
      keyword,
      searches,
      blogTotal: null,
      saturation: null,
      surge: null,
      intent: false,
      score,
    });
    assert.deepEqual(rankPivots([row("a", null), row("b", 0.5), row("c", 2)]).map((r) => r.keyword), ["c", "b", "a"]);
  });
});
