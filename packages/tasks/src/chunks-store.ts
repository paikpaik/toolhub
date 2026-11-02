/**
 * 덩어리 기록 저장소: data/chunks.json ("문서 id → 데이터", 문서 모양은 chunks.ts)
 * 화면이 문서 하나씩 통째로 저장·삭제하므로 서버는 id와 모양만 확인한다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isChunkDocId } from "./chunks.ts";
import { withFileLock, writeJsonAtomic } from "./lock.ts";

export type ChunkDocs = Record<string, Record<string, unknown>>;

/** 문서 하나의 최대 크기. 한 주 목표가 수십 개여도 몇 KB라 넉넉하다 */
const MAX_DOC_BYTES = 64_000;

const chunksFile = (dataDir: string) => path.join(dataDir, "chunks.json");

export async function readChunkDocs(dataDir: string): Promise<ChunkDocs> {
  try {
    const docs = JSON.parse(await readFile(chunksFile(dataDir), "utf-8"));
    return docs && typeof docs === "object" && !Array.isArray(docs) ? docs : {};
  } catch {
    return {};
  }
}

function mutateDocs(dataDir: string, fn: (docs: ChunkDocs) => void) {
  return withFileLock(chunksFile(dataDir), async () => {
    const docs = await readChunkDocs(dataDir);
    fn(docs);
    await writeJsonAtomic(chunksFile(dataDir), docs);
  });
}

export async function saveChunkDoc(dataDir: string, id: string, data: unknown) {
  if (!isChunkDocId(id)) throw new Error(`문서 id가 올바르지 않습니다: ${id}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("문서 내용은 객체여야 합니다.");
  if (JSON.stringify(data).length > MAX_DOC_BYTES) throw new Error("문서가 너무 큽니다.");
  await mutateDocs(dataDir, (docs) => {
    docs[id] = data as Record<string, unknown>;
  });
}

export async function deleteChunkDoc(dataDir: string, id: string) {
  if (!isChunkDocId(id)) throw new Error(`문서 id가 올바르지 않습니다: ${id}`);
  await mutateDocs(dataDir, (docs) => {
    delete docs[id];
  });
}
