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

  return { FONT_SIZES, DEFAULT_SETTINGS, parseColor, nearestColor, mergeSettings };
})();
