/**
 * 계정별 글감 나누기 (MCP assign_account_keywords → save_draft 대조). 파일 저장은 account-plan-store.ts.
 * 규칙 문장만 주면 Claude가 계정당 편수를 어기거나 계정을 빠뜨려서, 나누기와 개수 세기는 코드가 한다.
 * Claude는 키워드의 우선순위(넘기는 순서)와 분야·형식·발행일만 정한다.
 * 계획은 만든 날(KST) 기준이다. 행사 전에 올릴 홈판형은 파일 날짜(발행일)가 뒤라도 그날 계획의 몫으로 센다.
 */
import type { BlogAccount } from "./accounts.ts";
import type { NaverFormat } from "./platforms.ts";
import { normalizeKeyword } from "./sources.ts";

export interface PlanKeyword {
  keyword: string;
  /** 네이버 블로그 주제 분류 */
  topic: string;
  format: NaverFormat;
  /** 발행일 YYYY-MM-DD */
  date: string;
  /** 이 계정(id)에 고정 (유입 검색어 후보처럼 그 계정 블로그에서 나온 키워드). 분야와 상관없이 그 계정 몫에 넣는다 */
  pin?: string;
}

export interface PlanItem extends Omit<PlanKeyword, "pin"> {
  /** 계정 id */
  account: string;
}

export interface PlanSaved {
  account: string;
  file: string;
  /** 계획의 키워드 (연관어로 바꿔 저장했으면 원래 키워드), 계획에 없으면 null */
  keyword: string | null;
}

export interface AccountPlan {
  /** 계획을 만든 날 (KST) */
  day: string;
  /** 요청한 전체 편수 */
  total: number;
  /** 계정 id → 몫 */
  quotas: Record<string, number>;
  items: PlanItem[];
  saved: PlanSaved[];
}

export interface Leftover extends PlanKeyword {
  reason: string;
}

/** 편수를 계정 수로 나눈 몫. 나머지는 앞 계정부터 하나씩 */
export function accountQuotas(accounts: BlogAccount[], total: number): Record<string, number> {
  const base = Math.floor(total / accounts.length);
  const extra = total % accounts.length;
  return Object.fromEntries(accounts.map((a, i) => [a.id, base + (i < extra ? 1 : 0)]));
}

/** 이 분야를 맡은 계정. 분야를 고르지 않은 계정은 어느 분야든 맡는다 */
const takes = (account: BlogAccount, topic: string) => !account.topics.length || (account.topics as string[]).includes(topic);

/**
 * 우선순위 순서대로 들어온 키워드를 계정에 나눈다. plan이 있으면 거기에 이어 넣는다 (모자란 계정을 채울 때).
 * 한 키워드는 맡은 계정 중 아직 몫이 남고 지금까지 적게 받은 계정에 간다. 몫이 다 찼거나 맡은 계정이 없으면 남긴다
 */
export function assignAccountKeywords(accounts: BlogAccount[], keywords: PlanKeyword[], base: AccountPlan) {
  const items = [...base.items];
  const leftover: Leftover[] = [];
  const count = (id: string) => items.filter((i) => i.account === id).length;
  for (const k of keywords) {
    const key = normalizeKeyword(k.keyword);
    if (items.some((i) => normalizeKeyword(i.keyword) === key)) {
      leftover.push({ ...k, reason: "이미 계획에 있음" });
      continue;
    }
    const owners = k.pin ? accounts.filter((a) => a.id === k.pin) : accounts.filter((a) => takes(a, k.topic));
    if (!owners.length) {
      leftover.push({ ...k, reason: "이 분야를 맡은 계정 없음" });
      continue;
    }
    const open = owners.filter((a) => count(a.id) < (base.quotas[a.id] ?? 0));
    if (!open.length) {
      leftover.push({ ...k, reason: `${owners.map((a) => a.name).join("·")} 몫이 다 참` });
      continue;
    }
    const pick = open.reduce((best, a) => (count(a.id) < count(best.id) ? a : best));
    const { pin: _pin, ...item } = k;
    items.push({ ...item, account: pick.id });
  }
  return { plan: { ...base, items }, leftover };
}

/** 몫보다 적게 받은 계정: 얼마나 모자라고 어느 분야에서 더 찾을지 */
export function planShortfalls(accounts: BlogAccount[], plan: AccountPlan) {
  return accounts.flatMap((a) => {
    const missing = (plan.quotas[a.id] ?? 0) - plan.items.filter((i) => i.account === a.id).length;
    return missing > 0 ? [{ account: a, missing }] : [];
  });
}

/** 빈 계획 (오늘 처음 나눌 때, 또는 다시 나눌 때) */
export const emptyPlan = (accounts: BlogAccount[], day: string, total: number): AccountPlan => ({
  day,
  total,
  quotas: accountQuotas(accounts, total),
  items: [],
  saved: [],
});

/** assign_account_keywords 결과 글 */
export function formatPlan(accounts: BlogAccount[], plan: AccountPlan, leftover: Leftover[]) {
  const formatLabel = (f: NaverFormat) => (f === "home" ? "홈판형" : "검색형");
  const lines = [`# 계정별 글감 (${plan.day} 계획, 전체 ${plan.total}편)`, ""];
  for (const a of accounts) {
    const mine = plan.items.filter((i) => i.account === a.id);
    const home = mine.filter((i) => i.format === "home").length;
    lines.push(`## ${a.name} ${mine.length}/${plan.quotas[a.id] ?? 0}${home ? ` (홈판형 ${home})` : ""}`);
    if (mine.length) {
      lines.push("| 키워드 | 분야 | 형식 | 발행일 |", "|---|---|---|---|");
      for (const i of mine) lines.push(`| ${i.keyword} | ${i.topic} | ${formatLabel(i.format)} | ${i.date} |`);
    }
    lines.push("");
  }
  if (leftover.length) {
    lines.push("## 남은 키워드", ...leftover.map((l) => `- ${l.keyword} (${l.topic}): ${l.reason}`), "");
  }
  const short = planShortfalls(accounts, plan);
  lines.push(
    short.length
      ? [
          "다음 할 일: 모자란 계정을 채웁니다. 약한 트렌드로 채우지 말고 discover_keywords로 그 계정 분야의 상시·시즌 키워드를 찾아, 이 도구를 다시 부르세요 (reset 없이 부르면 이어 넣습니다).",
          ...short.map((s) => `- ${s.account.name}: ${s.missing}개 모자람 → 분야 ${s.account.topics.join(", ") || "아무 분야"}`),
        ].join("\n")
      : "다음 할 일: 계정마다 몫이 찼습니다. 이 표를 사용자에게 계정별로 보여 주고, 표의 계정·분야·형식·발행일 그대로 초안을 씁니다 (save_draft에 account·topic·format·date).",
  );
  return lines.join("\n");
}

/**
 * save_draft할 때 계획과 대조한다. 계획의 키워드(연관어로 바꿨으면 plan_keyword)로 찾고,
 * 다른 계정 몫이거나 형식·발행일이 다르거나 몫을 넘으면 경고한다. 저장 기록을 더한 계획과 안내를 돌려준다
 */
export function checkAgainstPlan(
  accounts: BlogAccount[],
  plan: AccountPlan,
  draft: { account: string; file: string; keyword: string; planKeyword?: string; format: NaverFormat; date: string },
) {
  const key = normalizeKeyword(draft.planKeyword ?? draft.keyword);
  const item = plan.items.find((i) => normalizeKeyword(i.keyword) === key) ?? null;
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "지운 계정";
  const formatLabel = (f: NaverFormat) => (f === "home" ? "홈판형" : "검색형");
  const warnings: string[] = [];
  if (!item) warnings.push(`"${draft.planKeyword ?? draft.keyword}"는 오늘 계정 계획에 없는 키워드입니다. 연관어로 바꿨다면 plan_keyword에 계획의 원래 키워드를 넣으세요.`);
  else {
    if (item.account !== draft.account) warnings.push(`이 키워드는 ${name(item.account)} 몫입니다 (지금 ${name(draft.account)}로 저장).`);
    if (item.format !== draft.format) warnings.push(`계획은 ${formatLabel(item.format)}인데 ${formatLabel(draft.format)}으로 저장했습니다.`);
    if (item.date !== draft.date) warnings.push(`계획의 발행일은 ${item.date}인데 ${draft.date}로 저장했습니다.`);
  }
  const saved = [...plan.saved.filter((s) => s.file !== draft.file), { account: draft.account, file: draft.file, keyword: item?.keyword ?? null }];
  const next = { ...plan, saved };
  const mine = saved.filter((s) => s.account === draft.account).length;
  const quota = plan.quotas[draft.account] ?? 0;
  if (mine > quota) warnings.push(`${name(draft.account)}는 몫(${quota}편)보다 많이 저장했습니다 (${mine}편).`);
  const progress = accounts.map((a) => `${a.name} ${saved.filter((s) => s.account === a.id).length}/${plan.quotas[a.id] ?? 0}`).join(" · ");
  const text = [`계정 계획 현황 (${plan.day}): ${progress}`, ...warnings.map((w) => `- 확인: ${w}`)].join("\n");
  return { plan: next, text, warnings };
}
