/**
 * 초안의 발행 상태와 지식iN 답변 기록 (브라우저에서도 쓰는 순수 로직. 파일 저장은 draft-status-store.ts)
 * 초안 파일(.md)은 Claude가 통째로 고쳐 쓰므로 상태는 data/draft-status.json에 파일 이름별로 따로 둔다.
 */

export const DRAFT_STATUSES = ["draft", "scheduled", "published"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = { draft: "초안", scheduled: "예약됨", published: "발행됨" };

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
  /** 발행(예약)한 글 주소. 지식iN 답변의 링크로 쓴다 */
  url?: string;
  /** 예약 시각 또는 발행 시각 (ISO) */
  at?: string;
  answers?: KinAnswer[];
}

export type DraftStatusMap = Record<string, DraftStatusEntry>;

const EMPTY: DraftStatusEntry = { status: "draft" };

/** 예약 시각이 지난 예약 글은 발행된 것으로 본다 (예약 발행은 그 시각에 저절로 올라간다) */
export function effectiveStatus(entry: DraftStatusEntry | undefined, now = Date.now()): DraftStatus {
  const { status, at } = entry ?? EMPTY;
  if (status === "scheduled" && at && Date.parse(at) <= now) return "published";
  return status;
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
 * 목록 순서(files)에서 지금 초안의 앞·뒤로 가장 가까운 "초안" 상태 파일. 예약됨·발행됨은 건너뛴다.
 * 지금 초안이 발행됐어도 목록 속 자리를 기준으로 찾는다
 */
export function adjacentDrafts(files: string[], current: string, statuses: DraftStatusMap, now = Date.now()) {
  const index = files.indexOf(current);
  const isDraft = (file: string) => effectiveStatus(statuses[file], now) === "draft";
  if (index < 0) return { prev: null, next: null };
  const prev = files.slice(0, index).reverse().find(isDraft) ?? null;
  const next = files.slice(index + 1).find(isDraft) ?? null;
  return { prev, next };
}
