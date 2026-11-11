import { importDrafts, parseDraftBundle, readDraftStatuses } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/**
 * POST /api/drafts/import { drafts: [{ file, content, status? }] } (내보내기 파일 그대로, 또는 .md를 화면에서 바꾼 것)
 * → { results, statuses } 기존 초안은 덮어쓰지 않는다 (같으면 건너뛰고, 다르면 번호를 붙임)
 */
export async function POST(request: Request) {
  try {
    const drafts = parseDraftBundle(await request.json().catch(() => null));
    if (!drafts.length) return Response.json({ error: "가져올 초안이 없어요" }, { status: 400 });
    const results = await importDrafts(DRAFTS_DIR, DATA_DIR, drafts);
    // 화면이 새로 생긴 초안의 상태를 바로 보여 줄 수 있게
    const all = await readDraftStatuses(DATA_DIR);
    const statuses = Object.fromEntries(results.flatMap((r) => ("savedAs" in r && all[r.savedAs] ? [[r.savedAs, all[r.savedAs]]] : [])));
    return Response.json({ results, statuses });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
