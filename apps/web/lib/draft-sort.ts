/**
 * 초안 목록의 여러 칼럼 정렬: 칼럼 머리를 누른 순서가 우선순위 (키워드 → 상태 → 작성일 …).
 * 고른 정렬은 브라우저 localStorage에 기억한다. 비어 있으면 서버 순서(발행됨 → 초안, 최근 수정 순) 그대로
 */

export const DRAFT_SORT_KEY = "toolhub:draft-sort";

export const SORT_COLUMNS = ["keyword", "status", "answers", "platform", "date", "updatedAt"] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = "asc" | "desc";
export interface SortRule {
  column: SortColumn;
  dir: SortDir;
}

/** 처음 눌렀을 때 방향: 글자는 가나다순, 날짜·개수는 최근·많은 순 */
const FIRST_DIR: Record<SortColumn, SortDir> = { keyword: "asc", status: "asc", answers: "desc", platform: "asc", date: "desc", updatedAt: "desc" };

/** 칼럼 머리를 누를 때: 없으면 우선순위 맨 뒤에 넣고, 있으면 방향을 바꾸고, 두 번 바꿨으면(처음 방향의 반대에서 또 누르면) 뺀다 */
export function cycleSort(rules: SortRule[], column: SortColumn): SortRule[] {
  const found = rules.find((r) => r.column === column);
  if (!found) return [...rules, { column, dir: FIRST_DIR[column] }];
  if (found.dir === FIRST_DIR[column]) return rules.map((r) => (r.column === column ? { column, dir: r.dir === "asc" ? "desc" : "asc" } : r));
  return rules.filter((r) => r.column !== column);
}

export interface SortableDraft {
  keyword: string;
  platform: string | null;
  date: string | null;
  updatedAt: string;
  /** 상태 순서 (0 초안, 1 발행됨) */
  statusRank: number;
  answers: number;
}

function compare(a: SortableDraft, b: SortableDraft, column: SortColumn) {
  switch (column) {
    case "keyword":
      return a.keyword.localeCompare(b.keyword, "ko");
    case "platform":
      return (a.platform ?? "").localeCompare(b.platform ?? "");
    case "status":
      return a.statusRank - b.statusRank;
    case "answers":
      return a.answers - b.answers;
    case "date":
      return (a.date ?? "").localeCompare(b.date ?? "");
    case "updatedAt":
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

/** 우선순위대로 정렬. 모두 같으면 원래 순서(서버 순서)를 지킨다 */
export function sortByRules<T extends SortableDraft>(rows: T[], rules: SortRule[]): T[] {
  if (rules.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { column, dir } of rules) {
      const diff = compare(a, b, column);
      if (diff) return dir === "asc" ? diff : -diff;
    }
    return 0;
  });
}

/** 기억해 둔 값에서 알맞은 규칙만 (같은 칼럼은 처음 것만) */
export function parseSavedSort(raw: string | null): SortRule[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const rules: SortRule[] = [];
    for (const r of value) {
      if (SORT_COLUMNS.includes(r?.column) && (r?.dir === "asc" || r?.dir === "desc") && !rules.some((x) => x.column === r.column)) {
        rules.push({ column: r.column, dir: r.dir });
      }
    }
    return rules;
  } catch {
    return [];
  }
}
