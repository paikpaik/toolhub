/**
 * 네이버 쇼핑 커넥트(브랜드커넥트) 상품 페이지 → Claude 앱에 붙여넣을 [쇼핑 커넥트 요청] 글.
 * 페이지 구조(클래스 이름)를 모르고 바뀔 수도 있어서, 화면 글자(innerText 줄)를 "판매가"·"할인가" 같은 라벨로 읽는다.
 * 빌드 없이 쓰려고 전역에 둔다 (패널·테스트 공용)
 */
globalThis.ToolhubConnect = (() => {
  /** https://brandconnect.naver.com/<채널>/affiliate/products/<상품> → 상품 번호. 아니면 null */
  function connectProductId(url) {
    try {
      const { hostname, pathname } = new URL(url);
      if (hostname !== "brandconnect.naver.com") return null;
      return /^\/\d+\/affiliate\/products\/(\d+)/.exec(pathname)?.[1] ?? null;
    } catch {
      return null;
    }
  }

  /** 상품 정보 영역에서 값으로 읽을 라벨. 수수료는 글에 쓰지 않으므로 읽기만 하고 요청문에 넣지 않는다 */
  const PRICE_LABELS = ["판매가", "할인가", "수수료"];
  const SUMMARY_END = "링크 복사";
  /** 상세 정보 글자는 이만큼만 (브리프가 5,000자에서 자르고, 나머지 정보와 함께 붙여넣기 좋은 길이) */
  const DETAIL_MAX = 4000;

  const clean = (line) => line.replace(/\s+/g, " ").trim();
  /** 라벨만 있거나 라벨 뒤에 값이 이어지는 줄 ("수수료+" 배지는 라벨이 아님) */
  const startsWithLabel = (line, label) => line === label || new RegExp(`^${label}[\\s:\\d]`).test(line);
  const isLabel = (line) => PRICE_LABELS.some((label) => startsWithLabel(line, label));

  /** 라벨 줄의 값: 같은 줄에 있으면 그 뒤, 아니면 다음 라벨 전까지 이어지는 줄들 */
  function labelValue(lines, label) {
    const at = lines.findIndex((line) => startsWithLabel(line, label));
    if (at < 0) return null;
    const parts = [lines[at].slice(label.length).trim()];
    for (let i = at + 1; i < lines.length && !isLabel(lines[i]) && lines[i] !== SUMMARY_END; i++) parts.push(lines[i]);
    return parts.filter(Boolean).join(" ") || null;
  }

  /**
   * 브랜드커넥트의 "상세 정보"는 본문이 아니라 스마트스토어 iframe 안에 있다 (2026-11-16 진단 정보:
   * m.smartstore.naver.com/<스토어>/products/<번호>/shopping-connect-contents). 글자·상세 이미지는 이 프레임에서 읽는다
   */
  const isDetailFrame = (url) => /^https:\/\/(m\.)?smartstore\.naver\.com\/.+\/shopping-connect-contents/.test(url ?? "");

  /**
   * 상품 페이지 글자 줄 → 상품 정보. 상품 정보 영역은 "상품 정보" 제목부터 "링크 복사"까지.
   * 상세 정보는 detailLines(상세 iframe의 글자 줄)가 있으면 그것, 없으면 본문의 "상세 정보" 제목 뒤
   * (판매자가 글자로 넣은 FAQ·표. 이미지 속 글자는 못 읽음)
   */
  function parseConnectPage(rawLines, { shoppingUrl = null, detailLines } = {}) {
    const lines = rawLines.map(clean).filter(Boolean);
    const start = lines.indexOf("상품 정보");
    const end = lines.indexOf(SUMMARY_END, start + 1);
    if (start < 0 || end < 0) return null;
    const summary = lines.slice(start + 1, end);

    // 가격 라벨 전까지가 브랜드·상품명·평점 (이미지 위 "수수료+" 같은 배지는 뺀다)
    const firstLabel = summary.findIndex(isLabel);
    const head = summary.slice(0, firstLabel < 0 ? summary.length : firstLabel).filter((line) => !/^수수료/.test(line));
    const ratingLine = head.find((line) => /\d\.\d+/.test(line) && /리뷰|★/.test(line)) ?? head.find((line) => /^★?\s*\d\.\d+$/.test(line));
    const reviewLine = head.find((line) => /리뷰\s*[\d,]+/.test(line));
    const texts = head.filter((line) => line !== ratingLine && line !== reviewLine && !/^★?\s*\d\.\d+$/.test(line));
    // 상품명은 가장 긴 줄, 브랜드는 상품명 바로 앞의 짧은 줄
    const name = texts.reduce((longest, line) => (line.length > longest.length ? line : longest), "");
    const before = texts[texts.indexOf(name) - 1];

    // 상세 iframe이 있으면 본문의 "상세 정보" 뒤는 사이트 아래쪽 메뉴(TOP·로그아웃·이용약관)뿐이라 보지 않는다
    const detailAt = lines.indexOf("상세 정보", end);
    const fromPage = detailAt < 0 ? [] : lines.slice(detailAt + 1).filter((line) => !/^네이버 쇼핑에서 보기/.test(line));
    let detail = (detailLines ? detailLines.map(clean).filter(Boolean) : fromPage).join("\n");
    if (detail.length > DETAIL_MAX) detail = `${detail.slice(0, DETAIL_MAX)}\n…(이하 생략)`;

    return {
      brand: before && before.length <= 30 ? before : null,
      name: name || null,
      rating: ratingLine?.match(/\d\.\d+/)?.[0] ?? null,
      reviews: reviewLine?.match(/리뷰\s*([\d,]+)/)?.[1] ?? null,
      price: labelValue(summary, "판매가"),
      salePrice: labelValue(summary, "할인가"),
      detail: detail || null,
      shoppingUrl,
    };
  }

  const MODE_LABELS = { guide: "구매 가이드", experience: "실제 경험" };

  /**
   * 사람이 넣는 값이 모자라면 이유, 다 됐으면 null.
   * hasAccounts: 웹에 계정이 등록돼 있는지 (그러면 네이버 초안은 계정이 있어야 저장된다)
   */
  function connectRequestProblem({ link, mode, memo, account, hasAccounts = false }) {
    const url = link?.trim();
    if (!url) return "쇼핑 커넥트 링크를 붙여넣어 주세요 (브랜드커넥트의 \"링크 복사\").";
    if (!/^https?:\/\/\S+$/.test(url)) return "링크는 https://로 시작하는 주소 하나만 넣어 주세요.";
    if (mode === "experience" && !memo?.trim()) return "실제 경험은 경험 메모가 있어야 해요. 써 본 내용을 적거나 구매 가이드를 골라 주세요.";
    if (hasAccounts && !account?.trim()) return "이 글을 올릴 계정을 골라 주세요.";
    return null;
  }

  /** MCP 안내문("[쇼핑 커넥트 요청]")과 get_writing_brief의 link·mode·product·experience에 맞춘 요청 글 */
  function formatConnectRequest({ product, link, mode = "guide", memo, keyword, account }) {
    const info = [
      product.brand && `브랜드: ${product.brand}`,
      product.name && `상품명: ${product.name}`,
      product.rating && `평점: ${product.rating}${product.reviews ? ` (리뷰 ${product.reviews})` : ""} — 네이버 쇼핑 기준`,
      product.price && `판매가: ${product.price}`,
      product.salePrice && `할인가: ${product.salePrice}`,
      product.shoppingUrl && `네이버 쇼핑 상품 페이지 (참고용, 글에 넣지 않음): ${product.shoppingUrl}`,
      product.detail && `상세 정보 (판매자 설명):\n${product.detail}`,
    ].filter(Boolean);
    const lines = [
      "[쇼핑 커넥트 요청]",
      "toolhub로 네이버 쇼핑 커넥트 초안을 써서 저장해 주세요. get_writing_brief에 아래 링크·글 방식·상품 정보·경험 메모를 그대로 넘겨 주세요." +
        (account?.trim() ? " save_draft의 account에는 아래 계정을 넣어 주세요." : ""),
      ...(account?.trim() ? [`계정: ${account.trim()}`] : []),
      `키워드: ${keyword?.trim() || "상품명에서 검색될 말로 정해 주세요"}`,
      `쇼핑 커넥트 링크: ${link.trim()}`,
      `글 방식: ${MODE_LABELS[mode]} (${mode})`,
    ];
    if (mode === "experience") lines.push("경험 메모:", memo.trim());
    lines.push("상품 정보:", ...info);
    return lines.join("\n");
  }

  return { connectProductId, isDetailFrame, parseConnectPage, connectRequestProblem, formatConnectRequest, MODE_LABELS };
})();
