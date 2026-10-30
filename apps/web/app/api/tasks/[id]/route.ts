import { deleteTask, updateTask } from "@toolhub/tasks";
import { DATA_DIR } from "../../../../lib/data";
import { errorResponse, parseTaskPatch } from "../../../../lib/task-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/tasks/:id → { task, next } (반복 할 일을 완료하면 next에 다음 회차) */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const id = Number((await params).id);
    return Response.json(await updateTask(DATA_DIR, id, parseTaskPatch(await request.json())));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    return Response.json(await deleteTask(DATA_DIR, Number((await params).id)));
  } catch (e) {
    return errorResponse(e, 404);
  }
}
