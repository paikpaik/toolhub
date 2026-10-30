import { PRIORITIES, REPEATS, STATUSES, type Subtask, type TaskPatch } from "@toolhub/tasks";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);

/** API로 들어온 수정 요청에서 허용된 필드·값만 골라낸다. 잘못된 값이 있으면 이유를 던진다 */
export function parseTaskPatch(body: unknown): TaskPatch {
  if (!body || typeof body !== "object") throw new Error("요청 본문이 필요합니다.");
  const b = body as Record<string, unknown>;
  const patch: TaskPatch = {};

  if ("title" in b) {
    if (typeof b.title !== "string" || !b.title.trim()) throw new Error("제목이 비어 있습니다.");
    patch.title = b.title;
  }
  if ("notes" in b) patch.notes = String(b.notes ?? "");
  if ("status" in b) {
    if (!STATUSES.includes(b.status as never)) throw new Error("알 수 없는 상태입니다.");
    patch.status = b.status as TaskPatch["status"];
  }
  if ("priority" in b) {
    if (!PRIORITIES.includes(b.priority as never)) throw new Error("알 수 없는 우선순위입니다.");
    patch.priority = b.priority as TaskPatch["priority"];
  }
  if ("dueDate" in b) {
    if (b.dueDate !== null && !isDate(b.dueDate)) throw new Error("날짜 형식은 YYYY-MM-DD입니다.");
    patch.dueDate = b.dueDate as string | null;
  }
  if ("dueTime" in b) {
    if (b.dueTime !== null && !isTime(b.dueTime)) throw new Error("시간 형식은 HH:mm입니다.");
    patch.dueTime = b.dueTime as string | null;
  }
  if ("projectId" in b) patch.projectId = typeof b.projectId === "string" && b.projectId ? b.projectId : null;
  if ("labels" in b) {
    if (!Array.isArray(b.labels)) throw new Error("태그는 배열이어야 합니다.");
    patch.labels = [...new Set(b.labels.map((l) => String(l).trim().replace(/^#/, "")).filter(Boolean))];
  }
  if ("repeat" in b) {
    if (b.repeat !== null && !REPEATS.includes(b.repeat as never)) throw new Error("알 수 없는 반복입니다.");
    patch.repeat = b.repeat as TaskPatch["repeat"];
  }
  if ("subtasks" in b) {
    if (!Array.isArray(b.subtasks)) throw new Error("하위 할 일은 배열이어야 합니다.");
    patch.subtasks = b.subtasks.map((s): Subtask => {
      const item = s as Record<string, unknown>;
      return { id: String(item.id ?? crypto.randomUUID().slice(0, 8)), text: String(item.text ?? ""), done: Boolean(item.done) };
    });
  }
  if ("link" in b) patch.link = typeof b.link === "string" && b.link.trim() ? b.link.trim() : null;
  return patch;
}

export const errorResponse = (e: unknown, status = 400) =>
  Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });
