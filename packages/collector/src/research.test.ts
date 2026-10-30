import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSaturation, summarizeTrend } from "./research.ts";

/** 2024-10부터 24개월, 값은 f(인덱스, 월) */
const series = (f: (i: number, month: number) => number) =>
  Array.from({ length: 24 }, (_, i) => {
    const month = new Date(Date.UTC(2024, 9 + i, 1)).toISOString().slice(0, 7);
    return { month, ratio: f(i, Number(month.slice(5))) };
  });

describe("summarizeTrend", () => {
  const cases: [string, ReturnType<typeof series>, string][] = [
    ["두 해 모두 1월 정점 → 시즌", series((i, m) => (m === 1 ? 100 : m === 2 ? 60 : 20 + (i % 3))), "시즌"],
    ["반복 없는 한 번의 급등 → 급등 이력", series((i) => (i === 10 ? 100 : 15 + (i % 2))), "급등 이력"],
    ["최근 3개월 급증 → 상승세", series((i) => (i >= 21 ? 90 : 40 + (i % 3))), "상승세"],
    ["최근 3개월 급감 → 하락세", series((i) => (i >= 21 ? 30 : 70 + (i % 3))), "하락세"],
    // 기간 초반이 정점이고 계속 줄어든 경우를 급등으로 잘못 보지 않는다 (실제 에어프라이어 쇼핑 추이)
    ["초반 정점 후 장기 감소 → 하락세", series((i) => Math.max(5, 100 - i * 8)), "하락세"],
    ["장기 증가 → 상승세", series((i) => 10 + i * 4), "상승세"],
    ["고른 값 → 꾸준함", series((i) => 80 + (i % 4) * 3), "꾸준함"],
    ["패턴 없음 → 변동 큼", series((i) => [40, 90, 30, 70, 20, 60][i % 6]!), "변동 큼"],
  ];
  for (const [name, points, label] of cases) {
    it(name, () => assert.equal(summarizeTrend(points).label, label));
  }

  it("데이터가 12개월 미만이거나 모두 0이면 데이터 부족", () => {
    assert.equal(summarizeTrend(series(() => 50).slice(0, 5)).label, "데이터 부족");
    assert.equal(summarizeTrend(series(() => 0)).label, "데이터 부족");
  });

  it("시즌이면 정점 달을 알려준다", () => {
    const t = summarizeTrend(series((i, m) => (m === 11 ? 100 : 10 + (i % 2))));
    assert.equal(t.label, "시즌");
    assert.match(t.reason, /11월/);
  });
});

describe("computeSaturation", () => {
  it("문서 수 ÷ 검색량 기준 10배·50배 (실측 기반)", () => {
    assert.deepEqual(computeSaturation(58_080, 126_419), { ratio: 2.2, level: "기회" });
    assert.equal(computeSaturation(1000, 10_000)?.level, "기회");
    assert.equal(computeSaturation(1000, 39_000)?.level, "보통");
    assert.equal(computeSaturation(1000, 50_000)?.level, "보통");
    assert.equal(computeSaturation(1000, 67_000)?.level, "높음");
  });

  it("검색량이 없거나 10 미만(0)이면 계산하지 않는다", () => {
    assert.equal(computeSaturation(null, 100), null);
    assert.equal(computeSaturation(0, 100), null);
    assert.equal(computeSaturation(1000, undefined), null);
  });
});
