import { setDraftStatus, type DraftStatusPatch } from "@toolhub/collector";
import { DATA_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/** PUT /api/drafts/status { file, status?, url?, at? } → 고친 상태 */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as ({ file?: unknown } & DraftStatusPatch) | null;
  if (!body || typeof body.file !== "string") return Response.json({ error: "file이 필요합니다" }, { status: 400 });
  const { file, status, url, at } = body;
  try {
    return Response.json(await setDraftStatus(DATA_DIR, file, { status, url, at }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
