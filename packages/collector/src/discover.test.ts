import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { BatchRow } from "./batch.ts";
import {
  formatDiscoverTable,
  isSeasonSoon,
  parseTopics,
  pickCandidates,
  readRecentTopics,
  saveRecentTopic,
  sortDiscoverRows,
  toDiscoverRow,
} from "./discover.ts";
import type { KeywordStat } from "./naver-searchad.ts";
import type { TrendLabel, TrendSummary } from "./research.ts";

const stat = (keyword: string, totalSearches: number): KeywordStat => ({
  keyword,
  pcSearches: 0,
  mobileSearches: totalSearches,
  totalSearches,
  competition: "낮음",
  monthlyClicks: 0,
});

const trend = (label: TrendLabel, peakMonth: string | null = null): TrendSummary => ({ points: [], label, reason: "", recentChange: 0, peakMonth });

const row = (keyword: string, extra: Partial<BatchRow>): BatchRow => ({
  keyword,
  stats: stat(keyword, 1_000),
  trend: trend("꾸준함"),
  blogTotal: null,
  saturation: null,
  drafts: [],
  ...extra,
});

describe("parseTopics", () => {
  it("쉼표·줄바꿈으로 나누고 최대 3개", () => {
    assert.deepEqual(parseTopics("캠핑, 국민연금\n연말정산, 다이어트"), ["캠핑", "국민연금", "연말정산"]);
    assert.deepEqual(parseTopics(["캠핑", " 캠핑 "]), ["캠핑"]);
  });
});

describe("pickCandidates", () => {
  const stats = [
    stat("국민연금", 286_300),
    stat("국민연금수령나이", 40_000),
    stat("국민연금임의계속가입", 2_950),
    stat("국민연금신청", 2_160),
    stat("국민연금공단", 9_000),
    stat("국민연금물가상승률", 100),
    stat("국민연금조회", 80_000),
    stat("IRP계좌", 30_830),
    stat("국민연금신청", 2_160),
  ];

  it("주제가 들어가고 검색량 300~5만인 것만, 주제 자체·사이트 찾기·중복은 뺀다", () => {
    const keywords = pickCandidates(stats, ["국민연금"]).map((s) => s.keyword);
    assert.deepEqual(keywords.sort(), ["국민연금수령나이", "국민연금신청", "국민연금임의계속가입"]);
  });

  it("정보형(나이·신청 등)이 먼저, 같으면 검색량 순", () => {
    assert.deepEqual(
      pickCandidates(stats, ["국민연금"]).map((s) => s.keyword),
      ["국민연금수령나이", "국민연금신청", "국민연금임의계속가입"],
    );
  });

  it("주제가 여러 개면 주제별로 번갈아 놓는다", () => {
    const mixed = [stat("캠핑요리", 9_000), stat("캠핑의자추천", 8_000), stat("캠핑용품", 7_000), stat("연말정산기간", 500)];
    assert.deepEqual(
      pickCandidates(mixed, ["캠핑", "연말정산"]).map((s) => s.keyword),
      ["캠핑의자추천", "연말정산기간", "캠핑요리", "캠핑용품"],
    );
  });

  it("띄어 쓴 주제도 붙여 쓴 연관 키워드와 맞춘다", () => {
    assert.deepEqual(pickCandidates([stat("캠핑요리추천", 1_000)], ["캠핑 요리"]).map((s) => s.keyword), ["캠핑요리추천"]);
  });
});

describe("isSeasonSoon", () => {
  it("시즌 정점이 1~3달 뒤일 때만 (연도 넘김 포함)", () => {
    assert.equal(isSeasonSoon(trend("시즌", "2026-01"), "2026-10-31"), true);
    assert.equal(isSeasonSoon(trend("시즌", "2026-02"), "2026-10-31"), false);
    assert.equal(isSeasonSoon(trend("시즌", "2026-12"), "2026-10-31"), true);
    assert.equal(isSeasonSoon(trend("시즌", "2026-10"), "2026-10-31"), false);
    assert.equal(isSeasonSoon(trend("시즌", "2026-03"), "2026-10-31"), false);
    assert.equal(isSeasonSoon(trend("꾸준함", "2026-12"), "2026-10-31"), false);
  });
});

describe("추천과 정렬", () => {
  const today = "2026-10-31";
  const rows = [
    row("넓은키워드", { saturation: { ratio: 300, level: "높음" } }),
    row("하락기회", { trend: trend("하락세"), saturation: { ratio: 5, level: "기회" } }),
    row("연말정산모의계산", { trend: trend("시즌", "2026-01"), saturation: { ratio: 7.7, level: "기회" } }),
    row("보통키워드", { saturation: { ratio: 20, level: "보통" } }),
    row("국민연금신청방법", { saturation: { ratio: 20, level: "보통" } }),
  ].map((r) => toDiscoverRow(r, today));

  it("포화도 기회여도 하락세·급등 이력이면 추천하지 않는다", () => {
    assert.deepEqual(rows.filter((r) => r.pick).map((r) => r.keyword), ["연말정산모의계산"]);
  });

  it("추천 → 기회 → 보통(정보형 먼저) → 높음", () => {
    assert.deepEqual(
      sortDiscoverRows(rows).map((r) => r.keyword),
      ["연말정산모의계산", "하락기회", "국민연금신청방법", "보통키워드", "넓은키워드"],
    );
  });

  it("표에 추천 별표·곧 시즌을 표시하고, 요약에는 초안이 없는 추천만", () => {
    const text = formatDiscoverTable({ topics: ["연말정산"], rows: sortDiscoverRows(rows), matched: 120 });
    assert.match(text, /맞는 120개 중 정보형 우선 상위 5개 분석/);
    assert.match(text, /추천\(.*\): 연말정산모의계산$/m);
    assert.match(text, /\| ★ \| 연말정산모의계산 \| 1,000 \| 시즌\(1월\) · 곧 시즌 \|/);
  });
});

describe("최근 주제", () => {
  it("최신순으로, 같은 주제는 앞으로 옮긴다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "toolhub-topics-"));
    assert.deepEqual(await readRecentTopics(dir), []);
    await saveRecentTopic(dir, "캠핑");
    await saveRecentTopic(dir, "국민연금");
    assert.deepEqual(await saveRecentTopic(dir, "캠 핑"), ["캠 핑", "국민연금"]);
  });
});
