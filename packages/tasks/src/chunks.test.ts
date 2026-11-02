import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addGroup,
  chunkToday,
  docOf,
  docsToState,
  goalsInGroup,
  mondayOf,
  monthSummary,
  moveGoalToNextWeek,
  parseGoalInput,
  removeGroup,
  removeChunk,
  setDayEnd,
  shiftDay,
  updateChunk,
  addChunk,
  dayChunks,
  weekdayOf,
  writeGoalToSlot,
  type ChunkState,
} from "./chunks.ts";

const empty = (): ChunkState => docsToState({});

describe("덩어리 기록 날짜", () => {
  it("하루는 기본 자정에 바뀌고, 끝 시각을 늦추면 그 전까지는 전날", () => {
    assert.equal(chunkToday(new Date(2026, 10, 2, 23, 59)), "2026-11-02");
    assert.equal(chunkToday(new Date(2026, 10, 3, 0, 0)), "2026-11-03");
    assert.equal(chunkToday(new Date(2026, 10, 3, 3, 0), 5), "2026-11-02");
    assert.equal(chunkToday(new Date(2026, 10, 3, 4, 59), 5), "2026-11-02");
    assert.equal(chunkToday(new Date(2026, 10, 3, 5, 0), 5), "2026-11-03");
    // 월초 새벽도 전달 마지막 날로
    assert.equal(chunkToday(new Date(2026, 11, 1, 2, 0), 3), "2026-11-30");
  });

  it("하루 끝 시각은 0~8시로 저장되고, 이상한 값은 자정으로 읽는다", () => {
    assert.equal(setDayEnd(empty(), 5).state.dayEnd, 5);
    assert.equal(setDayEnd(empty(), 12).state.dayEnd, 8);
    assert.deepEqual(setDayEnd(empty(), 3).changed, ["cfg"]);
    assert.equal(docsToState({ cfg: { dayEnd: 4 } }).dayEnd, 4);
    assert.equal(docsToState({ cfg: { dayEnd: 30 } }).dayEnd, 0);
    assert.equal(docsToState({ cfg: { dayEnd: "5" } }).dayEnd, 0);
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
    let c = updateChunk(empty(), "2026-11-04", 1, { note: "릴스 촬영", group: "g3" });
    assert.deepEqual(c.changed.sort(), ["2026-11-04", "w-2026-11-02"]);
    assert.deepEqual(c.state.weeks["2026-11-02"], [{ id: "c-2026-11-04-1", t: "릴스 촬영", g: "g3", d: 2, done: false }]);

    c = updateChunk(c.state, "2026-11-04", 1, { done: true }, true);
    assert.equal(c.state.weeks["2026-11-02"]![0]!.done, true);

    c = updateChunk(c.state, "2026-11-04", 1, { note: "" });
    assert.deepEqual(c.state.weeks["2026-11-02"], []);
  });

  it("그룹 없이 메모만 쓰면 카드를 만들지 않고, 바뀐 게 없으면 주간 문서는 저장 대상이 아니다", () => {
    const c = updateChunk(empty(), "2026-11-04", 1, { note: "정리" });
    assert.deepEqual(c.changed, ["2026-11-04"]);
    assert.equal(c.state.weeks["2026-11-02"], undefined);
  });

  it("목표를 덩어리에 적으면 연결되어 카드가 새로 생기지 않고, 체크하면 목표도 완료", () => {
    const goal = { id: "a", t: "원데이 클래스 준비", g: "g1", d: 2, done: false };
    const state: ChunkState = { ...empty(), weeks: { "2026-11-02": [goal] } };
    let c = writeGoalToSlot(state, "2026-11-04", 2, goal);
    assert.equal(c.state.days["2026-11-04"]!.chunks[1]!.note, "원데이 클래스 준비");
    assert.equal(c.state.days["2026-11-04"]!.chunks[1]!.link, "a");
    assert.equal(c.state.weeks["2026-11-02"]!.length, 1);

    c = updateChunk(c.state, "2026-11-04", 2, { done: true }, true);
    assert.equal(c.state.weeks["2026-11-02"]![0]!.done, true);

    // 이미 적힌 메모에는 이어 붙이고, 같은 목표를 두 번 적지는 않는다
    c = writeGoalToSlot(c.state, "2026-11-04", 2, { ...goal, id: "b", t: "재료 주문" });
    assert.equal(c.state.days["2026-11-04"]!.chunks[1]!.note, "원데이 클래스 준비 + 재료 주문");
    c = writeGoalToSlot(c.state, "2026-11-04", 2, { ...goal, id: "b", t: "재료 주문" });
    assert.equal(c.state.days["2026-11-04"]!.chunks[1]!.note, "원데이 클래스 준비 + 재료 주문");
  });

  it("칸은 기본 2개에서 최대 6개까지 늘리고, 늘린 칸만 지울 수 있다", () => {
    let state = empty();
    assert.equal(dayChunks(state.days["2026-11-04"]).length, 2);
    for (let i = 0; i < 10; i++) state = addChunk(state, "2026-11-04").state;
    assert.equal(state.days["2026-11-04"]!.chunks.length, 6);
    assert.deepEqual(addChunk(state, "2026-11-04").changed, []);
    assert.deepEqual(removeChunk(state, "2026-11-04", 2).changed, []);
    assert.equal(removeChunk(state, "2026-11-04", 6).state.days["2026-11-04"]!.chunks.length, 5);
  });

  it("세 번째 칸도 주간 카드가 되고, 가운데 칸을 지우면 뒤 칸 카드가 번호를 따라 당겨진다", () => {
    let state = addChunk(addChunk(empty(), "2026-11-04").state, "2026-11-04").state;
    state = updateChunk(state, "2026-11-04", 3, { note: "재료 주문", group: "g2" }).state;
    state = updateChunk(state, "2026-11-04", 4, { note: "촬영", group: "g3" }).state;
    assert.deepEqual(state.weeks["2026-11-02"]!.map((g) => g.id), ["c-2026-11-04-3", "c-2026-11-04-4"]);

    const c = removeChunk(state, "2026-11-04", 3);
    assert.deepEqual(c.changed.sort(), ["2026-11-04", "w-2026-11-02"]);
    assert.deepEqual(c.state.weeks["2026-11-02"], [{ id: "c-2026-11-04-3", t: "촬영", g: "g3", d: 2, done: false }]);
  });

  it("다른 칸을 체크해도 연결된 목표는 그대로", () => {
    const goal = { id: "a", t: "목표", g: "g1", d: 2, done: false };
    let c = writeGoalToSlot({ ...empty(), weeks: { "2026-11-02": [goal] } }, "2026-11-04", 1, goal);
    c = updateChunk(c.state, "2026-11-04", 2, { done: true }, true);
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

  it("그룹을 지우면 모든 주의 그 그룹 목표가 남은 첫 그룹으로 옮겨지고, 마지막 그룹은 지울 수 없다", () => {
    const state: ChunkState = {
      ...empty(),
      weeks: {
        "2026-10-26": [{ id: "a", t: "릴스", g: "g3", d: 1, done: true }],
        "2026-11-02": [{ id: "b", t: "청소", g: "g2", d: -1, done: false }],
      },
    };
    assert.equal(goalsInGroup(state, "g3"), 1);
    const c = removeGroup(state, "g3");
    assert.deepEqual(c.changed, ["cfg", "w-2026-10-26"]);
    assert.deepEqual(c.state.groups.map((g) => g.name), ["공방", "집"]);
    assert.equal(c.state.weeks["2026-10-26"]![0]!.g, "g1");
    assert.equal(c.state.weeks["2026-11-02"]![0]!.g, "g2");

    const one = { ...empty(), groups: [{ id: "g1", name: "공방", c: 0 }] };
    assert.deepEqual(removeGroup(one, "g1").changed, []);
  });
});

describe("문서", () => {
  it("모양이 다른 값은 기본값으로 읽고, 저장할 때는 정해진 필드만", () => {
    const state = docsToState({
      "2026-11-02": { b1: 1, n1: 3, extra: "x" },
      "2026-11-03": { chunks: [{ done: true, note: "a", group: "g1" }, { note: "b" }, { done: 1 }, null, {}, {}, {}, {}] },
      "w-2026-11-02": { goals: [{ id: 1, t: "목표", d: 9 }] },
      cfg: { groups: [{ id: "g1", name: "공방", c: 11 }] },
      junk: { b1: true },
    });
    // 예전 모양(b1·n1…)은 칸 목록으로 바꿔 읽고, 저장은 새 모양으로
    assert.deepEqual(docOf(state, "2026-11-02"), {
      chunks: [
        { done: true, note: "", group: "", link: "" },
        { done: false, note: "", group: "", link: "" },
      ],
    });
    // 칸은 최대 6개까지만
    assert.equal(state.days["2026-11-03"]!.chunks.length, 6);
    assert.deepEqual(state.days["2026-11-03"]!.chunks[2], { done: true, note: "", group: "", link: "" });
    assert.deepEqual(docOf(state, "w-2026-11-02"), { goals: [{ id: "1", t: "목표", g: "", d: -1, done: false }] });
    assert.deepEqual(docOf(state, "cfg"), { groups: [{ id: "g1", name: "공방", c: 3 }], dayEnd: 0 });
    assert.deepEqual(Object.keys(state.days), ["2026-11-02", "2026-11-03"]);
  });

  it("월별 합계: 덩어리 수, 일한 날, 2덩어리 이상 날", () => {
    let state = empty();
    state = updateChunk(updateChunk(state, "2026-11-01", 1, { done: true }).state, "2026-11-01", 2, { done: true }).state;
    state = updateChunk(state, "2026-11-02", 2, { done: true }).state;
    state = updateChunk(state, "2026-11-03", 1, { note: "체크 안 함" }).state;
    state = addChunk(state, "2026-11-04").state;
    for (const slot of [1, 2, 3]) state = updateChunk(state, "2026-11-04", slot, { done: true }).state;
    state = updateChunk(state, "2026-10-31", 1, { done: true }).state;
    assert.deepEqual(monthSummary(state.days, "2026-11"), { total: 6, worked: 3, full: 2 });
  });
});
