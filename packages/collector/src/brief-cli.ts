/**
 * [글쓰기 브리프]를 출력하는 CLI. Claude Code의 /blog-draft 스킬도 이 명령을 쓴다.
 *
 *   npm run --silent brief -- "국민연금 수령나이" --platform tistory
 *   npm run --silent brief -- "국민연금 수령나이" --platform naver --note "부모님 사례 위주로"
 *
 * 네이버 검색광고 키는 apps/web/.env.local에서 읽는다 (package.json의 --env-file-if-exists).
 */
import { parseArgs } from "node:util";
import { buildWritingBrief } from "./brief.ts";
import { searchAdConfigFromEnv } from "./naver-searchad.ts";
import { isPlatform, PLATFORMS } from "./platforms.ts";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: "string", default: "tistory" },
    note: { type: "string" },
  },
});

async function main() {
  const keyword = positionals.join(" ").trim();
  if (!keyword) {
    console.error('키워드를 입력하세요. 예: npm run --silent brief -- "국민연금 수령나이" --platform tistory');
    return 1;
  }
  if (!isPlatform(args.platform)) {
    console.error(`알 수 없는 플랫폼: ${args.platform} (사용 가능: ${PLATFORMS.join(", ")})`);
    return 1;
  }

  const config = searchAdConfigFromEnv();
  if (!config) console.error("네이버 검색광고 키가 없어 검색량 없이 브리프를 만듭니다. (apps/web/.env.local)");

  console.log(await buildWritingBrief(config, keyword, args.platform, { note: args.note }));
  return 0;
}

process.exitCode = await main();
