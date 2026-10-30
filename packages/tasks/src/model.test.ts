import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  compareTasks,
  diffDays,
  filterTasks,
  formatDue,
  groupOf,
  nextRepeatDate,
  parseQuickAdd,
  type Task,
} from "./model.ts";

// 2026-10-30은 금요일
const TODAY = "2026-10-30";

function task(overrides: Partial<Task>): Task {
  return {
    id: 1,
    title: "할 일",
    notes: "",
    status: "todo",
    priority: 0,
    dueDate: null,
    dueTime: null,
    projectId: null,
    labels: [],
    repeat: null,
    subtasks: [],
    link: null,
    createdAt: "",
    updatedAt: "",
    completedAt: null,
    ...overrides,
  };
}

describe("parseQuickAdd", () => {
  const cases: [string, Partial<ReturnType<typeof parseQuickAdd>>][] = [
    [
      "내일 오후 3시 국민연금 글 발행 #블로그 @블로그운영 !높음",
      { title: "국민연금 글 발행", dueDate: "2026-10-31", dueTime: "15:00", priority: 2, labels: ["블로그"], projectName: "블로그운영" },
    ],
    ["다음 주 월요일 오전 10시 키워드 정리 매주", { title: "키워드 정리", dueDate: "2026-11-02", dueTime: "10:00", repeat: "weekly" }],
    ["월요일 회의", { title: "회의", dueDate: "2026-11-02" }],
    ["금요일 마감", { title: "마감", dueDate: TODAY }],
    ["이번 주 수요일 정리", { dueDate: "2026-10-28" }],
    ["11월 3일 검토 !1", { title: "검토", dueDate: "2026-11-03", priority: 1 }],
    ["10/15 지난 날짜는 내년", { dueDate: "2027-10-15" }],
    ["2026-12-24 크리스마스 준비", { title: "크리스마스 준비", dueDate: "2026-12-24" }],
    ["3일 뒤 15:30 통화", { title: "통화", dueDate: "2026-11-02", dueTime: "15:30" }],
    ["오후 3시반 산책", { title: "산책", dueDate: TODAY, dueTime: "15:30" }],
    ["오전 12시 자정 확인", { dueTime: "00:00" }],
    ["매일 운동", { title: "운동", dueDate: TODAY, repeat: "daily" }],
    ["매달 카드값 확인", { repeat: "monthly" }],
    ["주말 대청소 #집", { title: "대청소", dueDate: "2026-10-31", labels: ["집"] }],
    ["태그 여러 개 #a #b", { title: "태그 여러 개", labels: ["a", "b"] }],
    ["그냥 메모", { title: "그냥 메모", dueDate: null, dueTime: null, priority: 0, repeat: null }],
  ];
  for (const [input, expected] of cases) {
    it(input, () => {
      const result = parseQuickAdd(input, TODAY);
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key as keyof typeof result], value, key);
    });
  }

  it("띄어쓰기가 있는 기존 프로젝트 이름을 먼저 맞춘다", () => {
    const names = ["블로그 운영", "블로그", "업무"];
    const spaced = parseQuickAdd("리포트 검토 @블로그 운영 !높음", TODAY, names);
    assert.equal(spaced.title, "리포트 검토");
    assert.equal(spaced.projectName, "블로그 운영");
    assert.equal(parseQuickAdd("글 정리 @블로그", TODAY, names).projectName, "블로그");
    assert.equal(parseQuickAdd("새 일 @새프로젝트", TODAY, names).projectName, "새프로젝트");
    // 기존 이름이 없으면 띄어쓰기 전까지만 새 프로젝트 이름으로 본다
    assert.equal(parseQuickAdd("리포트 @블로그 운영", TODAY, []).projectName, "블로그");
  });
});

describe("날짜 계산", () => {
  it("addDays / diffDays", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(diffDays("2026-10-30", "2026-11-02"), 3);
  });

  it("반복 다음 날짜 (월말·윤년 보정)", () => {
    assert.equal(nextRepeatDate("2026-10-30", "daily"), "2026-10-31");
    assert.equal(nextRepeatDate("2026-10-30", "weekly"), "2026-11-06");
    assert.equal(nextRepeatDate("2026-01-31", "monthly"), "2026-02-28");
    assert.equal(nextRepeatDate("2024-02-29", "yearly"), "2025-02-28");
  });

  it("formatDue", () => {
    assert.equal(formatDue(TODAY, "15:00", TODAY), "오늘 15:00");
    assert.equal(formatDue("2026-10-31", null, TODAY), "내일");
    assert.equal(formatDue("2026-10-29", null, TODAY), "어제");
    assert.equal(formatDue("2026-11-03", null, TODAY), "11/3 (화)");
  });
});

describe("목록 나누기·거르기", () => {
  it("groupOf", () => {
    assert.equal(groupOf(task({ dueDate: "2026-10-29" }), TODAY), "overdue");
    assert.equal(groupOf(task({ dueDate: TODAY }), TODAY), "today");
    assert.equal(groupOf(task({ dueDate: "2026-10-31" }), TODAY), "tomorrow");
    assert.equal(groupOf(task({ dueDate: "2026-11-06" }), TODAY), "week");
    assert.equal(groupOf(task({ dueDate: "2026-11-30" }), TODAY), "later");
    assert.equal(groupOf(task({}), TODAY), "nodate");
  });

  const tasks = [
    task({ id: 1, dueDate: "2026-10-29" }),
    task({ id: 2, dueDate: TODAY, priority: 1 }),
    task({ id: 3, dueDate: "2026-11-05", projectId: "p1", labels: ["블로그"] }),
    task({ id: 4 }),
    task({ id: 5, dueDate: TODAY, status: "done", completedAt: "2026-10-30T01:00:00Z" }),
    task({ id: 6, dueDate: "2026-12-01", status: "in_progress", title: "국민연금 정리" }),
  ];
  const ids = (view: Parameters<typeof filterTasks>[1]) => filterTasks(tasks, view, TODAY).map((t) => t.id);

  it("보기별 (오늘에는 지난 일정 포함, 완료는 제외)", () => {
    assert.deepEqual(ids({ view: "today" }), [1, 2]);
    assert.deepEqual(ids({ view: "week" }), [1, 2, 3]);
    assert.deepEqual(ids({ view: "inbox" }), [4]);
    assert.deepEqual(ids({ view: "all" }), [1, 2, 3, 6, 4]);
    assert.deepEqual(ids({ view: "done" }), [5]);
  });

  it("프로젝트·태그·검색어", () => {
    assert.deepEqual(ids({ projectId: "p1" }), [3]);
    assert.deepEqual(ids({ label: "블로그" }), [3]);
    assert.deepEqual(ids({ query: "국민연금" }), [6]);
  });

  it("정렬: 마감일 → 시간 → 우선순위(없음은 마지막)", () => {
    const sorted = [
      task({ id: 1, dueDate: TODAY, dueTime: "15:00" }),
      task({ id: 2, dueDate: TODAY, dueTime: "09:00" }),
      task({ id: 3, dueDate: TODAY, priority: 0 }),
      task({ id: 4, dueDate: TODAY, priority: 2 }),
    ].sort(compareTasks);
    assert.deepEqual(
      sorted.map((t) => t.id),
      [2, 1, 4, 3],
    );
  });
});
