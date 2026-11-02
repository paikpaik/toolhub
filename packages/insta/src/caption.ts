/**
 * 인스타그램 캡션 점검 (한국어 해시태그·요청 문구·쿠팡 파트너스 대가성 문구 포함).
 *
 * - 피드에서는 캡션 앞부분만 보이고 나머지는 "더 보기" 뒤로 숨는다. 대부분의 캡션이 거기서 실패한다
 * - 해시태그는 2025년 12월부터 게시물당 5개까지
 * - 캡션의 링크는 눌리지 않는다 (프로필 링크·스토리 링크 스티커로 보낸다)
 */

export const CAPTION_MAX = 2200;
/** 피드에서 "더 보기" 전에 보이는 대략의 글자 수 (기기·글꼴에 따라 다르다) */
export const CAPTION_PREVIEW = 125;
export const HASHTAG_MAX = 5;

export type CheckLevel = "pass" | "warn" | "fail";

export interface CaptionCheck {
  level: CheckLevel;
  label: string;
  detail: string;
}

const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const LINK = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|co\.kr|kr|net|me|ly|io)\b/i;
/** 요청(행동 유도) 종류. 한 캡션에 한 가지만 */
const ASKS: [string, RegExp][] = [
  ["저장", /저장(?:해|하|각)/],
  ["댓글", /댓글(?:로|에|\s*남겨|\s*달아)|댓글에?\s*["'“]?[\p{L}\p{N}]+["'”]?\s*(?:라고|남기|쓰)/u],
  ["공유", /공유(?:해|하세요)|보내\s*주세요|태그(?:해|하세요)/],
  ["팔로우", /팔로우(?:해|하세요|하고)/],
  ["DM", /(?:DM|디엠)(?:으로|\s*주|\s*보내)/i],
  ["프로필 링크", /프로필\s*(?:링크|상단)/],
];
const COUPANG = /쿠팡|coupang|파트너스/i;
const DISCLOSURE = /수수료를?\s*제공받|파트너스\s*활동의?\s*일환/;

/** 피드에서 보이는 앞부분 (첫 줄바꿈이나 글자 수 중 먼저 닿는 곳까지 두 줄 정도) */
export function captionPreview(caption: string) {
  const text = caption.trim();
  const [first = "", second = ""] = text.split("\n");
  const visible = second ? `${first}\n${second}` : first;
  return visible.length > CAPTION_PREVIEW ? visible.slice(0, CAPTION_PREVIEW) : visible;
}

export function lintCaption(caption: string, { keywords = [] }: { keywords?: string[] } = {}) {
  const text = caption.trim();
  const firstLine = text.split("\n")[0] ?? "";
  const hashtags = text.match(HASHTAG) ?? [];
  const asks = ASKS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const preview = captionPreview(text);
  const checks: CaptionCheck[] = [];
  const add = (level: CheckLevel, label: string, detail: string) => checks.push({ level, label, detail });

  add(text.length > CAPTION_MAX ? "fail" : "pass", "길이", `${text.length.toLocaleString()} / ${CAPTION_MAX.toLocaleString()}자`);

  if (!firstLine) add("fail", "첫 줄", "첫 줄이 비어 있어요");
  else if (/^#/.test(firstLine)) add("fail", "첫 줄", "해시태그로 시작해요. 피드에 보이는 첫 줄은 훅이나 요청이어야 합니다");
  else if (/^\p{Extended_Pictographic}/u.test(firstLine)) add("warn", "첫 줄", "이모지로 시작해요. 첫 글자는 말로 시작하는 편이 읽힙니다");
  else if (/^(?:안녕하세요|여러분|오늘은)/.test(firstLine)) add("warn", "첫 줄", "인사·서론으로 시작해요. 피드에서 보이는 자리에 핵심을 두세요");
  else if (firstLine.length > CAPTION_PREVIEW) add("warn", "첫 줄", `${firstLine.length}자라 "더 보기" 전에 잘려요. 앞 ${CAPTION_PREVIEW}자 안에서 끝내세요`);
  else add("pass", "첫 줄", `${firstLine.length}자, 잘리지 않고 보여요`);

  add(/\d/.test(preview) ? "pass" : "warn", "구체성", /\d/.test(preview) ? "보이는 부분에 숫자가 있어요" : "보이는 부분에 숫자가 없어요. 금액·기간·개수가 있으면 더 눈에 띕니다");

  if (hashtags.length > HASHTAG_MAX) add("fail", "해시태그", `${hashtags.length}개. 게시물당 ${HASHTAG_MAX}개까지만 됩니다 (2025년 12월부터)`);
  else add("pass", "해시태그", `${hashtags.length}개${hashtags.length ? `: ${hashtags.join(" ")}` : ""}`);
  if (hashtags.length && hashtags.some((t) => firstLine.includes(t))) add("warn", "해시태그 위치", "첫 줄에 해시태그가 있어요. 맨 아래 따로 모으세요");
  if (hashtags.some((t) => /^#(?:좋아요|팔로우|맞팔|선팔|소통|fyp|viral|explore)/i.test(t))) add("warn", "해시태그 내용", "#좋아요·#맞팔·#소통 같은 태그는 주제를 말해 주지 않아요. 글 주제를 나타내는 태그로 바꾸세요");

  add(LINK.test(text) ? "warn" : "pass", "링크", LINK.test(text) ? "캡션의 링크는 눌리지 않아요. '프로필 링크'나 스토리 링크 스티커로 안내하세요" : "죽은 링크 없음");

  if (asks.length === 0) add("warn", "요청", "요청이 없어요. 저장·댓글·프로필 링크 중 하나를 마지막에 넣으세요");
  else if (asks.length > 1) add("warn", "요청", `요청이 ${asks.length}개(${asks.join(", ")})예요. 요청이 둘이면 하나도 안 한 것과 같습니다. 하나만 남기세요`);
  else add("pass", "요청", `한 가지: ${asks[0]}`);

  if (COUPANG.test(text)) {
    add(DISCLOSURE.test(text) ? "pass" : "fail", "대가성 문구", DISCLOSURE.test(text) ? "쿠팡 파트너스 문구가 있어요" : "쿠팡 링크 글에는 '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'를 넣어야 해요");
  }

  const wanted = keywords.map((k) => k.trim()).filter(Boolean);
  if (wanted.length) {
    const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const body = norm(text.replace(HASHTAG, ""));
    const missing = wanted.filter((k) => !body.includes(norm(k)));
    add(
      missing.length ? "warn" : "pass",
      "검색어",
      missing.length
        ? `${wanted.length - missing.length}/${wanted.length}개 들어 있어요. 빠진 것: ${missing.join(", ")} (인스타 검색은 캡션 문장을 읽어요. 해시태그 말고 문장 속에 넣으세요)`
        : "모두 문장 속에 들어 있어요",
    );
  }

  const verdict: CheckLevel = checks.some((c) => c.level === "fail") ? "fail" : checks.some((c) => c.level === "warn") ? "warn" : "pass";
  return { preview, checks, verdict, hashtags, asks };
}

const MARK = { pass: "✓", warn: "!", fail: "✗" } as const;
const VERDICT = { pass: "올려도 돼요", warn: "확인 필요", fail: "고쳐야 해요" } as const;

/** MCP용 텍스트 */
export function formatCaptionLint(result: ReturnType<typeof lintCaption>) {
  return [
    `캡션 점검: ${VERDICT[result.verdict]}`,
    "",
    "피드에 보이는 부분:",
    ...result.preview.split("\n").map((l) => `> ${l}`),
    "> … 더 보기",
    "",
    ...result.checks.map((c) => `${MARK[c.level]} ${c.label}: ${c.detail}`),
  ].join("\n");
}
