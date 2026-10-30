/** 일정 관리 MCP 도구. 웹(/tasks)과 같은 data/tasks.json을 고친다 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createProject,
  createTask,
  deleteTask,
  filterTasks,
  formatDue,
  GROUP_LABELS,
  groupOf,
  PRIORITY_LABELS,
  quickAddTask,
  readStore,
  REPEAT_LABELS,
  REPEATS,
  resolveProject,
  STATUS_LABELS,
  STATUSES,
  todayKst,
  updateTask,
  type GroupKey,
  type Priority,
  type Project,
  type Task,
  type TaskPatch,
} from "@toolhub/tasks";
import { z } from "zod";

const PRIORITY_INPUT = { urgent: 1, high: 2, medium: 3, low: 4, none: 0 } as const satisfies Record<string, Priority>;
const priorityInput = z
  .enum(["urgent", "high", "medium", "low", "none"])
  .describe("우선순위: urgent(긴급), high(높음), medium(보통), low(낮음), none(없음)");
const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD (KST)");
const timeInput = z.string().regex(/^\d{2}:\d{2}$/).describe("HH:mm (24시간)");

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (e: unknown) => ({
  content: [{ type: "text" as const, text: `오류: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

const STATUS_MARK = { todo: "○", in_progress: "◐", done: "●", canceled: "✕" } as const;

/** "#12 ○ 제목 · 내일 15:00 · 우선순위 높음 · @프로젝트 · #태그 · 매주 · 하위 1/3" */
function formatTask(task: Task, projects: Project[], today: string) {
  const project = projects.find((p) => p.id === task.projectId);
  const parts = [
    `#${task.id} ${STATUS_MARK[task.status]} ${task.title}`,
    task.dueDate && formatDue(task.dueDate, task.dueTime, today),
    task.priority && `우선순위 ${PRIORITY_LABELS[task.priority]}`,
    project && `@${project.name}`,
    task.labels.length && task.labels.map((l) => `#${l}`).join(" "),
    task.repeat && REPEAT_LABELS[task.repeat],
    task.subtasks.length && `하위 ${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}`,
    task.status === "in_progress" && "진행 중",
  ].filter(Boolean);
  return parts.join(" · ") + (task.notes ? `\n    메모: ${task.notes.replace(/\s+/g, " ").slice(0, 120)}` : "");
}

async function projectIdFor(dataDir: string, name: string | undefined) {
  if (!name) return undefined;
  return (await resolveProject(dataDir, name))?.id ?? (await createProject(dataDir, name)).id;
}

const GROUP_ORDER: GroupKey[] = ["overdue", "today", "tomorrow", "week", "later", "nodate"];

export function registerTaskTools(server: McpServer, dataDir: string) {
  server.registerTool(
    "list_tasks",
    {
      title: "할 일 목록",
      description:
        "일정 관리의 할 일을 보여준다. view: today(오늘 + 지난 일정), week(다음 7일), inbox(날짜 없음), all(남은 할 일 전체), done(완료·취소). 프로젝트·태그·검색어로 거를 수 있다. 결과 끝에 프로젝트 목록도 붙는다. 할 일 번호(#12)로 update_task·complete_task를 호출한다.",
      inputSchema: {
        view: z.enum(["today", "week", "inbox", "all", "done"]).default("today"),
        project: z.string().optional().describe("프로젝트 이름"),
        label: z.string().optional().describe("태그 (# 없이)"),
        query: z.string().optional().describe("제목·메모 검색어"),
        limit: z.number().int().min(1).max(200).default(50),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ view, project, label, query, limit }) => {
      try {
        const store = await readStore(dataDir);
        const today = todayKst();
        let projectId: string | undefined;
        if (project) {
          const found = await resolveProject(dataDir, project);
          if (!found) return failure(`"${project}" 프로젝트가 없습니다. 있는 프로젝트: ${store.projects.map((p) => p.name).join(", ") || "없음"}`);
          projectId = found.id;
        }
        const tasks = filterTasks(store.tasks, { view, projectId, label, query }, today).slice(0, limit);
        const lines = [`오늘은 ${today}. ${view} 보기 ${tasks.length}개`];
        if (view === "done" || view === "inbox") lines.push(...tasks.map((t) => `- ${formatTask(t, store.projects, today)}`));
        else
          for (const key of GROUP_ORDER) {
            const items = tasks.filter((t) => groupOf(t, today) === key);
            if (items.length) lines.push("", `## ${GROUP_LABELS[key]} (${items.length})`, ...items.map((t) => `- ${formatTask(t, store.projects, today)}`));
          }
        if (!tasks.length) lines.push("(할 일 없음)");
        lines.push("", `프로젝트: ${store.projects.map((p) => p.name).join(", ") || "없음"}`);
        return text(lines.join("\n"));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "add_task",
    {
      title: "할 일 추가",
      description:
        "할 일을 추가한다. 사용자가 한 말을 그대로 text에 넣으면 날짜·시간·우선순위·태그·프로젝트·반복을 해석한다 (예: '내일 오후 3시 국민연금 글 발행 #블로그 @블로그운영 !높음 매주'). 해석이 애매하면 text 대신 title과 각 필드를 직접 지정한다. 없는 프로젝트 이름이면 새로 만든다.",
      inputSchema: {
        text: z.string().optional().describe("자연어 한 줄 (날짜·시간·#태그·@프로젝트·!우선순위·매주 등 포함 가능)"),
        title: z.string().optional().describe("text 대신 쓸 제목"),
        dueDate: dateInput.optional(),
        dueTime: timeInput.optional(),
        priority: priorityInput.optional(),
        project: z.string().optional().describe("프로젝트 이름 (없으면 새로 만듦)"),
        labels: z.array(z.string()).optional().describe("태그 목록 (# 없이)"),
        repeat: z.enum(REPEATS).optional().describe("반복: daily, weekly, monthly, yearly (마감일 필요)"),
        notes: z.string().optional(),
        link: z.string().optional().describe("관련 링크 (초안·키워드 분석 주소 등)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        if (!args.text && !args.title) return failure("text 또는 title이 필요합니다.");
        const projectId = await projectIdFor(dataDir, args.project);
        const fields: TaskPatch = {
          ...(args.dueDate && { dueDate: args.dueDate }),
          ...(args.dueTime && { dueTime: args.dueTime }),
          ...(args.priority && { priority: PRIORITY_INPUT[args.priority] }),
          ...(projectId && { projectId }),
          ...(args.labels && { labels: args.labels.map((l) => l.replace(/^#/, "")) }),
          ...(args.repeat && { repeat: args.repeat }),
          ...(args.notes && { notes: args.notes }),
          ...(args.link && { link: args.link }),
        };
        const task = args.text
          ? await quickAddTask(dataDir, args.text, fields)
          : await createTask(dataDir, { ...fields, title: args.title! });
        const store = await readStore(dataDir);
        return text(`추가했습니다: ${formatTask(task, store.projects, todayKst())}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "할 일 고치기",
      description:
        "할 일 번호로 제목·상태·우선순위·마감일·시간·프로젝트·태그·반복·메모·링크를 바꾸고 하위 할 일을 추가한다. 바꿀 항목만 넣는다. 마감일을 지우려면 dueDate에 null. 반복 할 일을 done으로 바꾸면 다음 회차가 자동으로 생긴다.",
      inputSchema: {
        id: z.number().int().describe("할 일 번호 (#12면 12)"),
        title: z.string().optional(),
        status: z.enum(STATUSES).optional().describe(`상태: ${STATUSES.map((s) => `${s}(${STATUS_LABELS[s]})`).join(", ")}`),
        priority: priorityInput.optional(),
        dueDate: dateInput.nullable().optional(),
        dueTime: timeInput.nullable().optional(),
        project: z.string().nullable().optional().describe("프로젝트 이름 (null이면 프로젝트 없음, 없는 이름이면 새로 만듦)"),
        labels: z.array(z.string()).optional().describe("태그 전체 목록 (기존 태그를 이 목록으로 바꿈)"),
        repeat: z.enum(REPEATS).nullable().optional(),
        notes: z.string().optional(),
        link: z.string().nullable().optional(),
        addSubtasks: z.array(z.string()).optional().describe("추가할 하위 할 일"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, project, priority, addSubtasks, labels, ...rest }) => {
      try {
        const patch: TaskPatch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
        if (priority) patch.priority = PRIORITY_INPUT[priority];
        if (labels) patch.labels = labels.map((l) => l.replace(/^#/, ""));
        if (project !== undefined) patch.projectId = project === null ? null : ((await projectIdFor(dataDir, project)) ?? null);
        if (addSubtasks?.length) {
          const current = (await readStore(dataDir)).tasks.find((t) => t.id === id);
          if (!current) return failure(`#${id} 할 일을 찾을 수 없습니다.`);
          patch.subtasks = [...current.subtasks, ...addSubtasks.map((t) => ({ id: crypto.randomUUID().slice(0, 8), text: t, done: false }))];
        }
        const { task, next } = await updateTask(dataDir, id, patch);
        const store = await readStore(dataDir);
        const today = todayKst();
        return text(
          `고쳤습니다: ${formatTask(task, store.projects, today)}` + (next ? `\n반복 다음 회차: ${formatTask(next, store.projects, today)}` : ""),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "complete_task",
    {
      title: "할 일 완료",
      description: "할 일을 완료로 표시한다. 반복 할 일이면 다음 회차가 자동으로 생긴다.",
      inputSchema: { id: z.number().int().describe("할 일 번호") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id }) => {
      try {
        const { task, next } = await updateTask(dataDir, id, { status: "done" });
        const store = await readStore(dataDir);
        const today = todayKst();
        return text(`완료: ${formatTask(task, store.projects, today)}` + (next ? `\n다음 회차: ${formatTask(next, store.projects, today)}` : ""));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "할 일 삭제",
      description: "할 일을 완전히 지운다 (되돌릴 수 없음). 끝낸 일은 지우지 말고 complete_task를 쓴다. 사용자가 삭제를 분명히 원할 때만 쓴다.",
      inputSchema: { id: z.number().int().describe("할 일 번호") },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ id }) => {
      try {
        const task = await deleteTask(dataDir, id);
        return text(`삭제했습니다: #${task.id} ${task.title}`);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "add_project",
    {
      title: "프로젝트 추가",
      description: "일정 관리에 프로젝트를 만든다. 같은 이름이 있으면 그것을 돌려준다.",
      inputSchema: {
        name: z.string().min(1),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("색 (#5e6ad2 형식, 생략하면 자동)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ name, color }) => {
      try {
        const project = await createProject(dataDir, name, color);
        return text(`프로젝트: ${project.name} (${project.color})`);
      } catch (e) {
        return failure(e);
      }
    },
  );
}
