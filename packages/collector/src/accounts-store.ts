/** data/accounts.json 읽고 쓰기 (블로그 계정과 분야), data/thumbnails/<계정 id>/ 썸네일 배경 이미지 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAccountId, sanitizeAccounts, type BlogAccount } from "./accounts.ts";
import { BACKGROUND_MAX, BACKGROUND_NAME } from "./thumbnail-style.ts";

const FILE = "accounts.json";
const THUMBNAILS = "thumbnails";

/** 파일이 없거나 잘못됐으면 빈 목록 (계정이 없으면 지금처럼 쓴다) */
export async function readAccounts(dataDir: string): Promise<BlogAccount[]> {
  try {
    const parsed = sanitizeAccounts(JSON.parse(await readFile(path.join(dataDir, FILE), "utf-8")).accounts);
    return typeof parsed === "string" ? [] : parsed;
  } catch {
    return [];
  }
}

/** 같은 프로세스 안에서 계정 저장과 배경 올리기가 겹쳐도 빠지지 않게 차례로 쓴다 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function save(dataDir: string, accounts: BlogAccount[]) {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, FILE);
  await writeFile(`${file}.tmp`, JSON.stringify({ accounts }, null, 2));
  await rename(`${file}.tmp`, file);
}

/**
 * 확인한 목록으로 통째로 바꾼다. 잘못됐으면 오류.
 * 지운 계정의 배경 이미지 폴더도 지운다 (사용자가 계정을 지울 때 확인을 받는다)
 */
export function writeAccounts(dataDir: string, raw: unknown) {
  return serial(async () => {
    const accounts = sanitizeAccounts(raw);
    if (typeof accounts === "string") throw new Error(accounts);
    const before = await readAccounts(dataDir);
    // 배경 목록은 올리기·지우기로만 바뀐다 (화면이 오래된 목록으로 저장해도 올린 배경이 빠지지 않게)
    for (const a of accounts) a.thumbnail.backgrounds = before.find((b) => b.id === a.id)?.thumbnail.backgrounds ?? [];
    await save(dataDir, accounts);
    for (const gone of before.filter((a) => !accounts.some((b) => b.id === a.id))) {
      await rm(path.join(dataDir, THUMBNAILS, gone.id), { recursive: true, force: true });
    }
    return accounts;
  });
}

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const BACKGROUND_TYPES = Object.keys(EXTENSIONS);
export const BACKGROUND_BYTES_MAX = 8 * 1024 * 1024;

/** 배경 이미지 파일 경로. 이름·계정이 잘못됐으면 null */
export function backgroundPath(dataDir: string, accountId: string, name: string) {
  if (!isAccountId(accountId) || !BACKGROUND_NAME.test(name)) return null;
  return path.join(dataDir, THUMBNAILS, accountId, name);
}

/** 배경 이미지를 저장하고 그 계정의 배경 목록 끝에 더한다. 고친 계정 목록을 돌려준다 */
export function addBackground(dataDir: string, accountId: string, type: string, bytes: Uint8Array) {
  return serial(async () => {
    const ext = EXTENSIONS[type];
    if (!ext) throw new Error("PNG·JPG·WebP 이미지만 올릴 수 있어요");
    if (bytes.byteLength > BACKGROUND_BYTES_MAX) throw new Error("배경 이미지는 8MB까지예요");
    const accounts = await readAccounts(dataDir);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error("계정을 찾지 못했어요");
    if (account.thumbnail.backgrounds.length >= BACKGROUND_MAX) throw new Error(`배경 이미지는 계정마다 ${BACKGROUND_MAX}장까지예요`);
    const name = `bg-${randomBytes(5).toString("hex")}.${ext}`;
    const file = backgroundPath(dataDir, accountId, name)!;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    account.thumbnail.backgrounds.push(name);
    await save(dataDir, accounts);
    return accounts;
  });
}

/** 배경 이미지를 지우고 목록에서 뺀다 */
export function removeBackground(dataDir: string, accountId: string, name: string) {
  return serial(async () => {
    const file = backgroundPath(dataDir, accountId, name);
    if (!file) throw new Error("배경 이미지 이름이 잘못됐어요");
    const accounts = await readAccounts(dataDir);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error("계정을 찾지 못했어요");
    account.thumbnail.backgrounds = account.thumbnail.backgrounds.filter((b) => b !== name);
    await save(dataDir, accounts);
    await rm(file, { force: true });
    return accounts;
  });
}
