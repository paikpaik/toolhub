import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyLength, draftPlatform, lengthFeedback } from "./draft-length.ts";

describe("초안 분량", () => {
  it("공백은 세고, 줄바꿈·이미지 자리·■·★·표 머리 표시·HTML 태그는 빼고 센다", () => {
    assert.equal(bodyLength("■ 소제목\n\n★ 가 나\n[이미지: 장면 | alt: a | 추천: AI 생성]\n[표: 구분 | 값]"), "소제목가 나구분 | 값".length);
    assert.equal(bodyLength("<h2>제목</h2><p>본문 &amp; 끝</p>"), "제목본문 & 끝".length);
  });

  it("파일 이름에서 플랫폼", () => {
    assert.equal(draftPlatform("2026-11-05-연말정산-naver.md"), "naver");
    assert.equal(draftPlatform("2026-11-05-연말정산-tistory-2.md"), "tistory");
    assert.equal(draftPlatform("메모.md"), null);
  });

  it("목표의 90%보다 짧으면 보완해 다시 저장하라고, 범위 안이면 맞음, 넘치면 줄이라고", () => {
    assert.match(lengthFeedback("naver", "가".repeat(1600)) ?? "", /^본문 1,600자: .*400자 짧습니다.*update_draft/);
    assert.match(lengthFeedback("naver", "가".repeat(1850)) ?? "", /분량 맞음/);
    assert.match(lengthFeedback("naver", "가".repeat(2600)) ?? "", /깁니다/);
    assert.match(lengthFeedback("naver", null) ?? "", /코드 블록을 찾지 못해/);
    assert.equal(lengthFeedback(null, "가"), null);
  });
});
