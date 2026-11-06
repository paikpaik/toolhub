import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSaturation, formatSaturation, formatSurge, seasonAlertDate, summarizeSurge, summarizeTrend } from "./research.ts";

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

describe("seasonAlertDate", () => {
  it("다음 시즌 시작 5주 전", () => {
    // 10월 30일에 1월 시즌 → 2027-01-01 시작, 35일 전 = 2026-11-27
    assert.deepEqual(seasonAlertDate("2026-01", "2026-10-30"), { seasonStart: "2027-01-01", alertDate: "2026-11-27" });
    // 3월에 11월 시즌 → 올해 11월
    assert.deepEqual(seasonAlertDate("2025-11", "2026-03-10"), { seasonStart: "2026-11-01", alertDate: "2026-09-27" });
  });
  it("시즌이 임박했거나 진행 중이면 내일", () => {
    assert.deepEqual(seasonAlertDate("2025-11", "2026-10-20"), { seasonStart: "2026-11-01", alertDate: "2026-10-21" });
    assert.deepEqual(seasonAlertDate("2025-11", "2026-11-15"), { seasonStart: "2026-11-01", alertDate: "2026-11-16" });
  });
});

describe("computeSaturation", () => {
  it("문서 수 ÷ 검색량 기준 10배·50배 (실측 기반)", () => {
    assert.deepEqual(computeSaturation(5_000, 12_000), { ratio: 2.4, level: "기회" });
    assert.equal(computeSaturation(1000, 10_000)?.level, "기회");
    assert.equal(computeSaturation(1000, 39_000)?.level, "보통");
    assert.equal(computeSaturation(1000, 50_000)?.level, "보통");
    assert.equal(computeSaturation(1000, 67_000)?.level, "높음");
  });

  it("비율이 낮아도 문서가 2만 개 이상이면 보통, 10만 개 이상이면 높음 (대표 키워드)", () => {
    assert.deepEqual(computeSaturation(87_100, 620_270), { ratio: 7.1, level: "높음", cap: "문서 10만 개 이상" });
    assert.deepEqual(computeSaturation(13_740, 20_092), { ratio: 1.5, level: "보통", cap: "문서 2만 개 이상" });
    assert.deepEqual(computeSaturation(11_780, 5_280), { ratio: 0.4, level: "기회" });
    assert.equal(computeSaturation(1000, 67_000)?.cap, undefined, "비율로 이미 높음이면 그대로");
    assert.equal(formatSaturation(computeSaturation(87_100, 620_270)), "높음 (7.1배 · 문서 10만 개 이상)");
  });

  it("검색량이 없거나 10 미만(0)이면 계산하지 않는다", () => {
    assert.equal(computeSaturation(null, 100), null);
    assert.equal(computeSaturation(0, 100), null);
    assert.equal(computeSaturation(1000, undefined), null);
  });
});

describe("summarizeSurge (최근 7일 ÷ 직전 4주)", () => {
  const days = (before: number, recent: number) => [...Array(28).fill(before), ...Array(7).fill(recent)].map((ratio) => ({ ratio }));

  it("2배 이상 급상승, 1.3배 이상 상승, 0.7배 이하 하락", () => {
    assert.deepEqual(summarizeSurge(days(10, 25)), { ratio: 2.5, label: "급상승" });
    assert.deepEqual(summarizeSurge(days(10, 14)), { ratio: 1.4, label: "상승" });
    assert.deepEqual(summarizeSurge(days(10, 10)), { ratio: 1, label: "보통" });
    assert.deepEqual(summarizeSurge(days(10, 6)), { ratio: 0.6, label: "하락" });
    assert.equal(formatSurge(summarizeSurge(days(10, 25))), "급상승 ×2.5");
  });

  it("데이터가 모자라거나 전에 검색이 없었으면", () => {
    assert.equal(summarizeSurge(days(10, 10).slice(0, 10)).label, "데이터 부족");
    assert.deepEqual(summarizeSurge(days(0, 5)), { ratio: null, label: "급상승" });
    assert.equal(formatSurge(summarizeSurge(days(0, 0))), "-");
  });
});
