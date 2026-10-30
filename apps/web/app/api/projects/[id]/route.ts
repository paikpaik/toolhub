import { deleteProject, updateProject } from "@toolhub/tasks";
import { DATA_DIR } from "../../../../lib/data";
import { errorResponse } from "../../../../lib/task-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/projects/:id { name?, color? } */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { name, color } = (await request.json()) as { name?: unknown; color?: unknown };
    const patch: { name?: string; color?: string } = {};
    if (typeof name === "string" && name.trim()) patch.name = name.trim();
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) patch.color = color;
    return Response.json(await updateProject(DATA_DIR, (await params).id, patch));
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/projects/:id — 소속 할 일은 지우지 않고 프로젝트 없음으로 옮긴다 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    return Response.json(await deleteProject(DATA_DIR, (await params).id));
  } catch (e) {
    return errorResponse(e, 404);
  }
}
