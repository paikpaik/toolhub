import { hubConfigFromEnv, searchKin } from "@toolhub/collector";

export const dynamic = "force-dynamic";

/** GET /api/kin?q=키워드[&sort=date|sim] → 지식iN 질문 20개 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const sort = params.get("sort") === "sim" ? "sim" : "date";
  if (!query) return Response.json({ error: "q가 필요합니다" }, { status: 400 });
  const config = hubConfigFromEnv();
  if (!config) return Response.json({ error: "NAVER API HUB 키가 없습니다 (apps/web/.env.local)" }, { status: 503 });
  try {
    return Response.json(await searchKin(config, query, 20, sort));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
