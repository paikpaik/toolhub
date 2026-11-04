import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildKinAnswerPrompt, draftPlainText } from "./kin-answer.ts";

describe("draftPlainText", () => {
  it("네이버 텍스트는 그대로, 이미지 자리는 뺀다", () => {
    const text = draftPlainText("도입 문장이에요.\n\n[이미지: 사진 | alt: a | 추천: 직접 촬영]\n\n■ 소제목\n\n[표: 종류 | 장점]\n보온 | 따뜻함");
    assert.equal(text, "도입 문장이에요.\n\n■ 소제목\n\n[표: 종류 | 장점]\n보온 | 따뜻함");
  });

  it("HTML은 소제목·목록·표를 읽을 수 있는 줄로", () => {
    const text = draftPlainText("<p>첫 문단 &amp; 끝</p><h2>고르는 법</h2><ul><li>무게</li></ul><table><tr><td>a</td><td>b</td></tr></table>");
    assert.match(text, /첫 문단 & 끝/);
    assert.match(text, /■ 고르는 법/);
    assert.match(text, /- 무게/);
    assert.match(text, /a \| b \|/);
    assert.doesNotMatch(text, /</);
  });
});

describe("buildKinAnswerPrompt", () => {
  const base = {
    question: { title: "수능 도시락통 뭐가 좋을까요", link: "https://kin.naver.com/q/1", description: "보온도시락이랑 죽통 중에…" },
    postTitle: "수능도시락 준비, 도시락통 비교",
    body: "■ 수능도시락통 3가지\n\n보온도시락은 따뜻해요.",
  };

  it("붙여넣은 질문 본문이 있으면 그걸, 없으면 검색 요약임을 밝힌다", () => {
    assert.match(buildKinAnswerPrompt({ ...base, questionBody: "아이가 위가 약해서요" }), /본문:\n아이가 위가 약해서요/);
    assert.match(buildKinAnswerPrompt(base), /앞부분 요약이라 잘려 있을 수 있음\): 보온도시락이랑 죽통 중에…/);
  });

  it("글 주소를 넣고, 없으면 [글 주소] 자리로 둔다", () => {
    assert.match(buildKinAnswerPrompt({ ...base, postUrl: "https://blog.naver.com/a/1" }), /주소: https:\/\/blog\.naver\.com\/a\/1/);
    assert.match(buildKinAnswerPrompt(base), /주소: \[글 주소\]/);
  });

  it("먼저 답하기·지어내지 않기·링크 한 번·안 맞으면 답변 비추천 규칙을 담는다", () => {
    const prompt = buildKinAnswerPrompt(base);
    assert.match(prompt, /질문에 대한 답부터/);
    assert.match(prompt, /지어내지 않기/);
    assert.match(prompt, /딱 한 번/);
    assert.match(prompt, /답변 비추천: 이유/);
    assert.match(prompt, /■ 수능도시락통 3가지/);
  });
});
