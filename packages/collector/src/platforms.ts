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
export const WRITING_TYPES = ["info", "review", "place"] as const;

export type WritingType = (typeof WRITING_TYPES)[number];

export const WRITING_TYPE_LABELS: Record<WritingType, string> = {
  info: "정보",
  review: "리뷰",
  place: "장소",
};

export function isWritingType(value: unknown): value is WritingType {
  return typeof value === "string" && (WRITING_TYPES as readonly string[]).includes(value);
}

/** 웹에서 플랫폼·유형 조합별로 미리 만들어 둔 브리프를 찾는 키 (서버·브라우저 공용) */
export const briefKey = (platform: Platform, type: WritingType) => `${platform}:${type}`;
