import { draftNameInfo, listDrafts, naverDraftsFor, parseDraft, readDraftFile, readDraftStatuses } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

const todayKst = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/**
 * GET /api/drafts/naver?date=YYYY-MM-DD → { date, drafts: [{ file, keyword, format, title }] }
 * 크롬 확장 "초안" 메뉴: 그날(발행일) 올릴 네이버 초안. 발행됨은 빼고, 홈판형 먼저
 */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : todayKst();
  const [all, statuses] = await Promise.all([listDrafts(DRAFTS_DIR), readDraftStatuses(DATA_DIR)]);
  const drafts = await Promise.all(
    naverDraftsFor(all, statuses, date).map(async (d) => {
      const { titles } = parseDraft((await readDraftFile(DRAFTS_DIR, d.file)) ?? "");
      const title = titles.find((t) => t.recommended)?.text ?? titles[0]?.text ?? draftNameInfo(d.file).keyword;
      return { file: d.file, keyword: d.keyword, format: d.format, title };
    }),
  );
  return Response.json({ date, drafts });
}
