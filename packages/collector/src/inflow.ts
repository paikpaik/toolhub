/**
 * 블로그 통계 › 유입분석 › 검색 유입의 검색어 (크롬 확장이 복사한 것)로 계정별 새 글감 후보를 정한다.
 * 그 계정이 이미 검색에 잡히는 주제라 트렌드에서 고른 키워드보다 확률이 높다.
 * 발행된 글은 고치지 않으므로 기존 글 보완이 아니라 새 글감으로만 쓴다
 */
import { normalizeKeyword } from "./sources.ts";

export interface InflowKeyword {
  keyword: string;
  /** 검색 유입 중 비율 (%) */
  share: number;
}

export interface InflowCovered extends InflowKeyword {
  /** 이 검색어가 들어간(또는 이 검색어를 품은) 초안 키워드 */
  draftKeyword: string;
}

/** 계정마다 마지막으로 받은 유입 검색어 (data/inflow.json) */
export interface InflowRecord {
  /** 통계 기간 (예: 2026-11-09~2026-11-15) */
  period: string;
  /** 받은 시각 ISO */
  at: string;
  keywords: InflowKeyword[];
}

export type InflowStore = Record<string, InflowRecord>;

/** 글감 계획에 올릴 계정당 후보 수 (비율 높은 순) */
export const INFLOW_PLAN_PER_ACCOUNT = 5;
/** 이보다 오래된 유입 기록은 글감 계획에 올리지 않는다 */
export const INFLOW_KEEP_DAYS = 14;

/**
 * 검색어가 이 계정의 초안으로 이미 다뤄졌는지. 같은 키워드이거나 한쪽이 다른 쪽을 품으면 다룬 것으로 본다
 * ("컴포즈 직영점" ↔ "컴포즈 직영점 확인방법"). 계정이 없는 예전 초안도 그 계정 글일 수 있어 함께 본다
 */
export function matchInflow(keywords: InflowKeyword[], drafts: { keyword: string; account?: string }[], accountId: string) {
  const own = drafts.filter((d) => !d.account || d.account === accountId).map((d) => ({ keyword: d.keyword, key: normalizeKeyword(d.keyword) }));
  const covered: InflowCovered[] = [];
  const open: InflowKeyword[] = [];
  for (const k of keywords) {
    const key = normalizeKeyword(k.keyword);
    const hit = key.length >= 2 ? own.find((d) => d.key.length >= 2 && (d.key === key || d.key.includes(key) || key.includes(d.key))) : undefined;
    if (hit) covered.push({ ...k, draftKeyword: hit.keyword });
    else open.push(k);
  }
  return { covered, open };
}

const daysBetween = (a: string, b: Date) => (b.getTime() - new Date(a).getTime()) / 86_400_000;

/** 아직 글이 없는 검색어 중 글감 계획에 올릴 것 (비율 높은 순 몇 개) */
const pickCandidates = (open: InflowKeyword[]) => [...open].sort((x, y) => y.share - x.share).slice(0, INFLOW_PLAN_PER_ACCOUNT);

/** 화면에 보일 검색어 상태: 이미 글 있음 · 글감 후보(계획에 오름) · 후보 밖(글은 없지만 순위 밖) */
export type InflowKeywordState = "covered" | "candidate" | "open";

export interface InflowOverviewItem {
  /** 기록의 계정 id (계정을 지웠으면 accountName이 없다) */
  accountId: string;
  accountName?: string;
  /** 이 계정에 받은 기록이 없으면 null */
  record: InflowRecord | null;
  /** 기록이 오래돼 글감 계획에서 빠졌는지 */
  stale: boolean;
  keywords: (InflowKeyword & { state: InflowKeywordState; draftKeyword?: string })[];
}

/**
 * 웹 '유입 검색어' 화면용: 등록된 계정마다(받은 기록이 없어도) + 지운 계정에 남은 기록.
 * 검색어마다 글감 계획(inflowPlanningNote)과 같은 기준으로 상태를 붙여, 저장된 것과 계획에 오르는 것을 함께 확인한다
 */
export function inflowOverview(
  accounts: { id: string; name: string }[],
  store: InflowStore,
  drafts: { keyword: string; account?: string }[],
  now = new Date(),
): InflowOverviewItem[] {
  const item = (accountId: string, accountName?: string): InflowOverviewItem => {
    const record = store[accountId] ?? null;
    if (!record) return { accountId, accountName, record: null, stale: false, keywords: [] };
    const stale = daysBetween(record.at, now) > INFLOW_KEEP_DAYS;
    const { covered, open } = matchInflow(record.keywords, drafts, accountId);
    const picked = new Set(stale ? [] : pickCandidates(open).map((k) => k.keyword));
    const keywords = record.keywords.map((k) => {
      const hit = covered.find((c) => c.keyword === k.keyword);
      if (hit) return { ...k, state: "covered" as const, draftKeyword: hit.draftKeyword };
      return { ...k, state: picked.has(k.keyword) ? ("candidate" as const) : ("open" as const) };
    });
    return { accountId, accountName, record, stale, keywords };
  };
  const known = new Set(accounts.map((a) => a.id));
  return [...accounts.map((a) => item(a.id, a.name)), ...Object.keys(store).filter((id) => !known.has(id)).map((id) => item(id))];
}

/**
 * get_writing_rules(task=planning)에 붙일 계정별 유입 검색어 후보. 그새 초안을 쓴 검색어는 빼고, 비율 높은 순 몇 개만.
 * 후보가 없으면 null (글감 계획의 컨텍스트를 늘리지 않게)
 */
export function inflowPlanningNote(
  accounts: { id: string; name: string }[],
  store: InflowStore,
  drafts: { keyword: string; account?: string }[],
  now = new Date(),
) {
  const lines = accounts.flatMap((a) => {
    const record = store[a.id];
    if (!record || daysBetween(record.at, now) > INFLOW_KEEP_DAYS) return [];
    const { open } = matchInflow(record.keywords, drafts, a.id);
    const picks = pickCandidates(open);
    return picks.length ? [`- ${a.name} (${record.period}): ${picks.map((k) => `${k.keyword} ${k.share}%`).join(", ")}`] : [];
  });
  if (!lines.length) return null;
  return [
    "# 유입 검색어 후보 (블로그 통계에서 이 계정으로 들어온 검색어 중 아직 전용 글이 없는 것)",
    "",
    ...lines,
    "",
    "이미 그 계정이 검색에 잡히는 주제라 트렌드 키워드보다 우선 검토합니다. 쓰기로 하면 analyze_keywords로 확인한 뒤 assign_account_keywords에 account(그 계정 이름)를 넣어 그 계정에 고정합니다.",
  ].join("\n");
}
