import { buildWritingBrief, hubConfigFromEnv, isPlatform, isWritingType, searchAdConfigFromEnv } from "@toolhub/collector";

export const dynamic = "force-dynamic";

/** GET /api/brief?q=키워드&platform=tistory&type=info → [글쓰기 브리프] 텍스트 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = params.get("q")?.trim();
  const platform = params.get("platform") ?? "tistory";
  const type = params.get("type") ?? "info";
  if (!keyword) return new Response("q가 필요합니다", { status: 400 });
  if (!isPlatform(platform)) return new Response(`알 수 없는 플랫폼: ${platform}`, { status: 400 });
  if (!isWritingType(type)) return new Response(`알 수 없는 유형: ${type}`, { status: 400 });

  try {
    const sources = { searchAd: searchAdConfigFromEnv(), hub: hubConfigFromEnv() };
    const brief = await buildWritingBrief(sources, keyword, platform, { type });
    return new Response(brief, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 502 });
  }
}
