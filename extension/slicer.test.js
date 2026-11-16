import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./slicer.js";

const { blankRows, blankBands, findCuts, trimPiece, pickPageImages } = globalThis.ToolhubSlicer;

/** 높이 height의 빈 줄 표시. bands: 빈 띠 [start, end) 목록, 나머지는 내용 */
function rows(height, bands) {
  const blank = new Uint8Array(height);
  for (const [start, end] of bands) blank.fill(1, start, end);
  return blank;
}

describe("상세 이미지 자르기", () => {
  it("한 줄이 거의 같은 색이면 빈 줄 (흰 여백·단색 띠), 다른 색이 섞이면 아님", () => {
    const width = 10;
    const data = new Uint8ClampedArray(width * 3 * 4);
    const set = (x, y, [r, g, b]) => data.set([r, g, b, 255], (y * width + x) * 4);
    for (let x = 0; x < width; x++) {
      set(x, 0, [255, 255, 255]);
      set(x, 1, [30, 60, 120 + (x % 2) * 5]); // 단색 띠 (작은 차이)
      set(x, 2, x === 8 ? [0, 0, 0] : [255, 255, 255]); // 글자 한 점
    }
    assert.deepEqual([...blankRows(data, width, 3, { step: 2 })], [1, 1, 0]);
  });

  it("빈 띠는 정해진 두께 이상만", () => {
    assert.deepEqual(blankBands(rows(100, [[0, 5], [20, 40], [90, 100]]), 10), [{ start: 20, end: 40 }, { start: 90, end: 100 }]);
  });

  it("가로의 2배 이하면 자르지 않는다", () => {
    assert.deepEqual(findCuts(rows(1600, []), 800), [[0, 1600]]);
  });

  it("목표 높이 근처의 두꺼운 띠 가운데에서 자른다 (얇은 띠·먼 띠보다)", () => {
    // 가로 800 → 목표 1040, 범위 480~1600. 1000 근처의 얇은 띠(14줄)와 1100 근처의 두꺼운 띠(60줄)
    const blank = rows(3000, [[993, 1007], [1070, 1130], [2050, 2110]]);
    const cuts = findCuts(blank, 800);
    assert.equal(cuts[0][1], 1100);
    assert.equal(cuts[1][1], 2080);
    assert.deepEqual(cuts.at(-1), [2080, 3000]);
  });

  it("띠가 없으면 목표 높이에서, 마지막 조각이 너무 짧지 않게", () => {
    const cuts = findCuts(rows(3300, []), 800);
    assert.deepEqual(cuts, [[0, 1040], [1040, 2080], [2080, 3300]]);
    // 남은 높이가 최대(1600)를 조금 넘을 때 끝에 짧은 조각이 남지 않게
    const tail = findCuts(rows(1700, []), 800);
    assert.ok(tail.every(([top, bottom]) => bottom - top >= 480), JSON.stringify(tail));
  });

  it("조각 위아래 여백은 조금만 남기고, 전부 빈 조각은 버린다", () => {
    const blank = rows(1000, [[0, 100], [900, 1000]]);
    assert.deepEqual(trimPiece(blank, 0, 1000, 16), [84, 916]);
    assert.equal(trimPiece(rows(500, [[0, 500]]), 0, 500), null);
  });
});

describe("상품 페이지 이미지 고르기", () => {
  it("작은 이미지·같은 주소·http가 아닌 주소는 빼고, 지연 로딩 주소를 먼저 본다", () => {
    const picked = pickPageImages([
      { src: "https://a/logo.png", width: 120, height: 40 },
      { src: "https://a/main.jpg", width: 750, height: 750 },
      { src: "https://a/main.jpg", width: 750, height: 750 },
      { src: "data:image/gif;base64,AAA", lazy: "https://a/detail-1.jpg", width: 1, height: 1, shownWidth: 860 },
      { src: "data:image/gif;base64,AAA", width: 0, height: 0, shownWidth: 860 },
      { src: "https://a/detail-2.jpg", width: 0, height: 0, shownWidth: 860 },
      { src: "https://a/hidden.jpg", width: 0, height: 0, shownWidth: 0 },
    ]);
    assert.deepEqual(picked, ["https://a/main.jpg", "https://a/detail-1.jpg", "https://a/detail-2.jpg"]);
  });
});
