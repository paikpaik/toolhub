/** data/inflow.json 읽고 쓰기 (계정 id → 마지막으로 받은 유입 검색어) */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InflowRecord, InflowStore } from "./inflow.ts";

const FILE = "inflow.json";

export async function readInflow(dataDir: string): Promise<InflowStore> {
  try {
    const parsed = JSON.parse(await readFile(path.join(dataDir, FILE), "utf-8"));
    return parsed && typeof parsed.accounts === "object" ? parsed.accounts : {};
  } catch {
    return {};
  }
}

/** 같은 프로세스 안에서 동시에 저장해도 빠지지 않게 차례로 쓴다 */
let queue: Promise<unknown> = Promise.resolve();

/** 그 계정의 기록을 새것으로 바꾼다 (주마다 새로 받으므로 지난 기록은 남기지 않는다) */
export function writeInflow(dataDir: string, accountId: string, record: InflowRecord) {
  const run = queue.then(async () => {
    const accounts = { ...(await readInflow(dataDir)), [accountId]: record };
    await mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, FILE);
    await writeFile(`${file}.tmp`, JSON.stringify({ accounts }, null, 2));
    await rename(`${file}.tmp`, file);
    return record;
  });
  queue = run.catch(() => {});
  return run;
}
