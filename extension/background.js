/**
 * 이미지 모음: Gemini·ChatGPT 등에서 만든 이미지를 캡처·저장하지 않고 패널로 가져와 블로그에 붙여넣기 위함.
 * - 자동 담기: 패널이 열려 있으면 AI 사이트(content-ai.js)에서 새로 생긴 큰 이미지를 담는다
 * - 오른쪽 클릭 → "toolhub 패널에 담기"
 * - 패널에 끌어다 놓은 이미지 중 패널이 직접 받지 못하는 주소(blob:, 로그인 필요)를 대신 받는다
 */
importScripts("lib.js");

const MENU_ID = "toolhub-add-image";

// 확장 아이콘을 누르면 사이드 패널(이미지 모음)을 연다. 패널 위치(왼쪽·오른쪽)는 크롬 설정 › 모양 › 사이드 패널에서 정한다
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// 서식 단축키 → 지금 탭의 에디터 프레임(content.js)에 전달
chrome.commands.onCommand.addListener((command, tab) => {
  const kind = command.replace(/^format-/, "");
  if (tab?.id && command.startsWith("format-")) chrome.tabs.sendMessage(tab.id, { type: "format", kind }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "toolhub 패널에 담기", contexts: ["image"] });
});

/** 열려 있는 패널 수. 패널이 닫혀 있을 때는 자동 담기를 하지 않는다 (예전 대화를 넘겨 볼 때 쌓이지 않게) */
let openPanels = 0;
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "shelf-panel") return;
  openPanels++;
  port.onDisconnect.addListener(() => openPanels--);
});

/** 확장 권한으로 바로 받는다 (다른 사이트 이미지도 CORS 제한 없이) */
async function fetchAsDataUrl(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`이미지를 받지 못했어요 (${res.status})`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("이미지 파일이 아니에요");
  return ToolhubLib.bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), blob.type);
}

/** blob: 주소나 로그인이 필요한 이미지는 그 페이지 안에서 읽어야 한다. 프레임을 모르면 모든 프레임에서 시도 */
async function readInPage(tabId, frameId, src) {
  const results = await chrome.scripting.executeScript({
    target: frameId === undefined ? { tabId, allFrames: true } : { tabId, frameIds: [frameId] },
    args: [src],
    func: async (url) => {
      try {
        const blob = await (await fetch(url, { credentials: "include" })).blob();
        if (!blob.type.startsWith("image/")) return null;
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    },
  });
  const found = results.map((r) => r.result).find(Boolean);
  if (!found) throw new Error("이 이미지는 페이지 밖으로 가져올 수 없어요");
  return found;
}

async function toDataUrl(src, tabId, frameId) {
  if (src.startsWith("data:")) return src;
  if (!src.startsWith("blob:")) {
    try {
      return await fetchAsDataUrl(src);
    } catch {
      // 아래에서 페이지 안에서 다시 시도
    }
  }
  if (tabId === undefined) throw new Error("이미지를 받지 못했어요");
  return readInPage(tabId, frameId, src);
}

/** 패널과 background가 동시에 쓰지 않도록 담기는 여기서 차례로 처리한다 */
let queue = Promise.resolve();
function addToShelf(src, from, source) {
  queue = queue.then(async () => {
    const { shelf = [] } = await chrome.storage.local.get("shelf");
    const item = { id: Date.now(), src, from, source, addedAt: new Date().toISOString() };
    await chrome.storage.local.set({ shelf: ToolhubLib.addToShelf(shelf, item) });
  });
  return queue;
}

/** 패널이 상태를 보여 줄 수 있게 알린다 (패널이 닫혀 있으면 무시) */
const notify = (message) => chrome.runtime.sendMessage({ type: "shelf-status", ...message }).catch(() => {});

/** 실패하면 패널에 이유와 대안을 보여 준다 */
async function collect(src, tabId, frameId, from) {
  try {
    const dataUrl = await toDataUrl(src, tabId, frameId);
    if (!ToolhubLib.dataUrlMime(dataUrl)) throw new Error("이미지 파일이 아니에요");
    await addToShelf(dataUrl, from, src.startsWith("data:") ? undefined : src);
    notify({ text: "담았어요. 클릭하면 복사돼요." });
  } catch (e) {
    notify({ text: `담지 못했어요: ${e?.message ?? e}. 사이트의 "이미지 복사" 후 패널에 붙여넣어 보세요.`, error: true });
  }
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl || !tab?.id) return;
  // 패널 열기는 사용자가 누른 직후에만 허용되므로 기다리기 전에 먼저 연다
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  notify({ text: "이미지를 담는 중…" });
  collect(info.srcUrl, tab.id, info.frameId, hostOf(info.pageUrl ?? tab.url));
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "shelf-auto") {
    // 자동 담기는 패널이 열려 있고 켜져 있을 때만
    if (!openPanels) return;
    chrome.storage.local.get("autoCollect").then(async ({ autoCollect }) => {
      if (autoCollect === false) return;
      if (message.dataUrl && ToolhubLib.dataUrlMime(message.dataUrl)) {
        await addToShelf(message.dataUrl, message.from, message.src);
        notify({ text: `${message.from}에서 새 이미지를 담았어요.` });
      } else {
        await collect(message.src, sender.tab?.id, sender.frameId, message.from);
      }
    });
  } else if (message?.type === "shelf-add-url") {
    // 패널에 끌어다 놓았는데 패널이 직접 받지 못한 주소: 지금 보고 있는 탭에서 읽는다
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
      notify({ text: "이미지를 받는 중…" });
      collect(message.url, tab?.id, undefined, hostOf(tab?.url ?? message.url));
    });
  }
});
