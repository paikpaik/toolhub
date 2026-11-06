import { buildImagePrompt, draftNameInfo, IMAGE_PROMPT_STYLES, parseDraft, readDraftFile, type ImagePromptStyle } from "@toolhub/collector";
import { DRAFTS_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/** GET /api/drafts/image-prompt?file=&style=photo|illustration → 이미지 5장 요청문 (텍스트). 초안 목록의 프롬프트 복사 버튼 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const file = params.get("file") ?? "";
  const style = params.get("style") ?? "photo";
  const markdown = await readDraftFile(DRAFTS_DIR, file);
  if (markdown === null) return new Response("초안을 찾을 수 없습니다", { status: 404 });
  const { keyword } = draftNameInfo(file);
  const draft = parseDraft(markdown);
  const title = draft.titles.find((t) => t.recommended)?.text ?? draft.titles[0]?.text ?? keyword;
  const text = buildImagePrompt({ title, keyword, body: draft.body, style: style in IMAGE_PROMPT_STYLES ? (style as ImagePromptStyle) : "photo" });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
