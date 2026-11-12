/**
 * 이미지 모음: Gemini·ChatGPT 등에서 만든 이미지를 캡처·저장하지 않고 패널로 가져와 블로그에 붙여넣기 위함.
 * - 자동 담기: 패널이 열려 있으면 AI 사이트(content-ai.js)에서 새로 생긴 큰 이미지를 담는다
 * - 오른쪽 클릭 → "toolhub 패널에 담기"
 * - 패널에 끌어다 놓은 이미지 중 패널이 직접 받지 못하는 주소(blob:, 로그인 필요)를 대신 받는다
 */
importScripts("lib.js", "shelf-store.js");

const MENU_ID = "toolhub-add-image";
const ADVISOR_MENU_ID = "toolhub-advisor-trends";
const ADVISOR_PAGES = ["https://creator-advisor.naver.com/*"];

// 확장 아이콘을 누르면 사이드 패널(이미지 모음)을 연다. 패널 위치(왼쪽·오른쪽)는 크롬 설정 › 모양 › 사이드 패널에서 정한다
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// 서식 단축키 → 지금 탭의 에디터 프레임(content.js)에 전달
chrome.commands.onCommand.addListener((command, tab) => {
  const kind = command.replace(/^format-/, "");
  if (tab?.id && command.startsWith("format-")) chrome.tabs.sendMessage(tab.id, { type: "format", kind }).catch(() => {});
});

// 예전 방식(data URL 배열)으로 담아 둔 이미지를 새 저장소로 옮긴다 (업데이트 직후·크롬을 켤 때. 패널을 열 때도 한 번 더)
chrome.runtime.onStartup.addListener(() => ToolhubShelf.migrate().catch(() => {}));

chrome.runtime.onInstalled.addListener(() => {
  ToolhubShelf.migrate().catch(() => {});
  chrome.contextMenus.create({ id: MENU_ID, title: "toolhub 패널에 담기", contexts: ["image"] });
  chrome.contextMenus.create({
    id: ADVISOR_MENU_ID,
    title: "toolhub: 트렌드 키워드 복사",
    contexts: ["page", "selection", "link"],
    documentUrlPatterns: ADVISOR_PAGES,
  });
});

/**
 * 패널이 닫혀 있을 때는 자동 담기를 하지 않는다 (예전 대화를 넘겨 볼 때 쌓이지 않게).
 * background는 30초쯤 쉬면 꺼졌다가 메시지가 오면 다시 켜지므로, 메모리의 연결 수만 믿으면
 * 이미지 생성을 기다리는 사이 0이 되어 패널이 열려 있어도 버린다. 그래서 크롬에 열린 패널을 직접 묻는다
 */
let openPanels = 0;
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "shelf-panel") return;
  openPanels++;
  port.onDisconnect.addListener(() => openPanels--);
});

async function panelOpen() {
  if (chrome.runtime.getContexts) {
    try {
      // 사이드 패널이든 탭으로 연 패널이든 패널 주소로 찾는다
      return (await chrome.runtime.getContexts({ documentUrls: [chrome.runtime.getURL("sidepanel.html")] })).length > 0;
    } catch {
      // 아래 연결 수로
    }
  }
  return openPanels > 0;
}

/** 확장 권한으로 바로 받는다 (다른 사이트 이미지도 CORS 제한 없이) */
async function fetchImage(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`이미지를 받지 못했어요 (${res.status})`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("이미지 파일이 아니에요");
  return blob;
}

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

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

async function toBlob(src, tabId, frameId) {
  if (src.startsWith("data:")) return dataUrlToBlob(src);
  if (!src.startsWith("blob:")) {
    try {
      return await fetchImage(src);
    } catch {
      // 아래에서 페이지 안에서 다시 시도
    }
  }
  if (tabId === undefined) throw new Error("이미지를 받지 못했어요");
  // 페이지 밖으로는 글자(data URL)로만 꺼낼 수 있어서 받은 뒤 다시 Blob으로
  return dataUrlToBlob(await readInPage(tabId, frameId, src));
}

/** 패널이 상태를 보여 줄 수 있게 알린다 (패널이 닫혀 있으면 무시) */
const notify = (message) => chrome.runtime.sendMessage({ type: "shelf-status", ...message }).catch(() => {});

/** 실패하면 패널에 이유와 대안을 보여 준다 */
async function collect(src, tabId, frameId, from) {
  try {
    const blob = await toBlob(src, tabId, frameId);
    await ToolhubShelf.addImage(blob, { from, source: src.startsWith("data:") ? undefined : src });
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
    Promise.all([panelOpen(), chrome.storage.local.get("autoCollect")]).then(async ([open, { autoCollect }]) => {
      if (!open || autoCollect === false) return;
      if (message.dataUrl && ToolhubLib.dataUrlMime(message.dataUrl)) {
        try {
          await ToolhubShelf.addImage(await dataUrlToBlob(message.dataUrl), { from: message.from, source: message.src });
          notify({ text: `${message.from}에서 새 이미지를 담았어요.` });
        } catch (e) {
          notify({ text: `담지 못했어요: ${e?.message ?? e}`, error: true });
        }
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

/**
 * 크리에이터 어드바이저 트렌드: 화면의 카드별 키워드를 읽어(advisor.js) 탭별로 모아 두고, 지금까지 모은 것을 복사한다.
 * 검색 유입 트렌드에서 한 번, 메인 유입 트렌드에서 한 번 누르면 둘이 함께 복사된다 (같은 날짜끼리, 브라우저를 닫으면 비워짐)
 */
async function copyAdvisorTrends(tabId) {
  const show = (text, ok) =>
    chrome.scripting
      .executeScript({
        target: { tabId },
        args: [text, ok],
        func: async (message, copy) => {
          // 클립보드는 페이지 안에서 쓴다. 메뉴를 누른 직후라 막히면 숨긴 입력칸으로 한 번 더
          if (copy) {
            try {
              await navigator.clipboard.writeText(copy);
            } catch {
              const area = Object.assign(document.createElement("textarea"), { value: copy });
              document.body.append(area);
              area.select();
              document.execCommand("copy");
              area.remove();
            }
          }
          const toast = Object.assign(document.createElement("div"), { textContent: message });
          Object.assign(toast.style, {
            position: "fixed", left: "50%", bottom: "32px", transform: "translateX(-50%)", zIndex: 2147483647,
            maxWidth: "min(560px, 90vw)", padding: "12px 16px", borderRadius: "10px", background: "#1f2430", color: "#fff",
            font: "14px/1.5 -apple-system, sans-serif", boxShadow: "0 6px 24px rgba(0,0,0,.25)", whiteSpace: "pre-line",
          });
          document.body.append(toast);
          setTimeout(() => toast.remove(), 4000);
        },
      })
      .catch(() => {});

  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, files: ["lib.js", "advisor.js"] });
    if (!result || result.error) return show(result?.error ?? "키워드를 읽지 못했어요.", null);
    const { advisorTrends } = await chrome.storage.session.get("advisorTrends");
    const merged = ToolhubLib.mergeAdvisorTrends(advisorTrends, result.date, result.tab, result.cards);
    await chrome.storage.session.set({ advisorTrends: merged });
    const count = result.cards.reduce((n, c) => n + c.items.length, 0);
    const tabs = Object.keys(merged.tabs);
    const next = tabs.includes("메인 유입 트렌드") ? "" : "\n메인 유입 트렌드 탭에서 한 번 더 누르면 함께 복사돼요.";
    await show(`${result.tab}: 카드 ${result.cards.length}개 · 키워드 ${count}개를 읽었어요.\n복사한 탭: ${tabs.join(", ")} — Claude 앱에 붙여넣으세요.${next}`, ToolhubLib.formatAdvisorTrends(merged));
  } catch (e) {
    show(`키워드를 읽지 못했어요: ${e?.message ?? e}`, null);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === ADVISOR_MENU_ID && tab?.id) copyAdvisorTrends(tab.id);
});
