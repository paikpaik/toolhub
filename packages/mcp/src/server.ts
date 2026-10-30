/**
 * toolhub MCP 서버 (stdio). Claude 데스크톱 앱·Claude Code에서 키워드 데이터와 글쓰기 규칙을 직접 쓰게 한다.
 *
 * 주의: stdio 전송은 stdout을 프로토콜 통신에 쓰므로 console.log를 쓰면 안 된다. 로그는 console.error로.
 *
 *   node --env-file-if-exists=<저장소>/apps/web/.env.local <저장소>/packages/mcp/src/server.ts
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ALL_SOURCES,
  buildWritingBrief,
  collectKeywords,
  enrichDayWithStats,
  fetchKeywordInsight,
  formatPlanningBriefing,
  formatSearchCount,
  kstNow,
  PLATFORM_LABELS,
  PLATFORMS,
  rankByRelevance,
  readDay,
  recordKeywords,
  searchAdConfigFromEnv,
  SOURCE_LABELS,
  type Platform,
} from "@toolhub/collector";
import { z } from "zod";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const DATA_DIR = process.env.TOOLHUB_DATA_DIR ?? path.join(ROOT, "data");
const DRAFTS_DIR = path.join(ROOT, "drafts");
const PROMPTS_DIR = path.join(ROOT, "docs/prompts");

const platformSchema = z.enum(PLATFORMS).describe("발행 플랫폼: tistory(티스토리), blogger(Blogger), naver(네이버)");
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("YYYY-MM-DD (KST). 생략하면 오늘");

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (e: unknown) => ({
  content: [{ type: "text" as const, text: `오류: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

/** 프롬프트 파일을 읽는다. 사람에게 남긴 설정 안내 주석(<!-- -->)은 빼고 돌려준다 */
const readPrompt = async (file: string) =>
  (await readFile(path.join(PROMPTS_DIR, file), "utf-8")).replace(/<!--[\s\S]*?-->\s*/g, "");

/** 초안 작성에 필요한 규칙 전체 (프로젝트 지침 + 작성 공통 + 플랫폼 + 스레드) */
async function writingRules(platform: Platform) {
  const files = ["project-instructions.md", "writing.md", `platforms/${platform}.md`, "threads.md"];
  return (await Promise.all(files.map(readPrompt))).join("\n\n---\n\n");
}

async function planningRules() {
  return (await Promise.all(["project-instructions.md", "planning.md"].map(readPrompt))).join("\n\n---\n\n");
}

const server = new McpServer(
  { name: "toolhub", version: "0.1.0" },
  {
    instructions: [
      "toolhub는 블로그 글감을 찾기 위한 한국어 키워드 도구다.",
      "글감 고르기: get_daily_keywords(또는 get_live_keywords)로 키워드를 보고, get_writing_rules(task=planning)의 규칙으로 판단한다.",
      "초안 쓰기: get_writing_rules(task=writing, platform)로 규칙을 읽고, get_writing_brief로 브리프를 받아, 규칙대로 웹 검색으로 사실을 확인하며 쓴다. 사용자가 원하면 save_draft로 저장한다.",
      "사용자가 플랫폼을 말하지 않으면 티스토리(tistory)로 쓴다.",
    ].join("\n"),
  },
);

server.registerTool(
  "get_live_keywords",
  {
    title: "실시간 키워드 조회",
    description:
      "Google Trends·네이트·signal.bz의 지금 실시간 키워드 순위를 조회한다. 조회한 키워드는 오늘 기록(get_daily_keywords)에도 추가된다.",
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async () => {
    try {
      const live = await collectKeywords();
      const recorded = await recordKeywords(live, DATA_DIR);
      const sections = ALL_SOURCES.map((source) => {
        const error = live.errors[source];
        const items = live.items.filter((i) => i.source === source);
        const body = error
          ? `조회 실패: ${error}`
          : items
              .map((i) =>
                [
                  `${i.rank}. ${i.keyword}`,
                  i.traffic ? `(구글 검색량 ${i.traffic.toLocaleString("ko-KR")}+)` : "",
                  i.related && i.related !== i.keyword ? `— ${i.related}` : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              )
              .join("\n");
        return `## ${SOURCE_LABELS[source]}\n${body}`;
      });
      return text(
        `${live.collectedAt.slice(0, 16).replace("T", " ")} 조회 · 새 키워드 ${recorded.added.length}개를 오늘 기록에 추가 (누적 ${recorded.total}개)\n\n${sections.join("\n\n")}`,
      );
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "get_daily_keywords",
  {
    title: "날짜별 키워드 기록 조회",
    description:
      "그날 한 번이라도 뜬 키워드를 네이버 월간 검색량·경쟁도와 함께 [글감 브리핑] 형식의 표로 돌려준다. 글감을 고를 때 쓴다. 검색량을 아직 모르는 키워드는 이때 조회한다(키워드가 많으면 수십 초 걸릴 수 있음).",
    inputSchema: {
      date: dateSchema,
      sort: z.enum(["search", "recent"]).default("search").describe("search: 월간 검색량 많은 순, recent: 최근에 처음 본 순"),
      limit: z.number().int().min(1).max(200).default(30).describe("돌려줄 키워드 수"),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async ({ date = kstNow().date, sort, limit }) => {
    try {
      const searchAd = searchAdConfigFromEnv();
      const enriched = searchAd ? await enrichDayWithStats(DATA_DIR, date, searchAd) : null;
      const day = await readDay(DATA_DIR, date);
      if (!day?.keywords.length) {
        return text(`${date} 기록이 없습니다. 오늘이라면 get_live_keywords를 먼저 호출하면 기록이 쌓입니다.`);
      }
      const notes = [
        !searchAd && "네이버 검색광고 키가 없어 검색량은 표시되지 않습니다.",
        enriched?.error && `검색량 조회 실패: ${enriched.error}`,
        enriched && enriched.remaining > 0 && `검색량을 아직 조회하지 않은 키워드가 ${enriched.remaining}개 남았습니다. 다시 호출하면 이어서 조회합니다.`,
      ].filter(Boolean);
      const briefing = formatPlanningBriefing(date, day.keywords, { sort, limit });
      const summary = `전체 ${day.keywords.length}개 중 ${Math.min(limit, day.keywords.length)}개`;
      return text([summary, ...notes, "", briefing].join("\n"));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "analyze_keyword",
  {
    title: "키워드 분석",
    description:
      "키워드 하나의 네이버 월간 검색량(PC/모바일)·경쟁도·월평균 클릭과 연관 키워드를 조회한다. 띄어쓰기가 있는 롱테일 키워드는 각 단어의 연관 키워드도 함께 조회해 관련 높은 순으로 정렬한다.",
    inputSchema: {
      keyword: z.string().min(1).describe("분석할 키워드"),
      limit: z.number().int().min(1).max(100).default(30).describe("돌려줄 연관 키워드 수"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ keyword, limit }) => {
    const searchAd = searchAdConfigFromEnv();
    if (!searchAd) return failure("네이버 검색광고 키가 없습니다. apps/web/.env.local을 설정하세요.");
    try {
      const { self, related, tokens } = await fetchKeywordInsight(searchAd, keyword);
      const head = self
        ? `월간 검색량 ${formatSearchCount(self.totalSearches)} (PC ${formatSearchCount(self.pcSearches)} / 모바일 ${formatSearchCount(self.mobileSearches)}) · 경쟁도 ${self.competition} · 월평균 클릭 ${self.monthlyClicks.toLocaleString("ko-KR")}`
        : "검색광고에 이 키워드의 데이터가 없습니다.";
      const rows = rankByRelevance(related, tokens)
        .slice(0, limit)
        .map((r) => `| ${r.keyword} | ${formatSearchCount(r.totalSearches)} | ${formatSearchCount(r.pcSearches)} | ${formatSearchCount(r.mobileSearches)} | ${r.competition} |`);
      return text(
        [
          `# ${keyword}`,
          head,
          "",
          `연관 키워드 (관련 높은 순, 전체 ${related.length}개 중 ${rows.length}개)`,
          "| 키워드 | 월간 검색량 | PC | 모바일 | 경쟁도 |",
          "|---|---|---|---|---|",
          ...rows,
        ].join("\n"),
      );
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "get_writing_rules",
  {
    title: "글쓰기 규칙 조회",
    description:
      "블로그 글감 선정(planning) 또는 초안 작성(writing) 규칙을 돌려준다. 글감을 고르거나 초안을 쓰기 전에 반드시 먼저 호출해 규칙을 따른다. writing은 platform이 필요하다.",
    inputSchema: {
      task: z.enum(["planning", "writing"]).describe("planning: 글감 선정, writing: 초안 작성"),
      platform: platformSchema.optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ task, platform = "tistory" }) => {
    try {
      return text(task === "planning" ? await planningRules() : await writingRules(platform));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "get_writing_brief",
  {
    title: "글쓰기 브리프 조회",
    description:
      "키워드와 플랫폼으로 [글쓰기 브리프](검색량·경쟁도·연관 키워드 상위 20개)를 만든다. 초안 작성의 입력으로 쓴다.",
    inputSchema: {
      keyword: z.string().min(1).describe("글을 쓸 키워드"),
      platform: platformSchema.default("tistory"),
      note: z.string().optional().describe("글 각도, 직접 경험 메모 등 참고 사항"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ keyword, platform, note }) => {
    try {
      return text(await buildWritingBrief(searchAdConfigFromEnv(), keyword, platform, { note }));
    } catch (e) {
      return failure(e);
    }
  },
);

/** 파일 이름에 쓸 수 없는 문자를 빼고 공백을 하이픈으로 */
const slugify = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

server.registerTool(
  "save_draft",
  {
    title: "초안 저장",
    description: "완성한 초안을 저장소의 drafts/ 폴더에 마크다운 파일로 저장하고 경로를 돌려준다. 같은 이름이 있으면 덮어쓰지 않고 번호를 붙인다.",
    inputSchema: {
      keyword: z.string().min(1).describe("초안의 메인 키워드 (파일 이름에 쓰임)"),
      platform: platformSchema,
      content: z.string().min(1).describe("저장할 초안 전체 (마크다운)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ keyword, platform, content }) => {
    try {
      await mkdir(DRAFTS_DIR, { recursive: true });
      const base = `${kstNow().date}-${slugify(keyword)}-${platform}`;
      let file = path.join(DRAFTS_DIR, `${base}.md`);
      for (let n = 2; await exists(file); n++) file = path.join(DRAFTS_DIR, `${base}-${n}.md`);
      await writeFile(file, content.endsWith("\n") ? content : `${content}\n`);
      return text(`저장했습니다: ${file}`);
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerPrompt(
  "blog_draft",
  {
    title: "블로그 초안 작성",
    description: "키워드와 플랫폼을 받아 규칙과 브리프를 담은 초안 작성 요청을 만든다.",
    argsSchema: {
      keyword: z.string().describe("글을 쓸 키워드"),
      platform: z.string().optional().describe("tistory | blogger | naver (기본 tistory)"),
    },
  },
  async ({ keyword, platform }) => {
    const target: Platform = PLATFORMS.find((p) => p === platform) ?? "tistory";
    const [rules, brief] = await Promise.all([writingRules(target), buildWritingBrief(searchAdConfigFromEnv(), keyword, target)]);
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `아래 규칙에 따라 ${PLATFORM_LABELS[target]}용 블로그 초안을 작성해 주세요. 사실은 웹 검색으로 확인하고, 다 쓰면 save_draft로 저장해 주세요.\n\n${rules}\n\n---\n\n${brief}`,
          },
        },
      ],
    };
  },
);

server.registerPrompt(
  "pick_topics",
  {
    title: "오늘의 글감 고르기",
    description: "그날 뜬 키워드 중 블로그 글로 쓸 만한 주제를 고르는 요청을 만든다.",
    argsSchema: { date: z.string().optional().describe("YYYY-MM-DD (생략하면 오늘)") },
  },
  async ({ date = kstNow().date }) => {
    const day = await readDay(DATA_DIR, date);
    const briefing = day?.keywords.length ? formatPlanningBriefing(date, day.keywords) : `[글감 브리핑]\n날짜: ${date}\n(기록 없음)`;
    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: `아래 규칙에 따라 글감을 골라 주세요.\n\n${await planningRules()}\n\n---\n\n${briefing}` },
        },
      ],
    };
  },
);

await server.connect(new StdioServerTransport());
console.error(`toolhub MCP 서버 시작 (data: ${DATA_DIR})`);
