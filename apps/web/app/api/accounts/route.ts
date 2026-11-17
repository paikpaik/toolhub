import { readAccounts, writeAccounts } from "@toolhub/collector";
import { DATA_DIR } from "../../../lib/data";

export const dynamic = "force-dynamic";

/** GET /api/accounts → { accounts: [{ id, name, topics }] } (크롬 확장 초안 메뉴의 계정 고르기도 쓴다) */
export async function GET() {
  return Response.json({ accounts: await readAccounts(DATA_DIR) });
}

/** PUT /api/accounts { accounts } → 저장한 목록. 통째로 바꾼다 */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { accounts?: unknown } | null;
  try {
    return Response.json({ accounts: await writeAccounts(DATA_DIR, body?.accounts) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
