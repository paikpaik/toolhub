import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrast, hslToHex, randomColors } from "./random-colors.ts";

describe("썸네일 랜덤 색 조합", () => {
  it("HSL → hex, 대비 계산", () => {
    assert.equal(hslToHex(0, 100, 50), "#ff0000");
    assert.equal(hslToHex(240, 100, 50), "#0000ff");
    assert.equal(hslToHex(0, 0, 100), "#ffffff");
    assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
    assert.equal(contrast("#123456", "#123456"), 1);
  });

  it("몇 번을 뽑아도 글자는 7:1, 강조는 3:1 이상으로 읽힌다", () => {
    for (let i = 0; i < 500; i++) {
      const c = randomColors();
      assert.match(c.bg, /^#[0-9a-f]{6}$/);
      assert.ok(contrast(c.text, c.bg) >= 7, `글자 ${c.text} / 배경 ${c.bg}`);
      assert.ok(contrast(c.accent, c.bg) >= 3, `강조 ${c.accent} / 배경 ${c.bg}`);
    }
  });

  it("누를 때마다 다른 조합이 나온다", () => {
    const seen = new Set(Array.from({ length: 30 }, () => randomColors().bg));
    assert.ok(seen.size > 25);
  });
});
