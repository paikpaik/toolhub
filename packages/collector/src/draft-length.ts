/**
 * 초안 본문 분량 세기와 저장할 때의 피드백 (MCP save_draft·update_draft)
 * 모델은 글자 수를 직접 세지 못하고, 범위만 주면 아래 끝에 맞춰 쓰는 경향이 있어서
 * 범위 가운데의 "목표"를 두고, 저장할 때 실제 글자 수를 알려 줘 모자라면 바로 보완하게 한다.
 */
import { MARKER_PATTERN } from "./drafts.ts";
import { isPlatform, type Platform } from "./platforms.ts";

/** 플랫폼별 본문 분량 (공백 포함). docs/prompts/platforms/*.md의 "분량"과 같게 둔다 */
export const BODY_LENGTH: Record<Platform, { min: number; target: number; max: number }> = {
  naver: { min: 1500, target: 2000, max: 2500 },
  tistory: { min: 2000, target: 2500, max: 3000 },
  blogger: { min: 2000, target: 2700, max: 3500 },
};

/** 목표의 이 비율보다 짧으면 보완하라고 한다 (네이버 1,800자) */
const SHORT_RATIO = 0.9;

/** 본문 글자 수: 공백 포함, 줄바꿈·이미지 자리·■·★·표 머리 표시·HTML 태그는 빼고 (writing.md의 분량 세는 법) */
export function bodyLength(body: string) {
  return body
    .replace(MARKER_PATTERN, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/^\[표:\s*(.*)\]$/gm, "$1")
    .replace(/[■★]/g, "")
    .replace(/\s*\n\s*/g, "")
    .trim().length;
}

/** 초안 파일 이름의 플랫폼 (YYYY-MM-DD-키워드-플랫폼[-n].md) */
export function draftPlatform(file: string): Platform | null {
  const platform = /-([a-z]+)(?:-\d+)?\.md$/.exec(file)?.[1];
  return isPlatform(platform) ? platform : null;
}

/** 저장 결과에 붙일 분량 안내. 모자라거나 넘치면 고쳐서 다시 저장하라고 한다 */
export function lengthFeedback(platform: Platform | null, body: string | null) {
  if (!platform) return null;
  if (body === null) return "본문 코드 블록을 찾지 못해 글자 수를 세지 못했습니다. 출력 형식대로 ## 본문 아래 코드 블록 하나에 넣었는지 확인하세요.";
  const n = bodyLength(body);
  const { min, target, max } = BODY_LENGTH[platform];
  const range = `목표 ${target.toLocaleString()}자, 범위 ${min.toLocaleString()}~${max.toLocaleString()}자`;
  if (n < target * SHORT_RATIO) {
    return [
      `본문 ${n.toLocaleString()}자: ${range}보다 ${(target - n).toLocaleString()}자 짧습니다. 지금 보완해서 update_draft로 다시 저장하세요.`,
      "- 소제목마다 검색자가 궁금해할 다음 질문의 답, 구체적인 예시·계산, 상황별 판단(이런 경우엔 이렇게)을 더합니다.",
      "- 같은 말 되풀이·빈말·확인 안 된 사실로 늘리지 않습니다.",
    ].join("\n");
  }
  if (n > max) return `본문 ${n.toLocaleString()}자: ${range}보다 깁니다. 겹치는 설명을 줄여 update_draft로 다시 저장하세요.`;
  return `본문 ${n.toLocaleString()}자 (${range}) — 분량 맞음`;
}
