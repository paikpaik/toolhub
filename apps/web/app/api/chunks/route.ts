import { readChunkDocs } from "@toolhub/tasks";
import { DATA_DIR } from "../../../lib/data";

export const dynamic = "force-dynamic";

/** GET /api/chunks → { "문서 id": 데이터 } (덩어리 기록 화면이 처음 열 때 전부 읽는다) */
export async function GET() {
  return Response.json(await readChunkDocs(DATA_DIR));
}
