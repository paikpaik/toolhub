import { createProject } from "@toolhub/tasks";
import { DATA_DIR } from "../../../lib/data";
import { errorResponse } from "../../../lib/task-input";

export const dynamic = "force-dynamic";

/** POST /api/projects { name, color? } → 프로젝트 (같은 이름이 있으면 그것을 돌려준다) */
export async function POST(request: Request) {
  try {
    const { name, color } = (await request.json()) as { name?: unknown; color?: unknown };
    if (typeof name !== "string" || !name.trim()) throw new Error("프로젝트 이름이 필요합니다.");
    return Response.json(await createProject(DATA_DIR, name, typeof color === "string" ? color : undefined), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
