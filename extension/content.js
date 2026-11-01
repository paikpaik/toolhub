/**
 * 네이버 블로그 글쓰기 화면의 서식 묶음 버튼 (소제목·강조·형광펜 등 여러 번 눌러야 하는 서식을 한 번에).
 * 세 가지 방법으로 쓸 수 있다.
 * - 서식 도구: 글쓰기 화면 오른쪽 아래에 항상 떠 있는 버튼 모음. 문장을 선택하고 누른다
 * - 단축키: Option(Alt)+Shift+1·2·3 (chrome://extensions/shortcuts에서 바꿀 수 있음)
 * - 드래그 막대: 문장을 드래그하면 그 위에 뜨는 막대 (에디터가 선택을 숨기면 안 뜰 수 있어 위 두 가지를 함께 둔다)
 * 페이지 스타일과 섞이지 않도록 Shadow DOM 안에 그린다.
 */
(() => {
  const naver = globalThis.ToolhubNaver;
  const lib = globalThis.ToolhubLib;
  if (!naver || !lib) return;

  let settings = lib.DEFAULT_SETTINGS;
  chrome.storage.sync.get("settings").then(({ settings: saved }) => (settings = lib.mergeSettings(saved)));
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) settings = lib.mergeSettings(changes.settings.newValue);
  });

  const ACTIONS = [
    { kind: "heading", label: "소제목", key: "⌥⇧1" },
    { kind: "emphasis", label: "강조", key: "⌥⇧2" },
    { kind: "highlight", label: "형광펜", key: "⌥⇧3" },
  ];
  const FONT = `-apple-system, "Apple SD Gothic Neo", sans-serif`;
  const STYLE = `
    .bar { display:flex; gap:2px; padding:4px; background:#1f2937; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,.25); font:13px/1 ${FONT}; align-items:center; }
    button { border:0; background:none; color:#f9fafb; padding:6px 10px; border-radius:6px; cursor:pointer; font:inherit; white-space:nowrap; }
    button:hover { background:#374151; }
    button small { color:#9ca3af; font-size:10.5px; margin-left:4px; }
    .busy button { opacity:.5; cursor:wait; }
    .title { color:#9ca3af; font-size:11.5px; padding:0 6px 0 8px; }
    .toast { margin-top:6px; max-width:300px; padding:8px 10px; background:#991b1b; color:#fff; border-radius:6px; font:12px/1.4 ${FONT}; }
    .toast.info { background:#374151; }
  `;

  let busy = false;
  const bars = [];

  /** Shadow DOM 막대 하나를 만든다. 눌러도 글에서 선택한 부분이 풀리지 않게 mousedown을 막는다 */
  function createBar({ withTitle, withKeys }) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:2147483647;display:none;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="bar">
        ${withTitle ? `<span class="title">toolhub 서식</span>` : ""}
        ${ACTIONS.map((a) => `<button type="button" data-kind="${a.kind}" title="${a.label} (${a.key})">${a.label}${withKeys ? `<small>${a.key}</small>` : ""}</button>`).join("")}
        ${withTitle ? `<button type="button" data-fold title="접기/펴기">–</button>` : ""}
      </div>
      <div class="toast" hidden></div>`;
    const bar = { host, el: root.querySelector(".bar"), toast: root.querySelector(".toast") };
    host.addEventListener("mousedown", (e) => e.preventDefault());
    bar.el.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (button?.dataset.kind) run(button.dataset.kind, bar);
    });
    document.documentElement.appendChild(host);
    bars.push(bar);
    return bar;
  }

  function showToast(bar, text, isError = true) {
    bar.toast.textContent = text;
    bar.toast.className = isError ? "toast" : "toast info";
    bar.toast.hidden = false;
    clearTimeout(bar.toastTimer);
    bar.toastTimer = setTimeout(() => (bar.toast.hidden = true), isError ? 6000 : 2500);
  }

  const hasSelection = () => {
    const selection = getSelection();
    return !!selection && !selection.isCollapsed && naver.isInEditor(selection.anchorNode);
  };

  async function run(kind, bar) {
    if (busy) return;
    if (!hasSelection()) return showToast(bar, "본문에서 바꿀 문장을 먼저 드래그해서 선택해 주세요.");
    busy = true;
    bars.forEach((b) => b.el.classList.add("busy"));
    try {
      await naver.apply(kind, settings);
      if (bar === dragBar) dragBar.host.style.display = "none";
      else showToast(bar, `${ACTIONS.find((a) => a.kind === kind).label} 적용`, false);
    } catch (e) {
      const message = e instanceof naver.EditorError ? e.message : `적용하지 못했어요 (${e?.message ?? e})`;
      showToast(bar, `${message}. 확장 아이콘 → 패널 아래 "진단 정보 복사"로 알려 주세요.`);
    } finally {
      busy = false;
      bars.forEach((b) => b.el.classList.remove("busy"));
    }
  }

  // ── 서식 도구: 에디터가 있는 프레임에만, 오른쪽 아래에 항상 띄운다 (에디터는 늦게 뜨므로 나타날 때까지 확인) ──
  let dock = null;
  function editorFrame() {
    if (innerWidth < 500 || innerHeight < 300) return false;
    return naver.hasEditor() || !!document.querySelector('[contenteditable="true"]');
  }
  const findEditor = setInterval(() => {
    if (dock || !editorFrame()) return;
    clearInterval(findEditor);
    dock = createBar({ withTitle: true, withKeys: true });
    dock.host.style.cssText += "right:20px;bottom:20px;display:block;";
    // 접으면 제목만 남긴다
    dock.el.querySelector("[data-fold]").addEventListener("click", () => {
      const folded = dock.el.classList.toggle("folded");
      dock.el.querySelectorAll("[data-kind]").forEach((b) => (b.style.display = folded ? "none" : ""));
      dock.el.querySelector("[data-fold]").textContent = folded ? "+" : "–";
    });
  }, 1000);

  // ── 드래그 막대: 선택한 문장 위에 뜬다 ──
  const dragBar = createBar({ withTitle: false, withKeys: false });

  function hideDragBar() {
    if (!busy) dragBar.host.style.display = "none";
  }

  function updateDragBar() {
    const selection = getSelection();
    if (!hasSelection()) return hideDragBar();
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return hideDragBar();
    dragBar.toast.hidden = true;
    dragBar.host.style.display = "block";
    const width = dragBar.host.offsetWidth;
    dragBar.host.style.left = `${Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), innerWidth - width - 8)}px`;
    // 선택 영역 위에 띄우고, 위 공간이 없으면 아래에
    dragBar.host.style.top = `${rect.top > 52 ? rect.top - 46 : rect.bottom + 8}px`;
  }

  // 에디터가 이벤트 전파를 막아도 받도록 모두 캡처 단계에서 듣는다.
  // 드래그하는 동안은 막대를 다시 그리지 않고(깜빡임), 마우스를 뗀 뒤나 키보드로 선택을 바꿨을 때 계산한다
  let mouseDown = false;
  let pending = 0;
  const schedule = (delay = 30) => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      pending = 0;
      updateDragBar();
    }, delay);
  };
  const fromBar = (e) => bars.some((b) => e.composedPath().includes(b.host));
  document.addEventListener("mousedown", (e) => !fromBar(e) && (mouseDown = true), true);
  document.addEventListener(
    "mouseup",
    (e) => {
      mouseDown = false;
      if (!fromBar(e)) schedule();
    },
    true,
  );
  // 마우스 이벤트를 놓쳐도(에디터가 가로채는 경우) 선택이 바뀐 것으로 잡는다 (이미 계산이 잡혀 있으면 미루지 않는다)
  document.addEventListener("selectionchange", () => !mouseDown && !busy && !pending && schedule(150));
  document.addEventListener("keyup", (e) => e.key === "Escape" && hideDragBar(), true);
  // 스크롤해도 선택이 남아 있으면 막대를 따라 옮긴다 (에디터가 선택할 때 스스로 스크롤하는 경우가 있어 숨기지 않는다)
  document.addEventListener("scroll", () => dragBar.host.style.display === "block" && schedule(0), true);

  // 진단 정보에서 "이 프레임에 확장이 들어갔는지" 확인하는 표시
  document.documentElement.dataset.toolhubContent = "1";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // 단축키(background.js): 지금 포커스가 있는 에디터 프레임만 처리한다
    if (message?.type === "format") {
      if (document.hasFocus() && editorFrame()) run(message.kind, dock ?? dragBar);
      return false;
    }
    // 패널의 "진단 정보 복사". 에디터가 있는 프레임만 답한다
    if (message?.type !== "diagnose" || !naver.hasEditor()) return false;
    naver.diagnose().then(sendResponse, (e) => sendResponse({ error: String(e?.message ?? e) }));
    return true;
  });
})();
