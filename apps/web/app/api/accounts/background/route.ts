import { readFile } from "node:fs/promises";
import { addBackground, backgroundPath, removeBackground } from "@toolhub/collector";
import { DATA_DIR } from "../../../../lib/data";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const error = (e: unknown, status = 400) => Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });

/** GET /api/accounts/background?account=&name= → 배경 이미지 (썸네일 캔버스가 같은 주소에서 불러와야 PNG로 뽑을 수 있다) */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const file = backgroundPath(DATA_DIR, params.get("account") ?? "", params.get("name") ?? "");
  if (!file) return error("배경 이미지 이름이 잘못됐어요");
  try {
    const bytes = await readFile(file);
    return new Response(bytes, { headers: { "Content-Type": TYPES[file.split(".").pop()!] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return error("배경 이미지를 찾지 못했어요", 404);
  }
}

/** POST /api/accounts/background (form: account, file) → { accounts } */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const account = form?.get("account");
  const file = form?.get("file");
  if (typeof account !== "string" || !(file instanceof File)) return error("account와 file이 필요합니다");
  try {
    return Response.json({ accounts: await addBackground(DATA_DIR, account, file.type, new Uint8Array(await file.arrayBuffer())) });
  } catch (e) {
    return error(e);
  }
}

/** DELETE /api/accounts/background?account=&name= → { accounts } */
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return Response.json({ accounts: await removeBackground(DATA_DIR, params.get("account") ?? "", params.get("name") ?? "") });
  } catch (e) {
    return error(e);
  }
}
