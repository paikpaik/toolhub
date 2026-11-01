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
  };

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

  /** 선택 영역이 글 본문 안인지 (제목 칸·다른 입력창은 제외) */
  function isInEditor(node) {
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !!el?.closest(SELECTORS.content);
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

  const describe = (el) => ({
    class: typeof el.className === "string" ? el.className : "",
    text: el.textContent.trim().slice(0, 20),
    label: el.getAttribute("aria-label") || el.getAttribute("title") || "",
    color: el.getAttribute("data-color") || undefined,
  });

  /** 드롭다운을 잠깐 열어 그 안의 버튼을 기록하고 닫는다 */
  async function peek(selector) {
    const opener = [...document.querySelectorAll(selector)].find(visible);
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
    return {
      url: location.origin + location.pathname,
      userAgent: navigator.userAgent,
      selectors: SELECTORS,
      found: Object.fromEntries(["content", "toolbar", "bold", "fontSize", "fontColor", "backgroundColor"].map((k) => [k, !!document.querySelector(SELECTORS[k])])),
      toolbarButtons: buttons.slice(0, 100).map(describe),
      fontSize: await peek(SELECTORS.fontSize),
      fontColor: await peek(SELECTORS.fontColor),
      backgroundColor: await peek(SELECTORS.backgroundColor),
    };
  }

  return { SELECTORS, EditorError, hasEditor, isInEditor, apply, diagnose };
})();
