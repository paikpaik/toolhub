import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { cleanText } from "./naver-hub.ts";
import { normalizeKeyword, parseTraffic } from "./sources.ts";
import { dateRange, listDates, mergeKeywords, readRange } from "./storage.ts";
import type { DayKeyword, KeywordItem } from "./types.ts";

const item = (keyword: string, source: KeywordItem["source"], rank: number, extra: Partial<KeywordItem> = {}): KeywordItem => ({
  source,
  rank,
  keyword,
  traffic: null,
  state: null,
  related: null,
  url: null,
  ...extra,
});

describe("소스 유틸", () => {
  it("normalizeKeyword: 공백·구두점·대소문자 무시", () => {
    assert.equal(normalizeKeyword("이재명, 이태원참사 추모"), normalizeKeyword("이재명 이태원참사추모"));
    assert.equal(normalizeKeyword("AI 안경"), "ai안경");
  });
  it("parseTraffic", () => {
    assert.equal(parseTraffic("2,000+"), 2000);
    assert.equal(parseTraffic("1만+"), 10000);
    assert.equal(parseTraffic(undefined), null);
  });
  it("cleanText: 검색 결과의 <b>와 HTML 엔티티", () => {
    assert.equal(cleanText("<b>국민연금</b> &quot;수령&quot; &amp; 나이"), '국민연금 "수령" & 나이');
  });
});

describe("mergeKeywords", () => {
  it("처음 보는 키워드만 추가하고, 기존 키워드는 소스·최고 순위·트래픽을 갱신한다", () => {
    const first = mergeKeywords([], [item("만두", "google", 3, { traffic: 500, related: "뉴스" })], "10:00");
    assert.equal(first.added.length, 1);

    const existing: DayKeyword[] = [{ ...first.keywords[0]!, stats: null }];
    const second = mergeKeywords(existing, [item("만두", "signal", 1, { traffic: 2000 }), item("커플", "nate", 5)], "11:00");
    assert.deepEqual(
      second.added.map((k) => k.keyword),
      ["커플"],
    );
    const manduk = second.keywords.find((k) => k.keyword === "만두")!;
    assert.deepEqual(
      [manduk.sources, manduk.bestRank, manduk.maxTraffic, manduk.firstSeen, manduk.related, manduk.stats],
      [["google", "signal"], 1, 2000, "10:00", "뉴스", null],
    );
    assert.equal(existing[0]!.sources.length, 1, "원본 배열은 바꾸지 않는다");
  });
});

describe("기간 집계", () => {
  let dir: string;
  const day = (date: string, keywords: Partial<DayKeyword>[]) =>
    writeFile(
      path.join(dir, `${date}.json`),
      JSON.stringify({
        date,
        updatedAt: "",
        keywords: keywords.map((k) => ({ sources: ["google"], firstSeen: "09:00", bestRank: 5, maxTraffic: null, related: null, url: null, ...k })),
      }),
    );

  before(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "toolhub-days-"));
    await day("2026-10-28", [{ keyword: "미래에셋증권", bestRank: 7 }, { keyword: "국민연금" }]);
    await day("2026-10-29", [{ keyword: "미래 에셋증권", sources: ["nate"], bestRank: 2 }, { keyword: "국민연금", related: "새 뉴스" }]);
    await day("2026-10-30", [{ keyword: "미래에셋증권", stats: null }]);
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("dateRange: 끝 날짜부터 거꾸로, 오래된 순", () => {
    assert.deepEqual(dateRange("2026-03-01", 3), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  });

  it("listDates: 최신순", async () => {
    assert.deepEqual(await listDates(dir), ["2026-10-30", "2026-10-29", "2026-10-28"]);
  });

  it("readRange: 등장 날짜·기간·소스·최고 순위를 합치고, 최근 값이 남는다", async () => {
    const rows = await readRange(dir, "2026-10-30", 7);
    const mirae = rows.find((r) => normalizeKeyword(r.keyword) === "미래에셋증권")!;
    assert.deepEqual(
      [mirae.dates, mirae.firstDate, mirae.lastDate, mirae.sources, mirae.bestRank, mirae.stats],
      [["2026-10-28", "2026-10-29", "2026-10-30"], "2026-10-28", "2026-10-30", ["google", "nate"], 2, null],
    );
    const pension = rows.find((r) => r.keyword === "국민연금")!;
    assert.deepEqual([pension.dates.length, pension.related], [2, "새 뉴스"]);
  });

  it("범위 밖 날짜는 넣지 않는다", async () => {
    const rows = await readRange(dir, "2026-10-30", 1);
    assert.deepEqual(
      rows.map((r) => r.keyword),
      ["미래에셋증권"],
    );
  });
});
