import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cycleSort, parseSavedSort, sortByRules, type SortRule } from "./draft-sort.ts";

const row = (keyword: string, statusRank: number, date: string | null, updatedAt: string, answers = 0) => ({ keyword, statusRank, date, updatedAt, answers, platform: "naver" });

describe("초안 목록 여러 칼럼 정렬", () => {
  it("누른 순서가 우선순위, 다시 누르면 방향 바꾸기, 한 번 더 누르면 빼기", () => {
    let rules: SortRule[] = [];
    rules = cycleSort(rules, "keyword");
    rules = cycleSort(rules, "status");
    rules = cycleSort(rules, "date");
    assert.deepEqual(rules, [
      { column: "keyword", dir: "asc" },
      { column: "status", dir: "asc" },
      { column: "date", dir: "desc" },
    ]);
    rules = cycleSort(rules, "status");
    assert.deepEqual(rules[1], { column: "status", dir: "desc" });
    rules = cycleSort(rules, "status");
    assert.deepEqual(rules.map((r) => r.column), ["keyword", "date"]);
  });

  it("앞 규칙이 같을 때만 다음 규칙, 모두 같으면 원래 순서", () => {
    const rows = [
      row("나", 1, "2026-11-05", "2026-11-05T01:00:00Z"),
      row("가", 0, "2026-11-04", "2026-11-04T01:00:00Z"),
      row("가", 0, "2026-11-05", "2026-11-05T02:00:00Z"),
      row("가", 1, "2026-11-05", "2026-11-05T03:00:00Z"),
      row("가", 0, "2026-11-05", "2026-11-05T04:00:00Z"),
    ];
    const sorted = sortByRules(rows, [
      { column: "keyword", dir: "asc" },
      { column: "status", dir: "asc" },
      { column: "date", dir: "desc" },
    ]);
    // 키워드·상태·작성일이 모두 같은 두 줄(02시·04시)은 원래 순서 그대로
    assert.deepEqual(sorted.map((r) => r.updatedAt.slice(11, 13)), ["02", "04", "01", "03", "01"]);
    assert.deepEqual(sorted.map((r) => `${r.keyword}${r.statusRank}${r.date?.slice(8)}`), ["가005", "가005", "가004", "가105", "나105"]);
    assert.equal(sortByRules(rows, []), rows);
  });

  it("기억한 값은 알맞은 규칙만, 잘못되면 정렬 없음", () => {
    assert.deepEqual(parseSavedSort('[{"column":"date","dir":"desc"},{"column":"oops","dir":"asc"},{"column":"date","dir":"asc"},{"column":"keyword","dir":"up"}]'), [{ column: "date", dir: "desc" }]);
    assert.deepEqual(parseSavedSort(null), []);
    assert.deepEqual(parseSavedSort("{"), []);
  });
});
