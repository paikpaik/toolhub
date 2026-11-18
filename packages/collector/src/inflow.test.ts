import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { inflowOverview, inflowPlanningNote, matchInflow } from "./inflow.ts";
import { deleteInflow, readInflow, writeInflow } from "./inflow-store.ts";

const keywords = [
  { keyword: "한경선", share: 8.39 },
  { keyword: "컴포즈 모찌", share: 5.56 },
  { keyword: "컴포즈 직영점", share: 2.95 },
  { keyword: "라우식대표", share: 1.79 },
  { keyword: "다이소 빼빼로 만들기", share: 0.82 },
];
const drafts = [
  { keyword: "컴포즈 직영점 확인방법", account: "acc-wood" },
  { keyword: "컴포즈모찌" },
  { keyword: "다이소 빼빼로 만들기", account: "acc-other" },
];

describe("유입 검색어", () => {
  it("이 계정·계정 없는 초안과 같거나 서로 품으면 이미 다룬 것, 다른 계정 초안은 보지 않는다", () => {
    const { covered, open } = matchInflow(keywords, drafts, "acc-wood");
    assert.deepEqual(
      covered.map((k) => [k.keyword, k.draftKeyword]),
      [
        ["컴포즈 모찌", "컴포즈모찌"],
        ["컴포즈 직영점", "컴포즈 직영점 확인방법"],
      ],
    );
    assert.deepEqual(
      open.map((k) => k.keyword),
      ["한경선", "라우식대표", "다이소 빼빼로 만들기"],
    );
  });

  it("글감 계획 안내: 계정마다 아직 글이 없는 검색어를 비율 순 5개까지, 오래됐거나 없으면 null", () => {
    const now = new Date("2026-11-19T00:00:00Z");
    const accounts = [
      { id: "acc-wood", name: "우드" },
      { id: "acc-old", name: "여리쓰" },
    ];
    const store = {
      "acc-wood": { period: "2026-11-09~2026-11-15", at: "2026-11-18T00:00:00Z", keywords },
      "acc-old": { period: "2026-10-01~2026-10-07", at: "2026-10-08T00:00:00Z", keywords },
    };
    const note = inflowPlanningNote(accounts, store, drafts, now)!;
    assert.match(note, /- 우드 \(2026-11-09~2026-11-15\): 한경선 8.39%, 라우식대표 1.79%, 다이소 빼빼로 만들기 0.82%/);
    assert.doesNotMatch(note, /여리쓰/);
    assert.match(note, /assign_account_keywords에 account/);
    assert.equal(inflowPlanningNote(accounts, {}, drafts, now), null);
  });

  it("화면용 요약: 계정마다(기록 없어도) + 지운 계정 기록, 검색어마다 글 있음·후보·후보 밖, 오래되면 후보 없음", () => {
    const now = new Date("2026-11-19T00:00:00Z");
    const many = [...keywords, ...["가", "나", "다"].map((k, i) => ({ keyword: `검색어${k}`, share: 0.5 - i * 0.1 }))];
    const store = {
      "acc-wood": { period: "2026-11-09~2026-11-15", at: "2026-11-18T00:00:00Z", keywords: many },
      "acc-old": { period: "2026-10-01~2026-10-07", at: "2026-10-08T00:00:00Z", keywords },
      "acc-gone": { period: "2026-11-09~2026-11-15", at: "2026-11-18T00:00:00Z", keywords: [{ keyword: "물가", share: 3 }] },
    };
    const accounts = [
      { id: "acc-wood", name: "우드" },
      { id: "acc-old", name: "여리쓰" },
      { id: "acc-new", name: "이슈장인" },
    ];
    const [wood, old, fresh, gone] = inflowOverview(accounts, store, drafts, now);
    const state = (item: typeof wood) => Object.fromEntries(item!.keywords.map((k) => [k.keyword, k.state]));
    assert.equal(wood!.accountName, "우드");
    assert.equal(wood!.stale, false);
    assert.deepEqual(state(wood), {
      한경선: "candidate",
      "컴포즈 모찌": "covered",
      "컴포즈 직영점": "covered",
      라우식대표: "candidate",
      "다이소 빼빼로 만들기": "candidate",
      검색어가: "candidate",
      검색어나: "candidate",
      검색어다: "open",
    });
    assert.equal(wood!.keywords.find((k) => k.keyword === "컴포즈 직영점")!.draftKeyword, "컴포즈 직영점 확인방법");
    assert.equal(old!.stale, true);
    assert.ok(old!.keywords.every((k) => k.state !== "candidate"));
    assert.deepEqual([fresh!.accountName, fresh!.record], ["이슈장인", null]);
    assert.deepEqual([gone!.accountId, gone!.accountName], ["acc-gone", undefined]);
  });

  it("지우기: 계정 기록 전체 또는 검색어 하나, 없으면 false", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "inflow-"));
    try {
      await writeInflow(dir, "acc-a", { period: "p1", at: "t", keywords: [{ keyword: "a", share: 1 }, { keyword: "b", share: 2 }] });
      await writeInflow(dir, "acc-b", { period: "p1", at: "t", keywords: [] });
      assert.equal(await deleteInflow(dir, "acc-a", "a"), true);
      assert.deepEqual((await readInflow(dir))["acc-a"]!.keywords, [{ keyword: "b", share: 2 }]);
      assert.equal(await deleteInflow(dir, "acc-a", "없음"), false);
      assert.equal(await deleteInflow(dir, "acc-b"), true);
      assert.deepEqual(Object.keys(await readInflow(dir)), ["acc-a"]);
      assert.equal(await deleteInflow(dir, "acc-b"), false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("계정별 기록 파일: 그 계정만 새것으로 바꾼다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "inflow-"));
    try {
      assert.deepEqual(await readInflow(dir), {});
      await writeInflow(dir, "acc-a", { period: "p1", at: "t", keywords: [{ keyword: "a", share: 1 }] });
      await writeInflow(dir, "acc-b", { period: "p1", at: "t", keywords: [] });
      await writeInflow(dir, "acc-a", { period: "p2", at: "t", keywords: [] });
      const store = await readInflow(dir);
      assert.equal(store["acc-a"]!.period, "p2");
      assert.ok(store["acc-b"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
