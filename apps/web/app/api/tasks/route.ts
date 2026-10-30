import { createTask, quickAddTask, readStore } from "@toolhub/tasks";
import { DATA_DIR } from "../../../lib/data";
import { errorResponse, parseTaskPatch } from "../../../lib/task-input";

export const dynamic = "force-dynamic";

/** GET /api/tasks → { tasks, projects } */
export async function GET() {
  const { tasks, projects } = await readStore(DATA_DIR);
  return Response.json({ tasks, projects });
}

/**
 * POST /api/tasks
 * - { text, defaults? }  자연어 빠른 추가 ("내일 오후 3시 글 발행 #블로그 !높음")
 * - { title, ...필드 }   필드를 직접 지정해 추가
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.text === "string") {
      const defaults = body.defaults ? parseTaskPatch(body.defaults) : {};
      return Response.json(await quickAddTask(DATA_DIR, body.text, defaults), { status: 201 });
    }
    const patch = parseTaskPatch(body);
    if (!patch.title) throw new Error("제목이 필요합니다.");
    return Response.json(await createTask(DATA_DIR, { ...patch, title: patch.title }), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
