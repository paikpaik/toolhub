import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./lib.js";

const { parseColor, nearestColor, mergeSettings, DEFAULT_SETTINGS } = globalThis.ToolhubLib;

describe("parseColor", () => {
  it("#abc·#aabbcc·rgb()·rgba()를 읽는다", () => {
    assert.deepEqual(parseColor("#f00"), [255, 0, 0]);
    assert.deepEqual(parseColor("#FF0010"), [255, 0, 16]);
    assert.deepEqual(parseColor("rgb(1, 2, 3)"), [1, 2, 3]);
    assert.deepEqual(parseColor("rgba(10,20,30,0.5)"), [10, 20, 30]);
  });

  it("모르는 형식은 null", () => {
    assert.equal(parseColor("red"), null);
    assert.equal(parseColor(""), null);
    assert.equal(parseColor(undefined), null);
  });
});

describe("nearestColor", () => {
  const palette = [{ color: "#000000" }, { color: "#ff0010" }, { color: "#fff593" }, { color: "없음" }];

  it("팔레트에 같은 색이 없으면 가장 가까운 색", () => {
    assert.equal(nearestColor("#e8001a", palette)?.color, "#ff0010");
    assert.equal(nearestColor("#ffff99", palette)?.color, "#fff593");
  });

  it("목표 색을 읽을 수 없거나 후보가 없으면 null", () => {
    assert.equal(nearestColor("빨강", palette), null);
    assert.equal(nearestColor("#000", [{ color: "없음" }]), null);
  });
});

describe("mergeSettings", () => {
  it("저장된 값만 덮고 빠진 항목은 기본값", () => {
    const merged = mergeSettings({ heading: { size: 24 }, highlight: "망가진 값" });
    assert.deepEqual(merged.heading, { ...DEFAULT_SETTINGS.heading, size: 24 });
    assert.deepEqual(merged.highlight, DEFAULT_SETTINGS.highlight);
    assert.deepEqual(mergeSettings(undefined), DEFAULT_SETTINGS);
  });
});
