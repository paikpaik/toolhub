/**
 * 크리에이터 어드바이저 트렌드 화면(검색 유입·메인 유입)에서 카드별 키워드를 읽는다.
 * background.js가 메뉴를 누를 때 lib.js와 함께 주입하고, 마지막 식의 값({ date, tab, cards } | { error })을 받는다.
 *
 * 화면의 클래스 이름은 바뀔 수 있어서 쓰지 않고 모양으로 찾는다:
 * "짧은 키워드 + 끝에 변동 표시(new·숫자·-)"인 줄이 3개 이상 모인 묶음 = 키워드 목록, 그 앞의 가장 가까운 글자 = 카드 제목.
 * 슬라이드로 옆에 숨은 카드도 화면 구조에 들어 있으면 함께 읽힌다 (넘길 때 불러오는 방식이면 본 카드만)
 */
(() => {
  const { isTrendMarker, trendChange } = globalThis.ToolhubLib;
  const TABS = ["검색 유입 트렌드", "메인 유입 트렌드", "주제별 비교", "주제별 트렌드"];

  /** 요소 안의 보이는 글자 조각 (빈칸 제외) */
  const textNodes = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  };

  /** 화면 낭독용 숨은 글자(네이버는 ▲ 대신 "상승"을 숨겨 두기도 한다) → 기호 */
  const WORD_MARKS = { 상승: "▲", 하락: "▼", 신규: "new", NEW: "new" };

  /** 키워드 줄이면 { keyword, marker, color } */
  function asRow(el) {
    let nodes = textNodes(el);
    // 맨 앞의 순위 번호(1, 2, …)는 키워드가 아니다
    if (nodes.length >= 3 && /^\d{1,3}\.?$/.test(nodes[0].textContent.trim())) nodes = nodes.slice(1);
    if (nodes.length < 2 || nodes.length > 4) return null;
    const keyword = nodes[0].textContent.trim();
    // 기호·숨은 글자가 숫자와 따로 떨어져 있으면 합친다 ("상승" + "1" → "▲1", "신규" → "new")
    const parts = nodes.slice(1).map((n) => n.textContent.trim()).map((t) => WORD_MARKS[t] ?? t);
    if (!isTrendMarker(parts.at(-1)) || isTrendMarker(keyword) || keyword.length > 40) return null;
    const joined = parts.join("");
    const marker = isTrendMarker(joined) ? joined : parts.includes("new") ? "new" : parts.at(-1);
    return { keyword, marker, color: getComputedStyle(nodes.at(-1).parentElement).color };
  }

  // 줄 후보를 모아, 같은 부모 아래 3줄 이상인 것만 목록으로 본다 (줄 안의 작은 요소가 또 줄로 잡혀도 부모가 1줄뿐이라 걸러진다)
  const rows = new Map();
  for (const el of document.body.querySelectorAll("li, div, a, tr, button, p")) {
    // 줄은 짧다. 큰 묶음은 글자 조각을 세지 않고 건너뛴다 (화면 전체를 여러 번 훑지 않게)
    if (el.textContent.length > 80 || el.closest("nav, header")) continue;
    const row = asRow(el);
    if (row) rows.set(el, row);
  }
  const lists = new Map();
  for (const el of rows.keys()) {
    const parent = el.parentElement;
    if (!parent) continue;
    if (!lists.has(parent)) lists.set(parent, []);
    lists.get(parent).push(el);
  }
  const rowEls = new Set(rows.keys());
  const inRow = (node) => {
    for (let el = node.parentElement; el; el = el.parentElement) if (rowEls.has(el)) return true;
    return false;
  };

  /** 목록 앞쪽의 가장 가까운 글자(줄·변동 표시가 아닌 것) = 카드 제목. 위로 6단계까지 찾는다 */
  function titleOf(list) {
    let scope = list;
    for (let depth = 0; depth < 6 && scope.parentElement; depth++) {
      scope = scope.parentElement;
      const before = textNodes(scope).filter(
        (n) => list.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING && !inRow(n) && !isTrendMarker(n.textContent),
      );
      const text = before.at(-1)?.textContent.trim();
      if (text && text.length <= 30) return text;
    }
    return "제목 없음";
  }

  // 같은 제목이 이어지는 목록(카드 안이 5줄씩 나뉜 경우)은 한 카드로 합친다
  const cards = [];
  for (const [list, els] of lists) {
    if (els.length < 3) continue;
    const title = titleOf(list);
    const items = els.map((el) => {
      const { keyword, marker, color } = rows.get(el);
      return { keyword, ...trendChange(marker, color) };
    });
    const prev = cards.at(-1);
    if (prev && prev.title === title) prev.items.push(...items);
    else cards.push({ title, items });
  }

  // 지금 고른 탭: aria·class 표시가 있으면 그것, 없으면 배경색이 혼자 다른 탭
  const tabEls = [...document.querySelectorAll("a, button, li, span, div")].filter((el) => TABS.includes(el.textContent.trim()) && el.children.length <= 1);
  const marked = tabEls.find((el) => {
    const target = el.closest("[aria-selected], [aria-current], [class]") ?? el;
    return (
      target.getAttribute("aria-selected") === "true" ||
      target.getAttribute("aria-current") ||
      /\b(on|active|selected|current)\b/i.test(target.getAttribute("class") ?? "")
    );
  });
  const backgrounds = tabEls.map((el) => getComputedStyle(el).backgroundColor);
  const odd = tabEls.find((_, i) => backgrounds.filter((b) => b === backgrounds[i]).length === 1);
  const tab = (marked ?? odd)?.textContent.trim() ?? "트렌드";

  const date = textNodes(document.body)
    .map((n) => n.textContent.trim())
    .find((t) => /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?$/.test(t));

  if (cards.length === 0) return { error: "이 화면에서 트렌드 키워드를 찾지 못했어요. 트렌드 › 검색 유입 트렌드(또는 메인 유입 트렌드) 화면에서 눌러 주세요." };
  return { date: date ?? new Date().toLocaleDateString("ko-KR"), tab, cards };
})();
