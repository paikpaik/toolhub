/**
 * 초안의 발행 상태와 지식iN 답변 기록 (브라우저에서도 쓰는 순수 로직. 파일 저장은 draft-status-store.ts)
 * 초안 파일(.md)은 Claude가 통째로 고쳐 쓰므로 상태는 data/draft-status.json에 파일 이름별로 따로 둔다.
 */

export const DRAFT_STATUSES = ["draft", "published"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = { draft: "초안", published: "발행됨" };

export const isDraftStatus = (value: unknown): value is DraftStatus => DRAFT_STATUSES.includes(value as DraftStatus);

/** 지식iN 질문에 이 글로 답변한 기록 (같은 질문에 두 번 답하지 않게) */
export interface KinAnswer {
  /** 질문 주소 */
  link: string;
  title: string;
  /** ISO 시각 */
  answeredAt: string;
}

export interface DraftStatusEntry {
  status: DraftStatus;
  /** 발행한 글 주소. 지식iN 답변의 링크로 쓴다 */
  url?: string;
  /** 발행 시각 (ISO) */
  at?: string;
  answers?: KinAnswer[];
}

export type DraftStatusMap = Record<string, DraftStatusEntry>;

const EMPTY: DraftStatusEntry = { status: "draft" };

/** 기록이 없으면 초안. 예전에 저장한 "scheduled"(예약됨, 지금은 없앤 상태)는 발행됨으로 본다 */
export function effectiveStatus(entry: DraftStatusEntry | undefined): DraftStatus {
  const status = (entry ?? EMPTY).status;
  return status === "draft" ? "draft" : "published";
}

/**
 * 정책: 발행됨 초안은 고치지 않는다. 발행한 글은 다시 쓰지 않아서, 고쳐도 토큰만 쓰고 쓸모가 없다.
 * 고칠 수 없으면 이유(오류 메시지), 고칠 수 있으면 null
 */
export function draftEditBlocked(file: string, entry: DraftStatusEntry | undefined): string | null {
  if (effectiveStatus(entry) !== "published") return null;
  return `발행됨 초안은 고치지 않습니다 (정책): ${file}. 발행한 글은 다시 쓰지 않으므로 고치지 말고 작업을 멈추세요. 아직 발행 전인데 상태가 잘못된 거라면 사용자가 웹 초안 목록에서 상태를 초안으로 바꾼 뒤 고칩니다.`;
}

/** 초안 목록 순서: 발행됨 → 초안, 같은 상태끼리는 최근 수정 순 */
export function sortDrafts<T extends { file: string; updatedAt: string }>(rows: T[], statuses: DraftStatusMap): T[] {
  const rank = (row: T) => (effectiveStatus(statuses[row.file]) === "published" ? 0 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
}

/** 글 주소로 쓸 수 있는 http(s) 주소만. 앞뒤 공백·꺾쇠는 걷어낸다 */
export function normalizePostUrl(value: string) {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface DraftStatusPatch {
  status?: DraftStatus;
  /** 빈 문자열이면 지운다 */
  url?: string;
  at?: string | null;
}

/** 상태를 고친 새 기록. 주소가 잘못됐으면 오류 메시지를 돌려준다 */
export function applyStatusPatch(entry: DraftStatusEntry | undefined, patch: DraftStatusPatch): DraftStatusEntry | string {
  const next: DraftStatusEntry = { ...EMPTY, ...entry };
  if (patch.status !== undefined) {
    if (!isDraftStatus(patch.status)) return `알 수 없는 상태: ${patch.status}`;
    next.status = patch.status;
  }
  if (patch.url !== undefined) {
    if (!patch.url.trim()) delete next.url;
    else {
      const url = normalizePostUrl(patch.url);
      if (!url) return "글 주소는 https://로 시작하는 주소여야 해요";
      next.url = url;
    }
  }
  if (patch.at !== undefined) {
    if (patch.at === null || patch.at === "") delete next.at;
    else if (Number.isNaN(Date.parse(patch.at))) return `알 수 없는 시각: ${patch.at}`;
    else next.at = new Date(patch.at).toISOString();
  }
  return next;
}

/** 답변 기록을 켜고 끈다 (같은 질문 주소는 하나만) */
export function toggleKinAnswer(entry: DraftStatusEntry | undefined, question: { link: string; title: string }, answered: boolean, now = new Date()) {
  const next: DraftStatusEntry = { ...EMPTY, ...entry };
  const rest = (next.answers ?? []).filter((a) => a.link !== question.link);
  next.answers = answered ? [...rest, { link: question.link, title: question.title, answeredAt: now.toISOString() }] : rest;
  if (next.answers.length === 0) delete next.answers;
  return next;
}

/**
 * 목록 순서(files)에서 지금 초안의 앞·뒤로 가장 가까운 "초안" 상태 파일. 발행됨은 건너뛴다.
 * 지금 초안이 발행됐어도 목록 속 자리를 기준으로 찾는다
 */
export function adjacentDrafts(files: string[], current: string, statuses: DraftStatusMap) {
  const index = files.indexOf(current);
  const isDraft = (file: string) => effectiveStatus(statuses[file]) === "draft";
  if (index < 0) return { prev: null, next: null };
  const prev = files.slice(0, index).reverse().find(isDraft) ?? null;
  const next = files.slice(index + 1).find(isDraft) ?? null;
  return { prev, next };
}

/** 바깥에서 들어온 상태 기록(초안 가져오기)을 정해진 필드만 남겨 읽는다. 상태를 알 수 없으면 null */
export function sanitizeStatusEntry(raw: unknown): DraftStatusEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isDraftStatus(r.status)) return null;
  const entry: DraftStatusEntry = { status: r.status };
  const url = typeof r.url === "string" ? normalizePostUrl(r.url) : null;
  if (url) entry.url = url;
  if (typeof r.at === "string" && !Number.isNaN(Date.parse(r.at))) entry.at = new Date(r.at).toISOString();
  const answers = Array.isArray(r.answers)
    ? r.answers.flatMap((a) => {
        const x = (a ?? {}) as Record<string, unknown>;
        const link = typeof x.link === "string" ? normalizePostUrl(x.link) : null;
        return link && typeof x.title === "string" && typeof x.answeredAt === "string" ? [{ link, title: x.title, answeredAt: x.answeredAt }] : [];
      })
    : [];
  if (answers.length) entry.answers = answers;
  return entry;
}
