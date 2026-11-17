import { importDrafts, linkBundleAccounts, parseBundleAccounts, parseDraftBundle, readDraftStatuses } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

/**
 * POST /api/drafts/import { drafts: [{ file, content, status? }] } (내보내기 파일 그대로, 또는 .md를 화면에서 바꾼 것)
 * → { results, statuses, accounts } 기존 초안은 덮어쓰지 않는다 (같으면 건너뛰고, 다르면 번호를 붙임).
 * 초안의 계정은 이 PC의 계정과 이름으로 잇고, 없으면 새로 만든다 (accounts: 어떻게 이었는지)
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = parseDraftBundle(raw);
    if (!parsed.length) return Response.json({ error: "가져올 초안이 없어요" }, { status: 400 });
    const { drafts, links } = await linkBundleAccounts(DATA_DIR, parseBundleAccounts(raw), parsed);
    const results = await importDrafts(DRAFTS_DIR, DATA_DIR, drafts);
    // 화면이 새로 생긴 초안의 상태를 바로 보여 줄 수 있게
    const all = await readDraftStatuses(DATA_DIR);
    const statuses = Object.fromEntries(results.flatMap((r) => ("savedAs" in r && all[r.savedAs] ? [[r.savedAs, all[r.savedAs]]] : [])));
    return Response.json({ results, statuses, accounts: links });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
