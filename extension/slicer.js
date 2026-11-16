/**
 * 쇼핑몰 상세 이미지(세로로 긴 한 장)를 블로그에 넣기 좋은 여러 장으로 자르는 위치 계산.
 * 정해진 높이로 자르면 글자·사진이 반으로 갈리므로, 섹션 사이의 여백·단색 띠(한 줄이 거의 같은 색인 구간)
 * 가운데에서 자른다. 픽셀 읽기는 패널(sidepanel-connect.js)이 하고, 여기는 계산만 한다 (테스트 대상)
 */
globalThis.ToolhubSlicer = (() => {
  /** 조각 높이: 가로의 1.3배 안팎(모바일 한 화면쯤), 가로의 0.6~2배 안에서 띠를 찾는다 */
  const TARGET = 1.3;
  const MIN = 0.6;
  const MAX = 2;
  /** 이보다 얇은 띠는 글자 줄 사이 간격일 수 있어 자르는 자리로 보지 않는다 */
  const MIN_BAND = 12;
  /** 띠가 두꺼울수록 섹션 경계일 가능성이 높아 점수를 더 주되, 이 이상은 같게 본다 */
  const BAND_CAP = 80;
  /** 같은 색으로 볼 차이 (0~255, 채널마다), 가로로 몇 px마다 볼지 */
  const TOLERANCE = 10;
  const SAMPLE_STEP = 4;
  /** 조각 위아래의 빈 여백은 이만큼만 남기고 걷어낸다 */
  const KEEP_MARGIN = 16;

  /**
   * RGBA 픽셀(ImageData.data, 가로 width) 중 rows줄 → 줄마다 빈 줄(1)인지.
   * 빈 줄: 그 줄의 모든 표본 픽셀이 줄 첫 픽셀과 거의 같은 색 (흰 여백뿐 아니라 단색 배경 띠도)
   */
  function blankRows(data, width, rows, { tolerance = TOLERANCE, step = SAMPLE_STEP } = {}) {
    const out = new Uint8Array(rows);
    for (let y = 0; y < rows; y++) {
      const row = y * width * 4;
      const [r, g, b, a] = [data[row], data[row + 1], data[row + 2], data[row + 3]];
      let blank = 1;
      for (let x = step; x < width && blank; x += step) {
        const i = row + x * 4;
        if (Math.abs(data[i] - r) > tolerance || Math.abs(data[i + 1] - g) > tolerance || Math.abs(data[i + 2] - b) > tolerance || Math.abs(data[i + 3] - a) > tolerance) blank = 0;
      }
      out[y] = blank;
    }
    return out;
  }

  /** 빈 줄이 MIN_BAND줄 이상 이어지는 구간 [start, end) */
  function blankBands(blank, minBand = MIN_BAND) {
    const bands = [];
    let start = -1;
    for (let y = 0; y <= blank.length; y++) {
      if (y < blank.length && blank[y]) {
        if (start < 0) start = y;
      } else if (start >= 0) {
        if (y - start >= minBand) bands.push({ start, end: y });
        start = -1;
      }
    }
    return bands;
  }

  /**
   * 자를 조각 [위, 아래) 목록. 높이가 가로의 2배 이하면 자르지 않는다.
   * 조각마다 목표 높이 근처에서 두껍고 가까운 띠의 가운데를 고르고, 띠가 없으면 목표 높이에서 자른다.
   * 마지막 조각이 너무 짧아지지 않게 끝에서 MIN만큼은 남긴다
   */
  function findCuts(blank, width) {
    const height = blank.length;
    const target = Math.round(width * TARGET);
    const min = Math.round(width * MIN);
    const max = Math.round(width * MAX);
    if (height <= max) return [[0, height]];
    const bands = blankBands(blank);
    const pieces = [];
    let top = 0;
    while (height - top > max) {
      const goal = top + target;
      const low = top + min;
      const high = Math.min(top + max, height - min);
      let cut = Math.min(goal, high);
      let best = -Infinity;
      for (const band of bands) {
        const middle = (band.start + band.end) >> 1;
        if (middle < low || middle > high) continue;
        const score = Math.min(band.end - band.start, BAND_CAP) - (Math.abs(middle - goal) / target) * 40;
        if (score > best) {
          best = score;
          cut = middle;
        }
      }
      pieces.push([top, cut]);
      top = cut;
    }
    pieces.push([top, height]);
    return pieces;
  }

  /** 조각 위아래의 빈 줄을 KEEP_MARGIN만 남기고 걷어낸다. 전부 빈 조각이면 null (버린다) */
  function trimPiece(blank, top, bottom, keep = KEEP_MARGIN) {
    let first = top;
    while (first < bottom && blank[first]) first++;
    if (first === bottom) return null;
    let last = bottom;
    while (last > first && blank[last - 1]) last--;
    return [Math.max(top, first - keep), Math.min(bottom, last + keep)];
  }

  /** 상품 페이지에서 담을 만한 이미지 주소: 아이콘·로고 같은 작은 것은 빼고, 같은 주소는 한 번만 (페이지 순서대로) */
  function pickPageImages(images, { minWidth = 300, minHeight = 200 } = {}) {
    const seen = new Set();
    const picked = [];
    for (const image of images) {
      // 지연 로딩 이미지는 진짜 주소가 data-src 등에 있고 src는 빈 그림인 경우가 있다
      const url = [image.lazy, image.src].find((u) => typeof u === "string" && /^https?:\/\//.test(u));
      if (!url || seen.has(url)) continue;
      // 원래 크기는 그 주소가 이미 뜬 경우만 믿는다 (지연 로딩 자리 그림의 1×1 크기로 거르지 않게)
      const loaded = url === image.src && image.width > 0 && image.height > 0;
      if (loaded ? image.width < minWidth || image.height < minHeight : (image.shownWidth ?? 0) < minWidth) continue;
      seen.add(url);
      picked.push(url);
    }
    return picked;
  }

  return { blankRows, blankBands, findCuts, trimPiece, pickPageImages, TARGET, MIN, MAX };
})();
