/**
 * 초안 제목 점검 (MCP save_draft·update_draft). 하루에 여러 편을 쓰면 "~ 정리", "~ 한눈에"처럼 끝맺음이 같아져
 * 목록·홈판 카드에서 다 같은 글로 보인다. 금지 끝맺음과, 최근 초안들과 겹치는 끝맺음을 알려 주고 고치게 한다.
 * 규칙은 docs/prompts/platforms/naver.md의 "제목"과 같게 둔다.
 */

/** 쓰지 않는 끝맺음 (뒤의 쉼표·물음표 등은 빼고 본다) */
export const BANNED_TITLE_ENDINGS = ["총정리", "정리", "한눈에", "한눈에 보기", "체크할 것", "확인할 것", "알아보기"] as const;

/** 최근 초안 이 개수 중 */
export const RECENT_TITLE_COUNT = 20;
/** 끝맺음이 이만큼 겹치면 알린다 (한두 번은 우연) */
const REPEAT_LIMIT = 3;

const trimEnd = (title: string) => title.trim().replace(/[\s.,!?…~·'"“”‘’)\]]+$/, "");

/** 금지 끝맺음이면 그 끝맺음, 아니면 null */
export function bannedEnding(title: string) {
  const bare = trimEnd(title);
  // 긴 것부터 ("한눈에 보기"를 "보기"보다, "총정리"를 "정리"보다 먼저)
  return [...BANNED_TITLE_ENDINGS].sort((a, b) => b.length - a.length).find((ending) => bare.endsWith(ending)) ?? null;
}

/** 제목의 마지막 낱말 (끝맺음 비교용) */
export const titleEnding = (title: string) => trimEnd(title).split(/[\s,]+/).at(-1) ?? "";

/**
 * 저장 결과에 붙일 제목 안내. 문제가 없으면 null.
 * candidates: 제목 후보 전부, recommended: 추천 제목, recent: 최근 초안들의 추천 제목 (이 초안 제외, 최근 순)
 */
export function titleFeedback(candidates: string[], recommended: string | null, recent: string[]) {
  const problems: string[] = [];
  const banned = candidates.flatMap((title) => {
    const ending = bannedEnding(title);
    return ending ? [`"${title}" (${ending})`] : [];
  });
  if (banned.length) problems.push(`쓰지 않는 끝맺음입니다: ${banned.join(", ")}`);

  if (recommended) {
    const ending = titleEnding(recommended);
    const same = recent.slice(0, RECENT_TITLE_COUNT).filter((title) => ending && titleEnding(title) === ending);
    if (same.length >= REPEAT_LIMIT) {
      problems.push(`추천 제목의 끝맺음 "${ending}"이 최근 초안 ${Math.min(recent.length, RECENT_TITLE_COUNT)}개 중 ${same.length}개와 같습니다 (예: ${same.slice(0, 2).map((t) => `"${t}"`).join(", ")})`);
    }
  }
  if (!problems.length) return null;
  return [
    "제목 점검:",
    ...problems.map((p) => `- ${p}`),
    "- 끝맺음을 이 글의 세부 질문(검색형)이나 판단·궁금증(홈판형)으로 바꿔 update_draft로 다시 저장하세요. 예: \"○○ 주차, 몇 시 전에 가야 자리 있나\"",
  ].join("\n");
}
