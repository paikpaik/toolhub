import { parseDraft, readDraftFile } from "@toolhub/collector";
import { DRAFTS_DIR } from "../../../../lib/data";

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
