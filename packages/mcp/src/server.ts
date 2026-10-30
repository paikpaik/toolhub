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
  computeSaturation,
  draftOpening,
  draftsForKeyword,
  fetchShoppingTrend,
  formatPlanningBriefing,
  formatSearchCount,
  hubConfigFromEnv,
  kstNow,
  listDrafts,
  parseDraft,
  PLATFORM_LABELS,
  PLATFORMS,
  rankByRelevance,
  readDay,
  readDraftFile,
  recordKeywords,
  updateDraftFile,
  researchKeyword,
  searchAdConfigFromEnv,
  searchPlaces,
  SHOPPING_CATEGORIES,
  SOURCE_LABELS,
  STRUCTURE_NAMES,
  STRUCTURES,
  summarizeTrend,
  WRITING_TYPE_LABELS,
  WRITING_TYPES,
  type Platform,
  type ShoppingCategory,
  type WritingType,
} from "@toolhub/collector";
import { VIEWS } from "@toolhub/tasks";
import { z } from "zod";
import { registerTaskTools } from "./tasks-tools.ts";
import { openWeb, stopWeb, WEB_LOG_FILE, WEB_URL } from "./web.ts";

/** 도구 호출이 클라이언트 제한 시간(보통 60초)에 걸리지 않도록, 이 시간이 지나면 먼저 응답한다 */
const TOOL_SOFT_TIMEOUT_MS = 45_000;

const ROOT = path.resolve(import.meta.dirname, "../../..");
const DATA_DIR = process.env.TOOLHUB_DATA_DIR ?? path.join(ROOT, "data");
const DRAFTS_DIR = path.join(ROOT, "drafts");
const PROMPTS_DIR = path.join(ROOT, "docs/prompts");

const platformSchema = z.enum(PLATFORMS).describe("발행 플랫폼: tistory(티스토리), blogger(Blogger), naver(네이버)");
const typeSchema = z
  .enum(WRITING_TYPES)
  .describe("글 유형: info(정보 - 제도·방법·비교), review(리뷰 - 상품·서비스 사용기), place(장소 - 맛집·여행지 방문기)");

const structureSchema = z
  .enum(STRUCTURES)
  .optional()
  .describe(
    `글 구성 변형. 보통은 생략해 무작위로 고르게 둔다 (글마다 구조가 같아지지 않도록). 사용자가 원할 때만 지정. ${Object.entries(STRUCTURE_NAMES)
      .map(([type, names]) => `${type}: ${Object.entries(names).map(([k, v]) => `${k}=${v}`).join(", ")}`)
      .join(" / ")}`,
  );

const briefSources = () => ({ searchAd: searchAdConfigFromEnv(), hub: hubConfigFromEnv() });
const HUB_MISSING = "NAVER API HUB 키가 없습니다. apps/web/.env.local에 NAVER_API_HUB_CLIENT_ID, NAVER_API_HUB_CLIENT_SECRET을 설정하세요.";
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("YYYY-MM-DD (KST). 생략하면 오늘");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (e: unknown) => ({
  content: [{ type: "text" as const, text: `오류: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

/** 프롬프트 파일을 읽는다. 사람에게 남긴 설정 안내 주석(<!-- -->)은 빼고 돌려준다 */
const readPrompt = async (file: string) =>
  (await readFile(path.join(PROMPTS_DIR, file), "utf-8")).replace(/<!--[\s\S]*?-->\s*/g, "");

/** 초안 작성에 필요한 규칙 전체 (프로젝트 지침 + 작성 공통 + 유형 + 플랫폼 + 스레드) */
async function writingRules(platform: Platform, type: WritingType) {
  const files = ["project-instructions.md", "writing.md", `types/${type}.md`, `platforms/${platform}.md`, "threads.md"];
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
      "글감 고르기: get_daily_keywords(또는 get_live_keywords)로 키워드를 보고, get_writing_rules(task=planning)의 규칙으로 판단한다. 상위 후보는 research_keyword로 검색 추이·포화도를 확인한다.",
      "초안 쓰기: 먼저 list_drafts(keyword)로 같은 키워드의 초안이 있는지 확인해 있으면 사용자에게 알린다. get_writing_rules(task=writing, platform, type)로 규칙을 읽고, get_writing_brief로 브리프를 받아, 규칙대로 웹 검색으로 사실을 확인하며 쓴다. 이때 list_drafts가 보여 준 최근 초안들의 제목·도입 문장과 같은 패턴을 피한다. 사용자가 원하면 save_draft로 저장하고 open_web(page=drafts)으로 보여준다.",
      "초안 고치기: read_draft로 읽고 고친 뒤 update_draft로 같은 파일에 저장한다 (이전 버전은 자동 보관). 새 초안은 save_draft로 만든다.",
      "글 유형: 상품·서비스 사용기는 review, 맛집·여행지·시설 방문기는 place, 그 밖에는 info. 리뷰 상품의 쇼핑 트렌드는 get_shopping_trend, 장소 정보는 search_places로 확인한다.",
      "사용자가 플랫폼을 말하지 않으면 티스토리(tistory)로 쓴다.",
      "일정 관리: 할 일·일정·스케줄 이야기는 list_tasks / add_task / update_task / complete_task를 쓴다. 사용자가 한 말을 add_task의 text에 그대로 넣으면 날짜·시간·태그·프로젝트를 해석한다. 블로그 글감을 일정으로 잡아 달라고 하면 add_task에 link로 키워드 분석·초안 주소를 함께 넣는다.",
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
      "블로그 글감 선정(planning) 또는 초안 작성(writing) 규칙을 돌려준다. 글감을 고르거나 초안을 쓰기 전에 반드시 먼저 호출해 규칙을 따른다. writing은 platform과 type이 필요하다.",
    inputSchema: {
      task: z.enum(["planning", "writing"]).describe("planning: 글감 선정, writing: 초안 작성"),
      platform: platformSchema.optional(),
      type: typeSchema.optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ task, platform = "tistory", type = "info" }) => {
    try {
      return text(task === "planning" ? await planningRules() : await writingRules(platform, type));
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
      "키워드·플랫폼·유형으로 [글쓰기 브리프]를 만든다. 검색량·경쟁도·연관 키워드에 더해, 키가 있으면 검색 추이·블로그 문서 수(포화도)·실제 질문(지식iN)·상위 블로그 글·카페 글(리뷰·장소)·장소 정보(장소)가 들어간다. 초안 작성의 입력으로 쓴다.",
    inputSchema: {
      keyword: z.string().min(1).describe("글을 쓸 키워드"),
      platform: platformSchema.default("tistory"),
      type: typeSchema.default("info"),
      structure: structureSchema,
      note: z.string().optional().describe("글 각도, 직접 경험 메모 등 참고 사항"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ keyword, platform, type, structure, note }) => {
    try {
      return text(await buildWritingBrief(briefSources(), keyword, platform, { type, structure, note }));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "research_keyword",
  {
    title: "키워드 조사",
    description:
      "키워드의 24개월 네이버 검색 추이(시즌·급등 이력·상승세 등 해석 포함), 블로그 문서 수와 포화도(문서 수 ÷ 월간 검색량), 지식iN 질문, 상위 블로그 글, 최신 뉴스, 카페 글을 한 번에 조사한다. 글감이 오래 검색될지, 경쟁이 심한지 판단할 때 쓴다.",
    inputSchema: { keyword: z.string().min(1).describe("조사할 키워드") },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ keyword }) => {
    const hub = hubConfigFromEnv();
    if (!hub) return failure(HUB_MISSING);
    try {
      const searchAd = searchAdConfigFromEnv();
      const [research, insight] = await Promise.all([
        researchKeyword(hub, keyword),
        searchAd ? fetchKeywordInsight(searchAd, keyword).catch(() => null) : null,
      ]);
      const monthly = insight?.self?.totalSearches;
      const saturation = computeSaturation(monthly, research.blog?.total);
      const { trend, blog, kin, news, cafe, errors } = research;

      const lines = [`# ${keyword} 조사`];
      lines.push(`- 월간 검색량: ${monthly === undefined ? "조회 안 됨" : formatSearchCount(monthly)}`);
      if (trend) {
        lines.push(`- 검색 추이: ${trend.label} — ${trend.reason}`);
        lines.push(`  월별 상대값(최고=100): ${trend.points.map((p) => `${p.month} ${p.ratio}`).join(", ")}`);
      }
      if (blog) {
        lines.push(
          `- 블로그 문서 수: ${blog.total.toLocaleString("ko-KR")}${saturation ? ` (검색량의 ${saturation.ratio}배 · 포화도 ${saturation.level})` : ""}`,
        );
      }
      if (kin?.length) lines.push("", "## 실제 질문 (지식iN)", ...kin.map((q) => `- ${q.title}`));
      if (blog?.items.length) lines.push("", "## 상위 블로그 글", ...blog.items.map((b) => `- ${b.title} — ${b.blogger} (${b.date}) ${b.link}`));
      if (news?.length) lines.push("", "## 최신 뉴스", ...news.map((n) => `- ${n.title} (${n.date.slice(0, 10)}) ${n.link}`));
      if (cafe?.length) lines.push("", "## 카페 글", ...cafe.map((c) => `- ${c.title} — ${c.cafe}`));
      const failed = Object.entries(errors);
      if (failed.length) lines.push("", "## 조회 실패", ...failed.map(([name, message]) => `- ${name}: ${message}`));
      return text(lines.join("\n"));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "search_places",
  {
    title: "장소 검색",
    description: "네이버 지역 검색으로 장소의 이름·분류·주소·링크를 최대 5개 찾는다. 장소 유형 글에서 정확한 장소 정보를 확인할 때 쓴다. 지역명과 함께 검색하면 정확하다 (예: '성수동 브런치').",
    inputSchema: { query: z.string().min(1).describe("검색어 (지역명 + 장소 이름이나 업종)") },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ query }) => {
    const hub = hubConfigFromEnv();
    if (!hub) return failure(HUB_MISSING);
    try {
      const places = await searchPlaces(hub, query);
      if (!places.length) return text(`"${query}"로 찾은 장소가 없습니다.`);
      return text(
        [
          "| 이름 | 분류 | 도로명 주소 | 지번 주소 | 링크 |",
          "|---|---|---|---|---|",
          ...places.map((p) => `| ${p.title} | ${p.category} | ${p.roadAddress} | ${p.address} | ${p.link || "-"} |`),
        ].join("\n"),
      );
    } catch (e) {
      return failure(e);
    }
  },
);

const categoryCodes = Object.keys(SHOPPING_CATEGORIES) as [ShoppingCategory, ...ShoppingCategory[]];

server.registerTool(
  "get_shopping_trend",
  {
    title: "쇼핑 트렌드 조회",
    description: `네이버쇼핑 분야 안에서 키워드의 24개월 검색 클릭 추이를 조회한다. 리뷰 글의 상품이 지금 많이 찾는지, 시즌이 있는지 판단할 때 쓴다. 분야 코드: ${Object.entries(
      SHOPPING_CATEGORIES,
    )
      .map(([code, name]) => `${code}=${name}`)
      .join(", ")}`,
    inputSchema: {
      keyword: z.string().min(1).describe("상품 키워드 (예: 에어프라이어)"),
      category: z.enum(categoryCodes).describe("쇼핑 분야 코드"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ keyword, category }) => {
    const hub = hubConfigFromEnv();
    if (!hub) return failure(HUB_MISSING);
    try {
      const trend = summarizeTrend(await fetchShoppingTrend(hub, keyword, category));
      return text(
        [
          `# ${keyword} 쇼핑 트렌드 (${SHOPPING_CATEGORIES[category]})`,
          `- 해석: ${trend.label} — ${trend.reason}`,
          `- 월별 상대값(최고=100): ${trend.points.map((p) => `${p.month} ${p.ratio}`).join(", ")}`,
        ].join("\n"),
      );
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
      return text(
        `저장했습니다: ${file}\n웹에서 미리보기·복사하려면 open_web(page="drafts", draft="${path.basename(file)}")을 호출하세요.`,
      );
    } catch (e) {
      return failure(e);
    }
  },
);

const draftFileSchema = z.string().min(1).describe("초안 파일 이름 (list_drafts·save_draft가 돌려준 이름, 예: 2026-10-30-국민연금-수령나이-tistory.md)");

server.registerTool(
  "list_drafts",
  {
    title: "초안 목록",
    description:
      "drafts/의 초안을 최근 수정 순으로 보여준다. 파일 이름·날짜·키워드·플랫폼·추천 제목·도입 첫 문장·사람이 채울 자리 수를 포함한다. keyword를 주면 같은 키워드(공백·구두점 무시)로 쓴 초안만 보여 주므로, 새 글을 쓰기 전에 이미 쓴 주제인지 확인할 때 쓴다.",
    inputSchema: {
      keyword: z.string().optional().describe("이 키워드로 쓴 초안만 (생략하면 전체)"),
      limit: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ keyword, limit }) => {
    try {
      const all = await listDrafts(DRAFTS_DIR);
      const drafts = (keyword ? draftsForKeyword(all, keyword) : all).slice(0, limit);
      if (drafts.length === 0) return text(keyword ? `키워드 "${keyword}"의 초안이 없습니다.` : "초안이 없습니다.");

      const rows = await Promise.all(
        drafts.map(async (d) => {
          const parsed = parseDraft((await readDraftFile(DRAFTS_DIR, d.file)) ?? "");
          const title = parsed.titles.find((t) => t.recommended)?.text ?? parsed.titles[0]?.text ?? "-";
          const count = (type: string) => parsed.markers.filter((m) => m.type === type).length;
          const cell = (v: string) => v.replace(/\|/g, "/");
          return `| ${d.file} | ${d.platform ? PLATFORM_LABELS[d.platform] : "-"} | ${cell(title)} | ${cell(draftOpening(parsed.body) ?? "-")} | 이미지 ${count("image")} · 직접 작성 ${count("write")} · 확인 ${count("check")} |`;
        }),
      );
      return text(
        [
          `${keyword ? `"${keyword}" 초안` : "최근 초안"} ${drafts.length}개 (전체 ${all.length}개)`,
          "| 파일 | 플랫폼 | 추천 제목 | 도입 첫 문장 | 사람이 채울 자리 |",
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
  "read_draft",
  {
    title: "초안 읽기",
    description: "초안 파일 전체(마크다운)를 읽는다. 초안을 고치거나 검토할 때 쓴다.",
    inputSchema: { draft: draftFileSchema },
    annotations: { readOnlyHint: true },
  },
  async ({ draft }) => {
    const content = await readDraftFile(DRAFTS_DIR, path.basename(draft));
    return content === null ? failure(`초안을 찾을 수 없습니다: ${draft}. list_drafts로 파일 이름을 확인하세요.`) : text(content);
  },
);

server.registerTool(
  "update_draft",
  {
    title: "초안 고치기",
    description:
      "이미 있는 초안 파일을 고친 전체 내용으로 덮어쓴다. 이전 버전은 drafts/.history/에 자동 보관된다. 없는 파일은 만들지 않으므로 새 초안은 save_draft를 쓴다. 일부만 고쳐도 content에는 초안 전체를 넣는다.",
    inputSchema: {
      draft: draftFileSchema,
      content: z.string().min(1).describe("고친 초안 전체 (마크다운)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  async ({ draft, content }) => {
    try {
      const result = await updateDraftFile(DRAFTS_DIR, path.basename(draft), content);
      if (!result) return failure(`초안을 찾을 수 없습니다: ${draft}. 새 초안이면 save_draft를 쓰세요.`);
      return text(`고쳤습니다: ${result.file}\n이전 버전: ${result.backup}\n웹에서 보려면 open_web(page="drafts", draft="${result.file}")`);
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "open_web",
  {
    title: "toolhub 웹 열기",
    description:
      "toolhub 웹 대시보드를 브라우저로 연다. 웹은 항상 main 브랜치의 최신 커밋으로 실행되며, 꺼져 있거나 옛 커밋이면 (재)시작한 뒤 연다. 사용자가 웹·화면·대시보드를 열어 달라고 하면 쓴다. 준비 중이라는 응답을 받으면 잠시 후 다시 호출한다.",
    inputSchema: {
      page: z
        .enum(["tasks", "live", "history", "keyword", "drafts", "thumbnail"])
        .default("tasks")
        .describe(
          "tasks: 일정 관리, live: 실시간 키워드, history: 키워드 기록, keyword: 키워드 분석, drafts: 초안(발행 도우미), thumbnail: 썸네일 만들기",
        ),
      view: z.enum(VIEWS).optional().describe("page=tasks일 때 보기: today(오늘), week(다음 7일), inbox(날짜 없음), all, done, board, calendar"),
      title: z.string().optional().describe("page=thumbnail일 때 미리 채울 제목 (*강조* 구문 가능)"),
      keyword: z.string().optional().describe("page=keyword일 때 분석할 키워드"),
      date: dateSchema.describe("page=history일 때 볼 날짜 (YYYY-MM-DD, 생략하면 오늘)"),
      draft: z.string().optional().describe("page=drafts일 때 열 초안 파일 이름 (save_draft가 돌려준 이름). 생략하면 초안 목록"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async ({ page, view, keyword, date, draft, title }) => {
    const q = (name: string, value: string | undefined) => (value ? `?${name}=${encodeURIComponent(value)}` : "");
    const pagePath = {
      tasks: `/tasks${q("view", view)}`,
      live: "/blog",
      history: `/blog/history${q("date", date)}`,
      keyword: `/blog/keyword${q("q", keyword)}`,
      drafts: draft ? `/blog/drafts/view${q("file", path.basename(draft))}` : "/blog/drafts",
      thumbnail: `/blog/thumbnail${q("title", title)}`,
    }[page];
    try {
      // 처음 실행이나 의존성이 바뀐 커밋은 npm install 때문에 오래 걸린다. 준비는 뒤에서 계속되고, 다시 호출하면 이어받는다
      const opening = openWeb(pagePath);
      const result = await Promise.race([opening, sleep(TOOL_SOFT_TIMEOUT_MS).then(() => null)]);
      if (!result) {
        opening.catch(() => {});
        return text(
          `main 최신 커밋으로 웹 실행 환경을 준비하고 있습니다 (의존성 설치 중일 수 있음). 30초~1분 뒤 다시 open_web을 호출하세요. 진행 로그: ${WEB_LOG_FILE}`,
        );
      }
      const { url, commit, action } = result;
      const what = { none: "", started: "웹 서버를 시작하고 ", restarted: "새 커밋으로 웹 서버를 재시작하고 " }[action];
      return text(`${what}브라우저로 열었습니다: ${url}\n실행 중인 버전: main ${commit.short} ${commit.subject}`);
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "stop_web",
  {
    title: "toolhub 웹 서버 끄기",
    description: "open_web으로 시작한 toolhub 웹 서버를 끈다. 터미널에서 직접 실행한 웹 서버는 끄지 않는다.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async () => {
    try {
      const { stopped } = await stopWeb();
      return text(stopped ? `웹 서버(${WEB_URL})를 껐습니다.` : "open_web으로 켠 웹 서버가 없습니다.");
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerPrompt(
  "blog_draft",
  {
    title: "블로그 초안 작성",
    description: "키워드·플랫폼·유형을 받아 규칙과 브리프를 담은 초안 작성 요청을 만든다.",
    argsSchema: {
      keyword: z.string().describe("글을 쓸 키워드"),
      platform: z.string().optional().describe("tistory | blogger | naver (기본 tistory)"),
      type: z.string().optional().describe("info(정보) | review(리뷰) | place(장소) (기본 info)"),
      structure: z.string().optional().describe("구성 A | B | C | D (생략하면 무작위)"),
    },
  },
  async ({ keyword, platform, type, structure }) => {
    const target: Platform = PLATFORMS.find((p) => p === platform) ?? "tistory";
    const writingType: WritingType = WRITING_TYPES.find((t) => t === type) ?? "info";
    const pickedStructure = STRUCTURES.find((s) => s === structure?.toUpperCase());
    const [rules, brief] = await Promise.all([
      writingRules(target, writingType),
      buildWritingBrief(briefSources(), keyword, target, { type: writingType, structure: pickedStructure }),
    ]);
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `아래 규칙에 따라 ${PLATFORM_LABELS[target]}용 ${WRITING_TYPE_LABELS[writingType]} 블로그 초안을 작성해 주세요. 사실은 웹 검색으로 확인하고, 다 쓰면 save_draft로 저장해 주세요.\n\n${rules}\n\n---\n\n${brief}`,
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

registerTaskTools(server, DATA_DIR);

await server.connect(new StdioServerTransport());
console.error(`toolhub MCP 서버 시작 (data: ${DATA_DIR})`);
