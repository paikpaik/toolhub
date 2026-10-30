import { enrichDate } from "../../../../lib/enrich";

export const dynamic = "force-dynamic";

/**
 * POST /api/stats/enrich { date } → { updated, remaining, error }
 * 그날 검색량을 모르는 키워드를 한 묶음(최대 50개) 채운다. remaining이 남으면 다시 호출한다.
 */
export async function POST(request: Request) {
  const { date } = (await request.json().catch(() => ({}))) as { date?: unknown };
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date(YYYY-MM-DD)가 필요합니다." }, { status: 400 });
  }
  const task = enrichDate(date);
  if (!task) return Response.json({ error: "네이버 검색광고 키가 없습니다." }, { status: 400 });
  try {
    return Response.json(await task);
  } catch (e) {
    return Response.json({ updated: 0, remaining: 0, error: e instanceof Error ? e.message : String(e) });
  }
}
