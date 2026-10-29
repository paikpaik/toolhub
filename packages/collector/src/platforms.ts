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
