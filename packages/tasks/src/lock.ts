/**
 * 웹 서버와 MCP 서버가 서로 다른 프로세스에서 같은 파일을 고치므로, 잠금 파일(<파일>.lock)로
 * 읽기-수정-쓰기를 한 번에 하나씩만 하게 한다.
 */
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCK_STALE_MS = 10_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 잠금을 잡고 fn을 실행한다. 다른 프로세스가 잡고 있으면 기다리고, 오래된 잠금(비정상 종료)은 푼다 */
export async function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  await mkdir(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      break;
    } catch {
      const age = await stat(lock).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > LOCK_STALE_MS) await rm(lock, { force: true });
      else if (attempt > 200) throw new Error(`${path.basename(file)} 잠금을 얻지 못했습니다. 잠시 후 다시 시도하세요.`);
      else await sleep(25);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lock, { force: true });
  }
}

/** 쓰다 끊겨도 파일이 깨지지 않도록 임시 파일에 쓴 뒤 바꿔치기한다 */
export async function writeJsonAtomic(file: string, value: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${file}.tmp`, file);
}
