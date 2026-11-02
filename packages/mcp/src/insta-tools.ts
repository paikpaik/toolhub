/** 인스타그램 MCP 도구. 규칙은 docs/prompts/instagram/, 점검 로직은 @toolhub/insta (웹 /insta와 같음) */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beatSheet, checkHook, formatBeatSheet, formatCaptionLint, formatHookFormulas, lintCaption } from "@toolhub/insta";
import { z } from "zod";

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

const TASKS = ["reel", "caption", "carousel", "story", "comment", "repurpose"] as const;

export function registerInstaTools(server: McpServer, promptsDir: string) {
  const dir = path.join(promptsDir, "instagram");
  const read = async (file: string) => (await readFile(path.join(dir, file), "utf-8")).replace(/<!--[\s\S]*?-->\s*/g, "");

  server.registerTool(
    "get_insta_rules",
    {
      title: "인스타그램 작성 규칙",
      description:
        "인스타그램 릴스 대본·캡션·캐러셀(카드뉴스)·스토리·댓글/답글·블로그 글 재활용 규칙과 내 계정 정보(말투)를 가져온다. 인스타 콘텐츠를 쓰기 전에 반드시 읽는다. reel은 훅 공식 26가지가 함께 온다. 게시는 사람이 하며 자동 게시·댓글·DM은 하지 않는다.",
      inputSchema: {
        task: z
          .enum(TASKS)
          .describe("reel(릴스 대본), caption(캡션), carousel(캐러셀·한 장 요약 카드뉴스), story(스토리·링크 스티커), comment(남의 글 댓글·내 글 답글), repurpose(블로그 글 → 인스타 게시물 여러 개)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ task }) => {
      const parts = [await read("account.md"), await read(`${task}.md`)];
      if (task === "reel" || task === "repurpose") parts.push(formatHookFormulas());
      return text(parts.join("\n\n---\n\n"));
    },
  );

  server.registerTool(
    "check_reel_script",
    {
      title: "릴스 대본 점검",
      description:
        "릴스 대본(한 줄이 한 장면)을 한국어 음절 기준으로 시간을 어림해 초 단위 구성표를 만들고, 훅 3초 초과·4초 넘는 장면·구체적인 말 없는 줄 연속·되감기 없음·목표 길이 차이를 짚는다. hooks에 훅 후보를 넣으면 각각 점검한다(약한 훅 거르기용).",
      inputSchema: {
        script: z.string().optional().describe("대본. 한 줄이 한 장면"),
        hooks: z.array(z.string()).max(10).optional().describe("점검할 훅 후보 (말하는 첫 문장)"),
        target_seconds: z.number().min(5).max(180).optional().describe("목표 길이(초)"),
        syllables_per_second: z.number().min(3).max(9).optional().describe("말하는 속도(초당 음절). 기본 6.5"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ script, hooks, target_seconds, syllables_per_second }) => {
      const sections: string[] = [];
      if (hooks?.length) {
        sections.push(
          "훅 점검 (약한 훅을 거르는 용도 — 괜찮은 훅 둘 중 무엇이 잘될지는 고르지 못함)",
          ...hooks.map((h) => {
            const r = checkHook(h, syllables_per_second);
            return [`[${r.verdict}] ${r.text} (약 ${r.seconds}초)`, ...r.checks.map((c) => `  ${c.ok ? "✓" : "✗"} ${c.label}: ${c.detail}`)].join("\n");
          }),
        );
      }
      if (script?.trim()) sections.push(formatBeatSheet(beatSheet(script, { target: target_seconds, sps: syllables_per_second }), target_seconds));
      return text(sections.length ? sections.join("\n\n") : "점검할 대본이나 훅을 넣어 주세요.");
    },
  );

  server.registerTool(
    "check_caption",
    {
      title: "인스타 캡션 점검",
      description:
        "인스타그램 캡션을 점검한다: 피드에서 '더 보기' 전에 보이는 부분, 첫 줄, 해시태그 5개 제한(한글 태그 포함), 눌리지 않는 링크, 요청(저장·댓글·프로필 링크 등) 개수, 쿠팡 파트너스 대가성 문구, 검색어 포함 여부.",
      inputSchema: {
        caption: z.string().min(1).describe("캡션 전체"),
        keywords: z.array(z.string()).max(5).optional().describe("문장 속에 들어 있어야 할 검색어 (예: 연말정산 미리보기)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ caption, keywords }) => text(formatCaptionLint(lintCaption(caption, { keywords }))),
  );
}
