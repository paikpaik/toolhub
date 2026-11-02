import { deleteChunkDoc, saveChunkDoc } from "@toolhub/tasks";
import { DATA_DIR } from "../../../../lib/data";
import { errorResponse } from "../../../../lib/task-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/chunks/:id { ...데이터 } → 문서 하나를 통째로 저장 */
export async function PUT(request: Request, { params }: Params) {
  try {
    await saveChunkDoc(DATA_DIR, (await params).id, await request.json());
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await deleteChunkDoc(DATA_DIR, (await params).id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
