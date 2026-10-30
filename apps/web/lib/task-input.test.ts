import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTaskPatch } from "./task-input.ts";

describe("parseTaskPatch", () => {
  it("허용된 필드만 통과시키고 값을 정리한다", () => {
    const patch = parseTaskPatch({
      title: "글 발행",
      status: "in_progress",
      priority: 2,
      dueDate: "2026-11-03",
      dueTime: "15:00",
      projectId: "",
      labels: ["#블로그", " 리뷰 ", "블로그", ""],
      repeat: "weekly",
      link: "  ",
      unknown: "무시",
    });
    assert.deepEqual(patch, {
      title: "글 발행",
      status: "in_progress",
      priority: 2,
      dueDate: "2026-11-03",
      dueTime: "15:00",
      projectId: null,
      labels: ["블로그", "리뷰"],
      repeat: "weekly",
      link: null,
    });
  });

  it("날짜·시간·반복을 null로 지울 수 있다", () => {
    assert.deepEqual(parseTaskPatch({ dueDate: null, dueTime: null, repeat: null }), { dueDate: null, dueTime: null, repeat: null });
  });

  it("잘못된 값은 이유와 함께 거부한다", () => {
    const bad: [unknown, RegExp][] = [
      [null, /본문/],
      [{ title: "  " }, /제목/],
      [{ status: "archived" }, /상태/],
      [{ priority: 9 }, /우선순위/],
      [{ dueDate: "내일" }, /YYYY-MM-DD/],
      [{ dueTime: "3시" }, /HH:mm/],
      [{ repeat: "hourly" }, /반복/],
      [{ labels: "블로그" }, /배열/],
      [{ subtasks: {} }, /배열/],
    ];
    for (const [body, error] of bad) assert.throws(() => parseTaskPatch(body), error, JSON.stringify(body));
  });

  it("하위 할 일은 id가 없으면 만들어 준다", () => {
    const { subtasks } = parseTaskPatch({ subtasks: [{ text: "사진", done: 1 }, { id: "a", text: "글" }] });
    assert.equal(subtasks?.length, 2);
    assert.ok(subtasks?.[0]?.id);
    assert.deepEqual(subtasks?.[1], { id: "a", text: "글", done: false });
    assert.equal(subtasks?.[0]?.done, true);
  });
});
