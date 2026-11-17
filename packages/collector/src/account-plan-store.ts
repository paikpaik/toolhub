/** data/account-plans.json 읽고 쓰기 (만든 날 → 계정별 글감 계획). 최근 14일만 남긴다 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AccountPlan } from "./account-plan.ts";

const FILE = "account-plans.json";
const KEEP_DAYS = 14;

async function readAll(dataDir: string): Promise<Record<string, AccountPlan>> {
  try {
    const parsed = JSON.parse(await readFile(path.join(dataDir, FILE), "utf-8"));
    return parsed && typeof parsed.plans === "object" ? parsed.plans : {};
  } catch {
    return {};
  }
}

export async function readAccountPlan(dataDir: string, day: string): Promise<AccountPlan | null> {
  return (await readAll(dataDir))[day] ?? null;
}

/** 같은 프로세스 안에서 동시에 저장해도 빠지지 않게 차례로 쓴다 */
let queue: Promise<unknown> = Promise.resolve();

export function writeAccountPlan(dataDir: string, plan: AccountPlan) {
  const run = queue.then(async () => {
    const plans = { ...(await readAll(dataDir)), [plan.day]: plan };
    const kept = Object.fromEntries(
      Object.entries(plans)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, KEEP_DAYS),
    );
    await mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, FILE);
    await writeFile(`${file}.tmp`, JSON.stringify({ plans: kept }, null, 2));
    await rename(`${file}.tmp`, file);
    return plan;
  });
  queue = run.catch(() => {});
  return run;
}
