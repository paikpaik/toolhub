import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyLength, draftFormat, draftPlatform, lengthFeedback } from "./draft-length.ts";

describe("초안 분량", () => {
  it("공백은 세고, 줄바꿈·이미지 자리·■·★·표 머리 표시·HTML 태그는 빼고 센다", () => {
    assert.equal(bodyLength("■ 소제목\n\n★ 가 나\n[이미지: 장면 | alt: a | 추천: AI 생성]\n[표: 구분 | 값]"), "소제목가 나구분 | 값".length);
    assert.equal(bodyLength("<h2>제목</h2><p>본문 &amp; 끝</p>"), "제목본문 & 끝".length);
  });

  it("파일 이름에서 플랫폼", () => {
    assert.equal(draftPlatform("2026-11-05-연말정산-naver.md"), "naver");
    assert.equal(draftPlatform("2026-11-05-연말정산-tistory-2.md"), "tistory");
    assert.equal(draftPlatform("메모.md"), null);
    assert.equal(draftPlatform("2026-11-19-원주-매운맛축제-naver-home-2.md"), "naver");
    assert.equal(draftFormat("2026-11-19-원주-매운맛축제-naver-home.md"), "home");
    assert.equal(draftFormat("2026-11-19-원주-naver.md"), "search");
    assert.equal(draftFormat("2026-11-19-원주-tistory.md"), null);
  });

  it("네이버 홈판형은 목표 1,800자 (범위는 같음), 소제목을 늘리지 말라고", () => {
    assert.match(lengthFeedback("naver", "가".repeat(1850), "home") ?? "", /홈판형 목표 1,800자.*분량 맞음/);
    const short = lengthFeedback("naver", "가".repeat(1500), "home") ?? "";
    assert.match(short, /300자 짧습니다/);
    assert.match(short, /소제목을 늘리지 말고/);
    assert.match(lengthFeedback("naver", "가".repeat(1700)) ?? "", /짧습니다/, "검색형은 2,000자 기준");
    assert.match(lengthFeedback("tistory", "가".repeat(2500), "home") ?? "", /^본문 2,500자 \(목표 2,500자/, "다른 플랫폼은 형식을 무시");
  });

  it("목표의 90%보다 짧으면 보완해 다시 저장하라고, 범위 안이면 맞음, 넘치면 줄이라고", () => {
    assert.match(lengthFeedback("naver", "가".repeat(1600)) ?? "", /^본문 1,600자: .*400자 짧습니다.*update_draft/);
    assert.match(lengthFeedback("naver", "가".repeat(1850)) ?? "", /분량 맞음/);
    assert.match(lengthFeedback("naver", "가".repeat(2600)) ?? "", /깁니다/);
    assert.match(lengthFeedback("naver", null) ?? "", /코드 블록을 찾지 못해/);
    assert.equal(lengthFeedback(null, "가"), null);
  });

  it("쇼핑 커넥트 글은 플랫폼과 상관없이 3,500자 기준, 대가성 문구가 없으면 먼저 알린다", () => {
    const disclosure = "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.";
    const body = (n: number) => `${disclosure}\n${"가".repeat(n - bodyLength(disclosure))}`;
    assert.match(lengthFeedback("naver", body(2000)) ?? "", /^본문 2,000자: 쇼핑 커넥트 목표 3,500자.*1,500자 짧습니다/);
    assert.match(lengthFeedback("naver", body(3400)) ?? "", /분량 맞음/);
    assert.match(lengthFeedback("tistory", body(4100)) ?? "", /깁니다/);
    // 쉼표·따옴표가 빠져도 같은 문구로 본다
    assert.doesNotMatch(lengthFeedback("naver", `"${disclosure.replace(",", "")}"\n${"가".repeat(3400)}`) ?? "", /대가성 문구가 없습니다/);
    // 링크 자리만 있고 문구가 없으면 쇼핑 커넥트 글로 보고 문구를 넣으라고 한다
    assert.match(lengthFeedback("naver", `[링크: 쇼핑 커넥트]\n${"가".repeat(3500)}`) ?? "", /^대가성 문구가 없습니다.*\n본문 .*분량 맞음/);
  });
});
