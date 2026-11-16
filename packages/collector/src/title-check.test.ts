import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bannedEnding, titleEnding, titleFeedback } from "./title-check.ts";

describe("제목 점검", () => {
  it("쓰지 않는 끝맺음 (뒤의 문장부호는 무시, 긴 것 먼저)", () => {
    assert.equal(bannedEnding("동성로 디저트 페스타, 일정·장소 정리"), "정리");
    assert.equal(bannedEnding("국민연금 수령나이 총정리!"), "총정리");
    assert.equal(bannedEnding("성시경 콘서트 예매 일정 한눈에 보기"), "한눈에 보기");
    assert.equal(bannedEnding("원주 매운맛축제 가기 전 확인할 것"), "확인할 것");
    assert.equal(bannedEnding("시흥 어린이과학관 무료 개관, 예약 없이 가도 될까?"), null);
    assert.equal(bannedEnding("정리수납 자격증 따는 법"), null, "앞에 있는 정리는 괜찮다");
  });

  it("끝맺음은 마지막 낱말", () => {
    assert.equal(titleEnding("컴포즈 모찌 파는 매장, 직영점 확인하는 법?"), "법");
    assert.equal(titleEnding("닥터x 11회 줄거리"), "줄거리");
  });

  it("문제가 없으면 null, 금지 끝맺음은 후보마다 알린다", () => {
    assert.equal(titleFeedback(["원주 매운맛축제, 아이와 가도 될까"], "원주 매운맛축제, 아이와 가도 될까", ["닥터x 11회 줄거리"]), null);
    const feedback = titleFeedback(["A 일정 정리", "A 가도 될까", "A 한눈에"], "A 가도 될까", []) ?? "";
    assert.match(feedback, /^제목 점검:\n- 쓰지 않는 끝맺음입니다: "A 일정 정리" \(정리\), "A 한눈에" \(한눈에\)/);
    assert.match(feedback, /update_draft/);
  });

  it("추천 제목의 끝맺음이 최근 초안 3개 이상과 같으면 알린다", () => {
    const recent = ["B 11회 줄거리", "C 12회 줄거리", "D 결말 해석", "E 1회 줄거리"];
    assert.match(titleFeedback(["A 3회 줄거리"], "A 3회 줄거리", recent) ?? "", /끝맺음 "줄거리"이 최근 초안 4개 중 3개와 같습니다/);
    assert.equal(titleFeedback(["A 3회 줄거리"], "A 3회 줄거리", recent.slice(0, 2)), null, "두 번까지는 우연");
  });
});
