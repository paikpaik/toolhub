/** 글을 발행할 플랫폼. Node 전용 모듈을 import하지 않아 브라우저 코드에서도 쓸 수 있다. */
export const PLATFORMS = ["tistory", "blogger", "naver"] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  tistory: "티스토리",
  blogger: "Blogger",
  naver: "네이버",
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** 글 유형. 유형마다 글 구조와 사람이 채울 자리 기준이 다르다 (docs/prompts/types/*.md) */
export const WRITING_TYPES = ["info", "review", "place", "connect"] as const;

export type WritingType = (typeof WRITING_TYPES)[number];

export const WRITING_TYPE_LABELS: Record<WritingType, string> = {
  info: "정보",
  review: "리뷰",
  place: "장소",
  connect: "쇼핑 커넥트",
};

export function isWritingType(value: unknown): value is WritingType {
  return typeof value === "string" && (WRITING_TYPES as readonly string[]).includes(value);
}

/**
 * 글 구성 변형. 같은 유형의 글이 매번 같은 틀이 되지 않도록 브리프마다 하나를 골라 준다.
 * 구조의 정의는 docs/prompts/types/*.md의 "구성 변형"에 있고, 여기서는 문자와 이름만 안다 (이름은 프롬프트와 맞춘다).
 */
export const STRUCTURES = ["A", "B", "C", "D"] as const;

export type Structure = (typeof STRUCTURES)[number];

export const STRUCTURE_NAMES: Record<WritingType, Record<Structure, string>> = {
  info: { A: "질문 답변형", B: "결론 먼저형", C: "상황으로 시작형", D: "비교·표 중심형" },
  review: { A: "요약 먼저형", B: "사용 기간 순", C: "장단점 중심형", D: "비교형" },
  place: { A: "정보 먼저형", B: "방문 동선 순", C: "추천 포인트형", D: "상황별 가이드" },
  connect: { A: "요약 먼저형", B: "고민 해결형", C: "장단점 중심형", D: "비교형" },
};

/** 쇼핑 커넥트 글 방식. experience: 사람이 준 경험 메모로 1인칭 후기, guide: 경험 없이 구매 가이드 */
export const CONNECT_MODES = ["guide", "experience"] as const;

export type ConnectMode = (typeof CONNECT_MODES)[number];

export const CONNECT_MODE_LABELS: Record<ConnectMode, string> = {
  guide: "구매 가이드",
  experience: "실제 경험",
};

export function isConnectMode(value: unknown): value is ConnectMode {
  return typeof value === "string" && (CONNECT_MODES as readonly string[]).includes(value);
}

/** 네이버 브랜드커넥트가 링크 발급 시 반드시 넣으라고 안내하는 대가성 문구 (글자 그대로 쓴다) */
export const CONNECT_DISCLOSURE = "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.";

export function isStructure(value: unknown): value is Structure {
  return typeof value === "string" && (STRUCTURES as readonly string[]).includes(value);
}

export const randomStructure = (): Structure => STRUCTURES[Math.floor(Math.random() * STRUCTURES.length)]!;

/** 브리프의 "구성:" 줄 */
export const structureLine = (type: WritingType, structure: Structure) => `구성: ${structure} (${STRUCTURE_NAMES[type][structure]})`;

/** 웹에서 플랫폼·유형 조합별로 미리 만들어 둔 브리프를 찾는 키 (서버·브라우저 공용) */
export const briefKey = (platform: Platform, type: WritingType) => `${platform}:${type}`;
