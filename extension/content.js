/**
 * 글 본문에서 문장을 드래그하면 그 위에 [소제목] [강조] [형광펜] 막대를 띄운다.
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
    { kind: "heading", label: "소제목" },
    { kind: "emphasis", label: "강조" },
    { kind: "highlight", label: "형광펜" },
  ];

  let host = null;
  let bar = null;
  let toast = null;
  let busy = false;

  function build() {
    host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;display:none;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .bar { display:flex; gap:2px; padding:4px; background:#1f2937; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,.25); font:13px/1 -apple-system, "Apple SD Gothic Neo", sans-serif; }
        button { border:0; background:none; color:#f9fafb; padding:6px 10px; border-radius:6px; cursor:pointer; font:inherit; white-space:nowrap; }
        button:hover { background:#374151; }
        .bar.busy button { opacity:.5; cursor:wait; }
        .toast { margin-top:6px; max-width:280px; padding:8px 10px; background:#991b1b; color:#fff; border-radius:6px; font:12px/1.4 -apple-system, "Apple SD Gothic Neo", sans-serif; }
      </style>
      <div class="bar">${ACTIONS.map((a) => `<button type="button" data-kind="${a.kind}">${a.label}</button>`).join("")}</div>
      <div class="toast" hidden></div>`;
    bar = root.querySelector(".bar");
    toast = root.querySelector(".toast");
    // 막대를 눌러도 글에서 선택한 부분이 풀리지 않게 한다
    host.addEventListener("mousedown", (e) => e.preventDefault());
    bar.addEventListener("click", (e) => {
      const kind = e.target.closest("button")?.dataset.kind;
      if (kind) run(kind);
    });
    document.documentElement.appendChild(host);
  }

  async function run(kind) {
    if (busy) return;
    busy = true;
    bar.classList.add("busy");
    toast.hidden = true;
    try {
      await naver.apply(kind, settings);
      host.style.display = "none";
    } catch (e) {
      const message = e instanceof naver.EditorError ? e.message : `적용하지 못했어요 (${e?.message ?? e})`;
      toast.textContent = `${message}. 확장 프로그램 아이콘 → "진단 정보 복사"로 알려 주세요.`;
      toast.hidden = false;
    } finally {
      busy = false;
      bar.classList.remove("busy");
    }
  }

  function hide() {
    if (host && !busy) host.style.display = "none";
  }

  function update() {
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !naver.isInEditor(selection.anchorNode)) return hide();
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return hide();
    if (!host) build();
    toast.hidden = true;
    host.style.display = "block";
    const width = host.offsetWidth;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), innerWidth - width - 8);
    // 선택 영역 위에 띄우고, 위 공간이 없으면 아래에
    const top = rect.top > 52 ? rect.top - 46 : rect.bottom + 8;
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  // 드래그를 끝냈을 때와 Shift+방향키로 선택했을 때만 다시 계산한다 (선택이 바뀔 때마다 하면 드래그 중에 깜빡인다)
  document.addEventListener("mouseup", (e) => {
    if (host && e.composedPath().includes(host)) return;
    setTimeout(update, 10);
  });
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey || e.key === "Shift") update();
    else if (e.key === "Escape") hide();
  });
  document.addEventListener("scroll", hide, true);

  // 팝업의 "진단 정보 복사". 에디터가 있는 프레임만 답한다
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "diagnose" || !naver.hasEditor()) return false;
    naver.diagnose().then(sendResponse, (e) => sendResponse({ error: String(e?.message ?? e) }));
    return true;
  });
})();
