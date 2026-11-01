/** 확장 프로그램 공용 함수 (페이지 스크립트·설정 화면·테스트에서 함께 쓴다). 빌드 없이 쓰려고 전역에 둔다 */
globalThis.ToolhubLib = (() => {
  /** 네이버 스마트에디터 ONE의 글자 크기 목록 */
  const FONT_SIZES = [11, 13, 15, 16, 19, 24, 28, 30, 34, 38];

  /** color가 ""이면 색은 바꾸지 않는다 */
  const DEFAULT_SETTINGS = {
    heading: { size: 19, bold: true, color: "" },
    emphasis: { bold: true, color: "#ff0010" },
    highlight: { color: "#fff593" },
  };

  /** "#abc", "#aabbcc", "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)" → [r, g, b]. 알 수 없으면 null */
  function parseColor(value) {
    const text = String(value ?? "").trim().toLowerCase();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
      const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
      return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
    }
    const rgb = text.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
  }

  /**
   * 팔레트 후보({ color }) 중 target과 가장 가까운 것. 에디터 팔레트에 정확히 같은 색이 없어도 비슷한 색을 고르기 위함.
   * 색을 읽을 수 없는 후보는 건너뛰고, 고를 게 없으면 null
   */
  function nearestColor(target, candidates) {
    const goal = parseColor(target);
    if (!goal) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const rgb = parseColor(candidate.color);
      if (!rgb) continue;
      const distance = rgb.reduce((sum, v, i) => sum + (v - goal[i]) ** 2, 0);
      if (distance < bestDistance) [best, bestDistance] = [candidate, distance];
    }
    return best;
  }

  /** 저장된 설정을 기본값 위에 덮는다 (새 항목이 생겨도 예전 설정이 깨지지 않게) */
  function mergeSettings(saved) {
    const merged = {};
    for (const [key, defaults] of Object.entries(DEFAULT_SETTINGS)) {
      merged[key] = { ...defaults, ...(saved && typeof saved[key] === "object" ? saved[key] : {}) };
    }
    return merged;
  }

  /** 패널에 담아 두는 이미지 수. 많아지면 오래된 것부터 빠진다 */
  const MAX_SHELF = 30;

  const MIME_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif" };

  /** data:image/png;base64,... → "image/png". 이미지가 아니면 null */
  function dataUrlMime(dataUrl) {
    const mime = String(dataUrl).match(/^data:(image\/[\w.+-]+)[;,]/)?.[1];
    return mime ?? null;
  }

  /** 바이트 → data URL (서비스 워커에는 FileReader가 없을 수 있어 직접 인코딩) */
  function bytesToDataUrl(bytes, mime) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${mime};base64,${btoa(binary)}`;
  }

  /**
   * 새 이미지를 맨 앞에 넣는다. 같은 이미지(내용이 같은 data URL, 또는 원래 주소 source가 같은 것)는 앞으로 옮기기만 한다.
   * 자동 담기는 같은 이미지가 화면에 다시 그려질 때마다 들어오므로 원래 주소로도 중복을 거른다
   */
  function addToShelf(shelf, item, max = MAX_SHELF) {
    const same = (s) => s.src === item.src || (!!item.source && s.source === item.source);
    return [item, ...shelf.filter((s) => !same(s))].slice(0, max);
  }

  /** 자동으로 담을 만한 이미지인지 (생성 이미지는 크다. 아이콘·프로필 사진은 제외) */
  const AUTO_MIN_SIZE = 400;
  const isLargeImage = (width, height) => width >= AUTO_MIN_SIZE && height >= AUTO_MIN_SIZE;

  /** toolhub-20261101-143005.png */
  function imageFileName(date, mime) {
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `toolhub-${stamp}.${MIME_EXTENSIONS[mime] ?? "png"}`;
  }

  return { FONT_SIZES, DEFAULT_SETTINGS, parseColor, nearestColor, mergeSettings, MAX_SHELF, dataUrlMime, bytesToDataUrl, addToShelf, isLargeImage, imageFileName };
})();
