import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./lib.js";

const { parseColor, nearestColor, mergeSettings, DEFAULT_SETTINGS, dataUrlMime, bytesToDataUrl, addToShelf, isLargeImage, imageFileName } = globalThis.ToolhubLib;

describe("이미지 모음", () => {
  it("data URL의 이미지 형식, 이미지가 아니면 null", () => {
    assert.equal(dataUrlMime("data:image/png;base64,AAAA"), "image/png");
    assert.equal(dataUrlMime("data:image/svg+xml,<svg/>"), "image/svg+xml");
    assert.equal(dataUrlMime("data:text/html;base64,AAAA"), null);
    assert.equal(dataUrlMime("https://example.com/a.png"), null);
  });

  it("바이트를 data URL로 (큰 파일도 나눠서 인코딩)", () => {
    assert.equal(bytesToDataUrl(new Uint8Array([137, 80, 78, 71]), "image/png"), "data:image/png;base64,iVBORw==");
    const big = new Uint8Array(100_000).fill(65);
    assert.equal(bytesToDataUrl(big, "image/png"), `data:image/png;base64,${Buffer.from(big).toString("base64")}`);
  });

  it("새 이미지는 맨 앞, 같은 이미지는 앞으로 옮기고, 최대 개수를 넘으면 오래된 것부터 뺀다", () => {
    const shelf = [{ id: 2, src: "b" }, { id: 1, src: "a" }];
    assert.deepEqual(addToShelf(shelf, { id: 3, src: "c" }).map((s) => s.id), [3, 2, 1]);
    assert.deepEqual(addToShelf(shelf, { id: 3, src: "a" }).map((s) => s.id), [3, 2]);
    assert.deepEqual(addToShelf(shelf, { id: 3, src: "c" }, 2).map((s) => s.id), [3, 2]);
  });

  it("자동 담기는 원래 주소가 같으면 내용이 조금 달라도 같은 이미지로 본다", () => {
    const shelf = [{ id: 1, src: "data-v1", source: "blob:https://gemini.google.com/abc" }];
    assert.deepEqual(addToShelf(shelf, { id: 2, src: "data-v2", source: "blob:https://gemini.google.com/abc" }).map((s) => s.id), [2]);
    // 원래 주소가 없는 것(붙여넣기)끼리는 주소로 묶지 않는다
    assert.deepEqual(addToShelf([{ id: 1, src: "x" }], { id: 2, src: "y" }).map((s) => s.id), [2, 1]);
  });

  it("생성 이미지처럼 큰 것만 자동으로 담는다 (아이콘·프로필 제외)", () => {
    assert.equal(isLargeImage(1024, 1024), true);
    assert.equal(isLargeImage(1536, 1024), true);
    assert.equal(isLargeImage(48, 48), false);
    assert.equal(isLargeImage(1200, 300), false);
  });

  it("저장 파일 이름은 담은 시각과 형식으로", () => {
    assert.equal(imageFileName(new Date(2026, 10, 1, 14, 5, 9), "image/jpeg"), "toolhub-20261101-140509.jpg");
    assert.equal(imageFileName(new Date(2026, 0, 2, 3, 4, 5), "image/webp"), "toolhub-20260102-030405.webp");
    assert.equal(imageFileName(new Date(2026, 0, 2, 3, 4, 5), null), "toolhub-20260102-030405.png");
  });
});

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

describe("크리에이터 어드바이저 트렌드", () => {
  const { isTrendMarker, trendChange, mergeAdvisorTrends, formatAdvisorTrends } = globalThis.ToolhubLib;

  it("줄 끝의 변동 표시: new, 숫자(기호 포함), -", () => {
    for (const ok of ["new", "NEW", "1", "40", "▲ 3", "▼10", "-"]) assert.equal(isTrendMarker(ok), true, ok);
    for (const no of ["권성준 식당 가격", "2026", "", "--"]) assert.equal(isTrendMarker(no), false, no);
  });

  it("▲▼가 글자에 없으면 숫자 색으로 상승(빨강)·하락(파랑)", () => {
    assert.deepEqual(trendChange("new"), { kind: "new", amount: null });
    assert.deepEqual(trendChange("-"), { kind: "same", amount: null });
    assert.deepEqual(trendChange("▲ 3"), { kind: "up", amount: 3 });
    assert.deepEqual(trendChange("14", "rgb(240, 64, 52)"), { kind: "up", amount: 14 });
    assert.deepEqual(trendChange("3", "rgb(36, 112, 236)"), { kind: "down", amount: 3 });
    assert.deepEqual(trendChange("5", "rgb(80, 80, 80)"), { kind: "unknown", amount: 5 });
  });

  it("탭별로 모으고 날짜가 바뀌면 새로, 카드마다 한 줄로 정리", () => {
    const search = [{ title: "맛집", items: [{ keyword: "권성준 식당 가격", kind: "new", amount: null }, { keyword: "한정선", kind: "up", amount: 1 }] }];
    const main = [{ title: "40-44세 남자", items: [{ keyword: "미국 중간선거", kind: "same", amount: null }, { keyword: "오봉집", kind: "down", amount: 3 }] }];
    let stored = mergeAdvisorTrends(null, "2026. 11. 05.", "검색 유입 트렌드", search);
    stored = mergeAdvisorTrends(stored, "2026. 11. 05.", "메인 유입 트렌드", main);
    const text = formatAdvisorTrends(stored);
    assert.match(text, /^\[크리에이터 어드바이저 트렌드 · 2026\. 11\. 05\.\]/);
    assert.match(text, /\(키워드 4개\)/);
    assert.match(text, /## 검색 유입 트렌드 \(카드 1개\)\n- 맛집: 권성준 식당 가격 \(new\), 한정선 \(▲1\)/);
    assert.match(text, /## 메인 유입 트렌드 \(카드 1개\)\n- 40-44세 남자: 미국 중간선거, 오봉집 \(▼3\)/);
    assert.deepEqual(Object.keys(mergeAdvisorTrends(stored, "2026. 11. 06.", "메인 유입 트렌드", main).tabs), ["메인 유입 트렌드"]);
  });
});
