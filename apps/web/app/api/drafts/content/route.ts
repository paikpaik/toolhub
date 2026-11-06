import { deleteDraftFile, parseDraft, readDraftFile, removeDraftStatus } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/** GET /api/drafts/content?file= → { title, body } (지식iN 답변 요청문에 넣을 추천 제목과 본문) */
export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get("file") ?? "";
  const markdown = await readDraftFile(DRAFTS_DIR, file);
  if (markdown === null) return Response.json({ error: "초안을 찾을 수 없습니다" }, { status: 404 });
  const draft = parseDraft(markdown);
  const title = draft.titles.find((t) => t.recommended)?.text ?? draft.titles[0]?.text ?? "";
  return Response.json({ title, body: draft.body ?? "" });
}

/**
 * DELETE /api/drafts/content?file= → { file, backups } 초안 파일, drafts/.history의 이전 버전, data/draft-status.json의 상태·답변 기록을 함께 지운다.
 * 되돌릴 수 없으므로 화면에서 한 번 더 묻는다
 */
export async function DELETE(request: Request) {
  const file = new URL(request.url).searchParams.get("file") ?? "";
  const deleted = await deleteDraftFile(DRAFTS_DIR, file);
  if (!deleted) return Response.json({ error: "초안을 찾을 수 없습니다" }, { status: 404 });
  await removeDraftStatus(DATA_DIR, file);
  return Response.json(deleted);
}
