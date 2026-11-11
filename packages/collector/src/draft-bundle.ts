/**
 * 초안 내보내기·가져오기 (다른 PC로 옮기기, 백업).
 * 내보내기 파일 하나(JSON)에 초안 내용과 상태 기록(발행됨·주소·지식iN 답변)을 담는다. 이전 버전(.history)은 담지 않는다.
 * 가져오기는 기존 초안을 덮어쓰지 않는다: 같은 이름·같은 내용이면 건너뛰고, 내용이 다르면 번호를 붙여 새로 저장한다
 * (발행됨 초안을 고치지 않는 정책과 같은 이유).
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeStatusEntry, type DraftStatusEntry } from "./draft-status.ts";
import { readDraftStatuses, restoreDraftStatus } from "./draft-status-store.ts";
import { readDraftFile } from "./drafts.ts";

export const DRAFT_BUNDLE_FORMAT = "toolhub-drafts";
/** 한 번에 가져올 수 있는 초안 수 (실수로 엉뚱한 파일을 올렸을 때 막으려고) */
export const IMPORT_MAX = 500;

export interface BundledDraft {
  file: string;
  content: string;
  status?: DraftStatusEntry;
}

export interface DraftBundle {
  format: typeof DRAFT_BUNDLE_FORMAT;
  version: 1;
  exportedAt: string;
  drafts: BundledDraft[];
}

export type ImportResult =
  | { file: string; result: "added"; savedAs: string }
  | { file: string; result: "renamed"; savedAs: string }
  | { file: string; result: "skipped"; reason: string };

/** 고른 초안 파일을 묶는다. 없는 파일은 빠진다 */
export async function buildDraftBundle(dir: string, dataDir: string, files: string[], now = new Date()): Promise<DraftBundle> {
  const statuses = await readDraftStatuses(dataDir);
  const drafts: BundledDraft[] = [];
  for (const file of [...new Set(files)]) {
    const content = await readDraftFile(dir, file);
    if (content === null) continue;
    drafts.push({ file, content, ...(statuses[file] ? { status: statuses[file] } : {}) });
  }
  return { format: DRAFT_BUNDLE_FORMAT, version: 1, exportedAt: now.toISOString(), drafts };
}

/** 파일 이름으로 쓸 수 있게: 폴더·금지 문자 제거, .md로 끝나게 */
export function safeDraftFileName(name: string) {
  const stem = path
    .basename(name.replace(/\\/g, "/"))
    .replace(/[:*?"<>|\u0000-\u001f]/g, "")
    .trim()
    .replace(/\.(md|markdown|txt)$/i, "")
    // 숨김 파일(.history 등)이 되지 않게
    .replace(/^\.+/, "")
    .trim();
  return stem ? `${stem}.md` : null;
}

/**
 * 올린 JSON(내보내기 파일)을 읽는다. 모양이 다르면 오류 메시지를 던진다.
 * .md 파일은 화면에서 { file, content }로 바꿔 함께 보낸다
 */
export function parseDraftBundle(raw: unknown): BundledDraft[] {
  const drafts = (raw as { drafts?: unknown } | null)?.drafts;
  if (!raw || typeof raw !== "object" || !Array.isArray(drafts)) throw new Error("toolhub 초안 내보내기 파일이 아니에요.");
  if (drafts.length > IMPORT_MAX) throw new Error(`한 번에 ${IMPORT_MAX}개까지 가져올 수 있어요.`);
  return drafts.flatMap((d) => {
    const x = (d ?? {}) as Record<string, unknown>;
    if (typeof x.file !== "string" || typeof x.content !== "string" || !x.content.trim()) return [];
    const status = sanitizeStatusEntry(x.status);
    return [{ file: x.file, content: x.content, ...(status ? { status } : {}) }];
  });
}

const withNewline = (content: string) => (content.endsWith("\n") ? content : `${content}\n`);

/** 차례로 저장한다. 같은 이름이 있으면 덮어쓰지 않는다 */
export async function importDrafts(dir: string, dataDir: string, drafts: BundledDraft[]): Promise<ImportResult[]> {
  await mkdir(dir, { recursive: true });
  const taken = new Set(await readdir(dir).catch(() => [] as string[]));
  const results: ImportResult[] = [];
  for (const draft of drafts) {
    const name = safeDraftFileName(draft.file);
    if (!name) {
      results.push({ file: draft.file, result: "skipped", reason: "파일 이름을 알 수 없어요" });
      continue;
    }
    const content = withNewline(draft.content);
    let savedAs = name;
    if (taken.has(name)) {
      if ((await readDraftFile(dir, name)) === content) {
        results.push({ file: draft.file, result: "skipped", reason: "같은 초안이 이미 있어요" });
        continue;
      }
      // 내용이 다르면 번호를 붙인다 (MCP save_draft와 같은 규칙: 이름-2.md, 이름-3.md …)
      const base = name.replace(/\.md$/, "");
      for (let n = 2; taken.has(savedAs); n++) savedAs = `${base}-${n}.md`;
    }
    await writeFile(path.join(dir, savedAs), content, { flag: "wx" });
    taken.add(savedAs);
    if (draft.status) await restoreDraftStatus(dataDir, savedAs, draft.status);
    results.push(savedAs === name ? { file: draft.file, result: "added", savedAs } : { file: draft.file, result: "renamed", savedAs });
  }
  return results;
}
