/**
 * 지식iN 질문에 내 블로그 글로 답하는 답변을 Claude에게 부탁하는 요청문 (초안 목록의 복사 버튼, 브라우저에서도 쓴다)
 *
 * 링크만 던지는 답변은 질문자에게 도움이 안 되고 지식iN에서 홍보로 제재받기 쉽다.
 * 그래서 답변 안에서 질문에 먼저 답하고, 글에 실제로 있는 것(표·순서·예시)을 더 볼 이유로 들어 링크를 한 번만 잇게 한다.
 * 글로 답할 수 없는 질문이면 답변하지 말라고 하게 한다 (안 맞는 답변은 안 하느니만 못하다).
 */

/** 사람이 채울 자리 표시 (drafts.ts의 MARKER_PATTERN과 같은 모양. 그 파일은 node:fs를 써서 브라우저에서 못 가져온다) */
const MARKER = /\[(?:이미지|직접 작성|확인 필요):[^\]]*\]/g;

/** 초안 본문(네이버 텍스트 또는 HTML) → Claude가 읽을 일반 텍스트. 이미지 자리는 뺀다 */
export function draftPlainText(body: string) {
  const isHtml = /<\/?(?:h[1-6]|p|div|ul|ol|table)\b/i.test(body);
  const text = isHtml
    ? body
        .replace(/<h[1-6][^>]*>/gi, "\n■ ")
        .replace(/<li[^>]*>/gi, "\n- ")
        .replace(/<\/(?:td|th)>/gi, " | ")
        .replace(/<\/(?:h[1-6]|p|div|li|tr|table|ul|ol|blockquote)>|<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
    : body;
  return text
    .replace(MARKER, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface KinAnswerInput {
  question: { title: string; link: string; description: string };
  /** 질문 페이지에서 복사해 붙여넣은 질문 본문 (API는 앞부분 요약만 준다) */
  questionBody?: string;
  /** 발행한 글 제목 */
  postTitle: string;
  /** 발행한 글 주소. 없으면 [글 주소] 자리로 둔다 */
  postUrl?: string;
  /** 초안 본문 */
  body: string;
}

export function buildKinAnswerPrompt({ question, questionBody, postTitle, postUrl, body }: KinAnswerInput) {
  const pasted = questionBody?.trim();
  const url = postUrl?.trim() || "[글 주소]";
  return [
    "네이버 지식iN 질문에 답변을 써 주세요. 제가 쓴 블로그 글의 내용으로 답하고, 더 자세히 볼 사람은 글로 자연스럽게 넘어가게 하려는 답변이에요.",
    "",
    "[질문]",
    `제목: ${question.title}`,
    pasted ? `본문:\n${pasted}` : `본문(검색 결과의 앞부분 요약이라 잘려 있을 수 있음): ${question.description}`,
    "",
    "[제 블로그 글]",
    `제목: ${postTitle}`,
    `주소: ${url}`,
    "본문:",
    draftPlainText(body),
    "",
    "[먼저 판단하기]",
    "- 이 글의 내용으로 질문에 실제로 도움이 되는 답을 할 수 있는지 먼저 보세요.",
    "- 질문이 글과 다른 것을 묻거나(예: 글은 고르는 법인데 질문은 특정 제품 고장), 글로는 답이 안 되면 답변을 쓰지 말고 '답변 비추천: 이유' 한 줄만 써 주세요. 억지로 이어 붙인 답변은 안 하느니만 못해요.",
    "",
    "[답변 규칙]",
    "- 질문자의 상황을 한 문장으로 짚고, 질문에 대한 답부터 바로 말하기. 링크를 누르지 않아도 답을 얻을 수 있게",
    "- 글에 있는 내용만 쓰기. 글에 없는 사실·숫자·경험은 지어내지 않기",
    "- 질문과 관련된 부분만 골라서. 글 전체를 요약하지 않기",
    "- 300~600자, 존댓말, 이웃에게 알려 주듯 친근하게. 광고·홍보 말투(꼭 보세요, 방문해 주세요, 제 블로그에)는 쓰지 않기",
    "- 링크는 마지막 문단에 딱 한 번. 글에 실제로 있는 것(비교표, 단계별 순서, 계산 예시 등) 중 이 질문자에게 더 필요한 것을 구체적으로 들어 '더 볼 이유'를 말하고 주소를 붙이기",
    `  예: "종류별 장단점은 표로 비교해 둔 글이 있어서 같이 보시면 고르기 편하실 거예요. ${url}"`,
    "- 질문마다 다른 문장으로 (같은 답변을 여러 질문에 붙이면 지식iN에서 홍보로 제재받아요)",
    "- 마크다운(**, #, 목록 기호) 없이 지식iN에 그대로 붙여넣을 수 있는 일반 문장으로",
    "",
    "[출력]",
    "지식iN에 붙여넣을 답변 본문만 써 주세요 (앞뒤 설명 없이). 답변하지 않는 게 낫다면 '답변 비추천: 이유' 한 줄만.",
  ].join("\n");
}
