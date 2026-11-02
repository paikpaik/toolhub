/**
 * 덩어리 기록 모델 (브라우저에서도 쓰므로 파일 접근 없음, 저장은 chunks-store.ts).
 * - 하루에 "덩어리"(3~4시간 한 가지 일에 집중) 2개를 기록한다. 하루는 새벽 5시에 바뀐다
 * - 주간 목표는 그룹(공방/집/SNS…)별로 모으고 요일(월~일)에 배정한다. 한 주는 월요일 시작
 * - 덩어리에 메모와 그룹을 적으면 그 주 보드의 해당 요일에 카드가 자동으로 생긴다
 *
 * 저장 문서 (data/chunks.json에 "문서 id → 데이터")
 * - YYYY-MM-DD: { b1, b2, n1, n2, g1, g2, l1, l2 } 덩어리 완료·메모·그룹 id·연결된 목표 id
 * - w-<월요일 YYYY-MM-DD>: { goals: [{ id, t, g, d, done }] } d는 0~6 = 월~일, -1 = 요일 미배정
 * - cfg: { groups: [{ id, name, c }] } c는 GROUP_COLORS 번호. 없으면 DEFAULT_GROUPS
 */

export interface ChunkDay {
  b1: boolean;
  b2: boolean;
  n1: string;
  n2: string;
  g1: string;
  g2: string;
  l1: string;
  l2: string;
}

export interface WeekGoal {
  id: string;
  t: string;
  g: string;
  /** 0~6 = 월~일, -1 = 요일 미배정 */
  d: number;
  done: boolean;
}

export interface ChunkGroup {
  id: string;
  name: string;
  /** GROUP_COLORS 번호 */
  c: number;
}

export interface ChunkState {
  days: Record<string, ChunkDay>;
  /** 월요일 날짜 → 그 주 목표 */
  weeks: Record<string, WeekGoal[]>;
  groups: ChunkGroup[];
}

/** 상태를 바꾼 결과와, 저장해야 할 문서 id */
export interface ChunkChange {
  state: ChunkState;
  changed: string[];
}

export type ChunkSlot = 1 | 2;

/** 새벽 5시 전까지는 전날로 친다 */
export const DAY_START_HOUR = 5;
export const NOTE_MAX = 60;
export const GOAL_MAX = 80;
export const GROUP_NAME_MAX = 12;
/** 0=월 … 6=일 (주간 보드) */
export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
/** 라이트·다크 둘 다에서 보이는 중간 톤 */
export const GROUP_COLORS = ["#d9822b", "#2f86d1", "#d4558a", "#2f9e63", "#b8961a", "#1f9a8f", "#7a68e0", "#d9604f"] as const;
export const DEFAULT_GROUPS: ChunkGroup[] = [
  { id: "g1", name: "공방", c: 0 },
  { id: "g2", name: "집", c: 1 },
  { id: "g3", name: "SNS", c: 2 },
];

export const isChunkDocId = (id: string) => /^(?:w-)?\d{4}-\d{2}-\d{2}$/.test(id) || id === "cfg";
export const weekDocId = (monday: string) => `w-${monday}`;
/** 덩어리에서 자동으로 생긴 카드 id. 날짜·칸마다 고정이라 겹치지 않는다 */
export const autoGoalId = (day: string, slot: ChunkSlot) => `c-${day}-${slot}`;

export const emptyDay = (): ChunkDay => ({ b1: false, b2: false, n1: "", n2: "", g1: "", g2: "", l1: "", l2: "" });

// ── 날짜 (YYYY-MM-DD 문자열, 시간대 영향이 없도록 UTC로 계산) ──

const toKey = (d: Date) => d.toISOString().slice(0, 10);
const fromKey = (key: string) => new Date(`${key}T00:00:00Z`);

export function shiftDay(key: string, days: number) {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

/** 0=월 … 6=일 */
export const weekdayOf = (key: string) => (fromKey(key).getUTCDay() + 6) % 7;
export const mondayOf = (key: string) => shiftDay(key, -weekdayOf(key));

/** 이 컴퓨터 시간 기준 "오늘" (새벽 5시 전이면 어제) */
export function chunkToday(now = new Date()) {
  const d = new Date(now.getTime() - DAY_START_HOUR * 3_600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const chunkCount = (day: ChunkDay | undefined) => (day ? Number(day.b1) + Number(day.b2) : 0);

// ── 문서 ↔ 상태 ──

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** 저장된 문서들을 상태로. 모양이 다른 값은 기본값으로 바꾼다 */
export function docsToState(docs: Record<string, unknown>): ChunkState {
  const state: ChunkState = { days: {}, weeks: {}, groups: DEFAULT_GROUPS.map((g) => ({ ...g })) };
  for (const [id, raw] of Object.entries(docs)) {
    const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (id === "cfg") {
      if (Array.isArray(data.groups) && data.groups.length) {
        state.groups = data.groups.map((g: Record<string, unknown>) => ({
          id: String(g.id),
          name: str(g.name),
          c: Math.abs(Math.trunc(Number(g.c) || 0)) % GROUP_COLORS.length,
        }));
      }
    } else if (id.startsWith("w-") && isChunkDocId(id)) {
      if (Array.isArray(data.goals)) {
        state.weeks[id.slice(2)] = data.goals.map((g: Record<string, unknown>) => ({
          id: String(g.id),
          t: str(g.t),
          g: str(g.g),
          d: typeof g.d === "number" && g.d >= -1 && g.d <= 6 ? g.d : -1,
          done: !!g.done,
        }));
      }
    } else if (isChunkDocId(id)) {
      state.days[id] = {
        b1: !!data.b1,
        b2: !!data.b2,
        n1: str(data.n1),
        n2: str(data.n2),
        g1: str(data.g1),
        g2: str(data.g2),
        l1: str(data.l1),
        l2: str(data.l2),
      };
    }
  }
  return state;
}

/** 저장할 문서 하나 */
export function docOf(state: ChunkState, id: string): Record<string, unknown> {
  if (id === "cfg") return { groups: state.groups.map(({ id, name, c }) => ({ id, name, c })) };
  if (id.startsWith("w-")) return { goals: (state.weeks[id.slice(2)] ?? []).map(({ id, t, g, d, done }) => ({ id, t, g, d, done })) };
  return { ...emptyDay(), ...state.days[id] };
}

export const chunkGroupOf = (state: ChunkState, id: string) => state.groups.find((g) => g.id === id) ?? state.groups[0]!;

// ── 하루 기록 ──

/**
 * 덩어리 한 칸을 주간 보드와 맞춘다.
 * - 목표에서 가져온 칸(l)은 카드를 새로 만들지 않고, mirror면 체크를 목표 완료로 옮긴다
 * - 메모와 그룹이 있으면 그 요일에 자동 카드를 만들거나 고치고, 둘 중 하나라도 비면 지운다
 */
function syncSlot(state: ChunkState, day: string, slot: ChunkSlot, mirror: boolean): string | null {
  const rec = state.days[day];
  if (!rec) return null;
  const monday = mondayOf(day);
  const list = state.weeks[monday] ?? [];
  const autoId = autoGoalId(day, slot);
  const memo = rec[`n${slot}`].trim();
  const group = rec[`g${slot}`];
  const checked = rec[`b${slot}`];
  const link = rec[`l${slot}`];
  const auto = list.find((g) => g.id === autoId);
  const linked = link ? list.find((g) => g.id === link) : undefined;

  let next: WeekGoal[] | null = null;
  if (linked) {
    if ((mirror && linked.done !== checked) || auto) {
      next = list.filter((g) => g.id !== autoId).map((g) => (g.id === link && mirror ? { ...g, done: checked } : g));
    }
  } else if (memo && group) {
    const card = { id: autoId, t: memo, g: group, d: weekdayOf(day), done: checked };
    if (!auto) next = [...list, card];
    else if (auto.t !== card.t || auto.g !== card.g || auto.d !== card.d || auto.done !== card.done) {
      next = list.map((g) => (g.id === autoId ? card : g));
    }
  } else if (auto) {
    next = list.filter((g) => g.id !== autoId);
  }
  if (!next) return null;
  state.weeks = { ...state.weeks, [monday]: next };
  return weekDocId(monday);
}

/**
 * 하루 기록을 고치고 주간 보드 카드를 맞춘다.
 * mirror: 방금 체크하거나 푼 칸 (연결된 목표의 완료도 따라가게)
 */
export function updateDay(state: ChunkState, day: string, patch: Partial<ChunkDay>, mirror?: ChunkSlot): ChunkChange {
  const next: ChunkState = { ...state, days: { ...state.days, [day]: { ...emptyDay(), ...state.days[day], ...patch } } };
  const changed = new Set([day]);
  for (const slot of [1, 2] as const) {
    const week = syncSlot(next, day, slot, mirror === slot);
    if (week) changed.add(week);
  }
  return { state: next, changed: [...changed] };
}

/** "배정된 목표"를 덩어리 칸에 적는다. 메모에 이어 붙이고, 그룹과 연결을 목표 것으로 */
export function writeGoalToSlot(state: ChunkState, day: string, slot: ChunkSlot, goal: WeekGoal): ChunkChange {
  const cur = state.days[day]?.[`n${slot}`] ?? "";
  const memo = !cur ? goal.t : cur.includes(goal.t) ? cur : `${cur} + ${goal.t}`;
  return updateDay(state, day, { [`n${slot}`]: memo.slice(0, NOTE_MAX), [`g${slot}`]: goal.g, [`l${slot}`]: goal.id });
}

export interface MonthSummary {
  /** 체크한 덩어리 수 */
  total: number;
  /** 1덩어리 이상 한 날 */
  worked: number;
  /** 2덩어리 모두 한 날 */
  full: number;
}

/** month: "YYYY-MM" */
export function monthSummary(days: Record<string, ChunkDay>, month: string): MonthSummary {
  const summary = { total: 0, worked: 0, full: 0 };
  for (const [key, day] of Object.entries(days)) {
    if (!key.startsWith(`${month}-`)) continue;
    const n = chunkCount(day);
    summary.total += n;
    if (n > 0) summary.worked++;
    if (n === 2) summary.full++;
  }
  return summary;
}

// ── 주간 목표 ──

const newId = () => Math.random().toString(36).slice(2, 9);

/**
 * 목표 입력 한 줄: "릴스 3개 올리기 #공방 @수"
 * #그룹이름(앞부분만 써도 됨)으로 그룹, @요일 한 글자로 요일을 정한다. 못 찾은 #는 글자로 남긴다
 */
export function parseGoalInput(raw: string, groups: ChunkGroup[], fallbackGroup: string): Omit<WeekGoal, "id" | "done"> | null {
  let g = fallbackGroup;
  let d = -1;
  let text = raw.replace(/(^|\s)#(\S+)/g, (m, sp: string, name: string) => {
    const found = groups.find((x) => x.name === name) ?? groups.find((x) => x.name.startsWith(name));
    if (!found) return m;
    g = found.id;
    return sp;
  });
  text = text.replace(/(^|\s)@([월화수목금토일])(?=\s|$)/g, (_m, sp: string, ch: string) => {
    d = WEEKDAYS.indexOf(ch as (typeof WEEKDAYS)[number]);
    return sp;
  });
  text = text.replace(/\s+/g, " ").trim().slice(0, GOAL_MAX);
  return text ? { t: text, g, d } : null;
}

function setWeek(state: ChunkState, monday: string, goals: WeekGoal[]): ChunkChange {
  return { state: { ...state, weeks: { ...state.weeks, [monday]: goals } }, changed: [weekDocId(monday)] };
}

export function addGoal(state: ChunkState, monday: string, goal: Omit<WeekGoal, "id" | "done">): ChunkChange {
  return setWeek(state, monday, [...(state.weeks[monday] ?? []), { ...goal, id: newId(), done: false }]);
}

export function updateGoal(state: ChunkState, monday: string, id: string, patch: Partial<Omit<WeekGoal, "id">>): ChunkChange {
  return setWeek(state, monday, (state.weeks[monday] ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)));
}

export function removeGoal(state: ChunkState, monday: string, id: string): ChunkChange {
  return setWeek(state, monday, (state.weeks[monday] ?? []).filter((g) => g.id !== id));
}

/** 못 끝낸 목표를 다음 주로 (요일은 미배정, 완료는 풀림) */
export function moveGoalToNextWeek(state: ChunkState, monday: string, id: string): ChunkChange {
  const goal = state.weeks[monday]?.find((g) => g.id === id);
  if (!goal) return { state, changed: [] };
  const nextMonday = shiftDay(monday, 7);
  const removed = removeGoal(state, monday, id);
  const added = setWeek(removed.state, nextMonday, [...(removed.state.weeks[nextMonday] ?? []), { ...goal, d: -1, done: false }]);
  return { state: added.state, changed: [weekDocId(monday), weekDocId(nextMonday)] };
}

// ── 그룹 ──

function setGroups(state: ChunkState, groups: ChunkGroup[]): ChunkChange {
  return { state: { ...state, groups }, changed: ["cfg"] };
}

/** 아직 안 쓴 색을 골라 그룹을 추가한다 */
export function addGroup(state: ChunkState, name: string): ChunkChange {
  const trimmed = name.trim().slice(0, GROUP_NAME_MAX);
  if (!trimmed) return { state, changed: [] };
  const used = new Set(state.groups.map((g) => g.c));
  const c = GROUP_COLORS.findIndex((_, i) => !used.has(i));
  return setGroups(state, [...state.groups, { id: `g${newId()}`, name: trimmed, c: c >= 0 ? c : state.groups.length % GROUP_COLORS.length }]);
}

export function updateGroup(state: ChunkState, id: string, patch: Partial<Omit<ChunkGroup, "id">>): ChunkChange {
  return setGroups(
    state,
    state.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  );
}
