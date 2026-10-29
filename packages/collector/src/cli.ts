/**
 * 실시간 키워드 수집 CLI. 수집한 키워드를 data/YYYY-MM-DD.json에 추가한다.
 *
 *   npm run collect
 *   npm run collect -- --sources google,nate
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { ALL_SOURCES, collectKeywords, recordKeywords } from "./collect.ts";
import { SOURCES } from "./sources.ts";
import type { SourceName } from "./types.ts";

/** 저장소 루트의 data/ */
const DEFAULT_DATA_DIR = process.env.TOOLHUB_DATA_DIR ?? path.resolve(import.meta.dirname, "../../../data");

const { values: args } = parseArgs({
  options: {
    sources: { type: "string", default: ALL_SOURCES.join(",") },
    "data-dir": { type: "string", default: DEFAULT_DATA_DIR },
  },
});

async function main() {
  const names = args.sources.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = names.filter((n) => !(n in SOURCES));
  if (unknown.length) {
    console.error(`알 수 없는 소스: ${unknown.join(", ")} (사용 가능: ${ALL_SOURCES.join(", ")})`);
    return 1;
  }

  const result = await collectKeywords(names as SourceName[]);
  for (const name of names) {
    const error = result.errors[name as SourceName];
    const count = result.items.filter((i) => i.source === name).length;
    console.error(error ? `[${name}] 실패 - ${error}` : `[${name}] ${count}개 수집`);
  }
  if (result.items.length === 0) {
    console.error("모든 소스에서 수집에 실패했습니다.");
    return 1;
  }

  const { date, added, total } = await recordKeywords(result, args["data-dir"]);
  console.log(`\n${date}: 새 키워드 ${added.length}개 추가 (오늘 누적 ${total}개)`);
  for (const k of added) console.log(`  + ${k.keyword}  [${k.sources.join(",")}]`);
  console.error(`\n저장 위치: ${path.join(args["data-dir"], `${date}.json`)}`);
  return 0;
}

process.exitCode = await main();
