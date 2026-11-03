import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countBodyChars, naverPasteHtml, previewDocument } from "./preview.ts";

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

  it("네이버 [표: …] 블록은 미리보기에서 표로 보인다", () => {
    const doc = previewDocument("[표: 구간 | 공제율]\n3,000만원 이하 | 40%\n5,000만원 이하 | 20%", "naver", "text");
    assert.match(doc, /<thead><tr><th>구간<\/th><th>공제율<\/th><\/tr><\/thead>/);
    assert.match(doc, /<td>3,000만원 이하<\/td><td>40%<\/td>/);
  });
});

describe("네이버 서식 포함 복사", () => {
  const body = "도입 문장\n둘째 줄\n\n■ 신청 대상\n\n★ 꼭 확인할 것\n이어지는 문장\n\n[표: 구간 | 공제율]\n이하 | 40%\n\n[이미지: 표 캡처 | alt: 표]";

  it("기호를 빼고 소제목은 굵고 크게, 강조는 굵게, 블록 사이에는 빈 문단", () => {
    const html = naverPasteHtml(body);
    assert.doesNotMatch(html, /[■★]/);
    assert.match(html, /^<p>도입 문장<br>둘째 줄<\/p><p><br><\/p>/);
    assert.match(html, /<p><b><span style="font-size:19px">신청 대상<\/span><\/b><\/p>/);
    assert.match(html, /<p><b>꼭 확인할 것<\/b><br>이어지는 문장<\/p>/);
  });

  it("표는 선을 직접 넣은 표로, 사람이 채울 자리는 글자 그대로", () => {
    const html = naverPasteHtml(body);
    assert.match(html, /<table style="border-collapse:collapse"><thead><tr><th style="[^"]+">구간<\/th>/);
    assert.match(html, /<td style="[^"]+">40%<\/td>/);
    assert.match(html, /<p>\[이미지: 표 캡처 \| alt: 표\]<\/p>$/);
    assert.doesNotMatch(html, /<mark/);
  });

  it("본문의 HTML은 이스케이프한다", () => {
    assert.match(naverPasteHtml("<img src=x onerror=alert(1)>"), /^<p>&lt;img/);
  });
});
