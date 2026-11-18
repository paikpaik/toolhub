/**
 * 블로그 계정과 계정별 분야 (브라우저에서도 쓰는 순수 로직. 파일 저장은 accounts-store.ts)
 * 계정이 여러 개일 때 트렌드 상위 키워드를 나눠 쓰면 계정이 늘수록 아래쪽 약한 키워드까지 내려간다.
 * 계정마다 분야를 정해 각자 자기 분야의 상위 키워드를 쓰게 한다. 계정을 하나도 등록하지 않으면 지금처럼 쓴다.
 * 분야는 네이버 블로그 주제 분류 그대로 둔다 (크리에이터 어드바이저 트렌드도 이 분류로 나뉜다)
 */

import { sanitizeThumbnailStyle, type ThumbnailStyle } from "./thumbnail-style.ts";

export const BLOG_TOPIC_GROUPS = [
  { name: "엔터테인먼트·예술", topics: ["문학·책", "영화", "미술·디자인", "공연·전시", "음악", "드라마", "스타·연예인", "만화·애니", "방송"] },
  { name: "생활·노하우·쇼핑", topics: ["일상·생각", "육아·결혼", "반려동물", "좋은글·이미지", "패션·미용", "인테리어·DIY", "요리·레시피", "상품리뷰", "원예·재배"] },
  { name: "취미·여가·여행", topics: ["게임", "스포츠", "사진", "자동차", "취미", "국내여행", "세계여행", "맛집"] },
  { name: "지식·동향", topics: ["IT·컴퓨터", "사회·정치", "건강·의학", "비즈니스·경제", "어학·외국어", "교육·학문"] },
] as const;

export type BlogTopic = (typeof BLOG_TOPIC_GROUPS)[number]["topics"][number];

export const BLOG_TOPICS: readonly BlogTopic[] = BLOG_TOPIC_GROUPS.flatMap((g) => g.topics);

export const isBlogTopic = (value: unknown): value is BlogTopic => typeof value === "string" && (BLOG_TOPICS as readonly string[]).includes(value);

export interface BlogAccount {
  /** 바뀌지 않는 값. 초안 기록(data/draft-status.json)에 이 값을 둔다 */
  id: string;
  /** 계정 이름 (사람이 알아볼 이름, 바꿀 수 있음) */
  name: string;
  /** 선호 분야 (여러 개) */
  topics: BlogTopic[];
  /** 이 계정 썸네일 스타일 (배경 이미지·템플릿·글꼴·색) */
  thumbnail: ThumbnailStyle;
}

export const ACCOUNT_MAX = 10;
const NAME_MAX = 20;
const ID_PATTERN = /^[a-z0-9-]{1,32}$/;

export const isAccountId = (value: unknown): value is string => typeof value === "string" && ID_PATTERN.test(value);

/** 새 계정 id (브라우저·Node 모두 crypto.randomUUID가 있다) */
export const newAccountId = () => `acc-${crypto.randomUUID().slice(0, 8)}`;

/** 저장할 계정 목록을 확인한다. 정해진 필드만 남기고, 잘못됐으면 오류 메시지 */
export function sanitizeAccounts(raw: unknown): BlogAccount[] | string {
  if (!Array.isArray(raw)) return "계정 목록이 아닙니다";
  if (raw.length > ACCOUNT_MAX) return `계정은 ${ACCOUNT_MAX}개까지예요`;
  const accounts: BlogAccount[] = [];
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>;
    if (!isAccountId(r.id)) return "계정 id가 잘못됐어요";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) return "계정 이름을 넣어 주세요";
    if (name.length > NAME_MAX) return `계정 이름은 ${NAME_MAX}자까지예요: ${name}`;
    if (accounts.some((a) => a.id === r.id)) return "계정 id가 겹쳐요";
    if (accounts.some((a) => a.name === name)) return `같은 이름의 계정이 있어요: ${name}`;
    const topics = Array.isArray(r.topics) ? [...new Set(r.topics.filter(isBlogTopic))] : [];
    accounts.push({ id: r.id, name, topics, thumbnail: sanitizeThumbnailStyle(r.thumbnail) });
  }
  return accounts;
}

/** id나 이름으로 계정 찾기 (MCP에는 이름으로 넘기는 게 자연스러워서 둘 다 받는다) */
export function findAccount(accounts: BlogAccount[], value: string) {
  const key = value.trim();
  return accounts.find((a) => a.id === key) ?? accounts.find((a) => a.name.toLowerCase() === key.toLowerCase()) ?? null;
}

/** 초안 기록의 계정 id → 이름 (지운 계정이면 null) */
export const accountName = (accounts: BlogAccount[], id: string | undefined) => (id ? (accounts.find((a) => a.id === id)?.name ?? null) : null);

/** 계정 탭: 이 계정 초안의 분야별 초안·발행 수 (많은 순). entries는 초안 기록(data/draft-status.json)의 값들 */
export function accountTopicStats(accountId: string, entries: { account?: string; topic?: string; status: string }[]) {
  const stats = new Map<string, { topic: string; drafts: number; published: number }>();
  for (const e of entries) {
    if (e.account !== accountId) continue;
    const topic = e.topic ?? "분야 없음";
    const row = stats.get(topic) ?? { topic, drafts: 0, published: 0 };
    if (e.status === "draft") row.drafts++;
    else row.published++;
    stats.set(topic, row);
  }
  return [...stats.values()].sort((a, b) => b.published + b.drafts - (a.published + a.drafts) || b.published - a.published);
}

/**
 * MCP list_accounts 결과: 등록된 계정마다 분야와 초안·발행 수. entries는 초안 기록의 값들.
 * 초안 기록으로 계정을 짐작하면 아직 글을 쓰지 않은 계정이 빠지므로 계정 질문은 이것으로 답한다
 */
export function formatAccounts(accounts: BlogAccount[], entries: { account?: string; status: string }[]) {
  if (!accounts.length) return "등록된 계정이 없습니다. 초안은 계정 없이 씁니다 (사용자가 웹 블로그 자동화 › 계정에서 등록할 수 있습니다).";
  return [
    `등록된 네이버 블로그 계정 ${accounts.length}개`,
    ...accounts.map((a) => {
      const mine = entries.filter((e) => e.account === a.id);
      const published = mine.filter((e) => e.status !== "draft").length;
      return `- ${a.name}: 분야 ${a.topics.length ? a.topics.join(", ") : "미정 (어느 분야든)"} · 초안 ${mine.length - published}개 · 발행 ${published}개`;
    }),
  ].join("\n");
}

/** get_writing_rules(task=planning) 뒤에 붙일 계정 안내. 계정이 없으면 null (지금처럼 쓴다) */
export function accountsPlanningNote(accounts: BlogAccount[]) {
  if (!accounts.length) return null;
  return [
    "# 계정별 글감 (toolhub 계정 탭에 등록된 네이버 블로그 계정)",
    "",
    ...accounts.map((a) => `- ${a.name}: ${a.topics.length ? a.topics.join(", ") : "분야 미정 (어느 분야든)"}`),
    "",
    "네이버 글은 계정별로 나눕니다. **계정에 나누기와 계정당 편수는 assign_account_keywords가 정합니다. 직접 나누지 않습니다.**",
    "1. 위 판단 기준으로 키워드를 분석해 우선순위대로 줄 세우고, 키워드마다 분야(위 분야 이름 중 하나, 네이버 블로그 주제 분류)·형식(검색형·홈판형)·발행일을 정합니다.",
    `2. assign_account_keywords에 total(사용자가 말한 편수, 예: "3개의 계정으로 초안 15개" → 15, 말하지 않으면 계정 수 × 5)과 그 목록을 우선순위 순서대로 넘깁니다. 후보는 편수보다 넉넉히(1.5배쯤) 넘기면 몫이 찬 계정의 키워드가 남고 모자란 계정이 줄어듭니다.`,
    "3. 결과에 모자란 계정이 있으면 약한 트렌드로 채우지 말고, discover_keywords로 그 계정 분야의 상시·시즌 키워드를 찾아 assign_account_keywords를 다시 부릅니다 (이어 넣음).",
    "4. 결과 표를 계정별로 사용자에게 보여 주고, 표의 계정·분야·형식·발행일 그대로 씁니다. save_draft에 account(계정 이름)·topic·format·date를 넣습니다. 연관어로 메인 키워드를 바꿨으면 plan_keyword에 표의 원래 키워드를 넣습니다.",
    "5. save_draft 결과의 '계정 계획 현황'과 '확인' 줄을 보고 어긋나면 고칩니다. 계정끼리 같은 키워드를 쓰게 되면 형식·구성·각도·제목·도입을 다르게 씁니다 (계정 겹침 점검).",
  ].join("\n");
}

/** 공백을 뺀 두 글자 묶음의 겹침 (0~1). 제목·도입 문장이 비슷한지 대략 본다 */
export function textSimilarity(a: string, b: string) {
  const grams = (s: string) => {
    const t = s.replace(/\s+/g, "");
    const set = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    return set;
  };
  const x = grams(a);
  const y = grams(b);
  if (!x.size || !y.size) return 0;
  let same = 0;
  for (const g of x) if (y.has(g)) same++;
  return same / (x.size + y.size - same);
}

const TITLE_SIMILAR = 0.5;
const OPENING_SIMILAR = 0.4;

export interface OverlapDraft {
  file: string;
  /** 계정 이름 */
  account: string;
  format: string | null;
  title: string | null;
  opening: string | null;
}

/**
 * save_draft·update_draft 결과에 붙일 계정 간 겹침 점검. 다른 계정에 같은 키워드 초안이 없으면 null.
 * 겹치는 것 자체는 괜찮고, 형식·제목·도입 문장까지 비슷하면 고치게 한다
 */
export function accountOverlapFeedback(current: { format: string | null; title: string | null; opening: string | null }, others: OverlapDraft[]) {
  if (!others.length) return null;
  const formatLabel = (f: string | null) => (f === "home" ? "홈판형" : "검색형");
  const problems = others.flatMap((o) => {
    const found: string[] = [];
    if (formatLabel(o.format) === formatLabel(current.format)) found.push(`형식이 같은 ${formatLabel(o.format)}입니다. 구성(structure)과 세부 질문(각도)이 다른지 확인하세요`);
    if (current.title && o.title && textSimilarity(current.title, o.title) >= TITLE_SIMILAR) found.push(`제목이 비슷합니다 ("${o.title}")`);
    if (current.opening && o.opening && textSimilarity(current.opening, o.opening) >= OPENING_SIMILAR) found.push("도입 문장이 비슷합니다");
    return found.map((f) => `- ${o.account} (${o.file}): ${f}`);
  });
  return [
    `계정 겹침 점검: 다른 계정에 같은 키워드 초안이 ${others.length}개 있습니다 (${others.map((o) => o.account).join(", ")}).`,
    ...problems,
    problems.length
      ? "- 비슷한 글은 유사문서로 함께 밀립니다. 각도·제목·도입을 바꿔 update_draft로 다시 저장하세요. 같은 날 올리면 발행 시간을 떨어뜨리세요."
      : "- 형식·제목·도입이 달라 괜찮습니다. 같은 날 올리면 발행 시간을 떨어뜨리세요.",
  ].join("\n");
}
