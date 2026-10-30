import { MARKER_PATTERN, type Platform } from "@toolhub/collector";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 사람이 채울 자리 표시를 형광펜으로 */
const highlightMarkers = (html: string) =>
  html.replace(MARKER_PATTERN, (marker, type: string) => {
    const kind = type === "이미지" ? "image" : type === "직접 작성" ? "write" : "check";
    return `<mark class="${kind}">${escapeHtml(marker)}</mark>`;
  });

/** 네이버용 일반 텍스트를 스마트에디터에 서식을 입힌 모습에 가깝게 바꾼다 (■ 소제목, ★ 강조) */
function naverTextToHtml(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line.trim()));
      if (lines.length === 1 && lines[0]!.startsWith("■")) return `<h3>${lines[0]!.replace(/^■\s*/, "")}</h3>`;
      return `<p>${lines.map((l) => (l.startsWith("★") ? `<strong>${l.replace(/^★\s*/, "")}</strong>` : l)).join("<br>")}</p>`;
    })
    .join("\n");
}

/** 미리보기 iframe에 넣을 문서. 스크립트는 iframe sandbox로 막는다 */
export function previewDocument(body: string, platform: Platform | null, lang: string | null) {
  const isHtml = lang === "html" || (lang !== "text" && platform !== "naver" && /<(p|h[23]|ul|ol|table)\b/i.test(body));
  const content = highlightMarkers(isHtml ? body : naverTextToHtml(body));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
    font-size: 16px; line-height: 1.8; color: #222; background: #fff; }
  main { max-width: 720px; margin: 0 auto; }
  h2 { font-size: 22px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #eee; }
  h3 { font-size: 18px; margin: 28px 0 8px; }
  p { margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px; }
  blockquote { margin: 16px 0; padding: 8px 16px; border-left: 4px solid #ddd; color: #555; }
  a { color: #2f6fed; }
  mark { padding: 2px 4px; border-radius: 4px; font-size: 14px; }
  mark.image { background: #dbeafe; color: #1e40af; }
  mark.write { background: #fef3c7; color: #92400e; }
  mark.check { background: #fee2e2; color: #991b1b; }
</style></head><body><main>${content}</main></body></html>`;
}

/** 본문 글자 수 (태그와 사람이 채울 자리 표시를 뺀 공백 포함 글자 수) */
export function countBodyChars(body: string) {
  return body
    .replace(MARKER_PATTERN, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/[■★]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}
