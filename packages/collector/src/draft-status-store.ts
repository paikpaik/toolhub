/** data/draft-status.json 읽고 쓰기 (초안 파일 이름 → 상태) */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyStatusPatch, toggleKinAnswer, type DraftStatusEntry, type DraftStatusMap, type DraftStatusPatch } from "./draft-status.ts";

const FILE = "draft-status.json";

export async function readDraftStatuses(dataDir: string): Promise<DraftStatusMap> {
  try {
    const parsed = JSON.parse(await readFile(path.join(dataDir, FILE), "utf-8"));
    return parsed && typeof parsed === "object" ? (parsed.drafts ?? {}) : {};
  } catch {
    return {};
  }
}

/** 같은 프로세스 안에서 동시에 고쳐도 빠지지 않게 차례로 쓴다 */
let queue: Promise<unknown> = Promise.resolve();

/** change가 문자열이면 오류, null이면 그 초안의 기록을 지운다 */
function update<T extends DraftStatusEntry | null>(dataDir: string, draftFile: string, change: (entry: DraftStatusEntry | undefined) => T | string) {
  const run = queue.then(async () => {
    const drafts = await readDraftStatuses(dataDir);
    const next = change(drafts[draftFile]);
    if (typeof next === "string") throw new Error(next);
    if (next === null) delete drafts[draftFile];
    else drafts[draftFile] = next;
    await mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, FILE);
    await writeFile(`${file}.tmp`, JSON.stringify({ drafts }, null, 2));
    await rename(`${file}.tmp`, file);
    return next;
  });
  queue = run.catch(() => {});
  return run;
}

/** 초안 파일 이름만 받는다 (경로 X) */
const checkName = (draftFile: string) => {
  if (path.basename(draftFile) !== draftFile || !draftFile.endsWith(".md")) throw new Error(`초안 파일 이름이 아닙니다: ${draftFile}`);
};

export async function setDraftStatus(dataDir: string, draftFile: string, patch: DraftStatusPatch) {
  checkName(draftFile);
  return update(dataDir, draftFile, (entry) => applyStatusPatch(entry, patch));
}

/** 초안을 지울 때 상태·발행 주소·지식iN 답변 기록도 함께 지운다 */
export async function removeDraftStatus(dataDir: string, draftFile: string) {
  checkName(draftFile);
  return update(dataDir, draftFile, () => null);
}

export async function setKinAnswered(dataDir: string, draftFile: string, question: { link: string; title: string }, answered: boolean) {
  checkName(draftFile);
  return update(dataDir, draftFile, (entry) => toggleKinAnswer(entry, question, answered));
}
