import { createProject, readStore } from "@toolhub/tasks";
import { DATA_DIR } from "../../../lib/data";
import { errorResponse } from "../../../lib/task-input";

export const dynamic = "force-dynamic";

/** GET /api/projects → 프로젝트 목록 (블로그 화면의 "할 일로 추가"에서 @프로젝트 미리보기용) */
export async function GET() {
  return Response.json((await readStore(DATA_DIR)).projects);
}

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
