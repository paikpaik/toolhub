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

  /** 패널에 담아 두는 이미지 수. 많아지면 오래된 것부터 빠진다 (원본은 IndexedDB에 한 장씩 있어 장수가 늘어도 느려지지 않는다) */
  const MAX_SHELF = 200;

  const MIME_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif" };

  /** data:image/png;base64,... → "image/png". 이미지가 아니면 null */
  function dataUrlMime(dataUrl) {
    const mime = String(dataUrl).match(/^data:(image\/[\w.+-]+)[;,]/)?.[1];
    return mime ?? null;
  }

  /**
   * 순서 목록(shelfIndex)의 맨 앞에 새 이미지를 넣는다. 같은 이미지(내용의 해시 hash, 또는 원래 주소 source가 같은 것)는 앞으로 옮기기만 한다.
   * 자동 담기는 같은 이미지가 화면에 다시 그려질 때마다 들어오므로 원래 주소로도 중복을 거른다
   */
  function addToShelf(shelf, item, max = MAX_SHELF) {
    const same = (s) => s.hash === item.hash || (!!item.source && s.source === item.source);
    return [item, ...shelf.filter((s) => !same(s))].slice(0, max);
  }

  /** 새 이미지 id. 담은 시각(ms)인데, 같은 순간에 둘이 담겨도 겹치지 않게 지금까지의 가장 큰 id보다 크게 */
  function nextShelfId(shelf, now) {
    return Math.max(now, ...shelf.map((s) => s.id + 1));
  }

  /** prev에는 있었는데 next에서 빠진 이미지 id (원본을 함께 지우기 위함) */
  function removedShelfIds(prev, next) {
    const kept = new Set(next.map((s) => s.id));
    return prev.filter((s) => !kept.has(s.id)).map((s) => s.id);
  }

  /** 예전 방식에서 옮긴 이미지를 목록에 합친다. 최근 것이 앞, 같은 id는 한 번만, 최대 장수까지 */
  function mergeShelf(shelf, moved, max = MAX_SHELF) {
    const ids = new Set(shelf.map((s) => s.id));
    return [...shelf, ...moved.filter((s) => !ids.has(s.id))].sort((a, b) => b.id - a.id).slice(0, max);
  }

  /** 초안의 이미지 자리 표시 한 문단: [이미지: 장면 | alt: … | 추천: …] (packages/collector의 MARKER_PATTERN과 같은 모양) */
  const IMAGE_SLOT = /^\[이미지:\s*([^\]]+)\]$/;

  /**
   * 에디터 문단 글자가 이미지 자리 표시 하나뿐인지. 대표 썸네일 자리면 "thumbnail", 본문 이미지 자리면 "body", 아니면 null.
   * 문장 속에 섞인 표시는 자리로 보지 않는다 (본문을 지우지 않게). 전각 괄호·콜론, 에디터가 넣는 보이지 않는 글자는 무시한다
   */
  function imageSlotKind(text) {
    const normalized = String(text ?? "")
      .replace(/［/g, "[")
      .replace(/］/g, "]")
      .replace(/：/g, ":")
      .replace(/[​﻿]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const match = normalized.match(IMAGE_SLOT);
    if (!match) return null;
    return /^대표\s*썸네일/.test(match[1].trim()) ? "thumbnail" : "body";
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

  /** 계정 하나에 쓸 초안 편수 (요청문의 "계정 N개로 초안 N×5개") */
  const DRAFTS_PER_ACCOUNT = 5;

  /**
   * 요청문 첫 문장의 편수. accountCount: 웹에 등록된 계정 수, 웹이 꺼져 있어 모르면 null.
   * 모르면 "계정마다 5개씩"이라고만 써서 Claude가 등록된 계정 수로 정하게 한다
   */
  function trendRequestGoal(accountCount) {
    if (accountCount === null || accountCount === undefined) return `오늘 등록된 계정마다 ${DRAFTS_PER_ACCOUNT}개씩 네이버에 쓸 초안을`;
    if (accountCount === 0) return "오늘 네이버에 쓸 초안 15개를";
    return `오늘 ${accountCount}개의 계정으로 네이버에 쓸 초안 ${accountCount * DRAFTS_PER_ACCOUNT}개를`;
  }

  /** Claude 앱에 그대로 붙여넣을 글. 카드마다 한 줄, 키워드 뒤에 변동 표시 */
  function formatAdvisorTrends(stored, accountCount = null) {
    const tabs = Object.entries(stored?.tabs ?? {});
    const total = tabs.reduce((sum, [, cards]) => sum + cards.reduce((n, c) => n + c.items.length, 0), 0);
    const lines = [
      `[크리에이터 어드바이저 트렌드${stored?.date ? ` · ${stored.date}` : ""}]`,
      `이 키워드들로 ${trendRequestGoal(accountCount)} 작성해줘. new·▲ 상승 키워드를 우선하고, analyze_keywords는 50개씩 나눠 조회해줘. (키워드 ${total}개)`,
    ];
    for (const [tab, cards] of tabs) {
      lines.push("", `## ${tab} (카드 ${cards.length}개)`);
      for (const card of cards) lines.push(`- ${card.title}: ${card.items.map((i) => i.keyword + trendLabel(i)).join(", ")}`);
    }
    return lines.join("\n");
  }

  // ── 블로그 통계 › 유입분석 › 검색 유입: 검색어와 비율 ──

  /** 검색어가 아닌 줄 (탭·머리글) */
  const INFLOW_LABELS = new Set(["전체", "검색 유입", "사이트 유입", "유입경로", "상세 유입경로", "일간", "주간", "월간", "유입분석"]);
  /** 오른쪽 "상세 유입경로" 줄 (네이버 통합검색_모바일, 다음 통합검색, 구글 …): 검색어가 아니다 */
  const INFLOW_DETAIL = /^(네이버|다음|구글|google|bing|빙|zum|줌|네이트|yahoo)(\s|$)/i;
  const isInflowDetail = (text) => INFLOW_DETAIL.test(text) && (/검색|VIEW|뷰|_(모바일|PC)$/i.test(text) || /^(구글|google|bing|빙|yahoo)$/i.test(text));
  const PERCENT = /^(\d{1,3}(?:\.\d+)?)\s*%$/;
  const pad = (n) => String(n).padStart(2, "0");

  /**
   * 유입분석 화면 글자 줄 → { period, total, keywords: [{ keyword, share }] } | { error }.
   * 화면 구조(클래스 이름)를 몰라 글자로 읽는다: "검색어" 다음 줄(또는 같은 줄 탭 뒤)이 "8.39%"인 줄이 검색어다
   */
  function parseInflowPage(rawLines) {
    const lines = rawLines.map((line) => String(line ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
    const all = lines.join(" ");
    if (!lines.some((line) => line === "검색 유입" || /^검색 유입\s/.test(line))) return { error: "유입분석의 검색 유입 탭이 아니에요. 블로그 통계 › 유입분석 › 검색 유입을 열어 주세요." };
    const range = all.match(/(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?\s*~\s*(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})/);
    const day = all.match(/(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\./);
    const period = range
      ? `${range[1]}-${pad(range[2])}-${pad(range[3])}~${range[4]}-${pad(range[5])}-${pad(range[6])}`
      : day
        ? `${day[1]}-${pad(day[2])}-${pad(day[3])}`
        : null;
    const total = Number(all.match(/검색 유입\s*(\d{1,3}(?:\.\d+)?)\s*%/)?.[1]) || null;
    const keywords = [];
    const add = (keyword, share) => {
      const text = keyword.trim();
      if (!text || INFLOW_LABELS.has(text) || /^검색 유입/.test(text) || isInflowDetail(text) || PERCENT.test(text) || text.length > 60) return;
      if (!keywords.some((k) => k.keyword === text)) keywords.push({ keyword: text, share: Number(share) });
    };
    for (let i = 0; i < lines.length; i++) {
      const same = lines[i].match(/^(.+?)\s+(\d{1,3}(?:\.\d+)?)\s*%$/);
      if (same) add(same[1], same[2]);
      else if (i > 0 && PERCENT.test(lines[i]) && !PERCENT.test(lines[i - 1])) add(lines[i - 1], lines[i].match(PERCENT)[1]);
    }
    if (!keywords.length) return { error: "검색어를 찾지 못했어요. 표가 다 뜬 뒤 다시 눌러 주세요." };
    return { period, total, keywords };
  }

  /** 지금 탭·프레임 주소에서 네이버 블로그 아이디 (주소의 blogId=, 또는 blog.naver.com/<아이디>) */
  function blogIdFromUrls(urls) {
    const ids = urls.flatMap((raw) => {
      let url;
      try {
        url = new URL(raw);
      } catch {
        return [];
      }
      const param = url.searchParams.get("blogId");
      if (param) return [{ id: param, strong: true }];
      const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /(^|\.)blog\.naver\.com$/.test(url.hostname) && /^[A-Za-z0-9_-]{1,30}$/.test(first) && !/\.(naver|nhn)$/i.test(first) ? [{ id: first, strong: false }] : [];
    });
    const pick = ids.find((i) => i.strong) ?? ids[0];
    return pick ? pick.id.toLowerCase() : null;
  }

  /** 복사한 유입 검색어를 블로그마다 모은다. 계정 여러 개를 차례로 누르면 함께 복사된다 (반나절 지난 것은 버림) */
  const INFLOW_KEEP_MS = 12 * 60 * 60 * 1000;
  function mergeInflow(stored, key, entry, now = Date.now()) {
    const kept = Object.entries(stored?.entries ?? {}).filter(([k, e]) => k !== key && now - e.at < INFLOW_KEEP_MS);
    return { entries: { ...Object.fromEntries(kept), [key]: { ...entry, at: now } } };
  }

  /** Claude 앱에 붙여넣을 글. 계정마다 한 묶음. accounts: 웹 계정 [{ name, blogId }] (모르면 []) */
  function formatInflow(stored, accounts = []) {
    const entries = Object.values(stored?.entries ?? {});
    const lines = [
      "[블로그 유입 검색어]",
      `이 검색어들로 계정마다 review_search_inflow를 불러 아직 글이 없는 검색어를 새 글감 후보로 정리해줘. (블로그 ${entries.length}개)`,
    ];
    for (const e of entries) {
      const name = accounts.find((a) => a.blogId && a.blogId === e.blogId)?.name;
      const who = name ?? `블로그 아이디 ${e.blogId ?? "모름"} (toolhub 계정 화면에 블로그 아이디를 넣어 주세요)`;
      lines.push("", `## ${who} · ${e.period ?? "기간 모름"}${e.total ? ` · 검색 유입 ${e.total}%` : ""}`);
      for (const k of e.keywords) lines.push(`- ${k.keyword} ${k.share}%`);
    }
    return lines.join("\n");
  }

  /** 사용자가 직접 띄운 웹(npm run web, 3000)을 먼저, 없으면 MCP open_web이 띄운 웹(3100) */
  const WEB_BASES = ["http://localhost:3000", "http://localhost:3100"];

  /**
   * toolhub 웹에 등록된 블로그 계정 [{ id, name, topics }]. 웹이 꺼져 있거나 옛 웹(계정 기능 없음)이면 null.
   * 웹이 꺼져 있으면 연결이 바로 거절되지만, 멈춘 웹에 오래 붙잡히지 않게 시간을 둔다
   */
  async function fetchWebAccounts() {
    for (const base of WEB_BASES) {
      try {
        const res = await fetch(`${base}/api/accounts`, { signal: AbortSignal.timeout(2000) });
        if (!res.ok) continue;
        const { accounts } = await res.json();
        if (Array.isArray(accounts)) return accounts;
      } catch {
        // 이 주소는 꺼져 있다. 다음 주소
      }
    }
    return null;
  }

  /**
   * 초안 채우기 전 글쓰기 화면 확인 (패널 "초안" 메뉴). 쓰던 글을 덮어쓰지 않도록 빈 글이 아니면 이유를 준다.
   * state: 에디터의 { title: 제목 글자, body: 본문 글자 수, components: 덩어리 수 (빈 글은 제목·본문 2개) }
   */
  function fillProblem(state) {
    if (state.title) return "제목이 이미 있어요. 새 글쓰기 화면에서 채워 주세요 (쓰던 글을 덮어쓰지 않아요).";
    if (state.body > 0 || state.components > 2) return "본문에 이미 내용이 있어요. 새 글쓰기 화면에서 채워 주세요 (쓰던 글을 덮어쓰지 않아요).";
    return null;
  }

  /** 공백을 하나로 (에디터에 들어간 제목과 넣으려던 제목 비교) */
  const sameText = (a, b) => String(a ?? "").replace(/\s+/g, " ").trim() === String(b ?? "").replace(/\s+/g, " ").trim();

  return {
    FONT_SIZES,
    DEFAULT_SETTINGS,
    parseColor,
    nearestColor,
    mergeSettings,
    MAX_SHELF,
    dataUrlMime,
    addToShelf,
    nextShelfId,
    removedShelfIds,
    mergeShelf,
    imageSlotKind,
    isLargeImage,
    imageFileName,
    isTrendMarker,
    trendChange,
    mergeAdvisorTrends,
    formatAdvisorTrends,
    trendRequestGoal,
    parseInflowPage,
    blogIdFromUrls,
    mergeInflow,
    formatInflow,
    WEB_BASES,
    fetchWebAccounts,
    fillProblem,
    sameText,
  };
})();
