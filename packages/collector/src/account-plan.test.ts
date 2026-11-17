import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { accountQuotas, assignAccountKeywords, checkAgainstPlan, emptyPlan, formatPlan, planShortfalls, type PlanKeyword } from "./account-plan.ts";
import { readAccountPlan, writeAccountPlan } from "./account-plan-store.ts";
import type { BlogAccount } from "./accounts.ts";

const accounts = [
  { id: "acc-a", name: "여리쓰", topics: ["공연·전시", "사회·정치"] },
  { id: "acc-b", name: "이슈장인", topics: ["비즈니스·경제"] },
  { id: "acc-c", name: "우드", topics: ["국내여행", "맛집"] },
] as BlogAccount[];
const kw = (keyword: string, topic: string, format: "search" | "home" = "search", date = "2026-11-17"): PlanKeyword => ({ keyword, topic, format, date });

describe("계정별 글감 나누기", () => {
  it("편수를 계정 수로 나누고, 나머지는 앞 계정부터", () => {
    assert.deepEqual(accountQuotas(accounts, 15), { "acc-a": 5, "acc-b": 5, "acc-c": 5 });
    assert.deepEqual(accountQuotas(accounts, 7), { "acc-a": 3, "acc-b": 2, "acc-c": 2 });
  });

  it("분야를 맡은 계정에 우선순위대로, 몫이 차면 남기고, 맡은 계정이 없거나 겹치면 남긴다", () => {
    const base = emptyPlan(accounts, "2026-11-17", 3);
    const { plan, leftover } = assignAccountKeywords(
      accounts,
      [kw("지원금", "비즈니스·경제"), kw("물가", "비즈니스·경제"), kw("축제", "국내여행", "home", "2026-11-19"), kw("신간", "문학·책"), kw("지 원 금", "비즈니스·경제")],
      base,
    );
    assert.deepEqual(
      plan.items.map((i) => [i.keyword, i.account]),
      [
        ["지원금", "acc-b"],
        ["축제", "acc-c"],
      ],
    );
    assert.deepEqual(
      leftover.map((l) => l.reason),
      ["이슈장인 몫이 다 참", "이 분야를 맡은 계정 없음", "이미 계획에 있음"],
    );
    assert.deepEqual(
      planShortfalls(accounts, plan).map((s) => [s.account.name, s.missing]),
      [["여리쓰", 1]],
    );
  });

  it("다시 부르면 이어 넣는다, 분야 미정 계정은 어느 분야든 맡고 적게 받은 계정에 먼저", () => {
    const open = [accounts[0]!, { id: "acc-x", name: "자유", topics: [] }] as BlogAccount[];
    const first = assignAccountKeywords(open, [kw("전시", "공연·전시")], emptyPlan(open, "2026-11-17", 4)).plan;
    const { plan } = assignAccountKeywords(open, [kw("뮤지컬", "공연·전시"), kw("맛집", "맛집")], first);
    assert.deepEqual(
      plan.items.map((i) => [i.keyword, i.account]),
      [
        ["전시", "acc-a"],
        ["뮤지컬", "acc-x"],
        ["맛집", "acc-x"],
      ],
    );
  });

  it("결과 글: 계정별 표·홈판형 수, 모자라면 discover_keywords 안내", () => {
    const { plan, leftover } = assignAccountKeywords(accounts, [kw("축제", "국내여행", "home", "2026-11-19")], emptyPlan(accounts, "2026-11-17", 3));
    const text = formatPlan(accounts, plan, leftover);
    assert.match(text, /## 우드 1\/1 \(홈판형 1\)/);
    assert.match(text, /\| 축제 \| 국내여행 \| 홈판형 \| 2026-11-19 \|/);
    assert.match(text, /여리쓰: 1개 모자람 → 분야 공연·전시, 사회·정치/);
    assert.match(text, /discover_keywords/);
  });
});

describe("저장할 때 계획과 대조", () => {
  const plan = assignAccountKeywords(accounts, [kw("지원금", "비즈니스·경제"), kw("축제", "국내여행", "home", "2026-11-19")], emptyPlan(accounts, "2026-11-17", 3)).plan;

  it("계획대로면 현황만, 연관어는 plan_keyword로 찾는다", () => {
    const r = checkAgainstPlan(accounts, plan, { account: "acc-c", file: "f.md", keyword: "축제 주차", planKeyword: "축제", format: "home", date: "2026-11-19" });
    assert.deepEqual(r.warnings, []);
    assert.match(r.text, /여리쓰 0\/1 · 이슈장인 0\/1 · 우드 1\/1/);
    assert.equal(r.plan.saved[0]?.keyword, "축제");
  });

  it("다른 계정 몫·형식·발행일이 다르거나 계획에 없거나 몫을 넘으면 경고", () => {
    const r = checkAgainstPlan(accounts, plan, { account: "acc-a", file: "f.md", keyword: "지원금", format: "home", date: "2026-11-18" });
    assert.equal(r.warnings.length, 3);
    assert.match(r.text, /이슈장인 몫/);
    assert.match(r.text, /검색형인데 홈판형/);
    assert.match(r.text, /발행일은 2026-11-17/);
    const once = checkAgainstPlan(accounts, plan, { account: "acc-b", file: "a.md", keyword: "새키워드", format: "search", date: "2026-11-17" });
    assert.match(once.text, /계획에 없는 키워드/);
    const twice = checkAgainstPlan(accounts, once.plan, { account: "acc-b", file: "b.md", keyword: "지원금", format: "search", date: "2026-11-17" });
    assert.match(twice.text, /몫\(1편\)보다 많이/);
    // 같은 파일을 다시 저장하면 한 번만 센다
    const again = checkAgainstPlan(accounts, once.plan, { account: "acc-b", file: "a.md", keyword: "지원금", format: "search", date: "2026-11-17" });
    assert.equal(again.plan.saved.length, 1);
  });

  it("계획 파일: 날짜별로 읽고 쓰고 최근 14일만 남긴다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "toolhub-plan-"));
    try {
      assert.equal(await readAccountPlan(dir, "2026-11-17"), null);
      for (let d = 1; d <= 16; d++) await writeAccountPlan(dir, { ...plan, day: `2026-11-${String(d).padStart(2, "0")}` });
      assert.equal((await readAccountPlan(dir, "2026-11-16"))?.items.length, 2);
      assert.equal(await readAccountPlan(dir, "2026-11-02"), null);
      assert.ok(await readAccountPlan(dir, "2026-11-03"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
