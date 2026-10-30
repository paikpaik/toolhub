import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countBodyChars, previewDocument } from "./preview.ts";

describe("초안 미리보기", () => {
  it("글자 수: 태그·사람이 채울 자리·네이버 기호를 빼고 센다", () => {
    assert.equal(countBodyChars("<p>가나다 <strong>라마</strong></p><p>[이미지: 사진 | alt: x]</p>"), "가나다 라마".length);
    assert.equal(countBodyChars("■ 소제목\n\n★ 강조 문장"), "소제목 강조 문장".length);
  });

  it("HTML 본문은 그대로, 사람이 채울 자리는 형광펜으로", () => {
    const doc = previewDocument("<h2>제목</h2><p>[직접 작성: 경험]</p>", "tistory", "html");
    assert.match(doc, /<h2>제목<\/h2>/);
    assert.match(doc, /<mark class="write">\[직접 작성: 경험\]<\/mark>/);
  });

  it("네이버 텍스트는 ■ 소제목·★ 강조를 서식으로 바꾸고 HTML은 이스케이프한다", () => {
    const doc = previewDocument("■ 신청 대상\n\n★ 꼭 확인\n<script>x</script>", "naver", "text");
    assert.match(doc, /<h3>신청 대상<\/h3>/);
    assert.match(doc, /<strong>꼭 확인<\/strong>/);
    assert.match(doc, /&lt;script&gt;/);
    assert.doesNotMatch(doc, /<script>x/);
  });
});
