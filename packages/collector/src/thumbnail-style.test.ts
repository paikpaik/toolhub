import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyStatusPatch, sanitizeStatusEntry } from "./draft-status.ts";
import { backgroundUrl, DEFAULT_THUMBNAIL_STYLE, hasThumbnailSlot, pickBackground, sanitizeThumbnailStyle, thumbnailText } from "./thumbnail-style.ts";

const marker = (text: string) => ({ type: "image", text });

describe("계정 썸네일 스타일", () => {
  it("정해진 필드만, 잘못된 값은 기본값, 덮기는 0~0.9, 배경은 정해진 이름만", () => {
    assert.deepEqual(sanitizeThumbnailStyle(undefined), DEFAULT_THUMBNAIL_STYLE);
    const style = sanitizeThumbnailStyle({
      template: "bar",
      fontId: "jua",
      colors: { bg: "#ffffff", text: "red", accent: "#123456" },
      overlay: 2,
      blogName: "  여리쓰 블로그  ",
      backgrounds: ["bg-abcdef1234.png", "../x.png", "bg-abcdef1234.png", "bg-zz.gif"],
      extra: 1,
    });
    assert.deepEqual(style, {
      template: "bar",
      fontId: "jua",
      colors: { bg: "#ffffff", text: DEFAULT_THUMBNAIL_STYLE.colors.text, accent: "#123456" },
      blogName: "여리쓰 블로그",
      label: "",
      overlay: 0.9,
      backgrounds: ["bg-abcdef1234.png"],
    });
    assert.equal(sanitizeThumbnailStyle({ template: "<script>" }).template, "center");
  });

  it("배경: 없으면 단색, 한 장이면 고정, 여러 장이면 초안마다 돌려 쓰고 같은 초안은 늘 같은 배경, 고른 배경이 먼저", () => {
    assert.equal(pickBackground([], "a.md"), null);
    assert.equal(pickBackground(["bg-1.png"], "a.md"), "bg-1.png");
    assert.equal(pickBackground(["bg-1.png"], "b.md"), "bg-1.png");
    const three = ["bg-1.png", "bg-2.png", "bg-3.png"];
    assert.equal(pickBackground(three, "a.md"), pickBackground(three, "a.md"));
    const used = new Set(Array.from({ length: 30 }, (_, i) => pickBackground(three, `2026-11-${i}-키워드-naver.md`)));
    assert.equal(used.size, 3);
    assert.equal(pickBackground(three, "a.md", "bg-2.png"), "bg-2.png");
    assert.equal(pickBackground(three, "a.md", "none"), null);
    assert.equal(pickBackground(three, "a.md", "bg-9.png"), pickBackground(three, "a.md"));
  });

  it("문구: 고친 문구 → 표시의 문구(' / '는 줄바꿈) → 추천 제목", () => {
    const markers = [marker("대표 썸네일 | alt: a | 추천: 썸네일 만들기 | 문구: 연말정산 / *13월의 월급* 챙기는 법"), marker("장면 | alt: b")];
    assert.equal(thumbnailText(markers, "추천 제목"), "연말정산\n*13월의 월급* 챙기는 법");
    assert.equal(thumbnailText(markers, "추천 제목", "고친\n문구"), "고친\n문구");
    assert.equal(thumbnailText([marker("대표 썸네일 | alt: a | 추천: 썸네일 만들기")], "추천 제목"), "추천 제목");
    assert.equal(thumbnailText([], "주차 1/2 할인"), "주차 1/2 할인");
    assert.equal(hasThumbnailSlot(markers), true);
    assert.equal(hasThumbnailSlot([marker("장면")]), false);
    assert.equal(backgroundUrl("acc-a", "bg-1.png"), "/api/accounts/background?account=acc-a&name=bg-1.png");
  });

  it("초안별 썸네일 설정: 문구·배경을 정하고, 비우면 자동, 잘못된 배경은 거절, 가져오기에서도 남긴다", () => {
    const set = applyStatusPatch(undefined, { thumbnail: { text: " 두 줄\n문구 ", background: "bg-abcdef1234.png" } });
    assert.deepEqual(set, { status: "draft", thumbnail: { text: "두 줄\n문구", background: "bg-abcdef1234.png" } });
    assert.deepEqual(applyStatusPatch(set as never, { thumbnail: { text: "" } }), { status: "draft", thumbnail: { background: "bg-abcdef1234.png" } });
    assert.deepEqual(applyStatusPatch(set as never, { thumbnail: { text: "", background: "" } }), { status: "draft" });
    assert.deepEqual(applyStatusPatch(undefined, { thumbnail: { background: "none" } }), { status: "draft", thumbnail: { background: "none" } });
    assert.match(applyStatusPatch(undefined, { thumbnail: { background: "../x.png" } }) as string, /알 수 없는 배경/);
    assert.match(applyStatusPatch(undefined, { thumbnail: { text: "가".repeat(81) } }) as string, /80자/);
    assert.deepEqual(sanitizeStatusEntry({ status: "draft", thumbnail: { text: "문구", background: "../x" } }), { status: "draft" });
    assert.deepEqual(sanitizeStatusEntry({ status: "draft", thumbnail: { text: "문구" } }), { status: "draft", thumbnail: { text: "문구" } });
  });
});
