import { chunkToday, docsToState, readChunkDocs } from "@toolhub/tasks";
import { DATA_DIR } from "../../lib/data";
import { ChunksApp } from "./chunks-app";
import { CHUNK_VIEWS, type ChunkView } from "./views";

export const dynamic = "force-dynamic";

/** 덩어리 기록: 하루 집중 작업 2덩어리 + 그룹별 주간 목표 보드 (data/chunks.json) */
export default async function ChunksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view: ChunkView = CHUNK_VIEWS.find((v) => v === params.view) ?? "today";
  return <ChunksApp initial={docsToState(await readChunkDocs(DATA_DIR))} today={chunkToday()} initialView={view} />;
}
