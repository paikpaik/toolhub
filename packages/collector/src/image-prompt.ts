/**
 * 초안으로 Gemini 같은 이미지 AI에 그대로 붙여넣을 "이미지 5장" 요청문을 만든다 (초안 화면의 복사 버튼).
 *
 * 초안의 [이미지: …] 자리는 대부분 공식 사이트 화면·표처럼 직접 캡처할 것이라, AI가 그리면 사실과 다른 가짜 화면이 된다.
 * 그래서 대표 이미지 1장 + 소제목별 상황·개념 이미지 4장으로 나누고, 글자·화면·표는 넣지 않게 한다.
 */
import { MARKER_PATTERN } from "./drafts.ts";

export const IMAGE_PROMPT_COUNT = 5;

/** 스타일별 규칙. 사진은 "AI 티"(과한 보정·광택·어색한 손)가 블로그 신뢰를 깎아서 스마트폰 사진처럼 요청한다 */
export const IMAGE_PROMPT_STYLES = {
  photo: {
    label: "사진",
    rules: [
      "스마트폰으로 직접 찍은 듯한 자연스러운 사진 (자연광, 생활감 있는 공간, 약간의 흐림·그림자 허용)",
      "광고 사진처럼 과한 보정·번들거림·완벽한 미소는 피하기",
      "얼굴 정면 클로즈업과 손가락 클로즈업은 피하기 (어색하게 나오기 쉬움). 사람은 옆모습·뒷모습·상반신 정도로",
    ],
  },
  illustration: {
    label: "일러스트",
    rules: ["깔끔한 플랫 일러스트 (부드러운 파스텔 색감, 단순한 형태, 배경은 단색이나 단순하게)"],
  },
} as const;
export type ImagePromptStyle = keyof typeof IMAGE_PROMPT_STYLES;

export interface BodySection {
  heading: string;
  /** 소제목 바로 아래 첫 문단 (장면을 정하는 단서) */
  lead: string;
}

/** HTML 본문(티스토리·Blogger)은 소제목을 ## 줄로 바꾸고 태그를 걷어낸다 */
function toPlainLines(body: string) {
  const text = /<\/?(?:h[1-6]|p|div|br)\b/i.test(body)
    ? body
        .replace(/<h[23][^>]*>/gi, "\n## ")
        .replace(/<\/(?:h[1-6]|p|div|li)>|<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
    : body;
  return text.split("\n").map((line) => line.trim());
}

/** 소제목: 네이버 본문의 "■ …", 마크다운 "## …"·"### …" */
const HEADING = /^(?:■|#{2,3})\s*(.+)$/;

/** 본문을 소제목 단위로 나눈다. 첫 문단에서 이미지·직접 작성·확인 필요 자리는 뺀다 */
export function bodySections(body: string): BodySection[] {
  const sections: BodySection[] = [];
  for (const line of toPlainLines(body)) {
    const heading = HEADING.exec(line)?.[1]?.trim();
    if (heading) {
      sections.push({ heading, lead: "" });
      continue;
    }
    const current = sections.at(-1);
    const clean = line.replace(MARKER_PATTERN, "").replace(/^\[표:.*$/, "").replace(/^★\s*/, "").trim();
    if (current && !current.lead && clean.length >= 10) current.lead = clean.length > 90 ? `${clean.slice(0, 90)}…` : clean;
  }
  return sections;
}

/** 소제목이 많으면 글 전체에 고르게 퍼지도록 n개를 고른다 */
export function spreadPick<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]!);
}

/**
 * 장면 단서에 숫자가 있으면 "글자 넣지 말기" 규칙이 있어도 달력·그래프·숫자를 그려 넣어 한글이 깨지기 쉽다.
 * 소제목은 단위가 붙은 숫자(500만원, 64년생)와 괄호 설명만 지우고(4대보험 같은 이름은 그대로),
 * 첫 문단은 숫자가 들어간 문장을 통째로 뺀다 (숫자만 지우면 "공제율이 로 올랐어요"처럼 문장이 깨진다)
 */
const NUMBER_WITH_UNIT = /(?:[~·]\s*)?\d[\d,.]*\s*(?:만\s*원|천\s*원|억\s*원|원|만|천|억|%|퍼센트|배|년생|년|월|일|세|살|개월|가지|명|회|시간|분)(?:까지|부터|이상|이하|초과|미만|씩|에|은|는|이|가|을|를|의|도)?/g;

export function stripNumbers(heading: string) {
  return heading
    .replace(/\([^)]*\)/g, "")
    .replace(NUMBER_WITH_UNIT, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/(?:^|\s)[,.](?=\s|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function sentencesWithoutNumbers(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\d/.test(sentence))
    .join(" ")
    .trim();
}

export interface ImagePromptInput {
  title: string;
  keyword: string;
  body: string | null;
  style?: ImagePromptStyle;
}

export function buildImagePrompt({ title, keyword, body, style = "photo" }: ImagePromptInput) {
  const sections = spreadPick(bodySections(body ?? ""), IMAGE_PROMPT_COUNT - 1);
  const items = [
    `1. 대표 이미지: 글 전체("${stripNumbers(title)}")를 대표하는 장면. 썸네일로 정사각형으로 잘려도 보이도록 핵심 대상을 가운데에`,
    ...sections.map((s, i) => {
      const lead = sentencesWithoutNumbers(s.lead);
      return `${i + 2}. "${stripNumbers(s.heading)}" 부분${lead ? ` (내용: ${lead})` : ""}`;
    }),
  ];
  // 소제목이 4개보다 적으면 남은 장은 글 주제로 채운다
  for (let i = items.length; i < IMAGE_PROMPT_COUNT; i++) {
    items.push(`${i + 1}. 글 주제("${keyword}")와 관련된 다른 장면 (앞 이미지들과 겹치지 않게)`);
  }

  return [
    `블로그 글에 넣을 이미지 ${IMAGE_PROMPT_COUNT}장을 만들어 주세요.`,
    `이번 답변 하나에서 1번부터 ${IMAGE_PROMPT_COUNT}번까지 모두 연달아 생성해 주세요. 한 장마다 따로 생성하고, 중간에 확인을 묻거나 멈추지 마세요.`,
    "",
    `글 주제: ${keyword}`,
    "",
    "[장면 정하기]",
    "각 항목의 내용을 떠올리게 하는, 실제로 있을 법한 장면 하나를 정해서 그려 주세요.",
    "- 세금·제도·절차 같은 추상적인 내용은 그 상황에 놓인 사람이나 사물로 표현 (예: 집에서 노트북으로 서류를 정리하는 직장인, 계산기와 커피가 놓인 식탁)",
    `- ${IMAGE_PROMPT_COUNT}장은 서로 다른 장면·구도로: 사물 가까이, 사람 상반신, 공간 전체를 섞기`,
    "",
    "[블로그 이미지 규칙]",
    ...IMAGE_PROMPT_STYLES[style].rules.map((r) => `- ${r}`),
    "- 모두 가로 4:3 비율, 한 글에 들어가니 색감과 분위기를 통일",
    "- 한국을 배경으로, 사람이 나오면 한국인으로",
    "- 이미지 안에 글자·숫자·로고·워터마크를 넣지 않기 (한글이 깨지고 틀린 정보처럼 보임)",
    "- 노트북·휴대폰 화면이 보이면 화면은 흐리게 하거나 비스듬히 (글자가 보이지 않게)",
    "- 웹사이트 화면·서류 내용·표·영수증처럼 실제 정보를 흉내 낸 이미지는 만들지 않기",
    "- 실존 인물·브랜드·상표가 드러나지 않게",
    "",
    "[이미지 목록]",
    ...items,
    "",
    `${IMAGE_PROMPT_COUNT}장을 다 만든 뒤, 번호마다 '대체 텍스트(alt): 이미지를 한 문장으로 설명'을 적어 주세요.`,
  ].join("\n");
}
