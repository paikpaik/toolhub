/**
 * 계정별 썸네일 스타일과 초안별 썸네일 문구 (브라우저에서도 쓰는 순수 로직).
 * 계정마다 배경 이미지·템플릿·글꼴·색을 두어 계정끼리는 썸네일이 다르고, 같은 계정은 일정하게 보이게 한다.
 * 배경이 한 장이면 고정, 여러 장이면 초안마다 돌려 쓴다 (같은 초안은 늘 같은 배경)
 */

export interface ThumbnailColors {
  bg: string;
  text: string;
  accent: string;
}

export interface ThumbnailStyle {
  /** 썸네일 템플릿 id (웹 draw.ts의 TEMPLATES) */
  template: string;
  /** 글꼴 id (웹 fonts.ts의 THUMBNAIL_FONTS) */
  fontId: string;
  colors: ThumbnailColors;
  blogName: string;
  label: string;
  /** 배경 이미지 위에 배경색을 덮는 정도 0~0.9 (글자가 읽히게) */
  overlay: number;
  /** data/thumbnails/<계정 id>/ 안의 배경 이미지 파일 이름 */
  backgrounds: string[];
}

export const DEFAULT_THUMBNAIL_STYLE: ThumbnailStyle = {
  template: "center",
  fontId: "noto",
  colors: { bg: "#1e2a44", text: "#ffffff", accent: "#ffd166" },
  blogName: "",
  label: "",
  overlay: 0.45,
  backgrounds: [],
};

/** 네이버 썸네일 크기 (정사각) */
export const ACCOUNT_THUMBNAIL_SIZE = 1080;
export const BACKGROUND_MAX = 10;
export const BACKGROUND_NAME = /^bg-[a-z0-9]{6,16}\.(?:png|jpe?g|webp)$/;
const HEX = /^#[0-9a-f]{6}$/i;
const SHORT_ID = /^[a-z]{1,20}$/;

/** 저장된 스타일을 정해진 필드만 남겨 읽는다. 빠진 값은 기본값 */
export function sanitizeThumbnailStyle(raw: unknown): ThumbnailStyle {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (r.colors && typeof r.colors === "object" ? r.colors : {}) as Record<string, unknown>;
  const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 30) : "");
  const overlay = typeof r.overlay === "number" && Number.isFinite(r.overlay) ? Math.min(0.9, Math.max(0, r.overlay)) : DEFAULT_THUMBNAIL_STYLE.overlay;
  return {
    template: typeof r.template === "string" && SHORT_ID.test(r.template) ? r.template : DEFAULT_THUMBNAIL_STYLE.template,
    fontId: typeof r.fontId === "string" && SHORT_ID.test(r.fontId) ? r.fontId : DEFAULT_THUMBNAIL_STYLE.fontId,
    colors: {
      bg: color(c.bg, DEFAULT_THUMBNAIL_STYLE.colors.bg),
      text: color(c.text, DEFAULT_THUMBNAIL_STYLE.colors.text),
      accent: color(c.accent, DEFAULT_THUMBNAIL_STYLE.colors.accent),
    },
    blogName: text(r.blogName),
    label: text(r.label),
    overlay,
    backgrounds: Array.isArray(r.backgrounds)
      ? [...new Set(r.backgrounds.filter((b): b is string => typeof b === "string" && BACKGROUND_NAME.test(b)))].slice(0, BACKGROUND_MAX)
      : [],
  };
}

/** 파일 이름으로 정하는 작은 해시 (같은 초안은 늘 같은 배경) */
function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h;
}

/**
 * 이 초안의 배경 이미지 이름. chosen: 초안에서 고른 배경("none"이면 단색), 없으면 자동.
 * 배경이 없으면 null(단색), 한 장이면 그 장, 여러 장이면 파일 이름으로 돌려 고른다
 */
export function pickBackground(backgrounds: string[], file: string, chosen?: string) {
  if (chosen === "none") return null;
  if (chosen && backgrounds.includes(chosen)) return chosen;
  if (!backgrounds.length) return null;
  return backgrounds[hash(file) % backgrounds.length]!;
}

/**
 * 초안의 썸네일 문구. 초안에서 고친 문구 → 대표 썸네일 표시의 "문구:" → 추천 제목 순.
 * 표시: [이미지: 대표 썸네일 | alt: … | 추천: 썸네일 만들기 | 문구: 첫 줄 / *강조* 둘째 줄]. " / "는 줄바꿈
 */
export function thumbnailText(markers: { type: string; text: string }[], recommendedTitle: string, saved?: string) {
  if (saved?.trim()) return saved.trim();
  const marker = markers.find((m) => m.type === "image" && /^대표\s*썸네일/.test(m.text));
  const phrase = marker?.text
    .split("|")
    .map((part) => part.trim())
    .find((part) => /^문구\s*:/.test(part))
    ?.replace(/^문구\s*:\s*/, "");
  return (phrase || recommendedTitle)
    .split(/\s+\/\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** 계정 배경 이미지 주소 (웹 API. 같은 주소에서 불러와야 캔버스를 PNG로 뽑을 수 있다) */
export const backgroundUrl = (accountId: string, name: string) =>
  `/api/accounts/background?account=${encodeURIComponent(accountId)}&name=${encodeURIComponent(name)}`;

/** 초안 본문에 대표 썸네일 자리가 있는지 (확장이 썸네일을 넣을 자리) */
export const hasThumbnailSlot = (markers: { type: string; text: string }[]) => markers.some((m) => m.type === "image" && /^대표\s*썸네일/.test(m.text));
