import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addGroup,
  chunkToday,
  docOf,
  docsToState,
  mondayOf,
  monthSummary,
  moveGoalToNextWeek,
  parseGoalInput,
  shiftDay,
  updateDay,
  weekdayOf,
  writeGoalToSlot,
  type ChunkState,
} from "./chunks.ts";

const empty = (): ChunkState => docsToState({});

describe("덩어리 기록 날짜", () => {
  it("새벽 5시 전까지는 전날", () => {
    assert.equal(chunkToday(new Date(2026, 10, 3, 4, 59)), "2026-11-02");
    assert.equal(chunkToday(new Date(2026, 10, 3, 5, 0)), "2026-11-03");
  });

  it("한 주는 월요일 시작 (0=월 … 6=일), 달·해를 넘어가도 맞다", () => {
    assert.equal(weekdayOf("2026-11-02"), 0);
    assert.equal(weekdayOf("2026-11-08"), 6);
    assert.equal(mondayOf("2026-11-08"), "2026-11-02");
    assert.equal(mondayOf("2027-01-01"), "2026-12-28");
    assert.equal(shiftDay("2026-12-28", 7), "2027-01-04");
  });
});

describe("덩어리와 주간 보드 맞추기", () => {
  it("메모와 그룹을 모두 적으면 그 요일에 자동 카드가 생기고, 고치면 따라가고, 메모를 지우면 사라진다", () => {
    let c = updateDay(empty(), "2026-11-04", { n1: "릴스 촬영", g1: "g3" });
    assert.deepEqual(c.changed.sort(), ["2026-11-04", "w-2026-11-02"]);
    assert.deepEqual(c.state.weeks["2026-11-02"], [{ id: "c-2026-11-04-1", t: "릴스 촬영", g: "g3", d: 2, done: false }]);

    c = updateDay(c.state, "2026-11-04", { b1: true }, 1);
    assert.equal(c.state.weeks["2026-11-02"]![0]!.done, true);

    c = updateDay(c.state, "2026-11-04", { n1: "" });
    assert.deepEqual(c.state.weeks["2026-11-02"], []);
  });

  it("그룹 없이 메모만 쓰면 카드를 만들지 않고, 바뀐 게 없으면 주간 문서는 저장 대상이 아니다", () => {
    const c = updateDay(empty(), "2026-11-04", { n1: "정리" });
    assert.deepEqual(c.changed, ["2026-11-04"]);
    assert.equal(c.state.weeks["2026-11-02"], undefined);
  });

  it("목표를 덩어리에 적으면 연결되어 카드가 새로 생기지 않고, 체크하면 목표도 완료", () => {
    const goal = { id: "a", t: "원데이 클래스 준비", g: "g1", d: 2, done: false };
    const state: ChunkState = { ...empty(), weeks: { "2026-11-02": [goal] } };
    let c = writeGoalToSlot(state, "2026-11-04", 2, goal);
    assert.equal(c.state.days["2026-11-04"]!.n2, "원데이 클래스 준비");
    assert.equal(c.state.days["2026-11-04"]!.l2, "a");
    assert.equal(c.state.weeks["2026-11-02"]!.length, 1);

    c = updateDay(c.state, "2026-11-04", { b2: true }, 2);
    assert.equal(c.state.weeks["2026-11-02"]![0]!.done, true);

    // 이미 적힌 메모에는 이어 붙이고, 같은 목표를 두 번 적지는 않는다
    c = writeGoalToSlot(c.state, "2026-11-04", 2, { ...goal, id: "b", t: "재료 주문" });
    assert.equal(c.state.days["2026-11-04"]!.n2, "원데이 클래스 준비 + 재료 주문");
    c = writeGoalToSlot(c.state, "2026-11-04", 2, { ...goal, id: "b", t: "재료 주문" });
    assert.equal(c.state.days["2026-11-04"]!.n2, "원데이 클래스 준비 + 재료 주문");
  });

  it("다른 칸을 체크해도 연결된 목표는 그대로", () => {
    const goal = { id: "a", t: "목표", g: "g1", d: 2, done: false };
    let c = writeGoalToSlot({ ...empty(), weeks: { "2026-11-02": [goal] } }, "2026-11-04", 1, goal);
    c = updateDay(c.state, "2026-11-04", { b2: true }, 2);
    assert.equal(c.state.weeks["2026-11-02"]![0]!.done, false);
  });
});

describe("주간 목표", () => {
  it("#그룹(앞부분만 써도 됨)과 @요일을 읽고, 못 찾은 #는 글자로 남긴다", () => {
    const groups = empty().groups;
    assert.deepEqual(parseGoalInput("릴스 3개 올리기 #SN @수", groups, "g1"), { t: "릴스 3개 올리기", g: "g3", d: 2 });
    assert.deepEqual(parseGoalInput("청소 #없는그룹", groups, "g2"), { t: "청소 #없는그룹", g: "g2", d: -1 });
    assert.equal(parseGoalInput("  #공방 @월 ", groups, "g1"), null);
  });

  it("다음 주로 보내면 요일 미배정·미완료로 옮겨진다", () => {
    const state: ChunkState = { ...empty(), weeks: { "2026-11-02": [{ id: "a", t: "목표", g: "g1", d: 4, done: true }] } };
    const c = moveGoalToNextWeek(state, "2026-11-02", "a");
    assert.deepEqual(c.changed, ["w-2026-11-02", "w-2026-11-09"]);
    assert.deepEqual(c.state.weeks["2026-11-02"], []);
    assert.deepEqual(c.state.weeks["2026-11-09"], [{ id: "a", t: "목표", g: "g1", d: -1, done: false }]);
  });

  it("그룹을 추가하면 아직 안 쓴 색을 고른다", () => {
    const c = addGroup(empty(), "  운동  ");
    assert.equal(c.state.groups.at(-1)!.name, "운동");
    assert.equal(c.state.groups.at(-1)!.c, 3);
    assert.deepEqual(addGroup(empty(), " ").changed, []);
  });
});

describe("문서", () => {
  it("모양이 다른 값은 기본값으로 읽고, 저장할 때는 정해진 필드만", () => {
    const state = docsToState({
      "2026-11-02": { b1: 1, n1: 3, extra: "x" },
      "w-2026-11-02": { goals: [{ id: 1, t: "목표", d: 9 }] },
      cfg: { groups: [{ id: "g1", name: "공방", c: 11 }] },
      junk: { b1: true },
    });
    assert.deepEqual(docOf(state, "2026-11-02"), { b1: true, b2: false, n1: "", n2: "", g1: "", g2: "", l1: "", l2: "" });
    assert.deepEqual(docOf(state, "w-2026-11-02"), { goals: [{ id: "1", t: "목표", g: "", d: -1, done: false }] });
    assert.deepEqual(docOf(state, "cfg"), { groups: [{ id: "g1", name: "공방", c: 3 }] });
    assert.deepEqual(Object.keys(state.days), ["2026-11-02"]);
  });

  it("월별 합계: 덩어리 수, 일한 날, 2덩어리 날", () => {
    let state = empty();
    state = updateDay(state, "2026-11-01", { b1: true, b2: true }).state;
    state = updateDay(state, "2026-11-02", { b2: true }).state;
    state = updateDay(state, "2026-11-03", { n1: "체크 안 함" }).state;
    state = updateDay(state, "2026-10-31", { b1: true }).state;
    assert.deepEqual(monthSummary(state.days, "2026-11"), { total: 3, worked: 2, full: 1 });
  });
});
