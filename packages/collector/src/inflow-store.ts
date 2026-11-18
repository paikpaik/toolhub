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

/** 읽고 고쳐 쓰기를 차례로 한다. change가 돌려준 목록을 저장한다 */
function updateInflow<T>(dataDir: string, change: (accounts: InflowStore) => { accounts: InflowStore; result: T }) {
  const run = queue.then(async () => {
    const { accounts, result } = change(await readInflow(dataDir));
    await mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, FILE);
    await writeFile(`${file}.tmp`, JSON.stringify({ accounts }, null, 2));
    await rename(`${file}.tmp`, file);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

/** 그 계정의 기록을 새것으로 바꾼다 (주마다 새로 받으므로 지난 기록은 남기지 않는다) */
export function writeInflow(dataDir: string, accountId: string, record: InflowRecord) {
  return updateInflow(dataDir, (accounts) => ({ accounts: { ...accounts, [accountId]: record }, result: record }));
}

/**
 * 웹 화면에서 지우기. keyword가 없으면 그 계정 기록 전체, 있으면 그 검색어 하나 (글감 후보에서 빼고 싶을 때).
 * 지웠으면 true, 그런 기록·검색어가 없으면 false
 */
export function deleteInflow(dataDir: string, accountId: string, keyword?: string) {
  return updateInflow(dataDir, (accounts) => {
    const record = accounts[accountId];
    if (!record) return { accounts, result: false };
    if (keyword === undefined) {
      const { [accountId]: _removed, ...rest } = accounts;
      return { accounts: rest, result: true };
    }
    const keywords = record.keywords.filter((k) => k.keyword !== keyword);
    if (keywords.length === record.keywords.length) return { accounts, result: false };
    return { accounts: { ...accounts, [accountId]: { ...record, keywords } }, result: true };
  });
}
