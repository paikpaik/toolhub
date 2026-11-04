import { setKinAnswered } from "@toolhub/collector";
import { DATA_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/** PUT /api/drafts/kin { file, question: { link, title }, answered } → 고친 상태 (이 글로 답한 지식iN 질문 기록) */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { file?: unknown; question?: { link?: unknown; title?: unknown }; answered?: unknown } | null;
  const link = body?.question?.link;
  const title = body?.question?.title;
  if (typeof body?.file !== "string" || typeof link !== "string" || !/^https?:\/\//.test(link) || typeof title !== "string") {
    return Response.json({ error: "file, question.link, question.title이 필요합니다" }, { status: 400 });
  }
  try {
    return Response.json(await setKinAnswered(DATA_DIR, body.file, { link, title }, body.answered !== false));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
