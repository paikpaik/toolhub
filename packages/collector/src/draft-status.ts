import { isAccountId, isBlogTopic } from "./accounts.ts";
import { BACKGROUND_NAME } from "./thumbnail-style.ts";

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
  /** 이 초안을 올릴 블로그 계정 id (data/accounts.json) */
  account?: string;
  /** 네이버 블로그 주제 분류 (계정 탭의 분야별 집계) */
  topic?: string;
  /** 이 초안의 썸네일 설정 (없으면 대표 썸네일 표시의 문구·계정 배경 자동) */
  thumbnail?: DraftThumbnail;
}

export interface DraftThumbnail {
  /** 썸네일 문구 (줄바꿈 \n, *강조*) */
  text?: string;
  /** 배경 이미지 이름, "none"이면 단색 */
  background?: string;
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

/**
 * 초안 목록 순서: 발행됨 → 초안, 같은 상태끼리는 발행일 늦은 순, 같은 발행일에서는 홈판형 먼저(그날 아침 먼저 올리는 글), 그다음 최근 수정 순
 */
export function sortDrafts<T extends { file: string; updatedAt: string; date?: string | null; format?: string | null }>(rows: T[], statuses: DraftStatusMap): T[] {
  const rank = (row: T) => (effectiveStatus(statuses[row.file]) === "published" ? 0 : 1);
  const home = (row: T) => (row.format === "home" ? 0 : 1);
  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || (b.date ?? "").localeCompare(a.date ?? "") || home(a) - home(b) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/**
 * 확장 "초안" 메뉴의 목록: 그날 올릴 네이버 초안 (발행됨 제외), 목록과 같은 순서 (홈판형 먼저).
 * account를 주면 그 계정 초안만 (계정 id, "none"이면 계정을 정하지 않은 초안)
 */
export function naverDraftsFor<T extends { file: string; updatedAt: string; date: string | null; platform: string | null; format?: string | null }>(
  rows: T[],
  statuses: DraftStatusMap,
  date: string,
  account: string | null = null,
): T[] {
  const picked = rows.filter(
    (row) => row.platform === "naver" && row.date === date && effectiveStatus(statuses[row.file]) === "draft" && matchesAccount(statuses[row.file], account),
  );
  return sortDrafts(picked, statuses);
}

/** 계정 거르기: null이면 모두, "none"이면 계정을 정하지 않은 초안, 그 밖에는 그 계정 id */
export function matchesAccount(entry: DraftStatusEntry | undefined, account: string | null) {
  if (account === null) return true;
  if (account === "none") return !entry?.account;
  return entry?.account === account;
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
  /** 계정 id. 빈 문자열이면 지운다 */
  account?: string;
  /** 분야 (네이버 블로그 주제). 빈 문자열이면 지운다 */
  topic?: string;
  /** 썸네일 문구·배경. 각 값이 빈 문자열이면 그 값을 지운다 (자동으로) */
  thumbnail?: DraftThumbnail;
}

const THUMBNAIL_TEXT_MAX = 80;
const isThumbnailBackground = (v: unknown): v is string => typeof v === "string" && (v === "none" || BACKGROUND_NAME.test(v));

/** 썸네일 설정을 확인해 고친 값. 빈 설정이면 undefined, 잘못됐으면 오류 메시지 */
function applyThumbnail(current: DraftThumbnail | undefined, patch: DraftThumbnail): DraftThumbnail | undefined | string {
  const next: DraftThumbnail = { ...current };
  if (patch.text !== undefined) {
    const text = String(patch.text).trim();
    if (text.length > THUMBNAIL_TEXT_MAX) return `썸네일 문구는 ${THUMBNAIL_TEXT_MAX}자까지예요`;
    if (text) next.text = text;
    else delete next.text;
  }
  if (patch.background !== undefined) {
    if (!patch.background) delete next.background;
    else if (!isThumbnailBackground(patch.background)) return `알 수 없는 배경: ${patch.background}`;
    else next.background = patch.background;
  }
  return Object.keys(next).length ? next : undefined;
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
  if (patch.account !== undefined) {
    if (!patch.account) delete next.account;
    else if (!isAccountId(patch.account)) return `알 수 없는 계정: ${patch.account}`;
    else next.account = patch.account;
  }
  if (patch.topic !== undefined) {
    if (!patch.topic) delete next.topic;
    else if (!isBlogTopic(patch.topic)) return `알 수 없는 분야: ${patch.topic}`;
    else next.topic = patch.topic;
  }
  if (patch.thumbnail !== undefined) {
    const thumbnail = applyThumbnail(next.thumbnail, patch.thumbnail ?? {});
    if (typeof thumbnail === "string") return thumbnail;
    if (thumbnail) next.thumbnail = thumbnail;
    else delete next.thumbnail;
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
  if (isAccountId(r.account)) entry.account = r.account;
  if (isBlogTopic(r.topic)) entry.topic = r.topic;
  const thumbnail = r.thumbnail && typeof r.thumbnail === "object" ? applyThumbnail(undefined, r.thumbnail as DraftThumbnail) : undefined;
  if (thumbnail && typeof thumbnail !== "string") entry.thumbnail = thumbnail;
  return entry;
}
