/**
 * 초안으로 Gemini 같은 이미지 AI에 그대로 붙여넣을 "이미지 5장" 요청문을 만든다 (초안 화면의 복사 버튼).
 *
 * 초안의 [이미지: …] 자리는 대부분 공식 사이트 화면·표처럼 직접 캡처할 것이라, AI가 그리면 사실과 다른 가짜 화면이 된다.
 * 그래서 대표 이미지 1장 + 소제목별 상황·개념 이미지 4장으로 나누고, 글자·화면·표는 넣지 않게 한다.
 */
import { MARKER_PATTERN } from "./drafts.ts";

export const IMAGE_PROMPT_COUNT = 5;

export const IMAGE_PROMPT_STYLES = {
  photo: { label: "사진", prompt: "실제 사진처럼 자연스러운 스타일 (자연광, 생활감 있는 장면)" },
  illustration: { label: "일러스트", prompt: "깔끔한 플랫 일러스트 스타일 (부드러운 파스텔 색감, 단순한 형태)" },
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

export interface ImagePromptInput {
  title: string;
  keyword: string;
  body: string | null;
  style?: ImagePromptStyle;
}

export function buildImagePrompt({ title, keyword, body, style = "photo" }: ImagePromptInput) {
  const sections = spreadPick(bodySections(body ?? ""), IMAGE_PROMPT_COUNT - 1);
  const items = [
    `1. 대표 이미지: 글 전체를 한눈에 보여 주는 장면. 정사각형으로 잘려도 보이도록 핵심 대상을 가운데에 둔다.`,
    ...sections.map((s, i) => `${i + 2}. "${s.heading}" 부분에 넣을 이미지${s.lead ? `: ${s.lead}` : ""}`),
  ];
  // 소제목이 4개보다 적으면 남은 장은 글 주제로 채운다
  for (let i = items.length; i < IMAGE_PROMPT_COUNT; i++) {
    items.push(`${i + 1}. 글 주제("${keyword}")와 관련된 다른 장면 (앞 이미지들과 겹치지 않게)`);
  }

  return [
    `블로그 글에 넣을 이미지 ${IMAGE_PROMPT_COUNT}장을 만들어 주세요. 아래 목록대로 한 장씩 따로 생성해 주세요.`,
    `한 번에 다 만들지 못하면 1번부터 만들고, 제가 "다음"이라고 하면 이어서 만들어 주세요.`,
    "",
    `글 제목: ${title}`,
    `주제: ${keyword}`,
    "",
    "[공통 규칙]",
    `- ${IMAGE_PROMPT_STYLES[style].prompt}`,
    "- 모두 가로 4:3 비율",
    `- ${IMAGE_PROMPT_COUNT}장이 한 글에 들어가니 색감과 분위기를 통일`,
    "- 한국을 배경으로, 사람이 나오면 한국인으로",
    "- 이미지 안에 글자·숫자·로고·워터마크를 넣지 않기 (한글이 깨지고, 틀린 정보처럼 보일 수 있음)",
    "- 웹사이트 화면·서류·표·영수증처럼 실제 정보를 흉내 낸 이미지는 만들지 않기",
    "- 실존 인물·브랜드·상표가 드러나지 않게",
    "",
    "[이미지 목록]",
    ...items,
    "",
    "각 이미지 아래에 '대체 텍스트(alt): 이미지를 한 문장으로 설명'을 한 줄 적어 주세요.",
  ].join("\n");
}
