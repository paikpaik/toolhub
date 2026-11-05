import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSavedDates, toggleDate } from "./draft-dates.ts";

describe("초안 작성일 여러 날 고르기", () => {
  it("누르면 넣고, 다시 누르면 빼고, 날짜 순으로", () => {
    assert.deepEqual(toggleDate(["2026-11-05"], "2026-11-03"), ["2026-11-03", "2026-11-05"]);
    assert.deepEqual(toggleDate(["2026-11-03", "2026-11-05"], "2026-11-03"), ["2026-11-05"]);
  });

  it("기억한 값은 지금 초안이 있는 날만, 잘못된 값은 전체로", () => {
    const known = new Set(["2026-11-03", "2026-11-05"]);
    assert.deepEqual(parseSavedDates('["2026-11-05","2026-10-01","2026-11-03","2026-11-05",3]', known), ["2026-11-03", "2026-11-05"]);
    assert.deepEqual(parseSavedDates(null, known), []);
    assert.deepEqual(parseSavedDates("{oops", known), []);
    assert.deepEqual(parseSavedDates('"2026-11-03"', known), []);
  });
});
