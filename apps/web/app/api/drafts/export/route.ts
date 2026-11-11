import { buildDraftBundle } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/** POST /api/drafts/export { files: [...] } → 내보내기 파일(JSON). 초안 내용과 상태 기록을 담는다 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { files?: unknown } | null;
  const files = Array.isArray(body?.files) ? body.files.filter((f): f is string => typeof f === "string") : [];
  if (!files.length) return Response.json({ error: "내보낼 초안을 골라 주세요" }, { status: 400 });
  const bundle = await buildDraftBundle(DRAFTS_DIR, DATA_DIR, files);
  return Response.json(bundle);
}
