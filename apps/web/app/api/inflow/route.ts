import { deleteInflow } from "@toolhub/collector";
import { DATA_DIR } from "../../../lib/data";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/inflow?account=<계정 id>[&keyword=<검색어>] → { ok: true }.
 * keyword가 없으면 그 계정의 유입 검색어 기록 전체, 있으면 그 검색어 하나를 지운다
 */
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const account = params.get("account");
  if (!account) return Response.json({ error: "account가 필요해요" }, { status: 400 });
  const removed = await deleteInflow(DATA_DIR, account, params.get("keyword") ?? undefined);
  if (!removed) return Response.json({ error: "지울 기록이 없어요 (이미 지워졌을 수 있어요)" }, { status: 404 });
  return Response.json({ ok: true });
}
