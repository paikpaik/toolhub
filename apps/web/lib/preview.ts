import { MARKER_PATTERN, type Platform } from "@toolhub/collector";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 사람이 채울 자리 표시를 형광펜으로 */
const highlightMarkers = (html: string) =>
  html.replace(MARKER_PATTERN, (marker, type: string) => {
    const kind = type === "이미지" ? "image" : type === "직접 작성" ? "write" : "check";
    return `<mark class="${kind}">${escapeHtml(marker)}</mark>`;
  });

/** 네이버 초안의 표 블록 첫 줄: [표: 열 | 열] */
const TABLE_HEAD = /^\[표:\s*(.+)\]$/;
const cells = (line: string) => line.split("|").map((cell) => cell.trim());

/**
 * 네이버용 일반 텍스트를 서식이 입혀진 HTML로 바꾼다 (■ 소제목, ★ 강조, [표: …] 블록은 표).
 * paste: 스마트에디터에 붙여넣을 HTML. 클래스·스타일시트가 따라가지 않으므로 서식을 태그에 직접 넣고,
 * 텍스트 본문의 빈 줄처럼 블록 사이에 빈 문단을 둔다
 */
function naverTextToHtml(text: string, paste = false) {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line.trim()));
      const head = lines[0]!.match(TABLE_HEAD);
      if (head) {
        const border = paste ? ' style="border:1px solid #ccc;padding:6px 10px"' : "";
        const row = (line: string, tag: "th" | "td") => `<tr>${cells(line).map((c) => `<${tag}${border}>${c}</${tag}>`).join("")}</tr>`;
        const table = paste ? ' style="border-collapse:collapse"' : "";
        return `<table${table}><thead>${row(head[1]!, "th")}</thead><tbody>${lines.slice(1).map((l) => row(l, "td")).join("")}</tbody></table>`;
      }
      if (lines.length === 1 && lines[0]!.startsWith("■")) {
        const heading = lines[0]!.replace(/^■\s*/, "");
        // 스마트에디터는 붙여넣은 제목 태그를 "소제목" 서식으로 받지 않으므로 굵고 큰 글씨로 넣는다
        return paste ? `<p><b><span style="font-size:19px">${heading}</span></b></p>` : `<h3>${heading}</h3>`;
      }
      const strong = paste ? "b" : "strong";
      return `<p>${lines.map((l) => (l.startsWith("★") ? `<${strong}>${l.replace(/^★\s*/, "")}</${strong}>` : l)).join("<br>")}</p>`;
    });
  return blocks.join(paste ? "<p><br></p>" : "\n");
}

/** 네이버 본문을 스마트에디터에 서식째 붙여넣을 HTML로 (기호는 빠지고, 사람이 채울 자리는 글자 그대로 남는다) */
export const naverPasteHtml = (body: string) => naverTextToHtml(body, true);

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
