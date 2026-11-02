import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintCaption } from "./caption.ts";
import { HOOK_FORMULAS } from "./hooks.ts";
import { beatSheet, checkHook, isConcrete, spokenSyllables } from "./reel.ts";

describe("훅 공식", () => {
  it("26가지, 번호가 1부터 이어지고 모든 칸이 채워져 있다", () => {
    assert.equal(HOOK_FORMULAS.length, 26);
    HOOK_FORMULAS.forEach((h, i) => {
      assert.equal(h.id, i + 1);
      for (const value of Object.values(h)) assert.ok(String(value).length > 0);
    });
  });
});

describe("말하는 음절 수", () => {
  it("한글은 글자 수, 숫자는 읽는 소리 어림, 영어 단어는 2음절", () => {
    assert.equal(spokenSyllables("연말정산"), 4);
    assert.equal(spokenSyllables("47만원"), 3 + 2); // 사십칠(≈3) + 만원
    assert.equal(spokenSyllables("1,200만원"), 3 + 2); // 천이백(≈3) + 만원
    assert.equal(spokenSyllables("IRP 계좌"), 2 + 2);
  });

  it("숫자나 셀 수 있는 말이 있으면 구체적", () => {
    assert.equal(isConcrete("47만원 날렸어요"), true);
    assert.equal(isConcrete("세 가지만 기억하세요"), true);
    assert.equal(isConcrete("정말 중요한 이야기예요"), false);
  });
});

describe("릴스 구성표", () => {
  const script = [
    "연말정산 서류 하나 빠뜨려서 47만원 날렸습니다.",
    "올해는 미리보기에서 이것만 확인하세요.",
    "첫째, 부양가족 공제가 들어갔는지.",
    "둘째, 월세는 자동으로 안 들어가요.",
    "그래서 직접 입력해야 해요. 계약서랑 이체 내역만 있으면 됩니다. 이거 하나로 돌려받는 돈이 꽤 커집니다. 저처럼 놓치지 마시고 꼭 챙기세요.",
    "47만원, 이제 안 날립니다.",
  ].join("\n");

  it("줄마다 시작 시각과 길이, 역할(훅·본문·마무리)", () => {
    const { beats, total } = beatSheet(script);
    assert.equal(beats[0]!.role, "훅");
    assert.equal(beats.at(-1)!.role, "마무리");
    assert.equal(beats[1]!.start, beats[0]!.seconds);
    assert.ok(total > 10 && total < 40);
  });

  it("긴 줄은 문장 끝에서 나눈다", () => {
    const { beats } = beatSheet(script);
    assert.ok(beats.length > 6);
    assert.ok(beats.every((b) => b.seconds <= 6.5));
  });

  it("마지막 줄이 훅의 숫자 낱말(12월)을 다시 말해도 되감기 통과", () => {
    const loop = beatSheet("연말정산 미리보기, 12월 18일에 닫혀요.\n월세는 직접 넣어요.\n12월 18일 전에 꼭 확인하세요.").checks.find((c) => c.label === "되감기(루프)")!;
    assert.equal(loop.ok, true);
  });

  it("마지막 줄이 훅의 낱말(47만원)을 다시 말하면 되감기 통과", () => {
    const loop = beatSheet(script).checks.find((c) => c.label === "되감기(루프)")!;
    assert.equal(loop.ok, true);
    assert.match(loop.detail, /만원/);
  });

  it("훅이 3초를 넘으면 경고, 목표 길이와 크게 다르면 경고", () => {
    const long = beatSheet("이 영상에서는 제가 지난 몇 년 동안 겪었던 여러 가지 시행착오와 그 과정에서 배운 점들을 하나하나 차근차근 정리해서 말씀드리려고 합니다\n끝", { target: 60 });
    assert.equal(long.checks.find((c) => c.label === "훅 길이")!.ok, false);
    assert.equal(long.checks.find((c) => c.label === "목표 길이")!.ok, false);
  });

  it("구체적인 말 없는 줄이 3개 이어지면 경고", () => {
    const vague = beatSheet("47만원 날렸어요\n정말 중요해요\n꼭 알아두세요\n잊지 마세요\n끝");
    assert.equal(vague.checks.find((c) => c.label === "구체성")!.ok, false);
  });
});

describe("훅 점검", () => {
  it("인사·서론·주목 부탁으로 시작하면 약함", () => {
    assert.equal(checkHook("안녕하세요 여러분, 오늘은 연말정산 얘기를 해볼게요").verdict, "약함");
    assert.equal(checkHook("스크롤 멈추고 이거 보세요").verdict, "약함");
  });

  it("짧고 숫자가 있고 보는 사람을 부르면 좋음", () => {
    const result = checkHook("첫 연말정산이라면, 이것 하나로 47만원 돌려받아요");
    assert.equal(result.verdict, "좋음");
  });
});

describe("캡션 점검", () => {
  const good = "연말정산 미리보기, 12월 18일에 닫혀요.\n\n월세와 부양가족 공제는 직접 넣어야 해요.\n\n저장해 두고 마감 전에 꺼내 보세요.\n\n#연말정산 #연말정산미리보기 #직장인";

  it("잘 쓴 캡션은 통과, 보이는 부분은 앞 두 줄까지", () => {
    const result = lintCaption(good, { keywords: ["연말정산 미리보기"] });
    assert.equal(result.verdict, "pass", JSON.stringify(result.checks));
    assert.equal(result.preview, "연말정산 미리보기, 12월 18일에 닫혀요."); // 둘째 줄이 빈 줄이면 첫 줄만 보임
    assert.deepEqual(result.hashtags, ["#연말정산", "#연말정산미리보기", "#직장인"]);
  });

  it("한글 해시태그 6개 이상은 실패, 첫 줄 해시태그는 실패", () => {
    const tags = Array.from({ length: 6 }, (_, i) => `#태그${i}`).join(" ");
    assert.equal(lintCaption(`본문 47만원\n저장하세요\n${tags}`).checks.find((c) => c.label === "해시태그")!.level, "fail");
    assert.equal(lintCaption("#연말정산 시작합니다").checks.find((c) => c.label === "첫 줄")!.level, "fail");
  });

  it("링크·요청 여러 개·쿠팡 대가성 문구 누락을 짚는다", () => {
    const result = lintCaption("에어프라이어 3만원대 추천\n쿠팡에서 샀어요 https://link.coupang.com/a/x\n저장하고 팔로우하세요");
    const level = (label: string) => result.checks.find((c) => c.label === label)?.level;
    assert.equal(level("링크"), "warn");
    assert.equal(level("요청"), "warn");
    assert.equal(level("대가성 문구"), "fail");
    assert.equal(result.verdict, "fail");
  });

  it("대가성 문구가 있으면 통과, 검색어가 빠지면 알려 준다", () => {
    const result = lintCaption("에어프라이어 3만원대 추천\n이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.\n프로필 링크에서 보세요", {
      keywords: ["에어프라이어 추천", "캠핑"],
    });
    assert.equal(result.checks.find((c) => c.label === "대가성 문구")!.level, "pass");
    assert.match(result.checks.find((c) => c.label === "검색어")!.detail, /빠진 것: 에어프라이어 추천, 캠핑/);
  });
});
