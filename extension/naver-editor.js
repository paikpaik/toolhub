/**
 * 네이버 스마트에디터 ONE 조작.
 * 에디터는 글 내용을 내부에서 따로 관리해서 화면(DOM)을 직접 고치면 저장 때 사라질 수 있다.
 * 그래서 사람이 하듯 에디터 툴바 버튼(굵게·글자 크기·글자색·배경색)을 대신 누른다.
 *
 * 에디터 구조(클래스 이름)는 SELECTORS에만 모아 둔다. 네이버가 에디터를 바꿔 버튼을 못 찾으면
 * 팝업의 "진단 정보 복사" 결과를 보고 여기를 고친다.
 */
globalThis.ToolhubNaver = (() => {
  const SELECTORS = {
    content: ".se-content",
    toolbar: ".se-toolbar",
    bold: ".se-bold-toolbar-button",
    fontSize: ".se-font-size-code-toolbar-button",
    fontColor: ".se-font-color-toolbar-button",
    backgroundColor: ".se-background-color-toolbar-button",
    /** 눌려 있는 툴바 버튼에 붙는 클래스 */
    activeClass: "se-is-selected",
    /** 색 팔레트의 색 버튼 */
    colorOption: "[data-color]",
    /** 문단 서식(본문·소제목·인용구) 드롭다운과 그 안의 "소제목" */
    textFormat: ".se-text-format-toolbar-button",
    sectionTitleOption: ".se-toolbar-option-text-format-sectionTitle-button",
    /** 본문 덩어리와 그 안의 한 문단. 소제목으로 바꾸면 se-sectionTitle 덩어리로 따로 빠진다 */
    textComponent: ".se-component.se-text",
    paragraph: ".se-text-paragraph",
    /** 본문에 들어간 사진 덩어리. 삽입이 됐는지 개수로 확인한다 */
    image: ".se-component.se-image",
  };

  /** toolhub "서식 포함 복사"가 소제목에 넣는 글자 크기 (apps/web/lib/preview.ts와 맞춘다) */
  const PASTED_HEADING_SIZE = 19;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (el) => el.getClientRects().length > 0;

  class EditorError extends Error {}

  function find(selector, what) {
    const el = [...document.querySelectorAll(selector)].find(visible);
    if (!el) throw new EditorError(`${what} 버튼을 찾지 못했어요`);
    return el;
  }

  /** 드롭다운이 열릴 때까지 기다리며 조건에 맞는 요소를 찾는다 */
  async function waitFor(pick, timeout = 1500) {
    for (const start = Date.now(); Date.now() - start < timeout; await sleep(50)) {
      const found = pick();
      if (found) return found;
    }
    return null;
  }

  const hasEditor = () => !!document.querySelector(SELECTORS.content);

  /** 선택 영역이 글 본문 안인지. 본문 클래스 이름이 바뀌었을 때를 대비해 편집 가능한 영역이면 본문으로 본다 */
  function isInEditor(node) {
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !!el?.closest(`${SELECTORS.content}, [contenteditable="true"], [contenteditable=""]`);
  }

  async function setBold(on) {
    const button = find(SELECTORS.bold, "굵게");
    const isOn = button.classList.contains(SELECTORS.activeClass) || button.getAttribute("aria-pressed") === "true";
    if (isOn !== on) button.click();
  }

  async function pickSize(size) {
    const opener = find(SELECTORS.fontSize, "글자 크기");
    opener.click();
    const pattern = new RegExp(`fs${size}(?!\\d)`);
    const option = await waitFor(() =>
      [...document.querySelectorAll("button, li")].find(
        (el) => !opener.contains(el) && visible(el) && (pattern.test(el.className) || el.textContent.trim() === String(size)),
      ),
    );
    if (!option) throw new EditorError(`글자 크기 ${size}를 찾지 못했어요`);
    option.click();
    await sleep(80);
  }

  async function pickColor(openerSelector, what, color) {
    const opener = find(openerSelector, what);
    opener.click();
    const options = await waitFor(() => {
      const found = [...document.querySelectorAll(SELECTORS.colorOption)].filter(visible);
      return found.length ? found : null;
    });
    if (!options) throw new EditorError(`${what} 팔레트를 찾지 못했어요`);
    const best = ToolhubLib.nearestColor(color, options.map((el) => ({ el, color: el.getAttribute("data-color") })));
    if (!best) throw new EditorError(`${what} 팔레트에서 색을 고르지 못했어요`);
    best.el.click();
    await sleep(80);
  }

  /** kind: heading(소제목) | emphasis(강조) | highlight(형광펜) */
  async function apply(kind, settings) {
    const s = settings[kind];
    if (kind === "heading") {
      if (s.size) await pickSize(s.size);
      if (s.bold) await setBold(true);
      if (s.color) await pickColor(SELECTORS.fontColor, "글자색", s.color);
    } else if (kind === "emphasis") {
      if (s.bold) await setBold(true);
      if (s.color) await pickColor(SELECTORS.fontColor, "글자색", s.color);
    } else if (kind === "highlight") {
      await pickColor(SELECTORS.backgroundColor, "배경색", s.color);
    }
  }

  function textNodes(el) {
    const texts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) texts.push(walker.currentNode);
    return texts;
  }

  /** 본문 문단 중 글자가 모두 굵고 소제목 크기인 줄 = 붙여넣은 소제목 */
  function isPastedHeading(paragraph) {
    const texts = textNodes(paragraph);
    const size = new RegExp(`se-fs${PASTED_HEADING_SIZE}(?!\\d)`);
    return (
      texts.length > 0 &&
      texts.every((node) => {
        const el = node.parentElement;
        const sized = !!el.closest(`[class*="se-fs"]`)?.className.match(size) || el.closest("[style*='font-size']")?.style.fontSize === `${PASTED_HEADING_SIZE}px`;
        return sized && Number(getComputedStyle(el).fontWeight) >= 600;
      })
    );
  }

  const pastedHeadings = () =>
    [...document.querySelectorAll(`${SELECTORS.textComponent} ${SELECTORS.paragraph}`)].filter(isPastedHeading);

  /**
   * 그 줄 끝을 클릭한 것처럼 커서를 둔다.
   * 에디터는 프로그램으로 바꾼 선택만으로는 커서를 옮기지 않아서(2026-11-03 실제 에디터에서 글 끝 줄이 대신 바뀜)
   * 마우스 누르기·떼기를 함께 보낸다
   */
  async function clickInto(paragraph) {
    paragraph.scrollIntoView({ block: "center" });
    await sleep(80);
    const last = textNodes(paragraph).at(-1);
    const target = last.parentElement;
    const rect = target.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: rect.right - 2, clientY: rect.top + rect.height / 2 };
    target.dispatchEvent(new PointerEvent("pointerdown", { ...at, buttons: 1, pointerType: "mouse", isPrimary: true }));
    target.dispatchEvent(new MouseEvent("mousedown", { ...at, buttons: 1 }));
    const range = document.createRange();
    range.setStart(last, last.length);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    target.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerType: "mouse", isPrimary: true }));
    target.dispatchEvent(new MouseEvent("mouseup", at));
    target.dispatchEvent(new MouseEvent("click", at));
    await sleep(150);
  }

  /** 에디터 툴바가 커서 줄을 "본문 · 소제목 크기"로 보고 있는지 (= 에디터가 그 줄을 잡았는지) */
  const toolbarOnPastedHeading = () =>
    find(SELECTORS.textFormat, "문단 서식").textContent.trim().startsWith("본문") &&
    find(SELECTORS.fontSize, "글자 크기").textContent.trim().startsWith(String(PASTED_HEADING_SIZE));

  /** 붙여넣은 소제목 줄을 하나씩 클릭해 문단 서식을 "소제목"으로 바꾼다. 바꾼 줄 수를 돌려준다 */
  async function convertPastedHeadings() {
    let count = 0;
    // 바꿀 때마다 에디터가 문단을 다시 그리므로 매번 처음부터 다시 찾는다 (끝없이 돌지 않게 상한을 둔다)
    for (let guard = 0; guard < 50; guard++) {
      const paragraph = pastedHeadings()[0];
      if (!paragraph) return count;
      await clickInto(paragraph);
      // 에디터가 다른 줄을 잡고 있으면 엉뚱한 줄이 소제목이 되므로 누르지 않고 멈춘다
      if (!toolbarOnPastedHeading()) {
        throw new EditorError(`${count ? `소제목 ${count}개를 바꾼 뒤 ` : ""}에디터가 다음 소제목 줄을 잡지 못해 멈췄어요 (다른 줄은 바꾸지 않았어요)`);
      }
      find(SELECTORS.textFormat, "문단 서식").click();
      const option = await waitFor(() => [...document.querySelectorAll(SELECTORS.sectionTitleOption)].find(visible));
      if (!option) throw new EditorError("문단 서식에서 소제목을 찾지 못했어요");
      option.click();
      await sleep(200);
      if (paragraph.isConnected && paragraph.closest(SELECTORS.textComponent)) {
        throw new EditorError(count ? `소제목 ${count}개를 바꾸고 멈췄어요` : "소제목으로 바꾸지 못했어요");
      }
      count++;
    }
    return count;
  }

  /** 본문 이미지 자리 표시 문단 (위에서부터). 대표 썸네일 자리는 따로 만든 썸네일을 넣으므로 뺀다 */
  const paragraphs = () => [...document.querySelectorAll(`${SELECTORS.content} ${SELECTORS.paragraph}`)];
  const imageSlots = () => paragraphs().filter((p) => ToolhubLib.imageSlotKind(p.textContent) === "body");

  const EDITABLE = '[contenteditable="true"], [contenteditable=""]';

  /**
   * 에디터가 키보드·붙여넣기를 받는 편집 칸. 글 본문(.se-content)은 편집 칸이 아니고 따로 둔 칸 하나가 받는다
   * (2026-11-12 실제 글쓰기 화면 진단: 편집 가능한 요소가 클래스 없는 DIV 하나). 에디터가 이미 포커스를 줬으면 그것을 쓴다
   */
  function inputTarget(paragraph) {
    const active = document.activeElement;
    if (active?.isContentEditable) return active;
    return paragraph.closest(EDITABLE) ?? [...document.querySelectorAll(EDITABLE)].find((el) => !el.closest(SELECTORS.toolbar)) ?? null;
  }

  /** 안내·진단용 요소 이름 (글자는 담지 않는다) */
  const label = (el) => {
    if (!el) return "없음";
    const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    return [el.tagName, ...classes].join(".");
  };

  /** 에디터 프레임의 좌표 → 탭 전체 화면 좌표. 글쓰기 에디터는 같은 사이트의 iframe 안에 있다 */
  function frameOffset() {
    let x = 0;
    let y = 0;
    for (let w = window; w !== w.top; w = w.parent) {
      const frame = w.frameElement;
      if (!frame) throw new EditorError("에디터 화면 위치를 계산하지 못했어요");
      const rect = frame.getBoundingClientRect();
      x += rect.left + frame.clientLeft;
      y += rect.top + frame.clientTop;
    }
    return { x, y };
  }

  /** 글자 하나의 화면 위치 (두 줄로 넘어간 문단에서도 정확하게 그 글자 자리) */
  function charRect(node, offset) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    return [...range.getClientRects()].find((r) => r.width || r.height) ?? range.getBoundingClientRect();
  }

  const normalize = (text) => text.replace(/[\u200b\ufeff]/g, "").trim();

  /** 이미지 삽입 중인 자리: 몇 번째 문단인지와 삽입 전 모든 문단의 글자 (지운 뒤 표시 문단만 바뀌었는지 확인용) */
  let pending = null;

  /**
   * 이미지 삽입 1단계: 위에서부터 첫 번째 본문 이미지 자리를 화면 가운데로 보이고, 드래그할 시작·끝 좌표(탭 화면 기준)를 준다.
   * 실제 에디터는 확장이 만든 키 입력·선택을 받지 않아서(2026-11-12) 패널이 이 좌표로 진짜 마우스 드래그를 보낸다 (debugger)
   */
  async function locateImageSlot() {
    const slots = imageSlots();
    if (!slots.length) throw new EditorError("남은 본문 이미지 자리([이미지: …] 문단)가 없어요. 대표 썸네일 자리는 건너뛰어요");
    const slot = slots[0];
    slot.scrollIntoView({ block: "center" });
    await sleep(200);
    const texts = textNodes(slot);
    const [first, last] = [texts[0], texts.at(-1)];
    const start = charRect(first, first.textContent.search(/\S/));
    const end = charRect(last, last.textContent.search(/\S\s*$/));
    const offset = frameOffset();
    const all = paragraphs();
    pending = { index: all.indexOf(slot), texts: all.map((p) => p.textContent) };
    return {
      start: { x: offset.x + start.left + 1, y: offset.y + (start.top + start.bottom) / 2 },
      end: { x: offset.x + end.right - 1, y: offset.y + (end.top + end.bottom) / 2 },
    };
  }

  /**
   * 이미지 삽입 2단계: 백스페이스 뒤 확인. 표시 문단만 비었거나 사라졌으면 "cleared", 아무것도 안 바뀌었으면 "unchanged",
   * 다른 글자까지 바뀌었으면 "changed" (패널이 되돌린다)
   */
  function imageSlotStatus() {
    if (!pending) throw new EditorError("이미지 자리를 먼저 찾아야 해요");
    const { index, texts } = pending;
    const now = paragraphs().map((p) => normalize(p.textContent));
    const before = texts.map(normalize);
    const same = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);
    if (same(now, before)) return "unchanged";
    const emptied = before.map((t, i) => (i === index ? "" : t));
    const removed = before.filter((_, i) => i !== index);
    return same(now, emptied) || same(now, removed) ? "cleared" : "changed";
  }

  /**
   * 이미지 삽입 3단계: 패널이 클립보드에 담아 둔 이미지를 지금 커서 자리(비운 표시 문단)에 붙여넣는다.
   * 에디터가 직접 고친 화면은 저장 때 버리므로 진짜 붙여넣기(execCommand paste, clipboardRead 권한)를 일으킨다.
   * { left: 남은 본문 이미지 자리 수 }
   */
  async function pasteImageAtCaret() {
    const images = () => document.querySelectorAll(SELECTORS.image).length;
    const before = images();
    const target = inputTarget(document.querySelector(SELECTORS.content));
    if (!target) throw new EditorError("붙여넣을 편집 칸을 찾지 못했어요");
    if (document.activeElement !== target) target.focus({ preventScroll: true });
    // 실패했을 때 어느 단계에서 막혔는지 알 수 있게, 붙여넣기가 어디로 갔고 이미지 파일이 들어 있었는지 기록한다
    let seen = null;
    const spy = (e) => (seen = { target: label(e.target), files: e.clipboardData?.files.length ?? 0 });
    document.addEventListener("paste", spy, true);
    let pasted;
    try {
      pasted = document.execCommand("paste");
    } finally {
      document.removeEventListener("paste", spy, true);
    }
    const where = `편집 칸 ${label(target)}, 포커스 ${label(document.activeElement)}`;
    if (!pasted || !seen) throw new EditorError(`붙여넣기가 에디터에 닿지 않았어요 (${where})`);
    if (!seen.files) throw new EditorError(`붙여넣기는 됐는데 클립보드에 이미지가 없었어요 (${seen.target})`);
    // 에디터가 이미지를 올리는 동안 기다린다
    if (!(await waitFor(() => images() > before, 10000))) throw new EditorError(`붙여넣기는 ${seen.target}에 닿았는데 에디터가 이미지를 넣지 않았어요 (${where})`);
    pending = null;
    return { left: imageSlots().length };
  }

  const describe = (el) => ({
    class: typeof el.className === "string" ? el.className : "",
    text: el.textContent.trim().slice(0, 20),
    label: el.getAttribute("aria-label") || el.getAttribute("title") || "",
    color: el.getAttribute("data-color") || undefined,
  });

  /** 드롭다운을 잠깐 열어 그 안의 버튼을 기록하고 닫는다 (selector 대신 버튼을 바로 줄 수도 있다) */
  async function peek(selector) {
    const opener = typeof selector === "string" ? [...document.querySelectorAll(selector)].find(visible) : selector;
    if (!opener) return { found: false };
    const shown = () => [...document.querySelectorAll("button, li, [data-color]")].filter(visible);
    const before = new Set(shown());
    opener.click();
    await sleep(400);
    // 열기 전에는 안 보이다가 새로 보이게 된 것 = 드롭다운 안의 항목
    const options = shown().filter((el) => !before.has(el)).slice(0, 60).map(describe);
    opener.click();
    await sleep(150);
    return { found: true, options };
  }

  /** 버튼 위치가 바뀌었을 때 고칠 수 있도록 에디터 구조를 모은다 (글 내용은 담지 않는다) */
  async function diagnose() {
    const toolbarButtons = [...document.querySelectorAll(`${SELECTORS.toolbar} button`)];
    const buttons = toolbarButtons.length ? toolbarButtons : [...document.querySelectorAll("button[class*='se-']")];
    // 네이버 "소제목"은 글자 서식이 아니라 문단 서식(본문·소제목·인용구 드롭다운)이라 그 버튼을 따로 찾아 열어 본다
    const textFormat = buttons.find(
      (el) => visible(el) && (/text-format|paragraph|text-style/i.test(el.className) || /^(본문|소제목)/.test(el.textContent.trim())),
    );
    return {
      url: location.origin + location.pathname,
      userAgent: navigator.userAgent,
      selectors: SELECTORS,
      found: Object.fromEntries(["content", "toolbar", "bold", "fontSize", "fontColor", "backgroundColor", "image"].map((k) => [k, !!document.querySelector(SELECTORS[k])])),
      // 이미지 삽입: 찾은 본문 이미지 자리 수 (글자는 담지 않는다)
      imageSlots: imageSlots().length,
      // 붙여넣기를 받는 편집 칸이 어디 있는지 (본문 안인지, 부모 요소들)
      activeElement: label(document.activeElement),
      editables: [...document.querySelectorAll(EDITABLE)].map((el) => ({
        el: label(el),
        inContent: !!el.closest(SELECTORS.content),
        parents: [el.parentElement, el.parentElement?.parentElement].map(label),
      })),
      toolbarButtons: buttons.slice(0, 100).map(describe),
      fontSize: await peek(SELECTORS.fontSize),
      fontColor: await peek(SELECTORS.fontColor),
      backgroundColor: await peek(SELECTORS.backgroundColor),
      textFormat: textFormat ? { button: describe(textFormat), ...(await peek(textFormat)) } : { found: false },
      // 본문 문단들의 클래스 (소제목 문단을 알아보는 단서). 글자는 담지 않는다
      paragraphs: [...document.querySelectorAll(`${SELECTORS.content} .se-component`)].slice(0, 40).map((el) => el.className),
    };
  }

  return { SELECTORS, EditorError, hasEditor, isInEditor, apply, convertPastedHeadings, locateImageSlot, imageSlotStatus, pasteImageAtCaret, diagnose };
})();
