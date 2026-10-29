import { buildWritingBrief, isPlatform, searchAdConfigFromEnv } from "@toolhub/collector";

export const dynamic = "force-dynamic";

/** GET /api/brief?q=키워드&platform=tistory → [글쓰기 브리프] 텍스트 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = params.get("q")?.trim();
  const platform = params.get("platform") ?? "tistory";
  if (!keyword) return new Response("q가 필요합니다", { status: 400 });
  if (!isPlatform(platform)) return new Response(`알 수 없는 플랫폼: ${platform}`, { status: 400 });

  try {
    const brief = await buildWritingBrief(searchAdConfigFromEnv(), keyword, platform);
    return new Response(brief, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 502 });
  }
}
