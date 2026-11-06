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

  // ── 크리에이터 어드바이저 트렌드 (advisor.js가 화면에서 읽은 카드를 정리해 복사) ──

  /** 키워드 줄 끝의 변동 표시: new, 숫자(▲▼ 기호가 붙기도), 변동 없음 "-" */
  const TREND_MARKER = /^(?:new|[▲▼△▽↑↓+]?\s*\d{1,3}|-)$/i;
  const isTrendMarker = (text) => TREND_MARKER.test(String(text ?? "").trim());

  /**
   * 변동 표시를 해석한다. ▲▼는 아이콘이라 글자에 없을 때가 많아 숫자 색으로 본다 (상승 빨강, 하락 파랑).
   * { kind: "new" | "up" | "down" | "same" | "unknown", amount }
   */
  function trendChange(marker, color) {
    const text = String(marker ?? "").trim();
    if (/^new$/i.test(text)) return { kind: "new", amount: null };
    if (text === "-") return { kind: "same", amount: null };
    const amount = Number(text.replace(/\D/g, "")) || null;
    if (/[▲△↑+]/.test(text)) return { kind: "up", amount };
    if (/[▼▽↓]/.test(text)) return { kind: "down", amount };
    const rgb = parseColor(color);
    if (rgb && rgb[0] - rgb[2] > 40) return { kind: "up", amount };
    if (rgb && rgb[2] - rgb[0] > 40) return { kind: "down", amount };
    return { kind: "unknown", amount };
  }

  const trendLabel = ({ kind, amount }) =>
    kind === "new" ? " (new)" : kind === "up" ? ` (▲${amount ?? ""})` : kind === "down" ? ` (▼${amount ?? ""})` : "";

  /**
   * 탭(검색 유입·메인 유입)마다 읽은 카드를 모은다. 날짜가 바뀌면 새로 시작해, 두 탭에서 차례로 누르면 함께 복사된다.
   * cards: [{ title, items: [{ keyword, kind, amount }] }]
   */
  function mergeAdvisorTrends(stored, date, tab, cards) {
    const base = stored && stored.date === date ? stored : { date, tabs: {} };
    return { date, tabs: { ...base.tabs, [tab]: cards } };
  }

  /** Claude 앱에 그대로 붙여넣을 글. 카드마다 한 줄, 키워드 뒤에 변동 표시 */
  function formatAdvisorTrends(stored) {
    const tabs = Object.entries(stored?.tabs ?? {});
    const total = tabs.reduce((sum, [, cards]) => sum + cards.reduce((n, c) => n + c.items.length, 0), 0);
    const lines = [
      `[크리에이터 어드바이저 트렌드${stored?.date ? ` · ${stored.date}` : ""}]`,
      `이 키워드들로 오늘 쓸 글 5개를 골라줘. new·▲ 상승 키워드를 우선하고, analyze_keywords는 50개씩 나눠 조회해줘. (키워드 ${total}개)`,
    ];
    for (const [tab, cards] of tabs) {
      lines.push("", `## ${tab} (카드 ${cards.length}개)`);
      for (const card of cards) lines.push(`- ${card.title}: ${card.items.map((i) => i.keyword + trendLabel(i)).join(", ")}`);
    }
    return lines.join("\n");
  }

  return {
    FONT_SIZES,
    DEFAULT_SETTINGS,
    parseColor,
    nearestColor,
    mergeSettings,
    MAX_SHELF,
    dataUrlMime,
    bytesToDataUrl,
    addToShelf,
    isLargeImage,
    imageFileName,
    isTrendMarker,
    trendChange,
    mergeAdvisorTrends,
    formatAdvisorTrends,
  };
})();
