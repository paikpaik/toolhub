/**
 * 초안 파일의 본문 글자 수와 분량 안내 (blog-draft 스킬이 파일을 저장한 뒤 실행)
 * npm run --silent draft-length -- drafts/2026-11-05-키워드-naver.md
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { draftPlatform, lengthFeedback } from "./draft-length.ts";
import { parseDraft } from "./drafts.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용법: npm run --silent draft-length -- <초안 파일>...");
  process.exit(1);
}
for (const file of files) {
  const content = await readFile(path.resolve(process.env.INIT_CWD ?? process.cwd(), file), "utf-8");
  console.log(`${path.basename(file)}\n${lengthFeedback(draftPlatform(file), parseDraft(content).body) ?? "플랫폼을 알 수 없는 파일 이름이라 분량을 판단하지 못했습니다."}`);
}
