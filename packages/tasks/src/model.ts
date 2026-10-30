/**
 * 일정(할 일) 데이터 모델과 순수 로직. Node 전용 모듈을 쓰지 않아 브라우저에서도 쓴다.
 * 날짜는 모두 KST 기준 "YYYY-MM-DD", 시간은 "HH:mm".
 */

export const STATUSES = ["todo", "in_progress", "done", "canceled"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = {
  todo: "할 일",
  in_progress: "진행 중",
  done: "완료",
  canceled: "취소",
};

/** Linear식 우선순위. 0 없음, 1 긴급, 2 높음, 3 보통, 4 낮음 */
export const PRIORITIES = [1, 2, 3, 4, 0] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { 0: "없음", 1: "긴급", 2: "높음", 3: "보통", 4: "낮음" };

export const REPEATS = ["daily", "weekly", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABELS: Record<Repeat, string> = { daily: "매일", weekly: "매주", monthly: "매월", yearly: "매년" };

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  /** 1부터 늘어나는 번호. 화면에는 #12처럼 보인다 */
  id: number;
  title: string;
  notes: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  projectId: string | null;
  labels: string[];
  repeat: Repeat | null;
  subtasks: Subtask[];
  /** 관련 링크 (초안, 키워드 분석 등) */
  link: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface TaskInput {
  title: string;
  notes?: string;
  status?: Status;
  priority?: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
  projectId?: string | null;
  labels?: string[];
  repeat?: Repeat | null;
  subtasks?: Subtask[];
  link?: string | null;
}

export type TaskPatch = Partial<Omit<TaskInput, "title">> & { title?: string };

export interface TaskStore {
  nextId: number;
  tasks: Task[];
  projects: Project[];
}

export const PROJECT_COLORS = ["#5e6ad2", "#26b5ce", "#4cb782", "#f2c94c", "#f2994a", "#eb5757", "#bb87fc", "#95a2b3"];

export const isOpen = (task: Task) => task.status === "todo" || task.status === "in_progress";

// ── 날짜 ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** KST 오늘 (YYYY-MM-DD) */
export function todayKst(now = new Date()) {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

export function diffDays(from: string, to: string) {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

/** 0 = 일요일 */
export const weekday = (date: string) => toUtc(date).getUTCDay();
export const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function addMonths(date: string, months: number) {
  const d = toUtc(date);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUtc(target);
}

export function nextRepeatDate(date: string, repeat: Repeat) {
  switch (repeat) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addMonths(date, 12);
  }
}

/** "오늘", "내일", "10/31 (금)" 같은 짧은 표시 */
export function formatDue(date: string, time: string | null, today: string) {
  const diff = diffDays(today, date);
  const day =
    diff === 0
      ? "오늘"
      : diff === 1
        ? "내일"
        : diff === -1
          ? "어제"
          : `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} (${WEEKDAY_NAMES[weekday(date)]})`;
  return time ? `${day} ${time}` : day;
}

// ── 목록 묶기 ─────────────────────────────────────────────────────

export type GroupKey = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodate";
export const GROUP_LABELS: Record<GroupKey, string> = {
  overdue: "지난 일정",
  today: "오늘",
  tomorrow: "내일",
  week: "7일 안",
  later: "나중",
  nodate: "날짜 없음",
};

export function groupOf(task: Task, today: string): GroupKey {
  if (!task.dueDate) return "nodate";
  const diff = diffDays(today, task.dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

/** 마감일 → 시간 → 우선순위(긴급 먼저, 없음은 마지막) → 번호 */
export function compareTasks(a: Task, b: Task) {
  const due = (t: Task) => `${t.dueDate ?? "9999-99-99"} ${t.dueTime ?? "99:99"}`;
  const rank = (p: Priority) => (p === 0 ? 9 : p);
  return due(a).localeCompare(due(b)) || rank(a.priority) - rank(b.priority) || a.id - b.id;
}

export const VIEWS = ["today", "week", "inbox", "all", "done", "board", "calendar"] as const;
export type View = (typeof VIEWS)[number];
export const VIEW_LABELS: Record<View, string> = {
  today: "오늘",
  week: "다음 7일",
  inbox: "날짜 없음",
  all: "전체",
  done: "완료됨",
  board: "보드",
  calendar: "캘린더",
};

export interface TaskFilter {
  view?: View;
  projectId?: string | null;
  label?: string;
  query?: string;
}

/** 보기·프로젝트·태그·검색어로 거른다. 오늘 보기에는 지난 일정도 포함한다 */
export function filterTasks(tasks: Task[], { view = "all", projectId, label, query }: TaskFilter, today: string) {
  const q = query?.trim().toLowerCase();
  return tasks
    .filter((t) => {
      if (projectId !== undefined && t.projectId !== projectId) return false;
      if (label && !t.labels.includes(label)) return false;
      if (q && !`${t.title} ${t.notes} ${t.labels.join(" ")}`.toLowerCase().includes(q)) return false;
      switch (view) {
        case "today":
          return isOpen(t) && !!t.dueDate && diffDays(today, t.dueDate) <= 0;
        case "week":
          return isOpen(t) && !!t.dueDate && diffDays(today, t.dueDate) <= 7;
        case "inbox":
          return isOpen(t) && !t.dueDate;
        case "done":
          return !isOpen(t);
        case "board":
        case "calendar":
          return true;
        default:
          return isOpen(t);
      }
    })
    .sort(view === "done" ? (a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt) : compareTasks);
}

// ── 빠른 추가 (자연어) ────────────────────────────────────────────

export interface QuickAddResult {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  labels: string[];
  projectName: string | null;
  repeat: Repeat | null;
}

const WEEKDAY_PATTERN = "(월|화|수|목|금|토|일)요일";
const PRIORITY_WORDS: Record<string, Priority> = { 긴급: 1, 높음: 2, 보통: 3, 낮음: 4, "1": 1, "2": 2, "3": 3, "4": 4 };

/**
 * "내일 오후 3시 국민연금 글 발행 #블로그 @블로그운영 !높음 매주" 같은 입력을 해석한다.
 * - 날짜: 오늘·내일·모레, (이번 주·다음 주) 월요일, 10월 31일, 10/31, 2026-11-03, 3일 뒤
 * - 시간: 오전 9시, 오후 3시 30분, 15시, 15:30
 * - 우선순위: !긴급 !높음 !보통 !낮음 또는 !1~!4
 * - 태그: #태그   프로젝트: @프로젝트   반복: 매일·매주·매월(매달)·매년
 * 해석한 부분은 제목에서 뺀다.
 * projectNames: 이미 있는 프로젝트 이름. "@블로그 운영"처럼 띄어쓰기가 있는 이름도 맞추기 위해 먼저 찾는다.
 */
export function parseQuickAdd(input: string, today: string, projectNames: string[] = []): QuickAddResult {
  let text = ` ${input.trim()} `;
  const take = (pattern: RegExp) => {
    const match = pattern.exec(text);
    if (match) text = text.replace(match[0], " ");
    return match;
  };

  // 있는 프로젝트 이름을 긴 것부터 맞춰 보고, 없으면 띄어쓰기 전까지를 새 프로젝트 이름으로 본다
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let projectName: string | null = null;
  for (const name of [...projectNames].sort((a, b) => b.length - a.length)) {
    if (take(new RegExp(`\\s@${escape(name)}(?=\\s)`, "i"))) {
      projectName = name;
      break;
    }
  }
  projectName ??= take(/\s@([^\s#@!]+)/)?.[1] ?? null;

  const labels: string[] = [];
  for (let m = take(/\s#([^\s#@!]+)/); m; m = take(/\s#([^\s#@!]+)/)) labels.push(m[1]!);
  const priorityWord = take(/\s!(긴급|높음|보통|낮음|[1-4])(?=\s)/)?.[1];
  const priority: Priority = priorityWord ? PRIORITY_WORDS[priorityWord]! : 0;

  const repeatWord = take(/\s(매일|매주|매월|매달|매년)(?=\s)/)?.[1];
  const repeat: Repeat | null = repeatWord
    ? ({ 매일: "daily", 매주: "weekly", 매월: "monthly", 매달: "monthly", 매년: "yearly" } as const)[repeatWord as "매일"]
    : null;

  let dueDate: string | null = null;
  let m: RegExpExecArray | null;
  const year = Number(today.slice(0, 4));
  if ((m = take(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/))) {
    dueDate = `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  } else if ((m = take(/\s(\d{1,2})월\s?(\d{1,2})일(?=\s)/)) || (m = take(/\s(\d{1,2})\/(\d{1,2})(?=\s)/))) {
    const candidate = `${year}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
    // 이미 지난 날짜면 내년으로 본다
    dueDate = diffDays(today, candidate) < 0 ? `${year + 1}${candidate.slice(4)}` : candidate;
  } else if ((m = take(/\s(오늘|내일|모레)(?=\s)/))) {
    dueDate = addDays(today, { 오늘: 0, 내일: 1, 모레: 2 }[m[1] as "오늘"]);
  } else if ((m = take(/\s(\d{1,3})일\s?(?:뒤|후)(?=\s)/))) {
    dueDate = addDays(today, Number(m[1]));
  } else if ((m = take(new RegExp(`\\s(?:(이번\\s?주|다음\\s?주)\\s?)?${WEEKDAY_PATTERN}(?=\\s)`)))) {
    const target = WEEKDAY_NAMES.indexOf(m[2]!);
    const current = weekday(today);
    if (m[1]?.startsWith("다음")) {
      // 다음 주 = 이번 주 월요일 기준 +7일 주간
      const monday = addDays(today, -((current + 6) % 7));
      dueDate = addDays(monday, 7 + ((target + 6) % 7));
    } else if (m[1]?.startsWith("이번")) {
      const monday = addDays(today, -((current + 6) % 7));
      dueDate = addDays(monday, (target + 6) % 7);
    } else {
      // 요일만 쓰면 오늘 이후 가장 가까운 그 요일 (오늘이면 오늘)
      dueDate = addDays(today, (target - current + 7) % 7);
    }
  } else if ((m = take(/\s(이번\s?주말|주말)(?=\s)/))) {
    dueDate = addDays(today, (6 - weekday(today) + 7) % 7);
  } else if ((m = take(/\s다음\s?주(?=\s)/))) {
    dueDate = addDays(today, 7 - ((weekday(today) + 6) % 7));
  }

  let dueTime: string | null = null;
  if ((m = take(/\s(오전|오후|아침|저녁|밤)?\s?(\d{1,2})시(?:\s?(\d{1,2})분|\s?반)?(?=\s)/))) {
    let hour = Number(m[2]);
    if ((m[1] === "오후" || m[1] === "저녁" || m[1] === "밤") && hour < 12) hour += 12;
    if (m[1] === "오전" && hour === 12) hour = 0;
    const minute = m[0].includes("반") ? 30 : Number(m[3] ?? 0);
    dueTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  } else if ((m = take(/\s(\d{1,2}):(\d{2})(?=\s)/))) {
    dueTime = `${m[1]!.padStart(2, "0")}:${m[2]}`;
  }
  // 시간만 쓰고 날짜가 없으면 오늘
  if (dueTime && !dueDate) dueDate = today;
  // 반복인데 날짜가 없으면 오늘부터
  if (repeat && !dueDate) dueDate = today;

  return { title: text.replace(/\s+/g, " ").trim(), dueDate, dueTime, priority, labels, projectName, repeat };
}
