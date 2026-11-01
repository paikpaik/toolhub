import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodySections, buildImagePrompt, spreadPick } from "./image-prompt.ts";

const naverBody = `11월인 지금, 홈택스 '연말정산 미리보기'에서 모의계산을 바로 돌려볼 수 있어요.

■ 연말정산 미리보기 메뉴가 사라졌어요

사라진 게 아니라 기간에만 열리는 서비스예요. 2026년 귀속 미리보기는 10월 28일부터 운영돼요.

■ 결과가 '납부'로 나오면 정말 더 내야 하나요?

[이미지: 모의계산 결과 화면 | alt: 결과 화면 | 추천: 직접 캡처]

★ 납부로 나왔다면 12월 31일 전에 바꿀 수 있는 항목부터 보세요.`;

describe("bodySections", () => {
  it("네이버 ■ 소제목과 첫 문단 (이미지 자리·★ 표시는 빼고)", () => {
    assert.deepEqual(bodySections(naverBody), [
      { heading: "연말정산 미리보기 메뉴가 사라졌어요", lead: "사라진 게 아니라 기간에만 열리는 서비스예요. 2026년 귀속 미리보기는 10월 28일부터 운영돼요." },
      { heading: "결과가 '납부'로 나오면 정말 더 내야 하나요?", lead: "납부로 나왔다면 12월 31일 전에 바꿀 수 있는 항목부터 보세요." },
    ]);
  });

  it("HTML 본문(티스토리)의 h2·h3", () => {
    const html = "<p>도입 문장입니다 열 글자 넘게.</p><h2>캠핑 의자 고르는 법</h2><p>무게와 높이를 먼저 봐야 합니다.</p><h3>접이식 &amp; 릴렉스</h3><p>허리가 편한 쪽은 릴렉스 체어예요.</p>";
    assert.deepEqual(
      bodySections(html).map((s) => [s.heading, s.lead]),
      [
        ["캠핑 의자 고르는 법", "무게와 높이를 먼저 봐야 합니다."],
        ["접이식 & 릴렉스", "허리가 편한 쪽은 릴렉스 체어예요."],
      ],
    );
  });
});

describe("spreadPick", () => {
  it("많으면 처음·끝 포함해 고르게, 적으면 그대로", () => {
    assert.deepEqual(spreadPick([1, 2, 3, 4, 5, 6, 7], 4), [1, 3, 5, 7]);
    assert.deepEqual(spreadPick([1, 2], 4), [1, 2]);
  });
});

describe("buildImagePrompt", () => {
  it("대표 1장 + 소제목별, 모자라면 주제로 채워 항상 5장", () => {
    const prompt = buildImagePrompt({ title: "연말정산 모의계산 6가지", keyword: "연말정산모의계산", body: naverBody });
    const items = prompt.split("[이미지 목록]\n")[1]!.split("\n\n")[0]!.split("\n");
    assert.equal(items.length, 5);
    assert.match(items[0]!, /^1\. 대표 이미지/);
    assert.match(items[1]!, /^2\. "연말정산 미리보기 메뉴가 사라졌어요" 부분/);
    assert.match(items[4]!, /^5\. 글 주제\("연말정산모의계산"\)/);
    assert.match(prompt, /글자·숫자·로고·워터마크를 넣지 않기/);
    assert.match(prompt, /실제 사진처럼/);
  });

  it("일러스트 스타일, 본문이 없어도 5장", () => {
    const prompt = buildImagePrompt({ title: "t", keyword: "캠핑", body: null, style: "illustration" });
    assert.match(prompt, /플랫 일러스트/);
    assert.match(prompt, /^5\. /m);
  });
});
