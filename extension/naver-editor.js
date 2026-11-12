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
  const imageSlots = () =>
    [...document.querySelectorAll(`${SELECTORS.content} ${SELECTORS.paragraph}`)].filter((p) => ToolhubLib.imageSlotKind(p.textContent) === "body");

  /** 문단 글자 전체를 드래그한 것처럼 고른다 (clickInto와 같은 이유로 마우스 누르기·떼기를 함께 보낸다) */
  async function selectWhole(paragraph) {
    paragraph.scrollIntoView({ block: "center" });
    // 패널 버튼을 누른 직후라 포커스가 패널에 있다. 붙여넣기가 이 편집 영역으로 가게 먼저 포커스를 옮긴다
    paragraph.closest('[contenteditable="true"], [contenteditable=""]')?.focus({ preventScroll: true });
    await sleep(80);
    const texts = textNodes(paragraph);
    const [first, last] = [texts[0], texts.at(-1)];
    const point = (node, atEnd) => {
      const rect = node.parentElement.getBoundingClientRect();
      return { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: atEnd ? rect.right - 1 : rect.left + 1, clientY: rect.top + rect.height / 2 };
    };
    const start = point(first, false);
    const end = point(last, true);
    first.parentElement.dispatchEvent(new PointerEvent("pointerdown", { ...start, buttons: 1, pointerType: "mouse", isPrimary: true }));
    first.parentElement.dispatchEvent(new MouseEvent("mousedown", { ...start, buttons: 1 }));
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.length);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    last.parentElement.dispatchEvent(new PointerEvent("pointerup", { ...end, pointerType: "mouse", isPrimary: true }));
    last.parentElement.dispatchEvent(new MouseEvent("mouseup", end));
    await sleep(150);
  }

  /**
   * 패널이 클립보드에 담아 둔 이미지를 위에서부터 첫 번째 본문 이미지 자리에 넣는다.
   * 에디터가 직접 고친 화면은 저장 때 버리므로, 자리 표시 문단을 고른 뒤 사람이 ⌘V 하듯 진짜 붙여넣기를 일으킨다 (clipboardRead 권한).
   * 이미지가 들어갔는데 표시 문단이 남으면 한 번 더 골라 지운다.
   * { left: 남은 자리 수, slotLeft: 표시 문단을 지우지 못했는지 }
   */
  async function insertImageAtNextSlot() {
    const slots = imageSlots();
    if (!slots.length) throw new EditorError("남은 본문 이미지 자리([이미지: …] 문단)가 없어요. 대표 썸네일 자리는 건너뛰어요");
    const images = () => document.querySelectorAll(SELECTORS.image).length;
    const before = images();
    await selectWhole(slots[0]);
    if (!document.execCommand("paste")) throw new EditorError("브라우저가 붙여넣기를 막았어요");
    // 에디터가 이미지를 올리는 동안 기다린다
    if (!(await waitFor(() => images() > before, 10000))) throw new EditorError("이미지가 들어가지 않았어요");
    await sleep(300);
    if (imageSlots().length >= slots.length) {
      await selectWhole(imageSlots()[0]);
      document.execCommand("delete");
      await sleep(200);
    }
    const left = imageSlots().length;
    return { left, slotLeft: left >= slots.length };
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
      toolbarButtons: buttons.slice(0, 100).map(describe),
      fontSize: await peek(SELECTORS.fontSize),
      fontColor: await peek(SELECTORS.fontColor),
      backgroundColor: await peek(SELECTORS.backgroundColor),
      textFormat: textFormat ? { button: describe(textFormat), ...(await peek(textFormat)) } : { found: false },
      // 본문 문단들의 클래스 (소제목 문단을 알아보는 단서). 글자는 담지 않는다
      paragraphs: [...document.querySelectorAll(`${SELECTORS.content} .se-component`)].slice(0, 40).map((el) => el.className),
    };
  }

  return { SELECTORS, EditorError, hasEditor, isInEditor, apply, convertPastedHeadings, insertImageAtNextSlot, diagnose };
})();
