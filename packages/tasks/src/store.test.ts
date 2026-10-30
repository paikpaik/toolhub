import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import { addDays, todayKst } from "./model.ts";
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  quickAddTask,
  readStore,
  resolveProject,
  updateTask,
} from "./store.ts";

let dir: string;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "toolhub-tasks-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("추가하면 번호가 1부터 늘어난다", async () => {
    const a = await createTask(dir, { title: "첫 번째" });
    const b = await createTask(dir, { title: "  두 번째  " });
    assert.equal(b.id, a.id + 1);
    assert.equal(b.title, "두 번째");
    await assert.rejects(createTask(dir, { title: "  " }), /제목/);
  });

  it("빠른 추가는 없는 @프로젝트를 만들고, 있는 이름은 띄어쓰기까지 맞춘다", async () => {
    const t1 = await quickAddTask(dir, "내일 회의 @업무 #정기 !높음");
    const project = await resolveProject(dir, "업무");
    assert.ok(project);
    assert.equal(t1.projectId, project.id);
    assert.equal(t1.dueDate, addDays(todayKst(), 1));
    assert.deepEqual([t1.priority, t1.labels], [2, ["정기"]]);

    await createProject(dir, "블로그 운영");
    const t2 = await quickAddTask(dir, "글 발행 @블로그 운영");
    assert.equal(t2.title, "글 발행");
    assert.equal(t2.projectId, (await resolveProject(dir, "블로그 운영"))?.id);
  });

  it("빠른 추가 기본값 (보기에서 넘긴 날짜·프로젝트)은 입력에 없을 때만 쓴다", async () => {
    const t = await quickAddTask(dir, "기본값 테스트", { dueDate: "2030-01-01", labels: ["기본"] });
    assert.equal(t.dueDate, "2030-01-01");
    assert.deepEqual(t.labels, ["기본"]);
    const t2 = await quickAddTask(dir, "모레 덮어쓰기 #추가", { dueDate: "2030-01-01", labels: ["기본"] });
    assert.equal(t2.dueDate, addDays(todayKst(), 2));
    assert.deepEqual(t2.labels, ["기본", "추가"]);
  });

  it("반복 할 일을 완료하면 기록은 남고 다음 회차가 생긴다, 되돌리면 완료 시각이 지워진다", async () => {
    const t = await createTask(dir, {
      title: "주간 회의",
      dueDate: "2030-01-07",
      dueTime: "09:00",
      repeat: "weekly",
      subtasks: [{ id: "s", text: "자료", done: true }],
    });
    const { task, next } = await updateTask(dir, t.id, { status: "done" });
    assert.equal(task.status, "done");
    assert.ok(task.completedAt);
    assert.ok(next);
    assert.deepEqual([next.dueDate, next.dueTime, next.status, next.subtasks[0]?.done], ["2030-01-14", "09:00", "todo", false]);

    const reopened = await updateTask(dir, t.id, { status: "todo" });
    assert.equal(reopened.task.completedAt, null);
    assert.equal(reopened.next, null);
  });

  it("없는 번호는 오류", async () => {
    await assert.rejects(updateTask(dir, 99999, { title: "x" }), /찾을 수 없습니다/);
    await assert.rejects(deleteTask(dir, 99999), /찾을 수 없습니다/);
  });

  it("프로젝트를 지우면 할 일은 남고 프로젝트 없음으로 옮겨진다", async () => {
    const p = await createProject(dir, "임시");
    assert.equal((await createProject(dir, "임시")).id, p.id, "같은 이름은 기존 것을 돌려준다");
    const t = await createTask(dir, { title: "임시 일", projectId: p.id });
    await deleteProject(dir, p.id);
    const store = await readStore(dir);
    assert.equal(store.tasks.find((x) => x.id === t.id)?.projectId, null);
    assert.equal(await resolveProject(dir, "임시"), null);
  });

  it("여러 프로세스가 동시에 써도 빠지거나 번호가 겹치지 않는다", async () => {
    const before = (await readStore(dir)).tasks.length;
    const script = `
      const s = await import(${JSON.stringify(path.join(import.meta.dirname, "store.ts"))});
      await Promise.all(Array.from({ length: 15 }, (_, i) => s.createTask(process.argv[1], { title: process.argv[2] + i })));
    `;
    const run = promisify(execFile);
    await Promise.all(["A", "B", "C"].map((tag) => run(process.execPath, ["--input-type=module", "-e", script, dir, tag])));
    const { tasks } = await readStore(dir);
    const ids = tasks.map((t) => t.id);
    assert.equal(tasks.length, before + 45);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!(await readdir(dir)).some((f) => f.endsWith(".lock")), "잠금 파일이 남지 않는다");
  });
});
