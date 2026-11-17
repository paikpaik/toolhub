import { DRAFT_STATUS_LABELS, draftNameInfo, effectiveStatus, hasThumbnailSlot, MARKER_PATTERN, parseDraft, readDraftFile, readDraftStatuses } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../../../lib/data";
import { naverFillContent } from "../../../../../lib/preview";

export const dynamic = "force-dynamic";

/**
 * GET /api/drafts/naver/fill?file= → { file, title, text, html, tags, images, thumbnail }
 * 크롬 확장이 네이버 글쓰기 화면에 채울 내용: 추천 제목, 본문(서식 포함 복사와 같은 HTML + 빈 줄 5개 + #태그 줄), 태그, 본문 이미지 자리 수,
 * 대표 썸네일 자리가 있는지(있으면 확장이 /blog/thumbnail/render로 그린 썸네일을 넣는다).
 * 발행됨 초안은 같은 글을 두 번 올리지 않게 거절한다
 */
export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get("file") ?? "";
  const markdown = await readDraftFile(DRAFTS_DIR, file);
  if (markdown === null) return Response.json({ error: "초안을 찾을 수 없어요" }, { status: 404 });
  const { platform, keyword } = draftNameInfo(file);
  if (platform !== "naver") return Response.json({ error: "네이버 초안이 아니에요" }, { status: 400 });
  const status = effectiveStatus((await readDraftStatuses(DATA_DIR))[file]);
  if (status !== "draft") return Response.json({ error: `${DRAFT_STATUS_LABELS[status]} 초안이라 채우지 않아요` }, { status: 409 });
  const draft = parseDraft(markdown);
  if (!draft.body) return Response.json({ error: "초안에서 본문을 찾지 못했어요" }, { status: 422 });
  const title = draft.titles.find((t) => t.recommended)?.text ?? draft.titles[0]?.text ?? keyword;
  const images = [...draft.body.matchAll(MARKER_PATTERN)].filter((m) => m[1] === "이미지" && !/^대표\s*썸네일/.test(m[2]!.trim())).length;
  return Response.json({ file, title, ...naverFillContent(draft.body, draft.tags), tags: draft.tags, images, thumbnail: hasThumbnailSlot(draft.markers) });
}
