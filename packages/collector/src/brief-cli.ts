/**
 * [글쓰기 브리프]를 출력하는 CLI. Claude Code의 /blog-draft 스킬도 이 명령을 쓴다.
 *
 *   npm run --silent brief -- "국민연금 수령나이" --platform tistory
 *   npm run --silent brief -- "에어프라이어 추천" --platform naver --type review --note "1년 사용 후기"
 *   npm run --silent brief -- "국민연금 수령나이" --structure C   (구성 A~D 지정, 생략하면 무작위)
 *   npm run --silent brief -- "원주 매운맛축제 아이와" --platform naver --format home   (네이버 홈판형, 생략하면 검색형)
 *   npm run --silent brief -- "피토메스 스킨로션 후기" --platform naver --type connect --link https://naver.me/… [--mode experience --experience "2주 사용"] [--product "상품 정보"]
 *
 * 네이버 검색광고·API HUB 키는 apps/web/.env.local에서 읽는다 (package.json의 --env-file-if-exists).
 */
import { parseArgs } from "node:util";
import { buildWritingBrief } from "./brief.ts";
import { hubConfigFromEnv } from "./naver-hub.ts";
import { searchAdConfigFromEnv } from "./naver-searchad.ts";
import {
  CONNECT_MODES,
  isConnectMode,
  isNaverFormat,
  isPlatform,
  isStructure,
  isWritingType,
  NAVER_FORMATS,
  PLATFORMS,
  STRUCTURES,
  WRITING_TYPES,
} from "./platforms.ts";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: "string", default: "tistory" },
    type: { type: "string", default: "info" },
    structure: { type: "string" },
    // 네이버만: search(검색형) | home(홈판형)
    format: { type: "string" },
    note: { type: "string" },
    // 쇼핑 커넥트(--type connect)만
    link: { type: "string" },
    mode: { type: "string" },
    product: { type: "string" },
    experience: { type: "string" },
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
  if (!isWritingType(args.type)) {
    console.error(`알 수 없는 유형: ${args.type} (사용 가능: ${WRITING_TYPES.join(", ")})`);
    return 1;
  }

  const structure = args.structure?.toUpperCase();
  if (structure !== undefined && !isStructure(structure)) {
    console.error(`알 수 없는 구성: ${args.structure} (사용 가능: ${STRUCTURES.join(", ")}, 생략하면 무작위)`);
    return 1;
  }

  if (args.mode !== undefined && !isConnectMode(args.mode)) {
    console.error(`알 수 없는 글 방식: ${args.mode} (사용 가능: ${CONNECT_MODES.join(", ")})`);
    return 1;
  }

  if (args.format !== undefined && !isNaverFormat(args.format)) {
    console.error(`알 수 없는 글 형식: ${args.format} (사용 가능: ${NAVER_FORMATS.join(", ")})`);
    return 1;
  }

  const sources = { searchAd: searchAdConfigFromEnv(), hub: hubConfigFromEnv() };
  if (!sources.searchAd) console.error("네이버 검색광고 키가 없어 검색량·연관 키워드 없이 만듭니다. (apps/web/.env.local)");
  if (!sources.hub) console.error("NAVER API HUB 키가 없어 추이·문서 수·질문 없이 만듭니다. (apps/web/.env.local)");

  console.log(await buildWritingBrief(sources, keyword, args.platform, {
    type: args.type,
    structure,
    connect: { link: args.link, mode: args.mode, product: args.product, experience: args.experience },
    format: args.format,
    note: args.note,
  }));
  return 0;
}

process.exitCode = await main();
