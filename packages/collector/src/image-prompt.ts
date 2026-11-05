/**
 * 초안으로 Gemini 같은 이미지 AI에 그대로 붙여넣을 이미지 요청문을 만든다 (초안 화면의 복사 버튼).
 *
 * 초안은 대표 썸네일 1개(본문 첫 줄 "[이미지: 대표 썸네일 | …]") + 본문 이미지 5개를 둔다 (writing.md).
 * 대표 썸네일은 사람이 썸네일 만들기로 직접 만들어서 요청문에 넣지 않는다.
 * 요청문은 늘 5장: 1~5번이 본문 이미지 1~5번을 적힌 장면 그대로 요청해 초안과 번호까지 1:1로 맞춘다.
 * 예전 초안처럼 자리가 모자라면 이미지 자리가 없는 소제목으로 채우고, 화면·표·직접 만든 카드 자리는
 * AI가 그리면 사실과 다른 가짜가 되어 뺀다. 글자·화면·표는 넣지 않게 한다.
 */
import { MARKER_PATTERN } from "./drafts.ts";

/** 본문 이미지 개수 (대표 썸네일 빼고) */
export const BODY_IMAGE_COUNT = 5;
/** 요청하는 장수: 본문 이미지만 (대표 썸네일은 사람이 썸네일 만들기로 만든다) */
export const IMAGE_PROMPT_COUNT = BODY_IMAGE_COUNT;

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
    // 표 머리([표: …])와 표의 줄(값 | 값)은 장면 단서가 아니다
    const clean = line.replace(MARKER_PATTERN, "").replace(/^\[표:.*$/, "").replace(/^.*\|.*$/, "").replace(/^★\s*/, "").trim();
    if (current && !current.lead && clean.length >= 10) current.lead = clean.length > 90 ? `${clean.slice(0, 90)}…` : clean;
  }
  return sections;
}

export interface ImageSlot {
  /** 이미지 자리가 있는 소제목 (도입부면 빈 문자열) */
  heading: string;
  /** 초안에 적힌 "무엇을 보여주는 이미지인지" */
  scene: string;
  /** 본문의 몇 번째 이미지 자리인지 (1부터, 대표 썸네일은 세지 않음. 초안의 이미지 목록 번호) */
  index: number;
}

/** 대표 썸네일 자리: 장면 앞의 "대표 썸네일:" */
const THUMBNAIL = /^대표\s*썸네일\s*[:：-]?\s*/;

/** AI로 만드는 자리. 예전 초안의 직접 찍을 사진 자리도 쓰되, 화면·표·서류처럼 실제 정보를 담는 건 뺀다 */
const AI_SLOT = /AI 생성/;
const PHOTO_SLOT = /직접 촬영|무료 사진/;
const INFO_SCENE = /화면|캡처|표|조항|서류|계약서|영수증|문구|체크리스트|메모/;

/**
 * 본문에서 AI로 만들 이미지 자리를 순서대로 (어느 소제목 아래인지, 몇 번째 자리인지와 함께).
 * 대표 썸네일 자리는 따로 돌려준다 (예전 초안은 장면이 적혀 있고, 지금 초안은 장면 없이 "대표 썸네일"만)
 */
export function photoSlots(body: string): { thumbnail: string | null; slots: ImageSlot[] } {
  const slots: ImageSlot[] = [];
  let thumbnail: string | null = null;
  let heading = "";
  let index = 0;
  for (const line of toPlainLines(body)) {
    const found = HEADING.exec(line)?.[1]?.trim();
    if (found) heading = found;
    for (const m of line.matchAll(MARKER_PATTERN)) {
      if (m[1] !== "이미지") continue;
      const [first = "", ...rest] = m[2]!.split("|").map((part) => part.trim());
      if (THUMBNAIL.test(first)) {
        thumbnail ??= first.replace(THUMBNAIL, "");
        continue;
      }
      index++;
      const recommend = rest.find((part) => part.startsWith("추천:")) ?? "";
      if (AI_SLOT.test(recommend) || (PHOTO_SLOT.test(recommend) && !INFO_SCENE.test(first))) slots.push({ heading, scene: first, index });
    }
  }
  return { thumbnail, slots };
}

/** 소제목이 많으면 글 전체에 고르게 퍼지도록 n개를 고른다 */
export function spreadPick<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  if (n <= 0) return [];
  // 하나만 고를 때는 가운데 (아래 식은 n - 1로 나눠서 n이 1이면 못 쓴다)
  if (n === 1) return [items[Math.floor((items.length - 1) / 2)]!];
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]!);
}

/**
 * 장면 단서에 숫자가 있으면 "글자 넣지 말기" 규칙이 있어도 달력·그래프·숫자를 그려 넣어 한글이 깨지기 쉽다.
 * 소제목은 단위가 붙은 숫자(500만원, 64년생)와 괄호 설명만 지우고(4대보험 같은 이름은 그대로),
 * 첫 문단은 숫자가 들어간 문장을 통째로 뺀다 (숫자만 지우면 "공제율이 로 올랐어요"처럼 문장이 깨진다)
 */
const NUMBER_WITH_UNIT = /(?:[~·]\s*)?\d[\d,.]*(?:\s*(?:[~·]|년|개월)?\s*\d[\d,.]*)*\s*(?:만\s*원|천\s*원|억\s*원|원|만|천|억|%|퍼센트|배|년생|년|월|일|세|살|개월|가지|명|회|시간|시|분)(?:까지|부터|이상|이하|초과|미만|씩|에|은|는|이|가|을|를|의|도)?/g;

export function stripNumbers(heading: string) {
  return heading
    .replace(/\([^)]*\)/g, "")
    .replace(NUMBER_WITH_UNIT, " ")
    // 숫자를 지우고 남은 조사 (…년 6개월로 → 로)
    .replace(/\s(?:로|으로|면|이면)(?=\s|$)/g, " ")
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
  /** 지금은 쓰지 않지만 부르는 쪽 모양을 그대로 둔다 */
  title: string;
  keyword: string;
  body: string | null;
  style?: ImagePromptStyle;
}

export function buildImagePrompt({ keyword, body, style = "photo" }: ImagePromptInput) {
  const all = bodySections(body ?? "");
  // 본문 이미지 자리 5개를 그대로 (많으면 고르게 5개), 모자라면 이미지 자리가 없는 소제목에서 고르게. 둘 다 본문 순서로 놓는다
  const found = photoSlots(body ?? "");
  const slots = spreadPick(found.slots, BODY_IMAGE_COUNT);
  const covered = new Set(slots.map((s) => s.heading));
  const sections = spreadPick(
    all.filter((s) => !covered.has(s.heading)),
    BODY_IMAGE_COUNT - slots.length,
  );
  const order = (heading: string) => all.findIndex((s) => s.heading === heading);
  const where = (heading: string) => (heading ? `"${stripNumbers(heading)}"` : "도입부");
  const entries = [
    // 이미지 자리의 괄호는 장면 설명(투명한 껍질 등)이라 남기고 숫자만 지운다
    ...slots.map((s) => ({
      at: order(s.heading),
      text: `본문 이미지 ${s.index}번 (${where(s.heading)}): ${stripNumbers(s.scene.replace(/[()]/g, (c) => (c === "(" ? " — " : "")))}`,
    })),
    ...sections.map((s) => {
      const lead = sentencesWithoutNumbers(s.lead);
      // "아니에요."처럼 너무 짧으면 장면 단서가 안 된다
      return { at: order(s.heading), text: `${where(s.heading)} 부분${lead.length >= 10 ? ` (내용: ${lead})` : ""}` };
    }),
  ].sort((a, b) => a.at - b.at);
  const items = entries.map((e, i) => `${i + 1}. ${e.text}`);
  // 이미지 자리도 소제목도 모자라면 남은 장은 글 주제로 채운다
  for (let i = items.length; i < IMAGE_PROMPT_COUNT; i++) {
    items.push(`${i + 1}. 글 주제("${keyword}")와 관련된 다른 장면 (앞 이미지들과 겹치지 않게)`);
  }
  const count = IMAGE_PROMPT_COUNT;
  const filled = slots.length < BODY_IMAGE_COUNT;

  // Gemini가 장면 여러 개를 한 장(격자·콜라주)으로 합쳐 주는 일이 잦아서, 맨 앞과 맨 끝에 "따로 n장"을 못 박는다
  return [
    `블로그 글에 넣을 이미지 ${count}장을 만들어 주세요. 결과물은 서로 다른 이미지 파일 ${count}개입니다.`,
    `이번 답변 하나에서 1번부터 ${count}번까지 모두 연달아 생성해 주세요. 중간에 확인을 묻거나 멈추지 마세요.`,
    "",
    "[가장 중요: 한 장에 장면 하나]",
    `- 이미지 1장에는 목록의 장면 1개만 담아 주세요. ${count}개 장면을 한 장에 합치지 마세요.`,
    "- 격자(2×2·3×2)·콜라주·분할 화면·여러 칸으로 나눈 이미지·좌우/상하 비교 이미지·스토리보드·연속 컷은 만들지 않기",
    `- 1번을 생성해 1장을 보여 준 뒤, 2번을 새 이미지로 따로 생성하는 식으로 ${count}번까지 이미지를 ${count}번 생성해 주세요.`,
    "",
    `글 주제: ${keyword}`,
    "",
    "[장면 정하기]",
    "'본문 이미지'는 적힌 장면 그대로 그려 주세요. 그 밖의 항목은 내용을 떠올리게 하는, 실제로 있을 법한 장면 하나를 정해서 그려 주세요.",
    "- 세금·제도·절차 같은 추상적인 내용은 그 상황에 놓인 사람이나 사물로 표현 (예: 집에서 노트북으로 서류를 정리하는 직장인, 계산기와 커피가 놓인 식탁)",
    `- ${count}장은 서로 다른 장면·구도로: 사물 가까이, 사람 상반신, 공간 전체를 섞기`,
    "",
    "[블로그 이미지 규칙]",
    ...IMAGE_PROMPT_STYLES[style].rules.map((r) => `- ${r}`),
    "- 한 장 한 장이 가로 4:3 비율의 단독 이미지. 한 글에 들어가니 색감과 분위기만 서로 맞추기",
    "- 한국을 배경으로, 사람이 나오면 한국인으로",
    "- 이미지 안에 글자·숫자·로고·워터마크를 넣지 않기 (한글이 깨지고 틀린 정보처럼 보임)",
    "- 노트북·휴대폰 화면이 보이면 화면은 흐리게 하거나 비스듬히 (글자가 보이지 않게)",
    "- 웹사이트 화면·서류 내용·표·영수증처럼 실제 정보를 흉내 낸 이미지는 만들지 않기",
    "- 실존 인물·브랜드·상표가 드러나지 않게",
    "",
    `[이미지 목록: 번호 하나 = 이미지 1장, 모두 ${count}장]`,
    ...items,
    // 본문 이미지는 초안에 alt가 있어서, 소제목·주제로 채운 장이 있을 때만 alt를 받는다
    ...(filled ? ["", `${count}장을 다 만든 뒤, 번호마다 '대체 텍스트(alt): 이미지를 한 문장으로 설명'을 적어 주세요.`] : []),
    "",
    `다시 한 번: 위 ${count}개 장면을 하나로 합친 이미지가 아니라, 장면 하나씩 담은 이미지를 1번부터 ${count}번까지 따로따로 ${count}장 만들어 주세요.`,
  ].join("\n");
}
